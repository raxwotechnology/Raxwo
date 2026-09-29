import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight } from 'react-icons/fi'
import SiteLogo from '../../components/branding/SiteLogo'
import SEO from '../../components/common/SEO'

export default function Register() {
  const { register: registerUser } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const { register, handleSubmit, watch, formState: { errors } } = useForm()

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      await registerUser({
        name: data.name,
        email: data.email,
        password: data.password,
        role: 'client',
        referralCode: data.referralCode || '',
      })
      toast.success('Account created! Welcome to Raxwo Portal')
      navigate('/my-dashboard')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6">
      <SEO 
        title="Create a Client Account"
        description="Join Raxwo's enterprise platform to access client portal tools, project tracking, and dedicated support."
        noindex={true}
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[380px] bg-white/90 backdrop-blur-xl border border-white/50 rounded-2xl p-6 sm:p-8 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)] relative z-10"
      >
        <div className="mb-6 flex justify-center">
          <SiteLogo to="/" variant="light" />
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-primary font-heading mb-1.5 tracking-tight">Create Account</h2>
          <p className="text-slate-500 text-[13px]">Register as a client to access the portal</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">Full Name</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                <FiUser size={16} />
              </div>
              <input {...register('name', { required: 'Name is required' })} placeholder="Your full name" className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" />
            </div>
            {errors.name && <p className="text-red-500 text-[11px] font-medium mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">Email Address</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                <FiMail size={16} />
              </div>
              <input {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })} type="email" placeholder="you@company.com" className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" />
            </div>
            {errors.email && <p className="text-red-500 text-[11px] font-medium mt-1">{errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                  <FiLock size={16} />
                </div>
                <input {...register('password', { required: 'Password required', minLength: { value: 6, message: 'Min 6 characters' } })} type={showPass ? 'text' : 'password'} placeholder="Min 6 chars" className="w-full pl-10 pr-10 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors">
                  {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-[11px] font-medium mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">Confirm</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                  <FiLock size={16} />
                </div>
                <input {...register('confirmPassword', { validate: v => v === watch('password') || 'No match' })} type="password" placeholder="Repeat" className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" />
              </div>
              {errors.confirmPassword && <p className="text-red-500 text-[11px] font-medium mt-1">{errors.confirmPassword.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">Referral Code (Optional)</label>
            <input {...register('referralCode')} placeholder="RAX-CLIENT-2026" className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" />
          </div>

          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-xl shadow-md shadow-primary/25 hover:shadow-primary/40 active:scale-[0.98] transition-all duration-200 mt-4">
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Create Account <FiArrowRight size={16} /></>}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <p className="text-[13px] text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-secondary hover:text-primary transition-colors">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
