import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { FiLock, FiEye, FiEyeOff, FiArrowRight, FiMail } from 'react-icons/fi'
import SiteLogo from '../../components/branding/SiteLogo'
import SEO from '../../components/common/SEO'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tokenFromUrl = searchParams.get('token') || ''
  const emailFromUrl = searchParams.get('email') || ''

  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: { email: emailFromUrl, token: tokenFromUrl, password: '', confirmPassword: '' },
  })

  const password = watch('password')

  const onSubmit = async (data) => {
    if (data.password !== data.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', {
        email: data.email,
        token: data.token,
        password: data.password,
      })
      toast.success('Password updated. Sign in with your new password.')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6">
      <SEO title="Set New Password" noindex={true} />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8"
      >
        <div className="mb-8">
          <SiteLogo to="/" variant="light" />
        </div>

        <h1 className="text-2xl font-bold text-primary font-heading mb-1">Set new password</h1>
        <p className="text-gray-500 text-sm mb-6">
          Use the link from your email. The link expires in one hour.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="form-label">Email</label>
            <div className="relative">
              <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                {...register('email', { required: 'Email is required' })}
                type="email"
                className="form-input !pl-10"
                readOnly={Boolean(emailFromUrl)}
              />
            </div>
            {errors.email && <p className="form-error">{errors.email.message}</p>}
          </div>

          {tokenFromUrl ? (
            <input type="hidden" {...register('token', { required: true })} />
          ) : (
            <div>
              <label className="form-label">Reset token</label>
              <input
                {...register('token', { required: 'Reset token is required' })}
                type="text"
                className="form-input font-mono text-xs"
                placeholder="Paste token from your reset link"
              />
              {errors.token && <p className="form-error">{errors.token.message}</p>}
            </div>
          )}

          <div>
            <label className="form-label">New password</label>
            <div className="relative">
              <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'At least 6 characters' } })}
                type={showPass ? 'text' : 'password'}
                className="form-input !pl-10 pr-10"
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
            {errors.password && <p className="form-error">{errors.password.message}</p>}
          </div>

          <div>
            <label className="form-label">Confirm password</label>
            <div className="relative">
              <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                {...register('confirmPassword', {
                  required: 'Please confirm your password',
                  validate: (v) => v === password || 'Passwords do not match',
                })}
                type={showConfirm ? 'text' : 'password'}
                className="form-input !pl-10 pr-10"
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showConfirm ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && <p className="form-error">{errors.confirmPassword.message}</p>}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 mt-2">
            {loading ? <span className="spinner" /> : <>Update password <FiArrowRight size={16} /></>}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link to="/login" className="text-secondary font-medium hover:underline">Back to sign in</Link>
        </p>
      </motion.div>
    </div>
  )
}
