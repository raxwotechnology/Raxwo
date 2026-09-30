import { useForm } from 'react-hook-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ClientQuotationViewFromUrl } from '../../components/client/ClientQuotationView'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'
import { FiSave, FiUser, FiLock, FiFolder, FiCreditCard, FiFileText, FiArrowRight, FiCheckCircle, FiClock, FiStar } from 'react-icons/fi'
import { useState } from 'react'
import { validateStrongPassword, passwordStrengthHints } from '../../lib/passwordValidation'
import { formatMoney } from '../../lib/currencies'
import ClientPageHeader from '../../components/ui/ClientPageHeader'
import { compressImageFile } from '../../lib/imageOptimizer'
import UserAvatar from '../../components/ui/UserAvatar'

export default function ClientProfile() {
  const [, setSearchParams] = useSearchParams()
  const { user, updateUser } = useAuthStore()

  const openQuotation = (id) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('quotation', id)
      return next
    })
  }
  const [avatarFile, setAvatarFile] = useState(null)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordLoading, setPasswordLoading] = useState(false)

  const { data: projData } = useQuery({ queryKey: ['client-projects'], queryFn: () => api.get('/projects').then(r => r.data) })
  const { data: invData }  = useQuery({ queryKey: ['client-invoices'], queryFn: () => api.get('/invoices').then(r => r.data) })
  const { data: quotData } = useQuery({ queryKey: ['client-quotations'], queryFn: () => api.get('/quotations').then(r => r.data) })

  const projects = projData?.projects || []
  const invoices = invData?.invoices || []
  const quotations = quotData?.quotations || []

  const activeProjects = projects.filter(p => p.status === 'active')
  const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue')
  const pendingQuotations = quotations.filter(q => q.status === 'draft' || q.status === 'sent')

  const { register: reg1, handleSubmit: hs1 } = useForm({
    defaultValues: { name: user?.name, phone: user?.phone },
  })

  const profileMut = useMutation({
    mutationFn: d => api.put('/auth/profile', d).then(r => r.data),
    onSuccess: r => { updateUser(r.user); toast.success('Profile updated'); setAvatarFile(null) },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })

  const uploadAvatar = async () => {
    if (!avatarFile) return user?.avatar || ''
    try {
      return await compressImageFile(avatarFile, { maxWidth: 480, maxHeight: 480, quality: 0.85 })
    } catch {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = ev => resolve(ev.target.result)
        reader.readAsDataURL(avatarFile)
      })
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    const { currentPassword, newPassword, confirmPassword } = passwordForm

    if (!currentPassword?.trim()) { return toast.error('Enter your current password') }
    const strengthErr = validateStrongPassword(newPassword)
    if (strengthErr) { return toast.error(strengthErr) }
    if (newPassword !== confirmPassword) { return toast.error('New password and confirmation do not match') }

    setPasswordLoading(true)
    try {
      const { data } = await api.put('/auth/change-password', {
        currentPassword: currentPassword.trim(),
        newPassword,
      })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      toast.success(data?.message || 'Password updated successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update password')
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className="animate-fade-in pb-12 bg-slate-50 min-h-screen">
      <ClientPageHeader 
        title={user?.name} 
        subtitle="Manage your profile settings"
        rightContent={
          <div className="flex items-center gap-5 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20">
            <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center text-white text-2xl font-bold border border-white/30 overflow-hidden shrink-0">
              {avatarFile ? (
                <img src={URL.createObjectURL(avatarFile)} alt="" className="w-full h-full object-cover" />
              ) : (
                <UserAvatar user={user} className="w-full h-full rounded-xl" />
              )}
            </div>
            <div className="pr-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="badge bg-white/20 text-white border-white/10 px-2 py-0.5 text-[10px]"><FiStar className="inline mr-1" /> Client</span>
              </div>
              <p className="text-white/80 text-xs">{user?.email}</p>
            </div>
          </div>
        }
      />

      <section className="container-max mt-8">
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Column: Profile Settings */}
          <div className="lg:col-span-5 space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card card-body shadow-sm border-slate-200">
              <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <FiUser className="text-blue-600" size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Personal Information</h3>
                  <p className="text-xs text-slate-500">Update your contact details</p>
                </div>
              </div>

              <form onSubmit={hs1(async (d) => {
                  const avatar = await uploadAvatar()
                  profileMut.mutate({ ...d, avatar })
                })} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label text-xs">Full Name</label>
                    <input {...reg1('name')} className="form-input bg-slate-50" />
                  </div>
                  <div>
                    <label className="form-label text-xs">Phone Number</label>
                    <input {...reg1('phone')} placeholder="+94 77 xxx xxxx" className="form-input bg-slate-50" />
                  </div>
                </div>
                <div>
                  <label className="form-label text-xs">Email Address (Read-only)</label>
                  <input value={user?.email} disabled className="form-input bg-slate-100 text-slate-400 cursor-not-allowed" />
                </div>
                <div>
                  <label className="form-label text-xs">Profile Picture</label>
                  <input type="file" accept="image/*" className="form-input bg-slate-50 text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
                </div>
                <button type="submit" disabled={profileMut.isPending} className="btn-primary w-full justify-center mt-2 py-2.5">
                  {profileMut.isPending ? <span className="spinner" /> : <><FiSave size={16} /> Save Profile</>}
                </button>
              </form>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card card-body shadow-sm border-slate-200">
              <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <FiLock className="text-red-500" size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Account Security</h3>
                  <p className="text-xs text-slate-500">Change your password</p>
                </div>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="form-label text-xs">Current Password</label>
                  <input type="password" placeholder="••••••••" className="form-input bg-slate-50" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm(s => ({ ...s, currentPassword: e.target.value }))} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label text-xs">New Password</label>
                    <input type="password" placeholder="••••••••" className="form-input bg-slate-50" value={passwordForm.newPassword} onChange={(e) => setPasswordForm(s => ({ ...s, newPassword: e.target.value }))} required minLength={8} />
                  </div>
                  <div>
                    <label className="form-label text-xs">Confirm Password</label>
                    <input type="password" placeholder="••••••••" className="form-input bg-slate-50" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm(s => ({ ...s, confirmPassword: e.target.value }))} required minLength={8} />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">{passwordStrengthHints()}</p>
                <button type="submit" disabled={passwordLoading} className="btn-danger w-full justify-center mt-2 py-2.5">
                  {passwordLoading ? <span className="spinner" /> : <><FiLock size={16} /> Update Security</>}
                </button>
              </form>
            </motion.div>
          </div>

          {/* Right Column: Business Overview */}
          <div className="lg:col-span-7 space-y-6">
            {/* Business KPI */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="grid grid-cols-3 gap-4">
              <div className="card p-5 bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200 shadow-sm flex flex-col justify-center">
                <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">Active Projects</p>
                <h3 className="text-2xl font-black text-blue-900">{activeProjects.length}</h3>
              </div>
              <div className="card p-5 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200 shadow-sm flex flex-col justify-center">
                <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider mb-1">Due Invoices</p>
                <h3 className="text-2xl font-black text-emerald-900">{pendingInvoices.length}</h3>
              </div>
              <div className="card p-5 bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200 shadow-sm flex flex-col justify-center">
                <p className="text-xs text-purple-600 font-bold uppercase tracking-wider mb-1">Quotations</p>
                <h3 className="text-2xl font-black text-purple-900">{quotations.length}</h3>
              </div>
            </motion.div>

            {/* Active Projects */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card shadow-sm border-slate-200 overflow-hidden">
              <div className="bg-slate-50/80 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiFolder className="text-blue-600" />
                  <h3 className="font-bold text-slate-800">Active Projects</h3>
                </div>
                <Link to="/my-projects" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">View All <FiArrowRight size={12}/></Link>
              </div>
              <div className="p-2">
                {activeProjects.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-6">No active projects currently.</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {activeProjects.slice(0, 3).map(p => (
                      <div key={p._id} className="p-3 hover:bg-slate-50 rounded-lg transition-colors group">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-semibold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">{p.title}</h4>
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{p.progress || 0}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${p.progress || 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            {/* Recent Invoices & Quotations grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Invoices */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card shadow-sm border-slate-200 overflow-hidden flex flex-col">
                <div className="bg-slate-50/80 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiCreditCard className="text-emerald-600" />
                    <h3 className="font-bold text-slate-800">Pending Invoices</h3>
                  </div>
                  <Link to="/payments" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">View All</Link>
                </div>
                <div className="p-2 flex-1 flex flex-col">
                  {pendingInvoices.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-6">
                      <FiCheckCircle size={24} className="mb-2 opacity-50" />
                      <p className="text-sm">All caught up!</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {pendingInvoices.slice(0, 3).map(inv => (
                        <div key={inv._id} className="p-3 flex justify-between items-center hover:bg-slate-50 rounded-lg">
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{inv.invoiceNo}</p>
                            <p className="text-xs text-slate-500">{new Date(inv.dueDate).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-emerald-600">{formatMoney(inv.total)}</p>
                            <span className={`text-[10px] font-bold uppercase ${inv.status === 'overdue' ? 'text-red-500' : 'text-slate-400'}`}>{inv.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Quotations */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="card shadow-sm border-slate-200 overflow-hidden flex flex-col">
                <div className="bg-slate-50/80 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiFileText className="text-purple-600" />
                    <h3 className="font-bold text-slate-800">Recent Quotations</h3>
                  </div>
                </div>
                <div className="p-2 flex-1 flex flex-col">
                  {quotations.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-6">
                      <FiClock size={24} className="mb-2 opacity-50" />
                      <p className="text-sm">No quotations yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {quotations.slice(0, 5).map(q => (
                        <button
                          key={q._id}
                          type="button"
                          onClick={() => openQuotation(q._id)}
                          className="w-full text-left p-3 flex justify-between items-center hover:bg-purple-50 rounded-lg transition-colors group"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 text-sm group-hover:text-purple-700">{q.quotationNo}</p>
                            <p className="text-xs text-slate-500 truncate">{q.title || 'Quotation'}</p>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className="font-bold text-purple-600">{formatMoney(q.total, q.currency)}</p>
                            <span className="text-[10px] font-bold uppercase text-slate-400">{q.status}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <ClientQuotationViewFromUrl />
    </div>
  )
}
