import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FiFileText, FiPlus, FiFilter, FiSearch, FiCheckCircle, FiClock, FiXCircle,
  FiDownload, FiEdit2, FiEdit3, FiShield, FiUpload, FiAlertCircle, FiUser, FiCalendar, FiCheck, FiX, FiRefreshCw, FiTrash2, FiBookmark, FiLayers, FiEye
} from 'react-icons/fi'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import useAuthStore from '../../store/authStore'
import { mediaUrl } from '../../lib/media'
import DocSignatureEditorModal from '../../components/ui/DocSignatureEditorModal'

const DOC_TYPES = [
  'Internship Certificate',
  'Contract Agreement',
  'NOC',
  'Service Letter',
  'Recommendation Letter',
  'Bank Document',
  'Other'
]

export default function SignatureRequests() {
  const { user } = useAuthStore()
  const userRole = String(user?.role || '').toLowerCase()
  const STAFF_ROLES = ['admin', 'owner', 'manager', 'developer', 'marketing', 'designer', 'hr', 'director', 'superadmin']
  const isManagement = STAFF_ROLES.includes(userRole) || userRole !== 'client'
  const queryClient = useQueryClient()

  // Filter States
  const [statusFilter, setStatusFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [urgencyFilter, setUrgencyFilter] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')

  // Modals & Active Action States
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [editingRequest, setEditingRequest] = useState(null)
  const [showStampsModal, setShowStampsModal] = useState(false)
  const [activeEditorRequest, setActiveEditorRequest] = useState(null)
  const [rejectingRequest, setRejectingRequest] = useState(null)
  const [deletingRequest, setDeletingRequest] = useState(null)
  const [viewingDoc, setViewingDoc] = useState(null)
  const [viewingStampModal, setViewingStampModal] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [adminPassword, setAdminPassword] = useState('')

  const handleViewDoc = async (req) => {
    setViewingDoc(req)
    try {
      const res = await api.get(`/signature-requests/${req._id}`)
      if (res.data?.request) {
        setViewingDoc(res.data.request)
      }
    } catch (e) {}
  }

  const handleOpenEditor = async (req) => {
    setActiveEditorRequest(req)
    try {
      const res = await api.get(`/signature-requests/${req._id}`)
      if (res.data?.request) {
        setActiveEditorRequest(res.data.request)
      }
    } catch (e) {}
  }

  // Delete Stamp Mutation
  const deleteStampMut = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/signature-requests/saved-stamps/${id}`)
      return { id, data: res.data }
    },
    onSuccess: ({ id }) => {
      toast.success('Stamp deleted from library')
      queryClient.setQueryData(['saved-stamps-list'], (old) => {
        if (!old || !old.stamps) return old
        return { ...old, stamps: old.stamps.filter((s) => String(s._id) !== String(id)) }
      })
      queryClient.invalidateQueries({ queryKey: ['saved-stamps-list'] })
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete stamp')
    }
  })

  // Reject Request Mutation (Admin / Owner)
  const rejectMut = useMutation({
    mutationFn: async ({ id, rejectionReason }) => {
      const res = await api.put(`/signature-requests/${id}/reject`, { rejectionReason })
      return res.data
    },
    onSuccess: () => {
      toast.success('Signature request rejected')
      setRejectingRequest(null)
      setRejectionReason('')
      queryClient.invalidateQueries({ queryKey: ['signature-requests'] })
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to reject request')
    }
  })

  // Hard Delete Request Mutation (Admin / Owner — Password Protected)
  const deleteRequestMut = useMutation({
    mutationFn: async ({ id, password }) => {
      const res = await api.delete(`/signature-requests/${id}`, { data: { password } })
      return { id, data: res.data }
    },
    onSuccess: ({ id }) => {
      toast.success('Signature request permanently deleted!')
      setDeletingRequest(null)
      setAdminPassword('')
      queryClient.setQueriesData({ queryKey: ['signature-requests'] }, (old) => {
        if (!old || !old.requests) return old
        return { ...old, requests: old.requests.filter((r) => String(r._id) !== String(id)) }
      })
      queryClient.invalidateQueries({ queryKey: ['signature-requests'] })
      refetch()
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete request. Check password.')
    }
  })

  // Submit Request Form State
  const [submitForm, setSubmitForm] = useState({
    title: '',
    documentType: 'Internship Certificate',
    reason: '',
    urgency: 'normal',
    notes: '',
    recipientType: 'general', // 'general' | 'client' | 'employee'
    clientId: '',
    employeeId: '',
    file: null
  })

  // Fetch Clients & Employees for Modal Selection
  const { data: clientsData } = useQuery({
    queryKey: ['clients-lookup-list'],
    queryFn: () => api.get('/clients').then(r => r.data).catch(() => ({ clients: [] })),
    enabled: showSubmitModal
  })
  const { data: employeesData } = useQuery({
    queryKey: ['employees-lookup-list'],
    queryFn: () => api.get('/employees').then(r => r.data).catch(() => ({ employees: [] })),
    enabled: showSubmitModal
  })
  const clientsList = clientsData?.clients || clientsData?.users || []
  const employeesList = employeesData?.employees || []

  // Add Stamp Form State (Admin / Owner Library)
  const [newStampForm, setNewStampForm] = useState({
    title: '',
    type: 'signature',
    isDefault: false,
    file: null
  })

  // Fetch Requests Query
  const { data: requestsData, isLoading, refetch } = useQuery({
    queryKey: ['signature-requests', statusFilter, categoryFilter, urgencyFilter, searchTerm],
    queryFn: async () => {
      const params = {}
      if (statusFilter !== 'All') params.status = statusFilter.toLowerCase()
      if (categoryFilter !== 'All') params.documentType = categoryFilter
      if (urgencyFilter !== 'All') params.urgency = urgencyFilter.toLowerCase()
      if (searchTerm.trim()) params.search = searchTerm.trim()
      const res = await api.get('/signature-requests', { params })
      return res.data
    },
    staleTime: 60 * 1000,
  })

  // Fetch Saved Stamps List Query
  const { data: savedStampsData } = useQuery({
    queryKey: ['saved-stamps-list'],
    queryFn: async () => {
      if (!isManagement) return null
      const res = await api.get('/signature-requests/saved-stamps')
      return res.data
    },
    enabled: isManagement
  })

  const requests = requestsData?.requests || []
  const savedStamps = savedStampsData?.stamps || []

  // Calculated Stats
  const totalCount = requests.length
  const pendingCount = requests.filter(r => r.status === 'pending').length
  const signedCount = requests.filter(r => r.status === 'signed').length
  const rejectedCount = requests.filter(r => r.status === 'rejected').length

  // Submit Request Mutation
  const submitMut = useMutation({
    mutationFn: async (formData) => {
      const res = await api.post('/signature-requests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('Signature request submitted successfully!')
      setShowSubmitModal(false)
      setEditingRequest(null)
      setSubmitForm({
        title: '',
        documentType: 'Internship Certificate',
        reason: '',
        urgency: 'normal',
        notes: '',
        recipientType: 'general',
        clientId: '',
        employeeId: '',
        file: null
      })
      queryClient.invalidateQueries(['signature-requests'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to submit request')
    }
  })

  // Update Request Mutation
  const updateMut = useMutation({
    mutationFn: async ({ id, formData }) => {
      const res = await api.put(`/signature-requests/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('Signature request updated successfully!')
      setShowSubmitModal(false)
      setEditingRequest(null)
      setSubmitForm({
        title: '',
        documentType: 'Internship Certificate',
        reason: '',
        urgency: 'normal',
        notes: '',
        recipientType: 'general',
        clientId: '',
        employeeId: '',
        file: null
      })
      queryClient.invalidateQueries(['signature-requests'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update request')
    }
  })

  // Add Stamp to Library Mutation
  const addStampMut = useMutation({
    mutationFn: async (formData) => {
      const res = await api.post('/signature-requests/saved-stamps', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('Stamp added to your library!')
      setNewStampForm({ title: '', type: 'signature', isDefault: false, file: null })
      queryClient.invalidateQueries(['saved-stamps-list'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to save stamp')
    }
  })



  const handleOpenCreate = () => {
    setEditingRequest(null)
    setSubmitForm({
      title: '',
      documentType: 'Internship Certificate',
      reason: '',
      urgency: 'normal',
      notes: '',
      recipientType: 'general',
      clientId: '',
      employeeId: '',
      file: null
    })
    setShowSubmitModal(true)
  }

  const handleOpenEdit = (req) => {
    setEditingRequest(req)
    setSubmitForm({
      title: req.title || '',
      documentType: req.documentType || 'Internship Certificate',
      reason: req.reason || '',
      urgency: req.urgency || 'normal',
      notes: req.notes || '',
      recipientType: req.recipientType || 'general',
      clientId: req.clientId?._id || req.clientId || '',
      employeeId: req.employeeId?._id || req.employeeId || '',
      file: null
    })
    setShowSubmitModal(true)
  }

  const handleSubmitRequest = (e) => {
    e.preventDefault()
    if (!submitForm.title || !submitForm.reason) {
      return toast.error('Please fill all required fields')
    }
    if (!editingRequest && !submitForm.file) {
      return toast.error('Please upload a document file')
    }
    if (submitForm.recipientType === 'client' && !submitForm.clientId) {
      return toast.error('Please select a Customer / Client')
    }
    if (submitForm.recipientType === 'employee' && !submitForm.employeeId) {
      return toast.error('Please select an Employee / Intern')
    }
    const fd = new FormData()
    fd.append('title', submitForm.title)
    fd.append('documentType', submitForm.documentType)
    fd.append('reason', submitForm.reason)
    fd.append('urgency', submitForm.urgency)
    fd.append('notes', submitForm.notes)
    fd.append('recipientType', submitForm.recipientType)
    if (submitForm.recipientType === 'client' && submitForm.clientId) {
      fd.append('clientId', submitForm.clientId)
    }
    if (submitForm.recipientType === 'employee' && submitForm.employeeId) {
      fd.append('employeeId', submitForm.employeeId)
    }
    if (submitForm.file) {
      fd.append('file', submitForm.file)
    }

    if (editingRequest) {
      updateMut.mutate({ id: editingRequest._id, formData: fd })
    } else {
      submitMut.mutate(fd)
    }
  }

  const handleAddStampToLibrary = (e) => {
    e.preventDefault()
    if (!newStampForm.title || !newStampForm.file) {
      return toast.error('Please enter stamp title and upload image file')
    }
    const fd = new FormData()
    fd.append('title', newStampForm.title)
    fd.append('type', newStampForm.type)
    fd.append('isDefault', newStampForm.isDefault)
    fd.append('image', newStampForm.file)
    addStampMut.mutate(fd)
  }

  // Download Signed Document Helper (Handles Base64 Data URIs & HTTP URLs)
  const handleDownloadSignedDoc = async (signedDocUrl, requestRef) => {
    try {
      let fileUrl = mediaUrl(signedDocUrl)
      if (!fileUrl) return toast.error('No signed document file available')

      // If it's a data URI, fix any corrupt leading chars before the magic bytes
      if (fileUrl.startsWith('data:') && fileUrl.includes('base64,')) {
        const commaIdx = fileUrl.indexOf('base64,') + 7
        let b64Content = fileUrl.substring(commaIdx)
        const pdfMagic  = b64Content.indexOf('JVBERi')  // PDF  %PDF
        const pngMagic  = b64Content.indexOf('iVBORw')  // PNG
        const docxMagic = b64Content.indexOf('UEsD')    // DOCX PK\x03\x04
        if (pdfMagic > 0) {
          fileUrl = `data:application/pdf;base64,${b64Content.substring(pdfMagic)}`
        } else if (docxMagic > 0) {
          fileUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${b64Content.substring(docxMagic)}`
        } else if (pngMagic > 0) {
          fileUrl = `data:image/png;base64,${b64Content.substring(pngMagic)}`
        }
      }
      // Handle bare base64 strings (legacy)
      else if (fileUrl.includes('base64,') && !fileUrl.startsWith('data:')) {
        const idx = fileUrl.indexOf('base64,')
        const prefix = fileUrl.substring(0, idx)
        const content = fileUrl.substring(idx + 7)
        if (prefix.includes('pdf') || content.includes('JVBERi')) {
          fileUrl = `data:application/pdf;base64,${content}`
        } else if (prefix.includes('word') || prefix.includes('docx') || content.startsWith('UEsD')) {
          fileUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${content}`
        } else {
          fileUrl = `data:image/png;base64,${content}`
        }
      }
      // Handle /uploads/ paths that are actually base64 (legacy corrupt entries)
      else if (fileUrl.includes('/uploads/') && (fileUrl.includes('==') || fileUrl.includes('iVBORw') || fileUrl.includes('JVBERi') || fileUrl.includes('UEsD') || fileUrl.length > 150)) {
        const lastSlash = fileUrl.lastIndexOf('/')
        const base64Str = fileUrl.substring(lastSlash + 1)
        if (base64Str.includes('JVBERi')) {
          fileUrl = `data:application/pdf;base64,${base64Str}`
        } else if (base64Str.includes('UEsD') || base64Str.startsWith('UEsD')) {
          fileUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64Str}`
        } else {
          fileUrl = `data:image/png;base64,${base64Str}`
        }
      }

      // Natively convert fileUrl (Data URI or HTTP URL) into a clean, uncorrupted Blob
      const response = await fetch(fileUrl)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)

      // ── Magic-byte detection (same logic as DocSignatureEditorModal) ──
      // Read first 4 bytes from the blob to determine actual file type
      const headerBuf = await blob.slice(0, 4).arrayBuffer()
      const hdr = new Uint8Array(headerBuf)
      let ext
      if (hdr[0] === 0x50 && hdr[1] === 0x4B) {
        // PK header → ZIP-based format (DOCX, XLSX, etc.)
        ext = 'docx'
      } else if (hdr[0] === 0x25 && hdr[1] === 0x50 && hdr[2] === 0x44 && hdr[3] === 0x46) {
        // %PDF header
        ext = 'pdf'
      } else if (blob.type.includes('pdf') || fileUrl.includes('JVBERi') || fileUrl.endsWith('.pdf')) {
        ext = 'pdf'
      } else {
        ext = 'png'
      }
      const filename = `Signed_${requestRef || 'Document'}.${ext}`

      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
      toast.success('Signed document downloaded successfully!')
    } catch (err) {
      console.error('Download error:', err)
      toast.error('Failed to download file')
    }
  }

  // Get Default Signature and Seal for Editor
  const defaultSig = savedStamps.find(s => s.type === 'signature' && s.isDefault)?.imageUrl || savedStamps.find(s => s.type === 'signature')?.imageUrl || ''
  const defaultSeal = savedStamps.find(s => s.type === 'seal' && s.isDefault)?.imageUrl || savedStamps.find(s => s.type === 'seal')?.imageUrl || ''

  return (
    <div className="w-full space-y-6 animate-fade-in pb-12">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Signature &amp; Seal Requests</h1>
          <p className="page-subtitle">Corporate e-signatures, stamp verification requests, and document approvals</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto mt-3 sm:mt-0 justify-start sm:justify-end">
          {isManagement && (
            <button
              type="button"
              onClick={() => setShowStampsModal(true)}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 shadow-xs flex items-center gap-1.5 transition-all w-full sm:w-auto justify-center"
            >
              <FiBookmark size={14} className="text-blue-600" /> Stamp Library ({savedStamps.length})
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenCreate}
            className="btn-primary gap-2 w-full sm:w-auto justify-center"
          >
            <FiPlus size={16} /> Submit Document
          </button>
        </div>
      </div>

      {/* ── Main Requests Table Section ─────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest">ISSUED REQUESTS</h2>
          <span className="text-xs text-slate-500 font-bold bg-slate-200/60 px-2.5 py-1 rounded-full">{requests.length} on file</span>
        </div>

        {/* ── Grid Search & Filters Bar ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-3.5 shadow-card border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
          {/* Search Box (Spans 2 columns on lg screens) */}
          <div className="relative lg:col-span-2 w-full">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search by name, reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending Review</option>
            <option value="Signed">Signed &amp; Sealed</option>
            <option value="Rejected">Rejected</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
          >
            <option value="All">All Categories</option>
            {DOC_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Urgency Filter + Reset Button */}
          <div className="flex items-center gap-2 w-full">
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
            >
              <option value="All">All Priorities</option>
              <option value="Normal">Normal Priority</option>
              <option value="Urgent">🔴 Urgent Priority</option>
            </select>

            <button
              onClick={() => {
                setStatusFilter('All')
                setCategoryFilter('All')
                setUrgencyFilter('All')
                setSearchTerm('')
              }}
              className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shrink-0 flex items-center justify-center"
              title="Reset Filters"
            >
              <FiRefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* ── Document Requests Desktop Data Table ────────────────────────────── */}
        <div className="table-container hidden lg:block">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <span className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto block" />
              <p className="text-xs font-semibold text-slate-500">Loading document requests...</p>
            </div>
          ) : requests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table min-w-[900px]">
                <thead>
                  <tr>
                    <th>Reference &amp; Document</th>
                    <th>Employee / Requester</th>
                    <th>Category</th>
                    <th>Reason</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                {requests.map((req) => (
                  <tr key={req._id}>
                    {/* Ref & Title */}
                    <td>
                      <div className="flex flex-col gap-1 min-w-[180px]">
                        <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-md w-fit">
                          {req.requestRef}
                        </span>
                        <p className="font-medium text-gray-800 text-sm leading-tight line-clamp-1">{req.title}</p>
                        <p className="text-xs text-gray-400">{new Date(req.createdAt).toLocaleDateString()}</p>
                      </div>
                    </td>

                    {/* Requester & Target Recipient */}
                    <td>
                      <div className="flex items-center gap-3 min-w-[160px]">
                        <div className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-semibold text-sm flex-shrink-0">
                          {req.recipientType === 'client' ? (req.clientName ? req.clientName.charAt(0).toUpperCase() : 'C') :
                           req.employeeName ? req.employeeName.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm">
                            {req.recipientType === 'client' ? (req.clientName || 'Client') : req.employeeName}
                          </p>
                          <p className="text-[11px] text-gray-400 font-medium">
                            {req.recipientType === 'client' ? '🏢 Target: Client' :
                             req.recipientType === 'employee' ? '👤 Target: Employee' :
                             '🌐 Target: System Only'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td>
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium border border-slate-200/80 whitespace-nowrap inline-block">
                        {req.documentType}
                      </span>
                    </td>

                    {/* Reason */}
                    <td>
                      <p className="text-gray-600 text-sm max-w-xs truncate font-normal" title={req.reason}>
                        {req.reason}
                      </p>
                    </td>

                    {/* Priority */}
                    <td>
                      {req.urgency === 'urgent' ? (
                        <span className="badge badge-red animate-pulse">
                          <FiAlertCircle size={11} /> URGENT
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500 font-normal">Normal</span>
                      )}
                    </td>

                    {/* Status */}
                    <td>
                      {req.status === 'signed' ? (
                        <div>
                          <span className="badge badge-green">
                            <FiCheckCircle size={11} /> Signed &amp; Sealed
                          </span>
                          {req.signedByName && (
                            <p className="text-xs text-gray-400 mt-0.5">By {req.signedByName}</p>
                          )}
                        </div>
                      ) : req.status === 'rejected' ? (
                        <span className="badge badge-red">
                          <FiXCircle size={11} /> Rejected
                        </span>
                      ) : (
                        <span className="badge badge-yellow">
                          <FiClock size={11} /> Pending Review
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleViewDoc(req)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="View Document & Signature Details"
                        >
                          <FiEye size={14} /> View
                        </button>

                        {req.status === 'signed' && req.signedDocUrl ? (
                          <button
                            type="button"
                            onClick={() => handleDownloadSignedDoc(req.signedDocUrl, req.requestRef)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Download Signed Document"
                          >
                            <FiDownload size={14} /> Download
                          </button>
                        ) : isManagement && req.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditor(req)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs inline-flex items-center gap-1.5 transition-colors"
                              title="Sign & Stamp Document"
                            >
                              <FiEdit3 size={14} /> Sign &amp; Stamp
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectingRequest(req)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Decline Request"
                            >
                              <FiX size={14} />
                            </button>
                          </>
                        ) : (
                          <a
                            href={mediaUrl(req.originalDocUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-gray-400 hover:text-secondary hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Original Document"
                          >
                            <FiFileText size={14} />
                          </a>
                        )}

                        {(isManagement || ((req.requester?._id === user?._id || req.requester === user?._id) && req.status === 'pending')) && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(req)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Request Details"
                          >
                            <FiEdit2 size={14} />
                          </button>
                        )}

                        {isManagement && (
                          <button
                            type="button"
                            onClick={() => setDeletingRequest(req)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Permanently Delete Request"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-16 text-center text-gray-400 space-y-2">
            <FiFileText size={36} className="mx-auto text-gray-300 opacity-40" />
            <p className="text-base font-semibold text-gray-700">No document signature requests found</p>
            <p className="text-xs text-gray-400 font-normal">Submit a new request or adjust filters to view documents.</p>
          </div>
        )}
      </div>

      {/* ── Document Requests Mobile Card View ──────────────────────────────── */}
      <div className="block lg:hidden space-y-3">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto"/>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-slate-200 p-6 space-y-2">
            <FiFileText size={32} className="mx-auto text-slate-300"/>
            <p className="font-semibold text-slate-700 text-sm">No document signature requests found</p>
          </div>
        ) : (
          requests.map(req => (
            <div key={req._id} className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3 shadow-card">
              {/* Top Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <span className="font-mono text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-md inline-block">
                    {req.requestRef}
                  </span>
                  <h3 className="font-bold text-slate-800 text-sm leading-tight truncate">{req.title}</h3>
                </div>
                <div className="shrink-0">
                  {req.status === 'signed' ? (
                    <span className="badge badge-green text-[10px]">
                      <FiCheckCircle size={10} /> Signed
                    </span>
                  ) : req.status === 'rejected' ? (
                    <span className="badge badge-red text-[10px]">
                      <FiXCircle size={10} /> Rejected
                    </span>
                  ) : (
                    <span className="badge badge-yellow text-[10px]">
                      <FiClock size={10} /> Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Requester / Target Info */}
              <div className="flex items-center gap-2.5 py-1">
                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-semibold text-xs shrink-0">
                  {req.recipientType === 'client' ? (req.clientName ? req.clientName.charAt(0).toUpperCase() : 'C') :
                   req.employeeName ? req.employeeName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800 text-xs truncate">
                    {req.recipientType === 'client' ? (req.clientName || 'Client') : req.employeeName}
                  </p>
                  <p className="text-[11px] font-medium text-slate-400">
                    {req.recipientType === 'client' ? '🏢 Target: Client' :
                     req.recipientType === 'employee' ? '👤 Target: Employee' :
                     '🌐 Target: System Only'}
                  </p>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs border-t border-b border-slate-100 py-2.5">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Category</span>
                  <p className="font-medium text-slate-700 truncate">{req.documentType}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Priority</span>
                  <p className="font-medium text-slate-700">
                    {req.urgency === 'urgent' ? (
                      <span className="text-red-600 font-bold flex items-center gap-1"><FiAlertCircle size={11}/> Urgent</span>
                    ) : (
                      'Normal'
                    )}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Reason</span>
                  <p className="font-normal text-slate-600 line-clamp-2">{req.reason}</p>
                </div>
              </div>

              {/* Mobile Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-400 font-medium">
                  {new Date(req.createdAt).toLocaleDateString()}
                </span>

                <div className="flex items-center gap-2">
                  {req.status === 'signed' && req.signedDocUrl ? (
                    <button
                      type="button"
                      onClick={() => handleDownloadSignedDoc(req.signedDocUrl, req.requestRef)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5"
                    >
                      <FiDownload size={13} /> Download
                    </button>
                  ) : isManagement && req.status === 'pending' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveEditorRequest(req)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5"
                      >
                        <FiEdit3 size={13} /> Sign
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectingRequest(req)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <FiX size={14} />
                      </button>
                    </>
                  ) : (
                    <a
                      href={mediaUrl(req.originalDocUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 flex items-center gap-1"
                    >
                      <FiFileText size={13} /> View
                    </a>
                  )}

                  {(isManagement || ((req.requester?._id === user?._id || req.requester === user?._id) && req.status === 'pending')) && (
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(req)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Edit Request Details"
                    >
                      <FiEdit2 size={14} />
                    </button>
                  )}

                  {isManagement && (
                    <button
                      type="button"
                      onClick={() => setDeletingRequest(req)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>

      {/* ── Submit Request Modal (Employee) ─────────────────────────────────── */}
      {showSubmitModal && createPortal(
        <AnimatePresence>
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto border border-slate-200"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FiFileText className="text-blue-600" /> {editingRequest ? 'Edit Signature & Seal Request' : 'New Document Signature Request'}
                </h3>
                <button onClick={() => { setShowSubmitModal(false); setEditingRequest(null); }} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl">
                  <FiX size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmitRequest} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Document Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Internship Certificate Verification"
                    value={submitForm.title}
                    onChange={(e) => setSubmitForm(p => ({ ...p, title: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* ── Recipient / Target Audience Assignment ─────────────────────────── */}
                <div className="space-y-3 bg-blue-50/50 border border-blue-100 p-4 rounded-2xl">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-1">
                      Document Assignment &amp; Routing Target *
                    </label>
                    <select
                      value={submitForm.recipientType}
                      onChange={(e) => setSubmitForm(p => ({ ...p, recipientType: e.target.value, clientId: '', employeeId: '' }))}
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="general">🌐 System Only / General (Direct to System)</option>
                      <option value="client">🏢 Customer / Client (Assign to Client Profile)</option>
                      <option value="employee">👤 Employee / Intern (Assign to Employee Profile)</option>
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {submitForm.recipientType === 'general' ? 'This document will be saved directly into the system records.' :
                       submitForm.recipientType === 'client' ? 'Assigns and routes this document to a specific client portal/profile.' :
                       'Assigns and routes this document to a specific employee/intern profile.'}
                    </p>
                  </div>

                  {/* Dynamic Selection for Customer / Client */}
                  {submitForm.recipientType === 'client' && (
                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-1">
                        Select Customer / Client *
                      </label>
                      <select
                        required
                        value={submitForm.clientId}
                        onChange={(e) => setSubmitForm(p => ({ ...p, clientId: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">-- Select Customer / Client --</option>
                        {clientsList.map(c => {
                          const nameLabel = c.companyName ? `${c.companyName} (${c.contactPerson || c.name || 'Client'})` : (c.name || c.contactPerson || 'Client')
                          return <option key={c._id} value={c._id}>{nameLabel}</option>
                        })}
                      </select>
                    </motion.div>
                  )}

                  {/* Dynamic Selection for Employee / Intern */}
                  {submitForm.recipientType === 'employee' && (
                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-1">
                        Select Employee / Intern *
                      </label>
                      <select
                        required
                        value={submitForm.employeeId}
                        onChange={(e) => setSubmitForm(p => ({ ...p, employeeId: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">-- Select Employee / Intern --</option>
                        {employeesList.map(e => {
                          const empUser = e.userId || {}
                          const empName = empUser.name || (e.firstName ? `${e.firstName} ${e.lastName || ''}`.trim() : 'Employee')
                          const dept = e.department ? ` • ${e.department}` : ''
                          return <option key={e._id} value={e._id}>{empName}{dept} ({e.employmentType || 'Employee'})</option>
                        })}
                      </select>
                    </motion.div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Document Category
                    </label>
                    <select
                      value={submitForm.documentType}
                      onChange={(e) => setSubmitForm(p => ({ ...p, documentType: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white"
                    >
                      {DOC_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Urgency / Priority
                    </label>
                    <select
                      value={submitForm.urgency}
                      onChange={(e) => setSubmitForm(p => ({ ...p, urgency: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white"
                    >
                      <option value="normal">Normal Priority</option>
                      <option value="urgent">🔴 Urgent Approval Needed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Reason for Request (හේතුව) *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Explain why this document needs official signature and seal..."
                    value={submitForm.reason}
                    onChange={(e) => setSubmitForm(p => ({ ...p, reason: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold resize-none focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Upload Document {editingRequest ? '(Optional on Edit)' : '*'}
                  </label>
                  <input
                    type="file"
                    required={!editingRequest}
                    accept=".pdf,image/*,.doc,.docx"
                    onChange={(e) => setSubmitForm(p => ({ ...p, file: e.target.files?.[0] || null }))}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {editingRequest ? (
                    <p className="text-[10px] text-blue-600 font-medium mt-1">
                      💡 Leave empty to keep existing attached document file.
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-500 font-medium mt-1">
                      📌 Recommended format: <span className="font-bold text-slate-700">PDF (.pdf)</span> or <span className="font-bold text-slate-700">Image (.png, .jpg)</span> for interactive digital signing &amp; seal placement.
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowSubmitModal(false); setEditingRequest(null); }}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitMut.isPending || updateMut.isPending}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2"
                  >
                    {editingRequest
                      ? (updateMut.isPending ? 'Updating...' : 'Update Request')
                      : (submitMut.isPending ? 'Submitting...' : 'Submit Request')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* ── Saved Stamps Library Manager Modal (Admin / Owner) ───────────────── */}
      {showStampsModal && createPortal(
        <AnimatePresence>
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto border border-slate-200"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FiBookmark className="text-blue-600" /> Signature &amp; Seal Library
                </h3>
                <button onClick={() => setShowStampsModal(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl">
                  <FiX size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <form onSubmit={handleAddStampToLibrary} className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Add Stamp / Signature to Library</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Stamp Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Official Seal 2026"
                        value={newStampForm.title}
                        onChange={(e) => setNewStampForm(p => ({ ...p, title: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Type</label>
                      <select
                        value={newStampForm.type}
                        onChange={(e) => setNewStampForm(p => ({ ...p, type: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                      >
                        <option value="signature">Signature</option>
                        <option value="seal">Company Seal</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setNewStampForm(p => ({ ...p, file: e.target.files?.[0] || null }))}
                      className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-700"
                    />
                    <button
                      type="submit"
                      disabled={addStampMut.isPending}
                      className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 shrink-0"
                    >
                      {addStampMut.isPending ? 'Saving...' : 'Save Stamp'}
                    </button>
                  </div>
                </form>

                {/* Saved Stamps List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Saved Library Stamps ({savedStamps.length})
                  </h4>
                  {savedStamps.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {savedStamps.map((st) => {
                        const imgSrc = (st.imageUrl && (st.imageUrl.startsWith('data:') || st.imageUrl.startsWith('blob:')))
                          ? st.imageUrl
                          : mediaUrl(st.imageUrl)
                        return (
                          <div key={st._id} className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-xs">
                            <div className="flex items-center gap-3">
                              <div className="w-14 h-14 border border-slate-200 rounded-xl bg-slate-50 p-1.5 flex items-center justify-center">
                                {imgSrc ? (
                                  <img src={imgSrc} alt={st.title} className="max-h-full object-contain" />
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-400">Stamp</span>
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 text-xs">{st.title}</p>
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                                  {st.type}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setViewingStampModal(st)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer"
                                title="View Stamp Full Image"
                              >
                                <FiEye size={16} />
                              </button>
                              <button
                                onClick={() => deleteStampMut.mutate(st._id)}
                                disabled={deleteStampMut.isPending}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                                title="Delete Stamp"
                              >
                                <FiTrash2 size={16} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 font-medium italic text-center py-4">No saved stamps found in your library.</p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* ── Reject Modal ──────────────────────────────────────────────────────── */}
      {rejectingRequest && createPortal(
        <AnimatePresence>
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Reject Signature Request</h3>
              <p className="text-xs text-slate-500 font-medium">Specify why this request is being declined:</p>
              <textarea
                rows={3}
                placeholder="Reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium resize-none focus:bg-white"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setRejectingRequest(null)} className="px-4 py-2.5 text-xs font-semibold text-slate-500">
                  Cancel
                </button>
                <button
                  onClick={() => rejectMut.mutate({ id: rejectingRequest._id, rejectionReason })}
                  disabled={rejectMut.isPending}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md"
                >
                  {rejectMut.isPending ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* ── Hard Delete Confirmation Modal ────────────────────────────────────── */}
      {deletingRequest && createPortal(
        <AnimatePresence>
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200"
            >
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-3 bg-red-100 rounded-2xl">
                  <FiTrash2 size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Hard Delete Request</h3>
                  <p className="text-xs text-slate-500 font-mono font-bold">{deletingRequest.requestRef}</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Are you sure you want to permanently delete <span className="font-bold text-slate-800">{deletingRequest.title}</span> ({deletingRequest.requestRef})? This action cannot be undone and will delete the record and files from server storage.
              </p>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Enter Admin Password to Confirm *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Admin Password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => { setDeletingRequest(null); setAdminPassword(''); }}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!adminPassword.trim()) return toast.error('Admin Password is required to confirm deletion')
                    deleteRequestMut.mutate({ id: deletingRequest._id, password: adminPassword })
                  }}
                  disabled={deleteRequestMut.isPending}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/20 flex items-center gap-1.5 transition-all"
                >
                  {deleteRequestMut.isPending ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* ── Document & Signature Viewer Lightbox Modal ────────────────────── */}
      {viewingDoc && createPortal(
        <AnimatePresence>
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto border border-slate-200 flex flex-col max-h-[92vh]"
            >
              <div className="p-5 px-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100/80 px-2.5 py-1 rounded-lg border border-blue-200">
                    {viewingDoc.requestRef}
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-tight">{viewingDoc.title}</h3>
                    <p className="text-xs text-slate-500 font-medium">Category: {viewingDoc.documentType} • Created: {new Date(viewingDoc.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {viewingDoc.status === 'signed' ? (
                    <span className="badge badge-green px-3 py-1 font-bold text-xs"><FiCheckCircle size={13} /> Signed &amp; Sealed</span>
                  ) : (
                    <span className="badge badge-yellow px-3 py-1 font-bold text-xs"><FiClock size={13} /> Pending Review</span>
                  )}
                  <button onClick={() => setViewingDoc(null)} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer">
                    <FiX size={20} />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-900/5 min-h-[420px] flex items-center justify-center">
                {(() => {
                  const docUrl = viewingDoc.signedDocUrl || viewingDoc.originalDocUrl
                  if (!docUrl) {
                    return (
                      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                        <FiFileText className="w-16 h-16 mb-3 text-slate-300 stroke-[1.5]" />
                        <p className="text-sm font-semibold text-slate-600">No document file attached</p>
                        <p className="text-xs text-slate-400 mt-1">This request was created without an uploaded document file.</p>
                      </div>
                    )
                  }
                  const fullUrl = mediaUrl(docUrl)
                  const isImg = docUrl && (docUrl.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i) || docUrl.startsWith('data:image'))
                  
                  if (isImg) {
                    return (
                      <div className="max-w-full max-h-full flex items-center justify-center p-2">
                        <img
                          src={fullUrl}
                          alt={viewingDoc.title}
                          className="max-h-[65vh] max-w-full object-contain rounded-2xl shadow-xl border border-slate-200 bg-white"
                        />
                      </div>
                    )
                  }
                  
                  return (
                    <iframe
                      src={fullUrl}
                      title={viewingDoc.title}
                      className="w-full h-[65vh] rounded-2xl border border-slate-200 bg-white shadow-lg"
                    />
                  )
                })()}
              </div>

              <div className="p-4 px-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                <div className="text-xs text-slate-500 font-medium">
                  {viewingDoc.signedByName ? <span>Signed by: <strong className="text-slate-800">{viewingDoc.signedByName}</strong></span> : <span>Reason: {viewingDoc.reason}</span>}
                </div>
                <div className="flex items-center gap-3">
                  {isManagement && viewingDoc.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => { setViewingDoc(null); setActiveEditorRequest(viewingDoc); }}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
                    >
                      <FiEdit3 size={15} /> Sign &amp; Stamp Document
                    </button>
                  )}
                  {viewingDoc.signedDocUrl && (
                    <button
                      type="button"
                      onClick={() => handleDownloadSignedDoc(viewingDoc.signedDocUrl, viewingDoc.requestRef)}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
                    >
                      <FiDownload size={15} /> Download Signed File
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewingDoc(null)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* ── Stamp Image Full Screen Lightbox Modal ────────────────────── */}
      {viewingStampModal && createPortal(
        <AnimatePresence>
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base">{viewingStampModal.title}</h3>
                  <span className="badge badge-blue uppercase text-[10px]">{viewingStampModal.type}</span>
                </div>
                <button onClick={() => setViewingStampModal(null)} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer">
                  <FiX size={20} />
                </button>
              </div>
              <div className="p-4 bg-slate-100/80 rounded-2xl border border-slate-200 flex items-center justify-center min-h-[220px]">
                <img
                  src={viewingStampModal.imageUrl && (viewingStampModal.imageUrl.startsWith('data:') || viewingStampModal.imageUrl.startsWith('blob:')) ? viewingStampModal.imageUrl : mediaUrl(viewingStampModal.imageUrl)}
                  alt={viewingStampModal.title}
                  className="max-h-64 object-contain"
                />
              </div>
              <div className="flex justify-end">
                <button onClick={() => setViewingStampModal(null)} className="px-5 py-2.5 bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer">
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* ── Interactive Sign & Stamp Editor Modal ───────────────────────────── */}
      {activeEditorRequest && (
        <DocSignatureEditorModal
          request={activeEditorRequest}
          onClose={() => setActiveEditorRequest(null)}
          onSuccess={() => refetch()}
          defaultSignature={defaultSig}
          defaultSeal={defaultSeal}
        />
      )}
    </div>
  )
}
