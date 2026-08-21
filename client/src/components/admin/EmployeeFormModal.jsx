import { useRef } from 'react'
import toast from 'react-hot-toast'
import {
  FiUser, FiKey, FiBriefcase, FiDollarSign, FiPhone, FiUpload, FiFile, FiLink, FiTrash2, FiCreditCard,
} from 'react-icons/fi'
import { DEPARTMENTS, ROLES, EMPLOYEE_STATUSES } from '../../constants/employeeStatus'
import { mediaUrl } from '../../lib/media'
import EmployeePasswordPanel from './EmployeePasswordPanel'

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
  editing, branches, managers = [], register, errors,
  watchedType, watchedStatus, watchedEpfEnrolled,
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
  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="p-6 space-y-5">
      {!editing && (
        <FormSection title="Account" icon={FiKey}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="form-label">Full Name *</label><input {...register('name', { required: true })} className="form-input" placeholder="Full name" /></div>
            <div><label className="form-label">Email *</label><input {...register('email', { required: true })} type="email" className="form-input" placeholder="email@raxwo.com" /></div>
            <div><label className="form-label">Password (optional)</label><input {...register('password')} type="password" className="form-input" placeholder="Default: Raxwo@2026" /></div>
            <div><label className="form-label">Role *</label><select {...register('role', { required: true })} className="form-select">{ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
          </div>
        </FormSection>
      )}

      {editing && (
        <FormSection title="Account" icon={FiKey}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Full Name *</label>
              <input {...register('name', { required: true })} className="form-input" placeholder="Employee full name" />
            </div>
            <div>
              <label className="form-label">Role</label>
              <select {...register('role')} className="form-select">{ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
            </div>
          </div>
          <p className="text-xs text-slate-500">Login email: <span className="font-medium text-slate-700">{editing.userId?.email}</span></p>
          <EmployeePasswordPanel employeeId={editing._id} email={editing.userId?.email} />
        </FormSection>
      )}

      <FormSection title="Personal" icon={FiUser}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="form-label">Identity type</label><select {...register('idType')} className="form-select"><option value="nic">NIC</option><option value="driving_license">Driving License</option><option value="passport">Passport</option></select></div>
          <div><label className="form-label">ID number</label><input {...register('idNumber')} className="form-input" /></div>
          <div><label className="form-label">Birth date</label><input {...register('dob')} type="date" className="form-input" /></div>
          <div><label className="form-label">Gender</label><select {...register('gender')} className="form-select"><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
          <div><label className="form-label">Primary phone</label><input {...register('primaryPhone')} className="form-input" placeholder="+94..." /></div>
          <div><label className="form-label">Secondary phone</label><input {...register('secondaryPhone')} className="form-input" /></div>
        </div>
        <div><label className="form-label">Portfolio / LinkedIn</label><div className="relative"><FiLink size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input {...register('portfolioUrl')} className="form-input !pl-10" placeholder="https://..." /></div></div>
        <div className="flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-100">
          {profilePhotoPreview ? <img src={profilePhotoPreview} alt="" className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md" /> : <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center text-secondary"><FiUser size={28} /></div>}
          <div>
            <p className="text-sm font-semibold text-slate-700">Profile photo</p>
            <label className="mt-2 cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-secondary/10 text-secondary rounded-lg text-xs font-medium">
              <FiUpload size={12} /> Upload
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                if (f.size > 5e6) { toast.error('Max 5MB'); return }
                setProfilePhotoFile(f)
                setProfilePhotoPreview(URL.createObjectURL(f))
                setProfilePhotoToRemove(false)
              }} />
            </label>
            {(profilePhotoPreview || (editing && editingHasProfilePhoto && !profilePhotoToRemove)) && (
              <button
                type="button"
                className="ml-2 text-xs text-red-500 hover:text-red-600 font-medium"
                onClick={() => {
                  setProfilePhotoFile(null)
                  setProfilePhotoPreview(null)
                  if (editing) setProfilePhotoToRemove(true)
                }}
              >
                Remove photo
              </button>
            )}
            {profilePhotoToRemove && (
              <p className="text-xs text-amber-700 mt-1">Photo will be removed when you save</p>
            )}
          </div>
        </div>
        <div><label className="form-label">Address</label><textarea {...register('address')} rows={2} className="form-input" /></div>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase">Documents</p>
          <FileUploadField
            label="CV / Resume" accept=".pdf" hint="PDF" file={cvFile} setFile={setCvFile}
            existingUrl={cvToRemove ? '' : editDocUrls.cvUrl} markedForRemoval={cvToRemove}
            onRemove={editing ? () => setCvToRemove(true) : undefined}
            onClearRemoval={editing ? () => setCvToRemove(false) : undefined}
          />
          <FileUploadField
            label="Agreement" accept=".pdf" hint="PDF" file={agreementFile} setFile={setAgreementFile}
            existingUrl={agreementToRemove ? '' : editDocUrls.agreementUrl} markedForRemoval={agreementToRemove}
            onRemove={editing ? () => setAgreementToRemove(true) : undefined}
            onClearRemoval={editing ? () => setAgreementToRemove(false) : undefined}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FileUploadField
              label="NIC front" accept=".pdf,image/*" file={nicFile} setFile={setNicFile}
              existingUrl={nicToRemove ? '' : editDocUrls.nicPhotoUrl} icon={FiUpload} markedForRemoval={nicToRemove}
              onRemove={editing ? () => setNicToRemove(true) : undefined}
              onClearRemoval={editing ? () => setNicToRemove(false) : undefined}
            />
            <FileUploadField
              label="NIC back" accept=".pdf,image/*" file={nicBackFile} setFile={setNicBackFile}
              existingUrl={nicBackToRemove ? '' : editDocUrls.nicPhotoBackUrl} icon={FiUpload} markedForRemoval={nicBackToRemove}
              onRemove={editing ? () => setNicBackToRemove(true) : undefined}
              onClearRemoval={editing ? () => setNicBackToRemove(false) : undefined}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Emergency contacts" icon={FiPhone}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className="form-label">Name</label><input {...register('emergencyContactName')} className="form-input" /></div>
          <div><label className="form-label">Phone</label><input {...register('emergencyContactPhone')} className="form-input" /></div>
          <div><label className="form-label">Relationship</label><select {...register('emergencyContactRelationship')} className="form-select"><option value="">Select...</option>{['Parent','Spouse','Sibling','Child','Relative','Friend','Guardian','Other'].map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
        </div>
      </FormSection>

      <FormSection title="Employment" icon={FiBriefcase}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="form-label">Department *</label><select {...register('department', { required: true })} className="form-select"><option value="">Select...</option>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select><FieldError message={errors.department ? 'Required' : ''} /></div>
          <div><label className="form-label">Designation *</label><input {...register('designation', { required: true })} className="form-input" placeholder="e.g. Senior Developer" /><FieldError message={errors.designation ? 'Required' : ''} /></div>
          <div><label className="form-label">Employment type</label><select {...register('employmentType')} className="form-select"><option value="permanent">Permanent</option><option value="intern">Intern</option><option value="contract">Contract</option><option value="part_time">Part Time</option></select></div>
          <div><label className="form-label">Branch</label><select {...register('branch')} className="form-select"><option value="">Select branch</option>{branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select></div>
          <div><label className="form-label">Reporting Leader / Manager</label><select {...register('manager')} className="form-select"><option value="">Select leader (None / Independent)</option>{managers.map((m) => (<option key={m._id || m.userId?._id} value={m.userId?._id || m._id}>{m.name || m.userId?.name} ({m.role || m.userId?.role || 'Leader'})</option>))}</select></div>
          <div><label className="form-label">Join date *</label><input {...register('joinedDate', { required: !editing })} type="date" className="form-input" /><FieldError message={errors.joinedDate ? 'Required' : ''} /></div>
          {editing && <div><label className="form-label">Status</label><select {...register('status')} className="form-select">{EMPLOYEE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>}
        </div>
        {watchedType === 'intern' && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
            <p className="text-xs font-bold text-amber-700 uppercase">Internship</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="form-label text-xs">Start</label><input {...register('internship.startDate')} type="date" className="form-input" /></div>
              <div><label className="form-label text-xs">End</label><input {...register('internship.endDate')} type="date" className="form-input" /></div>
              <div><label className="form-label text-xs">Weeks</label><input {...register('internship.durationWeeks', { valueAsNumber: true })} type="number" className="form-input" /></div>
              <div><label className="form-label text-xs">University</label><input {...register('internship.university')} className="form-input" /></div>
            </div>
            <div><label className="form-label text-xs">Supervisor</label><input {...register('internship.supervisorName')} className="form-input" /></div>
          </div>
        )}
        {watchedType === 'contract' && (
          <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 space-y-3">
            <p className="text-xs font-bold text-purple-700 uppercase">Contract</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="form-label text-xs">Start</label><input {...register('contract.startDate')} type="date" className="form-input" /></div>
              <div><label className="form-label text-xs">End</label><input {...register('contract.endDate')} type="date" className="form-input" /></div>
            </div>
          </div>
        )}
        {editing && watchedStatus === 'resigned' && (
          <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="form-label text-xs">Resignation date</label><input {...register('resignationDate')} type="date" className="form-input" /></div>
            <div><label className="form-label text-xs">Reason</label><input {...register('resignationReason')} className="form-input" /></div>
          </div>
        )}
      </FormSection>

      <FormSection title="Bank Details" icon={FiCreditCard}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="form-label">Bank Name</label><input {...register('bank')} className="form-input" placeholder="e.g. Commercial Bank" /></div>
          <div><label className="form-label">Branch</label><input {...register('bankBranch')} className="form-input" placeholder="e.g. Colombo 03" /></div>
          <div><label className="form-label">Account Name</label><input {...register('accountHolder')} className="form-input" placeholder="e.g. John Doe" /></div>
          <div><label className="form-label">Account Number</label><input {...register('accountNumber')} className="form-input" placeholder="e.g. 100020003000" /></div>
          <div><label className="form-label">Account Type</label>
            <select {...register('accountType')} className="form-select">
              <option value="savings">Savings</option>
              <option value="current">Current</option>
            </select>
          </div>
        </div>
      </FormSection>

      <FormSection title="Salary & statutory" icon={FiDollarSign}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="form-label">Basic salary (LKR)</label><input {...register('basicSalary', { valueAsNumber: true })} type="number" className="form-input" /></div>
          {editing ? (
            <div>
              <label className="form-label">Allowances (LKR)</label>
              <p className="form-input bg-slate-50 text-slate-700 cursor-default">
                {(editing.allowances ?? 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-400 mt-1">Allowances are managed in payroll, not here.</p>
            </div>
          ) : (
            <div><label className="form-label">Allowances (LKR)</label><input {...register('allowances', { valueAsNumber: true })} type="number" className="form-input" /></div>
          )}
        </div>
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('epfEtfEnrolled')} className="w-4 h-4" />
            <span className="text-sm font-semibold text-emerald-800">{watchedEpfEnrolled ? 'EPF/ETF enrolled' : 'Not enrolled'}</span>
          </label>
          {watchedEpfEnrolled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div><label className="form-label text-xs">EPF</label><input {...register('epfNumber')} className="form-input" /></div>
              <div><label className="form-label text-xs">ETF</label><input {...register('etfNumber')} className="form-input" /></div>
            </div>
          )}
        </div>
      </FormSection>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={closeModal} className="btn-ghost flex-1 justify-center">Cancel</button>
        <button type="submit" disabled={createPending || updatePending} className="btn-primary flex-1 justify-center">
          {createPending || updatePending ? <span className="spinner" /> : editing ? 'Save changes' : 'Create employee'}
        </button>
      </div>
    </form>
  )
}


