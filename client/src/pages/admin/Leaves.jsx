import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import { assignableEmployeesUrl } from '../../lib/employeeApi'
import toast from 'react-hot-toast'
import ExportBar from '../../components/ui/ExportBar'
import { useDeleteWithPassword } from '../../components/admin/DeletePasswordGate'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { lookupLoaders } from '../../lib/lookupApi'
import { FiCheck, FiX, FiCalendar, FiPlus, FiEye, FiEdit2, FiTrash2, FiFilter } from 'react-icons/fi'

const TYPE_COLORS = {
  annual:'badge-blue', sick:'badge-red', casual:'badge-yellow', medical:'badge-red',
  half_day:'badge-blue', short_leave:'badge-purple', no_pay:'badge-gray',
  maternity:'badge-purple', paternity:'badge-navy', unpaid:'badge-gray'
}
const STATUS_COLORS = { pending:'badge-yellow', approved:'badge-green', rejected:'badge-red' }

const fmt = d => d ? new Date(d).toLocaleDateString('en-LK', { day:'2-digit', month:'short', year:'numeric' }) : '—'

export default function AdminLeaves() {
  const qc = useQueryClient()
  const now = new Date()

  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]   = useState('')
  const [search, setSearch]   = useState('')

  // Modals
  const [showAssign, setShowAssign] = useState(false)
  const [viewLeave, setViewLeave]   = useState(null)
  const [editLeave, setEditLeave]   = useState(null)
  const [editForm, setEditForm]     = useState({})
  // Assign form
  const [selectedEmpId, setSelectedEmpId] = useState('')
  const [assignForm, setAssignForm] = useState({
    employeeId:'', leaveType:'annual', startDate:'', endDate:'', reason:'', remarks:'',
  })

  // Reset leave type when employee changes (pick first from policy)
  const handleEmployeeChange = (v) => {
    setSelectedEmpId(v)
    setAssignForm(s => ({ ...s, employeeId: v, leaveType: 'annual' }))
  }

  // Remarks/rejection inline state
  const [remarks, setRemarks] = useState({})
  const [rejectionReasons, setRejectionReasons] = useState({})

  // ── Data ─────────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['leaves', statusFilter, branchFilter, dateFrom, dateTo],
    queryFn: () => {
      const p = new URLSearchParams()
      if (statusFilter) p.set('status', statusFilter)
      if (branchFilter) p.set('branch', branchFilter)
      if (dateFrom) p.set('startDate', dateFrom)
      if (dateTo)   p.set('endDate', dateTo)
      return api.get(`/leaves?${p.toString()}`).then(r => r.data)
    },
  })

  const { data: branchData } = useQuery({ queryKey: ['branches-list'], queryFn: () => api.get('/branches').then(r => r.data) })
  const branches = branchData?.branches || []

  const { data: employeesData } = useQuery({
    queryKey: ['employees-mini'],
    queryFn: () => api.get(assignableEmployeesUrl()).then(r => r.data),
    enabled: showAssign,
  })
  const employees = employeesData?.employees || []

  const { data: balanceData, isFetching: balanceFetching } = useQuery({
    queryKey: ['leave-balance', selectedEmpId],
    queryFn: () => api.get(`/leaves/balance/${selectedEmpId}`).then(r => r.data),
    enabled: !!selectedEmpId,
  })
  const balances = balanceData?.balances || {}

  // Fetch resolved leave policy for selected employee
  const { data: policyData, isFetching: policyFetching } = useQuery({
    queryKey: ['employee-policy', selectedEmpId],
    queryFn: () => api.get(`/leaves/policy-for/${selectedEmpId}`).then(r => r.data),
    enabled: !!selectedEmpId,
  })
  const employeePolicy = policyData?.policy || null

  // Build leave type options from policy quotas (only types with quota > 0)
  // Falls back to the default full list if no policy
  const ALL_LEAVE_TYPES = ['annual','sick','casual','medical','half_day','short_leave','maternity','paternity','no_pay']
  const policyLeaveTypes = employeePolicy
    ? employeePolicy.quotas.filter(q => q.quota > 0).map(q => q.leaveType)
    : ALL_LEAVE_TYPES
  // Always include 'no_pay' as an option even if not in quota
  const assignableLeaveTypes = policyLeaveTypes.length > 0 ? policyLeaveTypes : ALL_LEAVE_TYPES

  const allLeaves = data?.leaves || []
  const leaves = useMemo(() => {
    if (!search) return allLeaves
    const s = search.toLowerCase()
    return allLeaves.filter(l =>
      (l.employee?.userId?.name || '').toLowerCase().includes(s) ||
      (l.employee?.employeeNo || '').toLowerCase().includes(s)
    )
  }, [allLeaves, search])

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const inv = () => qc.invalidateQueries(['leaves'])

  const updateMut = useMutation({
    mutationFn: ({ id, status, remarks, rejectedReason }) => api.put(`/leaves/${id}/status`, { status, remarks, rejectedReason }),
    onSuccess: (_, variables) => {
      inv()
      toast.success('Leave status updated')
      if (variables?.id) {
        setRemarks(r => { const next = { ...r }; delete next[variables.id]; return next })
        setRejectionReasons(r => { const next = { ...r }; delete next[variables.id]; return next })
      }
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })

  const editMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/leaves/${id}`, data),
    onSuccess: () => { inv(); toast.success('Leave updated'); setEditLeave(null) },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })

  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/leaves/${id}`),
    onSuccess: () => { inv(); toast.success('Deleted') },
    onError: e => toast.error(e.response?.data?.message || 'Delete failed'),
  })
  const { requestDelete: requestDeleteLeave, DeletePasswordModal: leaveDeleteModal } = useDeleteWithPassword(deleteMut, {
    title: 'Delete leave request',
    message: 'Enter your admin password to permanently delete this leave record.',
  })

  const assignMut = useMutation({
    mutationFn: payload => api.post('/leaves/assign', payload).then(r => r.data),
    onSuccess: () => {
      inv(); toast.success('Leave assigned'); setShowAssign(false)
      setSelectedEmpId(''); setAssignForm({ employeeId:'', leaveType:'annual', startDate:'', endDate:'', reason:'', remarks:'' })
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })

  const handleAction = (id, status) => {
    if (status === 'rejected' && !rejectionReasons[id]) { toast.error('Rejection reason required'); return }
    updateMut.mutate({ id, status, remarks: remarks[id] || '', rejectedReason: rejectionReasons[id] || '' })
  }

  const pendingCount = leaves.filter(l => l.status === 'pending').length

  const exportColumns = [
    { header: 'Employee', accessor: r => r.employee?.userId?.name || '—' },
    { header: 'Emp No', accessor: r => r.employee?.employeeNo || '—' },
    { header: 'Leave Type', accessor: r => r.leaveType?.replace('_', ' ') || '—' },
    { header: 'Status', accessor: r => r.status },
    { header: 'Start Date', accessor: r => fmt(r.startDate) },
    { header: 'End Date', accessor: r => fmt(r.endDate) },
    { header: 'Days', accessor: r => r.days },
    { header: 'Reason', accessor: r => r.reason || '—' },
    { header: 'Remarks', accessor: r => r.remarks || '—' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Leave Management</h1>
          <p className="page-subtitle">{pendingCount} pending · {leaves.length} total</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportBar 
            data={leaves} 
            columns={exportColumns} 
            title="Leave Report"
            filters={{ 
              Status: statusFilter || 'All', 
              Branch: branchFilter || 'All', 
              From: dateFrom || 'Any', 
              To: dateTo || 'Any' 
            }} 
          />
          <button onClick={() => setShowAssign(true)} className="btn-primary">
            <FiPlus size={16}/> Assign Leave
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label:'Pending', count: leaves.filter(l=>l.status==='pending').length, color:'bg-amber-50 border-amber-200 text-amber-700' },
          { label:'Approved', count: leaves.filter(l=>l.status==='approved').length, color:'bg-emerald-50 border-emerald-200 text-emerald-700' },
          { label:'Rejected', count: leaves.filter(l=>l.status==='rejected').length, color:'bg-red-50 border-red-200 text-red-700' },
        ].map(c => (
          <div key={c.label} className={`card border ${c.color} p-4 text-center`}>
            <p className="text-2xl font-bold font-heading">{c.count}</p>
            <p className="text-sm mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card card-body">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
          <div className="col-span-2 sm:col-span-1">
            <label className="form-label text-xs">Search</label>
            <input type="text" className="form-input py-2 text-sm" placeholder="Name or Emp No..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div>
            <label className="form-label text-xs">Branch</label>
            <select className="form-select py-2 text-sm" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
              <option value="">All Branches</option>
              {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label text-xs">Status</label>
            <select className="form-select py-2 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              {['pending','approved','rejected'].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label text-xs">From Date</label>
            <input type="date" className="form-input py-2 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="form-label text-xs">To Date</label>
            <input type="date" className="form-input py-2 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <button onClick={() => { setDateFrom(''); setDateTo(''); setSearch(''); setStatusFilter(''); setBranchFilter('') }}
            className="btn-ghost text-sm py-2 w-full justify-center lg:w-auto">
            <FiFilter size={14}/> Clear
          </button>
        </div>
      </div>

      {/* Leave List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin"/>
          </div>
        ) : leaves.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FiCalendar size={40} className="mx-auto mb-2 opacity-30"/>
            <p>No leave requests found</p>
          </div>
        ) : leaves.map(leave => (
          <motion.div key={leave._id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="card card-body">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              {/* Employee info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-bold flex-shrink-0">
                  {leave.employee?.userId?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{leave.employee?.userId?.name}</p>
                  <p className="text-xs text-gray-400">{leave.employee?.employeeNo} · {leave.employee?.department}</p>
                </div>
              </div>

              {/* Details */}
              <div className="flex flex-wrap gap-2 flex-1">
                <span className={`badge ${TYPE_COLORS[leave.leaveType]||'badge-gray'} capitalize`}>{leave.leaveType?.replace('_',' ')}</span>
                <span className="text-sm text-gray-600 flex items-center gap-1">
                  <FiCalendar size={12}/> {fmt(leave.startDate)} → {fmt(leave.endDate)}
                </span>
                <span className="badge badge-navy">{leave.days} day{leave.days>1?'s':''}</span>
                <span className={`badge ${STATUS_COLORS[leave.status]} capitalize`}>{leave.status}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => setViewLeave(leave)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="View">
                  <FiEye size={14}/>
                </button>
                {leave.status !== 'approved' && (
                  <button onClick={() => { setEditLeave(leave); setEditForm({ leaveType: leave.leaveType, startDate: leave.startDate?.slice(0,10), endDate: leave.endDate?.slice(0,10), reason: leave.reason || '' }) }}
                    className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg" title="Edit">
                    <FiEdit2 size={14}/>
                  </button>
                )}
                <button type="button" onClick={() => requestDeleteLeave(leave._id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
                  <FiTrash2 size={14}/>
                </button>
              </div>
            </div>

            {/* Reason */}
            <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-gray-500 space-y-0.5">
              <p><span className="font-medium">Reason:</span> {leave.reason || '—'}</p>
              <p><span className="font-medium">Leaves:</span> {leave.totalLeavesTaken || 0} taken / {leave.maxLeaves || 24} max · {leave.remainingLeaves || 0} remaining</p>
              {leave.remarks && <p><span className="font-medium">Remarks:</span> {leave.remarks}</p>}
            </div>

            {/* Approve / Reject inline (pending only) */}
            {leave.status === 'pending' && (
              <div className="mt-3 pt-3 border-t border-dashed border-gray-100 flex flex-col sm:flex-row gap-2">
                <input placeholder="Remarks (optional)" value={remarks[leave._id]||''} onChange={e=>setRemarks(r=>({...r,[leave._id]:e.target.value}))} className="form-input text-xs py-1.5 flex-1" />
                <input placeholder="Rejection reason (required to reject)" value={rejectionReasons[leave._id]||''} onChange={e=>setRejectionReasons(r=>({...r,[leave._id]:e.target.value}))} className="form-input text-xs py-1.5 flex-1 border-red-200" />
                <div className="flex gap-2">
                  <button onClick={()=>updateMut.mutate({id:leave._id,status:'approved',remarks:remarks[leave._id]||''})} className="btn-success btn-sm px-4">
                    <FiCheck size={13}/> Approve
                  </button>
                  <button onClick={()=>handleAction(leave._id,'rejected')} className="btn-danger btn-sm px-4">
                    <FiX size={13}/> Reject
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* View Modal */}
      {viewLeave && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[99999]">
          <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-primary font-heading">Leave Details</h3>
              <button onClick={() => setViewLeave(null)} className="p-2 hover:bg-gray-100 rounded-lg"><FiX size={16}/></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="w-11 h-11 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-bold text-lg">
                  {viewLeave.employee?.userId?.name?.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-800">{viewLeave.employee?.userId?.name}</p>
                  <p className="text-xs text-slate-500">{viewLeave.employee?.employeeNo} · {viewLeave.employee?.department}</p>
                </div>
              </div>
              {[
                ['Type', <span className={`badge ${TYPE_COLORS[viewLeave.leaveType]||'badge-gray'} capitalize`}>{viewLeave.leaveType?.replace('_',' ')}</span>],
                ['Status', <span className={`badge ${STATUS_COLORS[viewLeave.status]} capitalize`}>{viewLeave.status}</span>],
                ['Start Date', fmt(viewLeave.startDate)],
                ['End Date', fmt(viewLeave.endDate)],
                ['Days', viewLeave.days],
                ['Reason', viewLeave.reason || '—'],
                ['Remarks', viewLeave.remarks || '—'],
                ['Applied On', fmt(viewLeave.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-gray-50 text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium text-slate-800">{value}</span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t flex gap-2">
              <button onClick={() => setViewLeave(null)} className="btn-ghost flex-1 justify-center">Close</button>
            </div>
          </motion.div>
        </div>, document.body
      )}

      {/* Edit Modal */}
      {editLeave && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[99999]">
          <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-primary font-heading">Edit Leave</h3>
              <button onClick={() => setEditLeave(null)} className="p-2 hover:bg-gray-100 rounded-lg"><FiX size={16}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="form-label">Leave Type</label>
                <select className="form-select" value={editForm.leaveType} onChange={e => setEditForm(s=>({...s,leaveType:e.target.value}))}>
                  {['annual','sick','casual','medical','half_day','short_leave','maternity','paternity','no_pay'].map(t => (
                    <option key={t} value={t} className="capitalize">{t.replace('_',' ')}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Start Date</label>
                  <input type="date" className="form-input" value={editForm.startDate} onChange={e => setEditForm(s=>({...s,startDate:e.target.value}))} />
                </div>
                <div>
                  <label className="form-label">End Date</label>
                  <input type="date" className="form-input" value={editForm.endDate} onChange={e => setEditForm(s=>({...s,endDate:e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="form-label">Reason</label>
                <textarea rows={2} className="form-input resize-none" value={editForm.reason} onChange={e => setEditForm(s=>({...s,reason:e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t">
              <button onClick={() => setEditLeave(null)} className="btn-ghost flex-1 justify-center">Cancel</button>
              <button onClick={() => editMut.mutate({id: editLeave._id, data: editForm})} disabled={editMut.isPending} className="btn-primary flex-1 justify-center">
                {editMut.isPending ? <span className="spinner"/> : 'Save Changes'}
              </button>
            </div>
          </motion.div>
        </div>, document.body
      )}

      {leaveDeleteModal}

      {/* Assign Leave Modal */}
      {showAssign && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[99999]">
          <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b shrink-0">
              <h3 className="text-lg font-bold text-primary font-heading">Assign Leave</h3>
              <button onClick={() => setShowAssign(false)} className="p-2 hover:bg-gray-100 rounded-lg"><FiX/></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <div>
                <label className="form-label">Employee *</label>
                <SearchableSelect
                  value={assignForm.employeeId}
                  onChange={(v) => { handleEmployeeChange(v) }}
                  loadOptions={lookupLoaders.employeesAll()}
                  placeholder="Search employee…"
                />
              </div>

              {/* Policy badge */}
              {selectedEmpId && (
                <div className="flex items-center gap-2 py-1">
                  {policyFetching ? (
                    <span className="text-xs text-slate-400 animate-pulse">Detecting policy…</span>
                  ) : employeePolicy ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        🛡️ {employeePolicy.name}
                        {employeePolicy.isDefault && <span className="opacity-60">(Default)</span>}
                      </span>
                      {employeePolicy.employmentType && employeePolicy.employmentType !== 'all' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 capitalize">
                          {employeePolicy.employmentType}
                        </span>
                      )}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500 capitalize">
                        {(employeePolicy.duration || 'yearly').replace('_', ' ')}
                      </span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                      ⚠️ No specific policy — using system defaults
                    </span>
                  )}
                </div>
              )}

              {selectedEmpId && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 border-b flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Leave Balance</p>
                    {balanceFetching && <span className="text-xs text-slate-400 animate-pulse">Loading…</span>}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {Object.entries(balances).map(([type, bal]) => {
                      const pct = bal.quota > 0 ? Math.min(100, (bal.used / bal.quota) * 100) : 0
                      const danger = bal.remaining <= 0, warn = bal.remaining > 0 && bal.remaining <= 3
                      return (
                        <div key={type} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50" onClick={() => setAssignForm(s=>({...s,leaveType:type}))}>
                          <div className="flex-1">
                            <div className="flex justify-between mb-1">
                              <span className="text-xs font-semibold capitalize text-slate-700">{type.replace('_',' ')}</span>
                              <span className={`text-xs font-bold ${danger?'text-red-600':warn?'text-amber-600':'text-emerald-600'}`}>{bal.remaining}/{bal.quota} left</span>
                            </div>
                            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${danger?'bg-red-500':warn?'bg-amber-400':'bg-emerald-500'}`} style={{width:`${pct}%`}}/>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Leave Type *</label>
                  <select value={assignForm.leaveType} onChange={e => setAssignForm(s=>({...s,leaveType:e.target.value}))} className="form-select capitalize">
                    {assignableLeaveTypes.map(t => (
                      <option key={t} value={t}>{t.replace('_',' ')}</option>
                    ))}
                    {/* Always allow no_pay */}
                    {!assignableLeaveTypes.includes('no_pay') && (
                      <option value="no_pay">no pay</option>
                    )}
                  </select>
                  {employeePolicy && (
                    <p className="text-[11px] text-slate-400 mt-1">Options from: <span className="font-medium text-indigo-600">{employeePolicy.name}</span></p>
                  )}
                </div>
                <div>
                  <label className="form-label">Reason</label>
                  <input value={assignForm.reason} onChange={e => setAssignForm(s=>({...s,reason:e.target.value}))} className="form-input" placeholder="Optional" />
                </div>
                <div>
                  <label className="form-label">Start Date *</label>
                  <input type="date" value={assignForm.startDate} onChange={e => setAssignForm(s=>({...s,startDate:e.target.value}))} className="form-input"/>
                </div>
                <div>
                  <label className="form-label">End Date *</label>
                  <input type="date" value={assignForm.endDate} onChange={e => setAssignForm(s=>({...s,endDate:e.target.value}))} className="form-input"/>
                </div>
              </div>
              <div>
                <label className="form-label">Remarks</label>
                <textarea rows={2} value={assignForm.remarks} onChange={e => setAssignForm(s=>({...s,remarks:e.target.value}))} className="form-input resize-none" placeholder="Optional remarks visible to employee"/>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-2xl shrink-0">
              <button onClick={() => setShowAssign(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
              <button disabled={assignMut.isPending || !assignForm.employeeId || !assignForm.startDate || !assignForm.endDate}
                onClick={() => assignMut.mutate(assignForm)} className="btn-primary flex-1 justify-center">
                {assignMut.isPending ? <span className="spinner"/> : 'Assign Leave'}
              </button>
            </div>
          </motion.div>
        </div>, document.body
      )}
    </div>
  )
}
