import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FiFileText, FiPlus, FiFilter, FiSearch, FiCheckCircle, FiClock, FiXCircle,
  FiDownload, FiEdit3, FiShield, FiUpload, FiAlertCircle, FiUser, FiCalendar, FiCheck, FiX, FiRefreshCw, FiTrash2, FiBookmark, FiLayers
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
  const isManagement = ['admin', 'owner', 'manager'].includes(user?.role)
  const queryClient = useQueryClient()

  // Filter States
  const [statusFilter, setStatusFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [urgencyFilter, setUrgencyFilter] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')

  // Modals & Active Action States
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showStampsModal, setShowStampsModal] = useState(false)
  const [activeEditorRequest, setActiveEditorRequest] = useState(null)
  const [rejectingRequest, setRejectingRequest] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')

  // Submit Request Form State (Employee)
  const [submitForm, setSubmitForm] = useState({
    title: '',
    documentType: 'Internship Certificate',
    reason: '',
    urgency: 'normal',
    notes: '',
    file: null
  })

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
    }
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

  // Submit Request Mutation (Employee)
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
      setSubmitForm({
        title: '',
        documentType: 'Internship Certificate',
        reason: '',
        urgency: 'normal',
        notes: '',
        file: null
      })
      queryClient.invalidateQueries(['signature-requests'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to submit request')
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

  // Delete Stamp Mutation
  const deleteStampMut = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/signature-requests/saved-stamps/${id}`)
      return res.data
    },
    onSuccess: () => {
      toast.success('Stamp deleted from library')
      queryClient.invalidateQueries(['saved-stamps-list'])
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
      queryClient.invalidateQueries(['signature-requests'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to reject request')
    }
  })

  const handleSubmitRequest = (e) => {
    e.preventDefault()
    if (!submitForm.title || !submitForm.reason || !submitForm.file) {
      return toast.error('Please fill all required fields and upload document')
    }
    const fd = new FormData()
    fd.append('title', submitForm.title)
    fd.append('documentType', submitForm.documentType)
    fd.append('reason', submitForm.reason)
    fd.append('urgency', submitForm.urgency)
    fd.append('notes', submitForm.notes)
    fd.append('file', submitForm.file)
    submitMut.mutate(fd)
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

      // Repair corrupted legacy base64 URLs if needed
      if (fileUrl.includes('data:')) {
        fileUrl = fileUrl.substring(fileUrl.indexOf('data:'))
      } else if (fileUrl.includes('/uploads/') && (fileUrl.includes('==') || fileUrl.includes('iVBORw') || fileUrl.includes('JVBERi') || fileUrl.length > 150)) {
        const lastSlash = fileUrl.lastIndexOf('/')
        const base64Str = fileUrl.substring(lastSlash + 1)
        if (base64Str.includes('JVBERi')) {
          fileUrl = `data:application/pdf;base64,${base64Str}`
        } else {
          fileUrl = `data:image/png;base64,${base64Str}`
        }
      }

      // Natively convert fileUrl (Data URI or HTTP URL) into a clean, uncorrupted Blob
      const response = await fetch(fileUrl)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)

      const isPdf = blob.type.includes('pdf') || fileUrl.includes('JVBERi') || fileUrl.endsWith('.pdf')
      const ext = isPdf ? 'pdf' : 'png'
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
    <div className="p-6 md:p-10 space-y-8 max-w-[1600px] mx-auto text-slate-800">
      {/* ── High-Impact Executive Top Banner ──────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-8 md:p-10 rounded-3xl shadow-2xl relative overflow-hidden border border-blue-800/40">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-500/20 border border-blue-400/30 rounded-full text-blue-200 text-xs font-bold tracking-wide uppercase">
              <FiShield size={14} className="text-blue-400" /> Official E-Signature & Stamp Portal
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-md">
              Document Signature Requests
            </h1>
            <p className="text-sm text-blue-100/90 max-w-2xl font-medium leading-relaxed">
              Submit employee document verification requests, drag & place official digital signatures and company seals, and track approval status with audit filtering.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {isManagement && (
              <button
                onClick={() => setShowStampsModal(true)}
                className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-2xl border border-white/25 backdrop-blur-md flex items-center gap-2 transition-all shadow-lg"
              >
                <FiBookmark size={16} className="text-blue-300" /> My Stamp Library ({savedStamps.length})
              </button>
            )}

            <button
              onClick={() => setShowSubmitModal(true)}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-2xl shadow-xl shadow-blue-600/30 flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
            >
              <FiPlus size={18} /> Submit Document for Signature
            </button>
          </div>
        </div>
      </div>

      {/* ── Executive Metric KPI Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Requests</p>
            <p className="text-3xl font-extrabold text-slate-900">{totalCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <FiLayers size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Pending Review</p>
            <p className="text-3xl font-extrabold text-amber-600">{pendingCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <FiClock size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Signed & Sealed</p>
            <p className="text-3xl font-extrabold text-emerald-600">{signedCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <FiCheckCircle size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-red-600">Rejected</p>
            <p className="text-3xl font-extrabold text-red-600">{rejectedCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
            <FiXCircle size={22} />
          </div>
        </div>
      </div>

      {/* ── High Contrast Audit Filters & Search Bar ─────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <FiFilter className="text-blue-600" size={16} /> Audit Filters & Search
          </h3>
          <button
            onClick={() => {
              setStatusFilter('All')
              setCategoryFilter('All')
              setUrgencyFilter('All')
              setSearchTerm('')
            }}
            className="text-xs font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1.5 transition-colors"
          >
            <FiRefreshCw size={13} /> Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Search Box */}
          <div className="relative">
            <FiSearch className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search title, ref, employee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300/80 rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-slate-50 border border-slate-300/80 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 transition-all outline-none"
          >
            <option value="All">Status: All Statuses</option>
            <option value="Pending">Status: Pending Review</option>
            <option value="Signed">Status: Signed & Sealed</option>
            <option value="Rejected">Status: Rejected</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-3 bg-slate-50 border border-slate-300/80 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 transition-all outline-none"
          >
            <option value="All">Category: All Categories</option>
            {DOC_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Urgency Filter */}
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="px-4 py-3 bg-slate-50 border border-slate-300/80 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 transition-all outline-none"
          >
            <option value="All">Priority: All Priorities</option>
            <option value="Normal">Normal Priority</option>
            <option value="Urgent">🔴 Urgent Approval Needed</option>
          </select>
        </div>
      </div>

      {/* ── High Contrast Document Requests Data Table ───────────────────────── */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <FiFileText className="text-blue-600" /> Signature Requests Records ({requests.length})
          </h2>
        </div>

        {isLoading ? (
          <div className="p-16 text-center text-slate-400 space-y-3">
            <span className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin inline-block" />
            <p className="text-xs font-bold text-slate-600">Loading document request records...</p>
          </div>
        ) : requests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-100/80 text-[11px] font-extrabold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-4 px-6 w-64">Ref & Title</th>
                  <th className="py-4 px-6 w-48">Requester</th>
                  <th className="py-4 px-6 w-44">Category</th>
                  <th className="py-4 px-6">Reason for Request</th>
                  <th className="py-4 px-6 w-28">Priority</th>
                  <th className="py-4 px-6 w-40">Status</th>
                  <th className="py-4 px-6 text-right w-44">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {requests.map((req) => (
                  <tr key={req._id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Ref & Title */}
                    <td className="py-4 px-6">
                      <div className="space-y-1">
                        <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-100/70 border border-blue-200 px-2.5 py-0.5 rounded-md inline-block">
                          {req.requestRef}
                        </span>
                        <p className="font-bold text-slate-900 text-sm leading-snug">{req.title}</p>
                        <p className="text-[11px] text-slate-500 font-semibold">{new Date(req.createdAt).toLocaleDateString()}</p>
                      </div>
                    </td>

                    {/* Requester */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                          {req.employeeName ? req.employeeName[0] : 'U'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{req.employeeName}</p>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{req.employeeType}</span>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-4 px-6">
                      <span className="px-3 py-1 bg-slate-100 text-slate-800 rounded-full text-[11px] font-bold border border-slate-200 whitespace-nowrap inline-block">
                        {req.documentType}
                      </span>
                    </td>

                    {/* Reason */}
                    <td className="py-4 px-6">
                      <p className="text-slate-700 text-xs line-clamp-2 font-medium" title={req.reason}>
                        {req.reason}
                      </p>
                    </td>

                    {/* Urgency */}
                    <td className="py-4 px-6">
                      {req.urgency === 'urgent' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100 border border-red-300 px-2.5 py-1 rounded-full animate-pulse whitespace-nowrap">
                          <FiAlertCircle size={12} /> URGENT
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-600">Normal</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      {req.status === 'signed' ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full whitespace-nowrap">
                            <FiCheckCircle size={14} className="text-emerald-700" /> Signed & Sealed
                          </span>
                          {req.signedByName && (
                            <p className="text-[10px] text-slate-500 font-semibold">By {req.signedByName}</p>
                          )}
                        </div>
                      ) : req.status === 'rejected' ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-red-800 bg-red-100 border border-red-300 px-3 py-1 rounded-full whitespace-nowrap">
                          <FiXCircle size={14} className="text-red-700" /> Rejected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-amber-800 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full whitespace-nowrap">
                          <FiClock size={14} className="text-amber-700" /> Pending Review
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      {req.status === 'signed' && req.signedDocUrl ? (
                        <button
                          onClick={() => handleDownloadSignedDoc(req.signedDocUrl, req.requestRef)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 inline-flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <FiDownload size={15} /> Download Signed
                        </button>
                      ) : isManagement && req.status === 'pending' ? (
                        <div className="inline-flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setActiveEditorRequest(req)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 inline-flex items-center gap-1.5 transition-all"
                          >
                            <FiEdit3 size={15} /> Sign & Stamp
                          </button>
                          <button
                            onClick={() => setRejectingRequest(req)}
                            className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl border border-red-200 inline-flex items-center gap-1 transition-all"
                          >
                            <FiX size={15} /> Decline
                          </button>
                        </div>
                      ) : (
                        <a
                          href={mediaUrl(req.originalDocUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 inline-flex items-center gap-1.5"
                        >
                          <FiFileText size={14} /> View Doc
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-16 text-center text-slate-400 space-y-3">
            <FiFileText size={36} className="mx-auto text-slate-300" />
            <p className="text-base font-bold text-slate-700">No document signature requests found</p>
            <p className="text-xs text-slate-500 font-medium">Submit a new request or adjust filters to view documents.</p>
          </div>
        )}
      </div>

      {/* ── Submit Request Modal (Employee) ─────────────────────────────────── */}
      <AnimatePresence>
        {showSubmitModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto border border-slate-200"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FiFileText className="text-blue-600" /> New Document Signature Request
                </h3>
                <button onClick={() => setShowSubmitModal(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl">
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
                    Upload Document (PDF or Image) *
                  </label>
                  <input
                    type="file"
                    required
                    accept=".pdf,image/*"
                    onChange={(e) => setSubmitForm(p => ({ ...p, file: e.target.files?.[0] || null }))}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSubmitModal(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitMut.isPending}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2"
                  >
                    {submitMut.isPending ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Saved Stamps Library Manager Modal (Admin / Owner) ───────────────── */}
      <AnimatePresence>
        {showStampsModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto border border-slate-200"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FiBookmark className="text-blue-600" /> My Stamp Library (අත්සන් හා මුද්‍රා කළමනාකරණය)
                </h3>
                <button onClick={() => setShowStampsModal(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl">
                  <FiX size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                {/* Add New Stamp to Library Form */}
                <form onSubmit={handleAddStampToLibrary} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <FiPlus className="text-blue-600" /> Add New Stamp to Library
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Stamp Title (e.g. Director Sig)"
                      value={newStampForm.title}
                      onChange={(e) => setNewStampForm(p => ({ ...p, title: e.target.value }))}
                      className="px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900"
                    />
                    <select
                      value={newStampForm.type}
                      onChange={(e) => setNewStampForm(p => ({ ...p, type: e.target.value }))}
                      className="px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                    >
                      <option value="signature">Type: Signature ✒️</option>
                      <option value="seal">Type: Company Seal 🏵️</option>
                    </select>
                    <input
                      type="file"
                      required
                      accept="image/*"
                      onChange={(e) => setNewStampForm(p => ({ ...p, file: e.target.files?.[0] || null }))}
                      className="text-[11px] text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 font-bold"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={addStampMut.isPending}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all"
                  >
                    {addStampMut.isPending ? 'Saving...' : 'Save Stamp to Library'}
                  </button>
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
                            <button
                              onClick={() => deleteStampMut.mutate(st._id)}
                              disabled={deleteStampMut.isPending}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                              title="Delete Stamp"
                            >
                              <FiTrash2 size={16} />
                            </button>
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
        )}
      </AnimatePresence>

      {/* ── Reject Modal ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {rejectingRequest && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm">
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
        )}
      </AnimatePresence>

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
