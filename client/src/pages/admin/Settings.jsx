import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'
import { FiSave, FiLock, FiUser } from 'react-icons/fi'
import { useState } from 'react'
import { mediaUrl } from '../../lib/media'
import UserAvatar from '../../components/ui/UserAvatar'
import { applySiteFavicon } from '../../lib/siteFavicon'
import { invalidateSiteBranding, SITE_SETTINGS_QUERY_KEY } from '../../hooks/useSiteBranding'
import LetterheadPreview from '../../components/branding/LetterheadPreview'
import { compressImageFile } from '../../lib/imageOptimizer'

export default function AdminSettings() {
  const { user, updateUser, refreshSession } = useAuthStore()
  const qc = useQueryClient()
  const [avatarFile, setAvatarFile] = useState(null)
  const [logoFile, setLogoFile] = useState(null)
  const [sealFile, setSealFile] = useState(null)
  const [sigFiles, setSigFiles] = useState({ hr: null, admin: null, manager: null })
  const [avatarToRemove, setAvatarToRemove] = useState(false)
  const [logoToRemove, setLogoToRemove] = useState(false)
  const [sealToRemove, setSealToRemove] = useState(false)

  const { register: reg1, handleSubmit: hs1, formState: { isSubmitting: isSubmittingProfile } } = useForm({
    values: { name: user?.name, phone: user?.phone }
  })
  const { register: reg2, handleSubmit: hs2, reset: reset2 } = useForm()

  const profileMut = useMutation({
    mutationFn: d => api.put('/auth/profile', d).then(r => r.data),
    onSuccess: async (r) => {
      updateUser(r.user)
      setAvatarFile(null)
      setAvatarToRemove(false)
      await refreshSession()
      toast.success('Profile updated')
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })
  const uploadImage = (file) => {
    if (!file) return Promise.resolve('')
    return compressImageFile(file, { maxWidth: 480, maxHeight: 480, quality: 0.85 })
  }
  const passMut = useMutation({
    mutationFn: d => api.put('/auth/change-password', d),
    onSuccess: () => { reset2(); toast.success('Password changed') },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })

  const { data: siteData } = useQuery({
    queryKey: SITE_SETTINGS_QUERY_KEY,
    queryFn: () => api.get('/site-settings').then((r) => r.data),
  })
  const { register: reg3, handleSubmit: hs3, setValue: setSiteValue, watch: watchSite, formState: { isSubmitting: isSubmittingSite } } = useForm({
    values: {
      siteName: siteData?.settings?.siteName || '',
      siteDescription: siteData?.settings?.siteDescription || '',
      logoUrl: siteData?.settings?.logoUrl || '',
      footerText: siteData?.settings?.footerText || '',
      contactEmail: siteData?.settings?.contactEmail || '',
      contactPhone: siteData?.settings?.contactPhone || '',
      contactAddress: siteData?.settings?.contactAddress || '',
      branchDetails: siteData?.settings?.branchDetails || '',
      adminEmail: siteData?.settings?.adminEmail || '',
      whatsappNumber: siteData?.settings?.whatsappNumber || '',
      websiteUrl: siteData?.settings?.websiteUrl || '',
      sealUrl: siteData?.settings?.sealUrl || '',
      signatures: {
        hr: { url: siteData?.settings?.signatures?.hr?.url || '', label: siteData?.settings?.signatures?.hr?.label || 'HR' },
        admin: { url: siteData?.settings?.signatures?.admin?.url || '', label: siteData?.settings?.signatures?.admin?.label || 'Admin' },
        manager: { url: siteData?.settings?.signatures?.manager?.url || '', label: siteData?.settings?.signatures?.manager?.label || 'Manager' },
        director: { url: siteData?.settings?.signatures?.director?.url || '', label: siteData?.settings?.signatures?.director?.label || 'Director' },
        marketing: { url: siteData?.settings?.signatures?.marketing?.url || '', label: siteData?.settings?.signatures?.marketing?.label || 'Marketing' },
      },
      quotationThankYouMessage: siteData?.settings?.quotationThankYouMessage || '',
      quotationNotesTemplate: siteData?.settings?.quotationNotesTemplate || '',
      quotationTermsTemplate: siteData?.settings?.quotationTermsTemplate || '',
      quotationDirectorName: siteData?.settings?.quotationDirectorName || '',
      quotationDirectorRole: siteData?.settings?.quotationDirectorRole || '',
      quotationLayoutFontSizePt: siteData?.settings?.quotationLayoutFontSizePt ?? 11,
      quotationLayoutLineHeight: siteData?.settings?.quotationLayoutLineHeight ?? 1.5,
      quotationLayoutPagePaddingMm: siteData?.settings?.quotationLayoutPagePaddingMm ?? 14,
      quotationLayoutHeaderSpacingPx: siteData?.settings?.quotationLayoutHeaderSpacingPx ?? 24,
      quotationLayoutFooterSpacingPx: siteData?.settings?.quotationLayoutFooterSpacingPx ?? 32,
      quotationLayoutTableCellPaddingPx: siteData?.settings?.quotationLayoutTableCellPaddingPx ?? 10,
      quotationLayoutShowDocumentFrame: siteData?.settings?.quotationLayoutShowDocumentFrame ?? true,
      quotationLayoutShowRefOnDocument: siteData?.settings?.quotationLayoutShowRefOnDocument ?? true,
      mapLat: siteData?.settings?.mapLat ?? 7.0289,
      mapLng: siteData?.settings?.mapLng ?? 80.0153,
      mapZoom: siteData?.settings?.mapZoom ?? 13,
      epfEmployerRate: siteData?.settings?.epfEmployerRate ?? 12,
      etfEmployerRate: siteData?.settings?.etfEmployerRate ?? 3,
      smsEnabled: siteData?.settings?.smsEnabled ?? true,
      smsModules: {
        payroll: siteData?.settings?.smsModules?.payroll ?? true,
        leave: siteData?.settings?.smsModules?.leave ?? true,
        project: siteData?.settings?.smsModules?.project ?? true,
        hr: siteData?.settings?.smsModules?.hr ?? true,
        financial: siteData?.settings?.smsModules?.financial ?? true,
        system: siteData?.settings?.smsModules?.system ?? true,
      },
      messageAutoDeleteDays: siteData?.settings?.messageAutoDeleteDays ?? 0,
    },
  })

  const siteMut = useMutation({
    mutationFn: (d) => api.put('/site-settings', d).then((r) => r.data),
    onSuccess: (data, variables) => {
      toast.success('Site settings updated')
      setLogoFile(null)
      setLogoToRemove(false)
      qc.setQueryData(SITE_SETTINGS_QUERY_KEY, data)
      const savedLogo = (data?.settings?.logoUrl ?? variables?.logoUrl ?? '').trim()
      const v = data?.settings?.updatedAt
        ? new Date(data.settings.updatedAt).getTime()
        : Date.now()
      applySiteFavicon(savedLogo, v)
      invalidateSiteBranding(qc)
      qc.invalidateQueries({ queryKey: ['epf-records'] })
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account and system preferences</p>
        </div>
      </div>

      {/* Profile */}
      <div className="card card-body">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
            <FiUser className="text-secondary" size={18}/>
          </div>
          <div>
            <h3 className="font-bold text-primary font-heading">Profile Information</h3>
            <p className="text-xs text-gray-400">Update your name and phone number</p>
          </div>
        </div>

        <form onSubmit={hs1(async (d) => {
          try {
            let avatar = user?.avatar || ''
            if (avatarToRemove) avatar = ''
            if (avatarFile) {
              const uploaded = await uploadImage(avatarFile)
              if (uploaded) avatar = uploaded
            }
            profileMut.mutate({ ...d, avatar })
          } catch (e) {
            toast.error(e.message)
          }
        })} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Full Name</label>
              <input {...reg1('name')} className="form-input"/>
            </div>
            <div>
              <label className="form-label">Phone</label>
              <input {...reg1('phone')} placeholder="+94 77 xxx xxxx" className="form-input"/>
            </div>
          </div>
          <div>
            <label className="form-label">Email</label>
            <input value={user?.email} disabled className="form-input bg-gray-50 text-gray-400 cursor-not-allowed"/>
          </div>
          <div>
            <label className="form-label">Role</label>
            <input value={user?.role} disabled className="form-input bg-gray-50 text-gray-400 cursor-not-allowed capitalize"/>
          </div>
          <div className="flex flex-col gap-2">
            <label className="form-label">Profile Picture</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
                {avatarFile ? (
                  <img src={URL.createObjectURL(avatarFile)} alt="Preview" className="w-full h-full object-cover" />
                ) : !avatarToRemove && user?.avatar ? (
                  <UserAvatar user={user} className="w-full h-full rounded-full" imgClassName="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400"><FiUser size={30} /></div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input type="file" accept="image/*" className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-secondary/10 file:text-secondary hover:file:bg-secondary/20 transition-all cursor-pointer" 
                  onChange={(e) => {
                    setAvatarFile(e.target.files?.[0] || null)
                    setAvatarToRemove(false)
                  }} 
                />
                {((!avatarToRemove && user?.avatar) || avatarFile) && (
                  <button type="button" onClick={() => { 
                    if (window.confirm('Are you sure you want to remove your profile picture?')) {
                      setAvatarToRemove(true); 
                      setAvatarFile(null);
                    }
                  }} className="text-xs text-red-500 hover:text-red-600 font-medium w-fit">Remove Picture</button>
                )}
              </div>
            </div>
          </div>
          <button type="submit" disabled={profileMut.isPending || isSubmittingProfile} className="btn-primary">
            {profileMut.isPending || isSubmittingProfile ? <span className="spinner"/> : <><FiSave size={15}/> Save Profile</>}
          </button>
        </form>
      </div>

      <div className="card card-body">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <FiSave className="text-blue-500" size={18}/>
          </div>
          <div>
            <h3 className="font-bold text-primary font-heading">Database Backup</h3>
            <p className="text-xs text-gray-400">Download a full JSON backup of your entire system database</p>
          </div>
        </div>
        <button 
          type="button"
          onClick={async () => {
            try {
              const res = await api.get('/site-settings/download-db', { responseType: 'blob' });
              const url = window.URL.createObjectURL(new Blob([res.data]));
              const link = document.createElement('a');
              link.href = url;
              link.setAttribute('download', 'raxwo_db_backup.json');
              document.body.appendChild(link);
              link.click();
              link.remove();
              toast.success('Database backup downloaded successfully');
            } catch (err) {
              toast.error('Failed to download database backup');
            }
          }} 
          className="btn-primary"
        >
          Download Database JSON
        </button>
      </div>

      {/* Change Password */}
      <div className="card card-body">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <FiLock className="text-red-500" size={18}/>
          </div>
          <div>
            <h3 className="font-bold text-primary font-heading">Change Password</h3>
            <p className="text-xs text-gray-400">Choose a strong password with at least 6 characters</p>
          </div>
        </div>
        <form onSubmit={hs2(d => passMut.mutate(d))} className="space-y-4">
          <div>
            <label className="form-label">Current Password</label>
            <input {...reg2('currentPassword',{required:true})} type="password" placeholder="••••••••" className="form-input"/>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">New Password</label>
              <input {...reg2('newPassword',{required:true,minLength:{value:6,message:'Min 6 chars'}})} type="password" placeholder="••••••••" className="form-input"/>
            </div>
            <div>
              <label className="form-label">Confirm New Password</label>
              <input {...reg2('confirmPassword',{required:true})} type="password" placeholder="••••••••" className="form-input"/>
            </div>
          </div>
          <button type="submit" disabled={passMut.isPending} className="btn-danger">
            {passMut.isPending ? <span className="spinner"/> : <><FiLock size={15}/> Update Password</>}
          </button>
        </form>
      </div>

      {/* Letterhead & site branding — used on Agreements, Letters, invoices */}
      <div className="card card-body">
        <h3 className="font-bold text-primary font-heading mb-1">Letterhead & company details</h3>
        <p className="text-xs text-gray-500 mb-4">Logo, address, phone, and email appear in the header of Agreements and Letters when you print or export PDF.</p>
        <LetterheadPreview settings={{ ...(siteData?.settings || {}), ...watchSite() }} />
        <form onSubmit={hs3(async (d) => {
          try {
            let logoUrl = logoToRemove ? '' : (d.logoUrl || '').trim()
            if (logoFile) {
              const uploaded = await uploadImage(logoFile)
              if (uploaded) logoUrl = uploaded
            }
            let sealUrl = sealToRemove ? '' : (d.sealUrl || '').trim()
            if (sealFile) {
              const uploaded = await uploadImage(sealFile)
              if (uploaded) sealUrl = uploaded
            }
            const signatures = { ...(d.signatures || {}) }
            for (const key of ['director', 'admin', 'manager', 'hr', 'marketing']) {
              if (sigFiles[key]) {
                const uploaded = await uploadImage(sigFiles[key])
                if (uploaded) signatures[key] = { ...signatures[key], url: uploaded }
              }
            }
            siteMut.mutate({ ...d, logoUrl, sealUrl, signatures })
          } catch (e) {
            toast.error(e.message)
          }
        })} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="form-label">Site Name</label><input {...reg3('siteName')} className="form-input" /></div>
            <div><label className="form-label">Logo URL</label><input {...reg3('logoUrl')} className="form-input" /></div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="form-label">Site Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-24 h-12 rounded bg-gray-50 border border-gray-200 flex items-center justify-center p-1">
                {logoFile ? (
                  <img src={URL.createObjectURL(logoFile)} alt="Preview" className="max-h-full object-contain" />
                ) : (!logoToRemove && siteData?.settings?.logoUrl) ? (
                  <img src={mediaUrl(siteData.settings.logoUrl)} alt="Logo" className="max-h-full object-contain" />
                ) : (
                  <span className="text-[10px] text-gray-400">No Logo</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input type="file" accept="image/*" className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all cursor-pointer" 
                  onChange={(e) => {
                    setLogoFile(e.target.files?.[0] || null)
                    setLogoToRemove(false)
                  }} 
                />
                {((!logoToRemove && siteData?.settings?.logoUrl) || logoFile) && (
                  <button type="button" onClick={() => { 
                    if (window.confirm('Are you sure you want to remove the site logo?')) {
                      setLogoToRemove(true)
                      setLogoFile(null)
                      setSiteValue('logoUrl', '')
                    }
                  }} className="text-xs text-red-500 hover:text-red-600 font-medium w-fit">Remove Logo</button>
                )}
              </div>
            </div>
          </div>
          <div><label className="form-label">Description</label><textarea {...reg3('siteDescription')} className="form-input min-h-20" /></div>
          <div><label className="form-label">Footer Details</label><textarea {...reg3('footerText')} className="form-input min-h-20" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="form-label">General contact email (optional)</label><input {...reg3('contactEmail')} className="form-input" /></div>
            <div><label className="form-label">Telephone (letterhead)</label><input {...reg3('contactPhone')} className="form-input" /></div>
          </div>
          <div><label className="form-label">WhatsApp Number (Floating Button)</label><input {...reg3('whatsappNumber')} className="form-input" placeholder="e.g. 94771234567" /></div>
          <div><label className="form-label">Address (letterhead)</label><input {...reg3('contactAddress')} className="form-input" placeholder="Weliweriya, Sri Lanka" /></div>
          <div><label className="form-label">Email (letterhead — Agreements & Letters)</label><input {...reg3('adminEmail')} className="form-input" placeholder="notifications@company.com" /></div>
          <div><label className="form-label">Branch / location details</label><textarea {...reg3('branchDetails')} className="form-input min-h-16" /></div>
          <div><label className="form-label">Website URL</label><input {...reg3('websiteUrl')} className="form-input" placeholder="https://www.example.com" /></div>
          <div><label className="form-label">Letterhead tagline</label><input {...reg3('letterheadTagline')} className="form-input" placeholder="Next Level Tech" /></div>
          <div className="border-t border-slate-100 pt-4 mt-2 space-y-3">
            <h4 className="font-bold text-sm text-slate-800">Quotation defaults</h4>
            <div><label className="form-label">Thank you message (printed)</label><textarea {...reg3('quotationThankYouMessage')} className="form-input min-h-16" rows={2} /></div>
            <div><label className="form-label">Default notes template</label><textarea {...reg3('quotationNotesTemplate')} className="form-input min-h-16" rows={2} /></div>
            <div><label className="form-label">Default terms template</label><textarea {...reg3('quotationTermsTemplate')} className="form-input min-h-16" rows={2} /></div>
            <div><label className="form-label">Director name (seal)</label><input {...reg3('quotationDirectorName')} className="form-input" /></div>
            <div><label className="form-label">Default signatory role</label>
              <select {...reg3('quotationDirectorRole')} className="form-select">
                <option value="">Use custom director name</option>
                <option value="director">Director</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="hr">HR</option>
              </select>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div><label className="form-label">Quotation font size (pt)</label><input type="number" step="0.5" {...reg3('quotationLayoutFontSizePt', { valueAsNumber: true })} className="form-input" /></div>
              <div><label className="form-label">Line height</label><input type="number" step="0.1" {...reg3('quotationLayoutLineHeight', { valueAsNumber: true })} className="form-input" /></div>
              <div><label className="form-label">Page padding (mm)</label><input type="number" step="1" {...reg3('quotationLayoutPagePaddingMm', { valueAsNumber: true })} className="form-input" /></div>
              <div><label className="form-label">Header spacing (px)</label><input type="number" step="1" {...reg3('quotationLayoutHeaderSpacingPx', { valueAsNumber: true })} className="form-input" /></div>
              <div><label className="form-label">Footer spacing (px)</label><input type="number" step="1" {...reg3('quotationLayoutFooterSpacingPx', { valueAsNumber: true })} className="form-input" /></div>
              <div><label className="form-label">Table cell padding (px)</label><input type="number" step="1" {...reg3('quotationLayoutTableCellPaddingPx', { valueAsNumber: true })} className="form-input" /></div>
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...reg3('quotationLayoutShowDocumentFrame')} />
                Show quotation border frame
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...reg3('quotationLayoutShowRefOnDocument')} />
                Show quotation reference on document
              </label>
            </div>
          </div>
          <div className="grid md:grid-cols-5 gap-4">
            {['director', 'admin', 'manager', 'hr', 'marketing'].map((key) => (
              <div key={key}><label className="form-label capitalize">{key} signature</label>
                <input type="file" accept="image/*" className="form-input text-sm" onChange={(e) => setSigFiles((s) => ({ ...s, [key]: e.target.files?.[0] || null }))} />
              </div>
            ))}
          </div>
          <div><label className="form-label">Company seal upload</label><input type="file" accept="image/*" className="form-input text-sm mb-4" onChange={(e) => setSealFile(e.target.files?.[0] || null)} /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="form-label">Map Latitude</label><input type="number" step="any" {...reg3('mapLat', { valueAsNumber: true })} className="form-input" /></div>
            <div><label className="form-label">Map Longitude</label><input type="number" step="any" {...reg3('mapLng', { valueAsNumber: true })} className="form-input" /></div>
            <div><label className="form-label">Map Zoom</label><input type="number" {...reg3('mapZoom', { valueAsNumber: true })} className="form-input" /></div>
          </div>
          <div className="border-t border-slate-100 pt-4 mt-2">
            <p className="text-xs text-gray-500 mb-3">Payroll and EPF/ETF calculations use these percentages of basic salary (Sri Lanka defaults: 8% / 12% / 3%).</p>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">EPF employee (%)</label>
                <input type="number" step="0.01" min={0} max={50} {...reg3('epfEmployeeRate', { valueAsNumber: true })} className="form-input" />
              </div>
              <div>
                <label className="form-label">EPF employer (%)</label>
                <input type="number" step="0.01" min={0} max={50} {...reg3('epfEmployerRate', { valueAsNumber: true })} className="form-input" />
              </div>
              <div>
                <label className="form-label">ETF employer (%)</label>
                <input type="number" step="0.01" min={0} max={50} {...reg3('etfEmployerRate', { valueAsNumber: true })} className="form-input" />
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4 mt-4">
            <h4 className="font-bold text-sm text-slate-800 mb-4">SMS Notification System</h4>
            <div className="flex items-center gap-3 mb-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" {...reg3('smsEnabled')} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              <span className="text-sm font-medium text-gray-700">Enable Master SMS System</span>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6">
              {[
                { name: 'payroll', label: 'Payroll & Salary' },
                { name: 'leave', label: 'Leave Approvals' },
                { name: 'project', label: 'Projects & Tasks' },
                { name: 'hr', label: 'Letters & HR' },
                { name: 'financial', label: 'Loans & Advances' },
                { name: 'system', label: 'System & Target' },
              ].map(m => (
                <div key={m.name} className="flex flex-col">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...reg3(`smsModules.${m.name}`)} className="form-checkbox text-blue-600 rounded" />
                    <span className="text-sm text-gray-700">{m.label}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h4 className="font-semibold text-gray-700 mb-4">Chat & Messaging</h4>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <label className="form-label">Message Auto-Delete Duration (Days)</label>
              <p className="text-xs text-gray-500 mb-2">Set to 0 to disable auto-deletion. Messages older than this will be permanently removed.</p>
              <input type="number" min="0" step="1" {...reg3('messageAutoDeleteDays', { valueAsNumber: true })} className="form-input max-w-xs" />
            </div>
          </div>
          
          <button type="submit" className="btn-primary mt-6" disabled={siteMut.isPending || isSubmittingSite}>
            {siteMut.isPending || isSubmittingSite ? <span className="spinner"/> : 'Save Site Settings'}
          </button>
        </form>
      </div>

      <div className="card card-body bg-slate-50">
        <h3 className="font-bold text-primary font-heading mb-4">System Information</h3>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          {[
            { label:'Platform', value:'Raxwo Portal v1.0' },
            { label:'Stack', value:'MERN (MongoDB, Express, React, Node)' },
            { label:'Environment', value:'Development' },
            { label:'EPF Rate (Employee)', value: `${Number(siteData?.settings?.epfEmployeeRate ?? 8)}%` },
            { label:'EPF Rate (Employer)', value: `${Number(siteData?.settings?.epfEmployerRate ?? 12)}%` },
            { label:'ETF Rate (Employer)', value: `${Number(siteData?.settings?.etfEmployerRate ?? 3)}%` },
          ].map(i => (
            <div key={i.label} className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">{i.label}</span>
              <span className="font-medium text-gray-700">{i.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
