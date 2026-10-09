import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { FiMail, FiLock, FiArrowLeft, FiArrowRight } from 'react-icons/fi'
import { validateStrongPassword, passwordStrengthHints } from '../../lib/passwordValidation'
import SEO from '../../components/common/SEO'

const STEPS = { EMAIL: 1, OTP: 2, RESET: 3 }

export default function ForgotPassword() {
  const [step, setStep] = useState(STEPS.EMAIL)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, watch, formState: { errors } } = useForm()
  const newPassword = watch('password', '')

  const sendOtp = async (data) => {
    setLoading(true)
    try {
      const res = await api.post('/auth/forgot-password/otp', { email: data.email })
      setEmail(data.email.trim().toLowerCase())
      if (res.data.devOtp) toast.success(`Dev OTP: ${res.data.devOtp}`, { duration: 12000 })
      else toast.success(res.data.message || 'Verification code sent')
      setStep(STEPS.OTP)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send code')
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async () => {
    if (!otp || otp.length < 6) {
      toast.error('Enter the 6-digit code from your email')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/forgot-password/verify-otp', { email, otp })
      toast.success('Code verified')
      setStep(STEPS.RESET)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (data) => {
    const strengthErr = validateStrongPassword(data.password)
    if (strengthErr) {
      toast.error(strengthErr)
      return
    }
    if (data.password !== data.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/forgot-password/reset', { email, otp, password: data.password })
      toast.success('Password reset. You can sign in now.')
      window.location.href = '/'
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6">
      <SEO title="Reset Password" noindex={true} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"
      >
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-secondary mb-6">
          <FiArrowLeft size={14} /> Back to sign in
        </Link>

        <h1 className="text-2xl font-bold text-primary font-heading mb-1">Forgot password</h1>
        <p className="text-gray-500 text-sm mb-8">
          {step === STEPS.EMAIL && 'Enter your client account email to receive a verification code.'}
          {step === STEPS.OTP && `We sent a code to ${email}`}
          {step === STEPS.RESET && 'Choose a new password for your account.'}
        </p>

        {step === STEPS.EMAIL && (
          <form onSubmit={handleSubmit(sendOtp)} className="space-y-5">
            <div>
              <label className="form-label">Email address</label>
              <motion.div className="relative">
                <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  {...register('email', { required: 'Email is required' })}
                  type="email"
                  placeholder="you@example.com"
                  className="form-input !pl-10"
                />
              </motion.div>
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading ? <span className="spinner" /> : <>Send code <FiArrowRight size={16} /></>}
            </button>
          </form>
        )}

        {step === STEPS.OTP && (
          <div className="space-y-5">
            <div>
              <label className="form-label">Verification code</label>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                placeholder="6-digit code"
                className="form-input text-center text-lg tracking-[0.4em] font-mono"
                maxLength={6}
              />
            </div>
            <button type="button" onClick={verifyOtp} disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading ? <span className="spinner" /> : 'Verify code'}
            </button>
            <button type="button" onClick={() => setStep(STEPS.EMAIL)} className="btn-ghost w-full justify-center text-sm">
              Use a different email
            </button>
          </div>
        )}

        {step === STEPS.RESET && (
          <form onSubmit={handleSubmit(resetPassword)} className="space-y-5">
            <div>
              <label className="form-label">New password</label>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  {...register('password', { required: 'Password is required' })}
                  type="password"
                  className="form-input !pl-10"
                  placeholder="••••••••"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{passwordStrengthHints()}</p>
            </div>
            <div>
              <label className="form-label">Confirm password</label>
              <input
                {...register('confirmPassword', { required: 'Please confirm your password' })}
                type="password"
                className="form-input"
                placeholder="••••••••"
              />
            </div>
            <button type="submit" disabled={loading || !newPassword} className="btn-primary w-full justify-center py-3">
              {loading ? <span className="spinner" /> : 'Reset password'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  )
}
