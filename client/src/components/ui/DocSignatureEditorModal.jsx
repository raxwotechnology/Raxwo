import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiX, FiCheck, FiUpload, FiMove, FiLayers, FiFileText,
  FiTrash2, FiBookmark, FiDownload, FiChevronLeft, FiChevronRight,
  FiZoomIn, FiZoomOut
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

// ── Component ───────────────────────────────────────────────────────────────
export default function DocSignatureEditorModal({ request, onClose, onSuccess }) {
  const canvasRef   = useRef(null)
  const containerRef = useRef(null)
  const isPdfRef    = useRef(false)

  const [pageImages,     setPageImages]     = useState([])  // HTMLImageElement[]
  const [currentPage,    setCurrentPage]    = useState(0)   // 0-indexed
  const [docLoading,     setDocLoading]     = useState(true)
  const [loading,        setLoading]        = useState(false)
  const [zoom,           setZoom]           = useState(1)
  const [isWordDoc,      setIsWordDoc]      = useState(false)
  const [docLoadError,   setDocLoadError]   = useState(false)

  // Stamps — each has a `.page` so stamps are per-page
  const [placedStamps,   setPlacedStamps]   = useState([])
  const [selectedStampId,setSelectedStampId]= useState(null)
  const [isDragging,     setIsDragging]     = useState(false)
  const [dragOffset,     setDragOffset]     = useState({ x: 0, y: 0 })

  const [savedLibrary,   setSavedLibrary]   = useState([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)

  const totalPages = pageImages.length

  // ── Load Stamp Library ────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      setLoadingLibrary(true)
      try {
        const res = await api.get('/signature-requests/saved-stamps')
        if (res.data?.stamps) setSavedLibrary(res.data.stamps)
      } catch { /* silent */ } finally { setLoadingLibrary(false) }
    })()
  }, [])

  // ── Draw canvas whenever page / stamps / zoom / selection changes ─────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || pageImages.length === 0) return
    const img = pageImages[currentPage]
    if (!img) return

    const W = img.naturalWidth  || img.width  || 1240
    const H = img.naturalHeight || img.height || 1754
    canvas.width  = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(img, 0, 0, W, H)

    placedStamps.filter(s => s.page === currentPage).forEach(s => {
      if (!s.imgObj) return
      // selection highlight
      if (s.id === selectedStampId) {
        ctx.save()
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth   = 3
        ctx.setLineDash([8, 4])
        ctx.strokeRect(s.x - 5, s.y - 5, s.width + 10, s.height + 10)
        ctx.setLineDash([])
        ctx.restore()
      }
      ctx.save()
      ctx.globalAlpha = s.opacity ?? 1
      ctx.drawImage(s.imgObj, s.x, s.y, s.width, s.height)
      ctx.restore()
    })
  }, [pageImages, currentPage, placedStamps, selectedStampId])

  // ── Load Document on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (!request?.originalDocUrl) return
    setDocLoading(true)
    setIsWordDoc(false)
    setDocLoadError(false)

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
      const absUrl = absoluteMediaUrl(rawUrl)

      // Check if it's a Word document (.doc / .docx)
      const checkWordDoc = /\.docx?$/i.test(rawUrl) || /\.docx?$/i.test(pathUrl) || /\.docx?$/i.test(absUrl)
      if (checkWordDoc) {
        setIsWordDoc(true)
        setDocLoading(false)
        return
      }

      const isPdf = /\.pdf$/i.test(rawUrl) || /\.pdf$/i.test(pathUrl) || /\.pdf$/i.test(absUrl) ||
                    /^data:application\/pdf/i.test(rawUrl) || rawUrl.includes('JVBERi')
      try {
        let targets = rawUrl.startsWith('data:') ? [rawUrl] : [pathUrl, absUrl, rawUrl]
        let loaded = false
        for (const target of targets) {
          if (!target) continue
          try {
            if (isPdf || /\.pdf$/i.test(target)) {
              const imgs = await renderPdfToPageImages(target)
              setPageImages(imgs)
              setCurrentPage(0)
              isPdfRef.current = true
              loaded = true
              break
            } else {
              const img = new Image()
              img.crossOrigin = 'anonymous'
              await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = target })
              setPageImages([img])
              setCurrentPage(0)
              isPdfRef.current = false
              loaded = true
              break
            }
          } catch (e) {
            console.warn('Document load attempt failed for target:', target)
          }
        }
        if (!loaded) {
          // Fallback via authenticated api arrayBuffer request
          const res = await api.get(pathUrl || absUrl, { responseType: 'arraybuffer' })
          const imgs = await renderPdfToPageImages(res.data)
          setPageImages(imgs)
          setCurrentPage(0)
          isPdfRef.current = true
        }
      } catch (err) {
        console.error('Failed to load document:', err)
        setDocLoadError(true)
      } finally {
        setDocLoading(false)
      }
    })()
  }, [request?.originalDocUrl])

  // ── Load local file ───────────────────────────────────────────────────────
  const handleCustomDocUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
      toast.error('Word (.docx) files cannot be rendered directly on canvas. Please select a PDF or Image file.')
      return
    }
    setDocLoading(true)
    setIsWordDoc(false)
    setDocLoadError(false)
    try {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const url = URL.createObjectURL(file)
        const imgs = await renderPdfToPageImages(url)
        URL.revokeObjectURL(url)
        setPageImages(imgs)
        setCurrentPage(0)
        isPdfRef.current = true
        setPlacedStamps([])
        toast.success(`PDF loaded — ${imgs.length} page(s)`)
      } else {
        const reader = new FileReader()
        reader.onload = (ev) => {
          const img = new Image()
          img.onload = () => {
            setPageImages([img])
            setCurrentPage(0)
            isPdfRef.current = false
            setPlacedStamps([])
            toast.success('Image loaded')
          }
          img.src = ev.target.result
        }
        reader.readAsDataURL(file)
      }
    } catch { toast.error('Failed to load file') }
    finally { setDocLoading(false) }
  }

  // ── Add stamp to current page ─────────────────────────────────────────────
  const addStampInstance = (title, type, srcUrl) => {
    if (!srcUrl) return
    const imgObj = new Image()
    imgObj.crossOrigin = 'anonymous'
    imgObj.onload = () => {
      const isSeal = type === 'seal'
      const canvas = canvasRef.current
      const W = canvas?.width || 1240
      const H = canvas?.height || 1754
      const stamp = {
        id: `stamp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        page: currentPage,
        title: title || (isSeal ? 'Company Seal' : 'Official Signature'),
        type: isSeal ? 'seal' : 'signature',
        imgObj,
        src: srcUrl,
        x: isSeal ? Math.round(W * 0.55) : Math.round(W * 0.08),
        y: Math.round(H * 0.7),
        width: isSeal ? 130 : 220,
        height: isSeal ? 130 : 90,
        opacity: 1
      }
      setPlacedStamps(prev => [...prev, stamp])
      setSelectedStampId(stamp.id)
      toast.success(`${stamp.title} placed on Page ${currentPage + 1}`)
    }
    imgObj.src = mediaUrl(srcUrl)
  }

  // ── Mouse handlers (only interact with current page's stamps) ────────────
  const getCanvasPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width  / rect.width),
      y: (e.clientY - rect.top)  * (canvas.height / rect.height)
    }
  }

  const handleMouseDown = (e) => {
    const { x, y } = getCanvasPos(e)
    const curPageStamps = placedStamps.filter(s => s.page === currentPage)
    for (let i = curPageStamps.length - 1; i >= 0; i--) {
      const s = curPageStamps[i]
      if (x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height) {
        setSelectedStampId(s.id)
        setIsDragging(true)
        setDragOffset({ x: x - s.x, y: y - s.y })
        return
      }
    }
    setSelectedStampId(null)
  }

  const handleMouseMove = (e) => {
    if (!isDragging || !selectedStampId) return
    const canvas = canvasRef.current
    const { x, y } = getCanvasPos(e)
    setPlacedStamps(prev => prev.map(s => {
      if (s.id !== selectedStampId) return s
      return {
        ...s,
        x: Math.max(0, Math.min(canvas.width  - s.width,  x - dragOffset.x)),
        y: Math.max(0, Math.min(canvas.height - s.height, y - dragOffset.y))
      }
    }))
  }

  const handleMouseUp = () => setIsDragging(false)

  const handleDeleteStamp = (id) => {
    setPlacedStamps(prev => prev.filter(s => s.id !== id))
    if (selectedStampId === id) setSelectedStampId(null)
  }

  // ── Build signed PDF (multi-page, each page with its stamps) ─────────────
  const buildSignedPdf = async () => {
    const { default: jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
    const A4_W = pdf.internal.pageSize.getWidth()
    const A4_H = pdf.internal.pageSize.getHeight()

    for (let i = 0; i < pageImages.length; i++) {
      const img = pageImages[i]
      const W = img.naturalWidth  || img.width  || 1240
      const H = img.naturalHeight || img.height || 1754

      // Draw page + stamps into a temp canvas
      const c = document.createElement('canvas')
      c.width = W; c.height = H
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0, W, H)
      placedStamps.filter(s => s.page === i).forEach(s => {
        if (!s.imgObj) return
        ctx.save(); ctx.globalAlpha = s.opacity ?? 1
        ctx.drawImage(s.imgObj, s.x, s.y, s.width, s.height)
        ctx.restore()
      })

      if (i > 0) pdf.addPage('a4', 'portrait')

      // Fit proportionally into A4
      const aspect = W / H
      const a4aspect = A4_W / A4_H
      let dW = A4_W, dH = A4_H, dX = 0, dY = 0
      if (aspect > a4aspect) { dH = A4_W / aspect; dY = (A4_H - dH) / 2 }
      else                   { dW = A4_H * aspect; dX = (A4_W - dW) / 2 }

      pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', dX, dY, dW, dH)
    }
    return pdf
  }

  // ── Finalize: upload to server ────────────────────────────────────────────
  const handleFinalize = async () => {
    if (placedStamps.length === 0)
      return toast.error('Place at least one signature or seal before finalizing')
    setLoading(true)
    try {
      let signedFile
      if (isPdfRef.current && pageImages.length > 0) {
        const pdf = await buildSignedPdf()
        signedFile = new File([pdf.output('blob')], `Signed_${request.requestRef}.pdf`, { type: 'application/pdf' })
      } else {
        // Single image — use main canvas
        const canvas = canvasRef.current
        const dataUrl = canvas.toDataURL('image/png')
        const blob = await (await fetch(dataUrl)).blob()
        signedFile = new File([blob], `Signed_${request.requestRef}.png`, { type: 'image/png' })
      }

      const meta = placedStamps.map(s => ({
        id: s.id, title: s.title, type: s.type, page: s.page,
        x: Math.round(s.x), y: Math.round(s.y),
        width: Math.round(s.width), height: Math.round(s.height),
        opacity: s.opacity
      }))

      const fd = new FormData()
      fd.append('file', signedFile)
      fd.append('stampsMeta', JSON.stringify(meta))
      await api.put(`/signature-requests/${request._id}/sign`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      toast.success('Document signed & saved!')
      onSuccess(); onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to finalize')
    } finally { setLoading(false) }
  }

  // ── Local PDF download (preview without uploading) ────────────────────────
  const handleDownloadPdf = async () => {
    if (pageImages.length === 0) return toast.error('No document loaded')
    try {
      const pdf = await buildSignedPdf()
      pdf.save(`Preview_${request.requestRef}.pdf`)
      toast.success('PDF downloaded!')
    } catch (err) {
      toast.error('Failed to generate PDF')
      console.error(err)
    }
  }

  const selectedStamp = placedStamps.find(s => s.id === selectedStampId)
  const pageStampCount = placedStamps.filter(s => s.page === currentPage).length

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden"
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex-shrink-0 border-b border-slate-800">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <FiLayers className="text-blue-400" /> Sign &amp; Stamp Editor
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Ref: <span className="font-mono font-bold text-blue-200">{request.requestRef}</span>
              {' '}| Requester: <span className="font-semibold text-slate-200">{request.employeeName} ({request.employeeType})</span>
              {totalPages > 1 && <span className="ml-2 bg-blue-500/20 text-blue-300 border border-blue-400/30 font-bold px-2 py-0.5 rounded-full text-[10px]">{totalPages} pages</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const url = absoluteMediaUrl(request.originalDocUrl)
                window.open(url.startsWith('data:') ? url : url, '_blank')
              }}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 border border-white/20 transition-all"
            >
              <FiFileText size={13} /> Open Original
            </button>
            <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md transition-all">
              <FiUpload size={13} /> Replace File
              <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleCustomDocUpload} />
            </label>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all">
              <FiX size={18} />
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">

          {/* ── Canvas Area ───────────────────────────────────────────────── */}
          <div
            ref={containerRef}
            className="flex-1 bg-slate-900 flex flex-col overflow-hidden"
          >
            {/* Page navigation bar */}
            {!docLoading && totalPages > 0 && (
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all">
                    <FiUpload size={12} /> Load Local File
                    <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleCustomDocUpload} />
                  </label>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setCurrentPage(p => Math.max(0, p - 1)); setSelectedStampId(null) }}
                      disabled={currentPage === 0}
                      className="p-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-lg transition-all"
                    >
                      <FiChevronLeft size={16} />
                    </button>
                    <span className="text-white text-sm font-semibold tabular-nums min-w-[80px] text-center">
                      Page {currentPage + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => { setCurrentPage(p => Math.min(totalPages - 1, p + 1)); setSelectedStampId(null) }}
                      disabled={currentPage === totalPages - 1}
                      className="p-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-lg transition-all"
                    >
                      <FiChevronRight size={16} />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button onClick={() => setZoom(z => Math.max(0.4, z - 0.15))} className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"><FiZoomOut size={14} /></button>
                  <span className="text-white text-xs font-mono min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(z => Math.min(3, z + 0.15))} className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"><FiZoomIn size={14} /></button>
                  <button onClick={() => setZoom(1)} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-all">Reset</button>
                  {pageStampCount > 0 && (
                    <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {pageStampCount} stamp{pageStampCount > 1 ? 's' : ''} on page
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Canvas scroll container */}
            <div className="flex-1 overflow-auto p-4 flex items-start justify-center custom-scrollbar">
              {docLoading ? (
                <div className="flex flex-col items-center justify-center gap-4 mt-20 text-white">
                  <span className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-semibold">Loading &amp; rendering document…</p>
                  {totalPages > 0 && <p className="text-xs text-slate-400">Rendering pages…</p>}
                </div>
              ) : pageImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 my-auto p-8 max-w-lg bg-slate-800/90 border border-slate-700 rounded-3xl text-center shadow-2xl animate-fade-in">
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                    <FiFileText size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    {isWordDoc ? 'Word Document (.docx) Format Detected' : docLoadError ? 'Document File Missing on Server (404)' : 'No Document Rendered'}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {isWordDoc
                      ? 'Interactive digital signing & stamp placement requires PDF or Image format (.pdf, .png, .jpg). Word files (.docx) cannot be drawn directly on canvas. Please select or upload a PDF/Image file below.'
                      : docLoadError
                      ? 'The uploaded file could not be found on server storage. You can select a local PDF or image file to proceed with signature placement.'
                      : 'Please select a local PDF or image file to render on the signature canvas.'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                    <label className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl cursor-pointer shadow-lg transition-all flex items-center gap-2">
                      <FiUpload size={15} /> Select Local PDF / Image
                      <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleCustomDocUpload} />
                    </label>
                    {isWordDoc && request?.originalDocUrl && (
                      <a
                        href={absoluteMediaUrl(request.originalDocUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <FiDownload size={14} /> Download Original Word Doc
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.15s ease' }}
                >
                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    className="shadow-2xl rounded-lg cursor-crosshair bg-white border border-slate-300 block"
                    style={{ maxWidth: '100%' }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── Right Sidebar ─────────────────────────────────────────────── */}
          <div className="w-80 border-l border-slate-200 bg-slate-50 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">

              {/* Saved Stamp Library */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FiBookmark className="text-blue-600" /> Stamp Library
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
                          onClick={() => addStampInstance(st.title, st.type, st.imageUrl)}
                          className="p-2 border border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50 rounded-xl text-left transition-all flex flex-col items-center gap-1 group"
                          title={`Place ${st.title} on Page ${currentPage + 1}`}
                        >
                          {src && <img src={src} alt={st.title} className="w-14 h-10 object-contain" />}
                          <span className="text-[10px] font-semibold text-slate-600 text-center truncate w-full">{st.title}</span>
                          <span className="text-[9px] text-blue-500 font-bold opacity-0 group-hover:opacity-100 transition-all">+ Place Copy</span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-2">No saved stamps. Add one below.</p>
                )}
              </div>

              {/* Add Signature / Seal buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'; input.accept = 'image/*'
                    input.onchange = (e) => {
                      const file = e.target.files?.[0]; if (!file) return
                      const reader = new FileReader()
                      reader.onload = ev => addStampInstance('Signature', 'signature', ev.target.result)
                      reader.readAsDataURL(file)
                    }
                    input.click()
                  }}
                  className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
                >
                  + Add Signature
                </button>
                <button
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'; input.accept = 'image/*'
                    input.onchange = (e) => {
                      const file = e.target.files?.[0]; if (!file) return
                      const reader = new FileReader()
                      reader.onload = ev => addStampInstance('Company Seal', 'seal', ev.target.result)
                      reader.readAsDataURL(file)
                    }
                    input.click()
                  }}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
                >
                  + Add Seal
                </button>
              </div>

              {/* Placed stamps list — grouped by page */}
              {placedStamps.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Placed Stamps ({placedStamps.length})
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
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
                          <span className="block text-[10px] text-slate-400 font-medium uppercase">{s.type} • Page {s.page + 1}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteStamp(s.id) }}
                          className="p-1 text-slate-300 hover:text-red-500 transition-all rounded-lg"
                        >
                          <FiTrash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stamp size control */}
              {selectedStamp && selectedStamp.page === currentPage && (
                <div className="bg-white border border-blue-200 rounded-2xl p-4 space-y-3 shadow-sm">
                  <p className="text-xs font-bold text-blue-700 uppercase">{selectedStamp.title}</p>
                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Width / Size</span>
                      <span className="font-mono">{Math.round(selectedStamp.width)}px</span>
                    </div>
                    <input
                      type="range" min="40" max="400"
                      value={selectedStamp.width}
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
                      <span>Opacity</span>
                      <span className="font-mono">{Math.round((selectedStamp.opacity ?? 1) * 100)}%</span>
                    </div>
                    <input
                      type="range" min="20" max="100"
                      value={Math.round((selectedStamp.opacity ?? 1) * 100)}
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
                <FiMove size={13} className="text-slate-400 shrink-0 mt-0.5" />
                <span>Navigate pages with ← → buttons. Stamps are saved per page. Drag stamps to position them.</span>
              </div>
            </div>

            {/* Bottom action buttons */}
            <div className="p-5 border-t border-slate-200 space-y-2 flex-shrink-0">
              <button
                onClick={handleFinalize}
                disabled={loading || pageImages.length === 0}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
              >
                {loading
                  ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><FiCheck size={18} /> Apply Signature &amp; Save</>}
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={loading || pageImages.length === 0}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 transition-all"
              >
                <FiDownload size={15} /> Download PDF Preview
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
    </div>
  )
}
