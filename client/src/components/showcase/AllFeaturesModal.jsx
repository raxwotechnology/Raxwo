import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiCheckCircle, FiLayers, FiZap } from 'react-icons/fi'

export default function AllFeaturesModal({ item, onClose }) {
  if (!item) return null

  // Collect all features
  const hasCategorized = item.categorizedFeatures && item.categorizedFeatures.length > 0
  const uncategorizedList = item.features || []

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400">
                <FiLayers size={22} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-blue-300 uppercase tracking-widest block">
                  Complete System Feature List
                </span>
                <h3 className="text-xl font-bold text-white">{item.title}</h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-xl transition-all"
            >
              <FiX size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1">
            {/* Top Highlights Banner */}
            {item.topHighlights && item.topHighlights.length > 0 && (
              <div className="p-4 bg-blue-50/80 rounded-2xl border border-blue-100 space-y-2">
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FiZap size={14} className="text-amber-500 fill-current" /> Core System Highlights
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {item.topHighlights.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                      <FiCheckCircle size={15} className="text-emerald-500 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Categorized Features Breakdown */}
            {hasCategorized ? (
              <div className="space-y-6">
                {item.categorizedFeatures.map((cat, catIdx) => (
                  <div key={catIdx} className="space-y-3">
                    <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                      <h4 className="font-bold text-sm text-slate-900 uppercase tracking-wide">
                        {cat.categoryName || 'Module Features'}
                      </h4>
                      <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {cat.items?.length || 0} features
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-2">
                      {(cat.items || []).map((featItem, itemIdx) => (
                        <div key={itemIdx} className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <FiCheckCircle size={14} className="text-emerald-500 shrink-0" />
                          <span>{featItem}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : uncategorizedList.length > 0 ? (
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-slate-900 uppercase tracking-wide">All Features</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {uncategorizedList.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <FiCheckCircle size={14} className="text-emerald-500 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">
                No features detailed for this product yet.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Want to see these live? Try our 1-click Demo Auto Login!
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
