import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  FiCode, FiSmartphone, FiCloud, FiShield, FiTrendingUp, FiUsers,
  FiDatabase, FiLayers, FiArrowRight, FiCheck, FiPackage, FiFilter, FiTag, FiX, FiStar, FiInfo
} from 'react-icons/fi'
import api from '../../lib/api'
import TiltCard from '../../components/ui/TiltCard'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'
import { mediaUrl } from '../../lib/media'

const ICON_MAP = { FiCode, FiSmartphone, FiCloud, FiShield, FiTrendingUp, FiUsers, FiDatabase, FiLayers }

const STATIC_PRODUCTS = [
  { _id: 'p1', icon: 'FiLayers', title: 'Mobile Shop ERP', category: 'ERP', colorFrom: '#3b82f6', colorTo: '#1d4ed8', description: 'Complete ERP system for mobile phone shops — inventory, sales, repairs, and billing.', features: ['Inventory management', 'Sales & billing', 'Repair tracking', 'Multi-branch support', 'Barcode scanning', 'Supplier management'], priceText: 'From LKR 35,000' },
  { _id: 'p2', icon: 'FiUsers', title: 'Salon Management ERP', category: 'ERP', colorFrom: '#ec4899', colorTo: '#be185d', description: 'Full-featured salon management system with appointments, staff, and billing.', features: ['Appointment booking', 'Staff management', 'POS & billing', 'Client history', 'Commission management', 'SMS reminders'], priceText: 'From LKR 28,000' },
  { _id: 'p3', icon: 'FiDatabase', title: 'Restaurant & Hotel ERP', category: 'ERP', colorFrom: '#f97316', colorTo: '#ea580c', description: 'Restaurant and hotel management with table orders, kitchen display, and billing.', features: ['Table management', 'Kitchen display', 'Room booking', 'POS system', 'Recipe costing', 'Multi-location sync'], priceText: 'From LKR 45,000' },
  { _id: 'p4', icon: 'FiPackage', title: 'Hardware Distribution ERP', category: 'ERP', colorFrom: '#64748b', colorTo: '#475569', description: 'Hardware store management with stock control, orders, and supplier management.', features: ['Stock control', 'Supplier management', 'Purchase orders', 'Reports', 'Batch tracking', 'Credit limits'], priceText: 'From LKR 40,000' },
]

/* ─── Feedback Modal ─────────────────────────────────────────────── */
function FeedbackModal({ service, onClose }) {
  const { user } = useAuthStore()
  const { register, handleSubmit, reset, formState: { errors } } = useForm()
  const [loading, setLoading] = useState(false)
  const [rating, setRating] = useState(0)

  const onSubmit = async (data) => {
    if (rating === 0) return toast.error('Please select a rating')
    setLoading(true)
    try {
      await api.post('/feedback', {
        ...data,
        rating,
        service: service._id?.startsWith('p') ? null : service._id,
        name: user?.name || data.name || 'Anonymous',
        email: user?.email || data.email || '',
      })
      toast.success('Thank you for your feedback!')
      reset()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit feedback')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50">
          <div>
            <h3 className="font-bold text-lg text-primary">Give Feedback</h3>
            <p className="text-xs text-slate-500 mt-0.5">For product: <span className="font-semibold text-secondary">{service.title}</span></p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl border border-slate-200 transition-all">
            <FiX size={18} />
          </button>
        </div>
        <div className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {!user && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Name</label>
                  <input {...register('name')} className="form-input" placeholder="Your name" />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input {...register('email')} type="email" className="form-input" placeholder="your@email.com" />
                </div>
              </div>
            )}
            <div>
              <label className="form-label">Rating <span className="text-red-500">*</span></label>
              <div className="flex gap-2 mt-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setRating(star)}
                    className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${
                      rating >= star ? 'bg-amber-400 text-white shadow-lg scale-110' : 'bg-slate-100 text-slate-400 hover:bg-amber-50 hover:text-amber-400'
                    }`}
                  >
                    <FiStar size={18} className={rating >= star ? 'fill-current' : ''} />
                  </button>
                ))}
                {rating > 0 && (
                  <span className="ml-2 self-center text-sm font-semibold text-amber-500">
                    {['','Poor','Fair','Good','Great','Excellent'][rating]}
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="form-label">Message <span className="text-red-500">*</span></label>
              <textarea
                {...register('message', { required: 'Please write your feedback' })}
                className="form-input resize-none"
                rows={4}
                placeholder="Tell us what you think about this software product..."
              />
              {errors.message && <p className="form-error">{errors.message.message}</p>}
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 mt-2">
              {loading ? <span className="spinner" /> : 'Submit Feedback'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}

/* ─── Product Detail Modal ───────────────────────────────────────── */
function ProductDetailModal({ product, onClose, onFeedbackClick }) {
  const navigate = useNavigate()
  const IconComp = product.icon

  const handleGetQuote = () => {
    onClose()
    navigate(`/booking?type=product&title=${encodeURIComponent(product.title)}&price=${encodeURIComponent(product.price || product.priceText || '')}&category=${encodeURIComponent(product.category || '')}`, {
      state: {
        type: 'product',
        title: product.title,
        price: product.price || product.priceText,
        category: product.category,
        features: product.features,
      }
    })
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto border border-slate-100"
      >
        <div className="flex items-start justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-blue-50/50 to-indigo-50/40">
          <div className="flex items-center gap-4">
            {product.imageUrl ? (
              <div className="w-16 h-16 rounded-2xl p-2 border border-slate-200 bg-white shadow-md flex items-center justify-center shrink-0">
                <img src={mediaUrl(product.imageUrl)} alt={product.title} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md shrink-0 text-white"
                style={{ backgroundImage: product.colorFrom ? `linear-gradient(135deg, ${product.colorFrom}, ${product.colorTo})` : 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
              >
                {IconComp && <IconComp size={28} className="drop-shadow-md" />}
              </div>
            )}
            <div>
              {product.category && (
                <span className="badge bg-blue-100 text-blue-700 text-[10px] uppercase font-bold tracking-wider mb-1">{product.category}</span>
              )}
              <h2 className="text-2xl font-bold text-primary font-heading leading-tight">{product.title}</h2>
              <p className="text-secondary font-black text-lg mt-0.5">{product.price || product.priceText}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl border border-slate-200 transition-all">
            <FiX size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Description</h3>
            <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap bg-slate-50 p-4 rounded-2xl border border-slate-100" dangerouslySetInnerHTML={{ __html: product.desc || product.description }} />
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Included Features ({product.features?.length || 0})</h3>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {(product.features || []).map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2.5 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                  <div className="mt-0.5 bg-emerald-100 text-emerald-600 rounded-full p-1 shrink-0"><FiCheck size={12} /></div>
                  <span className="text-xs font-medium text-slate-700 leading-snug">{feat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={() => { onClose(); onFeedbackClick(product); }}
            className="btn-ghost text-xs text-slate-600 hover:text-amber-500 flex items-center gap-1.5"
          >
            <FiStar size={14} className="text-amber-400" /> Give Feedback
          </button>
          <button onClick={handleGetQuote} className="btn-primary gap-2 px-6">
            Get Quote <FiArrowRight size={14} />
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function SoftwareProducts() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [feedbackService, setFeedbackService] = useState(null)
  const [selectedDetailProduct, setSelectedDetailProduct] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['public-products'],
    queryFn: () => api.get('/content/services').then(r => r.data),
  })

  const raw = (data?.services || []).filter(s => s.type === 'product')
  const baseProducts = isLoading ? [] : (raw.length > 0 ? raw : STATIC_PRODUCTS)
  const displayProducts = baseProducts.map(s => ({
    ...s,
    icon: ICON_MAP[s.icon] || FiPackage,
    desc: s.description,
    features: s.features || [],
    price: s.priceText || '',
    priceType: s.priceType
  }))

  const categories = ['All', ...Array.from(new Set(displayProducts.map(s => s.category).filter(Boolean)))]
  const filtered = activeCategory === 'All' ? displayProducts : displayProducts.filter(s => s.category === activeCategory)

  return (
    <div>
      {/* Header */}
      <section className="bg-gradient-hero section-padding pt-32 text-center relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-20 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
        </div>
        <div className="container-max relative">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex flex-col items-center">
            <span className="badge bg-white/10 text-white border border-white/20 mb-6 shadow-xl px-4 py-2">Software Products</span>
            <h1 className="text-2xl lg:text-4xl font-bold text-white font-heading mb-6 tracking-tight drop-shadow-2xl">
              Our <span className="text-[#20b2f5]">Software Products</span>
            </h1>
            <p className="text-white/80 max-w-2xl mx-auto text-lg md:text-xl leading-relaxed font-normal">
              Ready-made, customizable ERP and business management systems built for Sri Lankan businesses.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Category Filter */}
      <section className="bg-white py-6 border-b border-slate-100 sticky top-0 z-40 shadow-sm">
        <div className="container-max">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-1">
            <FiFilter size={14} className="text-slate-400 shrink-0" />
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                  activeCategory === cat ? 'bg-[#20b2f5] text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="section-padding bg-gray-50">
        <div className="container-max">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filtered.map((s, i) => {
                const IconComp = s.icon
                return (
                  <motion.div
                    key={s._id || s.title}
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ delay: i * 0.07, type: 'spring', stiffness: 100 }}
                    className="h-full"
                  >
                    <TiltCard className="h-full">
                      <div className="card card-body group h-full bg-white/70 backdrop-blur-md flex flex-col border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgb(0,0,0,0.12)] transition-all duration-500 rounded-3xl relative overflow-hidden z-10">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-blue-100/50 to-purple-100/50 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none -z-10" />
                        
                        {s.imageUrl ? (
                          <div
                            onClick={() => setSelectedDetailProduct(s)}
                            className="w-16 h-16 rounded-2xl mb-6 shadow-md group-hover:scale-105 transition-all duration-300 relative z-20 overflow-hidden border border-slate-200 bg-white p-2 flex items-center justify-center cursor-pointer"
                          >
                            <img src={mediaUrl(s.imageUrl)} alt={s.title} className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <div
                            onClick={() => setSelectedDetailProduct(s)}
                            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-xl group-hover:scale-105 transition-all duration-300 relative bg-primary z-20 cursor-pointer"
                            style={{ backgroundImage: s.colorFrom ? `linear-gradient(135deg, ${s.colorFrom}, ${s.colorTo})` : undefined }}
                          >
                            <div className="absolute inset-0 rounded-2xl bg-white/20 blur-sm mix-blend-overlay" />
                            {IconComp && <IconComp size={28} className="text-white drop-shadow-md relative z-10" />}
                          </div>
                        )}

                        <div className="relative z-20 flex-1 flex flex-col">
                          {s.category && (
                            <span className="inline-block self-start badge bg-blue-50/80 text-blue-700 text-[10px] uppercase font-bold tracking-wider mb-3 border border-blue-200/50">{s.category}</span>
                          )}
                          <h3
                            onClick={() => setSelectedDetailProduct(s)}
                            className="text-xl font-bold text-primary font-heading mb-3 leading-tight group-hover:text-blue-600 transition-colors cursor-pointer"
                          >
                            {s.title}
                          </h3>
                          <div className="text-slate-500 text-sm leading-relaxed mb-6 flex-1 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4" dangerouslySetInnerHTML={{ __html: s.desc || s.description }} />
                          <div className="space-y-2 mb-6 bg-slate-50/50 rounded-xl p-3 border border-slate-100/50">
                            {(s.features || []).slice(0, 4).map(f => (
                              <div key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                                <div className="mt-0.5 bg-emerald-100 rounded-full p-0.5"><FiCheck className="text-emerald-600 flex-shrink-0" size={10} /></div>
                                <span className="leading-snug">{f}</span>
                              </div>
                            ))}
                            {(s.features || []).length > 4 && (
                              <button
                                type="button"
                                onClick={() => setSelectedDetailProduct(s)}
                                className="text-xs text-secondary hover:underline pl-6 font-bold flex items-center gap-1 transition-all mt-1"
                              >
                                +{s.features.length - 4} more features (view all) →
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-5 border-t border-slate-100 mt-auto relative z-20">
                          <div className="flex flex-col">
                            <span className="text-secondary font-black text-lg tracking-tight">{s.price || s.priceText}</span>
                            {s.priceType && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{s.priceType.replace('-', ' ')}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setFeedbackService(s)}
                              className="text-slate-400 hover:text-amber-500 text-xs font-medium flex items-center gap-1 transition-all hover:gap-1.5 px-2 py-1.5 rounded-lg hover:bg-amber-50"
                              title="Give Feedback"
                            >
                              <FiStar size={12} /> Feedback
                            </button>
                            <Link
                              to={`/booking?type=product&title=${encodeURIComponent(s.title)}&price=${encodeURIComponent(s.price || s.priceText || '')}&category=${encodeURIComponent(s.category || '')}`}
                              state={{
                                type: 'product',
                                title: s.title,
                                price: s.price || s.priceText,
                                category: s.category,
                                features: s.features,
                              }}
                              className="text-secondary text-sm font-medium flex items-center gap-1 hover:gap-2 transition-all"
                            >
                              Get quote <FiArrowRight size={14} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </TiltCard>
                  </motion.div>
                )
              })}
            </motion.div>
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <FiPackage size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No products in this category yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-gradient-hero text-center">
        <div className="container-max">
          <h2 className="text-4xl font-bold text-white font-heading mb-4">Need a Custom Solution?</h2>
          <p className="text-white/70 mb-8 max-w-xl mx-auto">All our products can be customised for your business. Get in touch for a free demo and quote.</p>
          <Link to="/booking" className="btn-primary btn-lg">Request a Free Demo <FiArrowRight /></Link>
        </div>
      </section>

      {/* Modals */}
      <AnimatePresence>
        {feedbackService && (
          <FeedbackModal service={feedbackService} onClose={() => setFeedbackService(null)} />
        )}
        {selectedDetailProduct && (
          <ProductDetailModal
            product={selectedDetailProduct}
            onClose={() => setSelectedDetailProduct(null)}
            onFeedbackClick={(prod) => setFeedbackService(prod)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
