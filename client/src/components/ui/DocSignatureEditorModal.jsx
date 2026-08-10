import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  FiX, FiCheck, FiUpload, FiMove, FiLayers, FiFileText,
  FiTrash2, FiBookmark, FiDownload, FiChevronLeft, FiChevronRight,
  FiZoomIn, FiZoomOut, FiEdit3
} from 'react-icons/fi'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { absoluteMediaUrl, mediaUrl } from '../../lib/media'

// ── PDF.js Lazy Loader ──────────────────────────────────────────────────────
async function ensurePdfJs() {
  if (window.pdfjsLib) return
  await new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    s.onload = () => {
      if (window.pdfjsLib)
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      resolve()
    }
    s.onerror = () => reject(new Error('PDF.js load failed'))
    document.head.appendChild(s)
  })
}

// ── docx-preview Lazy Loader (requires JSZip first) ─────────────────────────
async function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = () => reject(new Error(`Failed to load: ${src}`))
    document.head.appendChild(s)
  })
}

async function ensureDocxPreview() {
  if (window.docx) return
  // 1. Load CSS
  if (!document.querySelector('#docx-preview-css')) {
    const link = document.createElement('link')
    link.id = 'docx-preview-css'
    link.rel = 'stylesheet'
    link.href = 'https://cdn.jsdelivr.net/npm/docx-preview@0.1.22/dist/docx-preview.min.css'
    document.head.appendChild(link)
  }
  // 2. Load JSZip first (docx-preview depends on it for loadAsync)
  if (!window.JSZip) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js')
  }
  // 3. Load docx-preview
  await loadScript('https://cdn.jsdelivr.net/npm/docx-preview@0.1.22/dist/docx-preview.min.js')
  // docx-preview exposes itself as window.docx
  if (!window.docx) throw new Error('docx-preview did not initialize')
}


// ── Render PDF → Array of HTMLImageElement (one per page) ──────────────────
async function renderPdfToPageImages(source) {
  await ensurePdfJs()
  let loadingTask
  if (typeof source === 'string' && source.startsWith('data:') && source.includes('base64,')) {
    const commaIdx = source.indexOf('base64,') + 7
    let b64 = source.substring(commaIdx)
    const pdfMagic = b64.indexOf('JVBERi')
    if (pdfMagic > 0) b64 = b64.substring(pdfMagic)
    const raw = atob(b64)
    const u8 = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i)
    loadingTask = window.pdfjsLib.getDocument({ data: u8 })
  } else if (source instanceof Uint8Array || source instanceof ArrayBuffer) {
    const u8 = source instanceof ArrayBuffer ? new Uint8Array(source) : source
    loadingTask = window.pdfjsLib.getDocument({ data: u8 })
  } else if (typeof source === 'string' && (source.startsWith('http') || source.startsWith('/'))) {
    let buf
    try {
      const res = await api.get(source, { responseType: 'arraybuffer' })
      buf = res.data
    } catch {
      const res = await fetch(source)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      buf = await res.arrayBuffer()
    }
    loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(buf) })
  } else {
    loadingTask = window.pdfjsLib.getDocument({ url: source })
  }

  const pdf = await loadingTask.promise
  const images = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const vp = page.getViewport({ scale: 2.0 })
    const c = document.createElement('canvas')
    c.width = vp.width; c.height = vp.height
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise
    const img = new Image()
    await new Promise(r => { img.onload = r; img.src = c.toDataURL('image/png') })
    images.push(img)
  }
  return images
}

// ── Fetch ArrayBuffer from URL (with auth fallback) ──────────────────────────
async function fetchArrayBuffer(pathUrl, absUrl) {
  try {
    const res = await api.get(pathUrl || absUrl, { responseType: 'arraybuffer' })
    // axios with responseType:'arraybuffer' returns an ArrayBuffer
    const data = res.data
    // Ensure it's a real ArrayBuffer (not Uint8Array/Buffer) for docx-preview
    if (data instanceof ArrayBuffer) return data
    if (data?.buffer instanceof ArrayBuffer) return data.buffer
    return data
  } catch {
    const res = await fetch(absUrl || pathUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.arrayBuffer()
  }
}


// ── Component ───────────────────────────────────────────────────────────────
export default function DocSignatureEditorModal({ request, onClose, onSuccess }) {
  const canvasRef    = useRef(null)
  const containerRef = useRef(null)
  const docxContainerRef = useRef(null)
  const isPdfRef     = useRef(false)
  const docxBufRef   = useRef(null)  // keep raw arraybuffer for download

  // document state
  const [mode,          setMode]          = useState('loading') // 'loading'|'docx'|'pdf'|'image'|'error'|'empty'
  const [pageImages,    setPageImages]    = useState([])
  const [currentPage,   setCurrentPage]  = useState(0)
  const [zoom,          setZoom]         = useState(1)

  // ui state
  const [loading,       setLoading]      = useState(false)
  const [docxPageCount, setDocxPageCount]= useState(0)

  // stamps
  const [placedStamps,    setPlacedStamps]    = useState([])
  const [selectedStampId, setSelectedStampId] = useState(null)
  const [isDragging,      setIsDragging]      = useState(false)
  const [dragOffset,      setDragOffset]      = useState({ x: 0, y: 0 })

  // stamp library
  const [savedLibrary,   setSavedLibrary]   = useState([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)

  const totalPages = pageImages.length

  // ── Load Stamp Library ──────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      setLoadingLibrary(true)
      try {
        const res = await api.get('/signature-requests/saved-stamps')
        if (res.data?.stamps) setSavedLibrary(res.data.stamps)
      } catch { /* silent */ } finally { setLoadingLibrary(false) }
    })()
  }, [])

  // ── Draw canvas on page/stamps/zoom change ──────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || pageImages.length === 0) return
    const img = pageImages[currentPage]
    if (!img) return
    const W = img.naturalWidth  || img.width  || 1240
    const H = img.naturalHeight || img.height || 1754
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(img, 0, 0, W, H)
    placedStamps.filter(s => s.page === currentPage).forEach(s => {
      if (!s.imgObj) return
      if (s.id === selectedStampId) {
        ctx.save(); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 3
        ctx.setLineDash([8, 4])
        ctx.strokeRect(s.x - 5, s.y - 5, s.width + 10, s.height + 10)
        ctx.setLineDash([]); ctx.restore()
      }
      ctx.save(); ctx.globalAlpha = s.opacity ?? 1
      ctx.drawImage(s.imgObj, s.x, s.y, s.width, s.height)
      ctx.restore()
    })
  }, [pageImages, currentPage, placedStamps, selectedStampId])

  // ── Render docx into container div ──────────────────────────────────────
  const renderDocxIntoContainer = useCallback(async (arrayBuf) => {
    if (!docxContainerRef.current) return
    await ensureDocxPreview()
    const container = docxContainerRef.current
    container.innerHTML = ''
    // Ensure the buffer is an ArrayBuffer (not a plain object from axios)
    let buf = arrayBuf
    if (buf instanceof ArrayBuffer === false && buf.buffer) buf = buf.buffer
    const renderOpts = {
      className: 'docx-page',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      ignoreLastRenderedPageBreak: false,
      trimXmlDeclaration: true,
      renderChanges: false,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
      useBase64URL: true,
    }
    // docx-preview v0.1.x uses window.docx.renderAsync(buffer, bodyContainer, styleContainer, options)
    await window.docx.renderAsync(buf, container, null, renderOpts)
    const pages = container.querySelectorAll('section[data-page-nr], .docx-page, article')
    setDocxPageCount(Math.max(pages.length, 1))
  }, [])


  // ── Load document on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!request?.originalDocUrl) { setMode('empty'); return }
    setMode('loading')
    ;(async () => {
      let rawUrl = request.originalDocUrl || ''
      // Legacy base64 repair
      if (rawUrl.startsWith('data:') && rawUrl.includes('base64,')) {
        const idx = rawUrl.indexOf('base64,') + 7
        let b64 = rawUrl.substring(idx)
        const pm = b64.indexOf('JVBERi')
        if (pm > 0) rawUrl = `data:application/pdf;base64,${b64.substring(pm)}`
        else if (pm === 0) rawUrl = `data:application/pdf;base64,${b64}`
      }
      const pathUrl = mediaUrl(rawUrl)
      const absUrl  = absoluteMediaUrl(rawUrl)
      const isDocx  = /\.docx?$/i.test(rawUrl) || /\.docx?$/i.test(pathUrl) || /\.docx?$/i.test(absUrl)
      const isPdf   = /\.pdf$/i.test(rawUrl) || /\.pdf$/i.test(pathUrl) || /\.pdf$/i.test(absUrl)
                      || /^data:application\/pdf/i.test(rawUrl) || rawUrl.includes('JVBERi')

      try {
        if (isDocx) {
          const buf = await fetchArrayBuffer(pathUrl, absUrl)
          docxBufRef.current = buf
          setMode('docx')
          // render after DOM is ready
          setTimeout(async () => {
            try { await renderDocxIntoContainer(buf) }
            catch (e) { console.error('docx render failed', e); setMode('error') }
          }, 80)
        } else if (isPdf || rawUrl.startsWith('data:')) {
          const targets = rawUrl.startsWith('data:') ? [rawUrl] : [pathUrl, absUrl, rawUrl]
          let loaded = false
          for (const target of targets) {
            if (!target) continue
            try {
              const imgs = await renderPdfToPageImages(target)
              setPageImages(imgs); setCurrentPage(0)
              isPdfRef.current = true; setMode('pdf'); loaded = true; break
            } catch { /* try next */ }
          }
          if (!loaded) {
            const buf = await fetchArrayBuffer(pathUrl, absUrl)
            const imgs = await renderPdfToPageImages(buf)
            setPageImages(imgs); setCurrentPage(0)
            isPdfRef.current = true; setMode('pdf')
          }
        } else {
          // Try as image
          const img = new Image(); img.crossOrigin = 'anonymous'
          await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = pathUrl || absUrl })
          setPageImages([img]); setCurrentPage(0)
          isPdfRef.current = false; setMode('image')
        }
      } catch (err) {
        console.error('Document load failed:', err)
        setMode('error')
      }
    })()
  }, [request?.originalDocUrl, renderDocxIntoContainer])

  // ── Load local file (PDF / image / docx) ──────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMode('loading')
    setPlacedStamps([])
    try {
      const isDocx = file.name.match(/\.docx?$/i)
      const isPdf  = file.type === 'application/pdf' || file.name.endsWith('.pdf')
      if (isDocx) {
        const buf = await file.arrayBuffer()
        docxBufRef.current = buf
        setMode('docx')
        setTimeout(async () => {
          try { await renderDocxIntoContainer(buf); toast.success('Word document loaded') }
          catch { toast.error('Failed to render Word document'); setMode('error') }
        }, 80)
      } else if (isPdf) {
        const url = URL.createObjectURL(file)
        const imgs = await renderPdfToPageImages(url)
        URL.revokeObjectURL(url)
        setPageImages(imgs); setCurrentPage(0)
        isPdfRef.current = true; setMode('pdf')
        toast.success(`PDF loaded — ${imgs.length} page(s)`)
      } else {
        const reader = new FileReader()
        reader.onload = (ev) => {
          const img = new Image()
          img.onload = () => { setPageImages([img]); setCurrentPage(0); isPdfRef.current = false; setMode('image'); toast.success('Image loaded') }
          img.src = ev.target.result
        }
        reader.readAsDataURL(file)
      }
    } catch { toast.error('Failed to load file'); setMode('error') }
  }

  // ── Download original file ───────────────────────────────────────────────
  const handleDownloadOriginal = () => {
    const url = absoluteMediaUrl(request.originalDocUrl)
    const a = document.createElement('a')
    a.href = url; a.download = url.split('/').pop() || 'document'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  // ── Download docx as converted (re-download original buf) ───────────────
  const handleDownloadDocx = () => {
    if (!docxBufRef.current) { handleDownloadOriginal(); return }
    const blob = new Blob([docxBufRef.current], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${request.requestRef}.docx`
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  // ── Add stamp to current page ────────────────────────────────────────────
  const addStampInstance = (title, type, srcUrl) => {
    if (!srcUrl) return
    const imgObj = new Image(); imgObj.crossOrigin = 'anonymous'
    imgObj.onload = () => {
      const isSeal = type === 'seal'
      const canvas = canvasRef.current
      const W = canvas?.width || 1240; const H = canvas?.height || 1754
      const stamp = {
        id: `stamp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        page: currentPage,
        title: title || (isSeal ? 'Company Seal' : 'Official Signature'),
        type: isSeal ? 'seal' : 'signature',
        imgObj, src: srcUrl,
        x: isSeal ? Math.round(W * 0.55) : Math.round(W * 0.08),
        y: Math.round(H * 0.7),
        width: isSeal ? 130 : 220,
        height: isSeal ? 130 : 90,
        opacity: 1,
      }
      setPlacedStamps(prev => [...prev, stamp])
      setSelectedStampId(stamp.id)
      toast.success(`${stamp.title} placed on Page ${currentPage + 1}`)
    }
    imgObj.src = srcUrl.startsWith('data:') ? srcUrl : mediaUrl(srcUrl)
  }

  // ── Canvas mouse handlers ─────────────────────────────────────────────────
  const getCanvasPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width  / rect.width),
      y: (e.clientY - rect.top)  * (canvas.height / rect.height),
    }
  }
  const handleMouseDown = (e) => {
    const { x, y } = getCanvasPos(e)
    const cur = placedStamps.filter(s => s.page === currentPage)
    for (let i = cur.length - 1; i >= 0; i--) {
      const s = cur[i]
      if (x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height) {
        setSelectedStampId(s.id); setIsDragging(true); setDragOffset({ x: x - s.x, y: y - s.y }); return
      }
    }
    setSelectedStampId(null)
  }
  const handleMouseMove = (e) => {
    if (!isDragging || !selectedStampId) return
    const canvas = canvasRef.current; const { x, y } = getCanvasPos(e)
    setPlacedStamps(prev => prev.map(s => s.id !== selectedStampId ? s : {
      ...s,
      x: Math.max(0, Math.min(canvas.width  - s.width,  x - dragOffset.x)),
      y: Math.max(0, Math.min(canvas.height - s.height, y - dragOffset.y)),
    }))
  }
  const handleMouseUp  = () => setIsDragging(false)
  const handleDeleteStamp = (id) => {
    setPlacedStamps(prev => prev.filter(s => s.id !== id))
    if (selectedStampId === id) setSelectedStampId(null)
  }

  // ── Build signed PDF ─────────────────────────────────────────────────────
  const buildSignedPdf = async () => {
    const { default: jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
    const A4_W = pdf.internal.pageSize.getWidth()
    const A4_H = pdf.internal.pageSize.getHeight()
    for (let i = 0; i < pageImages.length; i++) {
      const img = pageImages[i]
      const W = img.naturalWidth || img.width || 1240
      const H = img.naturalHeight || img.height || 1754
      const c = document.createElement('canvas'); c.width = W; c.height = H
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0, W, H)
      placedStamps.filter(s => s.page === i).forEach(s => {
        if (!s.imgObj) return
        ctx.save(); ctx.globalAlpha = s.opacity ?? 1
        ctx.drawImage(s.imgObj, s.x, s.y, s.width, s.height); ctx.restore()
      })
      if (i > 0) pdf.addPage('a4', 'portrait')
      const aspect = W / H; const a4aspect = A4_W / A4_H
      let dW = A4_W, dH = A4_H, dX = 0, dY = 0
      if (aspect > a4aspect) { dH = A4_W / aspect; dY = (A4_H - dH) / 2 }
      else { dW = A4_H * aspect; dX = (A4_W - dW) / 2 }
      pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', dX, dY, dW, dH)
    }
    return pdf
  }

  // ── Finalize: upload signed doc ──────────────────────────────────────────
  const handleFinalize = async () => {
    if (mode !== 'pdf' && mode !== 'image')
      return toast.error('Load a PDF or image file first to place and apply stamps')
    if (placedStamps.length === 0)
      return toast.error('Place at least one signature or seal before finalizing')
    setLoading(true)
    try {
      let signedFile
      if (isPdfRef.current && pageImages.length > 0) {
        const pdf = await buildSignedPdf()
        signedFile = new File([pdf.output('blob')], `Signed_${request.requestRef}.pdf`, { type: 'application/pdf' })
      } else {
        const canvas = canvasRef.current
        const blob = await (await fetch(canvas.toDataURL('image/png'))).blob()
        signedFile = new File([blob], `Signed_${request.requestRef}.png`, { type: 'image/png' })
      }
      const meta = placedStamps.map(s => ({
        id: s.id, title: s.title, type: s.type, page: s.page,
        x: Math.round(s.x), y: Math.round(s.y),
        width: Math.round(s.width), height: Math.round(s.height), opacity: s.opacity,
      }))
      const fd = new FormData()
      fd.append('file', signedFile)
      fd.append('stampsMeta', JSON.stringify(meta))
      await api.put(`/signature-requests/${request._id}/sign`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Document signed & saved!')
      onSuccess(); onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to finalize')
    } finally { setLoading(false) }
  }

  // ── Download PDF preview ─────────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    if (pageImages.length === 0) return toast.error('No PDF/Image document loaded for download')
    try {
      const pdf = await buildSignedPdf()
      pdf.save(`Preview_${request.requestRef}.pdf`)
      toast.success('PDF downloaded!')
    } catch { toast.error('Failed to generate PDF') }
  }

  const selectedStamp  = placedStamps.find(s => s.id === selectedStampId)
  const pageStampCount = placedStamps.filter(s => s.page === currentPage).length
  const isSignMode     = mode === 'pdf' || mode === 'image'
  const isDocxMode     = mode === 'docx'

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[1400px] h-[92vh] max-h-[920px] flex flex-col overflow-hidden border border-slate-700/50"
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex-shrink-0 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              <FiLayers className="text-blue-400" /> Sign &amp; Stamp Editor
              {isDocxMode && <span className="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full">WORD DOC</span>}
              {isSignMode && totalPages > 1 && <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full">{totalPages} pages</span>}
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              <span className="font-mono text-blue-300">{request.requestRef}</span>
              {' '}· {request.employeeName} ({request.employeeType})
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Download original */}
            <button
              onClick={isDocxMode ? handleDownloadDocx : handleDownloadOriginal}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 border border-white/20 transition-all"
            >
              <FiDownload size={13} /> Download Original
            </button>
            {/* Replace / upload file — accepts PDF, image AND docx */}
            <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md transition-all">
              <FiUpload size={13} /> Replace File
              <input type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={handleFileUpload} />
            </label>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all">
              <FiX size={18} />
            </button>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">

          {/* ── Left: Document Area ────────────────────────────────────── */}
          <div ref={containerRef} className="flex-1 bg-slate-800 flex flex-col overflow-hidden">

            {/* Toolbar bar */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700 gap-3">
              {/* Left: file type + load */}
              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all">
                  <FiUpload size={12} /> Load File
                  <input type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={handleFileUpload} />
                </label>
                {isDocxMode && (
                  <span className="text-amber-400 text-[11px] font-semibold flex items-center gap-1">
                    <FiFileText size={12} /> Word preview — scroll to read all pages
                  </span>
                )}
              </div>

              {/* Center: page nav (PDF/image) */}
              {isSignMode && totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setCurrentPage(p => Math.max(0, p - 1)); setSelectedStampId(null) }}
                    disabled={currentPage === 0}
                    className="p-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-lg transition-all"
                  ><FiChevronLeft size={15} /></button>
                  <span className="text-white text-xs font-semibold tabular-nums min-w-[90px] text-center">
                    Page {currentPage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => { setCurrentPage(p => Math.min(totalPages - 1, p + 1)); setSelectedStampId(null) }}
                    disabled={currentPage === totalPages - 1}
                    className="p-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-lg transition-all"
                  ><FiChevronRight size={15} /></button>
                </div>
              )}

              {/* Right: zoom (PDF/image) */}
              {isSignMode && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"><FiZoomOut size={13} /></button>
                  <span className="text-white text-xs font-mono min-w-[38px] text-center">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"><FiZoomIn size={13} /></button>
                  <button onClick={() => setZoom(1)} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-[10px] rounded-lg transition-all">Fit</button>
                  {pageStampCount > 0 && (
                    <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {pageStampCount} stamp{pageStampCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Document viewport */}
            <div className="flex-1 overflow-auto custom-scrollbar" style={{ background: '#1e293b' }}>

              {/* ── Loading ── */}
              {mode === 'loading' && (
                <div className="flex flex-col items-center justify-center gap-4 h-full text-white">
                  <span className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-semibold">Loading document…</p>
                  <p className="text-xs text-slate-400">Rendering pages, please wait…</p>
                </div>
              )}

              {/* ── DOCX preview (docx-preview library renders actual Word pages) ── */}
              {(mode === 'docx' || isDocxMode) && (
                <div className="flex flex-col items-center py-6 px-4 min-h-full">
                  {/* info banner */}
                  <div className="w-full max-w-4xl mb-4 flex items-center justify-between bg-amber-900/30 border border-amber-700/40 rounded-xl px-4 py-2.5">
                    <span className="text-amber-300 text-xs font-semibold flex items-center gap-2">
                      <FiEdit3 size={13} /> Word document rendered with full formatting. Scroll to view all pages.
                    </span>
                    <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] rounded-xl cursor-pointer transition-all flex items-center gap-1.5">
                      <FiUpload size={12} /> Upload PDF to Sign & Stamp
                      <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>
                  {/* docx-preview renders here */}
                  <div
                    ref={docxContainerRef}
                    className="w-full max-w-4xl docx-preview-wrapper"
                    style={{
                      background: '#fff',
                      borderRadius: '12px',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                      minHeight: '80vh',
                    }}
                  />
                </div>
              )}

              {/* ── PDF / Image canvas (sign & stamp mode) ── */}
              {isSignMode && (
                <div className="flex items-start justify-center p-6 min-h-full">
                  <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.15s ease' }}>
                    <canvas
                      ref={canvasRef}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      className="shadow-2xl rounded-lg cursor-crosshair bg-white border border-slate-300 block"
                      style={{ maxWidth: '100%' }}
                    />
                  </div>
                </div>
              )}

              {/* ── Error ── */}
              {mode === 'error' && (
                <div className="flex flex-col items-center justify-center gap-3 h-full p-8">
                  <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center">
                    <FiFileText size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-white">Could Not Load Document</h3>
                  <p className="text-xs text-slate-400 max-w-sm text-center">
                    The file could not be found on server or failed to render. Please upload a local copy.
                  </p>
                  <label className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl cursor-pointer shadow-lg transition-all flex items-center gap-2">
                    <FiUpload size={15} /> Select Local File (PDF / DOCX / Image)
                    <input type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              )}

              {/* ── Empty / no doc ── */}
              {mode === 'empty' && (
                <div className="flex flex-col items-center justify-center gap-3 h-full p-8">
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <FiFileText size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-white">No Document Attached</h3>
                  <p className="text-xs text-slate-400 max-w-sm text-center">No document URL found. Upload a file to begin.</p>
                  <label className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl cursor-pointer shadow-lg transition-all flex items-center gap-2">
                    <FiUpload size={15} /> Upload File
                    <input type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* ── Right Sidebar ─────────────────────────────────────────── */}
          <div className="w-72 border-l border-slate-200 bg-slate-50 flex flex-col overflow-hidden flex-shrink-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

              {/* Stamp Library */}
              <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-sm">
                <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FiBookmark className="text-blue-600" size={12} /> Stamp Library
                </h4>
                {loadingLibrary ? (
                  <p className="text-xs text-slate-400">Loading…</p>
                ) : savedLibrary.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto custom-scrollbar">
                    {savedLibrary.map(st => {
                      const src = (st.imageUrl?.startsWith('data:') || st.imageUrl?.startsWith('blob:'))
                        ? st.imageUrl : mediaUrl(st.imageUrl)
                      return (
                        <button
                          key={st._id}
                          onClick={() => {
                            if (!isSignMode) return toast('Load a PDF or image file first to place stamps', { icon: 'ℹ️' })
                            addStampInstance(st.title, st.type, st.imageUrl)
                          }}
                          className="p-2 border border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50 rounded-xl text-left transition-all flex flex-col items-center gap-1 group"
                          title={`Place ${st.title}`}
                        >
                          {src && <img src={src} alt={st.title} className="w-14 h-10 object-contain" />}
                          <span className="text-[10px] font-semibold text-slate-600 text-center truncate w-full">{st.title}</span>
                          <span className="text-[9px] text-blue-500 font-bold opacity-0 group-hover:opacity-100 transition-all">+ Place</span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-2">No saved stamps. Add one below.</p>
                )}
              </div>

              {/* Add Signature / Seal */}
              <div className="grid grid-cols-2 gap-2">
                {[['signature', 'bg-blue-600 hover:bg-blue-700', '+ Signature'],
                  ['seal',      'bg-emerald-600 hover:bg-emerald-700', '+ Seal']].map(([type, cls, label]) => (
                  <button
                    key={type}
                    onClick={() => {
                      if (!isSignMode) return toast('Load a PDF or image file first to place stamps', { icon: 'ℹ️' })
                      const input = document.createElement('input')
                      input.type = 'file'; input.accept = 'image/*'
                      input.onchange = (e) => {
                        const file = e.target.files?.[0]; if (!file) return
                        const reader = new FileReader()
                        reader.onload = ev => addStampInstance(type === 'seal' ? 'Company Seal' : 'Signature', type, ev.target.result)
                        reader.readAsDataURL(file)
                      }
                      input.click()
                    }}
                    className={`py-2 px-2 ${cls} text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-all`}
                  >{label}</button>
                ))}
              </div>

              {/* Placed stamps list */}
              {placedStamps.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2 shadow-sm">
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Placed ({placedStamps.length})</h4>
                  <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                    {placedStamps.map((s, idx) => (
                      <div
                        key={s.id}
                        onClick={() => { setCurrentPage(s.page); setSelectedStampId(s.id) }}
                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${
                          s.id === selectedStampId ? 'bg-blue-50 border border-blue-300' : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-bold text-slate-700">#{idx + 1} {s.title}</span>
                          <span className="block text-[10px] text-slate-400 font-medium">{s.type} · Page {s.page + 1}</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteStamp(s.id) }} className="p-1 text-slate-300 hover:text-red-500 transition-all">
                          <FiTrash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stamp size/opacity controls */}
              {selectedStamp && selectedStamp.page === currentPage && (
                <div className="bg-white border border-blue-200 rounded-2xl p-3.5 space-y-3 shadow-sm">
                  <p className="text-[11px] font-bold text-blue-700 uppercase">{selectedStamp.title}</p>
                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Size</span><span className="font-mono">{Math.round(selectedStamp.width)}px</span>
                    </div>
                    <input type="range" min="40" max="400" value={selectedStamp.width}
                      onChange={(e) => {
                        const w = Number(e.target.value)
                        const h = selectedStamp.type === 'seal' ? w : Math.round(w / 2.5)
                        setPlacedStamps(prev => prev.map(s => s.id === selectedStamp.id ? { ...s, width: w, height: h } : s))
                      }}
                      className="w-full accent-blue-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Opacity</span><span className="font-mono">{Math.round((selectedStamp.opacity ?? 1) * 100)}%</span>
                    </div>
                    <input type="range" min="20" max="100" value={Math.round((selectedStamp.opacity ?? 1) * 100)}
                      onChange={(e) => {
                        const op = Number(e.target.value) / 100
                        setPlacedStamps(prev => prev.map(s => s.id === selectedStamp.id ? { ...s, opacity: op } : s))
                      }}
                      className="w-full accent-blue-600"
                    />
                  </div>
                </div>
              )}

              {/* Tip */}
              <div className="text-[11px] text-slate-400 bg-slate-100 p-3 rounded-xl flex items-start gap-2">
                <FiMove size={12} className="text-slate-400 shrink-0 mt-0.5" />
                <span>For PDF/Image: navigate pages with ← → and drag stamps. For Word: scroll to read all pages then upload a PDF to sign.</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="p-4 border-t border-slate-200 space-y-2 flex-shrink-0">
              <button
                onClick={handleFinalize}
                disabled={loading || !isSignMode || placedStamps.length === 0}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all text-sm"
              >
                {loading
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><FiCheck size={16} /> Apply Signature &amp; Save</>}
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={loading || !isSignMode}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
              >
                <FiDownload size={14} /> Download Signed PDF
              </button>
              <button
                onClick={onClose}
                className="w-full py-2 px-4 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* docx-preview global styles */}
      <style>{`
        .docx-preview-wrapper .docx-wrapper {
          background: #f1f5f9 !important;
          padding: 24px !important;
        }
        .docx-preview-wrapper .docx-wrapper > section {
          background: #fff !important;
          margin: 0 auto 24px auto !important;
          box-shadow: 0 4px 24px rgba(0,0,0,0.12) !important;
          border-radius: 4px !important;
          padding: 60px 72px !important;
          max-width: 816px !important;
        }
        .docx-preview-wrapper table { border-collapse: collapse !important; }
        .docx-preview-wrapper td, .docx-preview-wrapper th { border: 1px solid #e2e8f0 !important; }
        .docx-preview-wrapper img { max-width: 100% !important; }
      `}</style>
    </div>
  )
}
