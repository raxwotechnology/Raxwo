import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FiFileText, FiPlus, FiFilter, FiSearch, FiCheckCircle, FiClock, FiXCircle,
  FiDownload, FiEdit3, FiShield, FiUpload, FiAlertCircle, FiUser, FiCalendar, FiCheck, FiX, FiRefreshCw
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

  // Saved Stamps State (Admin / Owner)
  const [stampsState, setStampsState] = useState({
    signatureUrl: '',
    sealUrl: '',
    sigFile: null,
    sealFile: null
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

  // Fetch Saved Admin/Owner Stamps Query
  const { data: stampsData } = useQuery({
    queryKey: ['saved-stamps'],
    queryFn: async () => {
      if (!isManagement) return null
      const res = await api.get('/signature-requests/stamps')
      return res.data
    },
    enabled: isManagement
  })

  const requests = requestsData?.requests || []

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

  // Save Stamps Mutation (Admin / Owner)
  const saveStampsMut = useMutation({
    mutationFn: async (formData) => {
      const res = await api.post('/signature-requests/stamps', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('Signature & Seal stamps saved successfully!')
      setShowStampsModal(false)
      queryClient.invalidateQueries(['saved-stamps'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to save stamps')
    }
  })

  // Reject Request Mutation
  const rejectMut = useMutation({
    mutationFn: async ({ id, rejectionReason }) => {
      const res = await api.put(`/signature-requests/${id}/reject`, { rejectionReason })
      return res.data
    },
    onSuccess: () => {
      toast.success('Request rejected')
      setRejectingRequest(null)
      setRejectionReason('')
      queryClient.invalidateQueries(['signature-requests'])
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to reject request')
    }
  })

  const handleSubmitForm = (e) => {
    e.preventDefault()
    if (!submitForm.title.trim()) return toast.error('Please enter a document title')
    if (!submitForm.reason.trim()) return toast.error('Please specify the reason/purpose for request')
    if (!submitForm.file) return toast.error('Please attach the document file')

    const formData = new FormData()
    formData.append('title', submitForm.title.trim())
    formData.append('documentType', submitForm.documentType)
    formData.append('reason', submitForm.reason.trim())
    formData.append('urgency', submitForm.urgency)
    formData.append('notes', submitForm.notes.trim())
    formData.append('file', submitForm.file)

    submitMut.mutate(formData)
  }

  const handleSaveStamps = (e) => {
    e.preventDefault()
    const formData = new FormData()
    if (stampsState.sigFile) formData.append('signature', stampsState.sigFile)
    if (stampsState.sealFile) formData.append('seal', stampsState.sealFile)

    saveStampsMut.mutate(formData)
  }

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge bg-blue-100 text-blue-700 font-bold uppercase tracking-wider text-[10px]">
              Digital Signature Workflow
            </span>
            <span className="badge bg-slate-100 text-slate-600 font-bold text-[10px]">
              {requests.length} Requests
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 font-heading mt-1">
            Document Signature & Seal Requests
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {isManagement
              ? 'Review, drag & drop signature & seal stamps, and finalize employee document approvals.'
              : 'Submit your internship certificates, NOCs, agreements & letters for official signature & seal.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isManagement && (
            <button
              onClick={() => setShowStampsModal(true)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-2 transition-all"
            >
              <FiShield size={16} className="text-slate-600" /> Manage Signature & Seal
            </button>
          )}

          <button
            onClick={() => setShowSubmitModal(true)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all"
          >
            <FiPlus size={16} /> Request Document Signature
          </button>
        </div>
      </div>

      {/* Filter & Audit Bar (Especially for Admin / Owner) */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <FiFilter size={14} /> Audit Filters & Search
          </h3>
          <button onClick={() => refetch()} className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold">
            <FiRefreshCw size={12} /> Refresh List
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-3 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search title, employee, ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 transition-all"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white transition-all"
          >
            <option value="All">All Categories</option>
            {DOC_TYPES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white transition-all"
          >
            <option value="All">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="signed">Signed</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Urgency Filter */}
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white transition-all"
          >
            <option value="All">All Priorities</option>
            <option value="normal">Normal</option>
            <option value="urgent">Urgent Only</option>
          </select>
        </div>
      </div>

      {/* Main Table / Grid */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">
            <span className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin inline-block mb-2" />
            <p className="text-xs font-semibold">Loading signature requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-16 text-center">
            <FiFileText size={48} className="mx-auto text-slate-300 mb-3" />
            <h4 className="text-base font-bold text-slate-700">No Signature Requests Found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No signature requests match your filters. Click "Request Document Signature" to create one.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-5">Ref & Title</th>
                  <th className="py-3.5 px-4">Requester</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Reason / Purpose</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Status & Signer</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => (
                  <tr key={req._id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Ref & Title */}
                    <td className="py-4 px-5">
                      <span className="font-mono text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block mb-1">
                        {req.requestRef}
                      </span>
                      <h4 className="font-bold text-slate-800 text-sm leading-snug">{req.title}</h4>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <FiCalendar size={10} /> {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </td>

                    {/* Requester */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                          <FiUser size={12} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-700">{req.employeeName || req.requester?.name || 'Employee'}</p>
                          <span className="text-[10px] text-slate-400 capitalize">{req.employeeType || 'Permanent'}</span>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-4 px-4">
                      <span className="badge bg-slate-100 text-slate-700 font-semibold text-[10px]">
                        {req.documentType}
                      </span>
                    </td>

                    {/* Reason */}
                    <td className="py-4 px-4 max-w-xs">
                      <p className="text-slate-600 font-medium truncate" title={req.reason}>
                        {req.reason}
                      </p>
                      {req.notes && (
                        <p className="text-[10px] text-slate-400 italic truncate" title={req.notes}>
                          Note: {req.notes}
                        </p>
                      )}
                    </td>

                    {/* Urgency */}
                    <td className="py-4 px-4">
                      {req.urgency === 'urgent' ? (
                        <span className="badge bg-red-100 text-red-700 font-bold text-[10px] flex items-center gap-1 w-fit">
                          <FiAlertCircle size={10} /> URGENT
                        </span>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-500 font-medium text-[10px]">
                          Normal
                        </span>
                      )}
                    </td>

                    {/* Status & Signer */}
                    <td className="py-4 px-4">
                      {req.status === 'signed' && (
                        <div>
                          <span className="badge bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center gap-1 w-fit mb-1">
                            <FiCheckCircle size={10} /> Signed
                          </span>
                          <p className="text-[10px] text-slate-500">
                            By <strong>{req.signedByName || 'Admin'}</strong> ({req.signedByRole || 'admin'})
                          </p>
                          {req.signedAt && (
                            <p className="text-[9px] text-slate-400">
                              {new Date(req.signedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      )}

                      {req.status === 'pending' && (
                        <span className="badge bg-amber-100 text-amber-700 font-bold text-[10px] flex items-center gap-1 w-fit">
                          <FiClock size={10} /> Pending Review
                        </span>
                      )}

                      {req.status === 'rejected' && (
                        <div>
                          <span className="badge bg-red-100 text-red-700 font-bold text-[10px] flex items-center gap-1 w-fit mb-1">
                            <FiXCircle size={10} /> Rejected
                          </span>
                          <p className="text-[10px] text-red-500 italic max-w-[140px] truncate" title={req.rejectionReason}>
                            {req.rejectionReason}
                          </p>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Download Original Document */}
                        <a
                          href={mediaUrl(req.originalDocUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
                          title="View Original Upload"
                        >
                          <FiFileText size={14} />
                        </a>

                        {/* Signed Document Download */}
                        {req.signedDocUrl && (
                          <a
                            href={mediaUrl(req.signedDocUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1 text-[11px] transition-all shadow-sm"
                          >
                            <FiDownload size={12} /> Download Signed
                          </a>
                        )}

                        {/* Sign & Stamp Action (Admin / Owner) */}
                        {isManagement && req.status === 'pending' && (
                          <>
                            <button
                              onClick={() => setActiveEditorRequest(req)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-1 text-[11px] transition-all shadow-sm"
                            >
                              <FiEdit3 size={12} /> Sign & Stamp
                            </button>
                            <button
                              onClick={() => setRejectingRequest(req)}
                              className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all"
                              title="Reject Request"
                            >
                              <FiX size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Submit Request Modal (Employee / Intern) ─────────────────────────── */}
      <AnimatePresence>
        {showSubmitModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden my-auto border border-slate-100"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FiFileText className="text-blue-600" /> Request Document Signature
                </h3>
                <button onClick={() => setShowSubmitModal(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl">
                  <FiX size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Document Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Internship Completion Certificate"
                    value={submitForm.title}
                    onChange={(e) => setSubmitForm(p => ({ ...p, title: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Category
                    </label>
                    <select
                      value={submitForm.documentType}
                      onChange={(e) => setSubmitForm(p => ({ ...p, documentType: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    >
                      {DOC_TYPES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Priority / Urgency
                    </label>
                    <select
                      value={submitForm.urgency}
                      onChange={(e) => setSubmitForm(p => ({ ...p, urgency: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    >
                      <option value="normal">Normal</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Reason / Purpose for Request (හේතුව) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Explain why you need this document signed (e.g. Bank loan requirement, University internship submission, Visa application)"
                    value={submitForm.reason}
                    onChange={(e) => setSubmitForm(p => ({ ...p, reason: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium resize-none focus:bg-white focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Attach Document File (PDF / Image) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    required
                    accept=".pdf,image/*"
                    onChange={(e) => setSubmitForm(p => ({ ...p, file: e.target.files?.[0] || null }))}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Additional Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Any specific instructions for signature placement"
                    value={submitForm.notes}
                    onChange={(e) => setSubmitForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
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
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2"
                  >
                    {submitMut.isPending ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Saved Signature & Seal Management Modal (Admin / Owner) ──────────── */}
      <AnimatePresence>
        {showStampsModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden my-auto border border-slate-100"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FiShield className="text-blue-600" /> Manage Default Signature & Seal
                </h3>
                <button onClick={() => setShowStampsModal(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl">
                  <FiX size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveStamps} className="p-6 space-y-6">
                {/* Signature Image */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Default Signature Image
                  </label>
                  {stampsData?.signatureUrl && (
                    <div className="w-36 h-20 border border-slate-200 rounded-2xl bg-white p-2 flex items-center justify-center shadow-xs mb-2">
                      <img src={mediaUrl(stampsData.signatureUrl)} alt="Signature" className="max-h-full object-contain" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setStampsState(p => ({ ...p, sigFile: e.target.files?.[0] || null }))}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>

                {/* Company Seal Image */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Default Company Seal Image
                  </label>
                  {stampsData?.sealUrl && (
                    <div className="w-24 h-24 border border-slate-200 rounded-2xl bg-white p-2 flex items-center justify-center shadow-xs mb-2">
                      <img src={mediaUrl(stampsData.sealUrl)} alt="Company Seal" className="max-h-full object-contain" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setStampsState(p => ({ ...p, sealFile: e.target.files?.[0] || null }))}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowStampsModal(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveStampsMut.isPending}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2"
                  >
                    {saveStampsMut.isPending ? 'Saving...' : 'Save Stamps'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Reject Modal ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {rejectingRequest && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-2xl">
              <h3 className="text-base font-bold text-slate-800">Reject Signature Request</h3>
              <p className="text-xs text-slate-500">Specify why this request is being declined:</p>
              <textarea
                rows={3}
                placeholder="Reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none focus:bg-white"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setRejectingRequest(null)} className="px-4 py-2 text-xs font-semibold text-slate-500">
                  Cancel
                </button>
                <button
                  onClick={() => rejectMut.mutate({ id: rejectingRequest._id, rejectionReason })}
                  disabled={rejectMut.isPending}
                  className="px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-xl"
                >
                  {rejectMut.isPending ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Drag & Drop Editor Modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {activeEditorRequest && (
          <DocSignatureEditorModal
            request={activeEditorRequest}
            defaultSignature={stampsData?.signatureUrl}
            defaultSeal={stampsData?.sealUrl}
            onClose={() => setActiveEditorRequest(null)}
            onSuccess={() => refetch()}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
