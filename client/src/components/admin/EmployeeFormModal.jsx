import { useState, useMemo, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  FiUser, FiKey, FiBriefcase, FiDollarSign, FiPhone, FiUpload, FiFile, FiLink, FiTrash2, FiCreditCard,
  FiSearch, FiX, FiCheck, FiChevronDown, FiShield,
} from 'react-icons/fi'
import { DEPARTMENTS, ROLES, EMPLOYEE_STATUSES } from '../../constants/employeeStatus'
import { mediaUrl } from '../../lib/media'
import EmployeePasswordPanel from './EmployeePasswordPanel'

function highlightMatch(text, query) {
  if (!query || !text) return text
  const safeQ = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = String(text).split(new RegExp(`(${safeQ})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <span key={i} className="font-extrabold text-secondary bg-secondary/15 rounded px-0.5">{part}</span>
      : part
  )
}

function SearchableLeaderSelect({ managers = [], value, onChange }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('managers') // 'managers' | 'all' | 'staff'
  const containerRef = useRef(null)

  const activeManagers = useMemo(() => {
    return managers.filter(m => m.isActive !== false && !['inactive', 'suspended', 'former', 'terminated', 'resigned', 'intern_ended'].includes(m.status))
  }, [managers])

  const selectedLeader = useMemo(() => {
    if (!value) return null
    return activeManagers.find(m => String(m._id || m.userId?._id) === String(value) || String(m.userId?._id || m._id) === String(value)) || null
  }, [activeManagers, value])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredList = useMemo(() => {
    const q = search.toLowerCase().trim()
    return activeManagers
      .filter(m => {
        const name = (m.name || m.userId?.name || '').toLowerCase()
        const desig = (m.designation || '').toLowerCase()
        const dept = (m.department || '').toLowerCase()
        const role = (m.role || m.userId?.role || '').toLowerCase()
        const isMgr = m.role === 'manager' || m.role === 'admin' || m.userId?.role === 'manager' || m.userId?.role === 'admin' || desig.includes('manager') || desig.includes('director') || desig.includes('lead')
        
        const matchSearch = !q || name.includes(q) || desig.includes(q) || dept.includes(q) || role.includes(q)
        const matchType = filterType === 'all' || (filterType === 'managers' ? isMgr : !isMgr)
        return matchSearch && matchType
      })
      .sort((a, b) => {
        const aMgr = a.role === 'manager' || a.role === 'admin' || a.userId?.role === 'manager' || a.userId?.role === 'admin'
        const bMgr = b.role === 'manager' || b.role === 'admin' || b.userId?.role === 'manager' || b.userId?.role === 'admin'
        if (aMgr && !bMgr) return -1
        if (!aMgr && bMgr) return 1
        return (a.name || a.userId?.name || '').localeCompare(b.name || b.userId?.name || '')
      })
  }, [activeManagers, search, filterType])

  return (
    <div ref={containerRef} className="space-y-1.5 relative">
      <label className="form-label mb-0 flex items-center justify-between">
        <span>Reporting Leader / Manager</span>
        {selectedLeader && (
          <span className="text-[10px] text-secondary font-bold">Selected: {selectedLeader.name || selectedLeader.userId?.name}</span>
        )}
      </label>

      {/* Auto-suggest typing input */}
      <div className="relative">
        <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={open ? search : (selectedLeader ? `${selectedLeader.name || selectedLeader.userId?.name} (${selectedLeader.designation || selectedLeader.role || 'Leader'})` : search)}
          onChange={e => {
            setSearch(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            if (selectedLeader && !search) {
              setSearch(selectedLeader.name || selectedLeader.userId?.name || '')
            }
          }}
          placeholder="Type to search leaders by name, designation, department..."
          className={`form-input !pl-9 !pr-8 w-full text-xs transition-all ${
            selectedLeader && !open ? 'bg-secondary/5 font-semibold text-slate-800 border-secondary/40' : 'bg-white'
          }`}
        />
        {(selectedLeader || search) && (
          <button
            type="button"
            onClick={() => {
              onChange('')
              setSearch('')
              setOpen(false)
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
            title="Clear / No Leader"
          >
            <FiX size={14} />
          </button>
        )}
      </div>

      {/* Instant Suggestions Dropdown as user types */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 p-3 bg-white rounded-xl border border-slate-200 shadow-2xl space-y-2 z-50 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Suggestions ({filteredList.length})
            </span>
            <div className="flex gap-1">
              {[
                { id: 'all', label: `All (${activeManagers.length})` },
                { id: 'managers', label: `Managers` },
                { id: 'staff', label: `Staff Leads` },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilterType(t.id)}
                  className={`text-[9px] px-2 py-0.5 rounded-full font-semibold transition-colors ${
                    filterType === t.id ? 'bg-secondary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg">
            {/* Option to clear / mark as independent */}
            <button
              type="button"
              onClick={() => { onChange(''); setSearch(''); setOpen(false); }}
              className="w-full text-left p-2 hover:bg-rose-50/50 text-xs text-rose-600 font-semibold flex items-center justify-between transition-colors"
            >
              <span>❌ None / Independent (No Leader)</span>
              {!value && <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">Selected</span>}
            </button>

            {filteredList.length === 0 ? (
              <p className="p-3 text-center text-xs text-slate-400">No leaders matching "{search}"</p>
            ) : (
              filteredList.map((m) => {
                const id = m.userId?._id || m._id
                const isSelected = String(value) === String(id)
                const isMgr = m.role === 'manager' || m.role === 'admin' || m.userId?.role === 'manager'
                const displayName = m.name || m.userId?.name || ''
                const displayDesig = m.designation || m.role || 'Staff'
                const displayDept = m.department || 'General'

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onChange(id)
                      setSearch('')
                      setOpen(false)
                    }}
                    className={`w-full text-left p-2.5 hover:bg-secondary/5 transition-colors flex items-center justify-between gap-2 ${
                      isSelected ? 'bg-secondary/10 border-l-2 border-secondary' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-secondary to-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {isMgr ? '👑 ' : '👤 '}
                          {highlightMatch(displayName, search)}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {highlightMatch(displayDesig, search)} · {highlightMatch(displayDept, search)}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      isMgr ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {isMgr ? 'Manager' : 'Staff Lead'}
                    </span>
                  </button>
                )
              })
            )}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <span className="text-[10px] text-slate-400">Click a suggestion to select</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] text-slate-500 hover:text-slate-700 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const FormSection = ({ title, icon: Icon, children }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
    <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center gap-2">
      {Icon && <Icon size={16} className="text-secondary" />}
      <h4 className="text-sm font-bold text-slate-800">{title}</h4>
    </div>
    <div className="p-4 space-y-4">{children}</div>
  </div>
)

const FieldError = ({ message }) => (message ? <p className="text-xs text-red-600 mt-1">{message}</p> : null)

const MAX_FILE_MB = 5

function FileUploadField({
  label, accept, hint, file, setFile, existingUrl, icon: Icon = FiFile,
  markedForRemoval = false, onRemove, onClearRemoval,
}) {
  const ref = useRef()
  const storedUrl = (existingUrl || '').trim()
  const showExisting = Boolean(storedUrl) && !markedForRemoval
  const showRemove = Boolean(onRemove) && !markedForRemoval && (showExisting || Boolean(file))

  return (
    <div className={`rounded-lg border border-dashed p-3 ${markedForRemoval ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={14} className="text-slate-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 truncate">{label}</p>
            {hint && <p className="text-xs text-slate-400">{hint}</p>}
          </div>
        </div>
        {showExisting && (
          <a href={mediaUrl(storedUrl)} target="_blank" rel="noreferrer" className="text-xs text-secondary hover:underline shrink-0 whitespace-nowrap">View</a>
        )}
      </div>
      {markedForRemoval && (
        <p className="text-xs text-amber-700 mt-2 font-medium">Will be removed when you save</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => ref.current?.click()} className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium">
          {file ? 'Change file' : showExisting ? 'Replace' : 'Choose file'}
        </button>
        {file && <span className="text-xs text-slate-500 truncate min-w-0 flex-1">{file.name}</span>}
      </div>
      {showRemove && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Remove ${label}? This takes effect when you save.`)) onRemove()
          }}
          className="mt-2 w-full text-xs px-2 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 font-medium inline-flex items-center justify-center gap-1"
        >
          <FiTrash2 size={12} /> Remove document
        </button>
      )}
      {markedForRemoval && onClearRemoval && (
        <button type="button" onClick={onClearRemoval} className="mt-2 w-full text-xs text-slate-600 hover:underline text-center block">
          Undo remove
        </button>
      )}
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => {
        const f = e.target.files?.[0]
        if (!f) return
        if (f.size > MAX_FILE_MB * 1024 * 1024) { toast.error(`Max ${MAX_FILE_MB}MB`); return }
        setFile(f)
        onClearRemoval?.()
      }} />
    </div>
  )
}

export default function EmployeeFormModal({
  editing, branches, managers = [], register, setValue, errors,
  watchedType, watchedStatus, watchedEpfEnrolled, watchedManager,
  cvFile, setCvFile, agreementFile, setAgreementFile,
  nicFile, setNicFile, nicBackFile, setNicBackFile,
  cvToRemove, setCvToRemove, agreementToRemove, setAgreementToRemove,
  nicToRemove, setNicToRemove, nicBackToRemove, setNicBackToRemove,
  editDocUrls = {},
  profilePhotoPreview, profilePhotoToRemove, setProfilePhotoFile, setProfilePhotoPreview, setProfilePhotoToRemove,
  editingHasProfilePhoto = false,
  createPending, updatePending, closeModal,
  onSubmit, handleSubmit, onInvalid,
}) {
  const [activeTab, setActiveTab] = useState('account')

  const tabs = [
    { id: 'account', label: 'Account', icon: FiKey, hasError: Boolean(errors.name || errors.email || errors.role) },
    { id: 'personal', label: 'Personal', icon: FiUser, hasError: false },
    { id: 'employment', label: 'Employment', icon: FiBriefcase, hasError: Boolean(errors.department || errors.designation || errors.joinedDate) },
    { id: 'documents', label: 'Documents', icon: FiFile, hasError: false },
    { id: 'finance', label: 'Bank & Salary', icon: FiDollarSign, hasError: false },
  ]

  const currentTabIdx = tabs.findIndex(t => t.id === activeTab)

  const goNext = () => {
    if (currentTabIdx < tabs.length - 1) setActiveTab(tabs[currentTabIdx + 1].id)
  }

  const goPrev = () => {
    if (currentTabIdx > 0) setActiveTab(tabs[currentTabIdx - 1].id)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex flex-col min-h-[500px]">
      {/* ── Form Navigation Tabs Bar ── */}
      <div className="bg-slate-100/80 p-2 border-b border-slate-200 sticky top-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
          {tabs.map((t, idx) => {
            const Icon = t.icon
            const isActive = activeTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 relative ${
                  isActive
                    ? 'bg-white text-blue-700 shadow-sm border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                <span>{idx + 1}. {t.label}</span>
                {t.hasError && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" title="Has missing required fields" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tab Contents Container ── */}
      <div className="p-6 space-y-6 flex-1">
        {/* TAB 1: ACCOUNT */}
        {activeTab === 'account' && (
          <div className="space-y-6 animate-fade-in">
            {!editing && (
              <FormSection title="Account Setup" icon={FiKey}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Full Name *</label>
                    <input {...register('name', { required: true })} className="form-input focus:ring-2 focus:ring-blue-500/20" placeholder="e.g. Dilum Vishvajith" />
                    <FieldError message={errors.name ? 'Full name is required' : ''} />
                  </div>
                  <div>
                    <label className="form-label">Email Address *</label>
                    <input {...register('email', { required: true })} type="email" className="form-input focus:ring-2 focus:ring-blue-500/20" placeholder="dilum@raxwo.com" />
                    <FieldError message={errors.email ? 'Valid email address is required' : ''} />
                  </div>
                  <div>
                    <label className="form-label">Password (optional)</label>
                    <input {...register('password')} type="password" className="form-input" placeholder="Default: Raxwo@2026" />
                    <p className="text-[10px] text-slate-400 mt-1">Leave empty to auto-assign default password.</p>
                  </div>
                  <div>
                    <label className="form-label">System Role *</label>
                    <select {...register('role', { required: true })} className="form-select font-semibold">
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                </div>
              </FormSection>
            )}

            {editing && (
              <FormSection title="Account Credentials" icon={FiKey}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">Full Name *</label>
                    <input {...register('name', { required: true })} className="form-input" placeholder="Employee full name" />
                  </div>
                  <div>
                    <label className="form-label">Email Address *</label>
                    <input {...register('email', { required: true })} type="email" className="form-input" placeholder="email@raxwo.com" />
                  </div>
                  <div>
                    <label className="form-label">System Role</label>
                    <select {...register('role')} className="form-select font-semibold">
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                </div>
                <EmployeePasswordPanel employeeId={editing._id} email={editing.userId?.email} />
              </FormSection>
            )}

            <FormSection title="Profile Picture" icon={FiUser}>
              <div className="flex items-center gap-5 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                {profilePhotoPreview ? (
                  <img src={profilePhotoPreview} alt="" className="w-20 h-20 rounded-2xl object-cover border-2 border-blue-500 shadow-md shrink-0" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-blue-50 border-2 border-dashed border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                    <FiUser size={32} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-slate-800">Upload Profile Photo</p>
                  <p className="text-[11px] text-slate-500">Supports JPG, PNG (Max 5MB). Professional headshot recommended.</p>
                  <div className="flex items-center gap-3 pt-1">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold border border-blue-200 transition-colors">
                      <FiUpload size={13} /> Select Image
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        if (f.size > 5e6) { toast.error('Max file size 5MB'); return }
                        setProfilePhotoFile(f)
                        setProfilePhotoPreview(URL.createObjectURL(f))
                        setProfilePhotoToRemove(false)
                      }} />
                    </label>
                    {(profilePhotoPreview || (editing && editingHasProfilePhoto && !profilePhotoToRemove)) && (
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline font-bold"
                        onClick={() => {
                          setProfilePhotoFile(null)
                          setProfilePhotoPreview(null)
                          if (editing) setProfilePhotoToRemove(true)
                        }}
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                  {profilePhotoToRemove && (
                    <p className="text-[11px] font-bold text-amber-700">Photo will be removed when saved.</p>
                  )}
                </div>
              </div>
            </FormSection>
          </div>
        )}

        {/* TAB 2: PERSONAL & CONTACT */}
        {activeTab === 'personal' && (
          <div className="space-y-6 animate-fade-in">
            <FormSection title="Personal Information" icon={FiUser}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Identity Type</label>
                  <select {...register('idType')} className="form-select font-semibold">
                    <option value="nic">National ID (NIC)</option>
                    <option value="driving_license">Driving License</option>
                    <option value="passport">Passport</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">ID Number</label>
                  <input {...register('idNumber')} className="form-input font-mono" placeholder="e.g. 199812345678" />
                </div>
                <div>
                  <label className="form-label">Date of Birth</label>
                  <input {...register('dob')} type="date" className="form-input" />
                </div>
                <div>
                  <label className="form-label">Gender</label>
                  <select {...register('gender')} className="form-select font-semibold">
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Primary Phone</label>
                  <input {...register('primaryPhone')} className="form-input" placeholder="+94 77 123 4567" />
                </div>
                <div>
                  <label className="form-label">Secondary Phone</label>
                  <input {...register('secondaryPhone')} className="form-input" placeholder="+94 11 234 5678" />
                </div>
              </div>

              <div>
                <label className="form-label">Portfolio / LinkedIn Profile URL</label>
                <div className="relative">
                  <FiLink size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input {...register('portfolioUrl')} className="form-input !pl-10" placeholder="https://linkedin.com/in/username" />
                </div>
              </div>

              <div>
                <label className="form-label">Permanent Address</label>
                <textarea {...register('address')} rows={2} className="form-input resize-none" placeholder="Residential street address, city..." />
              </div>
            </FormSection>

            <FormSection title="Emergency Contacts" icon={FiPhone}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Contact Name</label>
                  <input {...register('emergencyContactName')} className="form-input" placeholder="e.g. Parent / Spouse Name" />
                </div>
                <div>
                  <label className="form-label">Contact Phone</label>
                  <input {...register('emergencyContactPhone')} className="form-input" placeholder="+94 71..." />
                </div>
                <div>
                  <label className="form-label">Relationship</label>
                  <select {...register('emergencyContactRelationship')} className="form-select font-semibold">
                    <option value="">Select relationship...</option>
                    {['Parent','Spouse','Sibling','Child','Relative','Friend','Guardian','Other'].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            </FormSection>
          </div>
        )}

        {/* TAB 3: EMPLOYMENT */}
        {activeTab === 'employment' && (
          <div className="space-y-6 animate-fade-in">
            <FormSection title="Employment Position & Hierarchy" icon={FiBriefcase}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Department *</label>
                  <select {...register('department', { required: true })} className="form-select font-bold">
                    <option value="">Select Department...</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <FieldError message={errors.department ? 'Department is required' : ''} />
                </div>
                <div>
                  <label className="form-label">Designation / Title *</label>
                  <input {...register('designation', { required: true })} className="form-input font-bold" placeholder="e.g. Senior Software Engineer" />
                  <FieldError message={errors.designation ? 'Designation is required' : ''} />
                </div>
                <div>
                  <label className="form-label">Employment Type</label>
                  <select {...register('employmentType')} className="form-select font-semibold">
                    <option value="permanent">Permanent Staff</option>
                    <option value="intern">Intern</option>
                    <option value="contract">Contract</option>
                    <option value="part_time">Part Time</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Branch Office</label>
                  <select {...register('branch')} className="form-select font-semibold">
                    <option value="">Select Branch...</option>
                    {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                  </select>
                </div>

                <div className="sm:col-span-2 bg-blue-50/60 p-4 rounded-2xl border border-blue-100">
                  <SearchableLeaderSelect managers={managers} value={watchedManager} onChange={(val) => setValue ? setValue('manager', val) : null} />
                </div>

                <div>
                  <label className="form-label">Join Date *</label>
                  <input {...register('joinedDate', { required: !editing })} type="date" className="form-input font-semibold" />
                  <FieldError message={errors.joinedDate ? 'Join date is required' : ''} />
                </div>

                {editing && (
                  <div>
                    <label className="form-label">Employment Status</label>
                    <select {...register('status')} className="form-select font-bold">
                      {EMPLOYEE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {watchedType === 'intern' && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 space-y-3">
                  <p className="text-xs font-extrabold text-amber-800 uppercase tracking-wider">🎓 Internship Details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className="form-label text-xs">Start Date</label><input {...register('internship.startDate')} type="date" className="form-input" /></div>
                    <div><label className="form-label text-xs">End Date</label><input {...register('internship.endDate')} type="date" className="form-input" /></div>
                    <div><label className="form-label text-xs">Duration (Weeks)</label><input {...register('internship.durationWeeks', { valueAsNumber: true })} type="number" className="form-input" /></div>
                    <div><label className="form-label text-xs">University / Institute</label><input {...register('internship.university')} className="form-input" placeholder="e.g. SLIIT / IIT" /></div>
                  </div>
                  <div><label className="form-label text-xs">Academic Supervisor</label><input {...register('internship.supervisorName')} className="form-input" /></div>
                </div>
              )}

              {watchedType === 'contract' && (
                <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200/80 space-y-3">
                  <p className="text-xs font-extrabold text-purple-800 uppercase tracking-wider">📜 Contract Period</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className="form-label text-xs">Contract Start</label><input {...register('contract.startDate')} type="date" className="form-input" /></div>
                    <div><label className="form-label text-xs">Contract End</label><input {...register('contract.endDate')} type="date" className="form-input" /></div>
                  </div>
                </div>
              )}

              {editing && watchedStatus === 'resigned' && (
                <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="form-label text-xs">Resignation Date</label><input {...register('resignationDate')} type="date" className="form-input" /></div>
                  <div><label className="form-label text-xs">Resignation Reason</label><input {...register('resignationReason')} className="form-input" /></div>
                </div>
              )}
            </FormSection>
          </div>
        )}

        {/* TAB 4: DOCUMENTS */}
        {activeTab === 'documents' && (
          <div className="space-y-6 animate-fade-in">
            <FormSection title="Employee Documents & Attachments" icon={FiFile}>
              <div className="space-y-4">
                <FileUploadField
                  label="CV / Resume Document" accept=".pdf" hint="PDF format (Max 5MB)" file={cvFile} setFile={setCvFile}
                  existingUrl={cvToRemove ? '' : editDocUrls.cvUrl} markedForRemoval={cvToRemove}
                  onRemove={editing ? () => setCvToRemove(true) : undefined}
                  onClearRemoval={editing ? () => setCvToRemove(false) : undefined}
                />
                <FileUploadField
                  label="Signed Agreement Document" accept=".pdf" hint="PDF format (Max 5MB)" file={agreementFile} setFile={setAgreementFile}
                  existingUrl={agreementToRemove ? '' : editDocUrls.agreementUrl} markedForRemoval={agreementToRemove}
                  onRemove={editing ? () => setAgreementToRemove(true) : undefined}
                  onClearRemoval={editing ? () => setAgreementToRemove(false) : undefined}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FileUploadField
                    label="NIC / Passport Front" accept=".pdf,image/*" file={nicFile} setFile={setNicFile}
                    existingUrl={nicToRemove ? '' : editDocUrls.nicPhotoUrl} icon={FiUpload} markedForRemoval={nicToRemove}
                    onRemove={editing ? () => setNicToRemove(true) : undefined}
                    onClearRemoval={editing ? () => setNicToRemove(false) : undefined}
                  />
                  <FileUploadField
                    label="NIC Back Photo" accept=".pdf,image/*" file={nicBackFile} setFile={setNicBackFile}
                    existingUrl={nicBackToRemove ? '' : editDocUrls.nicPhotoBackUrl} icon={FiUpload} markedForRemoval={nicBackToRemove}
                    onRemove={editing ? () => setNicBackToRemove(true) : undefined}
                    onClearRemoval={editing ? () => setNicBackToRemove(false) : undefined}
                  />
                </div>
              </div>
            </FormSection>
          </div>
        )}

        {/* TAB 5: BANK & SALARY */}
        {activeTab === 'finance' && (
          <div className="space-y-6 animate-fade-in">
            <FormSection title="Bank Account Details" icon={FiCreditCard}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Bank Name</label>
                  <input {...register('bank')} className="form-input font-medium" placeholder="e.g. Commercial Bank of Ceylon" />
                </div>
                <div>
                  <label className="form-label">Branch Name</label>
                  <input {...register('bankBranch')} className="form-input font-medium" placeholder="e.g. Colombo Fort Branch" />
                </div>
                <div>
                  <label className="form-label">Account Holder Name</label>
                  <input {...register('accountHolder')} className="form-input font-medium" placeholder="e.g. D V Perera" />
                </div>
                <div>
                  <label className="form-label">Account Number</label>
                  <input {...register('accountNumber')} className="form-input font-mono font-bold" placeholder="e.g. 8001234567" />
                </div>
                <div>
                  <label className="form-label">Account Type</label>
                  <select {...register('accountType')} className="form-select font-semibold">
                    <option value="savings">Savings Account</option>
                    <option value="current">Current Account</option>
                  </select>
                </div>
              </div>
            </FormSection>

            <FormSection title="Salary & Statutory Details" icon={FiDollarSign}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Basic Salary (LKR)</label>
                  <input {...register('basicSalary', { valueAsNumber: true })} type="number" className="form-input font-bold text-slate-800" placeholder="0" />
                </div>
                {editing ? (
                  <div>
                    <label className="form-label">Monthly Allowances (LKR)</label>
                    <p className="form-input bg-slate-100 text-slate-700 font-bold cursor-default">
                      LKR {(editing.allowances ?? 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">Allowances are managed dynamically in Payroll.</p>
                  </div>
                ) : (
                  <div>
                    <label className="form-label">Allowances (LKR)</label>
                    <input {...register('allowances', { valueAsNumber: true })} type="number" className="form-input font-bold" placeholder="0" />
                  </div>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" {...register('epfEtfEnrolled')} className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
                  <span className="text-sm font-bold text-emerald-900">{watchedEpfEnrolled ? '✓ EPF / ETF Enrolled' : 'Not Enrolled in EPF/ETF'}</span>
                </label>
                {watchedEpfEnrolled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-emerald-200/60">
                    <div><label className="form-label text-xs">EPF Member Number</label><input {...register('epfNumber')} className="form-input font-mono font-bold" placeholder="e.g. EPF-10293" /></div>
                    <div><label className="form-label text-xs">ETF Member Number</label><input {...register('etfNumber')} className="form-input font-mono font-bold" placeholder="e.g. ETF-10293" /></div>
                  </div>
                )}
              </div>
            </FormSection>
          </div>
        )}
      </div>

      {/* ── Sticky Form Footer ── */}
      <div className="p-4 px-6 border-t border-slate-200 bg-white sticky bottom-0 z-20 flex items-center justify-between gap-3 shadow-lg">
        <button type="button" onClick={closeModal} className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
          Cancel
        </button>

        <div className="flex items-center gap-3">
          {currentTabIdx > 0 && (
            <button
              type="button"
              onClick={goPrev}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
            >
              ← Previous Step
            </button>
          )}

          {currentTabIdx < tabs.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
            >
              Next Step →
            </button>
          ) : (
            <button
              type="submit"
              disabled={createPending || updatePending}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-colors cursor-pointer"
            >
              {createPending || updatePending ? <span className="spinner" /> : editing ? 'Save Changes' : 'Create Employee'}
            </button>
          )}
        </div>
      </div>
    </form>
  )
}


