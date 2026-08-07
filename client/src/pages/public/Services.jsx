import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FiFilter, FiLayers, FiArrowRight } from 'react-icons/fi'
import api from '../../lib/api'
import ProductServiceCard from '../../components/showcase/ProductServiceCard'
import AllFeaturesModal from '../../components/showcase/AllFeaturesModal'
import QuoteModal from '../../components/showcase/QuoteModal'

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
  const [selectedFeaturesItem, setSelectedFeaturesItem] = useState(null)
  const [selectedQuoteItem, setSelectedQuoteItem] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['public-services'],
    queryFn: () => api.get('/content/services').then(r => r.data),
  })

  const raw = (data?.services || []).filter(s => s.type === 'service')
  const baseServices = isLoading ? [] : (raw.length > 0 ? raw : STATIC_SERVICES)

  const categories = ['All', ...Array.from(new Set(baseServices.map(s => s.badge || s.category).filter(Boolean)))]
  const filtered = activeCategory === 'All'
    ? baseServices
    : baseServices.filter(s => (s.badge || s.category) === activeCategory)

  return (
    <div className="bg-slate-950 text-white min-h-screen">
      {/* Hero Header */}
      <section className="bg-gradient-hero section-padding pt-32 text-center relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-20 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />
        </div>
        <div className="container-max relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex flex-col items-center">
            <span className="badge bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 mb-6 shadow-xl px-4 py-2 text-xs uppercase font-bold tracking-wider">
              Engineering Services &amp; Solutions
            </span>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white font-heading mb-6 tracking-tight drop-shadow-2xl">
              Software <span className="text-[#20b2f5]">Engineering Services</span>
            </h1>
            <p className="text-slate-300 max-w-2xl mx-auto text-base sm:text-xl leading-relaxed font-normal">
              Bespoke web application development, mobile engineering, cloud infrastructure, and enterprise software consulting.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Category Filter */}
      <section className="bg-slate-900/90 backdrop-blur-md py-5 border-y border-slate-800 sticky top-0 z-40 shadow-xl">
        <div className="container-max">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-1">
            <FiFilter size={14} className="text-slate-400 shrink-0" />
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeCategory === cat ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Services Showcase Grid */}
      <section className="section-padding bg-slate-950">
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
                />
              ))}
            </motion.div>
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="text-center py-20 text-slate-400">
              <FiLayers size={40} className="mx-auto mb-3 text-slate-600" />
              <p className="text-sm font-semibold">No services in this category yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="section-padding bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border-t border-slate-800 text-center">
        <div className="container-max">
          <h2 className="text-3xl font-extrabold text-white mb-4">Have an Idea or Specification?</h2>
          <p className="text-slate-300 mb-8 max-w-xl mx-auto text-sm leading-relaxed">
            Our engineering team will assist in refining your requirements and building a scalable software system.
          </p>
          <Link to="/contact" className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xl inline-flex items-center gap-2 transition-all">
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
    </div>
  )
}
