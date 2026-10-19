import { useEffect, useRef, useState, useCallback } from 'react'
import {
  LETTER_PAGE_WIDTH,
  LETTER_PAGE_HEIGHT,
  LETTER_PAGE_PADDING,
  LETTER_PAGE_GAP,
  LETTER_COMPACT_CSS,
} from '../../lib/letterDocument'

/**
 * WYSIWYG A4 page preview — stacked sheets + page-break guides that update with content and scale.
 * Measurement is driven by explicit prop changes only (no observers) to avoid feedback loops.
 */
export default function LetterPaginatedPreview({
  children,
  scale = 100,
  compact = false,
  measureKey = '',
  className = '',
}) {
  const containerRef = useRef(null)
  const contentRef = useRef(null)
  const [pageCount, setPageCount] = useState(1)
  const [autoScale, setAutoScale] = useState(1)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth)
      }
    }
    handleResize()
    const observer = new ResizeObserver(() => {
      handleResize()
    })
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const containerZoom = containerWidth > 24 && containerWidth < LETTER_PAGE_WIDTH ? ((containerWidth - 24) / LETTER_PAGE_WIDTH) : 1
  const baseZoom = Math.max(0.25, Math.min(1.15, (scale / 100) * containerZoom))
  const compactClass = compact ? 'letter-compact letter-compact-more' : ''

  const measure = useCallback(() => {
    const el = contentRef.current
    if (!el) return

    const h = el.scrollHeight || el.offsetHeight || 0
    if (h === 0) return

    if (compact) {
      if (h > LETTER_PAGE_HEIGHT) {
        const fitZoom = Math.max(0.55, Math.min(1, LETTER_PAGE_HEIGHT / h))
        setAutoScale(fitZoom)
      } else {
        setAutoScale(1)
      }
      setPageCount(1)
    } else {
      setAutoScale(1)
      setPageCount(Math.max(1, Math.ceil(h / LETTER_PAGE_HEIGHT)))
    }
  }, [compact])

  // Measure on mount, on explicit prop changes, and whenever content/images resize
  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    measure()
    const t = setTimeout(measure, 120)

    let ro
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        measure()
      })
      ro.observe(el)
    }

    const imgs = el.querySelectorAll('img')
    const cleanups = []
    imgs.forEach((img) => {
      if (!img.complete) {
        const onFinish = () => measure()
        img.addEventListener('load', onFinish)
        img.addEventListener('error', onFinish)
        cleanups.push(() => {
          img.removeEventListener('load', onFinish)
          img.removeEventListener('error', onFinish)
        })
      }
    })

    return () => {
      clearTimeout(t)
      if (ro) ro.disconnect()
      cleanups.forEach((c) => c())
    }
  }, [measureKey, scale, compact, measure])

  const finalZoom = baseZoom * autoScale
  const scaledW = LETTER_PAGE_WIDTH * baseZoom
  const scaledH = LETTER_PAGE_HEIGHT * baseZoom

  const sheetStep = scaledH + LETTER_PAGE_GAP
  const totalHeight = pageCount * scaledH + Math.max(0, pageCount - 1) * LETTER_PAGE_GAP

  return (
    <div ref={containerRef} className={`letter-paginated-preview w-full overflow-x-hidden ${className}`}>
      <style>{LETTER_COMPACT_CSS}</style>

      <div
        className="relative mx-auto"
        style={{ width: scaledW, minHeight: totalHeight }}
      >
        {/* A4 sheet backgrounds */}
        {Array.from({ length: pageCount }).map((_, i) => (
          <div
            key={`sheet-${i}`}
            className="absolute left-0 bg-white rounded-lg shadow-lg border border-slate-200 pointer-events-none"
            style={{
              top: i * sheetStep,
              width: scaledW,
              height: scaledH,
              zIndex: 0,
            }}
          />
        ))}

        {/* Flowing letter content */}
        <div
          className="relative"
          style={{ zIndex: 1, width: scaledW }}
        >
          <div style={{ transform: `scale(${finalZoom})`, transformOrigin: 'top left', width: LETTER_PAGE_WIDTH }}>
            <div
              ref={contentRef}
              className={`letter-pdf-prose letter-page-content ${compactClass}`}
              style={{
                width: LETTER_PAGE_WIDTH,
                padding: LETTER_PAGE_PADDING,
                fontFamily: "'Segoe UI',system-ui,-apple-system,sans-serif",
                color: '#0f172a',
                fontSize: '11pt',
                lineHeight: 1.6,
              }}
            >
              {children}
            </div>
          </div>
        </div>

        {/* Page break indicators between sheets */}
        {pageCount > 1 &&
          Array.from({ length: pageCount - 1 }).map((_, i) => (
            <div
              key={`break-${i}`}
              className="absolute left-0 right-0 flex items-center justify-center pointer-events-none"
              style={{
                top: (i + 1) * sheetStep - 1,
                height: 2,
                zIndex: 2,
              }}
            >
              <div className="absolute inset-x-3 border-t-2 border-dashed border-sky-400/70" />
              <span
                className="relative shrink-0 rounded-full bg-sky-50 border border-sky-200 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700"
                style={{ transform: `scale(${1 / baseZoom})`, transformOrigin: 'center' }}
              >
                Page {i + 2} starts here
              </span>
            </div>
          ))}
      </div>

      <p className="text-center text-xs text-slate-500 mt-3">
        {pageCount === 1 ? (
          <>Fits on <strong>1 page</strong> at {Math.round(finalZoom * 100)}% scale{compact ? ' (auto-compacted)' : ''}.</>
        ) : (
          <span className="text-amber-700">
            Spans <strong>{pageCount} pages</strong> at {Math.round(finalZoom * 100)}% scale
            {compact ? ' (compact)' : ''}
            {!compact && ' — enable Fit to 1 page to auto-adjust.'}
          </span>
        )}
      </p>
    </div>
  )
}
