import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiStar, FiSend, FiUser, FiMail } from 'react-icons/fi'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import useAuthStore from '../../store/authStore'

export default function FeedbackModal({ item, onClose }) {
  const { user } = useAuthStore()
  const [rating, setRating] = useState(5)
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!rating) return toast.error('Please select a star rating')
    if (!message.trim()) return toast.error('Please write your feedback')

    setLoading(true)
    try {
      await api.post('/feedback', {
        name: name || user?.name || 'Anonymous Client',
        email: email || user?.email || '',
        rating,
        message,
        service: (item?._id && !item._id.startsWith('p') && !item._id.startsWith('s')) ? item._id : null,
        title: item?.title || 'Product Feedback'
      })
      toast.success('Thank you for your feedback!')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit feedback')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-amber-500 to-orange-600 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white">
                <FiStar size={22} className="fill-current text-amber-200" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-amber-100 uppercase tracking-widest block">
                  Product &amp; Service Feedback
                </span>
                <h3 className="text-lg font-bold text-white">{item?.title || 'Give Feedback'}</h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-amber-100 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            >
              <FiX size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Star Rating */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2">Select Your Rating *</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setRating(star)}
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                      rating >= star
                        ? 'bg-amber-400 text-white shadow-md scale-105'
                        : 'bg-slate-100 text-slate-400 hover:bg-amber-50 hover:text-amber-400'
                    }`}
                  >
                    <FiStar size={20} className={rating >= star ? 'fill-current' : ''} />
                  </button>
                ))}
              </div>
            </div>

            {!user && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Your Name</label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-3 text-slate-400" size={15} />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-3 text-slate-400" size={15} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="john@email.com"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Your Feedback / Review *</label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you think about this product or service experience..."
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium resize-none focus:bg-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <FiSend size={14} /> Submit Feedback
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
