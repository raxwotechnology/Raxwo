import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiUser, FiX, FiActivity, FiEye, FiAlertCircle, FiClock } from 'react-icons/fi'
import EmployeeDetail from './EmployeeDetail'
import EmployeeFormModal from '../../components/admin/EmployeeFormModal'
import { DEPARTMENTS, EMPLOYEE_STATUSES, EMPLOYEE_STATUS_FILTERS, STATUS_BADGE } from '../../constants/employeeStatus'
import ExportBar from '../../components/ui/ExportBar'
import { buildEmployeeSavePayload, resolveEmployeeDocUrls } from '../../lib/employeePayload'
import { mediaUrl } from '../../lib/media'

function buildEmployeesQueryString(filters) {
  const params = new URLSearchParams()
  if (filters.deptFilter) params.set('department', filters.deptFilter)
  if (filters.empTypeFilter) params.set('employmentType', filters.empTypeFilter)
  if (filters.branchFilter) params.set('branch', filters.branchFilter)
  const qs = params.toString()
  return qs ? `/employees?${qs}` : '/employees'
}

/** Dropdowns / other pages that list employees (never use a fuzzy `startsWith('employees')` match) */
function invalidateEmployeePickers(qc) {
  qc.invalidateQueries({ queryKey: ['employees-list'] })
  qc.invalidateQueries({ queryKey: ['employees-mini'], exact: false })
  qc.invalidateQueries({ queryKey: ['employees-all'], exact: false })
  qc.invalidateQueries({ queryKey: ['employees-list-mini'] })
  qc.invalidateQueries({ queryKey: ['admin-export-employees'] })
}

const EMPLOYMENT_TYPE_META = {
  permanent: { label: 'Permanent', className: 'bg-blue-50 text-blue-700 ring-blue-100' },
  intern: { label: 'Intern', className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  contract: { label: 'Contract', className: 'bg-violet-50 text-violet-700 ring-violet-100' },
  part_time: { label: 'Part-time', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
}

function invalidateAllEmployeeLists(qc) {
  invalidateEmployeePickers(qc)
  return qc.invalidateQueries({ queryKey: ['employees'], exact: false })
}

export default function AdminEmployees() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [activityEmp, setActivityEmp] = useState(null)
  const [cvFile, setCvFile] = useState(null)
  const [agreementFile, setAgreementFile] = useState(null)
  const [nicFile, setNicFile] = useState(null)
  const [nicBackFile, setNicBackFile] = useState(null)
  const [profilePhotoFile, setProfilePhotoFile] = useState(null)
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(null)
  const [profilePhotoToRemove, setProfilePhotoToRemove] = useState(false)
  const [cvToRemove, setCvToRemove] = useState(false)
  const [agreementToRemove, setAgreementToRemove] = useState(false)
  const [nicToRemove, setNicToRemove] = useState(false)
  const [nicBackToRemove, setNicBackToRemove] = useState(false)
  const [editDocUrls, setEditDocUrls] = useState({
    cvUrl: '', agreementUrl: '', nicPhotoUrl: '', nicPhotoBackUrl: '',
  })

  const resetDocRemovals = () => {
    setCvToRemove(false)
    setAgreementToRemove(false)
    setNicToRemove(false)
    setNicBackToRemove(false)
  }
  const [viewEmp, setViewEmp] = useState(null)
  /** Full row snapshot while delete modal is open — keeps the row in the list if cache refetches early, and drives modal copy */
  const [deletePendingEmp, setDeletePendingEmp] = useState(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [verifying, setVerifying] = useState(false)
  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm()
  const watchedType = useWatch({ control, name: 'employmentType', defaultValue: 'permanent' })
  const watchedStatus = useWatch({ control, name: 'status', defaultValue: 'active' })
  const watchedEpfEnrolled = useWatch({ control, name: 'epfEtfEnrolled', defaultValue: false })
  const watchedManager = useWatch({ control, name: 'manager', defaultValue: '' })

  const [empTypeFilter, setEmpTypeFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: branchData } = useQuery({ queryKey: ['branches-list'], queryFn: () => api.get('/branches').then(r => r.data) })
  const branches = branchData?.branches || []

  const { data: leadersSummary } = useQuery({
    queryKey: ['leaders-summary'],
    queryFn: () => api.get('/employees/leaders/summary').then(r => r.data),
  })
  const leadersList = leadersSummary?.potentialLeaders || (leadersSummary?.leaders || []).map(l => l.leader).filter(Boolean)

  const { data, isLoading } = useQuery({
    queryKey: ['employees', deptFilter, empTypeFilter, branchFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (deptFilter) params.set('department', deptFilter)
      if (empTypeFilter) params.set('employmentType', empTypeFilter)
      if (branchFilter) params.set('branch', branchFilter)
      if (statusFilter) params.set('status', statusFilter)
      const qs = params.toString()
      const { data: json } = await api.get(qs ? `/employees?${qs}` : '/employees')
      return json
    },
    placeholderData: (prev) => prev,
  })

  const employeesSource = useMemo(() => {
    const raw = data?.employees || []
    if (!deletePendingEmp) return raw
    const sid = String(deletePendingEmp._id)
    if (raw.some((e) => String(e._id) === sid)) return raw
    return [...raw, deletePendingEmp]
  }, [data?.employees, deletePendingEmp])

  const employees = employeesSource.filter((e) => {
    if (!search) return true
    try {
      const s = search.toLowerCase()
      const name = (e.userId?.name || '').toLowerCase()
      const empNo = (e.employeeNo || '').toLowerCase()
      const desig = (e.designation || '').toLowerCase()
      return name.includes(s) || empNo.includes(s) || desig.includes(s)
    } catch (err) {
      return false
    }
  })

  const createMut = useMutation({
    mutationFn: d => api.post('/employees', d).then(r => r.data),
    onSuccess: async () => {
      await invalidateAllEmployeeLists(qc)
      toast.success('Employee created')
      closeModal()
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/employees/${id}`, data).then(r => r.data),
    onSuccess: async () => {
      await invalidateAllEmployeeLists(qc)
      await qc.invalidateQueries({ queryKey: ['epf-records'] })
      toast.success('Updated')
      closeModal()
    },
    onError: e => toast.error(e.response?.data?.message || 'Update failed'),
  })
  const deleteMut = useMutation({
    mutationFn: ({ id }) => api.delete(`/employees/${id}`),
    onSuccess: async (_, variables) => {
      const deletedId = variables.id
      // Reset UI state immediately
      setDeletePendingEmp(null)
      setDeletePassword('')
      setSearch('')
      toast.success('Removed')

      // Manually update cache to remove the employee from ALL cached lists
      // This prevents the "disappearing records" issue by keeping the UI stable during refetch
      qc.setQueriesData({ queryKey: ['employees'] }, (old) => {
        if (!old || !old.employees) return old
        return {
          ...old,
          count: Math.max(0, (old.count || 1) - 1),
          employees: old.employees.filter((e) => String(e._id) !== String(deletedId))
        }
      })

      // Background sync
      invalidateAllEmployeeLists(qc)
      qc.invalidateQueries({ queryKey: ['epf-records'] })
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })

  const confirmDelete = async () => {
    if (!deletePassword) { toast.error('Password required'); return }
    if (!deletePendingEmp?._id) return
    setVerifying(true)
    try {
      await api.post('/auth/verify-password', { password: deletePassword })
      deleteMut.mutate({ id: deletePendingEmp._id, filters: { deptFilter, empTypeFilter, branchFilter } })
    } catch (e) {
      toast.error(e.response?.data?.message || 'Invalid password')
    }
    setVerifying(false)
  }

  const closeDeleteModal = () => {
    setDeletePendingEmp(null)
    setDeletePassword('')
  }

  const openCreate = () => {
    reset({
      role: 'developer',
      department: 'Engineering',
      designation: '',
      employmentType: 'permanent',
      status: 'active',
      joinedDate: new Date().toISOString().slice(0, 10),
      gender: 'male',
      idType: 'nic',
      basicSalary: 0,
      allowances: 0,
      epfEtfEnrolled: false,
      manager: '',
    })
    setEditing(null)
    setCvFile(null)
    setAgreementFile(null)
    setNicFile(null)
    setNicBackFile(null)
    setProfilePhotoFile(null)
    setProfilePhotoPreview(null)
    setProfilePhotoToRemove(false)
    resetDocRemovals()
    setEditDocUrls({ cvUrl: '', agreementUrl: '', nicPhotoUrl: '', nicPhotoBackUrl: '' })
    setShowModal(true)
  }
  const openEdit = async (emp) => {
    let full = emp
    try {
      const { data } = await api.get(`/employees/${emp._id}`)
      if (data?.employee) full = data.employee
    } catch {
      /* use list row if fetch fails */
    }
    setEditing(full)
    setEditDocUrls(resolveEmployeeDocUrls(full))
    ;[
      'department', 'designation', 'basicSalary', 'allowances', 'status', 'epfNumber',
      'idType', 'idNumber', 'primaryPhone', 'secondaryPhone', 'address',
      'portfolioUrl', 'gender', 'employmentType', 'branch',
      'etfNumber', 'resignationReason',
      'bank', 'bankBranch', 'accountNumber', 'accountHolder', 'accountType'
    ].forEach(k => setValue(k, full[k]))
    setValue('manager', full.manager?._id || (typeof full.manager === 'string' ? full.manager : ''))
    setValue('dob', full.dob ? full.dob.split('T')[0] : '')
    setValue('joinedDate', full.joinedDate ? full.joinedDate.split('T')[0] : '')
    setValue('resignationDate', full.resignationDate ? full.resignationDate.split('T')[0] : '')
    setValue('epfEtfEnrolled', full.epfEtfEnrolled || false)
    setValue('emergencyContactName', full?.emergencyContact?.name || '')
    setValue('emergencyContactPhone', full?.emergencyContact?.phone || '')
    setValue('emergencyContactRelationship', full?.emergencyContact?.relationship || '')
    setValue('role', full.userId?.role || 'developer')
    setValue('name', full.userId?.name || '')
    setValue('email', full.userId?.email || full.email || '')
    if (full.internship) {
      setValue('internship.startDate', full.internship.startDate?.split('T')[0] || '')
      setValue('internship.endDate', full.internship.endDate?.split('T')[0] || '')
      setValue('internship.durationWeeks', full.internship.durationWeeks || '')
      setValue('internship.university', full.internship.university || '')
      setValue('internship.supervisorName', full.internship.supervisorName || '')
    }
    if (full.contract) {
      setValue('contract.startDate', full.contract.startDate?.split('T')[0] || '')
      setValue('contract.endDate', full.contract.endDate?.split('T')[0] || '')
    }
    setCvFile(null); setAgreementFile(null); setNicFile(null); setNicBackFile(null)
    setProfilePhotoFile(null)
    setProfilePhotoPreview(full?.profilePhoto ? mediaUrl(full.profilePhoto) : null)
    resetDocRemovals()
    setShowModal(true)
  }
  const closeModal = () => {
    setShowModal(false); setEditing(null); reset()
    setCvFile(null); setAgreementFile(null); setNicFile(null); setNicBackFile(null)
    setProfilePhotoFile(null); setProfilePhotoPreview(null)
    resetDocRemovals()
    setEditDocUrls({ cvUrl: '', agreementUrl: '', nicPhotoUrl: '', nicPhotoBackUrl: '' })
  }
  const uploadFile = async (file) => {
    if (!file) return null
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await api.post('/uploads/file', fd)
    return data?.fileUrl || data?.url || null
  }

  const uploadImage = (file) => new Promise((resolve, reject) => {
    if (!file) return resolve(null)
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result)
    reader.onerror = (e) => reject(new Error('Image conversion failed'))
  })

  const onInvalid = () => toast.error('Please complete all required fields (department, designation, join date, etc.)')

  const onSubmit = async (d) => {
    try {
      const [cvUrl, agreementUrl, nicPhotoUrl, nicPhotoBackUrl, profilePhoto] = await Promise.all([
        cvFile ? uploadFile(cvFile) : Promise.resolve(null),
        agreementFile ? uploadFile(agreementFile) : Promise.resolve(null),
        nicFile ? uploadFile(nicFile) : Promise.resolve(null),
        nicBackFile ? uploadFile(nicBackFile) : Promise.resolve(null),
        profilePhotoFile ? uploadImage(profilePhotoFile) : Promise.resolve(null),
      ])
      const fileUrls = {}
      if (cvUrl) fileUrls.cvUrl = cvUrl
      else if (cvToRemove) fileUrls.cvUrl = ''
      if (agreementUrl) fileUrls.agreementUrl = agreementUrl
      else if (agreementToRemove) fileUrls.agreementUrl = ''
      if (nicPhotoUrl) fileUrls.nicPhotoUrl = nicPhotoUrl
      else if (nicToRemove) fileUrls.nicPhotoUrl = ''
      if (nicPhotoBackUrl) fileUrls.nicPhotoBackUrl = nicPhotoBackUrl
      else if (nicBackToRemove) fileUrls.nicPhotoBackUrl = ''
      if (profilePhoto) fileUrls.profilePhoto = profilePhoto
      else if (profilePhotoToRemove) fileUrls.profilePhoto = ''

      const payload = buildEmployeeSavePayload(d, {
        isEdit: Boolean(editing),
        fileUrls,
        includeAllowances: !editing,
      })

      if (editing) {
        if (!editing._id) {
          toast.error('Employee ID missing. Please refresh.')
          return
        }
        return updateMut.mutate({ id: editing._id, data: payload })
      }
      return createMut.mutate(payload)
    } catch(err) {
      toast.error('File upload failed. Please try again.')
    }
  }

  const statusColor = STATUS_BADGE

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['employee-activity', activityEmp?._id],
    queryFn: () => api.get(`/employees/${activityEmp._id}/activity`).then((r) => r.data),
    enabled: Boolean(activityEmp?._id),
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">{data?.count || 0} total employees</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto mt-3 sm:mt-0 justify-start sm:justify-end">
          <ExportBar
            data={employees}
            columns={[
              { header: 'Name', accessor: (e) => e.userId?.name || '—' },
              { header: 'Emp No', accessor: 'employeeNo' },
              { header: 'Department', accessor: 'department' },
              { header: 'Status', accessor: 'status' },
            ]}
            title="Employee List"
          />
          <button type="button" onClick={openCreate} className="btn-primary w-full sm:w-auto justify-center"><FiPlus size={16}/> Add Employee</button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 w-full sm:w-auto">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input 
            value={search} 
            onChange={e=>setSearch(e.target.value)} 
            placeholder="Search employees..." 
            className="form-input !pl-10"
            autoComplete="off"
            name="raxwo-emp-search-unique"
          />
        </div>
        <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)} className="form-select sm:w-48">
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
        </select>
        <select value={empTypeFilter} onChange={e=>setEmpTypeFilter(e.target.value)} className="form-select sm:w-44">
          <option value="">All Types</option>
          <option value="permanent">Permanent</option>
          <option value="intern">Intern</option>
          <option value="contract">Contract</option>
          <option value="part_time">Part Time</option>
        </select>
        <select value={branchFilter} onChange={e=>setBranchFilter(e.target.value)} className="form-select sm:w-44">
          <option value="">All Branches</option>
          {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-select sm:w-44">
          {EMPLOYEE_STATUS_FILTERS.map(s => (
            <option key={s.value || 'all'} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="table-container hidden lg:block">
        <table className="table">
          <thead><tr>
            <th>Employee</th><th>Emp. ID / Type</th><th>Department</th><th>Designation</th>
            <th>Basic Salary</th><th>EPF No</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {!data && isLoading ? (
              <tr><td colSpan={8} className="text-center py-12">
                <div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto"/>
              </td></tr>
            ) : data ? (
              employees.length > 0 ? (
                employees.map(emp => (
                  <tr key={emp._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        {emp.profilePhoto
                          ? <img src={mediaUrl(emp.profilePhoto)} alt={emp.userId?.name}
                              className="w-9 h-9 rounded-full object-cover flex-shrink-0 border-2 border-white shadow"/>
                          : <div className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-semibold text-sm flex-shrink-0">
                              {emp.userId?.name?.charAt(0).toUpperCase()}
                            </div>
                        }
                        <div>
                          <p className="font-medium text-gray-800">{emp.userId?.name}</p>
                          <p className="text-xs text-gray-400">{emp.userId?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1.5 min-w-[96px]">
                        <span className="font-mono text-xs font-semibold text-slate-700 tracking-wide">{emp.employeeNo || '—'}</span>
                        <span className={`inline-flex w-fit items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset ${EMPLOYMENT_TYPE_META[emp.employmentType]?.className || EMPLOYMENT_TYPE_META.permanent.className}`}>
                          {EMPLOYMENT_TYPE_META[emp.employmentType]?.label || 'Permanent'}
                        </span>
                        {emp.employmentType === 'intern' && emp.internshipDaysRemaining !== null && (
                          <span className={`text-[10px] font-medium flex items-center gap-1 ${emp.internshipDaysRemaining <= 14 ? 'text-red-500' : 'text-slate-400'}`}>
                            {emp.internshipDaysRemaining <= 14 && <FiAlertCircle size={10} />}
                            {emp.internshipDaysRemaining}d left
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{emp.department}</td>
                    <td>{emp.designation}</td>
                    <td className="font-medium">LKR {emp.basicSalary?.toLocaleString()}</td>
                    <td className="text-gray-500">{emp.epfNumber||'—'}</td>
                    <td><span className={`badge ${statusColor[emp.status]||'badge-gray'}`}>{EMPLOYEE_STATUSES.find(s => s.value === emp.status)?.label || emp.status}</span></td>
                    <td>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setViewEmp(emp)}
                          className="p-1.5 text-gray-400 hover:text-secondary hover:bg-blue-50 rounded-lg transition-colors" title="View Details">
                          <FiEye size={14}/>
                        </button>
                        <button
                          onClick={() => navigate(`/admin/work-logs?employee=${emp._id}`)}
                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"
                          title="Work Logs" type="button">
                          <FiClock size={14}/>
                        </button>
                        <button
                          onClick={() => setActivityEmp(emp)}
                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors"
                          title="View activity" type="button">
                          <FiActivity size={14}/>
                        </button>
                        <button type="button" onClick={()=>openEdit(emp)} className="p-1.5 text-gray-400 hover:text-secondary hover:bg-blue-50 rounded-lg transition-colors"><FiEdit2 size={14}/></button>
                        <button type="button" onClick={() => { setDeletePendingEmp(emp); setDeletePassword('') }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove employee"><FiTrash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                  <FiUser size={36} className="mx-auto mb-2 opacity-30"/>No employees found
                </td></tr>
              )
            ) : (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">Failed to load data</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="block lg:hidden space-y-3">
        {!data && isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto"/>
          </div>
        ) : data && employees.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-slate-200">
            <FiUser size={32} className="mx-auto mb-2 opacity-30"/>
            <p>No employees found</p>
          </div>
        ) : data ? (
          employees.map(emp => (
            <div key={emp._id} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm">
              <div className="flex items-center gap-3">
                {emp.profilePhoto
                  ? <img src={mediaUrl(emp.profilePhoto)} alt={emp.userId?.name}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-white shadow"/>
                  : <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-semibold text-sm flex-shrink-0">
                      {emp.userId?.name?.charAt(0).toUpperCase()}
                    </div>
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-slate-800 text-sm truncate">{emp.userId?.name}</p>
                    <span className={`badge text-[10px] ${statusColor[emp.status]||'badge-gray'}`}>{EMPLOYEE_STATUSES.find(s => s.value === emp.status)?.label || emp.status}</span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">{emp.userId?.email}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs border-t border-b border-slate-100 py-2">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Designation</span>
                  <p className="font-medium text-slate-700">{emp.designation || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Department</span>
                  <p className="font-medium text-slate-700">{emp.department || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">ID / Type</span>
                  <p className="font-medium text-slate-700">{emp.employeeNo || '—'} · <span className="capitalize">{emp.employmentType?.replace('_', ' ')}</span></p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Basic Salary</span>
                  <p className="font-semibold text-slate-800">LKR {emp.basicSalary?.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-[11px] text-slate-400 font-mono">EPF: {emp.epfNumber || '—'}</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setViewEmp(emp)}
                    className="p-2 text-gray-500 hover:text-secondary hover:bg-slate-100 rounded-lg transition-colors" title="View Details">
                    <FiEye size={14}/>
                  </button>
                  <button
                    onClick={() => navigate(`/admin/work-logs?employee=${emp._id}`)}
                    className="p-2 text-gray-500 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors"
                    title="Work Logs" type="button">
                    <FiClock size={14}/>
                  </button>
                  <button
                    onClick={() => setActivityEmp(emp)}
                    className="p-2 text-gray-500 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors"
                    title="View activity" type="button">
                    <FiActivity size={14}/>
                  </button>
                  <button type="button" onClick={()=>openEdit(emp)} className="p-2 text-gray-500 hover:text-secondary hover:bg-slate-100 rounded-lg transition-colors"><FiEdit2 size={14}/></button>
                  <button type="button" onClick={() => { setDeletePendingEmp(emp); setDeletePassword('') }} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove employee"><FiTrash2 size={14}/></button>
                </div>
              </div>
            </div>
          ))
        ) : null}
      </div>

      {showModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[99999]">
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.95}}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90dvh] flex flex-col overflow-hidden relative">
              <div className="flex items-center justify-between p-4 sm:p-6 border-b shrink-0 bg-white">
                <h3 className="text-lg font-bold text-primary font-heading">{editing?'Edit Employee':'Add Employee'}</h3>
                <button type="button" onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg"><FiX/></button>
              </div>
              <div className="overflow-y-auto p-0 flex-1 relative">
              <EmployeeFormModal
                editing={editing}
                branches={branches}
                managers={leadersList}
                register={register}
                setValue={setValue}
                errors={errors}
                watchedType={watchedType}
                watchedStatus={watchedStatus}
                watchedEpfEnrolled={watchedEpfEnrolled}
                watchedManager={watchedManager}
                cvFile={cvFile}
                setCvFile={setCvFile}
                agreementFile={agreementFile}
                setAgreementFile={setAgreementFile}
                nicFile={nicFile}
                setNicFile={setNicFile}
                nicBackFile={nicBackFile}
                setNicBackFile={setNicBackFile}
                cvToRemove={cvToRemove}
                setCvToRemove={setCvToRemove}
                agreementToRemove={agreementToRemove}
                setAgreementToRemove={setAgreementToRemove}
                nicToRemove={nicToRemove}
                setNicToRemove={setNicToRemove}
                nicBackToRemove={nicBackToRemove}
                setNicBackToRemove={setNicBackToRemove}
                editDocUrls={editDocUrls}
                profilePhotoPreview={profilePhotoPreview}
                profilePhotoToRemove={profilePhotoToRemove}
                setProfilePhotoFile={setProfilePhotoFile}
                setProfilePhotoPreview={setProfilePhotoPreview}
                setProfilePhotoToRemove={setProfilePhotoToRemove}
                editingHasProfilePhoto={Boolean(editing?.profilePhoto)}
                createPending={createMut.isPending}
                updatePending={updateMut.isPending}
                closeModal={closeModal}
                onSubmit={onSubmit}
                handleSubmit={handleSubmit}
                onInvalid={onInvalid}
              />
              </div>
            </motion.div>
        </div>,
        document.body
      )}

      {activityEmp && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[99999]">
            <motion.div
              initial={{opacity:0, y: 10, scale: 0.98}}
              animate={{opacity:1, y: 0, scale: 1}}
              exit={{opacity:0, y: 10, scale: 0.98}}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90dvh] flex flex-col overflow-hidden relative"
            >
              <div className="flex items-center justify-between p-4 sm:p-6 border-b shrink-0 bg-white">
                <div>
                  <h3 className="text-lg font-bold text-primary font-heading">Employee Activity</h3>
                  <p className="text-sm text-slate-500">{activityEmp.userId?.name} • {activityEmp.userId?.email}</p>
                </div>
                <button onClick={() => setActivityEmp(null)} className="p-2 hover:bg-gray-100 rounded-lg"><FiX/></button>
              </div>

              <div className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1 relative">
                {activityLoading ? (
                  <div className="py-12 text-center">
                    <div className="w-10 h-10 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto"/>
                    <p className="text-sm text-slate-500 mt-3">Loading activity…</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="card card-body">
                        <p className="text-xs text-slate-500">Projects</p>
                        <p className="text-2xl font-extrabold text-primary">{activityData?.overview?.projectsCount || 0}</p>
                      </div>
                      <div className="card card-body">
                        <p className="text-xs text-slate-500">Tasks Completed</p>
                        <p className="text-2xl font-extrabold text-primary">{activityData?.overview?.tasksCompleted || 0}</p>
                      </div>
                      <div className="card card-body">
                        <p className="text-xs text-slate-500">Tasks Pending</p>
                        <p className="text-2xl font-extrabold text-primary">{activityData?.overview?.tasksPending || 0}</p>
                      </div>
                      <div className="card card-body">
                        <p className="text-xs text-slate-500">Attendance (30d)</p>
                        <p className="text-sm text-slate-600 mt-2">
                          Present: <span className="font-semibold text-slate-800">{activityData?.overview?.attendance30d?.present || 0}</span>{' '}
                          • Absent: <span className="font-semibold text-slate-800">{activityData?.overview?.attendance30d?.absent || 0}</span>{' '}
                          • Leave: <span className="font-semibold text-slate-800">{activityData?.overview?.attendance30d?.leave || 0}</span>
                        </p>
                      </div>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-5">
                      <div className="card card-body">
                        <h4 className="font-bold text-primary font-heading mb-3">Recent Projects</h4>
                        <div className="space-y-2">
                          {(activityData?.projects || []).slice(0, 6).map((p) => (
                            <div key={p._id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-800">{p.title}</p>
                                  <p className="text-xs text-slate-500 mt-0.5 capitalize">{p.status} • Progress {p.progress || 0}%</p>
                                </div>
                                <span className="badge badge-navy capitalize">{p.status}</span>
                              </div>
                            </div>
                          ))}
                          {(activityData?.projects || []).length === 0 ? <p className="text-sm text-slate-400">No assigned projects.</p> : null}
                        </div>
                      </div>

                      <div className="card card-body">
                        <h4 className="font-bold text-primary font-heading mb-3">Recent Leaves</h4>
                        <div className="space-y-2">
                          {(activityData?.leaves || []).slice(0, 6).map((l) => (
                            <div key={l._id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                              <div className="flex items-center justify-between">
                                <p className="font-semibold text-slate-800 capitalize">{l.leaveType}</p>
                                <span className={`badge ${l.status === 'approved' ? 'badge-green' : l.status === 'rejected' ? 'badge-red' : 'badge-yellow'} capitalize`}>{l.status}</span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                {new Date(l.startDate).toLocaleDateString()} → {new Date(l.endDate).toLocaleDateString()} • {l.days} day(s)
                              </p>
                            </div>
                          ))}
                          {(activityData?.leaves || []).length === 0 ? <p className="text-sm text-slate-400">No leaves yet.</p> : null}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
        </div>,
        document.body
      )}

      {viewEmp && (
        <EmployeeDetail
          employee={viewEmp}
          onClose={() => setViewEmp(null)}
          onEdit={() => { openEdit(viewEmp); setViewEmp(null) }}
        />
      )}
      {/* Delete Confirmation Modal */}
      {deletePendingEmp && createPortal(
        <div className="fixed inset-0 bg-slate-900/30 flex items-center justify-center z-[100001] p-4 backdrop-blur-[2px]">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto"><FiAlertCircle size={24} /></div>
              <h3 className="font-bold text-lg text-slate-800">Permanently Delete Employee</h3>
              <p className="text-sm text-slate-500">
                Enter your administrator password to <span className="text-red-600 font-bold">permanently delete</span>{' '}
                <span className="font-semibold text-slate-800">{deletePendingEmp.userId?.name || 'this employee'}</span>
                {' '}({deletePendingEmp.employeeNo}) and their login account from the database. This cannot be undone.
              </p>
            </div>
            <div>
              <input 
                type="password" 
                placeholder="Enter password" 
                disabled={verifying} 
                className="form-input" 
                value={deletePassword} 
                onChange={e => setDeletePassword(e.target.value)} 
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmDelete() } }}
                autoComplete="new-password"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={closeDeleteModal} className="btn-ghost flex-1 justify-center">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={verifying || !deletePassword} className="btn-primary flex-1 justify-center bg-red-600 hover:bg-red-700 border-red-600">
                {verifying || deleteMut.isPending ? <span className="spinner" /> : 'Delete Permanently'}
              </button>
            </div>
          </motion.div>
        </div>, document.body
      )}
    </div>
  )
}
