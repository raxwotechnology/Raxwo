import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiX, FiCheck, FiUpload, FiFileText, FiFile,
  FiTrash2, FiBookmark, FiDownload, FiChevronLeft, FiChevronRight,
  FiZoomIn, FiZoomOut, FiEdit3, FiRefreshCw, FiMove
} from 'react-icons/fi'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { mediaUrl, absoluteMediaUrl } from '../../lib/media'

// ── PDF.js Lazy Loader ─────────────────────────────────────────────────────
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

// ── Script loader helper ───────────────────────────────────────────────────
async function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src; s.onload = resolve
    s.onerror = () => reject(new Error(`Failed to load: ${src}`))
    document.head.appendChild(s)
  })
}

// ── docx-preview Lazy Loader (requires JSZip) ─────────────────────────────
async function ensureDocxPreview() {
  if (!document.querySelector('#docx-preview-css')) {
    await new Promise((resolve) => {
      const link = document.createElement('link')
      link.id = 'docx-preview-css'; link.rel = 'stylesheet'
      link.href = 'https://cdn.jsdelivr.net/npm/docx-preview@0.1.22/dist/docx-preview.min.css'
      link.onload = resolve
      link.onerror = resolve
      document.head.appendChild(link)
    })
  }
  if (!window.JSZip) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js')
  if (!window.docx) await loadScript('https://cdn.jsdelivr.net/npm/docx-preview@0.1.22/dist/docx-preview.min.js')
  if (!window.docx) throw new Error('docx-preview did not initialize')
}

// ── mammoth.js Lazy Loader (bulletproof HTML fallback for DOCX) ──────────────
async function ensureMammoth() {
  if (window.mammoth) return
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js')
  if (!window.mammoth) throw new Error('mammoth did not initialize')
}

// ── Render PDF pages to HTMLImageElement array ─────────────────────────────
async function renderPdfToPageImages(source) {
  await ensurePdfJs()
  let loadingTask
  if (source instanceof ArrayBuffer) {
    loadingTask = window.pdfjsLib.getDocument({ data: source })
  } else {
    loadingTask = window.pdfjsLib.getDocument(source)
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

// ── Detect format from first bytes (magic bytes) — ignores MIME/extension ────
// DOCX/XLSX/ZIP: PK\x03\x04 → 0x50 0x4B 0x03 0x04
// PDF:           %PDF      → 0x25 0x50 0x44 0x46
function sniffFormat(buf) {
  if (!buf || buf.byteLength < 4) return 'image'
  const b = new Uint8Array(buf, 0, 4)
  if (b[0] === 0x50 && b[1] === 0x4B) return 'docx'   // ZIP-based (DOCX, XLSX)
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf'
  return 'image'
}

// ── Fetch ArrayBuffer — supports Data URIs, blob URIs, and server static files ──
async function fetchArrayBuffer(pathUrl) {
  if (!pathUrl) throw new Error('No path URL provided')
  if (pathUrl.startsWith('data:') || pathUrl.startsWith('blob:')) {
    const res = await fetch(pathUrl)
    return res.arrayBuffer()
  }

  const absUrl = absoluteMediaUrl(pathUrl)
  let buf = null

  // 1. Try direct fetch first (correct URL for static files)
  try {
    const res = await fetch(absUrl, { credentials: 'same-origin' })
    if (res.ok) buf = await res.arrayBuffer()
  } catch { /* ignore */ }

  // 2. Fallback: try through API axios if direct fetch failed
  if (!buf) {
    try {
      const res = await api.get(pathUrl, { responseType: 'arraybuffer' })
      const data = res.data
      if (data instanceof ArrayBuffer) buf = data
      else if (data?.buffer instanceof ArrayBuffer) buf = data.buffer
    } catch { /* ignore */ }
  }

  // 3. Validate buffer: must be > 100 bytes and NOT an HTML error page (starts with '<' -> 0x3C)
  if (buf && buf.byteLength > 100) {
    const u8 = new Uint8Array(buf)
    if (u8[0] !== 0x3C) {
      return buf
    }
  }

  throw new Error(`HTTP 404 — File not found on server: ${absUrl}`)
}

// ── Inject stamp images into DOCX via JSZip XML manipulation ─────────────
async function injectStampsIntoDocx(originalBuffer, stamps, containerWidth) {
  if (!window.JSZip) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js')
  const zip = await window.JSZip.loadAsync(originalBuffer)

  // EMU scale: A4 page (9144000 EMU wide) mapped to rendered container width
  const pageEMU = 9144000
  const scaleEMU = pageEMU / (containerWidth || 794)

  let contentTypesXml = await zip.file('[Content_Types].xml').async('string')
  let docXml = await zip.file('word/document.xml').async('string')
  let relsXml = ''
  const relsFile = zip.file('word/_rels/document.xml.rels')
  if (relsFile) relsXml = await relsFile.async('string')

  // Find max existing rId and docPr id
  const existingRIds = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map(m => parseInt(m[1]))
  let nextRId = existingRIds.length > 0 ? Math.max(...existingRIds) + 1 : 200
  const existingDrIds = [...docXml.matchAll(/wp:docPr id="(\d+)"/g)].map(m => parseInt(m[1]))
  let nextDocPrId = existingDrIds.length > 0 ? Math.max(...existingDrIds) + 1 : 2000

  const newRels = []
  const drawingParas = []

  for (let i = 0; i < stamps.length; i++) {
    const s = stamps[i]
    const rId = `rId${nextRId++}`
    const dpId = nextDocPrId++
    const ts = Date.now()

    let ext = 'png', mime = 'image/png'
    if (s.src.includes('image/jpeg') || s.src.includes('image/jpg')) { ext = 'jpeg'; mime = 'image/jpeg' }
    const base64 = s.src.includes(',') ? s.src.split(',')[1] : s.src
    const fname = `sig_${i}_${ts}.${ext}`
    zip.file(`word/media/${fname}`, base64, { base64: true })

    // Add to content types if not already there
    const extMatch = ext === 'jpeg' ? 'jpeg' : ext
    if (!contentTypesXml.includes(`Extension="${extMatch}"`)) {
      contentTypesXml = contentTypesXml.replace('</Types>',
        `<Default Extension="${extMatch}" ContentType="${mime}"/>\n</Types>`)
    }

    newRels.push(`<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${fname}"/>`)

    // Convert pixel coords to EMU
    const xEMU = Math.round(s.x * scaleEMU)
    const yEMU = Math.round(s.y * scaleEMU)
    const wEMU = Math.round(s.width * scaleEMU)
    const hEMU = Math.round(s.height * scaleEMU)

    drawingParas.push(`<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${50000 + i}" behindDoc="0" locked="0" layoutInCell="0" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>${xEMU}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>${yEMU}</wp:posOffset></wp:positionV><wp:extent cx="${wEMU}" cy="${hEMU}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${dpId}" name="Sig${i + 1}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${dpId + 1}" name="Sig${i + 1}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${wEMU}" cy="${hEMU}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>`)
  }

  // Inject before </w:body>
  docXml = docXml.replace('</w:body>', drawingParas.join('') + '</w:body>')
  relsXml = relsXml
    ? relsXml.replace('</Relationships>', newRels.join('\n') + '\n</Relationships>')
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n${newRels.join('\n')}\n</Relationships>`

  zip.file('[Content_Types].xml', contentTypesXml)
  zip.file('word/document.xml', docXml)
  zip.file('word/_rels/document.xml.rels', relsXml)

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  })
}

// ── Component ──────────────────────────────────────────────────────────────
export default function DocSignatureEditorModal({ request, onClose, onSuccess }) {
  // Refs
  const canvasRef        = useRef(null)
  const containerRef     = useRef(null)
  const docxContainerRef = useRef(null)
  const docxOverlayRef   = useRef(null)
  const isPdfRef         = useRef(false)
  const docxBufRef       = useRef(null)

  // Document state
  const [mode,         setMode]         = useState('loading')
  const [pageImages,   setPageImages]   = useState([])
  const [currentPage,  setCurrentPage]  = useState(0)
  const [zoom,         setZoom]         = useState(1)
  const [loading,      setLoading]      = useState(false)
  const [docxPageCount,setDocxPageCount]= useState(0)

  // Canvas stamps (PDF/image mode)
  const [placedStamps,    setPlacedStamps]    = useState([])
  const [selectedStampId, setSelectedStampId] = useState(null)
  const [isDragging,      setIsDragging]      = useState(false)
  const [dragOffset,      setDragOffset]      = useState({ x: 0, y: 0 })

  // DOCX overlay stamps
  const [docxStamps,   setDocxStamps]   = useState([])
  const [docxDragging, setDocxDragging] = useState(null)

  // Stamp library
  const [savedLibrary,   setSavedLibrary]   = useState([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)

  // ── Load stamp library ────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      setLoadingLibrary(true)
      try {
        const res = await api.get('/signature-requests/saved-stamps')
        if (res.data?.stamps) setSavedLibrary(res.data.stamps)
      } catch { /* silent */ } finally { setLoadingLibrary(false) }
    })()
  }, [])

  // ── Render DOCX (Dual Engine: docx-preview + Mammoth fallback) ───────────
  const renderDocxIntoContainer = useCallback(async (arrayBuf) => {
    if (!docxContainerRef.current) return
    const container = docxContainerRef.current
    container.innerHTML = ''
    let buf = arrayBuf
    if (buf instanceof ArrayBuffer === false && buf?.buffer) buf = buf.buffer

    let renderedOk = false

    // Engine 1: docx-preview
    try {
      await ensureDocxPreview()
      await window.docx.renderAsync(buf, container, null, {
        className: 'docx-page', inWrapper: true, ignoreWidth: false,
        ignoreHeight: false, ignoreFonts: false, breakPages: true,
        ignoreLastRenderedPageBreak: false, trimXmlDeclaration: true,
        renderHeaders: true, renderFooters: true, renderFootnotes: true,
        renderEndnotes: true, useBase64URL: true,
      })
      if (container.innerText && container.innerText.trim().length > 0) {
        renderedOk = true
      }
    } catch (e) {
      console.warn('docx-preview engine warning:', e)
      renderedOk = false
    }

    // Engine 2: Mammoth.js fallback (guarantees text + formatting display)
    if (!renderedOk) {
      try {
        await ensureMammoth()
        const res = await window.mammoth.convertToHtml({ arrayBuffer: buf })
        if (res?.value) {
          container.innerHTML = `<div class="docx-a4-page">${res.value}</div>`
          renderedOk = true
        }
      } catch (err) {
        console.warn('Mammoth fallback warning:', err)
      }
    }

    const pages = container.querySelectorAll('section[data-page-nr], .docx-page, .docx-a4-page, article')
    setDocxPageCount(Math.max(pages.length, 1))
  }, [])

  // ── Render DOCX whenever mode === 'docx' — waits for container to mount ──────
  useEffect(() => {
    if (mode !== 'docx' || !docxBufRef.current) return
    let cancelled = false
    // Poll until docxContainerRef is mounted (React paints after state change)
    const tryRender = async (attempts = 0) => {
      if (cancelled) return
      if (docxContainerRef.current) {
        await renderDocxIntoContainer(docxBufRef.current)
      } else if (attempts < 20) {
        // Retry up to 20 times × 50ms = 1 second max
        setTimeout(() => tryRender(attempts + 1), 50)
      }
    }
    // Small initial delay to let React commit the DOM
    setTimeout(() => tryRender(), 0)
    return () => { cancelled = true }
  }, [mode, renderDocxIntoContainer])

  // ── Draw canvas ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || pageImages.length === 0) return
    const img = pageImages[currentPage]
    if (!img) return
    const W = img.naturalWidth || img.width || 1240
    const H = img.naturalHeight || img.height || 1754
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(img, 0, 0, W, H)
    placedStamps.filter(s => s.page === currentPage).forEach(s => {
      if (!s.imgObj) return
      ctx.save()
      ctx.globalAlpha = s.opacity ?? 1
      if (s.id === selectedStampId) {
        ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 3; ctx.setLineDash([6, 3])
        ctx.strokeRect(s.x - 2, s.y - 2, s.width + 4, s.height + 4)
        ctx.setLineDash([])
      }
      ctx.drawImage(s.imgObj, s.x, s.y, s.width, s.height)
      ctx.restore()
    })
  }, [pageImages, currentPage, placedStamps, selectedStampId])

  // ── Load document on mount — uses MAGIC BYTES to detect format ──────────
  useEffect(() => {
    if (!request?.originalDocUrl) { setMode('empty'); return }
    setMode('loading')
    ;(async () => {
      try {
        const pathUrl = request.originalDocUrl
        const lower = (pathUrl || '').toLowerCase()

        // URL-hint: if we can tell from the URL, skip fetching for images
        const urlHintImage = !lower.includes('wordprocessingml') && !lower.includes('msword') &&
          !lower.includes('.doc') && !lower.includes('application/pdf') && !lower.includes('.pdf') &&
          (lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.png') ||
           lower.includes('.webp') || lower.includes('image/'))

        if (urlHintImage) {
          // Pure image URL — load directly without fetching full buffer
          const absUrl = pathUrl.startsWith('data:') || pathUrl.startsWith('blob:')
            ? pathUrl : absoluteMediaUrl(pathUrl)
          const img = new Image(); img.crossOrigin = 'anonymous'
          await new Promise((res, rej) => {
            img.onload = res
            img.onerror = () => rej(new Error('Failed to load image file'))
            img.src = absUrl
          })
          isPdfRef.current = false
          setPageImages([img]); setCurrentPage(0); setMode('image')
          return
        }

        // For all other URLs: fetch as ArrayBuffer and detect via MAGIC BYTES
        const buf = await fetchArrayBuffer(pathUrl)
        const fmt = sniffFormat(buf)
        console.info('[DocModal] Detected format:', fmt, '| URL hint:', lower.substring(0, 80))

        if (fmt === 'docx') {
          docxBufRef.current = buf
          isPdfRef.current = false
          setMode('docx')
          // renderDocxIntoContainer triggered by useEffect polling loop
        } else if (fmt === 'pdf') {
          isPdfRef.current = true
          docxBufRef.current = null
          const imgs = await renderPdfToPageImages(buf)
          setPageImages(imgs); setCurrentPage(0); setMode('pdf')
        } else {
          // Treat binary as image (PNG/JPG blob)
          isPdfRef.current = false
          const blob = new Blob([buf])
          const objectUrl = URL.createObjectURL(blob)
          const img = new Image(); img.crossOrigin = 'anonymous'
          await new Promise((res, rej) => {
            img.onload = res
            img.onerror = () => rej(new Error('Binary is not a recognisable image'))
            img.src = objectUrl
          })
          setPageImages([img]); setCurrentPage(0); setMode('image')
        }
      } catch (err) {
        console.warn('Doc load failed:', err?.message || err)
        setMode('error')
      }
    })()
  }, [request?.originalDocUrl, renderDocxIntoContainer])

  // ── File upload handler ───────────────────────────────────────────────
  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const lower = file.name.toLowerCase()
    setDocxStamps([]); setPlacedStamps([]); setSelectedStampId(null)
    setMode('loading')
    try {
      const buf = await file.arrayBuffer()
      // Use magic bytes so wrong extension / MIME never misleads
      const fmt = sniffFormat(buf)
      if (fmt === 'docx') {
        docxBufRef.current = buf
        isPdfRef.current = false
        setMode('docx')
        // renderDocxIntoContainer will be triggered by useEffect once container mounts
      } else if (fmt === 'pdf') {
        docxBufRef.current = null
        isPdfRef.current = true
        const imgs = await renderPdfToPageImages(buf)
        setPageImages(imgs); setCurrentPage(0); setMode('pdf')
      } else {
        const img = new Image()
        await new Promise((res, rej) => {
          img.onload = res; img.onerror = rej
          img.src = URL.createObjectURL(file)
        })
        docxBufRef.current = null; isPdfRef.current = false
        setPageImages([img]); setCurrentPage(0); setMode('image')
      }
    } catch (err) { console.error(err); toast.error('Failed to load file'); setMode('error') }
    e.target.value = ''
  }, [renderDocxIntoContainer])

  // ── DOCX overlay stamp handlers ───────────────────────────────────────
  const addDocxStamp = useCallback((title, type, srcUrl) => {
    if (!srcUrl) return
    const imgObj = new Image(); imgObj.crossOrigin = 'anonymous'
    imgObj.onload = () => {
      const isSeal = type === 'seal'
      const stamp = {
        id: `ds_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
        title: title || (isSeal ? 'Company Seal' : 'Signature'),
        type: isSeal ? 'seal' : 'signature',
        imgObj, src: srcUrl,
        x: 120, y: 320,
        width: isSeal ? 110 : 200,
        height: isSeal ? 110 : 80,
        opacity: 1,
      }
      setDocxStamps(prev => [...prev, stamp])
      setSelectedStampId(stamp.id)
      toast.success(`${stamp.title} added — drag to position`)
    }
    imgObj.src = srcUrl.startsWith('data:') ? srcUrl : mediaUrl(srcUrl)
  }, [])

  const handleDocxStampMouseDown = (e, stampId) => {
    e.stopPropagation(); e.preventDefault()
    const stamp = docxStamps.find(s => s.id === stampId)
    if (!stamp) return
    setSelectedStampId(stampId)
    setDocxDragging({ id: stampId, startX: e.clientX, startY: e.clientY, origX: stamp.x, origY: stamp.y })
  }
  const handleDocxMouseMove = (e) => {
    if (!docxDragging) return
    setDocxStamps(prev => prev.map(s => s.id !== docxDragging.id ? s : {
      ...s,
      x: docxDragging.origX + (e.clientX - docxDragging.startX),
      y: docxDragging.origY + (e.clientY - docxDragging.startY),
    }))
  }
  const handleDocxMouseUp = () => setDocxDragging(null)
  const handleDeleteDocxStamp = (id) => {
    setDocxStamps(prev => prev.filter(s => s.id !== id))
    if (selectedStampId === id) setSelectedStampId(null)
  }

  // ── Canvas stamp handlers ─────────────────────────────────────────────
  const addStampInstance = useCallback((title, type, srcUrl) => {
    if (!srcUrl) return
    const imgObj = new Image(); imgObj.crossOrigin = 'anonymous'
    imgObj.onload = () => {
      const canvas = canvasRef.current
      const W = canvas?.width || 1240; const H = canvas?.height || 1754
      const isSeal = type === 'seal'
      const w = isSeal ? 160 : 300; const h = isSeal ? 160 : 110
      const stamp = {
        id: `cs_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
        title: title || (isSeal ? 'Company Seal' : 'Signature'),
        type: isSeal ? 'seal' : 'signature',
        imgObj, src: srcUrl,
        page: currentPage,
        x: Math.round((W - w) / 2), y: Math.round((H - h) * 0.7),
        width: w, height: h, opacity: 1,
      }
      setPlacedStamps(prev => [...prev, stamp])
      setSelectedStampId(stamp.id)
      toast.success(`${stamp.title} added — drag to position`)
    }
    imgObj.src = srcUrl.startsWith('data:') ? srcUrl : mediaUrl(srcUrl)
  }, [currentPage])

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height
    const mx = (e.clientX - rect.left) * scaleX; const my = (e.clientY - rect.top) * scaleY
    const hit = [...placedStamps].reverse().find(s =>
      s.page === currentPage &&
      mx >= s.x && mx <= s.x + s.width && my >= s.y && my <= s.y + s.height
    )
    if (hit) {
      setSelectedStampId(hit.id)
      setIsDragging(true)
      setDragOffset({ x: mx - hit.x, y: my - hit.y })
    } else {
      setSelectedStampId(null)
    }
  }
  const handleMouseMove = (e) => {
    if (!isDragging || !selectedStampId) return
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height
    const mx = (e.clientX - rect.left) * scaleX; const my = (e.clientY - rect.top) * scaleY
    setPlacedStamps(prev => prev.map(s => s.id !== selectedStampId ? s : {
      ...s, x: mx - dragOffset.x, y: my - dragOffset.y
    }))
  }
  const handleMouseUp = () => setIsDragging(false)

  // ── Build signed PDF from canvas (PDF/image mode) ─────────────────────
  const buildSignedPdf = async () => {
    const { default: jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ unit: 'px', format: 'a4', hotfixes: ['px_scaling'] })
    const A4W = pdf.internal.pageSize.getWidth()
    const A4H = pdf.internal.pageSize.getHeight()
    for (let i = 0; i < pageImages.length; i++) {
      if (i > 0) pdf.addPage()
      const img = pageImages[i]
      const W = img.naturalWidth || img.width || 1240
      const H = img.naturalHeight || img.height || 1754
      const tmpCanvas = document.createElement('canvas')
      tmpCanvas.width = W; tmpCanvas.height = H
      const ctx = tmpCanvas.getContext('2d')
      ctx.drawImage(img, 0, 0, W, H)
      placedStamps.filter(s => s.page === i).forEach(s => {
        if (!s.imgObj) return
        ctx.save(); ctx.globalAlpha = s.opacity ?? 1
        ctx.drawImage(s.imgObj, s.x, s.y, s.width, s.height)
        ctx.restore()
      })
      const imgData = tmpCanvas.toDataURL('image/jpeg', 0.92)
      const ratio = Math.min(A4W / W, A4H / H)
      const dw = W * ratio; const dh = H * ratio
      pdf.addImage(imgData, 'JPEG', (A4W - dw) / 2, (A4H - dh) / 2, dw, dh)
    }
    return pdf
  }

  // ── Build signed DOCX (inject stamps via JSZip) ───────────────────────
  const buildSignedDocx = async () => {
    if (!docxBufRef.current) throw new Error('No DOCX buffer')
    const containerWidth = docxContainerRef.current?.offsetWidth || 794
    return injectStampsIntoDocx(docxBufRef.current, docxStamps, containerWidth)
  }

  // ── Download original ─────────────────────────────────────────────────
  const handleDownloadOriginal = () => {
    if (!request?.originalDocUrl) return
    const url = absoluteMediaUrl(request.originalDocUrl)
    window.open(url, '_blank')
  }

  // ── Download with stamps ──────────────────────────────────────────────
  const handleDownload = async () => {
    try {
      if (mode === 'docx') {
        if (docxStamps.length === 0) {
          // Download original DOCX
          const buf = docxBufRef.current
          if (!buf) return handleDownloadOriginal()
          const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob)
          a.download = `${request.requestRef || 'document'}.docx`
          document.body.appendChild(a); a.click(); document.body.removeChild(a)
          URL.revokeObjectURL(a.href)
          return
        }
        toast.loading('Generating DOCX…', { id: 'dl' })
        const blob = await buildSignedDocx()
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `Signed_${request.requestRef || 'document'}.docx`
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
        URL.revokeObjectURL(a.href)
        toast.success('DOCX downloaded!', { id: 'dl' })
      } else {
        if (pageImages.length === 0) return
        toast.loading('Generating PDF…', { id: 'dl' })
        const pdf = await buildSignedPdf()
        pdf.save(`${placedStamps.length > 0 ? 'Signed_' : ''}${request.requestRef || 'document'}.pdf`)
        toast.success('PDF downloaded!', { id: 'dl' })
      }
    } catch (e) { console.error(e); toast.error('Download failed', { id: 'dl' }) }
  }

  // ── Finalize & upload to server ───────────────────────────────────────
  const handleFinalize = async () => {
    if (mode === 'docx' && docxStamps.length === 0)
      return toast.error('Place at least one signature or seal before finalizing')
    if ((mode === 'pdf' || mode === 'image') && placedStamps.length === 0)
      return toast.error('Place at least one signature or seal before finalizing')

    setLoading(true)
    try {
      let signedFile
      if (mode === 'docx') {
        const blob = await buildSignedDocx()
        signedFile = new File([blob], `Signed_${request.requestRef}.docx`, {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        })
      } else if (isPdfRef.current && pageImages.length > 0) {
        const pdf = await buildSignedPdf()
        signedFile = new File([pdf.output('blob')], `Signed_${request.requestRef}.pdf`, { type: 'application/pdf' })
      } else {
        const canvas = canvasRef.current
        const blob = await (await fetch(canvas.toDataURL('image/png'))).blob()
        signedFile = new File([blob], `Signed_${request.requestRef}.png`, { type: 'image/png' })
      }

      const fd = new FormData()
      fd.append('signedDoc', signedFile)
      const stamps = mode === 'docx' ? docxStamps : placedStamps
      fd.append('stampsMeta', JSON.stringify(stamps.map(s => ({
        id: s.id, title: s.title, type: s.type, page: s.page ?? 0,
        x: Math.round(s.x), y: Math.round(s.y),
        width: Math.round(s.width), height: Math.round(s.height), opacity: s.opacity
      }))))

      await api.post(`/signature-requests/${request._id}/submit-signed`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      toast.success('Document signed & saved!')
      onSuccess?.()
      onClose?.()
    } catch (err) {
      console.error(err)
      toast.error(err?.response?.data?.message || 'Failed to save signed document')
    } finally { setLoading(false) }
  }

  // Derived
  const isDocxMode   = mode === 'docx'
  const isSignMode   = mode === 'pdf' || mode === 'image'
  const canFinalize  = (isDocxMode && docxStamps.length > 0) || (isSignMode && placedStamps.length > 0)
  const totalPages   = pageImages.length
  const activeStamps = isDocxMode ? docxStamps : placedStamps.filter(s => s.page === currentPage)
  const selectedStamp = isDocxMode
    ? docxStamps.find(s => s.id === selectedStampId)
    : placedStamps.find(s => s.id === selectedStampId)

  // ── Stamp picker helper ───────────────────────────────────────────────
  const pickAndAddStamp = (title, type) => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'
    input.onchange = (e) => {
      const file = e.target.files?.[0]; if (!file) return
      const reader = new FileReader()
      reader.onload = ev => {
        if (isDocxMode) return addDocxStamp(title, type, ev.target.result)
        if (isSignMode) return addStampInstance(title, type, ev.target.result)
        toast.error('Load a document first')
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  // ────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────
  return createPortal(
    <AnimatePresence>
      <motion.div
        key="doc-sign-modal-backdrop"
        className="fixed inset-0 flex items-center justify-center p-2 sm:p-4"
        style={{ zIndex: 2147483647, background: 'rgba(2,6,23,0.96)', backdropFilter: 'blur(12px)' }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <motion.div
          key="doc-sign-modal-panel"
          className="flex flex-col w-full bg-white rounded-2xl overflow-hidden shadow-2xl relative"
          style={{ maxWidth: '1280px', height: '94vh', zIndex: 2147483647 }}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 28, stiffness: 380 }}
        >
          {/* ─── HEADER ─────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 flex-shrink-0 relative z-[10]">
            {/* Icon + Title */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                <FiEdit3 size={15} className="text-blue-400" />
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-none">Sign &amp; Stamp Editor</p>
                <p className="text-slate-400 text-[10px] mt-0.5">{request?.requestRef} · {request?.employeeName || request?.employee?.name}</p>
              </div>
            </div>

            {/* Mode badge */}
            <div className={`ml-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
              isDocxMode   ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' :
              mode === 'pdf' ? 'bg-red-500/15 text-red-300 border-red-500/30' :
              mode === 'image' ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' :
              'bg-slate-700/50 text-slate-400 border-slate-600'
            }`}>
              {isDocxMode ? '📄 WORD DOC' : mode === 'pdf' ? '📑 PDF' : mode === 'image' ? '🖼 IMAGE' : mode.toUpperCase()}
            </div>

            <div className="flex-1" />

            {/* Header actions */}
            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-semibold rounded-xl cursor-pointer transition-all border border-slate-600">
              <FiRefreshCw size={11} /> Load File
              <input type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={handleFileUpload} />
            </label>
            {isDocxMode && (
              <p className="text-slate-400 text-[10px] px-2 hidden sm:block">
                Word preview — scroll to read all pages
              </p>
            )}
            {isSignMode && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}
                  className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white flex items-center justify-center transition-all">
                  <FiChevronLeft size={13} />
                </button>
                <span className="text-slate-300 text-[11px] font-semibold px-2">
                  {currentPage + 1} / {totalPages}
                </span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage === totalPages - 1}
                  className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white flex items-center justify-center transition-all">
                  <FiChevronRight size={13} />
                </button>
              </div>
            )}
            {isSignMode && (
              <div className="flex items-center gap-1">
                <button onClick={() => setZoom(z => Math.max(0.3, +(z - 0.1).toFixed(1)))}
                  className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition-all">
                  <FiZoomOut size={12} />
                </button>
                <span className="text-slate-400 text-[10px] w-8 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(1)))}
                  className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition-all">
                  <FiZoomIn size={12} />
                </button>
              </div>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white flex items-center justify-center transition-all ml-1">
              <FiX size={16} />
            </button>
          </div>

          {/* ─── MAIN AREA ──────────────────────────────────────────── */}
          <div className="flex flex-1 overflow-hidden">

            {/* ── Document Viewport ──────────────────────────────────── */}
            <div className="flex-1 overflow-auto custom-scrollbar" style={{ background: '#1e293b' }} ref={containerRef}>

              {/* Loading */}
              {mode === 'loading' && (
                <div className="flex flex-col items-center justify-center gap-4 h-full text-white">
                  <span className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-semibold">Loading document…</p>
                </div>
              )}

              {/* Error */}
              {mode === 'error' && (
                <div className="flex flex-col items-center justify-center gap-4 h-full p-8 text-white">
                  <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center">
                    <FiFileText size={32} />
                  </div>
                  <h3 className="text-lg font-bold">Could Not Load Document</h3>
                  <p className="text-sm text-slate-400 text-center max-w-sm">
                    The file could not be found or failed to render. Load a local file using the button above.
                  </p>
                  <label className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl cursor-pointer flex items-center gap-2">
                    <FiUpload size={14} /> Load Local File
                    <input type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              )}

              {/* Empty */}
              {mode === 'empty' && (
                <div className="flex flex-col items-center justify-center gap-4 h-full p-8 text-white">
                  <div className="w-16 h-16 rounded-2xl bg-slate-700 text-slate-400 flex items-center justify-center">
                    <FiFile size={32} />
                  </div>
                  <h3 className="text-lg font-bold">No Document</h3>
                  <label className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl cursor-pointer flex items-center gap-2">
                    <FiUpload size={14} /> Load File
                    <input type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              )}

              {/* ── DOCX preview with drag-drop overlay ── */}
              {isDocxMode && (
                <div className="flex flex-col items-center py-6 px-4 min-h-full">
                  {/* DOCX info ribbon */}
                  <div className="w-full max-w-4xl mb-4 flex items-center gap-3 bg-blue-900/30 border border-blue-700/40 rounded-xl px-4 py-2.5">
                    <span className="flex-1 text-blue-300 text-xs font-semibold flex items-center gap-2">
                      <FiMove size={13} /> Click a signature/seal → appears on document → drag to exact position
                    </span>
                    {docxStamps.length > 0 && (
                      <span className="bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg">
                        {docxStamps.length} stamp{docxStamps.length > 1 ? 's' : ''} placed
                      </span>
                    )}
                  </div>

                  {/* Document + overlay wrapper */}
                  <div
                    className="w-full max-w-4xl relative"
                    style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', minHeight: '80vh' }}
                    onMouseMove={handleDocxMouseMove}
                    onMouseUp={handleDocxMouseUp}
                    onMouseLeave={handleDocxMouseUp}
                  >
                    {/* docx-preview + mammoth fallback styling */}
                    <style>{`
                      .docx-render-container { color: #0f172a !important; text-align: left; width: 100%; min-height: 80vh; }
                      .docx-render-container p, .docx-render-container span, .docx-render-container td, .docx-render-container th,
                      .docx-render-container h1, .docx-render-container h2, .docx-render-container h3, .docx-render-container h4 {
                        color: #0f172a !important;
                      }
                      .docx-wrapper { background: transparent !important; padding: 15px !important; }
                      .docx-wrapper > section.docx-page {
                        background: #ffffff !important;
                        color: #0f172a !important;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.12) !important;
                        margin: 0 auto 20px auto !important;
                        padding: 40px !important;
                        border-radius: 8px !important;
                      }
                      .docx-a4-page {
                        background: #ffffff !important;
                        color: #0f172a !important;
                        padding: 48px 56px !important;
                        min-height: 800px !important;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.15) !important;
                        border-radius: 8px !important;
                        font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
                        font-size: 14px !important;
                        line-height: 1.6 !important;
                        text-align: left !important;
                      }
                      .docx-a4-page p { margin-bottom: 12px !important; color: #0f172a !important; }
                      .docx-a4-page h1, .docx-a4-page h2, .docx-a4-page h3 { font-weight: 700 !important; color: #0f172a !important; margin-top: 16px !important; margin-bottom: 8px !important; }
                      .docx-a4-page table { width: 100% !important; border-collapse: collapse !important; margin: 16px 0 !important; }
                      .docx-a4-page th, .docx-a4-page td { border: 1px solid #cbd5e1 !important; padding: 8px 12px !important; color: #0f172a !important; }
                      .docx-a4-page img { max-width: 100% !important; height: auto !important; }
                    `}</style>
                    <div ref={docxContainerRef} className="docx-render-container" />

                    {/* Draggable stamp overlay */}
                    <div ref={docxOverlayRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
                      {docxStamps.map(s => (
                        <div
                          key={s.id}
                          style={{
                            position: 'absolute', left: s.x, top: s.y,
                            width: s.width, height: s.height, opacity: s.opacity,
                            cursor: docxDragging?.id === s.id ? 'grabbing' : 'grab',
                            pointerEvents: 'auto',
                            outline: s.id === selectedStampId ? '2.5px dashed #3b82f6' : '2px dashed transparent',
                            outlineOffset: '2px', borderRadius: 4, userSelect: 'none',
                            filter: s.id === selectedStampId ? 'drop-shadow(0 0 6px rgba(59,130,246,0.6))' : 'none',
                            transition: 'outline 0.15s, filter 0.15s',
                          }}
                          onMouseDown={e => handleDocxStampMouseDown(e, s.id)}
                          onClick={() => setSelectedStampId(s.id)}
                        >
                          <img src={s.src} alt={s.title}
                            style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', display: 'block' }}
                          />
                          {s.id === selectedStampId && (
                            <button
                              onMouseDown={e => e.stopPropagation()}
                              onClick={e => { e.stopPropagation(); handleDeleteDocxStamp(s.id) }}
                              style={{
                                position: 'absolute', top: -12, right: -12,
                                background: '#ef4444', color: '#fff', border: '2px solid #fff',
                                borderRadius: '50%', width: 22, height: 22,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', fontSize: 13, fontWeight: 'bold', zIndex: 20,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                              }}
                            >×</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── PDF / Image canvas ── */}
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
            </div>

            {/* ─── RIGHT SIDEBAR ─────────────────────────────────────── */}
            <div className="w-72 border-l border-slate-200 bg-slate-50 flex flex-col overflow-hidden flex-shrink-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

                {/* Format indicator */}
                <div className={`rounded-2xl p-3 border text-center ${
                  isDocxMode ? 'bg-blue-50 border-blue-200' :
                  mode === 'pdf' ? 'bg-red-50 border-red-200' :
                  mode === 'image' ? 'bg-purple-50 border-purple-200' :
                  'bg-slate-100 border-slate-200'
                }`}>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Format</p>
                  <p className="font-bold text-slate-800 text-xs">
                    {isDocxMode ? 'Microsoft Word (.docx)' : mode === 'pdf' ? 'PDF Document (.pdf)' : mode === 'image' ? 'Image File' : 'Unknown'}
                  </p>
                </div>

                {/* Stamp Library Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <FiBookmark className="text-blue-600" /> Saved Stamps
                    </p>
                    <span className="text-[10px] text-slate-400 font-semibold">{savedLibrary.length} item(s)</span>
                  </div>

                  {savedLibrary.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {savedLibrary.map(st => {
                        const src = (st.imageUrl && (st.imageUrl.startsWith('data:') || st.imageUrl.startsWith('blob:')))
                          ? st.imageUrl
                          : mediaUrl(st.imageUrl)
                        return (
                          <button
                            key={st._id}
                            type="button"
                            onClick={() => {
                              if (isDocxMode) addDocxStamp(st.title, st.type, src)
                              else if (isSignMode) addStampInstance(st.title, st.type, src)
                              else toast.error('Load a document first')
                            }}
                            className="p-2 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl transition-all flex flex-col items-center text-center group shadow-2xs"
                          >
                            <div className="w-12 h-12 bg-slate-50 rounded-lg p-1 border border-slate-100 flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
                              <img src={src} alt={st.title} className="max-h-full object-contain" />
                            </div>
                            <span className="text-[11px] font-bold text-slate-800 truncate w-full">{st.title}</span>
                            <span className="text-[9px] uppercase font-semibold text-slate-400">{st.type}</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-2">No stamps saved in library</p>
                  )}

                  {/* Add Stamp Buttons */}
                  <div className="pt-2 space-y-2 border-t border-slate-200">
                    <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Quick Upload Stamp</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => pickAndAddStamp('Signature', 'signature')}
                        className="py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1 shadow-2xs transition-all"
                      >
                        ✒️ Signature
                      </button>
                      <button
                        type="button"
                        onClick={() => pickAndAddStamp('Company Seal', 'seal')}
                        className="py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1 shadow-2xs transition-all"
                      >
                        🏵️ Seal
                      </button>
                    </div>
                  </div>
                </div>

                {/* Placed Stamps List */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <FiLayers className="text-blue-600" /> Placed Stamps ({activeStamps.length})
                  </p>
                  {activeStamps.length > 0 ? (
                    <div className="space-y-1.5">
                      {activeStamps.map(st => (
                        <div
                          key={st.id}
                          onClick={() => setSelectedStampId(st.id)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer text-xs transition-all ${
                            selectedStampId === st.id ? 'bg-blue-50 border-blue-300 font-bold text-blue-900' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="truncate">{st.title || st.type}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (isDocxMode) handleDeleteDocxStamp(st.id)
                              else handleDeletePlacedStamp(st.id)
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 rounded-lg"
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-2">Click a stamp to place on document</p>
                  )}
                </div>

                {/* Selected Stamp Adjustments */}
                {selectedStamp && (
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2.5">
                    <p className="text-xs font-bold text-blue-900">Selected Stamp Controls</p>
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Width</span>
                        <span>{selectedStamp.width}px</span>
                      </div>
                      <input
                        type="range" min={30} max={400}
                        value={selectedStamp.width}
                        onChange={(e) => {
                          const w = Number(e.target.value)
                          const ratio = selectedStamp.height / selectedStamp.width
                          const h = Math.round(w * ratio)
                          if (isDocxMode) {
                            setDocxStamps(prev => prev.map(s => s.id === selectedStamp.id ? { ...s, width: w, height: h } : s))
                          } else {
                            setPlacedStamps(prev => prev.map(s => s.id === selectedStamp.id ? { ...s, width: w, height: h } : s))
                          }
                        }}
                        className="w-full accent-blue-600"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-200 space-y-2.5 flex-shrink-0 bg-white">
                <button
                  onClick={handleFinalize}
                  disabled={loading || !canFinalize}
                  className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-40 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all text-sm active:scale-95"
                >
                  {loading
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <FiCheck size={16} />}
                  Apply &amp; Save to Server
                </button>
                <button
                  onClick={handleDownload}
                  disabled={loading || (mode !== 'docx' && mode !== 'pdf' && mode !== 'image')}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
                >
                  <FiDownload size={14} />
                  {isDocxMode ? 'Download as .docx' : 'Download as .pdf'}
                </button>
                <button
                  onClick={handleDownloadOriginal}
                  className="w-full py-2 text-[11px] text-slate-500 hover:text-slate-700 font-semibold transition-colors"
                >
                  Download Original File
                </button>
                <button onClick={onClose} className="w-full py-2 text-[11px] text-slate-400 hover:text-slate-600 font-semibold transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}

// ── Missing FiLayers import shim ───────────────────────────────────────────
function FiLayers({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}
