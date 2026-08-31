import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { FiSend } from 'react-icons/fi'
import api from '../../lib/api'

export default function ContactForm({ title = 'Send Us a Message', subtitle = 'Fill out the form and our engineering team will respond within 24 hours.' }) {
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      await api.post('/contact', {
        name: data.name,
        email: data.email,
        phone: data.phone,
        subject: data.subject || 'General Inquiry / Let\'s Talk',
        message: data.message,
      })
      toast.success('Thank you! Your message has been sent successfully. We will get back to you shortly.')
      reset()
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to send message. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card card-body bg-white border border-slate-200/90 shadow-xl rounded-3xl p-6 sm:p-8">
      {title && <h3 className="text-xl sm:text-2xl font-bold text-slate-900 font-heading mb-2">{title}</h3>}
      {subtitle && <p className="text-slate-500 text-sm mb-6 leading-relaxed">{subtitle}</p>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Full Name *</label>
            <input
              {...register('name', { required: 'Name is required' })}
              placeholder="e.g. John Silva"
              style={{ color: '#0f172a', backgroundColor: '#f8fafc' }}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Email Address *</label>
            <input
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email address' }
              })}
              type="email"
              placeholder="you@company.com"
              style={{ color: '#0f172a', backgroundColor: '#f8fafc' }}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Phone Number</label>
            <input
              {...register('phone')}
              placeholder="+94 77 123 4567"
              style={{ color: '#0f172a', backgroundColor: '#f8fafc' }}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Subject / Interest</label>
            <select
              {...register('subject')}
              style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
            >
              <option value="Gym Management ERP Software" style={{ color: '#0f172a', backgroundColor: '#ffffff' }} className="text-slate-900 bg-white font-medium">Gym Management ERP Software</option>
              <option value="Mobile Shop ERP System" style={{ color: '#0f172a', backgroundColor: '#ffffff' }} className="text-slate-900 bg-white font-medium">Mobile Shop ERP System</option>
              <option value="Salon & Spa Management ERP" style={{ color: '#0f172a', backgroundColor: '#ffffff' }} className="text-slate-900 bg-white font-medium">Salon &amp; Spa Management ERP</option>
              <option value="Restaurant & Hotel POS ERP" style={{ color: '#0f172a', backgroundColor: '#ffffff' }} className="text-slate-900 bg-white font-medium">Restaurant &amp; Hotel POS ERP</option>
              <option value="Hardware & Distribution ERP" style={{ color: '#0f172a', backgroundColor: '#ffffff' }} className="text-slate-900 bg-white font-medium">Hardware &amp; Distribution ERP</option>
              <option value="Custom Software Development" style={{ color: '#0f172a', backgroundColor: '#ffffff' }} className="text-slate-900 bg-white font-medium">Custom Software Development</option>
              <option value="Web & Mobile App Development" style={{ color: '#0f172a', backgroundColor: '#ffffff' }} className="text-slate-900 bg-white font-medium">Web &amp; Mobile App Development</option>
              <option value="E-Commerce & Online Store Solution" style={{ color: '#0f172a', backgroundColor: '#ffffff' }} className="text-slate-900 bg-white font-medium">E-Commerce &amp; Online Store Solution</option>
              <option value="UI/UX & Creative Studio Services" style={{ color: '#0f172a', backgroundColor: '#ffffff' }} className="text-slate-900 bg-white font-medium">UI/UX &amp; Creative Studio Services</option>
              <option value="Digital Marketing & Social Media Management" style={{ color: '#0f172a', backgroundColor: '#ffffff' }} className="text-slate-900 bg-white font-medium">Digital Marketing &amp; Social Media Management</option>
              <option value="Other Inquiry" style={{ color: '#0f172a', backgroundColor: '#ffffff' }} className="text-slate-900 bg-white font-medium">Other Inquiry</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Project Requirements / Message *</label>
          <textarea
            {...register('message', { required: 'Message is required' })}
            rows={4}
            placeholder="Tell us about your project requirements, goals, or timeline..."
            style={{ color: '#0f172a', backgroundColor: '#f8fafc' }}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          {errors.message && <p className="text-red-500 text-xs mt-1">{errors.message.message}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              Send Message <FiSend size={16} />
            </>
          )}
        </button>
      </form>
    </div>
  )
}
