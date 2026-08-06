import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiX, FiCheck, FiUpload, FiMove, FiMaximize2, FiRotateCcw, FiLayers, FiAlertCircle } from 'react-icons/fi'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { mediaUrl } from '../../lib/media'

export default function DocSignatureEditorModal({ request, onClose, onSuccess, defaultSignature, defaultSeal }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  const [loading, setLoading] = useState(false)
  const [docImage, setDocImage] = useState(null)
  const [signatureImage, setSignatureImage] = useState(null)
  const [sealImage, setSealImage] = useState(null)

  // Stamps position state on canvas
  const [stamps, setStamps] = useState({
    signature: { active: false, x: 100, y: 300, width: 160, height: 80, opacity: 1 },
    seal: { active: false, x: 300, y: 300, width: 120, height: 120, opacity: 0.95 },
  })

  const [selectedStamp, setSelectedStamp] = useState('signature')
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // Custom signature/seal file upload on the fly
  const handleCustomStampUpload = async (e, type) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (type === 'signature') {
          setSignatureImage(img)
          setStamps(prev => ({ ...prev, signature: { ...prev.signature, active: true } }))
        } else {
          setSealImage(img)
          setStamps(prev => ({ ...prev, seal: { ...prev.seal, active: true } }))
        }
        toast.success(`${type === 'signature' ? 'Signature' : 'Seal'} loaded!`)
      }
      img.src = evt.target.result
    }
    reader.readAsDataURL(file)
  }

  // Load Document Image & Default Stamps
  useEffect(() => {
    if (!request?.originalDocUrl) return

    const dImg = new Image()
    dImg.crossOrigin = 'anonymous'
    dImg.onload = () => setDocImage(dImg)
    dImg.onerror = () => {
      // Fallback for non-image or preview failure
      const fallbackCanvas = document.createElement('canvas')
      fallbackCanvas.width = 800
      fallbackCanvas.height = 1000
      const ctx = fallbackCanvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 800, 1000)
      ctx.fillStyle = '#1e293b'
      ctx.font = 'bold 24px sans-serif'
      ctx.fillText(`Document Preview: ${request.title}`, 50, 80)
      ctx.font = '16px sans-serif'
      ctx.fillStyle = '#64748b'
      ctx.fillText(`Type: ${request.documentType} | Ref: ${request.requestRef}`, 50, 120)
      ctx.fillText(`Requester: ${request.employeeName} (${request.employeeType})`, 50, 150)
      ctx.fillText(`Reason: ${request.reason}`, 50, 180)
      
      ctx.strokeStyle = '#e2e8f0'
      ctx.lineWidth = 2
      ctx.strokeRect(40, 220, 720, 720)
      ctx.fillStyle = '#94a3b8'
      ctx.fillText('[Original Document Preview Placeholder - Click below to sign]', 160, 560)
      
      const loadedImg = new Image()
      loadedImg.src = fallbackCanvas.toDataURL()
      loadedImg.onload = () => setDocImage(loadedImg)
    }
    dImg.src = mediaUrl(request.originalDocUrl)

    // Load Default Signature if available
    if (defaultSignature) {
      const sImg = new Image()
      sImg.crossOrigin = 'anonymous'
      sImg.onload = () => {
        setSignatureImage(sImg)
        setStamps(prev => ({ ...prev, signature: { ...prev.signature, active: true } }))
      }
      sImg.src = mediaUrl(defaultSignature)
    }

    // Load Default Seal if available
    if (defaultSeal) {
      const sealImg = new Image()
      sealImg.crossOrigin = 'anonymous'
      sealImg.onload = () => {
        setSealImage(sealImg)
        setStamps(prev => ({ ...prev, seal: { ...prev.seal, active: true } }))
      }
      sealImg.src = mediaUrl(defaultSeal)
    }
  }, [request, defaultSignature, defaultSeal])

  // Draw Canvas with Document and Stamps
  const drawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas || !docImage) return

    const ctx = canvas.getContext('2d')
    canvas.width = docImage.width || 800
    canvas.height = docImage.height || 1000

    // Draw document background
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(docImage, 0, 0, canvas.width, canvas.height)

    // Draw Signature Stamp if active
    if (stamps.signature.active && signatureImage) {
      ctx.save()
      ctx.globalAlpha = stamps.signature.opacity
      ctx.drawImage(
        signatureImage,
        stamps.signature.x,
        stamps.signature.y,
        stamps.signature.width,
        stamps.signature.height
      )
      ctx.restore()

      // Selection box highlight in edit mode
      if (selectedStamp === 'signature') {
        ctx.strokeStyle = '#2563eb'
        ctx.lineWidth = 3
        ctx.setLineDash([6, 4])
        ctx.strokeRect(
          stamps.signature.x - 2,
          stamps.signature.y - 2,
          stamps.signature.width + 4,
          stamps.signature.height + 4
        )
      }
    }

    // Draw Seal Stamp if active
    if (stamps.seal.active && sealImage) {
      ctx.save()
      ctx.globalAlpha = stamps.seal.opacity
      ctx.drawImage(
        sealImage,
        stamps.seal.x,
        stamps.seal.y,
        stamps.seal.width,
        stamps.seal.height
      )
      ctx.restore()

      if (selectedStamp === 'seal') {
        ctx.strokeStyle = '#059669'
        ctx.lineWidth = 3
        ctx.setLineDash([6, 4])
        ctx.strokeRect(
          stamps.seal.x - 2,
          stamps.seal.y - 2,
          stamps.seal.width + 4,
          stamps.seal.height + 4
        )
      }
    }
  }

  useEffect(() => {
    drawCanvas()
  }, [docImage, signatureImage, sealImage, stamps, selectedStamp])

  // Canvas Dragging Logic
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mouseX = (e.clientX - rect.left) * scaleX
    const mouseY = (e.clientY - rect.top) * scaleY

    // Check if clicked inside signature stamp
    const sig = stamps.signature
    if (sig.active && mouseX >= sig.x && mouseX <= sig.x + sig.width && mouseY >= sig.y && mouseY <= sig.y + sig.height) {
      setSelectedStamp('signature')
      setIsDragging(true)
      setDragOffset({ x: mouseX - sig.x, y: mouseY - sig.y })
      return
    }

    // Check if clicked inside seal stamp
    const seal = stamps.seal
    if (seal.active && mouseX >= seal.x && mouseX <= seal.x + seal.width && mouseY >= seal.y && mouseY <= seal.y + seal.height) {
      setSelectedStamp('seal')
      setIsDragging(true)
      setDragOffset({ x: mouseX - seal.x, y: mouseY - seal.y })
      return
    }
  }

  const handleMouseMove = (e) => {
    if (!isDragging || !selectedStamp) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mouseX = (e.clientX - rect.left) * scaleX
    const mouseY = (e.clientY - rect.top) * scaleY

    const newX = Math.max(0, Math.min(canvas.width - stamps[selectedStamp].width, mouseX - dragOffset.x))
    const newY = Math.max(0, Math.min(canvas.height - stamps[selectedStamp].height, mouseY - dragOffset.y))

    setStamps(prev => ({
      ...prev,
      [selectedStamp]: { ...prev[selectedStamp], x: newX, y: newY }
    }))
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Save Finalized Signed Document
  const handleFinalize = async () => {
    if (!stamps.signature.active && !stamps.seal.active) {
      return toast.error('Please place at least a signature or seal before finalizing')
    }

    setLoading(true)
    try {
      // Re-draw canvas without dashed selection borders
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(docImage, 0, 0, canvas.width, canvas.height)

      if (stamps.signature.active && signatureImage) {
        ctx.save()
        ctx.globalAlpha = stamps.signature.opacity
        ctx.drawImage(signatureImage, stamps.signature.x, stamps.signature.y, stamps.signature.width, stamps.signature.height)
        ctx.restore()
      }

      if (stamps.seal.active && sealImage) {
        ctx.save()
        ctx.globalAlpha = stamps.seal.opacity
        ctx.drawImage(sealImage, stamps.seal.x, stamps.seal.y, stamps.seal.width, stamps.seal.height)
        ctx.restore()
      }

      // Convert canvas to Blob/File
      const dataUrl = canvas.toDataURL('image/png')
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const signedFile = new File([blob], `Signed_${request.requestRef}.png`, { type: 'image/png' })

      const formData = new FormData()
      formData.append('file', signedFile)
      formData.append('stampsMeta', JSON.stringify(stamps))

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
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-all">
            <FiX size={20} />
          </button>
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
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              className="max-w-full max-h-full shadow-2xl rounded-lg cursor-crosshair bg-white border border-slate-700"
            />
          </div>

          {/* Right Editor Controls Sidebar */}
          <div className="w-80 border-l border-slate-200 bg-slate-50 p-5 flex flex-col justify-between overflow-y-auto space-y-6">
            <div className="space-y-5">
              {/* Document Info Card */}
              <div className="bg-blue-50/70 border border-blue-200/60 rounded-2xl p-4 space-y-2">
                <span className="badge bg-blue-600 text-white text-[10px] uppercase font-bold tracking-wider">{request.documentType}</span>
                <h4 className="font-bold text-slate-800 text-sm leading-tight">{request.title}</h4>
                <p className="text-xs text-slate-600 font-medium"><strong>Reason:</strong> {request.reason}</p>
                {request.urgency === 'urgent' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                    <FiAlertCircle size={12} /> URGENT REQUEST
                  </span>
                )}
              </div>

              {/* Signature Stamp Controls */}
              <div className={`p-4 rounded-2xl border transition-all ${selectedStamp === 'signature' ? 'border-blue-500 bg-white shadow-md' : 'border-slate-200 bg-white/60'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    ✒️ Signature Stamp
                  </span>
                  <label className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-1">
                    <FiUpload size={12} /> Upload
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCustomStampUpload(e, 'signature')} />
                  </label>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => {
                      setStamps(p => ({ ...p, signature: { ...p.signature, active: !p.signature.active } }))
                      setSelectedStamp('signature')
                    }}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${stamps.signature.active ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-200 text-slate-600'}`}
                  >
                    {stamps.signature.active ? 'Signature Placed' : '+ Add Signature'}
                  </button>
                </div>

                {stamps.signature.active && (
                  <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <span>Width:</span>
                      <input
                        type="range" min="80" max="300"
                        value={stamps.signature.width}
                        onChange={(e) => {
                          const w = Number(e.target.value)
                          setStamps(p => ({ ...p, signature: { ...p.signature, width: w, height: Math.round(w / 2) } }))
                        }}
                        className="w-28"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Company Seal Controls */}
              <div className={`p-4 rounded-2xl border transition-all ${selectedStamp === 'seal' ? 'border-emerald-500 bg-white shadow-md' : 'border-slate-200 bg-white/60'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    🏵️ Company Seal Stamp
                  </span>
                  <label className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer flex items-center gap-1">
                    <FiUpload size={12} /> Upload
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCustomStampUpload(e, 'seal')} />
                  </label>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => {
                      setStamps(p => ({ ...p, seal: { ...p.seal, active: !p.seal.active } }))
                      setSelectedStamp('seal')
                    }}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${stamps.seal.active ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-200 text-slate-600'}`}
                  >
                    {stamps.seal.active ? 'Seal Placed' : '+ Add Seal'}
                  </button>
                </div>

                {stamps.seal.active && (
                  <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <span>Size:</span>
                      <input
                        type="range" min="60" max="250"
                        value={stamps.seal.width}
                        onChange={(e) => {
                          const w = Number(e.target.value)
                          setStamps(p => ({ ...p, seal: { ...p.seal, width: w, height: w } }))
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
                <span>Click & drag stamps directly on the document canvas to position them anywhere.</span>
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
                    <FiCheck size={18} /> Apply Signature & Finalize
                  </>
                )}
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
