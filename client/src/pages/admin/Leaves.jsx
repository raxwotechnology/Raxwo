import { useMemo, useState, useEffect } from 'react'
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
import useAuthStore from '../../store/authStore'
import {
  FiCheck, FiX, FiCalendar, FiPlus, FiEye, FiEdit2, FiTrash2, FiFilter,
  FiUpload, FiAlertTriangle, FiInfo, FiCheckCircle, FiClock, FiUser
} from 'react-icons/fi'

const TYPE_COLORS = {
  annual:'badge-blue', sick:'badge-red', casual:'badge-yellow', medical:'badge-red',
  half_day:'badge-blue', short_leave:'badge-purple', no_pay:'badge-gray',
  maternity:'badge-purple', paternity:'badge-navy', unpaid:'badge-gray'
}
const STATUS_COLORS = { pending:'badge-yellow', approved:'badge-green', rejected:'badge-red' }

const REQUEST_LEAVE_TYPES = [
  { value: 'annual',      label: 'Annual Leave',        balanceLabel: 'Annual',    icon: '🌴' },
  { value: 'medical',     label: 'Medical Leave',        balanceLabel: 'Medical',   icon: '🏥', requireDoc: true, requireReason: true },
  { value: 'casual',      label: 'Casual Leave',         balanceLabel: 'Casual',    icon: '☀️' },
  { value: 'half_day',    label: 'Half Day',             balanceLabel: 'Half Day',  icon: '🌗' },
  { value: 'short_leave', label: 'Short Leave (≤3h)',    balanceLabel: 'Short',     icon: '⏱️' },
  { value: 'no_pay',      label: 'No Pay Leave',         balanceLabel: null,        icon: '📋' },
  { value: 'maternity',   label: 'Maternity Leave',      balanceLabel: 'Maternity', icon: '👶' },
  { value: 'paternity',   label: 'Paternity Leave',      balanceLabel: 'Paternity', icon: '👨‍👧' },
]

const SHORT_DURATIONS = [
  { value: 1, label: '1 Hour' },
  { value: 2, label: '2 Hours' },
  { value: 3, label: '3 Hours' },
]

const fmt = d => d ? new Date(d).toLocaleDateString('en-LK', { day:'2-digit', month:'short', year:'numeric' }) : '—'

export default function AdminLeaves() {
  const qc = useQueryClient()
  const { user } = useAuthStore()

  // Tab state: 'all' = All Leave Requests, 'my' = My Leaves & Balances
  const [activeTab, setActiveTab] = useState('all')

  // Filters (All requests tab)
  const [statusFilter, setStatusFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]   = useState('')
  const [search, setSearch]   = useState('')

  // Modals
  const [showAssign, setShowAssign] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [viewLeave, setViewLeave]   = useState(null)
  const [editLeave, setEditLeave]   = useState(null)
  const [editForm, setEditForm]     = useState({})

  // Assign form
  const [selectedEmpId, setSelectedEmpId] = useState('')
  const [assignForm, setAssignForm] = useState({
    employeeId:'', leaveType:'annual', startDate:'', endDate:'', reason:'', remarks:'',
  })

  // Personal Request Leave Form
  const [requestForm, setRequestForm] = useState({
    leaveType: 'annual',
    startDate: '',
    endDate: '',
    reason: '',
    halfDayPeriod: 'AM',
    shortLeaveDuration: 1,
    shortLeaveStart: '',
    shortLeaveEnd: '',
  })
  const [docFile, setDocFile] = useState(null)

  // Reset leave type when employee changes (pick first from policy)
  const handleEmployeeChange = (v) => {
    setSelectedEmpId(v)
    setAssignForm(s => ({ ...s, employeeId: v, leaveType: 'annual' }))
  }

  // Remarks/rejection inline state
  const [remarks, setRemarks] = useState({})
  const [rejectionReasons, setRejectionReasons] = useState({})

  // ── Data: All Organization / Team Leaves ─────────────────────────────────────
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

  const { data: branchData } = useQuery({
    queryKey: ['branches-list'],
    queryFn: () => api.get('/branches').then(r => r.data)
  })
  const branches = branchData?.branches || []

  const { data: employeesData } = useQuery({
    queryKey: ['employees-mini'],
    queryFn: () => api.get(assignableEmployeesUrl()).then(r => r.data),
    enabled: showAssign,
  })
  const employees = employeesData?.employees || []

  // Assign Leave balance & policy for selected employee
  const { data: balanceData, isFetching: balanceFetching } = useQuery({
    queryKey: ['leave-balance', selectedEmpId],
    queryFn: () => api.get(`/leaves/balance/${selectedEmpId}`).then(r => r.data),
    enabled: !!selectedEmpId,
  })
  const balances = balanceData?.balances || {}

  const { data: policyData, isFetching: policyFetching } = useQuery({
    queryKey: ['employee-policy', selectedEmpId],
    queryFn: () => api.get(`/leaves/policy-for/${selectedEmpId}`).then(r => r.data),
    enabled: !!selectedEmpId,
  })
  const employeePolicy = policyData?.policy || null

  const ALL_LEAVE_TYPES = ['annual','sick','casual','medical','half_day','short_leave','maternity','paternity','no_pay']
  const policyLeaveTypes = employeePolicy
    ? employeePolicy.quotas.filter(q => q.quota > 0).map(q => q.leaveType)
    : ALL_LEAVE_TYPES
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

  // ── Data: My Personal Leaves & Balances ─────────────────────────────────────
  const { data: myData, isLoading: myLoading } = useQuery({
    queryKey: ['my-leaves'],
    queryFn: () => api.get('/leaves/my').then(r => r.data),
  })
  const myLeaves = myData?.leaves || []
  const myBalances = myData?.balances || {}

  const { data: myBalanceData } = useQuery({
    queryKey: ['my-leave-balances'],
    queryFn: () => api.get('/leaves/my/balances').then(r => r.data),
    enabled: showRequestModal || activeTab === 'my',
  })
  const currentBalances = myBalanceData?.balances || myBalances || {}
  const currentTypeBalance = currentBalances[requestForm.leaveType]

  // Request form calculations
  const isReqHalfDay = requestForm.leaveType === 'half_day'
  const isReqShort   = requestForm.leaveType === 'short_leave'
  const isReqMedical = requestForm.leaveType === 'medical'

  const daysRequested = isReqHalfDay ? 0.5
    : isReqShort ? Number(requestForm.shortLeaveDuration || 1) / 8
    : (requestForm.startDate && requestForm.endDate ? Math.max(1, Math.ceil((new Date(requestForm.endDate) - new Date(requestForm.startDate)) / 86400000) + 1) : 0)

  const isSufficient = !currentTypeBalance || currentTypeBalance.remaining >= daysRequested

  // Auto-sync endDate for half day / short leave
  useEffect(() => {
    if ((isReqHalfDay || isReqShort) && requestForm.startDate) {
      setRequestForm(prev => ({ ...prev, endDate: prev.startDate }))
    }
  }, [isReqHalfDay, isReqShort, requestForm.startDate])

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const inv = () => {
    qc.invalidateQueries({ queryKey: ['leaves'] })
    qc.invalidateQueries({ queryKey: ['my-leaves'] })
    qc.invalidateQueries({ queryKey: ['my-leave-balances'] })
  }

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
    onError: e => toast.error(e.response?.data?.message || 'Failed to update leave status'),
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

  const cancelMyLeaveMut = useMutation({
    mutationFn: id => api.delete(`/leaves/${id}`),
    onSuccess: () => { inv(); toast.success('Leave request cancelled') },
    onError: e => toast.error(e.response?.data?.message || 'Failed to cancel request'),
  })

  const assignMut = useMutation({
    mutationFn: payload => api.post('/leaves/assign', payload).then(r => r.data),
    onSuccess: () => {
      inv(); toast.success('Leave assigned successfully'); setShowAssign(false)
      setSelectedEmpId(''); setAssignForm({ employeeId:'', leaveType:'annual', startDate:'', endDate:'', reason:'', remarks:'' })
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed to assign leave'),
  })

  const requestMut = useMutation({
    mutationFn: formData => api.post('/leaves', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      inv()
      toast.success('Leave request submitted successfully!')
      setShowRequestModal(false)
      setDocFile(null)
      setRequestForm({
        leaveType: 'annual', startDate: '', endDate: '', reason: '',
        halfDayPeriod: 'AM', shortLeaveDuration: 1, shortLeaveStart: '', shortLeaveEnd: ''
      })
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed to submit leave request'),
  })

  const handleAction = (id, status) => {
    if (status === 'rejected' && !rejectionReasons[id]) { toast.error('Rejection reason required'); return }
    updateMut.mutate({ id, status, remarks: remarks[id] || '', rejectedReason: rejectionReasons[id] || '' })
  }

  const handleRequestSubmit = (e) => {
    e.preventDefault()
    if (!requestForm.startDate) {
      toast.error('Start date is required')
      return
    }
    if (!isReqHalfDay && !isReqShort && !requestForm.endDate) {
      toast.error('End date is required')
      return
    }
    if (isReqMedical && !docFile) {
      toast.error('Medical certificate is required for medical leave')
      return
    }

    const fd = new FormData()
    fd.append('leaveType', requestForm.leaveType)
    fd.append('startDate', requestForm.startDate)
    fd.append('endDate', (isReqHalfDay || isReqShort) ? requestForm.startDate : requestForm.endDate)
    if (requestForm.reason) fd.append('reason', requestForm.reason)
    if (isReqHalfDay) fd.append('halfDayPeriod', requestForm.halfDayPeriod || 'AM')
    if (isReqShort) {
      fd.append('shortLeaveDuration', requestForm.shortLeaveDuration || 1)
      if (requestForm.shortLeaveStart) fd.append('shortLeaveStart', requestForm.shortLeaveStart)
      if (requestForm.shortLeaveEnd) fd.append('shortLeaveEnd', requestForm.shortLeaveEnd)
    }
    if (docFile) fd.append('document', docFile)

    requestMut.mutate(fd)
  }

  const pendingCount = leaves.filter(l => l.status === 'pending').length
  const myPendingCount = myLeaves.filter(l => l.status === 'pending').length

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

  const balanceCards = REQUEST_LEAVE_TYPES.filter(t => t.balanceLabel && currentBalances[t.value])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ── */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Leave Management</h1>
          <p className="page-subtitle">
            {activeTab === 'all'
              ? `${pendingCount} pending · ${leaves.length} total staff requests`
              : `${myLeaves.filter(l => l.status === 'approved').length} approved · ${myPendingCount} pending requests`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {activeTab === 'all' && (
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
          )}
          <button
            onClick={() => setShowRequestModal(true)}
            className="btn-outline flex items-center gap-1.5 shadow-sm border-secondary text-secondary hover:bg-secondary/10"
          >
            <FiCalendar size={15}/> Request Leave
          </button>
          <button
            onClick={() => setShowAssign(true)}
            className="btn-primary flex items-center gap-1.5 shadow-sm"
          >
            <FiPlus size={16}/> Assign Leave
          </button>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'all'
              ? 'border-secondary text-secondary'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>All Leave Requests</span>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 font-bold">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('my')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'my'
              ? 'border-secondary text-secondary'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>My Leaves &amp; Balances</span>
          {myLeaves.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-bold">
              {myLeaves.length}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB 1: ALL LEAVE REQUESTS ── */}
      {activeTab === 'all' && (
        <div className="space-y-6">
          {/* KPI Cards */}
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
              <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-slate-200">
                <FiCalendar size={40} className="mx-auto mb-2 opacity-30"/>
                <p>No leave requests found</p>
              </div>
            ) : leaves.map(leave => {
              const isOwnLeave = leave.employee?.userId?._id === user?._id
              return (
                <motion.div key={leave._id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="card card-body">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Employee info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-bold flex-shrink-0">
                        {leave.employee?.userId?.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800 truncate">{leave.employee?.userId?.name}</p>
                          {isOwnLeave && (
                            <span className="badge badge-purple text-[10px] py-0 px-1.5">You</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">{leave.employee?.employeeNo} · {leave.employee?.department || leave.employee?.designation}</p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex flex-wrap gap-2 flex-1">
                      <span className={`badge ${TYPE_COLORS[leave.leaveType]||'badge-gray'} capitalize`}>{leave.leaveType?.replace('_',' ')}</span>
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <FiCalendar size={12}/> {fmt(leave.startDate)} {leave.startDate !== leave.endDate && `→ ${fmt(leave.endDate)}`}
                      </span>
                      <span className="badge badge-navy">{leave.days === 0.5 ? 'Half Day' : `${leave.days} day${leave.days>1?'s':''}`}</span>
                      {leave.halfDayPeriod && <span className="badge badge-blue">{leave.halfDayPeriod}</span>}
                      {leave.shortLeaveDuration && <span className="badge badge-purple">{leave.shortLeaveDuration}h</span>}
                      <span className={`badge ${STATUS_COLORS[leave.status]} capitalize`}>{leave.status}</span>
                      {leave.insufficientBalance && (
                        <span className="badge badge-red gap-1"><FiAlertTriangle size={11}/> Insufficient Balance</span>
                      )}
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
                    {leave.documentUrl && (
                      <p>
                        <span className="font-medium">Attachment:</span>{' '}
                        <a href={leave.documentUrl} target="_blank" rel="noreferrer" className="text-secondary underline hover:text-secondary/80">
                          View Uploaded Document
                        </a>
                      </p>
                    )}
                    {leave.remarks && <p><span className="font-medium">Remarks:</span> {leave.remarks}</p>}
                    {leave.rejectedReason && <p><span className="font-medium text-red-600">Rejection reason:</span> {leave.rejectedReason}</p>}
                  </div>

                  {/* Approve / Reject inline (pending only) */}
                  {leave.status === 'pending' && (
                    <div className="mt-3 pt-3 border-t border-dashed border-gray-100 flex flex-col sm:flex-row gap-2 items-center">
                      {isOwnLeave && user?.role !== 'admin' ? (
                        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg w-full">
                          <FiAlertTriangle size={14} className="shrink-0"/>
                          <span>This is your own leave request. It is pending approval from an Administrator.</span>
                        </div>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: MY LEAVES & BALANCES ── */}
      {activeTab === 'my' && (
        <div className="space-y-6">
          {/* Balance Cards */}
          {balanceCards.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {balanceCards.map(t => {
                const b = currentBalances[t.value]
                if (!b) return null
                const pct = b.quota > 0 ? Math.min(100, (b.remaining / b.quota) * 100) : 0
                return (
                  <div key={t.value} className="card p-4 bg-white border border-slate-200/80 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xl">{t.icon}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        b.remaining === 0 ? 'bg-red-100 text-red-700' : b.remaining < b.quota * 0.3 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {b.remaining} / {b.quota}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-700 mb-2">{t.label}</p>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          b.remaining === 0 ? 'bg-red-500' : b.remaining < b.quota * 0.3 ? 'bg-amber-400' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{b.used} used</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Personal Leave History */}
          <div className="space-y-3">
            {myLoading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto"/>
              </div>
            ) : myLeaves.length === 0 ? (
              <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-slate-200">
                <FiCalendar size={40} className="mx-auto mb-3 opacity-30"/>
                <p className="font-semibold text-slate-700">No personal leave requests submitted yet</p>
                <p className="text-xs text-slate-400 mt-1">Submit your leave request by clicking below</p>
                <button
                  onClick={() => setShowRequestModal(true)}
                  className="btn-primary btn-sm mt-4 inline-flex items-center gap-1.5"
                >
                  <FiPlus size={14}/> Request Leave
                </button>
              </div>
            ) : myLeaves.map(l => (
              <motion.div key={l._id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="card card-body card-hover">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className={`badge capitalize ${TYPE_COLORS[l.leaveType]||'badge-gray'}`}>
                        {l.leaveType?.replace('_',' ')}
                      </span>
                      <span className={`badge ${STATUS_COLORS[l.status]}`}>{l.status}</span>
                      {l.days > 0 && (
                        <span className="badge badge-navy">
                          {l.days === 0.5 ? 'Half Day' : `${l.days} day${l.days > 1 ? 's' : ''}`}
                        </span>
                      )}
                      {l.halfDayPeriod && <span className="badge badge-blue">{l.halfDayPeriod}</span>}
                      {l.shortLeaveDuration && <span className="badge badge-purple">{l.shortLeaveDuration}h</span>}
                      {l.insufficientBalance && (
                        <span className="badge badge-red gap-1"><FiAlertTriangle size={11}/> Insufficient Balance</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 flex items-center gap-1.5">
                      <FiCalendar size={13}/>
                      {fmt(l.startDate)}
                      {l.startDate !== l.endDate && l.leaveType !== 'half_day' && l.leaveType !== 'short_leave' && (
                        <> &rarr; {fmt(l.endDate)}</>
                      )}
                      {l.shortLeaveStart && <span className="text-slate-400 text-xs ml-1">({l.shortLeaveStart} – {l.shortLeaveEnd})</span>}
                    </p>
                    {l.reason && <p className="text-xs text-gray-500"><span className="font-medium">Reason:</span> {l.reason}</p>}
                    {l.documentUrl && (
                      <p className="text-xs">
                        <span className="font-medium text-slate-500">Document:</span>{' '}
                        <a href={l.documentUrl} target="_blank" rel="noreferrer" className="text-secondary underline hover:text-secondary/80">
                          View Attached MC
                        </a>
                      </p>
                    )}
                    {l.remarks && <p className="text-xs text-blue-600"><span className="font-medium">Remarks:</span> {l.remarks}</p>}
                    {l.rejectedReason && <p className="text-xs text-red-500"><span className="font-medium">Rejection reason:</span> {l.rejectedReason}</p>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-xs text-gray-400">{fmt(l.createdAt)}</p>
                    {l.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Are you sure you want to cancel this pending leave request?')) {
                            cancelMyLeaveMut.mutate(l._id)
                          }
                        }}
                        disabled={cancelMyLeaveMut.isPending}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Cancel Request"
                      >
                        <FiTrash2 size={14}/>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── View Modal ── */}
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
                  <p className="text-xs text-slate-500">{viewLeave.employee?.employeeNo} · {viewLeave.employee?.department || viewLeave.employee?.designation}</p>
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
              {viewLeave.documentUrl && (
                <div className="pt-2">
                  <a href={viewLeave.documentUrl} target="_blank" rel="noreferrer" className="btn-outline btn-sm w-full justify-center">
                    View Uploaded Document
                  </a>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex gap-2">
              <button onClick={() => setViewLeave(null)} className="btn-ghost flex-1 justify-center">Close</button>
            </div>
          </motion.div>
        </div>, document.body
      )}

      {/* ── Edit Modal ── */}
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

      {/* ── Assign Leave Modal (Assign to another employee) ── */}
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

      {/* ── Request Leave Modal (Admin / Manager personal request) ── */}
      {showRequestModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 999999 }}>
          <motion.div
            initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b shrink-0">
              <div>
                <h3 className="text-lg font-bold text-primary font-heading">Request Leave</h3>
                <p className="text-xs text-slate-400 mt-0.5">Submit your leave application for approval</p>
              </div>
              <button onClick={() => { setShowRequestModal(false); setDocFile(null) }} className="p-2 hover:bg-gray-100 rounded-lg">
                <FiX size={16}/>
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              <form id="admin-request-leave-form" onSubmit={handleRequestSubmit} className="p-6 space-y-5">
                {/* Leave Type Selector */}
                <div>
                  <label className="form-label">Leave Type *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {REQUEST_LEAVE_TYPES.map(t => (
                      <label key={t.value}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all text-sm font-medium ${
                          requestForm.leaveType === t.value
                            ? 'border-secondary bg-secondary/5 text-secondary font-semibold ring-1 ring-secondary/20'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="leaveType"
                          value={t.value}
                          checked={requestForm.leaveType === t.value}
                          onChange={() => setRequestForm(f => ({ ...f, leaveType: t.value }))}
                          className="hidden"
                        />
                        <span>{t.icon}</span>
                        <span>{t.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Real-time balance info for the chosen type */}
                {currentTypeBalance && (
                  <div className={`rounded-xl p-3 flex items-start gap-2.5 text-sm ${
                    currentTypeBalance.remaining === 0 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                  }`}>
                    {currentTypeBalance.remaining === 0 ? <FiAlertTriangle className="shrink-0 mt-0.5"/> : <FiInfo className="shrink-0 mt-0.5"/>}
                    <div>
                      <p className="font-semibold">
                        {currentTypeBalance.remaining > 0
                          ? `${currentTypeBalance.remaining} day${currentTypeBalance.remaining !== 1 ? 's' : ''} remaining in balance`
                          : 'No quota remaining for this type'}
                      </p>
                      <p className="text-xs opacity-75 mt-0.5">{currentTypeBalance.used} used of {currentTypeBalance.quota} total days this year</p>
                    </div>
                  </div>
                )}

                {/* Dates & Duration */}
                {isReqHalfDay ? (
                  <div className="space-y-3">
                    <div>
                      <label className="form-label">Date *</label>
                      <input
                        type="date"
                        required
                        className="form-input"
                        value={requestForm.startDate}
                        onChange={e => setRequestForm(f => ({ ...f, startDate: e.target.value, endDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="form-label">Period</label>
                      <div className="grid grid-cols-2 gap-3">
                        {[{v:'AM', label:'Morning (AM)'}, {v:'PM', label:'Afternoon (PM)'}].map(p => (
                          <label key={p.v}
                            className={`flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer text-sm font-medium transition-all ${
                              requestForm.halfDayPeriod === p.v
                                ? 'border-secondary bg-secondary/5 text-secondary font-semibold'
                                : 'border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name="halfDayPeriod"
                              value={p.v}
                              checked={requestForm.halfDayPeriod === p.v}
                              onChange={() => setRequestForm(f => ({ ...f, halfDayPeriod: p.v }))}
                              className="hidden"
                            />
                            {p.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : isReqShort ? (
                  <div className="space-y-3">
                    <div>
                      <label className="form-label">Date *</label>
                      <input
                        type="date"
                        required
                        className="form-input"
                        value={requestForm.startDate}
                        onChange={e => setRequestForm(f => ({ ...f, startDate: e.target.value, endDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="form-label">Duration</label>
                      <div className="grid grid-cols-3 gap-2">
                        {SHORT_DURATIONS.map(d => (
                          <label key={d.value}
                            className={`flex items-center justify-center p-2.5 rounded-xl border cursor-pointer text-sm font-medium transition-all ${
                              requestForm.shortLeaveDuration === d.value
                                ? 'border-secondary bg-secondary/5 text-secondary font-semibold'
                                : 'border-slate-200 text-slate-500'
                            }`}
                          >
                            <input
                              type="radio"
                              name="shortLeaveDuration"
                              value={d.value}
                              checked={requestForm.shortLeaveDuration === d.value}
                              onChange={() => setRequestForm(f => ({ ...f, shortLeaveDuration: d.value }))}
                              className="hidden"
                            />
                            {d.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">From Time</label>
                        <input
                          type="time"
                          className="form-input"
                          value={requestForm.shortLeaveStart}
                          onChange={e => setRequestForm(f => ({ ...f, shortLeaveStart: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="form-label">To Time</label>
                        <input
                          type="time"
                          className="form-input"
                          value={requestForm.shortLeaveEnd}
                          onChange={e => setRequestForm(f => ({ ...f, shortLeaveEnd: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Start Date *</label>
                      <input
                        type="date"
                        required
                        className="form-input"
                        value={requestForm.startDate}
                        onChange={e => setRequestForm(f => ({ ...f, startDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="form-label">End Date *</label>
                      <input
                        type="date"
                        required
                        min={requestForm.startDate}
                        className="form-input"
                        value={requestForm.endDate}
                        onChange={e => setRequestForm(f => ({ ...f, endDate: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                {/* Days requested summary */}
                {daysRequested > 0 && (
                  <div className={`rounded-xl p-3 text-sm font-medium flex items-center gap-2 ${
                    !isSufficient ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  }`}>
                    {!isSufficient ? <FiAlertTriangle size={15}/> : <FiCheckCircle size={15}/>}
                    <span>
                      <strong>{daysRequested === 0.5 ? 'Half day' : `${daysRequested} working day${daysRequested !== 1 ? 's' : ''}`}</strong> will be deducted
                      {!isSufficient && ' — insufficient quota. Request will be flagged for review.'}
                    </span>
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label className="form-label">
                    Reason {isReqMedical ? '*' : '(Optional)'}
                  </label>
                  <textarea
                    rows={2}
                    required={isReqMedical}
                    value={requestForm.reason}
                    onChange={e => setRequestForm(f => ({ ...f, reason: e.target.value }))}
                    className="form-input resize-none"
                    placeholder={isReqMedical ? 'Describe the medical reason or condition...' : 'Optional reason for leave...'}
                  />
                </div>

                {/* Document Upload for Medical */}
                {isReqMedical && (
                  <div>
                    <label className="form-label">Medical Certificate / MC Document *</label>
                    <div
                      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                        docFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-secondary hover:bg-secondary/5'
                      }`}
                      onClick={() => document.getElementById('admin-leave-doc-input')?.click()}
                    >
                      <input
                        id="admin-leave-doc-input"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={e => setDocFile(e.target.files[0])}
                      />
                      {docFile ? (
                        <div className="flex items-center justify-center gap-2 text-emerald-700 text-sm font-medium">
                          <FiCheckCircle size={16}/>
                          <span>{docFile.name}</span>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setDocFile(null) }}
                            className="text-red-500 hover:text-red-700 ml-1"
                          >
                            <FiX size={14}/>
                          </button>
                        </div>
                      ) : (
                        <div className="text-slate-400 text-sm">
                          <FiUpload size={20} className="mx-auto mb-1"/>
                          <p>Click to upload Medical Certificate (MC)</p>
                          <p className="text-xs mt-1">PDF, JPG, PNG — max 5MB</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </div>

            <div className="p-6 border-t bg-slate-50 rounded-b-2xl shrink-0 flex gap-3">
              <button
                type="button"
                onClick={() => { setShowRequestModal(false); setDocFile(null) }}
                className="btn-ghost flex-1 justify-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="admin-request-leave-form"
                disabled={requestMut.isPending}
                className="btn-primary flex-1 justify-center"
              >
                {requestMut.isPending ? <span className="spinner"/> : 'Submit Request'}
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  )
}
