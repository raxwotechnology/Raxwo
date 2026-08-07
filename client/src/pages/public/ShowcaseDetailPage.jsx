import { useParams, Link, useNavigate } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  FiArrowLeft, FiCheckCircle, FiZap, FiKey, FiMessageSquare,
  FiLayers, FiCheck, FiExternalLink, FiPlay, FiPackage, FiShield,
  FiCode, FiSmartphone, FiCloud, FiTrendingUp, FiUsers, FiDatabase
} from 'react-icons/fi'
import api from '../../lib/api'
import { mediaUrl } from '../../lib/media'
import QuoteModal from '../../components/showcase/QuoteModal'
import { useState } from 'react'

const ICON_MAP = {
  FiCode, FiSmartphone, FiCloud, FiShield, FiTrendingUp,
  FiUsers, FiDatabase, FiLayers, FiPackage
}

export default function ShowcaseDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [showQuoteModal, setShowQuoteModal] = useState(false)

  // Fetch Item details from API
  const { data, isLoading, error } = useQuery({
    queryKey: ['showcase-item', id],
    queryFn: async () => {
      const res = await api.get(`/content/public/services/${id}`)
      return res.data?.service
    },
    enabled: Boolean(id) && !id.startsWith('p') // skip static fallback IDs
  })

  const item = data

  const handleAutoLogin = () => {
    if (!item) return
    let loginUrl = item.autoLoginUrl || item.demoUrl
    if (!loginUrl) return

    if (!item.autoLoginUrl && item.demoUsername && item.demoPassword) {
      const separator = loginUrl.includes('?') ? '&' : '?'
      loginUrl = `${loginUrl}${separator}autologin=true&user=${encodeURIComponent(item.demoUsername)}&pass=${encodeURIComponent(item.demoPassword)}`
    }

    window.open(loginUrl, '_blank', 'noopener,noreferrer')
  }

  const handleGetQuote = () => {
    if (item?.contactActionType === 'whatsapp' && item?.whatsappNumber) {
      const cleanPhone = item.whatsappNumber.replace(/[^0-9]/g, '')
      const msg = encodeURIComponent(`Hi Raxwo Team! I am interested in getting a quote for ${item.title}.`)
      window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank')
    } else {
      setShowQuoteModal(true)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen pt-28 pb-16 flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <span className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-400">Loading Product Details...</p>
        </div>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="min-h-screen pt-28 pb-16 bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <FiPackage size={48} className="text-slate-600 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Product Details</h2>
        <p className="text-slate-400 text-sm max-w-md mb-6">
          Detailed specification page for this item. Click below to return to the main showcase.
        </p>
        <button
          onClick={() => navigate('/software-products')}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg inline-flex items-center gap-2"
        >
          <FiArrowLeft size={16} /> Back to Showcase
        </button>
      </div>
    )
  }

  const IconComp = ICON_MAP[item.icon] || FiLayers
  const logoSrc = item.logoUrl || item.imageUrl

  return (
    <div className="min-h-screen bg-slate-950 text-white pt-24 pb-20">
      {/* Top Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-800"
        >
          <FiArrowLeft size={14} /> Back to All Showcase Items
        </button>
      </div>

      {/* Hero Banner Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-12">
        <div className="relative rounded-3xl p-8 sm:p-12 overflow-hidden border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 shadow-2xl">
          {/* Ambient Lighting */}
          <div
            className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ backgroundColor: item.colorFrom || '#3b82f6' }}
          />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-6">
              <div className="flex items-center gap-3">
                {logoSrc ? (
                  <div className="w-16 h-16 rounded-2xl bg-white p-2 border border-slate-700 shadow-md flex items-center justify-center">
                    <img src={mediaUrl(logoSrc)} alt={item.title} className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${item.colorFrom || '#3b82f6'}, ${item.colorTo || '#1d4ed8'})` }}
                  >
                    <IconComp size={32} />
                  </div>
                )}
                <div>
                  <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-xs font-bold uppercase tracking-wider mb-1">
                    {item.badge || item.category || 'Software Solution'}
                  </span>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                    {item.title}
                  </h1>
                </div>
              </div>

              <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed">
                {item.tagline || item.description}
              </p>

              {/* Highlights pills */}
              {item.topHighlights && item.topHighlights.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {item.topHighlights.map((feat, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-semibold text-slate-200">
                      <FiCheckCircle size={14} className="text-emerald-400" />
                      {feat}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Action Box Side */}
            <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-5 backdrop-blur-md">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Pricing Package</span>
                <div className="text-2xl font-extrabold text-white">
                  {item.priceText || (item.price ? `${item.currency || 'LKR'} ${item.price.toLocaleString()} / ${item.billingPeriod || 'mo'}` : 'Custom Pricing')}
                </div>
              </div>

              {/* Demo Credentials Box */}
              {(item.demoUrl || item.autoLoginUrl || item.demoUsername) && (
                <div className="p-4 bg-blue-950/40 rounded-2xl border border-blue-900/50 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
                    <FiKey size={14} className="text-amber-400" /> Demo Credentials
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-300">
                    <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">User:</span>
                      <span className="font-bold text-white truncate block">{item.demoUsername || 'admin'}</span>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Pass:</span>
                      <span className="font-bold text-white truncate block">{item.demoPassword || 'demo123'}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleAutoLogin}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all"
                  >
                    <FiZap size={14} className="text-amber-300 fill-current" /> 1-Click Auto Login Demo
                  </button>
                </div>
              )}

              <button
                onClick={handleGetQuote}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
              >
                <FiMessageSquare size={16} /> Request Pricing Quote
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left 8 Cols: Categorized Features Breakdown */}
        <div className="lg:col-span-8 space-y-8">
          {/* Detailed Overview */}
          <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-3xl space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FiLayers className="text-blue-400" /> System Overview & Capabilities
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
              {item.description}
            </p>
          </div>

          {/* Categorized Features Breakdown */}
          {item.categorizedFeatures && item.categorizedFeatures.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-3xl space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FiZap className="text-amber-400" /> Full Features Breakdown
              </h2>

              <div className="space-y-6">
                {item.categorizedFeatures.map((cat, idx) => (
                  <div key={idx} className="space-y-3">
                    <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      {cat.categoryName}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(cat.items || []).map((feat, fIdx) => (
                        <div key={fIdx} className="flex items-center gap-2 text-xs font-medium text-slate-200 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                          <FiCheckCircle size={15} className="text-emerald-400 shrink-0" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modules List if present */}
          {item.modules && item.modules.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-3xl space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FiPackage className="text-indigo-400" /> Included Modules
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {item.modules.map((mod, idx) => (
                  <div key={idx} className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-1">
                    <h4 className="font-bold text-sm text-white">{mod.name}</h4>
                    <p className="text-xs text-slate-400">{mod.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right 4 Cols: Video Demo & Extra Info */}
        <div className="lg:col-span-4 space-y-6">
          {item.videoUrl && (
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FiPlay size={16} className="text-red-500" /> Product Video Demo
              </h3>
              <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800">
                <iframe
                  src={item.videoUrl}
                  title="Demo Video"
                  className="w-full h-full"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-500/30 p-6 rounded-3xl space-y-4">
            <h3 className="text-lg font-bold text-white">Need Custom Software Modifications?</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Our engineering team can customize this system specifically for your business workflow, integrate third-party APIs, or add custom reporting modules.
            </p>
            <button
              onClick={handleGetQuote}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              Contact Engineering Team
            </button>
          </div>
        </div>
      </div>

      {showQuoteModal && <QuoteModal item={item} onClose={() => setShowQuoteModal(false)} />}
    </div>
  )
}
