import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FiFilter, FiPackage, FiArrowRight } from 'react-icons/fi'
import api from '../../lib/api'
import ProductServiceCard from '../../components/showcase/ProductServiceCard'
import AllFeaturesModal from '../../components/showcase/AllFeaturesModal'
import QuoteModal from '../../components/showcase/QuoteModal'
import FeedbackModal from '../../components/showcase/FeedbackModal'
import SEO from '../../components/common/SEO'
import { mediaUrl } from '../../lib/media'

// ... static products ...


const STATIC_PRODUCTS = [
  {
    _id: 'p1',
    icon: 'FiLayers',
    title: 'Mobile Shop ERP System',
    badge: 'ERP',
    category: 'ERP',
    colorFrom: '#3b82f6',
    colorTo: '#1d4ed8',
    tagline: 'Complete ERP system for mobile phone shops — inventory, IMEIs, sales, repairs, and billing.',
    description: 'All-in-one software for mobile shops. Manage device serials, IMEIs, repair jobs, sales invoices, stock inventory, and multi-branch operations in real-time.',
    topHighlights: ['IMEI & Serial Number Tracking', 'Repair Job Sheets & Status SMS', 'Multi-Branch Inventory Sync', 'POS Sales & Instant Invoicing'],
    categorizedFeatures: [
      { categoryName: 'Inventory & Barcodes', items: ['IMEI/Serial number tracking', 'Barcode scanner support', 'Stock alert thresholds', 'Multi-store transfers'] },
      { categoryName: 'Sales & POS', items: ['Quick touch POS', 'Thermal receipt printing', 'Customer credit limits', 'Cash & Card splitting'] },
      { categoryName: 'Repair Management', items: ['Job sheet creation', 'Technician assignments', 'Status tracking SMS', 'Spare parts cost tracking'] }
    ],
    demoUrl: 'https://demo.raxwo.net/mobileshop',
    demoUsername: 'admin@mobiledemo.com',
    demoPassword: 'demo123',
    autoLoginUrl: 'https://demo.raxwo.net/mobileshop/#autologin=true&user=admin&pass=demo123',
    price: 35000,
    currency: 'LKR',
    billingPeriod: 'one-time',
    priceText: 'From LKR 35,000 / one-time',
    contactActionType: 'whatsapp',
    whatsappNumber: '94770000000'
  },
  {
    _id: 'p2',
    icon: 'FiUsers',
    title: 'Salon & Spa Management ERP',
    badge: 'SaaS',
    category: 'SaaS',
    colorFrom: '#ec4899',
    colorTo: '#be185d',
    tagline: 'Full-featured salon management system with appointment booking, staff commissions, and billing.',
    description: 'Streamline your salon operations with online appointment booking, stylist commission calculations, client history, inventory tracking, and automated SMS reminders.',
    topHighlights: ['Online Appointment Booking', 'Staff Commission Calculations', 'Client History & Preferences', 'SMS Reminders & Marketing'],
    categorizedFeatures: [
      { categoryName: 'Appointments', items: ['Calendar booking grid', 'Staff availability slotting', 'Client self-booking portal', 'Automated SMS reminders'] },
      { categoryName: 'Staff & Payroll', items: ['Commission calculation', 'Attendance tracking', 'Daily performance metrics', 'Tip tracking'] }
    ],
    demoUrl: 'https://demo.raxwo.net/salon',
    demoUsername: 'admin@salondemo.com',
    demoPassword: 'demo123',
    autoLoginUrl: 'https://demo.raxwo.net/salon/#autologin=true&user=admin&pass=demo123',
    price: 28000,
    currency: 'LKR',
    billingPeriod: 'one-time',
    priceText: 'From LKR 28,000 / one-time',
    contactActionType: 'whatsapp',
    whatsappNumber: '94770000000'
  },
  {
    _id: 'p3',
    icon: 'FiDatabase',
    title: 'Restaurant & Hotel POS ERP',
    badge: 'ERP',
    category: 'ERP',
    colorFrom: '#f97316',
    colorTo: '#ea580c',
    tagline: 'Restaurant and hotel management with table orders, kitchen display system (KDS), and billing.',
    description: 'Elevate dining and hotel management with wireless tablet ordering, Kitchen Display Screens (KDS), room booking management, recipe costing, and ingredient stock tracking.',
    topHighlights: ['Wireless Table Ordering', 'Kitchen Display System (KDS)', 'Room Booking & Check-in', 'Recipe & Ingredient Costing'],
    categorizedFeatures: [
      { categoryName: 'Restaurant POS', items: ['Visual floor table layout', 'Order splitting & merging', 'KDS real-time display', 'Order status updates'] },
      { categoryName: 'Hotel & Rooms', items: ['Room reservation grid', 'Housekeeping status', 'Folio & room service billing', 'Guest check-in/out'] }
    ],
    demoUrl: 'https://demo.raxwo.net/restaurant',
    demoUsername: 'admin@hoteldemo.com',
    demoPassword: 'demo123',
    autoLoginUrl: 'https://demo.raxwo.net/restaurant/#autologin=true&user=admin&pass=demo123',
    price: 45000,
    currency: 'LKR',
    billingPeriod: 'one-time',
    priceText: 'From LKR 45,000 / one-time',
    contactActionType: 'whatsapp',
    whatsappNumber: '94770000000'
  },
  {
    _id: 'p4',
    icon: 'FiPackage',
    title: 'Hardware & Distribution ERP',
    badge: 'ERP',
    category: 'ERP',
    colorFrom: '#64748b',
    colorTo: '#475569',
    tagline: 'Hardware store management with stock control, wholesale orders, and supplier management.',
    description: 'Manage complex hardware distribution inventory, bulk supplier purchases, credit control, batch/lot tracking, and multi-location warehouses with ease.',
    topHighlights: ['Warehouse Stock Control', 'Batch & Lot Tracking', 'Supplier Purchase Orders', 'Customer Credit Limit Checks'],
    categorizedFeatures: [
      { categoryName: 'Distribution', items: ['Batch & Serial tracking', 'Supplier credit management', 'Purchase order workflow', 'Despatch notes & Gate pass'] }
    ],
    demoUrl: 'https://demo.raxwo.net/hardware',
    demoUsername: 'admin@hardwaredemo.com',
    demoPassword: 'demo123',
    autoLoginUrl: 'https://demo.raxwo.net/hardware/#autologin=true&user=admin&pass=demo123',
    price: 40000,
    currency: 'LKR',
    billingPeriod: 'one-time',
    priceText: 'From LKR 40,000 / one-time',
    contactActionType: 'whatsapp',
    whatsappNumber: '94770000000'
  }
]

export default function SoftwareProducts() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [selectedFeaturesItem, setSelectedFeaturesItem] = useState(null)
  const [selectedQuoteItem, setSelectedQuoteItem] = useState(null)
  const [selectedFeedbackItem, setSelectedFeedbackItem] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['public-products'],
    queryFn: () => api.get('/content/services').then(r => r.data),
  })

  const raw = (data?.services || []).filter(s => s.type === 'product')
  const baseProducts = isLoading ? [] : (raw.length > 0 ? raw : STATIC_PRODUCTS)

  const categories = ['All', ...Array.from(new Set(baseProducts.map(s => s.badge || s.category).filter(Boolean)))]
  const filtered = activeCategory === 'All'
    ? baseProducts
    : baseProducts.filter(s => (s.badge || s.category) === activeCategory)

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen">
      <SEO
        title="Software Products & SaaS ERP Solutions | Raxwo Technology"
        description="Discover Raxwo's enterprise software products: Mobile Shop ERP, Gym Management, POS systems, Hotel & Restaurant ERP, and custom business platforms in Sri Lanka."
        keywords="Software Products Sri Lanka, SaaS ERP, Mobile Shop Management Software, POS System Sri Lanka, Gym Management Software, Enterprise Software Platforms"
        schema={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Raxwo Software Products & Enterprise Platforms',
          itemListElement: baseProducts.map((p, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            name: p.title,
            description: p.description || p.tagline,
            url: `https://manage.raxwo.net/software-products/${p._id || p.id}`
          }))
        }}
      />
      {/* Hero Header */}
      <section className="bg-[#0C0227] section-padding pt-32 text-center relative overflow-hidden text-white">
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-20 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />
        </div>
        <div className="container-max relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex flex-col items-center">
            <span className="badge bg-white/10 text-white border border-white/20 mb-6 shadow-xl px-4 py-2 text-xs uppercase font-bold tracking-wider">
              Ready-Made Software Solutions
            </span>
            <h1 className="text-3xl sm:text-5xl font-bold text-white font-heading mb-6 tracking-tight drop-shadow-2xl">
              Corporate <span className="text-[#20b2f5]">Software Products</span> &amp; ERP Systems
            </h1>
            <p className="text-white/80 max-w-2xl mx-auto text-base sm:text-xl leading-relaxed font-normal">
              High-performance, ready-to-deploy ERP and SaaS management systems built for Sri Lankan businesses with instant 1-Click Auto Login Demos.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Product Logo Strip */}
      {baseProducts.length > 0 && (
        <section className="bg-white border-b border-slate-200/80 py-8 relative overflow-hidden">
          <div className="container-max">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Featured Ready-to-Deploy Platforms
                </h3>
              </div>
              <span className="text-xs font-medium text-slate-400">
                {baseProducts.length} Enterprise Solutions · Click any product to explore
              </span>
            </div>

            {/* Clean Grid of Product Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {baseProducts.map((p, i) => {
                const rawTitle = (p.title || '').replace(/^["'\s]+|["'\s]+$/g, '')
                // Extract clean brand name (first word or word before hyphen/dash)
                const brandMatch = rawTitle.match(/^([A-Za-z0-9]+)/)
                const brandName = brandMatch ? brandMatch[1] : (rawTitle.split(/—|-|\|/)[0].trim() || rawTitle)
                const categoryTag = p.badge || p.category || 'ERP'
                const logoSrc = p.logoUrl || p.imageUrl

                const handleProductChipClick = () => {
                  const targetCat = p.badge || p.category
                  if (targetCat && activeCategory !== 'All' && activeCategory !== targetCat) {
                    setActiveCategory('All')
                  }
                  setTimeout(() => {
                    const el = document.getElementById(`product-${p._id || p.id || ''}`)
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      el.classList.add('ring-4', 'ring-[#20b2f5]/50')
                      setTimeout(() => el.classList.remove('ring-4', 'ring-[#20b2f5]/50'), 2000)
                    }
                  }, 100)
                }

                return (
                  <motion.button
                    key={p._id || i}
                    type="button"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    onClick={handleProductChipClick}
                    title={rawTitle}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50/70 hover:bg-white border border-slate-200/80 hover:border-blue-300 hover:shadow-md transition-all duration-200 group text-center cursor-pointer relative"
                  >
                    <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-blue-600 transition-colors">
                      {categoryTag}
                    </span>
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-200/80 p-1.5 flex items-center justify-center shrink-0 mb-2 shadow-2xs group-hover:scale-105 group-hover:border-blue-200 transition-all">
                      {logoSrc ? (
                        <img
                          src={mediaUrl(logoSrc)}
                          alt={brandName}
                          className="w-full h-full object-contain mix-blend-multiply"
                        />
                      ) : (
                        <FiPackage size={18} className="text-slate-400" />
                      )}
                    </div>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-[#20b2f5] transition-colors truncate max-w-full">
                      {brandName}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Category Filter Sticky Bar */}
      <section className="bg-white/95 backdrop-blur-md py-4 border-y border-slate-200/80 sticky top-0 z-40 shadow-xs">
        <div className="container-max">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-1">
            <FiFilter size={14} className="text-slate-400 shrink-0" />
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeCategory === cat ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Products Showcase Grid */}
      <section className="section-padding bg-slate-50">
        <div className="container-max">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {filtered.map((item) => (
                <ProductServiceCard
                  key={item._id || item.title}
                  item={item}
                  onViewFeatures={(itemToView) => setSelectedFeaturesItem(itemToView)}
                  onGetQuote={(itemToQuote) => setSelectedQuoteItem(itemToQuote)}
                  onFeedback={(itemToFb) => setSelectedFeedbackItem(itemToFb)}
                />
              ))}
            </motion.div>
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="text-center py-20 text-slate-500">
              <FiPackage size={40} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-semibold">No software products in this category yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="section-padding bg-[#0C0227] text-white text-center">
        <div className="container-max">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Need a Custom Software Module?</h2>
          <p className="text-slate-300 mb-8 max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
            All our products can be tailored and integrated into your exact business workflows. Contact our technical engineering team for a personalized solution.
          </p>
          <Link to="/contact" className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xl inline-flex items-center gap-2 transition-all">
            Request Custom Development <FiArrowRight size={14} />
          </Link>
        </div>
      </section>



      {/* Modals */}
      {selectedFeaturesItem && (
        <AllFeaturesModal
          item={selectedFeaturesItem}
          onClose={() => setSelectedFeaturesItem(null)}
        />
      )}
      {selectedQuoteItem && (
        <QuoteModal
          item={selectedQuoteItem}
          onClose={() => setSelectedQuoteItem(null)}
        />
      )}
      {selectedFeedbackItem && (
        <FeedbackModal
          item={selectedFeedbackItem}
          onClose={() => setSelectedFeedbackItem(null)}
        />
      )}
    </div>
  )
}

