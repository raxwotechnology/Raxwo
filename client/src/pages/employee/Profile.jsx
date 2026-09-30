import { useForm } from 'react-hook-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../lib/api'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'
import { FiMail, FiPhone, FiSave, FiCamera, FiBriefcase, FiCalendar, FiUser, FiShield, FiMapPin, FiCode, FiKey, FiEye, FiEyeOff, FiActivity } from 'react-icons/fi'
import { useState } from 'react'
import { mediaUrl } from '../../lib/media'
import { compressImageFile } from '../../lib/imageOptimizer'
import { useForm as usePwdForm } from 'react-hook-form'

export default function EmployeeProfile() {
  const { user, updateUser } = useAuthStore()
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [showPwdForm, setShowPwdForm] = useState(false)
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get('/employees/me').then(r => r.data),
  })
  const emp = data?.employee

  const { register, handleSubmit } = useForm({
    defaultValues: { name: user?.name || '', phone: user?.phone || '' },
  })

  const { register: regPwd, handleSubmit: handlePwd, reset: resetPwd } = usePwdForm()

  const profileMut = useMutation({
    mutationFn: async (vals) => {
      let avatar = user?.avatar || ''
      if (avatarPreview && avatarPreview.startsWith('data:')) {
        avatar = avatarPreview
      } else if (avatarFile) {
        avatar = await compressImageFile(avatarFile, { maxWidth: 480, maxHeight: 480, quality: 0.85 })
      }
      return api.put('/auth/profile', { ...vals, avatar }).then(r => r.data)
    },
    onSuccess: r => { updateUser(r.user); toast.success('Profile updated'); setAvatarFile(null); setAvatarPreview(null) },
    onError: e => toast.error(e.response?.data?.message || 'Failed to update'),
  })

  const pwdMut = useMutation({
    mutationFn: vals => api.put('/auth/change-password', vals).then(r => r.data),
    onSuccess: () => { toast.success('Password changed'); setShowPwdForm(false); resetPwd() },
    onError: e => toast.error(e.response?.data?.message || 'Failed to change password'),
  })

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    try {
      const compressed = await compressImageFile(file, { maxWidth: 480, maxHeight: 480, quality: 0.85 })
      setAvatarPreview(compressed)
    } catch {
      const reader = new FileReader()
      reader.onload = ev => setAvatarPreview(ev.target.result)
      reader.readAsDataURL(file)
    }
  }

  const avatarSrc = avatarPreview || (user?.avatar ? mediaUrl(user.avatar) : null)
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'E'

  const infoFields = [
    { icon: FiMail, label: 'Email', val: user?.email },
    { icon: FiPhone, label: 'Phone', val: user?.phone || '—' },
    { icon: FiBriefcase, label: 'Department', val: emp?.department || '—' },
    { icon: FiUser, label: 'Designation', val: emp?.designation || '—' },
    { icon: FiShield, label: 'Employee No', val: emp?.employeeNo || '—' },
    { icon: FiCalendar, label: 'Joined Date', val: emp?.joinedDate ? new Date(emp.joinedDate).toLocaleDateString('en-LK', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
    { icon: FiShield, label: 'EPF Number', val: emp?.epfNumber || '—' },
    { icon: FiMapPin, label: 'Branch', val: emp?.branch?.name || '—' },
  ]

  if (isLoading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin"></div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title text-3xl">My Profile</h1>
          <p className="page-subtitle">Manage your personal information and account security.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: ID Card & Info */}
        <div className="lg:col-span-1 space-y-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card border-0 shadow-xl overflow-hidden rounded-3xl relative bg-white">
            <div className="h-32 bg-gradient-to-br from-primary via-slate-800 to-secondary relative">
              <div className="absolute inset-0 opacity-20 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
            </div>
            <div className="px-6 pb-8 relative text-center">
              <div className="relative inline-block -mt-16 mb-4">
                <div className="w-32 h-32 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-gradient-to-br from-secondary to-blue-600 flex items-center justify-center">
                  {avatarSrc
                    ? <img src={avatarSrc} alt={user?.name} className="w-full h-full object-cover" />
                    : <span className="text-white font-bold text-4xl font-heading">{initials}</span>}
                </div>
                <label className="absolute bottom-1 right-1 w-9 h-9 bg-white border border-slate-200 rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:bg-secondary hover:text-white transition-all hover:scale-110">
                  <FiCamera size={15} />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">{user?.name}</h2>
              <p className="text-sm text-secondary font-semibold uppercase tracking-wider mt-1">{emp?.designation || user?.role}</p>
              
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {emp?.department && <span className="badge bg-slate-100 text-slate-600 px-3 py-1 font-medium shadow-sm">{emp.department}</span>}
                {emp?.employeeNo && <span className="badge bg-blue-50 text-blue-600 font-mono text-xs px-3 py-1 shadow-sm">{emp.employeeNo}</span>}
                <span className={`badge px-3 py-1 shadow-sm ${emp?.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                  {emp?.status === 'active' ? 'Active' : emp?.status || 'Active'}
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card card-body shadow-lg border-0 rounded-3xl bg-white/50 backdrop-blur-xl">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><FiActivity size={14}/> Employment Details</h3>
            <div className="space-y-4">
              {infoFields.map(f => (
                <div key={f.label} className="flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-secondary/10 group-hover:border-secondary/20 transition-colors">
                    <f.icon size={16} className="text-slate-400 group-hover:text-secondary transition-colors" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{f.label}</p>
                    <p className="text-sm font-semibold text-slate-700 truncate">{f.val}</p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Skills */}
            {emp?.skills?.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-200/60">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5"><FiCode size={12} /> Core Skills</p>
                <div className="flex flex-wrap gap-2">
                  {emp.skills.map(s => <span key={s} className="badge bg-blue-50/80 text-blue-700 border border-blue-100/50 shadow-sm text-xs px-2.5 py-1">{s}</span>)}
                </div>
              </div>
            )}
            
            {emp?.cvUrl && (
              <div className="mt-6 pt-6 border-t border-slate-200/60">
                <a href={mediaUrl(emp.cvUrl)} target="_blank" rel="noreferrer" className="w-full btn-outline flex justify-center gap-2">
                  <FiUser size={14} /> View CV / Resume
                </a>
              </div>
            )}
          </motion.div>
        </div>

        {/* Right Column: Edit Forms */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card card-body shadow-xl border-0 rounded-3xl bg-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/5 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2"></div>
            
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <FiUser size={18}/>
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800">Edit Profile</h3>
                <p className="text-xs text-slate-500">Update your public facing information</p>
              </div>
            </div>

            <form onSubmit={handleSubmit(vals => profileMut.mutate(vals))} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Display Name</label>
                  <input className="form-input text-sm px-4 py-3 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-all shadow-inner" {...register('name', { required: true })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Phone Number</label>
                  <input className="form-input text-sm px-4 py-3 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-all shadow-inner" {...register('phone')} placeholder="+94 77 000 0000" />
                </div>
              </div>
              
              {avatarFile && (
                <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center gap-3 text-sm text-blue-700">
                  <FiCamera className="shrink-0" />
                  <p>New profile photo selected. Save changes to apply.</p>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button type="submit" disabled={profileMut.isPending} className="btn-primary shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all px-8 py-2.5 rounded-xl text-sm font-bold gap-2">
                  {profileMut.isPending
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                    : <><FiSave size={16} /> Save Changes</>}
                </button>
              </div>
            </form>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card card-body shadow-xl border-0 rounded-3xl bg-white relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center text-red-600">
                  <FiKey size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800">Security</h3>
                  <p className="text-xs text-slate-500">Update your account password</p>
                </div>
              </div>
              <button onClick={() => setShowPwdForm(p => !p)} className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${showPwdForm ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                {showPwdForm ? 'Cancel' : 'Change Password'}
              </button>
            </div>

            <AnimatePresence>
              {showPwdForm && (
                <motion.form 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                  onSubmit={handlePwd(vals => pwdMut.mutate(vals))}
                >
                  <div className="pt-6 mt-4 border-t border-slate-100 space-y-5">
                    <div className="relative">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block">Current Password</label>
                      <input type={showOld ? 'text' : 'password'} className="form-input text-sm px-4 py-3 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-all shadow-inner pr-12"
                        {...regPwd('oldPassword', { required: true })} />
                      <button type="button" onClick={() => setShowOld(p => !p)}
                        className="absolute right-4 top-[38px] text-slate-400 hover:text-secondary transition-colors">
                        {showOld ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                      </button>
                    </div>
                    <div className="relative">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block">New Password</label>
                      <input type={showNew ? 'text' : 'password'} className="form-input text-sm px-4 py-3 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-all shadow-inner pr-12"
                        {...regPwd('newPassword', { required: true, minLength: { value: 6, message: 'Min 6 characters' } })} />
                      <button type="button" onClick={() => setShowNew(p => !p)}
                        className="absolute right-4 top-[38px] text-slate-400 hover:text-secondary transition-colors">
                        {showNew ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                      </button>
                    </div>
                    <div className="flex justify-end pt-2">
                      <button type="submit" disabled={pwdMut.isPending} className="btn-primary bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 px-8 py-2.5 rounded-xl text-sm font-bold">
                        {pwdMut.isPending ? 'Updating...' : 'Update Password'}
                      </button>
                    </div>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>

        </div>
      </div>
    </div>
  )
}
