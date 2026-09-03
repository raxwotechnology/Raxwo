import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import api from '../../lib/api'
import { assignableEmployeesUrl } from '../../lib/employeeApi'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiEdit2, FiUsers, FiDollarSign, FiClock, FiFileText, FiLink, FiMessageSquare, FiUpload, FiX, FiCheckCircle, FiAlertTriangle, FiTrash2, FiExternalLink, FiPrinter, FiPlus, FiSearch, FiUserCheck, FiUserPlus, FiCheckSquare } from 'react-icons/fi'
import { mediaUrl } from '../../lib/media'
import useAuthStore from '../../store/authStore'
import { isInvoiceFullyPaid, invoicePaymentDisplay } from '../../lib/invoicePayment'

const statusColor = { planning:'badge-gray', active:'badge-green', on_hold:'badge-yellow', completed:'badge-blue', paid_completed:'badge-green', cancelled:'badge-red', overdue:'badge-red' }

/** Match other admin modals (Invoices, Agreements); must clear shell header z-[220]. */
const MODAL_OVERLAY_Z = 999999

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('Overview')
  
  // Modals state
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [showDocModal, setShowDocModal] = useState(false)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [teamSearch, setTeamSearch] = useState('')
  const [selectedEmployees, setSelectedEmployees] = useState([])
  const [editingNote, setEditingNote] = useState(null)

  // Separate forms so Note + Link modals never cross-validate (shared useForm = silent submit failures).
  const noteForm = useForm({ defaultValues: { content: '' }, shouldUnregister: true })
  const linkForm = useForm({ defaultValues: { label: '', url: '' }, shouldUnregister: true })
  const user = useAuthStore((s) => s.user)
  const canManageNotes = ['admin', 'manager'].includes(user?.role)

  const patchProjectCache = (json) => {
    if (json?.project) qc.setQueryData(['project', id], { success: true, project: json.project })
  }

  const { data, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get(`/projects/${id}`).then(r => r.data),
  })

  // Employees for Team Member Assignment
  const { data: empListData } = useQuery({
    queryKey: ['assignable-employees-project-detail'],
    queryFn: () => api.get(assignableEmployeesUrl({ includeFormer: 'false' })).then(r => r.data),
    enabled: showTeamModal
  })
  const availableEmployees = empListData?.employees || []

  // Agreements linked to this project
  const { data: agreementData } = useQuery({
    queryKey: ['agreements', 'project', id],
    queryFn: () => api.get(`/agreements?project=${id}`).then(r => r.data),
  })

  const p = data?.project
  const agreements = agreementData?.agreements || []

  // 1-Click Complete / Progress Mutation
  const completeMut = useMutation({
    mutationFn: ({ status, progress }) =>
      api.put(`/projects/${id}`, {
        status,
        progress,
        ...(status === 'completed' ? { completedDate: new Date() } : {})
      }).then(r => r.data),
    onSuccess: (json) => {
      patchProjectCache(json)
      qc.invalidateQueries({ queryKey: ['project', id] })
      qc.invalidateQueries({ queryKey: ['admin-projects'] })
      qc.invalidateQueries({ queryKey: ['developer-projects'] })
      toast.success(json?.project?.status === 'completed' ? 'Project marked as 100% Completed! 🎉' : 'Project status updated')
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update status')
  })

  // Team Member Assignment Mutation
  const updateTeamMut = useMutation({
    mutationFn: (assignedEmployees) =>
      api.put(`/projects/${id}`, { assignedEmployees }).then(r => r.data),
    onSuccess: (json) => {
      patchProjectCache(json)
      qc.invalidateQueries({ queryKey: ['project', id] })
      qc.invalidateQueries({ queryKey: ['admin-projects'] })
      qc.invalidateQueries({ queryKey: ['developer-projects'] })
      toast.success('Project team members updated successfully!')
      setShowTeamModal(false)
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update team members')
  })

  // Quick Remove single team member
  const removeTeamMember = (empId) => {
    const current = (p.assignedEmployees || []).map(u => u._id || u)
    const next = current.filter(x => String(x) !== String(empId))
    updateTeamMut.mutate(next)
  }

  // Mutations
  const addNoteMut = useMutation({
    mutationFn: d => api.post(`/projects/${id}/notes`, d).then((r) => r.data),
    onSuccess: (json) => {
      patchProjectCache(json)
      qc.invalidateQueries({ queryKey: ['project', id] })
      qc.invalidateQueries({ queryKey: ['agreements', 'project', id] })
      toast.success('Note added')
      setShowNoteModal(false)
      noteForm.reset({ content: '' })
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed')
  })

  const updateNoteMut = useMutation({
    mutationFn: ({ noteId, content }) => api.put(`/projects/${id}/notes/${noteId}`, { content }).then((r) => r.data),
    onSuccess: (json) => {
      patchProjectCache(json)
      qc.invalidateQueries({ queryKey: ['project', id] })
      toast.success('Note updated')
      setEditingNote(null)
      noteForm.reset({ content: '' })
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed')
  })

  const deleteNoteMut = useMutation({
    mutationFn: noteId => api.delete(`/projects/${id}/notes/${noteId}`).then((r) => r.data),
    onSuccess: (json) => {
      patchProjectCache(json)
      qc.invalidateQueries({ queryKey: ['project', id] })
      toast.success('Note removed')
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed')
  })

  const addLinkMut = useMutation({
    mutationFn: d => api.post(`/projects/${id}/links`, d).then((r) => r.data),
    onSuccess: (json) => {
      patchProjectCache(json)
      qc.invalidateQueries({ queryKey: ['project', id] })
      toast.success('Link added')
      setShowLinkModal(false)
      linkForm.reset({ label: '', url: '' })
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed')
  })

  const removeLinkMut = useMutation({
    mutationFn: linkId => api.delete(`/projects/${id}/links/${linkId}`).then((r) => r.data),
    onSuccess: (json) => {
      patchProjectCache(json)
      qc.invalidateQueries({ queryKey: ['project', id] })
      toast.success('Link removed')
    }
  })

  const uploadDocMut = useMutation({
    mutationFn: fd => api.post(`/projects/${id}/documents`, fd).then((r) => r.data),
    onSuccess: (json) => {
      patchProjectCache(json)
      qc.invalidateQueries({ queryKey: ['project', id] })
      toast.success('Document uploaded')
      setShowDocModal(false)
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed')
  })

  const removeDocMut = useMutation({
    mutationFn: docId => api.delete(`/projects/${id}/documents/${docId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', id] }); toast.success('Document removed') }
  })

  if (isLoading) return <div className="text-center py-20"><div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto"/></div>
  if (!p) return <div className="text-center py-20 text-gray-500">Project not found</div>

  const isOverdue = p.status === 'overdue'
  const isCompleted = ['completed', 'paid_completed'].includes(p.status)
  const linkedInvUi = p.invoice ? invoicePaymentDisplay(p.invoice) : null
  const invRb = p.invoice?.remainingBalance
  const hasInvRb = typeof invRb === 'number'
  /** Outstanding amount due when we know balance; otherwise infer from paid status only */
  const invOutstanding = Boolean(p.invoice && (hasInvRb ? invRb > 0 : !isInvoiceFullyPaid(p.invoice)))

  const onDocSubmit = e => {
    e.preventDefault()
    const file = e.target.file.files[0]
    if (!file) return toast.error('Please select a file')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', e.target.name.value || file.name)
    uploadDocMut.mutate(fd)
  }

  const openTeamAssignModal = () => {
    const current = (p.assignedEmployees || []).map(u => u._id || u)
    setSelectedEmployees(current)
    setTeamSearch('')
    setShowTeamModal(true)
  }

  const toggleSelectEmployee = (empUserId) => {
    setSelectedEmployees(prev =>
      prev.includes(empUserId) ? prev.filter(x => x !== empUserId) : [...prev, empUserId]
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><FiArrowLeft size={20}/></button>
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold font-heading text-slate-800">{p.title}</h1>
              <span className={`badge capitalize ${statusColor[p.status] || 'badge-gray'}`}>{p.status?.replace('_',' ')}</span>
              {p.serviceType && <span className="badge badge-navy">{p.serviceType}</span>}
            </div>
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <FiClock size={12}/> Created {new Date(p.createdAt).toLocaleDateString()}
              {p.branch && <span>• Branch: {p.branch.name}</span>}
            </p>
          </div>
        </div>

        {/* Header Action Buttons: 1-Click Complete & Team Management */}
        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
          <button
            type="button"
            onClick={openTeamAssignModal}
            className="btn-outline btn-sm border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold gap-2 px-3.5 py-2 rounded-xl shadow-xs"
          >
            <FiUsers size={16} /> Manage Team ({p.assignedEmployees?.length || 0})
          </button>

          {!isCompleted ? (
            <button
              type="button"
              onClick={() => completeMut.mutate({ status: 'completed', progress: 100 })}
              disabled={completeMut.isPending}
              className="btn-primary btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 px-4 py-2 rounded-xl shadow-sm"
            >
              <FiCheckCircle size={16} /> {completeMut.isPending ? 'Completing...' : 'Mark 100% Completed'}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="badge badge-green font-bold text-xs px-3 py-1.5 flex items-center gap-1.5">
                <FiCheckCircle size={14}/> 100% Completed
              </span>
              <button
                type="button"
                onClick={() => completeMut.mutate({ status: 'active', progress: 90 })}
                disabled={completeMut.isPending}
                className="btn-outline btn-sm text-xs text-blue-600 border-blue-200 hover:bg-blue-50 py-1"
                title="Reopen project to in-progress"
              >
                Reopen
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto hide-scrollbar">
        {['Overview', 'Team & Allocations', 'Financial', 'Documents & Links', 'Notes & Agreements'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-5 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${activeTab === t ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {activeTab === 'Overview' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="card p-6">
                <h3 className="font-bold text-slate-800 mb-4 font-heading">Project Summary</h3>
                <div className="prose prose-sm max-w-none text-slate-600 mb-6 whitespace-pre-wrap">{p.description}</div>
                
                <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t">
                  <div><p className="text-xs text-slate-400 mb-1">Client</p><p className="font-medium text-slate-800">{p.client?.name || 'Internal'}</p><p className="text-xs text-slate-500">{p.client?.email}</p></div>
                  <div><p className="text-xs text-slate-400 mb-1">Project Manager</p><p className="font-medium text-slate-800">{p.projectManager?.name || 'Not assigned'}</p></div>
                  <div><p className="text-xs text-slate-400 mb-1">Start Date</p><p className="font-medium text-slate-800">{p.startDate ? new Date(p.startDate).toLocaleDateString('en-LK') : '—'}</p></div>
                  <div><p className="text-xs text-slate-400 mb-1">Deadline</p><p className={`font-medium ${isOverdue ? 'text-red-600 font-bold' : 'text-slate-800'}`}>{p.deadline ? new Date(p.deadline).toLocaleDateString('en-LK') : '—'}</p></div>
                </div>
              </div>

              {/* Assigned Team Members Card */}
              <div className="card p-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 font-heading">Assigned Team Members</h3>
                    <span className="badge badge-navy text-xs">{p.assignedEmployees?.length || 0}</span>
                  </div>
                  <button
                    type="button"
                    onClick={openTeamAssignModal}
                    className="text-xs font-bold text-secondary hover:underline flex items-center gap-1"
                  >
                    <FiUserPlus size={13} /> Assign Members
                  </button>
                </div>

                {(!p.assignedEmployees || p.assignedEmployees.length === 0) ? (
                  <div className="p-6 bg-slate-50 border border-dashed rounded-xl text-center space-y-2">
                    <p className="text-xs text-slate-400">No team members currently assigned to this project.</p>
                    <button
                      type="button"
                      onClick={openTeamAssignModal}
                      className="btn-outline btn-sm text-xs border-secondary text-secondary mx-auto"
                    >
                      <FiPlus size={12} /> Assign Team Members
                    </button>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {p.assignedEmployees.map((emp) => {
                      const empId = emp._id || emp
                      const avatarUrl = emp.avatar ? mediaUrl(emp.avatar) : null
                      return (
                        <div key={empId} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all">
                          <div className="flex items-center gap-3 min-w-0">
                            {avatarUrl ? (
                              <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center font-bold text-xs shrink-0">
                                {emp.name ? emp.name.charAt(0).toUpperCase() : <FiUsers size={14} />}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-800 truncate">{emp.name || 'Team Member'}</p>
                              <p className="text-xs text-slate-400 truncate">{emp.email || 'Assigned'}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeTeamMember(empId)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                            title="Remove from project"
                          >
                            <FiX size={14} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Quick Tasks preview */}
              <div className="card p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800 font-heading">Tasks Progress</h3>
                  <span className="text-sm font-medium text-secondary">{p.progress}% Complete</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4"><div className="h-full bg-secondary transition-all" style={{width: `${p.progress}%`}}/></div>
                <div className="space-y-2">
                  {p.tasks?.slice(0, 3).map(t => (
                    <div key={t._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-sm border border-slate-100">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={t.status === 'done'} readOnly className="accent-secondary w-4 h-4 rounded"/>
                        <span className={t.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}>{t.title}</span>
                      </div>
                      <span className="text-xs text-slate-500">{t.assignedTo?.name || 'Unassigned'}</span>
                    </div>
                  ))}
                  {(!p.tasks || p.tasks.length === 0) && <p className="text-center text-sm text-slate-400 py-2">No tasks defined</p>}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Financial Snapshot */}
              <div className="card p-6">
                <h3 className="font-bold text-slate-800 mb-4 font-heading flex items-center gap-2"><FiDollarSign className="text-emerald-500"/> Financials</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100">
                    <p className="text-xs uppercase tracking-wider font-semibold opacity-70 mb-1">Project Budget</p>
                    <p className="text-xl font-bold">LKR {p.budget?.toLocaleString()}</p>
                  </div>
                  {p.invoice && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Linked invoice</p>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => navigate('/admin/invoices', { state: { openInvoiceId: p.invoice._id } })}
                          className="font-mono text-sm font-bold text-secondary hover:underline text-left"
                        >
                          {p.invoice.invoiceNo}
                        </button>
                        <div className="flex items-center gap-2">
                          <span className={`badge ${linkedInvUi?.badgeClass || 'badge-gray'}`}>
                            {linkedInvUi?.label || '—'}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${linkedInvUi?.settled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                            {linkedInvUi?.settled ? 'Settled' : 'Balance due'}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm flex justify-between text-slate-600">
                        <span>Balance ({p.invoice.currency || 'LKR'})</span>
                        <span className="font-semibold text-slate-900">
                          {hasInvRb ? invRb.toLocaleString() : isInvoiceFullyPaid(p.invoice) ? '0' : '—'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">Click the invoice number to open it in Invoices.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Team & Allocations' && (
          <div className="space-y-6">
            {/* Assigned Members Quick Box */}
            <div className="card p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-bold text-slate-800 font-heading">Assigned Team Members</h3>
                  <p className="text-xs text-slate-500">Employees working on this project.</p>
                </div>
                <button
                  type="button"
                  onClick={openTeamAssignModal}
                  className="btn-primary btn-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5"
                >
                  <FiUserPlus size={14} /> Assign / Edit Team Members
                </button>
              </div>

              {(!p.assignedEmployees || p.assignedEmployees.length === 0) ? (
                <div className="p-6 bg-slate-50 border border-dashed rounded-xl text-center">
                  <p className="text-xs text-slate-400 mb-2">No team members assigned.</p>
                  <button type="button" onClick={openTeamAssignModal} className="btn-outline btn-sm text-xs">
                    Assign Members
                  </button>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {p.assignedEmployees.map((emp) => {
                    const empId = emp._id || emp
                    const avatarUrl = emp.avatar ? mediaUrl(emp.avatar) : null
                    return (
                      <div key={empId} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                        <div className="flex items-center gap-3 min-w-0">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                              {emp.name ? emp.name.charAt(0).toUpperCase() : <FiUsers size={13} />}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{emp.name || 'Member'}</p>
                            <p className="text-[11px] text-slate-500 truncate">{emp.email || ''}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTeamMember(empId)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-red-50"
                          title="Remove"
                        >
                          <FiX size={13} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Commissions & Salary Allocations */}
            <div className="card p-0 overflow-hidden">
              <div className="p-6 border-b">
                <h3 className="font-bold text-slate-800 font-heading">Team & Commissions</h3>
                <p className="text-sm text-slate-500 mt-1">Project Budget: <strong className="text-slate-800">LKR {p.budget?.toLocaleString()}</strong></p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b text-slate-600">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Team Member</th>
                      <th className="px-6 py-3 font-semibold text-right">Commission (LKR)</th>
                      <th className="px-6 py-3 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {p.salaryAllocations?.length === 0 ? (
                      <tr><td colSpan={3} className="p-8 text-center text-slate-400">No team commissions defined for this project.</td></tr>
                    ) : (
                      p.salaryAllocations?.map((alloc, i) => {
                        const isResigned = alloc.employee?.status === 'resigned' || alloc.employee?.status === 'former' || alloc.employee?.userId?.status === 'resigned'
                        const name = alloc.employeeName || alloc.employee?.userId?.name || alloc.employee?.name || 'Team Member'
                        return (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-slate-800">{name}</p>
                                {isResigned && (
                                  <span className="badge badge-red text-[11px] font-semibold">Resigned</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right font-medium text-purple-700">{(alloc.commission || 0).toLocaleString()}</td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                {isResigned && <span className="badge badge-red">Resigned</span>}
                                {!p.invoice ? (
                                  <span className="badge badge-gray">No invoice</span>
                                ) : isInvoiceFullyPaid(p.invoice) ? (
                                  <span className="badge badge-green">Paid</span>
                                ) : (
                                  <span className="badge badge-yellow">Unpaid</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
                {p.salaryAllocations?.length > 0 && (
                  <div className="bg-slate-50 px-6 py-4 border-t flex justify-end font-medium text-sm">
                    <div className="text-right">
                      <p className="text-slate-500 text-xs mb-0.5">Total Commission</p>
                      <p className="text-purple-800">LKR {p.salaryAllocations.reduce((s,a)=>s+(a.commission||0),0).toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Financial' && (
          <div className="space-y-6">
            {!p.invoice ? (
              <div className="card p-12 text-center border-dashed">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-500"><FiDollarSign size={24}/></div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">No Invoice Linked</h3>
                <p className="text-slate-500 max-w-md mx-auto mb-6">This project does not have a linked invoice. Link an invoice to track advances and payments.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="card p-5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Invoice Total</p>
                    <p className="text-2xl font-bold text-slate-800">LKR {p.invoice.total?.toLocaleString()}</p>
                  </div>
                  <div className="card p-5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Advances & Payments</p>
                    <p className="text-2xl font-bold text-green-600">LKR {p.invoice.totalPaid?.toLocaleString()}</p>
                  </div>
                  <div className={`card p-5 ${invOutstanding ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${invOutstanding ? 'text-orange-500' : 'text-green-600'}`}>Remaining Balance</p>
                    <p className={`text-2xl font-bold ${invOutstanding ? 'text-orange-700' : 'text-green-700'}`}>
                      LKR {hasInvRb ? invRb.toLocaleString() : isInvoiceFullyPaid(p.invoice) ? '0' : '—'}
                    </p>
                  </div>
                </div>

                <div className="card p-0 overflow-hidden">
                  <div className="p-4 border-b bg-slate-50 font-semibold text-slate-800 flex justify-between items-center">
                    <span>Payment History (Invoice: {p.invoice.invoiceNo})</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50/50 border-b text-slate-600">
                        <tr>
                          <th className="px-4 py-2 font-semibold">Date</th>
                          <th className="px-4 py-2 font-semibold">Payment Method</th>
                          <th className="px-4 py-2 font-semibold text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {p.invoice.payments?.length === 0 ? (
                          <tr><td colSpan={3} className="p-6 text-center text-slate-400">No payments recorded for this invoice yet.</td></tr>
                        ) : (
                          p.invoice.payments?.map((pmt, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-4 py-3">{new Date(pmt.date).toLocaleDateString()}</td>
                              <td className="px-4 py-3 capitalize">{pmt.method?.replace('_',' ')}</td>
                              <td className="px-4 py-3 text-right font-medium text-green-600">LKR {pmt.amount?.toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'Documents & Links' && (
          <div className="space-y-6">
            {/* Links */}
            <div className="card p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 font-heading flex items-center gap-2"><FiLink/> Project Links</h3>
                <button type="button" onClick={() => { linkForm.reset({ label: '', url: '' }); setShowLinkModal(true) }} className="btn-outline btn-sm"><FiPlus/> Add Link</button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {p.links?.length === 0 ? (
                  <p className="text-slate-400 text-sm col-span-2 py-4 text-center">No links added to this project.</p>
                ) : p.links?.map(l => (
                  <div key={l._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <a href={l.url.startsWith('http') ? l.url : `https://${l.url}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-secondary font-medium text-sm hover:underline truncate">
                      <FiExternalLink className="shrink-0"/> <span className="truncate">{l.label}</span>
                    </a>
                    <button type="button" onClick={() => removeLinkMut.mutate(l._id)} className="text-slate-400 hover:text-red-500 p-1"><FiTrash2 size={13}/></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Documents */}
            <div className="card p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 font-heading flex items-center gap-2"><FiFileText/> Project Documents</h3>
                <button type="button" onClick={() => setShowDocModal(true)} className="btn-outline btn-sm"><FiUpload/> Upload Document</button>
              </div>
              <div className="space-y-2">
                {p.documents?.length === 0 ? (
                  <p className="text-slate-400 text-sm py-4 text-center">No documents uploaded for this project.</p>
                ) : p.documents?.map(d => (
                  <div key={d._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs"><FiFileText/></div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{d.name}</p>
                        <p className="text-[10px] text-slate-400">{new Date(d.uploadedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={mediaUrl(d.url)} target="_blank" rel="noreferrer" download className="btn-outline btn-sm text-xs py-1 px-2">Download</a>
                      <button type="button" onClick={() => removeDocMut.mutate(d._id)} className="text-slate-400 hover:text-red-500 p-1"><FiTrash2 size={13}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Notes & Agreements' && (
          <div className="space-y-6">
            {/* Notes */}
            <div className="card p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 font-heading flex items-center gap-2"><FiMessageSquare/> Project Notes</h3>
                <button type="button" onClick={() => { setEditingNote(null); noteForm.reset({ content: '' }); setShowNoteModal(true) }} className="btn-outline btn-sm"><FiPlus/> Add Note</button>
              </div>
              <div className="space-y-3">
                {p.notes?.length === 0 ? (
                  <p className="text-slate-400 text-sm py-4 text-center">No notes recorded yet.</p>
                ) : p.notes?.map(n => (
                  <div key={n._id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>By <strong>{n.createdBy?.name || 'Unknown'}</strong> on {new Date(n.createdAt).toLocaleDateString()}</span>
                      {canManageNotes && (
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => { setEditingNote(n); noteForm.reset({ content: n.content || '' }); setShowNoteModal(true) }} className="hover:text-secondary p-1"><FiEdit2 size={12}/></button>
                          <button type="button" onClick={() => deleteNoteMut.mutate(n._id)} className="hover:text-red-500 p-1"><FiTrash2 size={12}/></button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{n.content}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Agreements */}
            <div className="card p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 font-heading flex items-center gap-2"><FiFileText/> Client Agreements</h3>
                <button type="button" onClick={() => navigate(`/admin/agreements?project=${p._id}`)} className="btn-outline btn-sm">Manage Agreements</button>
              </div>
              <div className="space-y-3">
                {agreements.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed">
                    <p className="text-sm text-slate-500 mb-3">No agreements generated for this project.</p>
                    <button type="button" onClick={() => navigate(`/admin/agreements?new=true&project=${p._id}&client=${p.client?._id}`)} className="btn-primary btn-sm mx-auto">Generate Agreement</button>
                  </div>
                ) : agreements.map(agr => (
                  <div key={agr._id} className="flex items-center justify-between gap-3 p-3 bg-white rounded-xl border shadow-sm hover:shadow transition-all">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{agr.title}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{agr.agreementNo} • {new Date(agr.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`badge ${agr.status === 'signed' ? 'badge-green' : agr.status === 'draft' ? 'badge-gray' : 'badge-blue'}`}>{agr.status}</span>
                      <button
                        type="button"
                        className="btn-outline btn-sm py-1 px-2 text-xs"
                        onClick={() => navigate(`/admin/agreements?agreement=${agr._id}`)}
                      >Open</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {/* 1. Team Member Assignment Modal */}
      {showTeamModal && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs" style={{ zIndex: MODAL_OVERLAY_Z }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh] border border-slate-200">
            <div className="p-4 sm:p-5 border-b flex justify-between items-center bg-slate-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <FiUsers size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Manage Project Team</h3>
                  <p className="text-xs text-slate-500">Select employees assigned to {p.title}</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowTeamModal(false)} className="p-1.5 hover:bg-slate-200 rounded-lg"><FiX size={18}/></button>
            </div>

            <div className="p-4 border-b bg-white shrink-0">
              <div className="relative">
                <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Search team members by name, role, department..."
                  value={teamSearch}
                  onChange={e => setTeamSearch(e.target.value)}
                  className="form-input pl-10 py-2 text-sm w-full"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-slate-100">
              {availableEmployees
                .filter(emp => {
                  if (!teamSearch) return true
                  const q = teamSearch.toLowerCase()
                  const name = (emp.userId?.name || emp.name || '').toLowerCase()
                  const role = (emp.designation || emp.role || emp.department || '').toLowerCase()
                  return name.includes(q) || role.includes(q)
                })
                .map(emp => {
                  const empUserId = emp.userId?._id || emp.userId || emp._id
                  const isChecked = selectedEmployees.some(id => String(id) === String(empUserId))
                  const avatarUrl = emp.userId?.avatar || emp.profilePhoto ? mediaUrl(emp.userId?.avatar || emp.profilePhoto) : null
                  const empName = emp.userId?.name || emp.name || 'Employee'
                  const empRole = emp.designation || emp.department || emp.role || 'Staff'

                  return (
                    <label
                      key={emp._id}
                      onClick={() => toggleSelectEmployee(empUserId)}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                        isChecked ? 'bg-indigo-50/70 border border-indigo-200 shadow-xs' : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-200" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {empName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{empName}</p>
                          <p className="text-xs text-slate-500 capitalize truncate">{empRole}</p>
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                        isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isChecked && <FiCheckCircle size={14} />}
                      </div>
                    </label>
                  )
                })}

              {availableEmployees.length === 0 && (
                <div className="py-12 text-center text-slate-400">
                  <FiUsers size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Loading company employees...</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-slate-600">
                {selectedEmployees.length} member{selectedEmployees.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowTeamModal(false)} className="btn-ghost btn-sm px-4">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => updateTeamMut.mutate(selectedEmployees)}
                  disabled={updateTeamMut.isPending}
                  className="btn-primary btn-sm bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5"
                >
                  {updateTeamMut.isPending ? 'Saving...' : 'Save Team Members'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* 2. Note Modal */}
      {showNoteModal && createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: MODAL_OVERLAY_Z }}>
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
              <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800">{editingNote ? 'Edit Project Note' : 'Add Project Note'}</h3>
                <button type="button" onClick={() => { setShowNoteModal(false); setEditingNote(null); noteForm.reset({ content: '' }) }} className="p-1 hover:bg-slate-200 rounded"><FiX/></button>
              </div>
              <form onSubmit={noteForm.handleSubmit(
                (d) => {
                  if (editingNote?._id) updateNoteMut.mutate({ noteId: editingNote._id, content: d.content })
                  else addNoteMut.mutate(d)
                },
                () => toast.error('Please enter note text')
              )} className="p-6">
                <textarea {...noteForm.register('content', { required: true })} rows={5} className="form-input resize-none mb-4" placeholder="Type your note here..."></textarea>
                <div className="flex gap-3">
                  <button type="button" onClick={() => { setShowNoteModal(false); setEditingNote(null); noteForm.reset({ content: '' }) }} className="btn-ghost flex-1">Cancel</button>
                  <button type="submit" disabled={addNoteMut.isPending || updateNoteMut.isPending} className="btn-primary flex-1 justify-center">{(addNoteMut.isPending || updateNoteMut.isPending) ? <span className="spinner"/> : (editingNote ? 'Save Changes' : 'Save Note')}</button>
                </div>
              </form>
            </motion.div>
          </div>, document.body
        )}

      {/* 3. Link Modal */}
      {showLinkModal && createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: MODAL_OVERLAY_Z }}>
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800">Add Important Link</h3>
                <button type="button" onClick={() => setShowLinkModal(false)} className="p-1 hover:bg-slate-200 rounded"><FiX/></button>
              </div>
              <form onSubmit={linkForm.handleSubmit(
                (d) => addLinkMut.mutate(d),
                () => toast.error('Please enter label and URL')
              )} className="p-6 space-y-4">
                <div><label className="form-label">Label</label><input {...linkForm.register('label', { required: true })} className="form-input" placeholder="e.g. GitHub Repo, Figma Design"/></div>
                <div><label className="form-label">URL</label><input {...linkForm.register('url', { required: true })} type="text" className="form-input" placeholder="https://example.com or example.com"/></div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowLinkModal(false)} className="btn-ghost flex-1">Cancel</button>
                  <button type="submit" disabled={addLinkMut.isPending} className="btn-primary flex-1 justify-center">{addLinkMut.isPending ? <span className="spinner"/> : 'Save Link'}</button>
                </div>
              </form>
            </motion.div>
          </div>, document.body
        )}

      {/* 4. Document Modal */}
      {showDocModal && createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: MODAL_OVERLAY_Z }}>
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800">Upload Document</h3>
                <button type="button" onClick={() => setShowDocModal(false)} className="p-1 hover:bg-slate-200 rounded"><FiX/></button>
              </div>
              <form onSubmit={onDocSubmit} className="p-6 space-y-4">
                <div><label className="form-label">Document Name (Optional)</label><input name="name" className="form-input" placeholder="Custom name for file"/></div>
                <div><label className="form-label">File *</label><input name="file" type="file" required className="form-input p-2"/></div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowDocModal(false)} className="btn-ghost flex-1">Cancel</button>
                  <button type="submit" disabled={uploadDocMut.isPending} className="btn-primary flex-1 justify-center">{uploadDocMut.isPending ? <span className="spinner"/> : 'Upload'}</button>
                </div>
              </form>
            </motion.div>
          </div>, document.body
        )}
    </div>
  )
}
