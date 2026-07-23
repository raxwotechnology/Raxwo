import { motion, AnimatePresence } from 'framer-motion'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  FiCode, FiSmartphone, FiCloud, FiShield, FiTrendingUp, FiUsers,
  FiDatabase, FiLayers, FiArrowRight, FiCheck, FiX, FiStar, FiFilter
} from 'react-icons/fi'
import api from '../../lib/api'
import TiltCard from '../../components/ui/TiltCard'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'
import { mediaUrl } from '../../lib/media'

/* ─── Static fallback services ─────────────────────────────────── */
const STATIC_SERVICES = [
  { _id: 's1', icon: 'FiCode',     title: 'Web Development',      category: 'Development', colorFrom: '#3b82f6', colorTo: '#1d4ed8', description: 'Full-stack web applications using React, Node.js, MongoDB, and modern cloud infrastructure.', features: ['React / Next.js frontends', 'Node.js / Express APIs', 'MongoDB & PostgreSQL'], priceText: 'From LKR 150,000' },
  { _id: 's2', icon: 'FiSmartphone',title: 'Mobile App Development', category: 'Development', colorFrom: '#22c55e', colorTo: '#16a34a', description: 'Cross-platform iOS and Android apps with React Native.', features: ['React Native / Expo', 'iOS & Android', 'Push notifications'], priceText: 'From LKR 250,000' },
  { _id: 's3', icon: 'FiCloud',    title: 'Cloud & DevOps',        category: 'Infrastructure', colorFrom: '#a855f7', colorTo: '#7c3aed', description: 'End-to-end cloud infrastructure setup, CI/CD pipelines.', features: ['AWS / Azure / GCP', 'Docker & Kubernetes', 'CI/CD pipelines'], priceText: 'From LKR 80,000/mo' },
  { _id: 's4', icon: 'FiLayers',   title: 'Enterprise Systems',    category: 'Enterprise',   colorFrom: '#f97316', colorTo: '#ea580c', description: 'Custom ERP, HRM, CRM, and inventory management systems.', features: ['ERP / HRM Systems', 'Custom workflows', 'Multi-role portals'], priceText: 'From LKR 500,000' },
  { _id: 's5', icon: 'FiDatabase', title: 'Database & Backend',    category: 'Infrastructure', colorFrom: '#ef4444', colorTo: '#dc2626', description: 'Database design, optimization, API development.', features: ['Database design', 'Query optimization', 'API security'], priceText: 'From LKR 100,000' },
  { _id: 's6', icon: 'FiShield',   title: 'Cybersecurity',         category: 'Security',     colorFrom: '#64748b', colorTo: '#475569', description: 'Security audits, penetration testing, vulnerability assessments.', features: ['Penetration testing', 'Security audits', 'GDPR compliance'], priceText: 'From LKR 120,000' },
]

const ICON_MAP = { FiCode, FiSmartphone, FiCloud, FiShield, FiTrendingUp, FiUsers, FiDatabase, FiLayers }

const process_steps = [
  { step: '01', title: 'Discovery',    desc: 'We analyze your requirements, business goals, and technical constraints in a free consultation session.' },
  { step: '02', title: 'Design',       desc: 'Our UI/UX team creates wireframes and prototypes. You review and approve before we write a single line of code.' },
  { step: '03', title: 'Development',  desc: 'Agile sprints with regular demos. You stay in the loop throughout the entire development cycle.' },
  { step: '04', title: 'Delivery',     desc: 'Full deployment, testing, documentation, and training. 3 months of free support included.' },
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
        service: service._id?.startsWith('s') ? null : service._id,
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
            <p className="text-xs text-slate-500 mt-0.5">For: <span className="font-semibold text-secondary">{service.title}</span></p>
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
                placeholder="Tell us what you think about this service..."
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

/* ─── Main Services Page ─────────────────────────────────────────── */
export default function Services() {
  const [feedbackService, setFeedbackService] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = 'service' // Keep variable for any internal logic that might use it, but ignore for filtering
  const activeCategory = searchParams.get('category') || 'All'

  const { data, isLoading } = useQuery({
    queryKey: ['public-services'],
    queryFn: () => api.get('/content/services').then((r) => r.data),
  })

  const raw = data?.services || []
  const fetchedTabServices = raw.filter(s => s.type !== 'product')
  const allTabServices = isLoading ? [] : (fetchedTabServices.length > 0 ? fetchedTabServices : STATIC_SERVICES)

  const displayServices = allTabServices.map((s) => ({
    ...s,
    icon: ICON_MAP[s.icon] || FiCode,
    desc: s.description,
    features: s.features || [],
    price: s.priceText || '',
    priceType: s.priceType,
  }))

  const categories = ['All', ...Array.from(new Set(displayServices.map(s => s.category).filter(Boolean)))]
  const filtered = activeCategory === 'All' ? displayServices : displayServices.filter(s => s.category === activeCategory)

  const handleTabChange = (t) => {
    setSearchParams({ tab: t })
  }
  const handleCategoryChange = (cat) => {
    const p = new URLSearchParams(searchParams)
    if (cat === 'All') p.delete('category')
    else p.set('category', cat)
    setSearchParams(p)
  }

  return (
    <div>
      {/* Header */}
      <section className="bg-gradient-hero section-padding pt-32 text-center relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-20 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
        </div>
        <div className="container-max relative">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center"
          >
            <span className="badge bg-white/10 text-white border border-white/20 mb-6 shadow-xl px-4 py-2">What We Offer</span>
            <h1 className="text-2xl lg:text-4xl font-bold text-white font-heading mb-6 tracking-tight drop-shadow-2xl">
              Our <span className="text-[#20b2f5]">Services</span>
            </h1>
            <p className="text-white/80 max-w-2xl mx-auto text-lg md:text-xl leading-relaxed font-normal">
              Premium software development services tailored for businesses in Sri Lanka and beyond.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Category Filter */}
      <section className="bg-white py-6 border-b border-slate-100 sticky top-0 z-40 shadow-sm">
        <div className="container-max">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-1">


            <>
              <FiFilter size={14} className="text-slate-400 shrink-0" />
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                    activeCategory === cat
                      ? 'bg-[#20b2f5] text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="section-padding bg-gray-50">
        <div className="container-max">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
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
                        {/* Decorative background glow */}
                        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-blue-100/50 to-purple-100/50 blur-3xl rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700 pointer-events-none -z-10" />
                        
                        {s.imageUrl ? (
                          <div className="w-16 h-16 rounded-2xl mb-6 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 relative z-20 overflow-hidden border border-slate-100 bg-white">
                            <img src={mediaUrl(s.imageUrl)} alt={s.title} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 relative bg-primary z-20"
                            style={{ backgroundImage: s.colorFrom ? `linear-gradient(135deg, ${s.colorFrom}, ${s.colorTo})` : undefined }}
                          >
                            <div className="absolute inset-0 rounded-2xl bg-white/20 blur-sm mix-blend-overlay"></div>
                            {IconComp && <IconComp size={28} className="text-white drop-shadow-md relative z-10" />}
                          </div>
                        )}
                        <div className="relative z-20 flex-1 flex flex-col">
                          {s.category && (
                            <span className="inline-block self-start badge bg-blue-50/80 text-blue-700 text-[10px] uppercase font-bold tracking-wider mb-3 border border-blue-200/50 shadow-sm">{s.category}</span>
                          )}
                          <h3 className="text-2xl font-bold text-primary font-heading mb-3 leading-tight group-hover:text-blue-600 transition-colors">{s.title}</h3>
                          <div className="text-slate-500 text-sm leading-relaxed mb-6 flex-1 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4" dangerouslySetInnerHTML={{ __html: s.desc || s.description }} />
                          
                          <div className="space-y-2 mb-6 bg-slate-50/50 rounded-xl p-3 border border-slate-100/50">
                            {(s.features || []).slice(0,4).map(f => (
                              <div key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                                <div className="mt-0.5 bg-emerald-100 rounded-full p-0.5"><FiCheck className="text-emerald-600 flex-shrink-0" size={10} /></div> 
                                <span className="leading-snug">{f}</span>
                              </div>
                            ))}
                            {(s.features || []).length > 4 && (
                              <p className="text-xs text-slate-400 pl-6 font-medium">+{s.features.length - 4} more features</p>
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
                            >
                              <FiStar size={12} /> Feedback
                            </button>
                            <a href="https://raxwo.net/lets-talk/" className="text-secondary text-sm font-medium flex items-center gap-1 hover:gap-2 transition-all">
                              Get quote <FiArrowRight size={14} />
                            </a>
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
              <FiLayers size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No services in this category yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* Process */}
      <section className="section-padding bg-white">
        <div className="container-max">
          <div className="text-center mb-14">
            <span className="badge badge-blue mb-4">How We Work</span>
            <h2 className="text-4xl font-bold text-primary font-heading">Our Development Process</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {process_steps.map((p, i) => (
              <motion.div key={p.step} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="text-center relative">
                {i < process_steps.length - 1 && <div className="hidden md:block absolute top-8 left-1/2 w-full h-0.5 bg-gradient-to-r from-secondary/30 to-transparent" />}
                <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center text-2xl font-bold font-heading mx-auto mb-4 relative z-10">
                  {p.step}
                </div>
                <h3 className="font-bold text-primary font-heading mb-2">{p.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-gradient-hero text-center">
        <div className="container-max">
          <h2 className="text-4xl font-bold text-white font-heading mb-4">Ready to Start Your Project?</h2>
          <p className="text-white/70 mb-8 max-w-xl mx-auto">Get a free consultation and project estimate from our expert team.</p>
          <a href="https://raxwo.net/lets-talk/" className="btn-primary btn-lg">Request a Free Quote <FiArrowRight /></a>
        </div>
      </section>

      <AnimatePresence>
        {feedbackService && (
          <FeedbackModal service={feedbackService} onClose={() => setFeedbackService(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
