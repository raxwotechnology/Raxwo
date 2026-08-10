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
  const [deletingRequest, setDeletingRequest] = useState(null)
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

  // Hard Delete Request Mutation (Admin / Owner)
  const deleteRequestMut = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/signature-requests/${id}`)
      return res.data
    },
    onSuccess: () => {
      toast.success('Signature request permanently deleted!')
      setDeletingRequest(null)
      queryClient.invalidateQueries(['signature-requests'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete request')
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

      // If it's a data URI, fix any corrupt leading chars before the magic bytes
      if (fileUrl.startsWith('data:') && fileUrl.includes('base64,')) {
        const commaIdx = fileUrl.indexOf('base64,') + 7
        let b64Content = fileUrl.substring(commaIdx)
        const pdfMagic = b64Content.indexOf('JVBERi')
        const pngMagic = b64Content.indexOf('iVBORw')
        if (pdfMagic > 0) {
          fileUrl = `data:application/pdf;base64,${b64Content.substring(pdfMagic)}`
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
        } else {
          fileUrl = `data:image/png;base64,${content}`
        }
      }
      // Handle /uploads/ paths that are actually base64 (legacy corrupt entries)
      else if (fileUrl.includes('/uploads/') && (fileUrl.includes('==') || fileUrl.includes('iVBORw') || fileUrl.includes('JVBERi') || fileUrl.length > 150)) {
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
    <div className="erp-module space-y-6 animate-fade-in pb-12">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Signature & Seal Requests</h1>
          <p className="page-subtitle">Corporate e-signatures, stamp verification requests, and document approvals</p>
        </div>
        <div className="flex items-center gap-3">
          {isManagement && (
            <button
              type="button"
              onClick={() => setShowStampsModal(true)}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 shadow-xs flex items-center gap-1.5 transition-all"
            >
              <FiBookmark size={14} className="text-blue-600" /> Stamp Library ({savedStamps.length})
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="btn-primary gap-2"
          >
            <FiPlus size={16} /> Submit Document
          </button>
        </div>
      </div>

      {/* ── Main Requests Table Section ─────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest">ISSUED REQUESTS</h2>
          <span className="text-xs text-slate-400 font-medium">{requests.length} on file</span>
        </div>

        {/* ── Simple Inline Search & Filters Bar ────────────────────────────────── */}
        <div className="bg-white rounded-xl p-3 shadow-xs border border-slate-200/80 flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search by name, reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input !pl-9 py-2 text-sm"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-select w-auto py-2 text-sm"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending Review</option>
            <option value="Signed">Signed & Sealed</option>
            <option value="Rejected">Rejected</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="form-select w-auto py-2 text-sm"
          >
            <option value="All">All Categories</option>
            {DOC_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Urgency Filter */}
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="form-select w-auto py-2 text-sm"
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
            className="px-3 py-2 text-sm font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-1.5 transition-colors"
          >
            <FiRefreshCw size={14} /> Reset
          </button>
        </div>

        {/* ── Document Requests Data Table ────────────────────────────────────── */}
        <div className="table-container">
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

                    {/* Requester */}
                    <td>
                      <div className="flex items-center gap-3 min-w-[160px]">
                        <div className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-semibold text-sm flex-shrink-0">
                          {req.employeeName ? req.employeeName.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{req.employeeName}</p>
                          <p className="text-xs text-gray-400 capitalize">{req.employeeType || 'Permanent'}</p>
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
                              onClick={() => setActiveEditorRequest(req)}
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
    </section>

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
                    Upload Document (PDF or Image Recommended) *
                  </label>
                  <input
                    type="file"
                    required
                    accept=".pdf,image/*,.doc,.docx"
                    onChange={(e) => setSubmitForm(p => ({ ...p, file: e.target.files?.[0] || null }))}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="text-[10px] text-slate-500 font-medium mt-1">
                    📌 Recommended format: <span className="font-bold text-slate-700">PDF (.pdf)</span> or <span className="font-bold text-slate-700">Image (.png, .jpg)</span> for interactive digital signing & seal placement.
                  </p>
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

      {/* ── Hard Delete Confirmation Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {deletingRequest && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm">
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

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setDeletingRequest(null)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteRequestMut.mutate(deletingRequest._id)}
                  disabled={deleteRequestMut.isPending}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/20 flex items-center gap-1.5 transition-all"
                >
                  {deleteRequestMut.isPending ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </motion.div>
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
