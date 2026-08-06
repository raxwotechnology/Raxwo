import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiX, FiCheck, FiUpload, FiMove, FiLayers, FiAlertCircle, FiFileText, FiPlus, FiTrash2, FiBookmark, FiDownload } from 'react-icons/fi'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { absoluteMediaUrl, mediaUrl } from '../../lib/media'

// Load PDF.js library lazily
async function ensurePdfJs() {
  if (window.pdfjsLib) return
  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      }
      resolve()
    }
    script.onerror = () => reject(new Error('Failed to load PDF.js library'))
    document.head.appendChild(script)
  })
}

// Render ALL pages of a PDF stacked vertically into a single HTMLImageElement
// Returns { img, layouts: [{yStart, height, width}] } for PDF output splitting
async function renderAllPdfPagesToImage(pdfUrlOrData) {
  await ensurePdfJs()

  let loadingTask
  if (typeof pdfUrlOrData === 'string' && pdfUrlOrData.startsWith('data:') && pdfUrlOrData.includes('base64,')) {
    const commaIdx = pdfUrlOrData.indexOf('base64,') + 7
    let b64 = pdfUrlOrData.substring(commaIdx)
    const pdfMagic = b64.indexOf('JVBERi')
    if (pdfMagic > 0) b64 = b64.substring(pdfMagic)
    const raw = atob(b64)
    const uint8Array = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) uint8Array[i] = raw.charCodeAt(i)
    loadingTask = window.pdfjsLib.getDocument({ data: uint8Array })
  } else if (typeof pdfUrlOrData === 'string' && (pdfUrlOrData.startsWith('http') || pdfUrlOrData.startsWith('/'))) {
    const resp = await fetch(pdfUrlOrData)
    const buf = await resp.arrayBuffer()
    loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(buf) })
  } else {
    loadingTask = window.pdfjsLib.getDocument({ url: pdfUrlOrData, withCredentials: false })
  }

  const pdf = await loadingTask.promise
  const numPages = pdf.numPages
  const PAGE_GAP = 12
  const SCALE = 2.0

  const pageCanvases = []
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: SCALE })
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = viewport.width
    pageCanvas.height = viewport.height
    await page.render({ canvasContext: pageCanvas.getContext('2d'), viewport }).promise
    pageCanvases.push(pageCanvas)
  }

  const maxWidth = Math.max(...pageCanvases.map(c => c.width))
  const totalHeight = pageCanvases.reduce((sum, c) => sum + c.height + PAGE_GAP, -PAGE_GAP)

  // Track page boundaries in combined canvas coords for PDF splitting
  const layouts = []
  let yOffset = 0
  for (const pc of pageCanvases) {
    layouts.push({ yStart: yOffset, height: pc.height, width: pc.width })
    yOffset += pc.height + PAGE_GAP
  }

  const combined = document.createElement('canvas')
  combined.width = maxWidth
  combined.height = totalHeight
  const ctx = combined.getContext('2d')
  ctx.fillStyle = '#e5e7eb'
  ctx.fillRect(0, 0, maxWidth, totalHeight)
  yOffset = 0
  for (const pc of pageCanvases) {
    ctx.drawImage(pc, Math.floor((maxWidth - pc.width) / 2), yOffset)
    yOffset += pc.height + PAGE_GAP
  }

  const img = new Image()
  const imgPromise = new Promise((resolve, reject) => {
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = combined.toDataURL('image/png')
  })
  await imgPromise
  return { img, layouts }
}

export default function DocSignatureEditorModal({ request, onClose, onSuccess, defaultSignature, defaultSeal }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const pageLayoutsRef = useRef([])   // [{yStart, height, width}] per PDF page in combined canvas
  const isPdfDocRef = useRef(false)   // true if the loaded document is/was a PDF

  const [loading, setLoading] = useState(false)
  const [docLoading, setDocLoading] = useState(true)
  const [docImage, setDocImage] = useState(null)

  // Multiple Placed Stamps State Array on Canvas
  const [placedStamps, setPlacedStamps] = useState([])
  const [selectedStampId, setSelectedStampId] = useState(null)

  // Library of Saved Stamps from Backend
  const [savedLibrary, setSavedLibrary] = useState([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)

  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // Fetch Saved Stamps Library
  useEffect(() => {
    const fetchSavedStamps = async () => {
      setLoadingLibrary(true)
      try {
        const res = await api.get('/signature-requests/saved-stamps')
        if (res.data?.stamps) {
          setSavedLibrary(res.data.stamps)
        }
      } catch (err) {
        console.warn('Failed to load saved stamps library:', err)
      } finally {
        setLoadingLibrary(false)
      }
    }
    fetchSavedStamps()
  }, [])

  // Helper to add a new stamp instance to canvas
  const addStampInstance = (title, type, srcUrl) => {
    if (!srcUrl) return
    const imgObj = new Image()
    imgObj.crossOrigin = 'anonymous'
    imgObj.onload = () => {
      const isSeal = type === 'seal'
      const newStamp = {
        id: `stamp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title: title || (isSeal ? 'Company Seal' : 'Official Signature'),
        type: isSeal ? 'seal' : 'signature',
        imgObj,
        src: srcUrl,
        x: isSeal ? 320 : 100 + (placedStamps.length * 20),
        y: isSeal ? 520 : 540 + (placedStamps.length * 15),
        width: isSeal ? 130 : 180,
        height: isSeal ? 130 : 90,
        opacity: isSeal ? 0.95 : 1
      }
      setPlacedStamps(prev => [...prev, newStamp])
      setSelectedStampId(newStamp.id)
      toast.success(`${newStamp.title} added to document!`)
    }
    imgObj.src = mediaUrl(srcUrl)
  }

  // Load Initial Document & Default Stamps
  useEffect(() => {
    if (!request?.originalDocUrl) return
    setDocLoading(true)

    let rawUrl = request.originalDocUrl || ''

    // Legacy base64 URL repair (for old records only — new records use /uploads/ disk paths)
    if (typeof rawUrl === 'string' && rawUrl.startsWith('data:') && rawUrl.includes('base64,')) {
      const commaIdx = rawUrl.indexOf('base64,') + 7
      let b64Content = rawUrl.substring(commaIdx)
      const pdfMagic = b64Content.indexOf('JVBERi')
      const pngMagic = b64Content.indexOf('iVBORw')
      if (pdfMagic > 0) {
        rawUrl = `data:application/pdf;base64,${b64Content.substring(pdfMagic)}`
      } else if (pdfMagic === 0) {
        rawUrl = `data:application/pdf;base64,${b64Content}`
      } else if (pngMagic > 0) {
        rawUrl = `data:image/png;base64,${b64Content.substring(pngMagic)}`
      }
    } else if (typeof rawUrl === 'string' && rawUrl.includes('base64,') && !rawUrl.startsWith('data:')) {
      const idx = rawUrl.indexOf('base64,')
      const content = rawUrl.substring(idx + 7)
      rawUrl = content.includes('JVBERi')
        ? `data:application/pdf;base64,${content}`
        : `data:image/png;base64,${content}`
    }

    // Build the full URL for disk-stored files
    const fullUrl = absoluteMediaUrl(rawUrl)

    const isPdf =
      /\.pdf$/i.test(rawUrl) ||
      /\.pdf$/i.test(fullUrl) ||
      /^data:application\/pdf/i.test(rawUrl) ||
      (typeof rawUrl === 'string' && rawUrl.includes('JVBERi'))

    const loadDocument = async () => {
      try {
        if (!rawUrl) throw new Error('No document URL provided')

        // Determine the target URL to load
        const target = rawUrl.startsWith('data:') ? rawUrl : fullUrl

        // 1. Try PDF rendering (all pages stacked)
        if (isPdf || rawUrl.startsWith('data:application/pdf') || /\.pdf$/i.test(target)) {
          try {
            const { img: renderedImg, layouts } = await renderAllPdfPagesToImage(target)
            setDocImage(renderedImg)
            pageLayoutsRef.current = layouts
            isPdfDocRef.current = true
            setDocLoading(false)
            return
          } catch (pdfErr) {
            console.warn('PDF rendering failed, trying image loader:', pdfErr)
          }
        }

        // 2. Try as image (PNG/JPG from /uploads/ or data URI)
        try {
          const dImg = new Image()
          dImg.crossOrigin = 'anonymous'
          await new Promise((resolve, reject) => {
            dImg.onload = resolve
            dImg.onerror = reject
            dImg.src = target
          })
          setDocImage(dImg)
          pageLayoutsRef.current = []
          isPdfDocRef.current = false
          setDocLoading(false)
          return
        } catch {
          // image load also failed — try PDF renderer as last resort
        }

        // 3. Last resort — attempt PDF render even if not detected as PDF (might be mis-typed)
        try {
          const { img: renderedImg, layouts } = await renderAllPdfPagesToImage(target)
          setDocImage(renderedImg)
          pageLayoutsRef.current = layouts
          isPdfDocRef.current = true
          setDocLoading(false)
          return
        } catch (finalErr) {
          console.warn('All document load attempts failed:', finalErr)
          throw finalErr
        }

      } catch (err) {
        console.warn('Document load failed, showing fallback template:', err)
        // Simple error fallback canvas
        const fallbackCanvas = document.createElement('canvas')
        fallbackCanvas.width = 850
        fallbackCanvas.height = 1100
        const ctx = fallbackCanvas.getContext('2d')
        ctx.fillStyle = '#f8fafc'
        ctx.fillRect(0, 0, 850, 1100)
        ctx.strokeStyle = '#e2e8f0'
        ctx.lineWidth = 2
        ctx.strokeRect(20, 20, 810, 1060)
        ctx.fillStyle = '#94a3b8'
        ctx.font = 'bold 18px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('⚠ Could not load original document', 425, 520)
        ctx.font = '14px sans-serif'
        ctx.fillText('Use "Load Local File" to load it from your computer', 425, 560)
        ctx.fillText(`Ref: ${request.requestRef || ''}`, 425, 600)
        ctx.textAlign = 'left'
        const loadedImg = new Image()
        loadedImg.src = fallbackCanvas.toDataURL()
        await new Promise((res) => { loadedImg.onload = res })
        setDocImage(loadedImg)
      } finally {
        setDocLoading(false)
      }
    }

    loadDocument()

    // Add Default Signature & Seal if provided
    if (defaultSignature) {
      addStampInstance('Official Signature', 'signature', defaultSignature)
    }
    if (defaultSeal) {
      addStampInstance('Company Seal', 'seal', defaultSeal)
    }
  }, [request])

  // Custom Stamp Upload on the fly
  const handleCustomStampUpload = (e, type) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      addStampInstance(type === 'seal' ? 'Custom Seal' : 'Custom Signature', type, evt.target.result)
    }
    reader.readAsDataURL(file)
  }

  // Load Custom Local Document File
  const handleCustomDocUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setDocLoading(true)

    try {
      if (file.type === 'application/pdf') {
        const fileUrl = URL.createObjectURL(file)
        const { img: pdfImg, layouts } = await renderAllPdfPagesToImage(fileUrl)
        setDocImage(pdfImg)
        pageLayoutsRef.current = layouts
        isPdfDocRef.current = true
        URL.revokeObjectURL(fileUrl)
        toast.success(`PDF loaded — ${layouts.length} page(s) rendered`)
      } else {
        const reader = new FileReader()
        reader.onload = (evt) => {
          const img = new Image()
          img.onload = () => {
            setDocImage(img)
            pageLayoutsRef.current = []
            isPdfDocRef.current = false
            toast.success('Document image loaded successfully!')
          }
          img.src = evt.target.result
        }
        reader.readAsDataURL(file)
      }
    } catch (err) {
      toast.error('Failed to load selected document file')
      console.error(err)
    } finally {
      setDocLoading(false)
    }
  }

  // Draw Canvas with Document and ALL Placed Stamps
  const drawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas || !docImage) return

    const ctx = canvas.getContext('2d')
    canvas.width = docImage.width || 850
    canvas.height = docImage.height || 1100

    // Draw document background
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(docImage, 0, 0, canvas.width, canvas.height)

    // Draw all placed stamps
    placedStamps.forEach(s => {
      if (!s.imgObj) return
      ctx.save()
      ctx.globalAlpha = s.opacity ?? 1
      ctx.drawImage(s.imgObj, s.x, s.y, s.width, s.height)
      ctx.restore()

      // Selection box highlight for selected stamp
      if (s.id === selectedStampId) {
        ctx.strokeStyle = s.type === 'seal' ? '#059669' : '#2563eb'
        ctx.lineWidth = 3
        ctx.setLineDash([6, 4])
        ctx.strokeRect(s.x - 3, s.y - 3, s.width + 6, s.height + 6)
      }
    })
  }

  useEffect(() => {
    drawCanvas()
  }, [docImage, placedStamps, selectedStampId])

  // Canvas Dragging Logic for Selected Stamp
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mouseX = (e.clientX - rect.left) * scaleX
    const mouseY = (e.clientY - rect.top) * scaleY

    // Check from top-most placed stamp downwards
    for (let i = placedStamps.length - 1; i >= 0; i--) {
      const s = placedStamps[i]
      if (mouseX >= s.x && mouseX <= s.x + s.width && mouseY >= s.y && mouseY <= s.y + s.height) {
        setSelectedStampId(s.id)
        setIsDragging(true)
        setDragOffset({ x: mouseX - s.x, y: mouseY - s.y })
        return
      }
    }
  }

  const handleMouseMove = (e) => {
    if (!isDragging || !selectedStampId) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mouseX = (e.clientX - rect.left) * scaleX
    const mouseY = (e.clientY - rect.top) * scaleY

    setPlacedStamps(prev => prev.map(s => {
      if (s.id !== selectedStampId) return s
      const newX = Math.max(0, Math.min(canvas.width - s.width, mouseX - dragOffset.x))
      const newY = Math.max(0, Math.min(canvas.height - s.height, mouseY - dragOffset.y))
      return { ...s, x: newX, y: newY }
    }))
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Delete specific placed stamp instance
  const handleDeleteStampInstance = (id) => {
    setPlacedStamps(prev => prev.filter(s => s.id !== id))
    if (selectedStampId === id) setSelectedStampId(null)
    toast.success('Stamp removed from document')
  }

  // Build a signed PDF using jsPDF — one PDF page per original PDF page
  const buildSignedPdf = async (canvas) => {
    const layouts = pageLayoutsRef.current
    // Lazy-load jsPDF from the bundle
    const { default: jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
    const A4_W = pdf.internal.pageSize.getWidth()
    const A4_H = pdf.internal.pageSize.getHeight()

    for (let i = 0; i < layouts.length; i++) {
      const { yStart, height, width } = layouts[i]

      // Slice this page out of the combined signed canvas
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = height
      pageCanvas.getContext('2d').drawImage(
        canvas,
        0, yStart, canvas.width, height,   // source rect
        0, 0, canvas.width, height          // dest rect
      )

      if (i > 0) pdf.addPage('a4', 'portrait')

      // Fit page proportionally inside A4
      const srcAspect = width / height
      const a4Aspect = A4_W / A4_H
      let drawW = A4_W, drawH = A4_H, drawX = 0, drawY = 0
      if (srcAspect > a4Aspect) {
        drawH = A4_W / srcAspect
        drawY = (A4_H - drawH) / 2
      } else {
        drawW = A4_H * srcAspect
        drawX = (A4_W - drawW) / 2
      }

      pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', drawX, drawY, drawW, drawH)
    }
    return pdf
  }

  // Save Finalized Signed Document
  const handleFinalize = async () => {
    if (placedStamps.length === 0) {
      return toast.error('Please place at least one signature or seal on the document before finalizing')
    }

    setLoading(true)
    try {
      // Re-draw clean canvas without selection borders
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(docImage, 0, 0, canvas.width, canvas.height)

      placedStamps.forEach(s => {
        if (!s.imgObj) return
        ctx.save()
        ctx.globalAlpha = s.opacity ?? 1
        ctx.drawImage(s.imgObj, s.x, s.y, s.width, s.height)
        ctx.restore()
      })

      let signedFile
      const layouts = pageLayoutsRef.current

      if (isPdfDocRef.current && layouts.length > 0) {
        // ── PDF original → output as proper multi-page PDF ──────────────────
        const pdf = await buildSignedPdf(canvas)
        const pdfBlob = pdf.output('blob')
        signedFile = new File([pdfBlob], `Signed_${request.requestRef}.pdf`, { type: 'application/pdf' })
      } else {
        // ── Image original → output as PNG ──────────────────────────────────
        const dataUrl = canvas.toDataURL('image/png')
        const res = await fetch(dataUrl)
        const blob = await res.blob()
        signedFile = new File([blob], `Signed_${request.requestRef}.png`, { type: 'image/png' })
      }

      const stampsMetaData = placedStamps.map(s => ({
        id: s.id,
        title: s.title,
        type: s.type,
        x: Math.round(s.x),
        y: Math.round(s.y),
        width: Math.round(s.width),
        height: Math.round(s.height),
        opacity: s.opacity
      }))

      const formData = new FormData()
      formData.append('file', signedFile)
      formData.append('stampsMeta', JSON.stringify(stampsMetaData))

      await api.put(`/signature-requests/${request._id}/sign`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      toast.success('Document signed & sealed successfully!')
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to finalize signature')
    } finally {
      setLoading(false)
    }
  }

  // Local PDF preview download (without uploading to server)
  const handleLocalPdfDownload = async () => {
    const canvas = canvasRef.current
    if (!canvas || !docImage) return toast.error('No document loaded')
    try {
      // Redraw with stamps
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(docImage, 0, 0, canvas.width, canvas.height)
      placedStamps.forEach(s => {
        if (!s.imgObj) return
        ctx.save(); ctx.globalAlpha = s.opacity ?? 1
        ctx.drawImage(s.imgObj, s.x, s.y, s.width, s.height)
        ctx.restore()
      })
      const layouts = pageLayoutsRef.current
      if (layouts.length > 0) {
        const pdf = await buildSignedPdf(canvas)
        pdf.save(`Preview_${request.requestRef}.pdf`)
      } else {
        const { default: jsPDF } = await import('jspdf')
        const pdf = new jsPDF({ unit: 'px', format: [canvas.width / 2, canvas.height / 2] })
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, canvas.width / 2, canvas.height / 2)
        pdf.save(`Preview_${request.requestRef}.pdf`)
      }
      toast.success('PDF preview downloaded!')
    } catch (err) {
      toast.error('Failed to generate PDF preview')
      console.error(err)
    }
  }

  const selectedStampObj = placedStamps.find(s => s.id === selectedStampId)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-6xl h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <FiLayers className="text-blue-600" /> Sign & Stamp Editor
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Ref: <span className="font-mono text-slate-700 font-bold">{request.requestRef}</span> | Requester: <span className="font-semibold text-slate-700">{request.employeeName} ({request.employeeType})</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const url = absoluteMediaUrl(request.originalDocUrl)
                if (url.startsWith('data:')) {
                  const win = window.open()
                  if (win) {
                    win.document.write(`<iframe src="${url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`)
                  }
                } else {
                  window.open(url, '_blank')
                }
              }}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all"
            >
              <FiFileText size={14} /> Open Original File
            </button>
            <label className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all border border-blue-200">
              <FiUpload size={14} /> Replace/Load File
              <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleCustomDocUpload} />
            </label>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-all">
              <FiX size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Canvas Preview Area */}
          <div
            ref={containerRef}
            className="flex-1 bg-slate-900 p-6 flex items-center justify-center overflow-auto custom-scrollbar select-none relative"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-slate-800/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-700 text-white shadow-xl">
              <span className="text-xs font-medium text-slate-300">Select/Load document:</span>
              <label className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-all shadow-sm">
                <FiUpload size={13} /> Load Local File
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleCustomDocUpload} />
              </label>
            </div>

            {docLoading ? (
              <div className="text-center text-white space-y-3">
                <span className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />
                <p className="text-sm font-semibold">Loading & rendering document page...</p>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                className="max-w-full max-h-full shadow-2xl rounded-lg cursor-crosshair bg-white border border-slate-700"
              />
            )}
          </div>

          {/* Right Editor Controls Sidebar */}
          <div className="w-84 border-l border-slate-200 bg-slate-50 p-5 flex flex-col justify-between overflow-y-auto space-y-5">
            <div className="space-y-5">
              {/* Saved Stamp Library Carousel */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FiBookmark className="text-blue-600" /> My Stamp Library (ක්ලික් කර එක් කරන්න)
                </h4>
                {loadingLibrary ? (
                  <p className="text-xs text-slate-400">Loading library...</p>
                ) : savedLibrary.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                    {savedLibrary.map((st) => {
                      const imgSrc = (st.imageUrl && (st.imageUrl.startsWith('data:') || st.imageUrl.startsWith('blob:')))
                        ? st.imageUrl
                        : mediaUrl(st.imageUrl)
                      return (
                        <button
                          key={st._id}
                          onClick={() => addStampInstance(st.title, st.type, st.imageUrl)}
                          className="p-2 border border-slate-200 hover:border-blue-500 bg-slate-50 hover:bg-blue-50 rounded-xl text-left transition-all flex flex-col items-center justify-center gap-1 group relative"
                          title="Click to place a copy of this stamp on document canvas"
                        >
                          {imgSrc ? (
                            <img src={imgSrc} alt={st.title} className="h-10 object-contain group-hover:scale-105 transition-transform" />
                          ) : (
                            <div className="h-10 w-full bg-slate-200 rounded flex items-center justify-center text-[10px] font-bold">Stamp</div>
                          )}
                          <span className="text-[10px] font-bold text-slate-800 truncate w-full text-center">{st.title}</span>
                          <span className="text-[9px] font-extrabold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">+ Place Copy</span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">No saved stamps. Upload or add below.</p>
                )}
              </div>

              {/* Add Signature & Seal Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <label className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md shadow-blue-600/20">
                  <FiPlus size={14} /> Add Signature
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCustomStampUpload(e, 'signature')} />
                </label>
                <label className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md shadow-emerald-600/20">
                  <FiPlus size={14} /> Add Seal
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCustomStampUpload(e, 'seal')} />
                </label>
              </div>

              {/* Placed Stamps List & Active Properties */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Placed Stamps ({placedStamps.length})
                  </h4>
                </div>

                {placedStamps.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {placedStamps.map((s, idx) => (
                      <div
                        key={s.id}
                        onClick={() => setSelectedStampId(s.id)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${s.id === selectedStampId ? 'border-blue-500 bg-blue-50/60 shadow-sm' : 'border-slate-200 bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500">#{idx + 1}</span>
                          <div>
                            <p className="text-xs font-bold text-slate-800 leading-tight">{s.title}</p>
                            <p className="text-[10px] text-slate-500 uppercase">{s.type}</p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteStampInstance(s.id)
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete Stamp"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Click Add Signature/Seal above to place stamps on document.</p>
                )}

                {/* Selected Stamp Adjustments */}
                {selectedStampObj && (
                  <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                    <p className="font-bold text-blue-700 text-[11px] uppercase">Selected: {selectedStampObj.title}</p>
                    <div className="flex justify-between items-center">
                      <span>Width / Size:</span>
                      <input
                        type="range" min="50" max="350"
                        value={selectedStampObj.width}
                        onChange={(e) => {
                          const w = Number(e.target.value)
                          const h = selectedStampObj.type === 'seal' ? w : Math.round(w / 2)
                          setPlacedStamps(prev => prev.map(st => st.id === selectedStampId ? { ...st, width: w, height: h } : st))
                        }}
                        className="w-28"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="text-[11px] text-slate-500 bg-slate-100 p-3 rounded-xl flex items-start gap-2">
                <FiMove size={14} className="text-slate-400 shrink-0 mt-0.5" />
                <span>Drag stamps anywhere on the document canvas. You can add multiple signatures and seals!</span>
              </div>
            </div>

            {/* Bottom Finalize Button */}
            <div className="pt-4 border-t border-slate-200 space-y-2">
              <button
                onClick={handleFinalize}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <FiCheck size={18} /> Apply Signature & Save to Server
                  </>
                )}
              </button>
              <button
                onClick={handleLocalPdfDownload}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
              >
                <FiDownload size={14} /> Download PDF Preview (Local)
              </button>
              <button
                onClick={onClose}
                className="w-full py-2 px-4 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all"
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
