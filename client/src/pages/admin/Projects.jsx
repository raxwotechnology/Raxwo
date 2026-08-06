import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import { assignableEmployeesUrl } from '../../lib/employeeApi'
import { mediaUrl } from '../../lib/media'
import toast from 'react-hot-toast'
import { FiPlus, FiX, FiFolder, FiSearch, FiEdit2, FiTrash2, FiUsers, FiInfo, FiUser } from 'react-icons/fi'
import { invoicePaymentDisplay } from '../../lib/invoicePayment'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { lookupLoaders } from '../../lib/lookupApi'
import ExportBar from '../../components/ui/ExportBar'
import { useDeleteWithPassword } from '../../components/admin/DeletePasswordGate'

const SERVICE_TYPES = ['ERP', 'POS', 'Hosting', 'Website', 'Maintenance', 'Custom', 'Other']
const statusColor = { planning:'badge-gray', active:'badge-green', on_hold:'badge-yellow', completed:'badge-blue', cancelled:'badge-red', overdue:'badge-red' }
const paymentStatusColor = { unpaid: 'badge-yellow', partial: 'badge-blue', paid: 'badge-green', none: 'badge-gray' }
const priorityColor = { low:'badge-gray', medium:'badge-yellow', high:'badge-red', critical:'badge-purple' }

export default function AdminProjects() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [branchFilter, setBranchFilter] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [serviceTypeFilter, setServiceTypeFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [selectedTeam, setSelectedTeam] = useState([])
  const [commissionAllocations, setCommissionAllocations] = useState([])
  const [linkedInvoices, setLinkedInvoices] = useState([])
  const [clientSelectLabel, setClientSelectLabel] = useState('')
  const [selectedClientData, setSelectedClientData] = useState(null)

  const { register, handleSubmit, reset, setValue, watch } = useForm({ defaultValues: { progress: 0, budget: 0, client: '' } })

  const watchedClient = watch('client')
  const loadClientOptions = useMemo(() => lookupLoaders.clients(), [])

  const { data: clientInvData } = useQuery({
    queryKey: ['invoices-for-project-form', watchedClient],
    queryFn: () => api.get(`/invoices?client=${watchedClient}`).then((r) => r.data),
    enabled: showModal && Boolean(watchedClient),
  })
  const clientInvoices = useMemo(() => clientInvData?.invoices || [], [clientInvData?.invoices])

  useEffect(() => {
    if (!watchedClient) {
      setLinkedInvoices((prev) => prev.length === 0 ? prev : [])
      setSelectedClientData(null)
      return
    }
    setLinkedInvoices((prev) => {
      const next = prev.filter((id) => clientInvoices.some((i) => String(i._id) === String(id)))
      return next.length === prev.length ? prev : next
    })
    // Fetch client user profile to get logo / avatar preview
    api.get(`/users/${watchedClient}`).then(r => setSelectedClientData(r.data?.user || r.data)).catch(() => {})
  }, [watchedClient, clientInvoices])

  useEffect(() => {
    if (!linkedInvoices.length || !clientInvoices.length) return
    const first = clientInvoices.find((i) => String(i._id) === String(linkedInvoices[0]))
    if (first?.dueDate) {
      setValue('deadline', new Date(first.dueDate).toISOString().slice(0, 10), { shouldDirty: false })
    }
  }, [linkedInvoices, clientInvoices, setValue])

  const { data: projData, isLoading } = useQuery({
    queryKey: ['admin-projects', branchFilter],
    queryFn: () => api.get(`/projects${branchFilter ? `?branch=${branchFilter}` : ''}`).then(r => r.data),
  })
  const { data: empData } = useQuery({
    queryKey: ['employees-list-all'],
    queryFn: () => api.get(assignableEmployeesUrl({ includeFormer: 'true' })).then(r => r.data),
  })
  const { data: branchData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches').then(r => r.data),
  })

  const projects = (projData?.projects || []).filter(p =>
    (!search || p.title?.toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || p.status === statusFilter) &&
    (!serviceTypeFilter || p.serviceType === serviceTypeFilter) &&
    (!priorityFilter || p.priority === priorityFilter)
  )
  const employees = empData?.employees || []
  const branches = branchData?.branches || []

  const createMut = useMutation({
    mutationFn: d => api.post('/projects', d),
    onSuccess: () => { qc.invalidateQueries(['admin-projects']); toast.success('Project created'); closeModal() },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/projects/${id}`, data),
    onSuccess: () => { qc.invalidateQueries(['admin-projects']); toast.success('Updated'); closeModal() },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })
  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/projects/${id}`),
    onSuccess: () => { qc.invalidateQueries(['admin-projects']); toast.success('Deleted') },
  })
  const { requestDelete: requestDeleteProject, DeletePasswordModal: projectDeleteModal } = useDeleteWithPassword(deleteMut, {
    title: 'Delete project',
    message: 'Enter your admin password to permanently delete this project.',
  })

  const openEdit = p => {
    setEditing(p)
    setValue('title', p.title || '')
    setValue('description', p.description || '')
    setValue('client', p.client?._id || p.client || '')
    setClientSelectLabel(
      p.client?.name ? `${p.client.name}${p.client.email ? ` (${p.client.email})` : ''}` : ''
    )
    setValue('status', p.status || 'planning')
    setValue('priority', p.priority || 'medium')
    setValue('serviceType', p.serviceType || 'Other')
    setValue('budget', p.budget ?? 0)
    setValue('startDate', p.startDate ? new Date(p.startDate).toISOString().slice(0,10) : '')
    setValue('deadline', p.deadline ? new Date(p.deadline).toISOString().slice(0,10) : '')
    setValue('progress', p.progress ?? 0)
    setValue('projectManager', p.projectManager?._id || p.projectManager || '')
    setValue('branch', p.branch?._id || p.branch || '')
    const invIds = [
      ...(p.linkedInvoices || []).map((i) => i._id || i),
      ...(p.invoice ? [p.invoice._id || p.invoice] : []),
    ]
    setLinkedInvoices([...new Set(invIds.map(String))])
    const team = (p.assignedEmployees || []).map(u => u._id || u)
    setSelectedTeam(team)
    const allocs = (p.salaryAllocations || []).map((a) => ({
      employeeId: a.employee?._id || a.employee,
      employeeName: a.employeeName || '',
      amount: a.amount ?? 0,
      commission: a.commission || 0,
    }))
    setCommissionAllocations(allocs)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false); setEditing(null)
    reset({ progress: 0, budget: 0 })
    setSelectedTeam([])
    setCommissionAllocations([])
    setLinkedInvoices([])
    setClientSelectLabel('')
  }

  const toggleTeamMember = emp => {
    const empUserId = emp.userId?._id
    const empEmpId = emp._id
    const isSelected = selectedTeam.includes(empUserId)
    if (isSelected) {
      setSelectedTeam((s) => s.filter((id) => id !== empUserId))
      setCommissionAllocations((s) => s.filter((a) => a.employeeId !== empEmpId))
    } else {
      setSelectedTeam((s) => [...s, empUserId])
      setCommissionAllocations((s) => [...s, {
        employeeId: empEmpId,
        employeeName: emp.userId?.name || '',
        amount: Number(emp.basicSalary) || 0,
        commission: 0,
      }])
    }
  }

  const updateCommission = (empEmpId, value) => {
    setCommissionAllocations((s) => s.map((a) => (a.employeeId === empEmpId ? { ...a, commission: Number(value || 0) } : a)))
  }

  const updateBasicSalary = (empEmpId, value) => {
    setCommissionAllocations((s) => s.map((a) => (a.employeeId === empEmpId ? { ...a, amount: Number(value || 0) } : a)))
  }

  const toggleInvoice = (invId) => {
    const id = String(invId)
    setLinkedInvoices((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const onSubmit = d => {
    const finalAllocations = selectedTeam.map((userId) => {
      const emp = employees.find((e) => String(e.userId?._id) === String(userId))
      const empId = emp?._id || userId
      const existing = commissionAllocations.find((a) => String(a.employeeId) === String(empId) || String(a.employee) === String(empId))
      return {
        employee: empId,
        employeeName: existing?.employeeName || emp?.userId?.name || 'Team Member',
        amount: Number(existing?.amount || 0),
        commission: Number(existing?.commission || 0),
      }
    })

    const hasNegative = finalAllocations.some((a) => a.commission < 0)
    if (hasNegative) {
      toast.error('Commission amount cannot be negative')
      return
    }

    const payload = {
      ...d,
      assignedEmployees: selectedTeam,
      linkedInvoices,
      invoice: linkedInvoices[0] || undefined,
      salaryAllocations: finalAllocations,
    }
    if (!payload.client) delete payload.client
    if (!payload.projectManager) delete payload.projectManager
    if (!linkedInvoices.length) {
      delete payload.invoice
      payload.linkedInvoices = []
    }
    editing ? updateMut.mutate({ id: editing._id, data: payload }) : createMut.mutate(payload)
  }

  const progressValue = Number(watch('progress') || 0)
  const budget = Number(watch('budget') || 0)
  const totalCommission = commissionAllocations.reduce((s, a) => s + Number(a.commission || 0), 0)
  const commissionRemaining = budget - totalCommission

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">{projData?.count || 0} total projects</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportBar
            data={projects}
            columns={[
              { header: 'Project Title', accessor: 'title' },
              { header: 'Client', accessor: (p) => p.client?.name || 'Internal' },
              { header: 'Status', accessor: (p) => p.status?.replace('_', ' ').toUpperCase() },
              { header: 'Priority', accessor: (p) => p.priority?.toUpperCase() },
              { header: 'Progress', accessor: (p) => `${p.progress}%` },
              { header: 'Budget', accessor: (p) => `LKR ${p.budget?.toLocaleString()}` },
              { header: 'Deadline', accessor: (p) => p.deadline ? new Date(p.deadline).toLocaleDateString() : 'N/A' },
            ]}
            title="Projects Report"
            filters={{ Status: statusFilter, Branch: branches.find(b => b._id === branchFilter)?.name }}
          />
          <button onClick={() => { reset({ progress: 0, budget: 0 }); setEditing(null); setSelectedTeam([]); setCommissionAllocations([]); setLinkedInvoices([]); setClientSelectLabel(''); setShowModal(true) }} className="btn-primary">
            <FiPlus size={15}/> New Project
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." className="form-input !pl-10"/>
        </div>
        <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['planning','active','on_hold','completed','completed_payment_pending','paid_completed','overdue','cancelled'].map(s => <option key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="form-select" value={serviceTypeFilter} onChange={e => setServiceTypeFilter(e.target.value)}>
          <option value="">All Service Types</option>
          {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="form-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All Priorities</option>
          {['low','medium','high','critical'].map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
        </select>
        <select className="form-select" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
          <option value="">All Branches</option>
          {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
      </div>

      {/* Project Cards */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 text-center py-16"><div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto"/></div>
        ) : projects.length === 0 ? (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <FiFolder size={40} className="mx-auto mb-2 opacity-30"/>No projects found
          </div>
        ) : projects.map(p => (
          <motion.div key={p._id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="card card-body card-hover">
            <div className="flex items-start justify-between mb-3">
              <div className="flex gap-1.5 flex-wrap">
                <span className={`badge capitalize ${statusColor[p.status]||'badge-gray'}`}>{p.status?.replace('_',' ')}</span>
                <span className={`badge capitalize ${priorityColor[p.priority]||'badge-gray'}`}>{p.priority}</span>
                {p.serviceType && <span className="badge badge-navy">{p.serviceType}</span>}
                <span className={`badge capitalize ${paymentStatusColor[p.paymentStatus] || paymentStatusColor['unpaid']}`}>
                  {p.paymentStatus === 'none' ? 'Unpaid' : p.paymentStatus}
                </span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-secondary hover:bg-blue-50 rounded-lg transition-colors"><FiEdit2 size={13}/></button>
                <button type="button" onClick={() => requestDeleteProject(p._id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><FiTrash2 size={13}/></button>
              </div>
            </div>
            <div className="cursor-pointer" onClick={() => navigate(`/admin/projects/${p._id}`)}>
              <h3 className="font-bold text-primary font-heading mb-1 hover:text-secondary transition-colors">{p.title}</h3>
              <p className="text-gray-500 text-sm line-clamp-2 mb-3">{p.description}</p>
            </div>

            {/* Budget & Allocation */}
            {p.budget > 0 && (
              <div className="mb-3 p-2.5 bg-gray-50 rounded-xl text-xs space-y-1">
                <div className="flex justify-between text-gray-600">
                  <span>Budget</span><span className="font-semibold">LKR {p.budget.toLocaleString()}</span>
                </div>
                {p.paymentStatus && p.paymentStatus !== 'none' && (
                  <div className="flex justify-between text-gray-500">
                    <span>Payment</span>
                    <span className={`badge text-[10px] capitalize ${paymentStatusColor[p.paymentStatus] || 'badge-gray'}`}>{p.paymentStatus}</span>
                  </div>
                )}
                {p.salaryAllocations?.length > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Team commission</span>
                    <span className="text-purple-600 font-medium">LKR {p.salaryAllocations.reduce((s, a) => s + (a.commission || 0), 0).toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}

            {/* Progress */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Progress</span><span>{p.progress}%</span></div>
              <div className="progress-bar">
                <div className="progress-fill bg-secondary" style={{width:`${p.progress}%`}}/>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-50">
              <span>Client: <span className="text-gray-700 font-medium">{p.client?.name || 'Internal'}</span></span>
              {p.assignedEmployees?.length > 0 && (
                <span className="flex items-center gap-1"><FiUsers size={11}/> {p.assignedEmployees.length} members</span>
              )}
            </div>
            {p.deadline && <p className="text-xs text-gray-400 mt-1">Due: {new Date(p.deadline).toLocaleDateString('en-LK')}</p>}
            {p.invoice && (() => {
              const invPay = invoicePaymentDisplay(p.invoice)
              return (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                  <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Invoice</span>
                  <span className={`badge text-[10px] ${invPay.badgeClass}`}>{invPay.label}</span>
                </div>
              )
            })()}

            <button onClick={() => navigate(`/admin/projects/${p._id}`)} className="mt-4 w-full py-2 bg-slate-50 hover:bg-slate-100 text-secondary font-medium text-sm rounded-xl transition-colors border border-slate-100 flex justify-center items-center gap-1.5">
              <FiInfo size={14}/> View Full Details
            </button>
          </motion.div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto w-full max-w-full overflow-x-hidden box-border" style={{ zIndex: 99999 }}>
          <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] sm:max-h-[92vh] flex flex-col my-auto overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b bg-white shrink-0">
              <h3 className="text-lg font-bold text-primary font-heading">{editing ? 'Edit Project' : 'New Project'}</h3>
              <button type="button" onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg"><FiX/></button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5 custom-scrollbar">
                {/* Basic Info */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><FiFolder size={14}/> Basic Information</h4>
                  <div className="space-y-3">
                    <div><label className="form-label">Project Title *</label>
                      <input {...register('title', {required: true})} className="form-input" placeholder="e.g. ERP System for XYZ Company"/></div>
                    <div><label className="form-label">Description *</label>
                      <textarea {...register('description', {required: !editing})} rows={2} className="form-input resize-none" placeholder="Project scope and objectives"/></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 lg:col-span-1"><label className="form-label">Client</label>
                        <input type="hidden" {...register('client')} />
                        <SearchableSelect
                          value={watchedClient || ''}
                          onChange={(v, opt) => {
                            setValue('client', v, { shouldDirty: true })
                            setClientSelectLabel(opt?.label || '')
                          }}
                          loadOptions={loadClientOptions}
                          placeholder="Search client…"
                          clearable
                          initialLabel={clientSelectLabel}
                        />
                        {watchedClient && selectedClientData && (
                          <div className="mt-2 flex items-center gap-2.5 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                            {selectedClientData.avatar ? (
                              <img src={mediaUrl(selectedClientData.avatar)} alt="" className="w-7 h-7 rounded-full object-cover border border-slate-300" onError={(e) => { e.target.style.display = 'none' }} />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                                <FiUser size={14} />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{selectedClientData.name}</p>
                              <p className="text-[10px] text-slate-500 truncate">{selectedClientData.email || 'Client'}</p>
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-slate-400 mt-1">Leave empty for internal / no client</p>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="form-label">Client invoices (optional)</label>
                        {!watchedClient ? (
                          <p className="text-sm text-slate-400 py-2">Select a client to load their invoices.</p>
                        ) : clientInvoices.length === 0 ? (
                          <p className="text-sm text-slate-400 py-2">No invoices found for this client.</p>
                        ) : (
                          <div className="border border-gray-100 rounded-xl max-h-40 overflow-y-auto custom-scrollbar divide-y divide-gray-50">
                            {clientInvoices.map((inv) => {
                              const checked = linkedInvoices.includes(String(inv._id))
                              const pay = invoicePaymentDisplay(inv)
                              return (
                                <label key={inv._id} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer ${checked ? 'bg-blue-50/60' : 'hover:bg-gray-50'}`}>
                                  <input type="checkbox" checked={checked} onChange={() => toggleInvoice(inv._id)} className="w-4 h-4 accent-secondary" />
                                  <span className="flex-1 text-sm font-medium text-gray-800">{inv.invoiceNo}</span>
                                  <span className={`badge text-[10px] ${pay.badgeClass}`}>{pay.label}</span>
                                  <span className="text-xs text-gray-500">{(inv.currency || 'LKR')} {(inv.remainingBalance ?? 0).toLocaleString()}</span>
                                </label>
                              )
                            })}
                          </div>
                        )}
                        <p className="text-xs text-slate-400 mt-1">Only invoices for the selected client can be linked. The first selected invoice sets the project deadline.</p>
                      </div>
                      <div><label className="form-label">Service Type</label>
                        <select {...register('serviceType')} className="form-select">
                          {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select></div>
                      <div><label className="form-label">Branch</label>
                        <select {...register('branch')} className="form-select">
                          <option value="">No branch</option>
                          {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                        </select></div>
                      <div><label className="form-label">Status</label>
                        <select {...register('status')} className="form-select">
                          {['planning','active','on_hold','completed','completed_payment_pending','paid_completed','overdue','cancelled'].map(s => <option key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</option>)}
                        </select></div>
                      <div><label className="form-label">Priority</label>
                        <select {...register('priority')} className="form-select">
                          {['low','medium','high','critical'].map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
                        </select></div>
                      <div><label className="form-label">Project Manager</label>
                        <select {...register('projectManager')} className="form-select">
                          <option value="">Select manager</option>
                          {employees.filter(e => ['manager','admin'].includes(e.userId?.role)).map(e => (
                            <option key={e._id} value={e.userId?._id}>{e.userId?.name}</option>
                          ))}
                        </select></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div><label className="form-label">Start Date</label>
                        <input {...register('startDate')} type="date" className="form-input"/></div>
                      <div><label className="form-label">Deadline</label>
                        <input {...register('deadline')} type="date" className="form-input"/></div>
                      <div><label className="form-label">Budget (LKR) *</label>
                        <input {...register('budget', {valueAsNumber: true})} type="number" placeholder="0" className="form-input"/></div>
                    </div>
                    <div><label className="form-label">Progress ({progressValue}%)</label>
                      <input {...register('progress', {valueAsNumber: true})} type="range" min={0} max={100} className="w-full accent-secondary"/></div>
                  </div>
                </div>

                <hr className="border-gray-100"/>

                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-2"><FiUsers size={14}/> Team & Commissions</h4>
                  <p className="text-xs text-gray-400 mb-3">Assign employees — basic salary is shown from employee records (not editable). Set commission for each selected member.</p>
                  <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <div className="min-w-[500px]">
                      <div className="grid grid-cols-[1fr_120px_120px] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <span>Employee</span>
                        <span>Basic salary (LKR)</span>
                        <span>Commission (LKR) *</span>
                      </div>
                      <div className="max-h-72 overflow-y-auto custom-scrollbar divide-y divide-gray-50">
                        {employees.map(emp => {
                          const isSelected = selectedTeam.includes(emp.userId?._id)
                          const isResigned = ['resigned', 'former'].includes(emp.status) || emp.userId?.status === 'resigned'
                          const alloc = commissionAllocations.find((a) => String(a.employeeId) === String(emp._id))
                          return (
                            <div key={emp._id} className={`grid grid-cols-[1fr_120px_120px] gap-2 items-center px-4 py-2.5 ${isSelected ? 'bg-blue-50/60' : 'hover:bg-gray-50'}`}>
                              <label className="flex items-center gap-3 cursor-pointer min-w-0">
                                <input type="checkbox" checked={isSelected} onChange={() => toggleTeamMember(emp)} className="w-4 h-4 accent-secondary shrink-0" />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-medium text-gray-800 truncate">{emp.userId?.name}</p>
                                    {isResigned && <span className="badge badge-red text-[10px] font-bold shrink-0">Resigned</span>}
                                  </div>
                                  <p className="text-xs text-gray-400 truncate">{emp.designation} · {emp.employeeNo}</p>
                                </div>
                              </label>
                              {isSelected ? (
                                <>
                                  <input
                                    type="text"
                                    readOnly
                                    className="form-input bg-slate-50 text-slate-700 cursor-not-allowed"
                                    value={Number(alloc?.amount ?? emp.basicSalary ?? 0).toLocaleString()}
                                    title="Basic salary from employee record (read-only)"
                                  />
                                  <input
                                    type="number"
                                    min={0}
                                    className="form-input"
                                    placeholder="0"
                                    value={alloc?.commission ?? ''}
                                    onChange={(e) => updateCommission(emp._id, e.target.value)}
                                  />
                                </>
                              ) : (
                                <>
                                  <span className="text-xs text-gray-300 text-center">—</span>
                                  <span className="text-xs text-gray-300 text-center">—</span>
                                </>
                              )}
                            </div>
                          )
                        })}
                        {employees.length === 0 && (
                          <div className="text-center py-6 text-gray-400 text-sm">No employees found</div>
                        )}
                      </div>
                    </div>
                  </div>
                  {budget > 0 && selectedTeam.length > 0 && (
                    <div className="mt-3 p-3 bg-purple-50 rounded-xl border border-purple-100 text-xs space-y-2">
                      <div className="flex justify-between text-gray-600">
                        <span>Total commission allocated</span>
                        <span className="font-bold text-purple-700">LKR {totalCommission.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>Remaining from budget</span>
                        <span className={commissionRemaining < 0 ? 'text-red-600 font-semibold' : 'text-emerald-600 font-medium'}>
                          LKR {commissionRemaining.toLocaleString()}
                        </span>
                      </div>
                      {commissionRemaining < 0 && (
                        <p className="text-red-600 text-[11px]">Commission total exceeds project budget.</p>
                      )}
                    </div>
                  )}
                  {selectedTeam.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2">{selectedTeam.length} team member(s) — commission required for each</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 p-4 sm:p-6 border-t bg-white shrink-0">
                <button type="button" onClick={closeModal} className="btn-ghost flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="btn-primary flex-1 justify-center">
                  {createMut.isPending || updateMut.isPending ? <span className="spinner"/> : editing ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>,
        document.body
      )}
      {projectDeleteModal}
    </div>
  )
}
