import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight } from 'react-icons/fi'
import SiteLogo from '../../components/branding/SiteLogo'

export default function Login() {
  const { login } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm()

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const user = await login(data.email, data.password)
      toast.success(`Welcome back, ${user.name}!`)
      const redirect = {
        admin: '/admin',
        manager: '/manager',
        developer: '/developer',
        designer: '/designer',
        marketing: '/marketing',
        client: '/my-dashboard',
      }
      const dest = redirect[user.role]
      if (!dest) {
        toast.error(`No dashboard configured for role "${user.role}"`)
        return
      }
      navigate(dest)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-16">
        <SiteLogo to="/" variant="dark" />

        <div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-bold text-white font-heading leading-tight mb-6"
          >
            Innovating the<br />
            <span className="text-gradient">Future of</span><br />
            Software
          </motion.h1>
          <p className="text-white/60 text-lg max-w-md">
            Your all-in-one platform for HR management, project tracking, recruitment, and client relations.
          </p>

          <div className="grid grid-cols-2 gap-4 mt-10">
            {[
              { num: '150+', label: 'Projects Delivered' },
              { num: '250+', label: 'Satisfied Clients' },
              { num: '35+', label: 'Team Members' },
              { num: '7+', label: 'Years Experience' },
            ].map(s => (
              <div key={s.label} className="glass-card p-4 border border-white/10 hover:border-[#20b2f5]/40 transition-all">
                <p className="text-3xl font-bold text-[#20b2f5] font-heading">{s.num}</p>
                <p className="text-white/70 text-sm font-medium mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/30 text-sm">© {new Date().getFullYear()} Raxwo — Colombo, Sri Lanka</p>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 lg:max-w-xl flex items-center justify-center p-6 bg-slate-50/50 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-[380px] bg-white rounded-3xl p-8 sm:p-10 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)] relative z-10"
        >
          <div className="lg:hidden mb-8 flex justify-center">
            <SiteLogo to="/" variant="light" />
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900 font-heading mb-2 tracking-tight">Welcome back</h2>
            <p className="text-slate-500 text-sm">Sign in to your portal to continue</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                  <FiMail size={16} />
                </div>
                <input
                  {...register('email', { required: 'Email is required' })}
                  type="email"
                  placeholder="management@raxwo.net"
                  className="w-full pl-10 pr-4 py-3 bg-[#EEF2FC] border-none rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:bg-[#E5EAFC] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              {errors.email && <p className="text-red-500 text-xs font-medium mt-1.5">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Password</label>
                <Link to="/forgot-password" className="text-[11px] font-medium text-secondary hover:text-primary transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                  <FiLock size={16} />
                </div>
                <input
                  {...register('password', { required: 'Password is required' })}
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••••"
                  className="w-full pl-10 pr-10 py-3 bg-[#EEF2FC] border-none rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:bg-[#E5EAFC] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors">
                  {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-[11px] font-medium mt-1">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#0B0A26] hover:bg-[#15143A] text-white text-[13px] font-semibold rounded-xl shadow-lg shadow-black/10 active:scale-[0.98] transition-all duration-200 mt-4">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Sign In <FiArrowRight size={16} className="ml-1 opacity-70" /></>}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-[13px] text-slate-500">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold text-secondary hover:text-primary transition-colors">Sign up now</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
