import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  FiArrowLeft, FiCheckCircle, FiZap, FiKey, FiMessageSquare,
  FiLayers, FiCheck, FiExternalLink, FiPlay, FiPackage, FiShield,
  FiCode, FiSmartphone, FiCloud, FiTrendingUp, FiUsers, FiDatabase,
  FiStar, FiChevronRight, FiCheckSquare, FiCpu, FiLock, FiGlobe,
  FiAward, FiHeadphones, FiGrid, FiBarChart2
} from 'react-icons/fi'
import api from '../../lib/api'
import { mediaUrl } from '../../lib/media'
import QuoteModal from '../../components/showcase/QuoteModal'
import FeedbackModal from '../../components/showcase/FeedbackModal'

const ICON_MAP = {
  FiCode, FiSmartphone, FiCloud, FiShield, FiTrendingUp,
  FiUsers, FiDatabase, FiLayers, FiPackage
}

// Static Fallback Showcase Items
const STATIC_SHOWCASE_ITEMS = [
  {
    _id: 'p1',
    id: 'p1',
    icon: 'FiLayers',
    title: 'Mobile Shop ERP System',
    badge: 'SaaS ERP',
    category: 'ERP',
    colorFrom: '#2563eb',
    colorTo: '#4f46e5',
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
    id: 'p2',
    icon: 'FiUsers',
    title: 'Gym Management ERP Software',
    badge: 'SaaS ERP',
    category: 'ERP',
    colorFrom: '#ec4899',
    colorTo: '#be185d',
    tagline: 'Complete Gym Management Software with member management, coach management, attendance tracking, and billing.',
    description: 'Manage your gym with Gymora ERP. Complete Gym Management Software with member management, coach management, attendance tracking, workout planning, diet plans, billing, analytics, multi-branch support, and cloud access.',
    topHighlights: ['Member & Trainer Portals', 'Automated Attendance & QR Check-in', 'Diet & Workout Plan Builder', 'Recurring Billing & Membership Alerts'],
    categorizedFeatures: [
      { categoryName: 'Member Management', items: ['Member profile & medical history', 'QR code / Fingerprint attendance', 'Membership package renewal alerts', 'Locker allocation system'] },
      { categoryName: 'Fitness & Workout Plans', items: ['Custom workout plan builder', 'Diet & nutrition meal charts', 'Trainer progress tracking', 'Body metric logging (BMI, Weight)'] },
      { categoryName: 'Finance & Invoicing', items: ['Automatic monthly invoice generation', 'Payment gateway integration', 'Overdue fee alerts via WhatsApp', 'Expense & cash flow analytics'] }
    ],
    demoUrl: 'https://demo.raxwo.net/gymora',
    demoUsername: 'admin@gymora.com',
    demoPassword: 'demo123',
    autoLoginUrl: 'https://demo.raxwo.net/gymora/#autologin=true&user=admin&pass=demo123',
    price: 5500,
    currency: 'LKR',
    billingPeriod: 'mo',
    priceText: 'LKR 5,500 / mo',
    contactActionType: 'whatsapp',
    whatsappNumber: '94770000000'
  }
]

function stripHtml(html) {
  if (!html) return ''
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return doc.body.textContent || ''
  } catch {
    return html.replace(/<[^>]*>?/gm, '')
  }
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.45, ease: 'easeOut' } })
}

const TRUST_STATS = [
  { icon: FiUsers, label: 'Active Clients', value: '500+', color: 'text-red-500', bg: 'bg-red-50' },
  { icon: FiAward, label: 'Years Experience', value: '8+', color: 'text-red-500', bg: 'bg-red-50' },
  { icon: FiHeadphones, label: '24/7 Support', value: '24/7', color: 'text-red-500', bg: 'bg-red-50' },
  { icon: FiBarChart2, label: 'Uptime SLA', value: '99.9%', color: 'text-red-500', bg: 'bg-red-50' },
]

export default function ShowcaseDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [hoveredFeature, setHoveredFeature] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['showcase-item', id],
    queryFn: async () => {
      try {
        const res = await api.get(`/content/public/services/${id}`)
        return res.data?.service
      } catch {
        return null
      }
    },
    enabled: Boolean(id) && !id.startsWith('p') && !id.startsWith('s')
  })

  const staticMatch = STATIC_SHOWCASE_ITEMS.find(s => s._id === id || s.id === id) || {
    _id: id || 'item',
    title: 'Gym Management ERP Software',
    badge: 'SaaS ERP',
    category: 'ERP',
    colorFrom: '#2563eb',
    colorTo: '#4f46e5',
    tagline: 'Complete Gym Management Software with member management, coach management, attendance tracking, and billing.',
    description: 'Manage your gym with Gymora ERP. Complete Gym Management Software with member management, coach management, attendance tracking, workout planning, diet plans, billing, analytics, multi-branch support, and cloud access.',
    topHighlights: ['Member & Trainer Portals', 'Automated Attendance & QR Check-in', 'Diet & Workout Plan Builder', 'Recurring Billing & Membership Alerts'],
    categorizedFeatures: [
      { categoryName: 'Member Management', items: ['Member profile & medical history', 'QR code / Fingerprint attendance', 'Membership package renewal alerts', 'Locker allocation system'] },
      { categoryName: 'Fitness & Workout Plans', items: ['Custom workout plan builder', 'Diet & nutrition meal charts', 'Trainer progress tracking', 'Body metric logging (BMI, Weight)'] },
      { categoryName: 'Finance & Invoicing', items: ['Automatic monthly invoice generation', 'Payment gateway integration', 'Overdue fee alerts via WhatsApp', 'Expense & cash flow analytics'] }
    ],
    demoUrl: 'https://demo.raxwo.net/gymora',
    demoUsername: 'admin@gymora.com',
    demoPassword: 'demo123',
    autoLoginUrl: 'https://demo.raxwo.net/gymora/#autologin=true&user=admin&pass=demo123',
    price: 5500,
    currency: 'LKR',
    billingPeriod: 'mo',
    priceText: 'LKR 5,500 / mo',
    contactActionType: 'whatsapp',
    whatsappNumber: '94770000000'
  }

  const item = data || staticMatch

  const handleAutoLogin = () => {
    if (!item) return
    let loginUrl = item.autoLoginUrl || item.demoUrl
    if (!loginUrl) return
    if (!item.autoLoginUrl && item.demoUsername && item.demoPassword) {
      const sep = loginUrl.includes('?') ? '&' : '?'
      loginUrl = `${loginUrl}${sep}autologin=true&user=${encodeURIComponent(item.demoUsername)}&pass=${encodeURIComponent(item.demoPassword)}`
    }
    window.open(loginUrl, '_blank', 'noopener,noreferrer')
  }

  const handleGetQuote = () => {
    if (item?.contactActionType === 'whatsapp' && item?.whatsappNumber) {
      const phone = item.whatsappNumber.replace(/[^0-9]/g, '')
      const msg = encodeURIComponent(`Hi Raxwo Team! I am interested in getting a quote for ${item.title}.`)
      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
    } else {
      setShowQuoteModal(true)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <span className="absolute inset-0 rounded-full border-4 border-blue-100" />
            <span className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
          </div>
          <p className="text-sm font-semibold text-slate-500 tracking-wide">Loading Product Details…</p>
        </div>
      </div>
    )
  }

  const IconComp = ICON_MAP[item.icon] || FiLayers
  const logoSrc = item.logoUrl || item.imageUrl
  const accentFrom = item.colorFrom || '#2563eb'
  const accentTo = item.colorTo || '#4f46e5'

  const formattedPrice = item.priceText
    || (item.price ? `${item.currency || 'LKR'} ${Number(item.price).toLocaleString()} / ${item.billingPeriod || 'mo'}` : 'Custom Pricing')

  const cleanDescription = stripHtml(item.description)

  const highlights = (item.topHighlights && item.topHighlights.length > 0)
    ? item.topHighlights.filter(Boolean)
    : ['Cloud-Based System', 'Multi-User Roles', 'Real-time Analytics', 'WhatsApp Alerts']

  const categorizedFeatures = (item.categorizedFeatures && item.categorizedFeatures.length > 0)
    ? item.categorizedFeatures
    : [{ categoryName: 'Core Modules', items: ['User Authentication & Security', 'Dashboard & Analytics', 'Automated Notifications', 'Custom Reports Export'] }]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20 text-slate-900 pt-20 pb-24">

      {/* ═══════════════════════════════════════════
          HERO SECTION — Bold & Premium
      ═══════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-white border-b border-slate-200/60">
        {/* Subtle decorative blobs */}
        <div
          className="pointer-events-none absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full opacity-[0.06] blur-3xl"
          style={{ background: `radial-gradient(circle, ${accentFrom}, ${accentTo})` }}
        />
        <div className="pointer-events-none absolute -bottom-20 -left-20 w-[320px] h-[320px] rounded-full opacity-[0.04] blur-2xl bg-violet-400" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-12 relative z-10">

          {/* Breadcrumb */}
          <motion.div
            variants={fadeUp} initial="hidden" animate="visible" custom={0}
            className="flex items-center gap-3 mb-10"
          >
            <button
              onClick={() => navigate(-1)}
              className="group inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-700 transition-all bg-white hover:bg-blue-50 px-4 py-2 rounded-xl border border-slate-200 shadow-sm hover:border-blue-200"
            >
              <FiArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
              Back to Showcase
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <Link to="/software-products" className="hover:text-blue-600 transition-colors">Products</Link>
              <FiChevronRight size={11} />
              <span className="text-slate-700 font-semibold truncate max-w-[240px]">{item.title}</span>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

            {/* ── LEFT: Hero Details ── */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-7">

              {/* Product Identity */}
              <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="flex items-start gap-5">
                {logoSrc ? (
                  <div className="shrink-0 h-20 w-20 rounded-2xl bg-white border border-slate-200 shadow-lg flex items-center justify-center p-3 overflow-hidden">
                    <img src={mediaUrl(logoSrc)} alt={item.title} className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div
                    className="shrink-0 w-20 h-20 rounded-2xl flex items-center justify-center text-white shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})` }}
                  >
                    <IconComp size={36} />
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-block px-3 py-1 text-white rounded-full text-[11px] font-bold uppercase tracking-widest shadow-sm"
                      style={{ background: `linear-gradient(90deg, ${accentFrom}, ${accentTo})` }}
                    >
                      {item.badge || item.category || 'SaaS ERP'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[11px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                      Live Demo Available
                    </span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                    {item.title}
                  </h1>
                </div>
              </motion.div>

              {/* Tagline */}
              <motion.p
                variants={fadeUp} initial="hidden" animate="visible" custom={2}
                className="text-base sm:text-lg text-slate-500 leading-relaxed font-normal max-w-2xl"
              >
                {item.tagline || cleanDescription}
              </motion.p>

              {/* Key Highlights Pills */}
              {highlights.length > 0 && (
                <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3} className="flex flex-wrap gap-2.5">
                  {highlights.map((feat, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-sm text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 transition-all"
                    >
                      <FiCheckCircle size={13} className="text-emerald-500 shrink-0" />
                      {feat}
                    </span>
                  ))}
                </motion.div>
              )}

              {/* Trust Stats Row */}
              <motion.div
                variants={fadeUp} initial="hidden" animate="visible" custom={4}
                className="grid grid-cols-4 gap-3 pt-2"
              >
                {TRUST_STATS.map((stat, i) => (
                  <div key={i} className="flex flex-col items-center justify-center bg-white border border-slate-200/80 rounded-2xl py-4 px-2 shadow-sm text-center hover:shadow-md transition-shadow">
                    <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center mb-2`}>
                      <stat.icon size={16} className={stat.color} />
                    </div>
                    <span className="text-lg font-extrabold text-slate-900">{stat.value}</span>
                    <span className="text-[10px] font-medium text-slate-400 mt-0.5">{stat.label}</span>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* ── RIGHT: Action / Pricing Card ── */}
            <motion.div
              variants={fadeUp} initial="hidden" animate="visible" custom={2}
              className="lg:col-span-5 xl:col-span-4"
            >
              <div className="bg-white border border-slate-200/80 rounded-3xl shadow-2xl shadow-slate-200/60 overflow-hidden">

                {/* Gradient price header */}
                <div
                  className="px-7 py-6 text-white"
                  style={{ background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})` }}
                >
                  <p className="text-[11px] font-bold uppercase tracking-widest text-white/70 mb-1">Pricing Package</p>
                  <div className="text-3xl font-black tracking-tight">{formattedPrice}</div>
                  <p className="text-xs text-white/60 mt-1 font-medium">Starting price · Customized upon request</p>
                </div>

                <div className="p-6 space-y-4">
                  {/* Demo Access Panel */}
                  {(item.demoUrl || item.autoLoginUrl || item.demoUsername) && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                          <FiKey size={13} className="text-amber-500" /> Demo Access
                        </span>
                        <span className="text-[10px] bg-blue-600 text-white px-2.5 py-0.5 rounded-full font-bold tracking-wide">
                          Instant
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2">
                          <span className="text-[10px] text-slate-400 block font-medium">Username</span>
                          <span className="text-xs font-bold text-slate-800 truncate block">{item.demoUsername || 'admin'}</span>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2">
                          <span className="text-[10px] text-slate-400 block font-medium">Password</span>
                          <span className="text-xs font-bold text-slate-800 truncate block">{item.demoPassword || 'demo123'}</span>
                        </div>
                      </div>

                      <button
                        onClick={handleAutoLogin}
                        className="w-full py-3 font-bold text-xs rounded-xl text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md"
                        style={{ background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})` }}
                      >
                        <FiZap size={14} className="fill-current text-amber-300" />
                        1-Click Auto Login Demo
                        <FiExternalLink size={12} className="opacity-70" />
                      </button>
                    </div>
                  )}

                  {/* CTA Buttons */}
                  <button
                    onClick={handleGetQuote}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.98]"
                  >
                    <FiMessageSquare size={16} />
                    Request Pricing Quote
                  </button>

                  <button
                    onClick={() => setShowFeedbackModal(true)}
                    className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    <FiStar size={13} className="fill-current text-amber-500" />
                    Leave a Review
                  </button>

                  {/* Trust badges */}
                  <div className="flex items-center justify-center gap-4 pt-1 border-t border-slate-100">
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                      <FiShield size={11} className="text-emerald-500" /> Secure
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                      <FiCloud size={11} className="text-blue-500" /> Cloud-ready
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                      <FiHeadphones size={11} className="text-violet-500" /> 24/7 Support
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          BODY — Overview + Features + Sidebar
      ═══════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* ── LEFT: Content Panels ── */}
        <div className="lg:col-span-8 space-y-8">

          {/* System Overview */}
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0}
            className="bg-white border border-slate-200/70 rounded-3xl overflow-hidden shadow-sm"
          >
            <div className="flex items-center gap-4 px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
                <FiGrid size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">System Overview & Capabilities</h2>
                <p className="text-xs text-slate-400 font-medium">Architecture, benefits & operational scope</p>
              </div>
            </div>
            <div className="px-8 py-6">
              <p className="text-slate-600 text-sm leading-relaxed">
                {cleanDescription}
              </p>
            </div>
          </motion.div>

          {/* Feature Breakdown */}
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0}
            className="bg-white border border-slate-200/70 rounded-3xl overflow-hidden shadow-sm"
          >
            <div className="flex items-center gap-4 px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                <FiZap size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Full Feature Breakdown</h2>
                <p className="text-xs text-slate-400 font-medium">Categorized system capabilities & modules</p>
              </div>
              <span className="ml-auto text-[11px] font-bold bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-full">
                {categorizedFeatures.reduce((acc, c) => acc + (c.items?.length || 0), 0)} Features
              </span>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {categorizedFeatures.map((cat, idx) => (
                  <motion.div
                    key={idx}
                    variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={idx * 0.5}
                    onMouseEnter={() => setHoveredFeature(idx)}
                    onMouseLeave={() => setHoveredFeature(null)}
                    className={`rounded-2xl border p-5 space-y-3 transition-all duration-200 cursor-default
                      ${hoveredFeature === idx
                        ? 'border-blue-300 bg-blue-50/50 shadow-md shadow-blue-100'
                        : 'border-slate-200/70 bg-slate-50/60 hover:border-slate-300'}`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">{cat.categoryName}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors
                        ${hoveredFeature === idx ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        {cat.items?.length || 0}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {(cat.items || []).map((feat, fIdx) => (
                        <div key={fIdx} className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                          <div className="w-4 h-4 rounded-md bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                            <FiCheck size={10} className="text-emerald-600" />
                          </div>
                          {feat}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Modules (if present) */}
          {item.modules && item.modules.length > 0 && (
            <motion.div
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0}
              className="bg-white border border-slate-200/70 rounded-3xl overflow-hidden shadow-sm"
            >
              <div className="flex items-center gap-4 px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="w-11 h-11 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-md shadow-violet-600/20">
                  <FiPackage size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Included Core Modules</h2>
                  <p className="text-xs text-slate-400 font-medium">Pre-built software components</p>
                </div>
              </div>
              <div className="p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {item.modules.map((mod, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 hover:border-violet-200 transition-colors">
                      <h4 className="font-bold text-sm text-slate-900">{mod.name}</h4>
                      <p className="text-xs text-slate-500">{mod.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* ── RIGHT: Sidebar ── */}
        <div className="lg:col-span-4 space-y-6">

          {/* Technical Specs Card */}
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0}
            className="bg-white border border-slate-200/70 rounded-3xl overflow-hidden shadow-sm"
          >
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center">
                <FiCpu size={16} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Technical Specifications</h3>
            </div>

            <div className="px-6 py-5 divide-y divide-slate-100 text-xs">
              {[
                { icon: FiLayers, label: 'Category', value: item.badge || item.category || 'SaaS ERP', valueClass: 'font-bold text-slate-900' },
                { icon: FiGlobe, label: 'Deployment', value: 'Cloud & Mobile Ready', valueClass: 'font-bold text-blue-700' },
                { icon: FiLock, label: 'Data Security', value: 'Encrypted DB Backups', valueClass: 'font-bold text-slate-900' },
                { icon: FiShield, label: 'Compliance', value: 'ISO Data Standards', valueClass: 'font-bold text-slate-900' },
                { icon: FiHeadphones, label: 'Support', value: '24/7 Dedicated', valueClass: 'font-bold text-emerald-600' },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <span className="flex items-center gap-2 text-slate-500 font-medium">
                    <row.icon size={13} className="text-slate-400" /> {row.label}
                  </span>
                  <span className={row.valueClass}>{row.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Custom Development CTA Card */}
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1}
            className="rounded-3xl overflow-hidden border border-blue-200/60 shadow-sm relative"
          >
            {/* Decorative top accent */}
            <div className="h-2 w-full" style={{ background: `linear-gradient(90deg, ${accentFrom}, ${accentTo})` }} />

            <div className="bg-gradient-to-br from-blue-50 via-indigo-50/60 to-white px-7 py-7 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white border border-blue-200 flex items-center justify-center shadow-sm shrink-0">
                  <FiCode size={18} className="text-blue-600" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Custom Development</span>
                  <h3 className="text-lg font-extrabold text-slate-900 leading-snug mt-0.5">
                    Need Custom Modifications?
                  </h3>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                Our engineering team can tailor this system to your exact workflow — integrate third-party APIs, custom modules, or unique reporting dashboards.
              </p>

              <ul className="space-y-2">
                {['Custom feature development', 'API & third-party integrations', 'White-label branding'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <div className="w-4 h-4 rounded-md bg-blue-100 flex items-center justify-center shrink-0">
                      <FiCheck size={10} className="text-blue-600" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>

              <button
                onClick={handleGetQuote}
                className="w-full py-3.5 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                style={{ background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})` }}
              >
                <FiMessageSquare size={14} />
                Talk to Our Engineering Team
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Modals */}
      {showQuoteModal && <QuoteModal item={item} onClose={() => setShowQuoteModal(false)} />}
      {showFeedbackModal && <FeedbackModal item={item} onClose={() => setShowFeedbackModal(false)} />}
    </div>
  )
}
