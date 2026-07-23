import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import {
  FiCode, FiSmartphone, FiCloud, FiShield, FiTrendingUp, FiUsers,
  FiDatabase, FiLayers, FiArrowRight, FiCheck, FiPackage, FiFilter, FiTag
} from 'react-icons/fi'
import api from '../../lib/api'
import TiltCard from '../../components/ui/TiltCard'
import { mediaUrl } from '../../lib/media'

const ICON_MAP = { FiCode, FiSmartphone, FiCloud, FiShield, FiTrendingUp, FiUsers, FiDatabase, FiLayers }

const STATIC_PRODUCTS = [
  { _id: 'p1', icon: 'FiLayers', title: 'Mobile Shop ERP', category: 'ERP', colorFrom: '#3b82f6', colorTo: '#1d4ed8', description: 'Complete ERP system for mobile phone shops — inventory, sales, repairs, and billing.', features: ['Inventory management', 'Sales & billing', 'Repair tracking', 'Multi-branch support'], priceText: 'From LKR 35,000' },
  { _id: 'p2', icon: 'FiUsers', title: 'Salon Management ERP', category: 'ERP', colorFrom: '#ec4899', colorTo: '#be185d', description: 'Full-featured salon management system with appointments, staff, and billing.', features: ['Appointment booking', 'Staff management', 'POS & billing', 'Client history'], priceText: 'From LKR 28,000' },
  { _id: 'p3', icon: 'FiDatabase', title: 'Restaurant & Hotel ERP', category: 'ERP', colorFrom: '#f97316', colorTo: '#ea580c', description: 'Restaurant and hotel management with table orders, kitchen display, and billing.', features: ['Table management', 'Kitchen display', 'Room booking', 'POS system'], priceText: 'From LKR 45,000' },
  { _id: 'p4', icon: 'FiPackage', title: 'Hardware Distribution ERP', category: 'ERP', colorFrom: '#64748b', colorTo: '#475569', description: 'Hardware store management with stock control, orders, and supplier management.', features: ['Stock control', 'Supplier management', 'Purchase orders', 'Reports'], priceText: 'From LKR 40,000' },
]

export default function SoftwareProducts() {
  const [activeCategory, setActiveCategory] = useState('All')

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
                          <div className="w-16 h-16 rounded-2xl mb-6 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 relative z-20 overflow-hidden border border-slate-100 bg-white">
                            <img src={mediaUrl(s.imageUrl)} alt={s.title} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 relative bg-primary z-20"
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
                          <h3 className="text-xl font-bold text-primary font-heading mb-3 leading-tight group-hover:text-blue-600 transition-colors">{s.title}</h3>
                          <div className="text-slate-500 text-sm leading-relaxed mb-6 flex-1 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4" dangerouslySetInnerHTML={{ __html: s.desc || s.description }} />
                          <div className="space-y-2 mb-6 bg-slate-50/50 rounded-xl p-3 border border-slate-100/50">
                            {(s.features || []).slice(0, 4).map(f => (
                              <div key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                                <div className="mt-0.5 bg-emerald-100 rounded-full p-0.5"><FiCheck className="text-emerald-600 flex-shrink-0" size={10} /></div>
                                <span className="leading-snug">{f}</span>
                              </div>
                            ))}
                            {(s.features || []).length > 4 && <p className="text-xs text-slate-400 pl-6 font-medium">+{s.features.length - 4} more</p>}
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-5 border-t border-slate-100 mt-auto relative z-20">
                          <div className="flex flex-col">
                            <span className="text-secondary font-black text-lg tracking-tight">{s.price || s.priceText}</span>
                            {s.priceType && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{s.priceType.replace('-', ' ')}</span>}
                          </div>
                          <a href="https://raxwo.net/lets-talk/" className="text-secondary text-sm font-medium flex items-center gap-1 hover:gap-2 transition-all">
                            Get quote <FiArrowRight size={14} />
                          </a>
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
          <a href="https://raxwo.net/lets-talk/" className="btn-primary btn-lg">Request a Free Demo <FiArrowRight /></a>
        </div>
      </section>
    </div>
  )
}
