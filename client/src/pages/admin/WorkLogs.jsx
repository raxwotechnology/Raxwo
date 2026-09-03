import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { FiPlus, FiX, FiCheck, FiMessageSquare, FiFlag, FiUpload, FiLink, FiImage, FiFilter, FiCheckCircle, FiAlertCircle, FiClock, FiCheckSquare, FiSquare, FiUsers, FiLayers } from 'react-icons/fi'
import useAuthStore from '../../store/authStore'
import ExportBar from '../../components/ui/ExportBar'
import { mediaUrl, normalizeUploadPath } from '../../lib/media'
import UserAvatar from '../../components/ui/UserAvatar'

const ROLES = ['all', 'developer', 'designer', 'marketing', 'manager']

const statusBadge = (s, approval) => {
  if (approval === 'approved') return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  if (approval === 'rejected') return 'bg-red-100 text-red-700 border border-red-200'
  if (s === 'reviewed') return 'bg-blue-100 text-blue-700 border border-blue-200'
  if (s === 'flagged') return 'bg-red-100 text-red-700 border border-red-200'
  return 'bg-slate-100 text-slate-600 border border-slate-200'
}

export default function WorkLogs() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const [employeeFilter, setEmployeeFilter] = useState(searchParams.get('employee') || '')
  const [approvalFilter, setApprovalFilter] = useState('all')
  const [showSubmit, setShowSubmit] = useState(false)
  const [tasks, setTasks] = useState([{ taskName: '', hours: '', project: '', notes: '' }])
  const [blockers, setBlockers] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [branchFilter, setBranchFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [commentTarget, setCommentTarget] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [screenshots, setScreenshots] = useState([])
  const [attachments, setAttachments] = useState([])
  const [projectLinks, setProjectLinks] = useState([{ url: '', label: '' }])
  const [approveTarget, setApproveTarget] = useState(null)
  const [approvalNote, setApprovalNote] = useState('')

  // Bulk Selection State
  const [selectedLogs, setSelectedLogs] = useState([])
  const [bulkModal, setBulkModal] = useState(false)
  const [bulkAction, setBulkAction] = useState('approved')
  const [bulkNote, setBulkNote] = useState('')

  const isAdmin = ['admin', 'manager'].includes(user?.role)

  // Ensure employee profile exists before submit (fixes "Employee record not found" on Hostinger)
  useEffect(() => {
    if (!isAdmin && user) {
      api.get('/auth/me').catch(() => {})
    }
  }, [isAdmin, user?._id])

  const { data: projData } = useQuery({ queryKey: ['projects-list'], queryFn: () => api.get('/projects').then(r => r.data) })
  const projects = projData?.projects || []

  const { data: branchData } = useQuery({ queryKey: ['branches-list'], queryFn: () => api.get('/branches').then(r => r.data), enabled: isAdmin })
  const branches = branchData?.branches || []

  const { data: empData } = useQuery({ queryKey: ['employees-worklogs-list'], queryFn: () => api.get('/employees').then(r => r.data), enabled: isAdmin })
  const employeesList = empData?.employees || []

  const endpoint = isAdmin ? '/work-logs' : '/work-logs/my'
  const { data, isLoading } = useQuery({
    queryKey: ['work-logs', isAdmin, branchFilter, dateFilter, roleFilter, employeeFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (branchFilter) params.set('branch', branchFilter)
      if (dateFilter) params.set('date', dateFilter)
      if (roleFilter && roleFilter !== 'all') params.set('role', roleFilter)
      if (employeeFilter) params.set('employee', employeeFilter)
      return api.get(`${endpoint}?${params.toString()}`).then(r => r.data)
    },
    staleTime: 30000,
  })

  const rawLogs = data?.logs || []
  const logs = approvalFilter === 'all' 
    ? rawLogs 
    : rawLogs.filter(l => l.approvalStatus === approvalFilter || (approvalFilter === 'pending' && !l.approvalStatus))
  const submissionRate = data?.submissionRate || 0

  const canSubmit = tasks.some((t) => String(t.taskName || '').trim() && Number(t.hours) > 0)

  const submitMut = useMutation({
    mutationFn: async (payload) => {
      const sanitizedTasks = (payload.tasks || [])
        .filter((t) => t.taskName && t.hours)
        .map((t) => {
          const row = {
            taskName: String(t.taskName).trim(),
            hours: Number(t.hours),
            notes: t.notes || '',
          }
          if (t.project && String(t.project).trim()) row.project = t.project
          return row
        })

      const fd = new FormData()
      fd.append('date', payload.date)
      fd.append('tasks', JSON.stringify(sanitizedTasks))
      fd.append('blockers', payload.blockers || '')
      fd.append('notes', payload.notes || '')
      fd.append('projectLinks', JSON.stringify(payload.projectLinks.filter(l => l.url)))
      screenshots.forEach(f => fd.append('screenshots', f))
      attachments.forEach(f => fd.append('attachments', f))
      return api.post('/work-logs/my', fd).then(r => r.data)
    },
    onSuccess: () => {
      toast.success('Work log submitted!')
      setShowSubmit(false)
      setTasks([{ taskName: '', hours: '', project: '', notes: '' }])
      setBlockers(''); setNotes(''); setScreenshots([]); setAttachments([])
      setProjectLinks([{ url: '', label: '' }])
      qc.invalidateQueries({ queryKey: ['work-logs'] })
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed to submit')
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }) => api.put(`/work-logs/${id}/status`, { status }),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['work-logs'] }) }
  })

  const approveMut = useMutation({
    mutationFn: ({ id, approvalStatus, approvalNote }) => api.put(`/work-logs/${id}/approve`, { approvalStatus, approvalNote }),
    onSuccess: () => {
      toast.success('Work log updated'); setApproveTarget(null); setApprovalNote('')
      qc.invalidateQueries({ queryKey: ['work-logs'] })
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed')
  })

  const bulkApproveMut = useMutation({
    mutationFn: ({ logIds, approvalStatus, approvalNote }) =>
      api.put('/work-logs/bulk-approve', { logIds, approvalStatus, approvalNote }),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Work logs updated successfully')
      setSelectedLogs([])
      setBulkModal(false)
      setBulkNote('')
      qc.invalidateQueries({ queryKey: ['work-logs'] })
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update selected work logs')
  })

  const commentMut = useMutation({
    mutationFn: ({ id, comment }) => api.post(`/work-logs/${id}/comments`, { comment }),
    onSuccess: () => {
      toast.success('Comment added'); setCommentText(''); setCommentTarget(null)
      qc.invalidateQueries({ queryKey: ['work-logs'] })
    }
  })

  const addTask = () => setTasks([...tasks, { taskName: '', hours: '', project: '', notes: '' }])
  const removeTask = idx => setTasks(tasks.filter((_, i) => i !== idx))
  const updateTask = (idx, field, val) => { const t = [...tasks]; t[idx][field] = val; setTasks(t) }
  const addLink = () => setProjectLinks([...projectLinks, { url: '', label: '' }])
  const updateLink = (idx, field, val) => { const l = [...projectLinks]; l[idx][field] = val; setProjectLinks(l) }

  // Selection helpers
  const toggleSelectLog = (id) => {
    setSelectedLogs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const allVisibleIds = logs.map(l => l._id)
  const pendingIds = logs.filter(l => l.approvalStatus === 'pending' || !l.approvalStatus).map(l => l._id)

  const isAllSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedLogs.includes(id))
  const isAllPendingSelected = pendingIds.length > 0 && pendingIds.every(id => selectedLogs.includes(id))

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedLogs([])
    } else {
      setSelectedLogs(allVisibleIds)
    }
  }

  const selectOnlyPending = () => {
    if (isAllPendingSelected) {
      setSelectedLogs([])
    } else {
      setSelectedLogs(pendingIds)
    }
  }

  const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col md:flex-row md:items-center gap-4">
        <div>
          <h1 className="page-title">Daily Work Logs</h1>
          <p className="page-subtitle">Track daily tasks and project contributions.</p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full md:w-auto items-stretch sm:items-center">
          {isAdmin && (
            <>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <input type="date" className="form-input text-sm flex-1 sm:w-auto" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
                <select className="form-select text-sm flex-1 sm:w-auto" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
                  <option value="">All Branches</option>
                  {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
                <select className="form-select text-sm flex-1 sm:w-48" value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}>
                  <option value="">All Employees</option>
                  {employeesList.map(emp => (
                    <option key={emp._id} value={emp._id}>
                      {emp.userId?.name || emp.employeeNo} {emp.employmentType === 'intern' ? '(Intern)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex overflow-x-auto rounded-xl border border-slate-200 bg-white no-scrollbar w-full sm:w-auto">
                {ROLES.map(r => (
                  <button key={r} onClick={() => setRoleFilter(r)}
                    className={`px-3 py-2 text-xs font-semibold capitalize whitespace-nowrap transition-colors flex-1 text-center ${roleFilter === r ? 'bg-secondary text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                    {r}
                  </button>
                ))}
              </div>
              <ExportBar 
                data={logs}
                columns={[
                  { header: 'Date', accessor: l => new Date(l.date).toLocaleDateString() },
                  { header: 'Employee', accessor: l => l.employee?.userId?.name || 'Unknown' },
                  { header: 'Role', accessor: 'employeeRole' },
                  { header: 'Total Hours', accessor: 'totalHours' },
                  { header: 'Status', accessor: 'status' },
                  { header: 'Approval', accessor: 'approvalStatus' },
                  { header: 'Blockers', accessor: 'blockers' },
                  { header: 'Notes', accessor: 'notes' }
                ]}
                title="Work Logs Report"
                filters={{ Date: dateFilter, Branch: branchFilter, Role: roleFilter, Employee: employeeFilter }}
              />
            </>
          )}
          {!isAdmin && (
            <>
              <ExportBar 
                data={logs}
                columns={[
                  { header: 'Date', accessor: l => new Date(l.date).toLocaleDateString() },
                  { header: 'Total Hours', accessor: 'totalHours' },
                  { header: 'Status', accessor: 'status' },
                  { header: 'Approval', accessor: 'approvalStatus' },
                  { header: 'Tasks', accessor: l => l.tasks?.map(t => t.taskName).join(', ') || '' },
                  { header: 'Blockers', accessor: 'blockers' }
                ]}
                title="My Work Logs Report"
              />
              <button onClick={() => setShowSubmit(true)} className="btn-primary gap-2 w-full sm:w-auto justify-center">
                <FiPlus size={14} /> Submit Log
              </button>
            </>
          )}
        </div>
      </div>

      {isAdmin && dateFilter && (
        <div className="card card-body bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-blue-900">Submission Rate — {new Date(dateFilter + 'T00:00:00').toLocaleDateString()}</h3>
            <p className="text-sm text-blue-700">% of active employees who submitted logs.</p>
          </div>
          <div className="text-4xl font-black text-blue-700">{submissionRate}%</div>
        </div>
      )}

      {/* Admin Status Filter & Bulk Selection Bar */}
      {isAdmin && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar">
            {[
              { key: 'all', label: 'All Logs', count: rawLogs.length },
              { key: 'pending', label: 'Pending', count: rawLogs.filter(l => l.approvalStatus === 'pending' || !l.approvalStatus).length },
              { key: 'approved', label: 'Approved', count: rawLogs.filter(l => l.approvalStatus === 'approved').length },
              { key: 'rejected', label: 'Rejected', count: rawLogs.filter(l => l.approvalStatus === 'rejected').length },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setApprovalFilter(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  approvalFilter === tab.key
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${approvalFilter === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Bulk Selection Controls */}
          {logs.length > 0 && (
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 hover:text-slate-900">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                  />
                  <span>Select All ({allVisibleIds.length})</span>
                </label>

                {pendingIds.length > 0 && (
                  <button
                    type="button"
                    onClick={selectOnlyPending}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Select Pending ({pendingIds.length})
                  </button>
                )}
              </div>

              {selectedLogs.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setBulkAction('approved'); setBulkModal(true) }}
                    className="btn-primary btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 text-xs px-3 py-1"
                  >
                    <FiCheckCircle size={13} /> Approve All ({selectedLogs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBulkAction('rejected'); setBulkModal(true) }}
                    className="btn-danger btn-sm text-xs px-2.5 py-1"
                  >
                    Reject ({selectedLogs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLogs([])}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                    title="Clear Selection"
                  >
                    <FiX size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-4">
          {logs.map(log => {
            const isSelected = selectedLogs.includes(log._id)
            return (
              <motion.div
                key={log._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`card p-0 overflow-hidden border transition-all duration-200 ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50/10 shadow-md'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`p-4 border-b flex justify-between items-start flex-wrap gap-3 transition-colors ${isSelected ? 'bg-indigo-50/40 border-indigo-100' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-3">
                    {isAdmin && (
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded accent-indigo-600 cursor-pointer shrink-0"
                        checked={isSelected}
                        onChange={() => toggleSelectLog(log._id)}
                      />
                    )}
                    {isAdmin && (
                      <UserAvatar
                        user={{ name: log.employee?.userId?.name, avatar: log.employee?.userId?.avatar || log.employee?.profilePhoto }}
                        className="w-10 h-10 rounded-full flex-shrink-0 border-2 border-white shadow-sm"
                        imgClassName="w-full h-full rounded-full object-cover object-top"
                      />
                    )}
                    <div>
                      <h3 className="font-bold text-primary">{isAdmin ? log.employee?.userId?.name : 'My Work Log'}</h3>
                      <p className="text-xs text-slate-500">
                        {new Date(log.date).toLocaleDateString()} · {log.totalHours} hrs
                        {isAdmin && log.employeeRole && <span className="ml-2 capitalize badge badge-gray text-[10px]">{log.employeeRole}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusBadge(log.status, log.approvalStatus)}`}>
                      {log.approvalStatus === 'approved' ? '✅ Approved' : log.approvalStatus === 'rejected' ? '❌ Rejected' : log.status}
                    </span>
                    {isAdmin && log.approvalStatus === 'pending' && (
                      <button onClick={() => setApproveTarget(log._id)} className="btn-primary btn-sm text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                        <FiCheck size={12} /> Review / Approve
                      </button>
                    )}
                    {isAdmin && log.status !== 'flagged' && (
                      <button onClick={() => statusMut.mutate({ id: log._id, status: 'flagged' })}
                        className="btn-outline btn-sm text-red-500 border-red-200 hover:bg-red-50 text-xs gap-1">
                        <FiFlag size={12} /> Flag
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Tasks</p>
                    <ul className="space-y-1.5">
                      {log.tasks.map((t, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                          <FiCheck size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                          <span className="font-medium">{t.taskName}</span>
                          <span className="text-slate-400">({t.hours}h)</span>
                          {t.project && <span className="badge badge-gray text-[10px]">{t.project.title}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {log.projectLinks?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Project Links</p>
                      <div className="flex flex-wrap gap-2">
                        {log.projectLinks.map((l, i) => (
                          <a key={i} href={l.url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-secondary hover:underline bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                            <FiLink size={10} /> {l.label || l.url}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {log.screenshots?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase mb-2">Screenshots</p>
                      <div className="flex flex-wrap gap-2.5">
                        {log.screenshots.map((s, i) => {
                          const sUrl = s ? mediaUrl(normalizeUploadPath(s) || s) : ''
                          return (
                            <a key={i} href={sUrl} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-xl border border-slate-200 shadow-sm hover:border-secondary transition-all">
                              <img
                                src={sUrl}
                                alt={`Screenshot ${i + 1}`}
                                className="w-20 h-20 object-cover object-top rounded-xl group-hover:scale-105 transition-transform bg-slate-100"
                                onError={(e) => {
                                  e.currentTarget.onerror = null
                                  e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
                                }}
                              />
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {log.attachments?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase mb-2">Attachments</p>
                      <div className="flex flex-wrap gap-2">
                        {log.attachments.map((att, i) => {
                          const attUrl = att ? mediaUrl(normalizeUploadPath(att) || att) : ''
                          const fileName = att?.split('/')?.pop() || `Attachment ${i + 1}`
                          return (
                            <a key={i} href={attUrl} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1.5 text-xs text-secondary hover:underline bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl border border-slate-200 font-medium">
                              <FiUpload size={12} /> {fileName}
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {log.blockers && (
                    <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                      <p className="text-xs font-bold text-red-700 mb-1">Blockers</p>
                      <p className="text-sm text-red-700">{log.blockers}</p>
                    </div>
                  )}

                  {log.approvalNote && (
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                      <p className="text-xs font-bold text-blue-700 mb-1">Reviewer Note</p>
                      <p className="text-sm text-blue-700">{log.approvalNote}</p>
                    </div>
                  )}

                  {log.comments?.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <p className="text-xs font-bold text-slate-500 uppercase">Comments</p>
                      {log.comments.map((c, i) => (
                        <div key={i} className="bg-slate-50 p-2.5 rounded-xl text-sm border border-slate-100">
                          <span className="font-bold text-slate-700 mr-2">{c.name}:</span>
                          <span className="text-slate-600">{c.comment}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {isAdmin && (
                    <div className="pt-2">
                      {commentTarget === log._id ? (
                        <div className="flex gap-2">
                          <input className="form-input flex-1 py-1.5 text-sm" placeholder="Add a comment..." autoFocus
                            value={commentText} onChange={e => setCommentText(e.target.value)} />
                          <button onClick={() => commentMut.mutate({ id: log._id, comment: commentText })} disabled={!commentText} className="btn-primary btn-sm">Send</button>
                          <button onClick={() => { setCommentTarget(null); setCommentText('') }} className="btn-ghost btn-sm"><FiX /></button>
                        </div>
                      ) : (
                        <button onClick={() => setCommentTarget(log._id)} className="text-xs text-secondary hover:underline flex items-center gap-1 font-medium">
                          <FiMessageSquare size={12} /> Add Comment
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}

          {logs.length === 0 && (
            <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
              <FiClock size={40} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium">No work logs found.</p>
            </div>
          )}
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {isAdmin && selectedLogs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-700 backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-sm font-bold text-slate-100">
                {selectedLogs.length} Work Log{selectedLogs.length > 1 ? 's' : ''} Selected
              </span>
            </div>
            <div className="h-5 w-px bg-slate-700" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBulkAction('approved')
                  setBulkModal(true)
                }}
                disabled={bulkApproveMut.isPending}
                className="btn-primary btn-sm bg-emerald-600 hover:bg-emerald-500 border-none text-white font-bold gap-1.5 px-3.5 py-1.5 shadow-lg shadow-emerald-900/30"
              >
                <FiCheckCircle size={15} /> Approve All ({selectedLogs.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setBulkAction('rejected')
                  setBulkModal(true)
                }}
                disabled={bulkApproveMut.isPending}
                className="btn-danger btn-sm bg-rose-600 hover:bg-rose-500 text-white font-bold gap-1.5 px-3 py-1.5 shadow-lg shadow-rose-900/30"
              >
                <FiAlertCircle size={15} /> Reject All
              </button>
              <button
                type="button"
                onClick={() => setSelectedLogs([])}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                title="Clear Selection"
              >
                <FiX size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Approve/Reject Modal */}
      <AnimatePresence>
        {bulkModal && (
          <div className="fixed inset-0 bg-black/60 z-[100000] flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 border border-slate-100"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${bulkAction === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {bulkAction === 'approved' ? <FiCheckCircle size={18} /> : <FiAlertCircle size={18} />}
                  </div>
                  <h2 className="font-bold text-slate-800 text-base">
                    Bulk {bulkAction === 'approved' ? 'Approve' : 'Reject'} Work Logs
                  </h2>
                </div>
                <button type="button" onClick={() => { setBulkModal(false); setBulkNote('') }} className="text-slate-400 hover:text-slate-600 p-1">
                  <FiX size={18} />
                </button>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                You are about to <span className={`font-bold ${bulkAction === 'approved' ? 'text-emerald-700' : 'text-rose-700'}`}>{bulkAction}</span>{' '}
                <span className="font-bold text-slate-800">{selectedLogs.length}</span> selected daily work log{selectedLogs.length > 1 ? 's' : ''}.
              </p>

              <div>
                <label className="form-label text-xs font-semibold text-slate-600">Reviewer Feedback Note (Optional)</label>
                <textarea
                  className="form-input w-full text-sm"
                  rows="3"
                  placeholder="e.g. Great work, tasks verified."
                  value={bulkNote}
                  onChange={e => setBulkNote(e.target.value)}
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    bulkApproveMut.mutate({
                      logIds: selectedLogs,
                      approvalStatus: bulkAction,
                      approvalNote: bulkNote
                    })
                  }
                  disabled={bulkApproveMut.isPending}
                  className={`flex-1 btn-primary justify-center gap-2 font-bold py-2 ${
                    bulkAction === 'approved'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  {bulkApproveMut.isPending ? 'Processing...' : `Confirm ${bulkAction === 'approved' ? 'Approve' : 'Reject'} (${selectedLogs.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => { setBulkModal(false); setBulkNote('') }}
                  className="btn-ghost px-4"
                  disabled={bulkApproveMut.isPending}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Individual Approve/Reject Modal */}
      <AnimatePresence>
        {approveTarget && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
              <h2 className="font-bold text-primary text-lg">Review Work Log</h2>
              <textarea className="form-input w-full" rows="3" placeholder="Optional feedback note..."
                value={approvalNote} onChange={e => setApprovalNote(e.target.value)} />
              <div className="flex gap-3">
                <button onClick={() => approveMut.mutate({ id: approveTarget, approvalStatus: 'approved', approvalNote })}
                  disabled={approveMut.isPending}
                  className="flex-1 btn-primary justify-center gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <FiCheckCircle size={16} /> Approve
                </button>
                <button onClick={() => approveMut.mutate({ id: approveTarget, approvalStatus: 'rejected', approvalNote })}
                  disabled={approveMut.isPending}
                  className="flex-1 btn-danger justify-center gap-2">
                  <FiAlertCircle size={16} /> Reject
                </button>
                <button onClick={() => { setApproveTarget(null); setApprovalNote('') }} className="btn-ghost px-3"><FiX /></button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Submit Modal */}
      <AnimatePresence>
        {showSubmit && (
          <div className="fixed inset-0 bg-black/50 z-[99999] flex items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="modal-sheet bg-white rounded-none sm:rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[100dvh] sm:max-h-[90vh] overflow-hidden">
              <div className="modal-sheet-header shrink-0 px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
                <h2 className="font-bold text-primary text-lg">Submit Daily Work Log</h2>
                <button type="button" onClick={() => setShowSubmit(false)} className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-slate-100 rounded-xl"><FiX size={18} /></button>
              </div>
              <div className="modal-sheet-body flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-5">
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                     <label className="form-label mb-0">Tasks Completed</label>
                    <button onClick={addTask} className="text-xs text-secondary font-bold hover:underline flex items-center gap-1"><FiPlus size={12} /> Add Task</button>
                  </div>
                  {tasks.map((t, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative">
                      {tasks.length > 1 && (
                        <button onClick={() => removeTask(idx)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><FiX size={14} /></button>
                      )}
                      <input className="form-input text-sm py-1.5" placeholder="Task description" value={t.taskName} onChange={e => updateTask(idx, 'taskName', e.target.value)} />
                      <div className="flex gap-2">
                        <input type="number" min="0" step="0.5" className="form-input text-sm py-1.5 w-24" placeholder="Hours" value={t.hours} onChange={e => updateTask(idx, 'hours', e.target.value)} />
                        <select className="form-select text-sm py-1.5 flex-1" value={t.project} onChange={e => updateTask(idx, 'project', e.target.value)}>
                          <option value="">No Project</option>
                          {projects.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Project Links */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="form-label mb-0">Project Links (Figma, GitHub, etc.)</label>
                    <button onClick={addLink} className="text-xs text-secondary font-bold hover:underline flex items-center gap-1"><FiPlus size={12} /> Add Link</button>
                  </div>
                  {projectLinks.map((l, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input className="form-input text-sm py-1.5 flex-1" placeholder="https://..." value={l.url} onChange={e => updateLink(i, 'url', e.target.value)} />
                      <input className="form-input text-sm py-1.5 w-32" placeholder="Label" value={l.label} onChange={e => updateLink(i, 'label', e.target.value)} />
                    </div>
                  ))}
                </div>

                {/* Screenshots */}
                <div>
                  <label className="form-label">Screenshots (up to 5)</label>
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-secondary transition-colors cursor-pointer"
                    onClick={() => document.getElementById('ss-input').click()}>
                    <FiImage size={24} className="mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-500">Click to upload screenshots</p>
                    <input id="ss-input" type="file" multiple accept="image/*" className="hidden"
                      onChange={e => setScreenshots(Array.from(e.target.files).slice(0, 5))} />
                  </div>
                  {screenshots.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">{screenshots.length} file(s) selected</p>
                  )}
                </div>

                {/* Attachments */}
                <div>
                  <label className="form-label">Attachments (up to 3)</label>
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 flex items-center gap-3 hover:border-secondary transition-colors cursor-pointer"
                    onClick={() => document.getElementById('att-input').click()}>
                    <FiUpload size={20} className="text-slate-400" />
                    <p className="text-sm text-slate-500">Upload files (PDF, DOC, ZIP)</p>
                    <input id="att-input" type="file" multiple className="hidden"
                      onChange={e => setAttachments(Array.from(e.target.files).slice(0, 3))} />
                  </div>
                  {attachments.length > 0 && <p className="text-xs text-slate-500 mt-1">{attachments.length} file(s) selected</p>}
                </div>

                <div>
                  <label className="form-label">Blockers / Issues</label>
                  <textarea className="form-input" rows="2" placeholder="Any blockers preventing progress?" value={blockers} onChange={e => setBlockers(e.target.value)} />
                </div>

                <div>
                  <label className="form-label">Additional Notes</label>
                  <textarea className="form-input" rows="2" placeholder="Any other notes..." value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>
              <div className="modal-sheet-footer shrink-0 px-5 py-4 border-t border-slate-200 bg-white safe-area-bottom">
                <button
                  type="button"
                  onClick={() => submitMut.mutate({ date, tasks, blockers, notes, projectLinks })}
                  disabled={!canSubmit || submitMut.isPending}
                  className="btn-primary w-full justify-center min-h-[48px] text-base">
                  {submitMut.isPending ? <span className="spinner" /> : 'Submit Work Log'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
