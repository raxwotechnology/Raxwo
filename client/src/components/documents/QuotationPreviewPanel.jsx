import { useMemo, useRef, useState, useEffect } from 'react'
import { FiPrinter, FiSave, FiSend, FiDownload } from 'react-icons/fi'
import QuotationPrintBody from './QuotationPrintBody'
import { printHtmlContent } from '../../lib/documentPrint'
import {
  layoutPrintExtraCss,
  layoutToStyle,
  quotationLayoutFromSettings,
} from '../../lib/quotationPrintLayout'

const DOC_WIDTH_PX = 794

export default function QuotationPreviewPanel({
  quotation,
  siteSettings = {},
  bankLabel = '',
  onSaveDraft,
  onSend,
  onDownloadPdf,
  saving = false,
  isDraft = false,
  showSeal,
  printRootId = 'quotation-print-export-root',
}) {
  const q = quotation || {}
  const layout = useMemo(() => quotationLayoutFromSettings(siteSettings), [siteSettings])
  const mergedQuotation = q

  const resolvedShowSeal = showSeal !== undefined ? showSeal : (mergedQuotation.showSeal ?? true)

  const scrollRef = useRef(null)
  const docRef = useRef(null)
  const [fitScale, setFitScale] = useState(1)
  const [docHeight, setDocHeight] = useState(0)
  const [zoomMode, setZoomMode] = useState('fit') // 'fit' | '100'

  useEffect(() => {
    if (!scrollRef.current) return
    const updateScale = () => {
      if (!scrollRef.current) return
      const cw = scrollRef.current.clientWidth
      if (cw > 0) {
        const gutter = cw < 640 ? 16 : 48
        const available = Math.max(260, cw - gutter)
        if (available < DOC_WIDTH_PX) {
          setFitScale(available / DOC_WIDTH_PX)
        } else {
          setFitScale(1)
        }
      }
    }
    updateScale()
    const ro = new ResizeObserver(updateScale)
    ro.observe(scrollRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!docRef.current) return
    const updateHeight = () => {
      if (docRef.current) {
        setDocHeight(docRef.current.scrollHeight || docRef.current.clientHeight || 1123)
      }
    }
    updateHeight()
    const ro = new ResizeObserver(updateHeight)
    ro.observe(docRef.current)
    return () => ro.disconnect()
  }, [layout, mergedQuotation])

  const effectiveScale = zoomMode === '100' ? 1 : fitScale
  const scaledWidth = Math.round(DOC_WIDTH_PX * effectiveScale)
  const scaledHeight = docHeight > 0 ? Math.ceil(docHeight * effectiveScale) : 'auto'

  const handlePrint = () => {
    const root = document.getElementById(printRootId)
    const inner = root?.innerHTML
    if (!inner) return
    const company = siteSettings.siteName || 'Quotation'
    printHtmlContent({
      title: company,
      bodyHtml: `<div class="doc-print-frame">${inner}</div>`,
      extraCss: layoutPrintExtraCss(layout),
    })
  }

  return (
    <div className="doc-preview-panel flex flex-col flex-1 min-h-0 min-w-0 h-full overflow-hidden bg-slate-50">
      {/* Top bar with actions and responsive zoom controls */}
      <div className="no-print shrink-0 border-b bg-slate-50 px-3 py-2.5 flex items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {!isDraft && (
            <>
              {onSaveDraft && (
                <button type="button" disabled={saving} className="btn-outline btn-xs sm:btn-sm gap-1" onClick={() => onSaveDraft(mergedQuotation)}>
                  <FiSave size={13} /> <span className="hidden sm:inline">Save</span>
                </button>
              )}
              {onSend && (
                <button type="button" className="btn-outline btn-xs sm:btn-sm gap-1" onClick={() => onSend(mergedQuotation)}>
                  <FiSend size={13} /> <span className="hidden sm:inline">Send</span>
                </button>
              )}
              {onDownloadPdf && q._id && (
                <button type="button" className="btn-outline btn-xs sm:btn-sm gap-1" onClick={() => onDownloadPdf(q._id)}>
                  <FiDownload size={13} /> <span className="hidden sm:inline">PDF</span>
                </button>
              )}
              <button type="button" className="btn-primary btn-xs sm:btn-sm gap-1" onClick={handlePrint}>
                <FiPrinter size={13} /> <span className="hidden sm:inline">Print</span>
              </button>
            </>
          )}
          {isDraft && (
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"/>
              Live Preview
            </span>
          )}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs shrink-0">
          <button
            type="button"
            onClick={() => setZoomMode('fit')}
            className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${
              zoomMode === 'fit' ? 'bg-secondary text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Fit document to screen width"
          >
            Fit ({Math.round(fitScale * 100)}%)
          </button>
          <button
            type="button"
            onClick={() => setZoomMode('100')}
            className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${
              zoomMode === '100' ? 'bg-secondary text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="View at 100% actual size"
          >
            100%
          </button>
        </div>
      </div>

      {/* Scrollable preview area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-2 sm:p-4 md:p-8 bg-slate-100/90"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div
          style={{
            width: scaledWidth,
            height: scaledHeight,
            minHeight: docHeight > 0 ? scaledHeight : 300,
            margin: '0 auto',
            position: 'relative',
          }}
        >
          <div
            id={printRootId}
            ref={docRef}
            className={`quotation-doc doc-print-frame bg-white shadow-xl ${layout.showDocumentFrame ? 'border border-slate-200' : ''}`}
            style={{
              ...layoutToStyle(layout),
              width: `${DOC_WIDTH_PX}px`,
              minWidth: `${DOC_WIDTH_PX}px`,
              maxWidth: `${DOC_WIDTH_PX}px`,
              boxSizing: 'border-box',
              transform: `scale(${effectiveScale})`,
              transformOrigin: 'top left',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          >
            <QuotationPrintBody
              quotation={mergedQuotation}
              siteSettings={siteSettings}
              preparedByDisplay={mergedQuotation.preparedBy}
              bankLabel={bankLabel}
              thankYouMessage={siteSettings.quotationThankYouMessage}
              showRefOnDocument={layout.showRefOnDocument}
              showSeal={resolvedShowSeal}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
