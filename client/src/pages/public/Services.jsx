import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FiFilter, FiLayers, FiArrowRight, FiSearch, FiX, FiPackage, FiCpu } from 'react-icons/fi'
import api from '../../lib/api'
import ProductServiceCard from '../../components/showcase/ProductServiceCard'
import AllFeaturesModal from '../../components/showcase/AllFeaturesModal'
import QuoteModal from '../../components/showcase/QuoteModal'
import FeedbackModal from '../../components/showcase/FeedbackModal'
import SEO from '../../components/common/SEO'
import { STATIC_PRODUCTS } from './SoftwareProducts'


const STATIC_SERVICES = [
  {
    _id: 's1',
    icon: 'FiCode',
    title: 'Custom Web Application Development',
    badge: 'Custom Web',
    category: 'Development',
    colorFrom: '#3b82f6',
    colorTo: '#1d4ed8',
    tagline: 'High-performance React, Node.js, and cloud web applications engineered for scalability.',
    description: 'We design and build bespoke web portals, enterprise web apps, customer self-service dashboards, and high-converting web applications tailored to your exact business rules.',
    topHighlights: ['React & Next.js Frontends', 'Node.js REST & GraphQL APIs', 'PostgreSQL / MongoDB Design', 'AWS / Cloud Deployment'],
    categorizedFeatures: [
      { categoryName: 'Frontend Architecture', items: ['Responsive Tailwind UI', 'PWA & offline capabilities', 'Real-time WebSocket feeds', 'Accessibility & SEO'] },
      { categoryName: 'Backend & Security', items: ['JWT & OAuth2 authentication', 'Role-based access control', 'Database query optimization', 'Automated data backup'] }
    ],
    demoUrl: 'https://demo.raxwo.net/webapp',
    demoUsername: 'client@demo.com',
    demoPassword: 'demo123',
    autoLoginUrl: 'https://demo.raxwo.net/webapp/#autologin=true&user=client@demo.com&pass=demo123',
    price: 150000,
    currency: 'LKR',
    billingPeriod: 'one-time',
    priceText: 'From LKR 150,000 / project',
    contactActionType: 'whatsapp',
    whatsappNumber: '94770000000'
  },
  {
    _id: 's2',
    icon: 'FiSmartphone',
    title: 'Cross-Platform Mobile App Development',
    badge: 'Mobile App',
    category: 'Development',
    colorFrom: '#22c55e',
    colorTo: '#16a34a',
    tagline: 'Native performance iOS & Android mobile applications built with React Native.',
    description: 'Launch your mobile app faster with React Native. Complete with push notifications, offline local database synchronization, location GPS tracking, and payment gateways.',
    topHighlights: ['iOS & Android App Store Ready', 'Push Notification Engine', 'Offline Mode Sync', 'In-App Payment Gateways'],
    categorizedFeatures: [
      { categoryName: 'Mobile Core', items: ['Cross-platform codebase', 'Biometric login (FaceID/Fingerprint)', 'Location & Mapbox integration', 'Camera & QR Scanner'] }
    ],
    demoUrl: 'https://demo.raxwo.net/mobileapp',
    demoUsername: 'user@mobile.com',
    demoPassword: 'demo123',
    autoLoginUrl: 'https://demo.raxwo.net/mobileapp/#autologin=true&user=user@mobile.com&pass=demo123',
    price: 250000,
    currency: 'LKR',
    billingPeriod: 'one-time',
    priceText: 'From LKR 250,000 / project',
    contactActionType: 'whatsapp',
    whatsappNumber: '94770000000'
  },
  {
    _id: 's3',
    icon: 'FiCloud',
    title: 'Cloud Infrastructure & DevOps Support',
    badge: 'Cloud',
    category: 'Infrastructure',
    colorFrom: '#a855f7',
    colorTo: '#7c3aed',
    tagline: 'End-to-end AWS/Azure cloud setup, Docker containerization, and CI/CD pipelines.',
    description: 'Migrate to the cloud or optimize your current infrastructure. 24/7 server monitoring, automated deployments, auto-scaling, and security hardening.',
    topHighlights: ['AWS / GCP Cloud Architecture', 'Docker & Kubernetes Setup', 'Automated CI/CD Pipelines', '24/7 Uptime & Monitoring'],
    categorizedFeatures: [
      { categoryName: 'DevOps & Monitoring', items: ['Terraform Infrastructure', 'Grafana & Prometheus alerts', 'Zero-downtime deployments', 'SSL & Firewall config'] }
    ],
    demoUrl: 'https://demo.raxwo.net/cloud',
    demoUsername: 'devops@demo.com',
    demoPassword: 'demo123',
    autoLoginUrl: 'https://demo.raxwo.net/cloud/#autologin=true&user=devops@demo.com&pass=demo123',
    price: 80000,
    currency: 'LKR',
    billingPeriod: 'monthly',
    priceText: 'From LKR 80,000 / month',
    contactActionType: 'whatsapp',
    whatsappNumber: '94770000000'
  }
]

export default function Services() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All') // 'All' | 'product' | 'service'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFeaturesItem, setSelectedFeaturesItem] = useState(null)
  const [selectedQuoteItem, setSelectedQuoteItem] = useState(null)
  const [selectedFeedbackItem, setSelectedFeedbackItem] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['public-services'],
    queryFn: () => api.get('/content/services').then(r => r.data),
  })

  // Show both products and services added from the system
  const raw = data?.services || []
  const allStatic = [...STATIC_SERVICES, ...STATIC_PRODUCTS]
  const baseServices = isLoading ? [] : (raw.length > 0 ? raw : allStatic)

  const categories = ['All', ...Array.from(new Set(
    baseServices
      .filter(s => typeFilter === 'All' || (s.type || 'service') === typeFilter)
      .map(s => s.badge || s.category)
      .filter(Boolean)
  ))]

  const filtered = baseServices.filter(item => {
    // Type filter ('All' | 'product' | 'service')
    const itemType = item.type || 'service'
    const matchesType = typeFilter === 'All' || itemType === typeFilter

    // Category filter
    const matchesCategory = activeCategory === 'All' || (item.badge || item.category) === activeCategory

    // Search query
    const q = searchQuery.toLowerCase().trim()
    if (!q) return matchesType && matchesCategory

    const title = (item.title || '').toLowerCase()
    const tagline = (item.tagline || '').toLowerCase()
    const desc = (item.description || '').toLowerCase()
    const badge = (item.badge || item.category || '').toLowerCase()
    const highlights = Array.isArray(item.topHighlights) ? item.topHighlights.join(' ').toLowerCase() : ''
    const features = Array.isArray(item.categorizedFeatures)
      ? item.categorizedFeatures.map(c => (c.items || []).join(' ')).join(' ').toLowerCase()
      : (Array.isArray(item.features) ? item.features.join(' ').toLowerCase() : '')

    const matchesSearch = (
      title.includes(q) ||
      tagline.includes(q) ||
      desc.includes(q) ||
      badge.includes(q) ||
      highlights.includes(q) ||
      features.includes(q)
    )

    return matchesType && matchesCategory && matchesSearch
  })

  const productCount = baseServices.filter(s => s.type === 'product').length
  const serviceCount = baseServices.filter(s => (s.type || 'service') !== 'product').length

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen">
      <SEO
        title="Software Engineering & Custom IT Services | Raxwo Technology"
        description="Explore Raxwo's engineering services: custom enterprise software, web development (React/Node.js), mobile apps (iOS/Android), cloud infrastructure, and IT consultancy."
        keywords="Software Engineering Services, Custom Web Development, Mobile Apps Sri Lanka, Cloud Infrastructure AWS, Enterprise Software Development, IT Consulting Colombo"
        schema={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          serviceType: 'Software Development & IT Consultancy',
          provider: {
            '@type': 'Organization',
            name: 'Raxwo Technology',
            url: 'https://manage.raxwo.net'
          },
          areaServed: 'Sri Lanka & Global',
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: 'Software Engineering Services & Products',
            itemListElement: baseServices.map((s, idx) => ({
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: s.title,
                description: s.description || s.tagline
              },
              position: idx + 1
            }))
          }
        }}
      />
      {/* Hero Header */}
      <section className="bg-[#0C0227] section-padding pt-32 text-center relative overflow-hidden text-white">
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-20 w-48 h-48 bg-[#20b2f5]/10 rounded-full blur-3xl" />
        </div>
        <div className="container-max relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex flex-col items-center">
            <span className="badge bg-white/10 text-white border border-white/20 mb-6 shadow-xl px-4 py-2 text-xs uppercase font-bold tracking-wider">
              Engineering Services &amp; Products
            </span>
            <h1 className="text-3xl sm:text-5xl font-bold text-white font-heading mb-6 tracking-tight drop-shadow-2xl">
              Software <span className="text-[#20b2f5]">Products &amp; Engineering Services</span>
            </h1>
            <p className="text-white/80 max-w-2xl mx-auto text-base sm:text-xl leading-relaxed font-normal">
              Explore bespoke software engineering services and ready-to-deploy enterprise SaaS &amp; ERP platforms built for your business.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Search, Type & Category Filter Sticky Bar */}
      <section className="bg-white/95 backdrop-blur-md py-4 border-y border-slate-200/80 sticky top-0 z-40 shadow-xs">
        <div className="container-max space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full md:w-80 lg:w-96">
              <FiSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, services, or features..."
                className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-100/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#20b2f5] focus:border-transparent transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <FiX size={14} />
                </button>
              )}
            </div>

            {/* Type Switcher: All, Products, Services */}
            <div className="inline-flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 self-start md:self-auto">
              <button
                type="button"
                onClick={() => { setTypeFilter('All'); setActiveCategory('All'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  typeFilter === 'All'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Solutions ({baseServices.length})
              </button>
              <button
                type="button"
                onClick={() => { setTypeFilter('product'); setActiveCategory('All'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  typeFilter === 'product'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FiPackage size={13} />
                Products ({productCount})
              </button>
              <button
                type="button"
                onClick={() => { setTypeFilter('service'); setActiveCategory('All'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  typeFilter === 'service'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FiCpu size={13} />
                Services ({serviceCount})
              </button>
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <FiFilter size={14} className="text-slate-400 shrink-0 mr-1" />
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Services & Products Showcase Grid */}
      <section className="section-padding bg-slate-50">
        <div className="container-max">
          {searchQuery && (
            <div className="flex items-center justify-between gap-2 mb-6 p-3 rounded-xl bg-blue-50/80 border border-blue-100 text-xs text-blue-900">
              <span>
                Found <strong className="font-bold text-blue-700">{filtered.length}</strong> {filtered.length === 1 ? 'solution' : 'solutions'} matching &ldquo;<span className="font-semibold text-slate-800">{searchQuery}</span>&rdquo;
              </span>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
              >
                Clear Search
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory + '-' + typeFilter}
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
              <FiLayers size={40} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-semibold">
                {searchQuery
                  ? `No software products or services found matching "${searchQuery}".`
                  : 'No solutions found in this category.'}
              </p>
              {(searchQuery || activeCategory !== 'All' || typeFilter !== 'All') && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setActiveCategory('All'); setTypeFilter('All'); }}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-blue-500 transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  Reset Search &amp; Filters
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="section-padding bg-[#0C0227] text-white text-center">
        <div className="container-max">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Have an Idea or Specification?</h2>
          <p className="text-slate-300 mb-8 max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
            Our software engineering team will assist in refining your requirements and building a scalable custom system.
          </p>
          <Link to="/contact" className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xl inline-flex items-center gap-2 transition-all">
            Schedule Technical Call <FiArrowRight size={14} />
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

