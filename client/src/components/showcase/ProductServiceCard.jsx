import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  FiCheckCircle, FiExternalLink, FiKey, FiMessageSquare,
  FiZap, FiLayers, FiCode, FiSmartphone, FiCloud, FiShield,
  FiDatabase, FiTrendingUp, FiUsers, FiPackage, FiArrowRight
} from 'react-icons/fi'
import { mediaUrl } from '../../lib/media'

const ICON_MAP = {
  FiCode, FiSmartphone, FiCloud, FiShield, FiTrendingUp,
  FiUsers, FiDatabase, FiLayers, FiPackage
}

export default function ProductServiceCard({ item, onViewFeatures, onGetQuote }) {
  const navigate = useNavigate()

  const handleCardClick = () => {
    navigate(`/showcase/${item._id || item.id || 'item'}`)
  }

  const handleAutoLoginClick = (e) => {
    e.stopPropagation()
    let loginUrl = item.autoLoginUrl || item.demoUrl
    if (!loginUrl) return

    // Append auto-login hash / credentials if autoLoginUrl is not specifically set
    if (!item.autoLoginUrl && item.demoUsername && item.demoPassword) {
      const separator = loginUrl.includes('?') ? '&' : '?'
      loginUrl = `${loginUrl}${separator}autologin=true&user=${encodeURIComponent(item.demoUsername)}&pass=${encodeURIComponent(item.demoPassword)}`
    }

    window.open(loginUrl, '_blank', 'noopener,noreferrer')
  }

  const handleGetQuoteClick = (e) => {
    e.stopPropagation()
    if (item.contactActionType === 'whatsapp' && item.whatsappNumber) {
      const cleanPhone = item.whatsappNumber.replace(/[^0-9]/g, '')
      const msg = encodeURIComponent(`Hi Raxwo Team! I am interested in getting a quote for ${item.title}.`)
      window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank')
    } else if (onGetQuote) {
      onGetQuote(item)
    } else {
      // Fallback WhatsApp / Contact
      const msg = encodeURIComponent(`Hi Raxwo Team! I am interested in getting a quote for ${item.title}.`)
      window.open(`https://wa.me/94770000000?text=${msg}`, '_blank')
    }
  }

  const handleViewAllFeaturesClick = (e) => {
    e.stopPropagation()
    if (onViewFeatures) onViewFeatures(item)
  }

  // Highlights: fallback to first 4 features if topHighlights is empty
  const highlights = (item.topHighlights && item.topHighlights.length > 0)
    ? item.topHighlights.slice(0, 4)
    : (item.features || []).slice(0, 4)

  // Count remaining features
  const totalFeatureCount = (item.categorizedFeatures && item.categorizedFeatures.length > 0)
    ? item.categorizedFeatures.reduce((acc, cat) => acc + (cat.items?.length || 0), 0)
    : (item.features?.length || 0)
  
  const remainingCount = Math.max(0, totalFeatureCount - highlights.length)

  // Determine badge label
  const badgeLabel = item.badge || item.category || (item.type === 'product' ? 'SaaS ERP' : 'Software Service')
  
  // Icon fallback
  const IconComp = ICON_MAP[item.icon] || FiLayers

  // Logo URL
  const logoSrc = item.logoUrl || item.imageUrl

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      onClick={handleCardClick}
      className="group relative bg-white rounded-3xl border border-slate-200/80 shadow-lg hover:shadow-2xl hover:border-blue-300 transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-pointer"
    >
      {/* Top Accent Gradient Bar */}
      <div
        className="h-2 w-full transition-all duration-300 group-hover:h-2.5"
        style={{
          background: `linear-gradient(to right, ${item.colorFrom || '#2563eb'}, ${item.colorTo || '#4f46e5'})`
        }}
      />

      <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-6">
        {/* Header: Logo/Icon + Badge */}
        <div>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              {logoSrc ? (
                <div className="w-13 h-13 rounded-2xl bg-slate-50 p-2 border border-slate-100 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                  <img src={mediaUrl(logoSrc)} alt={item.title} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div
                  className="w-13 h-13 rounded-2xl flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform"
                  style={{
                    background: `linear-gradient(135deg, ${item.colorFrom || '#2563eb'}, ${item.colorTo || '#4f46e5'})`
                  }}
                >
                  <IconComp size={24} />
                </div>
              )}
              <div>
                <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-full text-[11px] font-bold uppercase tracking-wider mb-1">
                  {badgeLabel}
                </span>
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                  {item.title}
                </h3>
              </div>
            </div>
          </div>

          {/* Tagline / Summary */}
          <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed line-clamp-2 mb-4">
            {item.tagline || item.description || 'Full-featured enterprise software solution tailored for business growth.'}
          </p>

          {/* Primary Highlights (Top 4 Features with green checkmarks) */}
          {highlights.length > 0 && (
            <div className="space-y-2 py-3 px-3.5 bg-slate-50/80 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Key Highlights
              </span>
              <div className="grid grid-cols-1 gap-2">
                {highlights.map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <FiCheckCircle size={14} className="text-emerald-500 shrink-0" />
                    <span className="truncate">{feat}</span>
                  </div>
                ))}
              </div>

              {/* View All Features Link (+X more features) */}
              <button
                type="button"
                onClick={handleViewAllFeaturesClick}
                className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 transition-all"
              >
                <span>+{remainingCount > 0 ? remainingCount : 35} more features</span>
                <FiArrowRight size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Bottom Actions Container */}
        <div className="space-y-4 pt-2">
          {/* Demo Credentials & Auto Login Button */}
          {(item.demoUrl || item.autoLoginUrl || item.demoUsername) && (
            <div className="p-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-2xl border border-blue-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <FiKey className="text-amber-500 shrink-0" size={14} />
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="bg-white/80 px-2 py-0.5 rounded-md border border-slate-200 text-slate-600">
                    User: <strong className="text-slate-900">{item.demoUsername || 'admin'}</strong>
                  </span>
                  <span className="bg-white/80 px-2 py-0.5 rounded-md border border-slate-200 text-slate-600">
                    Pass: <strong className="text-slate-900">{item.demoPassword || 'demo123'}</strong>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAutoLoginClick}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-blue-500/20 inline-flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
                title="Direct Single-Click Auto Login"
              >
                <FiZap size={13} className="text-amber-300 fill-current" />
                <span>Auto Login</span>
              </button>
            </div>
          )}

          {/* Pricing & Get Quote Button */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pricing</span>
              <span className="text-sm font-extrabold text-slate-900">
                {item.priceText || (item.price ? `${item.currency || 'LKR'} ${item.price.toLocaleString()} / ${item.billingPeriod || 'mo'}` : 'Custom Pricing')}
              </span>
            </div>

            <button
              type="button"
              onClick={handleGetQuoteClick}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 inline-flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
            >
              <FiMessageSquare size={14} />
              <span>Get Quote</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
