import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { lookupLoaders } from '../../lib/lookupApi'
import { mediaUrl } from '../../lib/media'
import toast from 'react-hot-toast'
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiFileText,
  FiLink, FiServer, FiAlertCircle, FiDollarSign, FiX, FiList, FiEye, FiExternalLink,
  FiMail, FiMessageSquare, FiUsers, FiCheck
} from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'
import ExportBar from '../../components/ui/ExportBar'
import { useDeleteWithPassword } from '../../components/admin/DeletePasswordGate'

function getReminderState(sub) {
  if (!sub || !sub.nextDueDate) return { isInReminder: false, isOverdue: false, daysUntilDue: 0 }
  const due = new Date(sub.nextDueDate)
  due.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysUntilDue = Math.round((due - today) / 86400000)
  const reminderDays = Number(sub.reminderDaysBefore) || 0
  const isOverdue = (sub.overdueDays > 0) || (daysUntilDue < 0 && sub.remainingBalance > 0)
  const isInReminder = !isOverdue && reminderDays > 0 && daysUntilDue >= 0 && daysUntilDue <= reminderDays && sub.remainingBalance > 0
  return { isInReminder, isOverdue, daysUntilDue }
}

/* ─── Reusable Portal Modal ─────────────────────────────── */
function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-3xl' }) {
  if (!open) return null
  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
      style={{ zIndex: 99999 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} flex flex-col`}
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-lg font-bold font-heading text-primary">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
            <FiX size={18} />
          </button>
        </div>
        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {children}
        </div>
        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  )
}

/* ─── Main Component ────────────────────────────────────── */
export default function AdminSubscriptions() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [showAgreementForm, setShowAgreementForm] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedSub, setSelectedSub] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [analyticsViewMode, setAnalyticsViewMode] = useState('monthly') // 'monthly' | 'overall'
  const [search, setSearch] = useState('')
  const [selectedSubIds, setSelectedSubIds] = useState([])
  const [bulkSending, setBulkSending] = useState(false)
  // Per-payment invoice seal state: { [paymentId]: { sealChecked: bool, sealKey: string } }
  const [invoiceSealState, setInvoiceSealState] = useState({})
  const setSealField = (paymentId, field, value) =>
    setInvoiceSealState(s => ({ ...s, [paymentId]: { ...(s[paymentId] || { sealChecked: true, sealKey: 'main' }), [field]: value } }))
  const getSealState = (paymentId) => invoiceSealState[paymentId] || { sealChecked: true, sealKey: 'main' }

  const { data: branchData } = useQuery({ queryKey: ['branches-list'], queryFn: () => api.get('/branches').then(r => r.data) })
  const branches = branchData?.branches || []

  const emptyForm = {
    client: '', project: '', branch: '', title: '', description: '', subscriptionType: 'custom', customServiceType: '',
    amount: '3000', billingFrequency: 'monthly', billingDay: 1,
    reminderDaysBefore: '5',
    status: 'active', hostingUrl: '', domainName: '', provider: '', expiryDate: '', renewalStatus: 'active',
    paymentMethod: 'cash', bankAccount: '',
    socialMediaLinks: { facebook: '', instagram: '', tiktok: '', youtube: '', linkedin: '', twitter: '' }
  }
  const [form, setForm] = useState(emptyForm)
  const f = (k) => (v) => setForm(p => ({ ...p, [k]: v }))

  const [paymentForm, setPaymentForm] = useState({
    amount: '3000', method: 'cash', bankAccount: '', reference: '', note: '',
    chequeNumber: '', chequeDate: '', chequeBank: '', chequeDrawer: '', date: new Date().toISOString().split('T')[0]
  })
  const [agreementForm, setAgreementForm] = useState({ title: '', type: 'service', validFrom: '', validUntil: '', notes: '', file: null })
  const [viewAgreementUrl, setViewAgreementUrl] = useState(null)

  /* Queries */
  const { data, isLoading } = useQuery({
    queryKey: ['admin-subscriptions', statusFilter, branchFilter],
    queryFn: () => api.get(`/subscriptions?${statusFilter ? `status=${statusFilter}&` : ''}${branchFilter ? `branch=${branchFilter}` : ''}`).then(r => r.data)
  })
  const { data: clientsData } = useQuery({
    queryKey: ['admin-clients-list'],
    queryFn: () => api.get('/auth/users').then(r => r.data)
  })
  const { data: overviewData } = useQuery({
    queryKey: ['admin-billing-overview', branchFilter, selectedMonth, startDate, endDate],
    queryFn: () => {
      const q = new URLSearchParams()
      if (branchFilter) q.append('branch', branchFilter)
      if (selectedMonth && !startDate) q.append('month', selectedMonth)
      if (startDate) q.append('startDate', startDate)
      if (endDate) q.append('endDate', endDate)
      return api.get(`/subscriptions/billing-overview?${q.toString()}`).then(r => r.data)
    }
  })
  const { data: bankData } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => api.get('/bank-accounts').then((r) => r.data),
  })

  const { data: siteRes } = useQuery({
    queryKey: ['site-settings'],
    queryFn: () => api.get('/site-settings').then(r => r.data),
  })
  const siteSettings = siteRes?.settings || {}

  // Build list of seal options from admin settings
  const sealOptions = (() => {
    const opts = []
    if (siteSettings.sealUrl) opts.push({ key: 'main', label: 'Company Seal (main)', url: siteSettings.sealUrl })
    const sigs = siteSettings.signatures || {}
    Object.entries(sigs).forEach(([key, sig]) => {
      if (sig && sig.url) {
        // use sig.label if exists, otherwise capitalize the key
        const displayLabel = sig.label 
          ? `${sig.label} (${key})` 
          : key.charAt(0).toUpperCase() + key.slice(1);
        opts.push({ key, label: displayLabel, url: sig.url })
      }
    })
    return opts
  })()

  const subs = data?.subscriptions || []
  const clients = (clientsData?.users || []).filter(u => u.role === 'client')
  const overview = overviewData?.overview || {}
  const clientSummaries = overview.clientSummaries || []
  const bankAccounts = bankData?.accounts || []

  const toggleSubSelection = (id) => {
    setSelectedSubIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  const toggleClientSelection = (summary) => {
    const ids = summary.subscriptions.map((s) => s._id)
    const allSelected = ids.every((id) => selectedSubIds.includes(id))
    setSelectedSubIds((prev) => (
      allSelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]
    ))
  }
  const [paymentTab, setPaymentTab] = useState('all') // 'all' | 'paid' | 'unpaid' | 'overdue'

  useEffect(() => {
    api.post('/subscriptions/process-overdue').then(() => {
      qc.invalidateQueries({ queryKey: ['admin-subscriptions'] })
      qc.invalidateQueries({ queryKey: ['admin-billing-overview'] })
    }).catch(() => {})
  }, [qc])

  const bulkSend = async (methods) => {
    if (!selectedSubIds.length) return toast.error('Select at least one subscription')
    setBulkSending(true)
    try {
      const res = await api.post('/subscriptions/bulk-send-history', { subscriptionIds: selectedSubIds, methods })
      toast.success(res.data?.message || 'Invoices sent')
      setSelectedSubIds([])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk send failed')
    } finally {
      setBulkSending(false)
    }
  }

  const filteredSubs = subs.filter(s => {
    const matchesSearch =
      s.title?.toLowerCase().includes(search.toLowerCase()) ||
      s.subscriptionNo?.toLowerCase().includes(search.toLowerCase()) ||
      s.client?.name?.toLowerCase().includes(search.toLowerCase())
    if (!matchesSearch) return false

    const hasBalance = (s.remainingBalance || 0) > 0
    const { isOverdue } = getReminderState(s)

    if (paymentTab === 'paid') return !hasBalance
    if (paymentTab === 'unpaid') return hasBalance && !isOverdue
    if (paymentTab === 'overdue') return isOverdue
    return true
  })

  const countPaid = subs.filter(s => (s.remainingBalance || 0) <= 0).length
  const countUnpaid = subs.filter(s => {
    const { isOverdue } = getReminderState(s)
    return (s.remainingBalance || 0) > 0 && !isOverdue
  }).length
  const countOverdue = subs.filter(s => {
    const { isOverdue } = getReminderState(s)
    return isOverdue
  }).length

  /* Mutations */
  const saveMut = useMutation({
    mutationFn: (payload) => {
      if (selectedSub && !payload.isPayment && !payload.isAgreement) {
        if (!selectedSub._id) return Promise.reject(new Error('Invalid subscription'))
        return api.put(`/subscriptions/${selectedSub._id}`, payload).then(r => r.data)
      }
      if (payload.isPayment) {
        if (!selectedSub?._id) return Promise.reject(new Error('Invalid subscription'))
        const body = {
          amount: Number(payload.amount),
          method: payload.method,
          reference: payload.reference || '',
          note: payload.note || '',
          bankAccount: payload.bankAccount || undefined,
          chequeNumber: payload.chequeNumber || '',
          chequeDate: payload.chequeDate || undefined,
          chequeBank: payload.chequeBank || '',
          chequeDrawer: payload.chequeDrawer || '',
          paidAt: payload.date || undefined,
        }
        return api.post(`/subscriptions/${selectedSub._id}/payments`, body).then(r => r.data)
      }
      if (payload.isAgreement) {
        const fd = new FormData()
        Object.keys(payload).forEach(k => fd.append(k, payload[k]))
        return api.post(`/subscriptions/${selectedSub._id}/agreements`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        }).then(r => r.data)
      }
      return api.post('/subscriptions', payload).then(r => r.data)
    },
    onSuccess: (data) => {
      if (data?.subscription && showAgreementForm) {
        // Agreement upload: keep modal open, refresh the selected sub so new agreement shows
        toast.success('Agreement uploaded and synced to CRM ✓')
        setSelectedSub(data.subscription)
        setAgreementForm({ title: '', type: 'service', validFrom: '', validUntil: '', notes: '', file: null })
      } else {
        toast.success('Saved successfully')
        setShowForm(false); setShowPaymentForm(false); setShowAgreementForm(false)
        setSelectedSub(null)
      }
      qc.invalidateQueries({ queryKey: ['admin-subscriptions'] })
      qc.invalidateQueries({ queryKey: ['admin-billing-overview'] })
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
      qc.invalidateQueries({ queryKey: ['finance-overview'] })
      qc.invalidateQueries({ queryKey: ['finance-entries-category'] })
      qc.invalidateQueries({ queryKey: ['finance-pl'] })
      qc.invalidateQueries({ queryKey: ['finance-entries'] })
      qc.invalidateQueries({ queryKey: ['admin-subscription-invoices'] })
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed')
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/subscriptions/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['admin-subscriptions'] }) },
  })
  const { requestDelete: requestDeleteSub, DeletePasswordModal: subDeleteModal } = useDeleteWithPassword(deleteMut, {
    title: 'Delete subscription',
    message: 'Enter your admin password to permanently delete this subscription.',
  })

  const processOverdueMut = useMutation({
    mutationFn: () => api.post('/subscriptions/process-overdue').then(r => r.data),
    onSuccess: (d) => {
      toast.success(d.message || 'Overdue processed')
      qc.invalidateQueries({ queryKey: ['admin-subscriptions'] })
      qc.invalidateQueries({ queryKey: ['admin-billing-overview'] })
    }
  })

  /* Handlers */
  const openNew = () => { setSelectedSub(null); setForm(emptyForm); setShowForm(true) }
  const openEdit = (sub) => {
    setSelectedSub(sub)
    setForm({
      client: sub.client?._id || sub.client || '', 
      project: sub.project?._id || sub.project || '', 
      branch: sub.branch?._id || sub.branch || '',
      title: sub.title, description: sub.description || '',
      subscriptionType: sub.subscriptionType, customServiceType: sub.customServiceType || '', amount: sub.amount,
      billingFrequency: sub.billingFrequency, billingDay: sub.billingDay,
      reminderDaysBefore: sub.reminderDaysBefore != null ? String(sub.reminderDaysBefore) : '',
      status: sub.status,
      hostingUrl: sub.hostingDetails?.hostingUrl || '',
      domainName: sub.hostingDetails?.domainName || '',
      provider: sub.hostingDetails?.provider || '',
      expiryDate: sub.hostingDetails?.expiryDate ? new Date(sub.hostingDetails.expiryDate).toISOString().split('T')[0] : '',
      renewalStatus: sub.hostingDetails?.renewalStatus || 'active',
      socialMediaLinks: {
        facebook: sub.socialMediaLinks?.facebook || '',
        instagram: sub.socialMediaLinks?.instagram || '',
        tiktok: sub.socialMediaLinks?.tiktok || '',
        youtube: sub.socialMediaLinks?.youtube || '',
        linkedin: sub.socialMediaLinks?.linkedin || '',
        twitter: sub.socialMediaLinks?.twitter || '',
      }
    })
    setShowForm(true)
  }
  const openPayment = (sub) => {
    setSelectedSub(sub)
    setPaymentForm({
      amount: sub.remainingBalance || 0,
      method: 'cash',
      bankAccount: '',
      reference: '',
      note: '',
      chequeNumber: '',
      chequeDate: '',
      chequeBank: '',
      chequeDrawer: '',
      date: new Date().toISOString().split('T')[0]
    })
    setShowPaymentForm(true)
  }
  const openAgreement = async (sub) => {
    // Fetch fresh data so we get the latest agreements list
    try {
      const { data: fresh } = await api.get(`/subscriptions/${sub._id}`)
      setSelectedSub(fresh?.subscription || sub)
    } catch {
      setSelectedSub(sub)
    }
    setAgreementForm({ title: '', type: 'service', validFrom: '', validUntil: '', notes: '', file: null })
    setShowAgreementForm(true)
  }

  const handleSave = () => {
    const payload = { ...form }
    if (!payload.project) payload.project = null
    if (!payload.branch) payload.branch = null
    if (payload.subscriptionType !== 'custom') payload.customServiceType = ''
    if (!payload.subscriptionType.startsWith('social_media')) {
      delete payload.socialMediaLinks
    }
    
    payload.amount = Number(payload.amount) || 0
    payload.billingDay = Number(payload.billingDay) || 1
    const rd = form.reminderDaysBefore === '' || form.reminderDaysBefore == null
      ? null
      : Number(form.reminderDaysBefore)
    payload.reminderDaysBefore = Number.isFinite(rd) && rd > 0 ? rd : null
    payload.hostingDetails = {
      domainName: form.domainName, provider: form.provider,
      hostingUrl: form.hostingUrl, expiryDate: form.expiryDate || null,
      renewalStatus: form.renewalStatus
    }
    if (selectedSub) {
      delete payload.paymentMethod
      delete payload.bankAccount
    }
    saveMut.mutate(payload)
  }

  const showHosting = ['hosting_domain', 'website_maintenance', 'custom'].includes(form.subscriptionType)
  const showSocialMedia = form.subscriptionType.startsWith('social_media')

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Subscription Management</h1>
          <p className="page-subtitle">Manage client subscriptions, billing, hosting &amp; agreements.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ExportBar
            data={filteredSubs}
            columns={[
              { header: 'Subscription No', accessor: 'subscriptionNo' },
              { header: 'Title', accessor: 'title' },
              { header: 'Client', accessor: (s) => s.client?.name || 'Unknown' },
              { header: 'Type', accessor: (s) => s.typeLabel?.toUpperCase() },
              { header: 'Status', accessor: (s) => s.status?.toUpperCase() },
              { header: 'Billing', accessor: (s) => `${s.billingFrequency} (LKR ${s.amount?.toLocaleString()})` },
              { header: 'Next Due Date', accessor: (s) => s.nextDueDate ? new Date(s.nextDueDate).toLocaleDateString() : 'N/A' },
            ]}
            title="Subscriptions Report"
            filters={{ Status: statusFilter, Branch: branches.find(b => b._id === branchFilter)?.name }}
          />
          <button 
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-all shadow-sm
              ${processOverdueMut.isPending 
                ? 'bg-amber-100 border-amber-200 text-amber-500 cursor-not-allowed' 
                : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300'
              }`}
            onClick={() => processOverdueMut.mutate()} 
            disabled={processOverdueMut.isPending}
          >
            {processOverdueMut.isPending ? (
              <div className="w-3.5 h-3.5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
            ) : (
              <FiAlertCircle size={14} className="text-amber-600" />
            )}
            <span>{processOverdueMut.isPending ? 'Processing...' : 'Process Overdue'}</span>
          </button>
          <button className="btn-primary btn-sm" onClick={openNew}>
            <FiPlus size={14} /> New Subscription
          </button>
        </div>
      </div>

      {/* Date Range & Monthly Filter Control Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${analyticsViewMode === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            onClick={() => setAnalyticsViewMode('monthly')}
          >
            Monthly Filtered View
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${analyticsViewMode === 'overall' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            onClick={() => setAnalyticsViewMode('overall')}
          >
            Overall Totals View
          </button>
        </div>

        {/* Date / Month Picker Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Month:</span>
            <input
              type="month"
              className="form-select !py-1 !px-2 text-xs w-36 font-semibold"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value)
                setStartDate('')
                setEndDate('')
              }}
            />
          </div>

          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <span className="text-xs font-semibold text-slate-500">Range:</span>
            <input
              type="date"
              className="form-input !py-1 !px-2 text-xs w-32 font-medium"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Start"
            />
            <span className="text-slate-400 text-xs">–</span>
            <input
              type="date"
              className="form-input !py-1 !px-2 text-xs w-32 font-medium"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="End"
            />
          </div>

          {(startDate || endDate || selectedMonth !== new Date().toISOString().slice(0, 7)) && (
            <button
              type="button"
              className="text-xs font-bold text-slate-400 hover:text-slate-600 underline ml-1"
              onClick={() => {
                setSelectedMonth(new Date().toISOString().slice(0, 7))
                setStartDate('')
                setEndDate('')
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards — Categorized Figures */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {analyticsViewMode === 'monthly' ? (
          [
            { label: 'Monthly Collected', value: `LKR ${(overview.monthlyCollected || 0).toLocaleString()}`, cls: 'kpi-green', sub: selectedMonth ? `Month: ${selectedMonth}` : 'Current Month' },
            { label: 'Pending Payments', value: `LKR ${(overview.pendingPayments || 0).toLocaleString()}`, cls: 'kpi-blue', sub: 'Expected Balance' },
            { label: 'Overdue Payments', value: `LKR ${(overview.overduePayments || 0).toLocaleString()}`, cls: 'kpi-red', sub: 'Past Due Date' },
            { label: 'Total Collected', value: `LKR ${(overview.totalCollected || 0).toLocaleString()}`, cls: 'kpi-navy', sub: 'Overall Revenue' },
          ].map(({ label, value, cls, sub }) => (
            <div key={label} className={`kpi-card ${cls}`}>
              <p className="text-xs uppercase text-slate-500 font-medium">{label}</p>
              <p className="text-2xl font-bold text-primary mt-1">{value}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">{sub}</p>
            </div>
          ))
        ) : (
          [
            { label: 'Monthly MRR', value: `LKR ${(overview.totalMRR || 0).toLocaleString()}`, cls: 'kpi-blue', sub: 'Monthly Recurring' },
            { label: 'Total Overdue', value: `LKR ${(overview.totalOverdue || 0).toLocaleString()}`, cls: 'kpi-red', sub: 'All Outstanding' },
            { label: 'Total Collected', value: `LKR ${(overview.totalCollected || 0).toLocaleString()}`, cls: 'kpi-green', sub: 'All-time Income' },
            { label: 'Active Subs', value: overview.activeCount || 0, cls: 'kpi-navy', sub: 'Active Contracts' },
          ].map(({ label, value, cls, sub }) => (
            <div key={label} className={`kpi-card ${cls}`}>
              <p className="text-xs uppercase text-slate-500 font-medium">{label}</p>
              <p className="text-2xl font-bold text-primary mt-1">{value}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">{sub}</p>
            </div>
          ))
        )}
      </div>

      {/* Client Payment Summaries — Premium Redesign */}
      {clientSummaries.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid rgba(148,163,184,0.18)' }}>
          {/* Header */}
          <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-4" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                <FiUsers className="text-white" size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Client Payment Summaries</h3>
                <p className="text-xs text-slate-300 mt-0.5">Select subscriptions and send payment history via email or SMS</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-200"
                style={{ background: 'rgba(255,255,255,0.1)', color: '#e2e8f0', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}
                disabled={!selectedSubIds.length || bulkSending}
                onClick={() => bulkSend(['email'])}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
              >
                <FiMail size={13} /> Email ({selectedSubIds.length})
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-200"
                style={{ background: 'rgba(255,255,255,0.1)', color: '#e2e8f0', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}
                disabled={!selectedSubIds.length || bulkSending}
                onClick={() => bulkSend(['sms'])}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
              >
                <FiMessageSquare size={13} /> SMS
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-all duration-200"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }}
                disabled={!selectedSubIds.length || bulkSending}
                onClick={() => bulkSend(['email', 'sms'])}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(99,102,241,0.45)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.35)' }}
              >
                Email + SMS
              </button>
            </div>
          </div>

          {/* Client Cards */}
          <div className="p-4 grid gap-3 max-h-[480px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {clientSummaries.map((cs) => {
              const ids = cs.subscriptions.map((s) => s._id)
              const allSelected = ids.length > 0 && ids.every((id) => selectedSubIds.includes(id))
              const someSelected = ids.some((id) => selectedSubIds.includes(id))
              const paidPct = cs.totalDue > 0 ? Math.min(100, Math.round((cs.totalPaid / cs.totalDue) * 100)) : 0
              const initials = (cs.client?.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
              const hasOverdue = cs.overdueAmount > 0

              return (
                <motion.div
                  key={cs.client?._id || cs.client?.email}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-xl overflow-hidden transition-all duration-200"
                  style={{
                    background: '#fff',
                    border: hasOverdue ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(148,163,184,0.15)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)'; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  {/* Client Header Row */}
                  <div className="p-4 flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded-md accent-indigo-500 cursor-pointer shrink-0"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
                      onChange={() => toggleClientSelection(cs)}
                    />
                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold text-white"
                      style={{ background: hasOverdue ? 'linear-gradient(135deg, #ef4444, #f97316)' : 'linear-gradient(135deg, #6366f1, #06b6d4)' }}
                    >
                      {initials}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-800 text-sm leading-tight">{cs.client?.name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">{cs.client?.email}</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs shrink-0">
                          <div className="text-right">
                            <p className="text-slate-400 text-[10px] uppercase tracking-wider font-medium">Collected</p>
                            <p className="font-bold text-emerald-600">LKR {Number(cs.totalPaid || 0).toLocaleString()}</p>
                          </div>
                          {hasOverdue && (
                            <div className="text-right">
                              <p className="text-slate-400 text-[10px] uppercase tracking-wider font-medium">Overdue</p>
                              <p className="font-bold text-red-500">LKR {Number(cs.overdueAmount).toLocaleString()}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Progress Bar */}
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${paidPct}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className="h-full rounded-full"
                            style={{ background: paidPct >= 100 ? 'linear-gradient(90deg, #10b981, #059669)' : paidPct >= 50 ? 'linear-gradient(90deg, #6366f1, #8b5cf6)' : 'linear-gradient(90deg, #f59e0b, #ef4444)' }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400 shrink-0 w-8 text-right">{paidPct}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Subscription Items */}
                  <div className="px-4 pb-3 space-y-1.5" style={{ marginLeft: '3.25rem' }}>
                    {cs.subscriptions.map((s) => (
                      <div
                        key={s._id}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors duration-150"
                        style={{ background: selectedSubIds.includes(s._id) ? 'rgba(99,102,241,0.06)' : 'rgba(248,250,252,0.8)' }}
                        onMouseEnter={e => { if (!selectedSubIds.includes(s._id)) e.currentTarget.style.background = 'rgba(241,245,249,1)' }}
                        onMouseLeave={e => { if (!selectedSubIds.includes(s._id)) e.currentTarget.style.background = 'rgba(248,250,252,0.8)' }}
                      >
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer shrink-0"
                          checked={selectedSubIds.includes(s._id)}
                          onChange={() => toggleSubSelection(s._id)}
                        />
                        <span className="font-medium text-slate-700 text-sm truncate flex-1">{s.title}</span>
                        <span className="text-xs font-semibold text-slate-500 shrink-0">LKR {Number(s.amount || 0).toLocaleString()}</span>
                        {s.overdueDays > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold shrink-0"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}
                          >
                            <FiAlertCircle size={9} /> {s.overdueDays}d
                          </span>
                        )}
                        <span
                          className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide shrink-0"
                          style={{
                            background: s.status === 'overdue' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                            color: s.status === 'overdue' ? '#dc2626' : '#059669',
                          }}
                        >
                          {s.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* Table & Filtering */}
      <div className="card">
        {/* Payment Status Category Tabs */}
        <div className="px-4 pt-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 bg-slate-50/50">
          <div className="flex items-center gap-1.5 bg-slate-200/60 p-1 rounded-xl flex-wrap">
            <button
              type="button"
              onClick={() => setPaymentTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${paymentTab === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All ({subs.length})
            </button>
            <button
              type="button"
              onClick={() => setPaymentTab('paid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${paymentTab === 'paid' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:bg-emerald-50'}`}
            >
              <FiCheck size={13} /> Paid ({countPaid})
            </button>
            <button
              type="button"
              onClick={() => setPaymentTab('unpaid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${paymentTab === 'unpaid' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-700 hover:bg-amber-50'}`}
            >
              <FiAlertCircle size={13} /> Pending / Unpaid ({countUnpaid})
            </button>
            <button
              type="button"
              onClick={() => setPaymentTab('overdue')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${paymentTab === 'overdue' ? 'bg-red-600 text-white shadow-sm' : 'text-red-700 hover:bg-red-50'}`}
            >
              <FiAlertCircle size={13} /> Overdue ({countOverdue})
            </button>
          </div>

          <div className="text-xs font-medium text-slate-500">
            Showing <strong className="text-slate-800">{filteredSubs.length}</strong> subscription(s)
          </div>
        </div>

        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" placeholder="Search by title, client, or number…" className="form-input !pl-10 w-full" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select w-full sm:w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="overdue">Overdue</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select className="form-select w-full sm:w-40" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
            <option value="">All Branches</option>
            {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        </div>

        {/* Mobile View */}
        <div className="sm:hidden space-y-4 p-4">
          {isLoading && <div className="text-center py-10"><div className="w-6 h-6 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto" /></div>}
          {!isLoading && filteredSubs.map(s => {
            const { isInReminder, isOverdue, daysUntilDue } = getReminderState(s)
            const hasBalance = (s.remainingBalance || 0) > 0

            return (
              <div key={s._id} className={`bg-white rounded-2xl border shadow-sm p-4 space-y-3 ${isOverdue ? 'border-red-300 bg-red-50/20' : isInReminder ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="badge badge-navy font-mono text-[10px] tracking-tight">{s.subscriptionNo}</span>
                    <p className="font-bold text-slate-800 mt-1 truncate">{s.title}</p>
                    <p className="text-xs text-slate-500 truncate">{s.client?.name}</p>
                  </div>
                  <div className="flex flex-col items-end shrink-0 gap-1">
                    <span className={`badge capitalize text-[10px] px-2 py-0.5 ${s.status === 'active' ? 'badge-green' : s.status === 'overdue' ? 'badge-red' : 'badge-gray'}`}>{s.status}</span>
                    {isOverdue && <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-md">{s.overdueDays || 1}d overdue</span>}
                    {isInReminder && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md">Due in {daysUntilDue}d</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Amount</p>
                    <p className="font-semibold text-slate-800">LKR {s.amount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Frequency</p>
                    <p className="font-medium text-slate-700 capitalize">{s.billingFrequency === 'monthly' ? 'Monthly' : s.billingFrequency}</p>
                  </div>
                  <div className="col-span-2 flex items-center justify-between border-t border-slate-200/60 pt-2 mt-1">
                     <p className="text-[11px] text-slate-500 font-medium">Due: <span className="font-bold text-slate-700">{new Date(s.nextDueDate).toLocaleDateString()}</span></p>
                     {hasBalance ? (
                       <p className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isOverdue ? 'text-red-700 bg-red-100' : isInReminder ? 'text-red-600 bg-red-50 border border-red-200' : 'text-red-500 bg-red-50'}`}>
                         Bal: LKR {s.remainingBalance?.toLocaleString()}
                       </p>
                     ) : (
                       <p className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                         <FiCheck size={10} /> Paid
                       </p>
                     )}
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button onClick={() => { setSelectedSub(s); setShowViewModal(true); }} className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors">
                    <FiEye size={16} />
                    <span className="text-[10px] font-semibold">View</span>
                  </button>
                  <button onClick={() => openPayment(s)} className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors">
                    <FiDollarSign size={16} />
                    <span className="text-[10px] font-semibold">Pay</span>
                  </button>
                  <button onClick={() => { setSelectedSub(s); setShowHistoryModal(true); }} className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors">
                    <FiList size={16} />
                    <span className="text-[10px] font-semibold">Logs</span>
                  </button>
                  <button onClick={() => openAgreement(s)} className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors">
                    <FiFileText size={16} />
                    <span className="text-[10px] font-semibold">Docs</span>
                  </button>
                  <button onClick={() => openEdit(s)} className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors">
                    <FiEdit2 size={16} />
                    <span className="text-[10px] font-semibold">Edit</span>
                  </button>
                  <button type="button" onClick={() => requestDeleteSub(s._id)} className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 transition-colors">
                    <FiTrash2 size={16} />
                    <span className="text-[10px] font-semibold">Delete</span>
                  </button>
                </div>
              </div>
            )
          })}
          {!isLoading && filteredSubs.length === 0 && <div className="text-center py-8 text-slate-400 text-sm font-medium">No subscriptions found.</div>}
        </div>

        <div className="hidden sm:block table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Subscription</th>
                <th>Client</th>
                <th>Billing</th>
                <th>Status</th>
                <th>Hosting / Domain</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan="6" className="text-center py-10"><div className="w-6 h-6 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto" /></td></tr>
              )}
              {!isLoading && filteredSubs.map(s => {
                const { isInReminder, isOverdue, daysUntilDue } = getReminderState(s)
                const hasBalance = (s.remainingBalance || 0) > 0

                return (
                  <tr key={s._id} className={isOverdue ? 'bg-red-50/20' : isInReminder ? 'bg-amber-50/20' : ''}>
                    <td>
                      <p className="font-semibold text-slate-800">{s.title}</p>
                      <p className="text-xs text-slate-400">{s.subscriptionNo} · {s.typeLabel}</p>
                      {s.project && <p className="text-xs text-blue-500 mt-0.5 flex items-center gap-1"><FiLink size={10} />{s.project.title}</p>}
                    </td>
                    <td>
                      <p className="font-medium text-slate-800">{s.client?.name}</p>
                      <p className="text-xs text-slate-400">{s.client?.email}</p>
                    </td>
                    <td>
                      <p className="font-medium text-slate-800">LKR {s.amount?.toLocaleString()}<span className="text-slate-400 text-xs">/{s.billingFrequency === 'monthly' ? 'mo' : s.billingFrequency}</span></p>
                      {hasBalance ? (
                        <p className={`text-xs font-bold mt-0.5 inline-flex items-center gap-1 ${isOverdue ? 'text-red-600' : isInReminder ? 'text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200' : 'text-red-500'}`}>
                          Bal: LKR {s.remainingBalance?.toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-xs font-semibold text-emerald-600 mt-0.5 flex items-center gap-1"><FiCheck size={12} /> Paid</p>
                      )}
                      <p className="text-xs text-slate-400">Due: {new Date(s.nextDueDate).toLocaleDateString()}</p>
                    </td>
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        <span className={`badge ${s.status === 'active' ? 'badge-green' : s.status === 'overdue' ? 'badge-red' : 'badge-gray'}`}>{s.status}</span>
                        {isOverdue && <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">{s.overdueDays || 1}d overdue</span>}
                        {isInReminder && (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <FiAlertCircle size={10} /> Due in {daysUntilDue}d
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {s.hostingDetails?.domainName
                        ? <div><p className="text-sm font-medium">{s.hostingDetails.domainName}</p>{s.hostingDetails.expiryDate && <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><FiServer size={10} />Exp: {new Date(s.hostingDetails.expiryDate).toLocaleDateString()}</p>}</div>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setSelectedSub(s); setShowViewModal(true); }} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" title="View"><FiEye size={14} /></button>
                        <button onClick={() => openPayment(s)} className="p-1.5 rounded-lg text-green-500 hover:bg-green-50" title="Record Payment"><FiDollarSign size={14} /></button>
                        <button onClick={() => { setSelectedSub(s); setShowHistoryModal(true); }} className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50" title="Payment History"><FiList size={14} /></button>
                        <button onClick={() => openAgreement(s)} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50" title="Add Agreement"><FiFileText size={14} /></button>
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" title="Edit"><FiEdit2 size={14} /></button>
                        <button type="button" onClick={() => requestDeleteSub(s._id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500" title="Delete"><FiTrash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!isLoading && filteredSubs.length === 0 && (
                <tr><td colSpan="6" className="text-center py-12 text-slate-400">No subscriptions found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── New / Edit Subscription Modal ── */}
      <AnimatePresence>
        <Modal open={showForm} onClose={() => setShowForm(false)} title={selectedSub ? 'Edit Subscription' : 'New Subscription'}
          footer={<>
            <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn-primary btn-sm" disabled={saveMut.isPending} onClick={handleSave}>
              {saveMut.isPending ? 'Saving…' : 'Save Subscription'}
            </button>
          </>}
        >
          <div className="space-y-5">
            {/* Basic Info */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Client *</label>
                <SearchableSelect
                  value={form.client}
                  onChange={(v) => f('client')(v)}
                  loadOptions={lookupLoaders.clients()}
                  placeholder="Search client…"
                  initialLabel={selectedSub?.client?.name || ''}
                />
                {clients.length === 0 && <p className="text-xs text-amber-500 mt-1">No client accounts found. Create a client first.</p>}
              </div>
              <div>
                <label className="form-label">Branch (Optional)</label>
                <select className="form-select" value={form.branch} onChange={e => f('branch')(e.target.value)}>
                  <option value="">No Branch</option>
                  {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Service Type *</label>
                <select className="form-select" value={form.subscriptionType} onChange={e => f('subscriptionType')(e.target.value)}>
                  <option value="website_maintenance">Website Maintenance</option>
                  <option value="app_maintenance">App Maintenance</option>
                  <option value="hosting_domain">Hosting &amp; Domain</option>
                  <option value="social_media_facebook">Facebook Management</option>
                  <option value="social_media_instagram">Instagram Management</option>
                  <option value="social_media_tiktok">TikTok Marketing</option>
                  <option value="social_media_management">Social Media Management</option>
                  <option value="content_management">Content Management</option>
                  <option value="technical_support">Technical Support</option>
                  <option value="bug_fixing">Bug Fixing</option>
                  <option value="seo_marketing">SEO &amp; Marketing</option>
                  <option value="custom">Custom Service</option>
                </select>
              </div>
              {form.subscriptionType === 'custom' && (
                <div>
                  <label className="form-label">Custom Service Type *</label>
                  <input type="text" className="form-input" value={form.customServiceType} onChange={e => f('customServiceType')(e.target.value)} placeholder="e.g. Graphic Design" />
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="form-label">Subscription Title *</label>
                <input type="text" className="form-input" value={form.title} onChange={e => f('title')(e.target.value)} placeholder="e.g. Monthly Website Maintenance – Raxwo Client" />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Description</label>
                <textarea className="form-input" rows="2" value={form.description} onChange={e => f('description')(e.target.value)} placeholder="What does this subscription cover?" />
              </div>
            </div>

            {/* Billing */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2"><FiDollarSign size={12} />Billing Details</p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="form-label flex items-center justify-between">
                    <span>Monthly Amount (LKR) *</span>
                    <button
                      type="button"
                      onClick={() => {
                        const presets = [3000, 5000, 10000]
                        const cur = Number(form.amount) || 0
                        const idx = presets.indexOf(cur)
                        const nextVal = idx >= 0 && idx < presets.length - 1 ? presets[idx + 1] : presets[0]
                        f('amount')(String(nextVal))
                      }}
                      className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded transition-colors"
                      title="Click to auto-fill default amount (3,000 / 5,000 / 10,000 LKR)"
                    >
                      <FiDollarSign size={11} /> Auto-fill
                    </button>
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        const presets = [3000, 5000, 10000]
                        const cur = Number(form.amount) || 0
                        const idx = presets.indexOf(cur)
                        const nextVal = idx >= 0 && idx < presets.length - 1 ? presets[idx + 1] : presets[0]
                        f('amount')(String(nextVal))
                      }}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors p-1 rounded hover:bg-slate-100"
                      title="Click Dollar mark to auto-fill default amount"
                    >
                      <FiDollarSign size={15} />
                    </button>
                    <input
                      type="number"
                      className="form-input !pl-8"
                      value={form.amount}
                      onChange={e => f('amount')(e.target.value)}
                      min="0"
                      placeholder="3000"
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label">Billing Frequency</label>
                  <select className="form-select" value={form.billingFrequency} onChange={e => f('billingFrequency')(e.target.value)}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="semi_annual">Semi-Annual</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Billing Day (1–31)</label>
                  <input type="number" className="form-input" value={form.billingDay} onChange={e => f('billingDay')(e.target.value)} min="1" max="31" />
                </div>
                <div>
                  <label className="form-label">Reminder (days before due)</label>
                  <input type="number" className="form-input" value={form.reminderDaysBefore} onChange={e => f('reminderDaysBefore')(e.target.value)} min="0" max="90" placeholder="e.g. 5" />
                  <p className="text-[11px] text-slate-500 mt-1">Admins get a notification on that day. Leave empty to disable.</p>
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={e => f('status')(e.target.value)}>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="overdue">Overdue</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {form.billingDay && form.reminderDaysBefore && Number(form.reminderDaysBefore) > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5 mt-3 shadow-xs">
                  <FiAlertCircle className="shrink-0 text-amber-600 mt-0.5" size={16} />
                  <div>
                    <p className="font-bold text-amber-900">Billing &amp; Visual Alert Active</p>
                    <p className="mt-0.5 text-amber-800 leading-relaxed">
                      Due date is set to day <strong>{form.billingDay}</strong> of each cycle. System will trigger a visual highlight and notification alert <strong>{form.reminderDaysBefore} days</strong> before due (around day <strong>{Math.max(1, Number(form.billingDay) - Number(form.reminderDaysBefore))}</strong> of the month).
                    </p>
                  </div>
                </div>
              )}
              
              {/* Payment Info for New Subscription */}
              {!selectedSub && (
                <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                  <div>
                    <label className="form-label">Initial Payment Method</label>
                    <select className="form-select" value={form.paymentMethod} onChange={e => f('paymentMethod')(e.target.value)}>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="cheque">Cheque</option>
                      <option value="online_transfer">Online transfer</option>
                      <option value="payhere">PayHere</option>
                      <option value="manual">Other / manual</option>
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">This will record the first payment automatically.</p>
                  </div>
                  {['bank_transfer', 'payhere', 'card', 'online_transfer'].includes(form.paymentMethod) && (
                    <div>
                      <label className="form-label">Bank account (money received to)</label>
                      <select className="form-select" value={form.bankAccount} onChange={(e) => f('bankAccount')(e.target.value)}>
                        <option value="">Select bank account…</option>
                        {bankAccounts.map((b) => (
                          <option key={b._id} value={b._id}>{b.bankName} ({b.accountNumber})</option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-500 mt-1">Updates account balance automatically.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hosting (conditional) */}
            {showHosting && (
              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-2"><FiServer size={12} />Hosting &amp; Domain (Optional)</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Domain Name</label>
                    <input type="text" className="form-input" value={form.domainName} onChange={e => f('domainName')(e.target.value)} placeholder="example.com" />
                  </div>
                  <div>
                    <label className="form-label">Hosting Provider</label>
                    <input type="text" className="form-input" value={form.provider} onChange={e => f('provider')(e.target.value)} placeholder="AWS, Hostinger…" />
                  </div>
                  <div>
                    <label className="form-label">cPanel / Login URL</label>
                    <input type="url" className="form-input" value={form.hostingUrl} onChange={e => f('hostingUrl')(e.target.value)} placeholder="https://…" />
                  </div>
                  <div>
                    <label className="form-label">Expiry Date</label>
                    <input type="date" className="form-input" value={form.expiryDate} onChange={e => f('expiryDate')(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* Social Media Links (conditional) */}
            {showSocialMedia && (
              <div className="bg-pink-50/60 border border-pink-100 rounded-xl p-4 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-pink-700 flex items-center gap-2">Social Media Links</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Facebook URL</label>
                    <input type="url" className="form-input" value={form.socialMediaLinks.facebook} onChange={e => setForm(p => ({ ...p, socialMediaLinks: { ...p.socialMediaLinks, facebook: e.target.value } }))} placeholder="https://facebook.com/..." />
                  </div>
                  <div>
                    <label className="form-label">Instagram URL</label>
                    <input type="url" className="form-input" value={form.socialMediaLinks.instagram} onChange={e => setForm(p => ({ ...p, socialMediaLinks: { ...p.socialMediaLinks, instagram: e.target.value } }))} placeholder="https://instagram.com/..." />
                  </div>
                  <div>
                    <label className="form-label">TikTok URL</label>
                    <input type="url" className="form-input" value={form.socialMediaLinks.tiktok} onChange={e => setForm(p => ({ ...p, socialMediaLinks: { ...p.socialMediaLinks, tiktok: e.target.value } }))} placeholder="https://tiktok.com/@..." />
                  </div>
                  <div>
                    <label className="form-label">YouTube URL</label>
                    <input type="url" className="form-input" value={form.socialMediaLinks.youtube} onChange={e => setForm(p => ({ ...p, socialMediaLinks: { ...p.socialMediaLinks, youtube: e.target.value } }))} placeholder="https://youtube.com/..." />
                  </div>
                  <div>
                    <label className="form-label">LinkedIn URL</label>
                    <input type="url" className="form-input" value={form.socialMediaLinks.linkedin} onChange={e => setForm(p => ({ ...p, socialMediaLinks: { ...p.socialMediaLinks, linkedin: e.target.value } }))} placeholder="https://linkedin.com/in/..." />
                  </div>
                  <div>
                    <label className="form-label">Twitter/X URL</label>
                    <input type="url" className="form-input" value={form.socialMediaLinks.twitter} onChange={e => setForm(p => ({ ...p, socialMediaLinks: { ...p.socialMediaLinks, twitter: e.target.value } }))} placeholder="https://x.com/..." />
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      </AnimatePresence>

      {/* ── Record Payment Modal ── */}
      <AnimatePresence>
        <Modal open={showPaymentForm} onClose={() => setShowPaymentForm(false)} title="Record Payment" maxWidth="max-w-md"
          footer={<>
            <button className="btn-secondary btn-sm" onClick={() => setShowPaymentForm(false)}>Cancel</button>
            <button className="btn-success btn-sm" disabled={saveMut.isPending} onClick={() => saveMut.mutate({ isPayment: true, ...paymentForm })}>
              {saveMut.isPending ? 'Saving…' : 'Record Payment'}
            </button>
          </>}
        >
          {selectedSub && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-1">
                <p className="text-slate-500">Subscription: <span className="font-semibold text-slate-800">{selectedSub.title}</span></p>
                <p className="text-slate-500">Remaining Balance: <span className="font-bold text-red-500">LKR {selectedSub.remainingBalance?.toLocaleString()}</span></p>
              </div>
              <div>
                <label className="form-label flex items-center justify-between">
                  <span>Payment Amount (LKR) *</span>
                  <button
                    type="button"
                    onClick={() => {
                      const def = selectedSub?.remainingBalance || 3000
                      setPaymentForm(p => ({ ...p, amount: String(def) }))
                    }}
                    className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded transition-colors"
                    title="Click to auto-fill amount"
                  >
                    <FiDollarSign size={11} /> Auto-fill
                  </button>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      const def = selectedSub?.remainingBalance || 3000
                      setPaymentForm(p => ({ ...p, amount: String(def) }))
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors p-1 rounded hover:bg-slate-100"
                    title="Click Dollar mark to auto-fill default amount"
                  >
                    <FiDollarSign size={15} />
                  </button>
                  <input
                    type="number"
                    className="form-input !pl-8"
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))}
                    min="1"
                    placeholder="3000"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Payment Date</label>
                  <input type="date" className="form-input" value={paymentForm.date} onChange={e => setPaymentForm(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Payment method</label>
                  <select className="form-select" value={paymentForm.method} onChange={e => setPaymentForm(p => ({ ...p, method: e.target.value }))}>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="online_transfer">Online transfer</option>
                    <option value="payhere">PayHere</option>
                    <option value="manual">Other / manual</option>
                  </select>
                </div>
              </div>
              {['bank_transfer', 'payhere', 'card', 'online_transfer'].includes(paymentForm.method) && (
                <div>
                  <label className="form-label">Bank account (money received to)</label>
                  <select
                    className="form-select"
                    value={paymentForm.bankAccount}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, bankAccount: e.target.value }))}
                  >
                    <option value="">Select bank account…</option>
                    {bankAccounts.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.bankName} ({b.accountNumber})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">Selecting a bank account will update that account balance automatically.</p>
                </div>
              )}
              {paymentForm.method === 'cheque' && (
                <div className="grid sm:grid-cols-2 gap-3 border border-slate-200 rounded-xl p-3 bg-slate-50/80">
                  <div className="sm:col-span-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">Cheque details</div>
                  <div>
                    <label className="form-label">Cheque number</label>
                    <input className="form-input" value={paymentForm.chequeNumber} onChange={(e) => setPaymentForm((p) => ({ ...p, chequeNumber: e.target.value }))} />
                  </div>
                  <div>
                    <label className="form-label">Cheque date</label>
                    <input type="date" className="form-input" value={paymentForm.chequeDate} onChange={(e) => setPaymentForm((p) => ({ ...p, chequeDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="form-label">Bank on cheque</label>
                    <input className="form-input" value={paymentForm.chequeBank} onChange={(e) => setPaymentForm((p) => ({ ...p, chequeBank: e.target.value }))} placeholder="Drawee bank" />
                  </div>
                  <div>
                    <label className="form-label">Drawer / payee</label>
                    <input className="form-input" value={paymentForm.chequeDrawer} onChange={(e) => setPaymentForm((p) => ({ ...p, chequeDrawer: e.target.value }))} />
                  </div>
                </div>
              )}
              <div>
                <label className="form-label">Reference</label>
                <input type="text" className="form-input" value={paymentForm.reference} onChange={e => setPaymentForm(p => ({ ...p, reference: e.target.value }))} placeholder="Receipt or transaction ref…" />
              </div>
              <div>
                <label className="form-label">Note</label>
                <input type="text" className="form-input" value={paymentForm.note} onChange={e => setPaymentForm(p => ({ ...p, note: e.target.value }))} placeholder="Internal note…" />
              </div>
            </div>
          )}
        </Modal>
      </AnimatePresence>

      {/* ── Add Agreement Modal ── */}
      <AnimatePresence>
      <Modal open={showAgreementForm} onClose={() => setShowAgreementForm(false)} title="Subscription Agreements" maxWidth="max-w-lg"
          footer={<>
            <button className="btn-secondary btn-sm" onClick={() => setShowAgreementForm(false)}>Close</button>
            <button className="btn-primary btn-sm" disabled={saveMut.isPending || !agreementForm.file}
              onClick={() => saveMut.mutate({ isAgreement: true, agreement: agreementForm.file, title: agreementForm.title, type: agreementForm.type, validFrom: agreementForm.validFrom, validUntil: agreementForm.validUntil, notes: agreementForm.notes })}>
              {saveMut.isPending ? 'Uploading…' : 'Upload Agreement'}
            </button>
          </>}
        >
          <div className="space-y-5">
            {/* Existing agreements list */}
            {selectedSub?.agreements && selectedSub.agreements.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Existing Agreements</p>
                <div className="space-y-2">
                  {selectedSub.agreements.map((ag, i) => (
                    <div key={ag._id || i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{ag.title}</p>
                        <p className="text-xs text-slate-400 capitalize">{ag.type?.replace('_', ' ')} {ag.validFrom && `· ${new Date(ag.validFrom).toLocaleDateString()}`}</p>
                      </div>
                      {ag.fileUrl && (
                        <a
                          href={mediaUrl(ag.fileUrl)}
                          target="_blank" rel="noreferrer"
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium"
                        >
                          <FiEye size={14} /> View
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-100 my-4" />
              </div>
            )}

            {/* Upload new */}
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Upload New Agreement</p>
            <div>
              <label className="form-label">Agreement Title *</label>
              <input type="text" className="form-input" value={agreementForm.title} onChange={e => setAgreementForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Type</label>
              <select className="form-select" value={agreementForm.type} onChange={e => setAgreementForm(p => ({ ...p, type: e.target.value }))}>
                <option value="service">Service Agreement</option>
                <option value="hosting">Hosting Agreement</option>
                <option value="maintenance">Maintenance Agreement</option>
                <option value="social_media">Social Media Agreement</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Valid From</label>
                <input type="date" className="form-input" value={agreementForm.validFrom} onChange={e => setAgreementForm(p => ({ ...p, validFrom: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Valid Until</label>
                <input type="date" className="form-input" value={agreementForm.validUntil} onChange={e => setAgreementForm(p => ({ ...p, validUntil: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="form-label">File (PDF / Image) *</label>
              <input type="file" className="form-input file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                onChange={e => setAgreementForm(p => ({ ...p, file: e.target.files[0] }))} />
            </div>
          </div>
        </Modal>
      </AnimatePresence>

      {/* ── Payment History Modal ── */}
      <AnimatePresence>
        <Modal open={showHistoryModal} onClose={() => setShowHistoryModal(false)} title="Payment History" maxWidth="max-w-3xl">
          {selectedSub && (
            <div className="space-y-6">
              {/* Modern Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100/50 p-4 rounded-2xl shadow-sm flex flex-col justify-center">
                  <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Subscription</p>
                  <p className="text-sm font-semibold text-slate-800 line-clamp-2" title={selectedSub.title}>{selectedSub.title}</p>
                </div>
                <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex flex-col justify-center">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Billed</p>
                  <p className="text-xl font-bold text-slate-800">LKR {selectedSub.totalBilled?.toLocaleString()}</p>
                </div>
                <div className="bg-emerald-50/50 border border-emerald-100/50 p-4 rounded-2xl shadow-sm flex flex-col justify-center">
                  <p className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Total Paid</p>
                  <p className="text-xl font-bold text-emerald-600">LKR {selectedSub.totalPaid?.toLocaleString()}</p>
                </div>
              </div>

              {/* Action buttons: Export PDF, Email, SMS */}
              <div className="flex gap-2 flex-wrap items-center justify-between bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                <ExportBar
                  data={[...(selectedSub.payments || [])].sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))}
                  columns={[
                    { header: 'Date', accessor: (p) => p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '—' },
                    { header: 'Amount', accessor: (p) => `LKR ${p.amount?.toLocaleString()}` },
                    { header: 'Method', accessor: (p) => p.method?.replace('_', ' ') || '—' },
                    { header: 'Reference', accessor: (p) => p.reference || '—' },
                    { header: 'Note', accessor: (p) => p.note || '—' },
                    { header: 'Recorded By', accessor: (p) => p.recordedBy?.name || '—' },
                  ]}
                  title={`Payment History - ${selectedSub.title}`}
                  filters={{ Subscription: selectedSub.subscriptionNo, Client: selectedSub.client?.name }}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.post(`/subscriptions/${selectedSub._id}/send-history`, { methods: ['email'] })
                        toast.success('Payment history sent via email')
                      } catch (e) { toast.error(e.response?.data?.message || 'Send failed') }
                    }}
                    className="btn-outline btn-sm gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 transition-all rounded-lg bg-white"
                  >
                    <FiExternalLink size={14}/> Email All
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.post(`/subscriptions/${selectedSub._id}/send-history`, { methods: ['sms'] })
                        toast.success('Payment notification sent via SMS')
                      } catch (e) { toast.error(e.response?.data?.message || 'Send failed') }
                    }}
                    className="btn-outline btn-sm gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 transition-all rounded-lg bg-white"
                  >
                    <FiExternalLink size={14}/> SMS All
                  </button>
                </div>
              </div>

              {/* Payment Cards */}
              {(!selectedSub.payments || selectedSub.payments.length === 0) ? (
                 <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <FiDollarSign className="text-slate-300 mb-3" size={32} />
                    <p className="text-slate-500 font-medium">No payment history found.</p>
                 </div>
              ) : (
                <div className="space-y-4">
                  {[...selectedSub.payments].sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt)).map((p, idx) => (
                    <motion.div 
                      key={p._id || idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden"
                    >
                      {/* Card Header */}
                      <div className="flex flex-wrap items-center justify-between p-4 sm:px-6 bg-slate-50/50 border-b border-slate-100 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                            <FiCheck size={20} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">{new Date(p.paidAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <p className="text-lg font-bold text-slate-800">LKR {p.amount?.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-semibold text-slate-600 capitalize shadow-sm">
                             {p.method?.replace('_', ' ')}
                           </span>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 sm:px-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                        <div className="sm:col-span-2 space-y-2">
                          {p.reference && (
                            <div className="flex items-start gap-2">
                              <span className="text-slate-400 font-medium min-w-[70px]">Ref:</span>
                              <span className="text-slate-800 font-medium">{p.reference}</span>
                            </div>
                          )}
                          {p.note && (
                            <div className="flex items-start gap-2">
                              <span className="text-slate-400 font-medium min-w-[70px]">Note:</span>
                              <span className="text-slate-600">{p.note}</span>
                            </div>
                          )}
                          {p.method === 'cheque' && (
                            <div className="flex items-start gap-2">
                              <span className="text-slate-400 font-medium min-w-[70px]">Cheque:</span>
                              <span className="text-slate-600">{p.chequeNumber} {p.chequeBank ? `(${p.chequeBank})` : ''}</span>
                            </div>
                          )}
                          {!p.reference && !p.note && p.method !== 'cheque' && (
                            <span className="text-slate-400 italic text-xs">No additional details</span>
                          )}
                        </div>
                        <div className="sm:text-right space-y-1 border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-4">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Recorded By</p>
                          <p className="font-medium text-slate-700">{p.recordedBy?.name || 'System'}</p>
                        </div>
                      </div>

                      {/* Card Footer (Actions) */}
                      <div className="bg-slate-50/80 border-t border-slate-100 p-3 sm:px-6 flex flex-wrap items-center justify-between gap-4">
                         {/* Seal Picker */}
                         <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex-1 sm:flex-none max-w-full overflow-hidden">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap shrink-0" title="Include Company Seal on Invoice">
                              <input
                                type="checkbox"
                                className="w-3.5 h-3.5 accent-indigo-500 rounded-sm"
                                checked={getSealState(p._id).sealChecked}
                                onChange={e => setSealField(p._id, 'sealChecked', e.target.checked)}
                              />
                              Include Seal
                            </label>
                            {getSealState(p._id).sealChecked && sealOptions.length > 0 && (
                              <div className="pl-2 border-l border-slate-200 min-w-0 flex-1">
                                <select
                                  className="text-xs border-none bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer py-0.5 w-full truncate"
                                  value={getSealState(p._id).sealKey}
                                  onChange={e => setSealField(p._id, 'sealKey', e.target.value)}
                                  title="Select seal image"
                                >
                                  {sealOptions.map(opt => (
                                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            {getSealState(p._id).sealChecked && sealOptions.length === 0 && (
                              <span className="pl-2 border-l border-slate-200 text-[10px] text-amber-500 italic font-medium shrink-0">No seal configured</span>
                            )}
                         </div>

                         {/* Action Buttons */}
                         <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={async () => {
                                try {
                                  const { sealChecked, sealKey } = getSealState(p._id)
                                  const chosenSeal = sealChecked ? (sealOptions.find(o => o.key === sealKey) || sealOptions[0]) : null
                                  const sealUrl = chosenSeal ? chosenSeal.url : null
                                  const res = await api.post(`/subscriptions/${selectedSub._id}/payments/${p._id}/invoice`, {
                                    withSeal: sealChecked && !!sealUrl,
                                    sealUrl,
                                  });
                                  toast.success('Invoice created, downloading...');
                                  const invoiceId = res.data?.invoice?._id;
                                  if (invoiceId) {
                                    const { htmlStringToPdfDownload } = await import('../../lib/pdfGenerator');
                                    const htmlRes = await api.get(`/invoices/${invoiceId}/pdf?html=true&t=${Date.now()}`, { responseType: 'text' });
                                    await htmlStringToPdfDownload(htmlRes.data, `Invoice_${invoiceId}.pdf`);
                                  }
                                } catch (e) { toast.error(e.response?.data?.message || 'Failed to create invoice'); }
                              }}
                              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 font-semibold text-xs rounded-lg transition-colors border border-indigo-100/50 shadow-sm"
                              title="Create & Download Invoice"
                            >
                              <FiFileText size={14} /> Download Invoice
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  await api.post(`/subscriptions/${selectedSub._id}/payments/${p._id}/receipt`, { methods: ['email'] });
                                  toast.success('Email receipt sent');
                                } catch (e) { toast.error(e.response?.data?.message || 'Failed to send email'); }
                              }}
                              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 font-semibold text-xs rounded-lg transition-colors border border-blue-100/50 shadow-sm"
                              title="Email Receipt"
                            >
                              <FiMail size={14} /> Email
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  await api.post(`/subscriptions/${selectedSub._id}/payments/${p._id}/receipt`, { methods: ['sms'] });
                                  toast.success('SMS receipt sent');
                                } catch (e) { toast.error(e.response?.data?.message || 'Failed to send SMS'); }
                              }}
                              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 font-semibold text-xs rounded-lg transition-colors border border-emerald-100/50 shadow-sm"
                              title="SMS Receipt"
                            >
                              <FiMessageSquare size={14} /> SMS
                            </button>
                         </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Modal>
      </AnimatePresence>

      {/* ── View Subscription Modal ── */}
      <AnimatePresence>
        <Modal open={showViewModal} onClose={() => setShowViewModal(false)} title="Subscription Details" maxWidth="max-w-2xl">
          {selectedSub && (
            <div className="space-y-6 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Client</p>
                  <p className="font-semibold text-slate-800">{selectedSub.client?.name || 'Unknown'}</p>
                  <p className="text-slate-500">{selectedSub.client?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Subscription Title</p>
                  <p className="font-semibold text-slate-800">{selectedSub.title}</p>
                  <p className="text-slate-500">{selectedSub.subscriptionNo}</p>
                </div>
              </div>
              <hr className="border-slate-100" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Status</p>
                  <span className={`badge ${selectedSub.status === 'active' ? 'badge-green' : selectedSub.status === 'overdue' ? 'badge-red' : 'badge-gray'}`}>{selectedSub.status}</span>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Type</p>
                  <p className="font-semibold text-slate-800">{selectedSub.typeLabel || selectedSub.subscriptionType}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Amount</p>
                  <p className="font-semibold text-slate-800">LKR {selectedSub.amount?.toLocaleString()}</p>
                  <p className="text-slate-500 text-[11px] capitalize">{selectedSub.billingFrequency}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Next Due Date</p>
                  <p className="font-semibold text-slate-800">{selectedSub.nextDueDate ? new Date(selectedSub.nextDueDate).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
              
              {selectedSub.description && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Description</p>
                  <p className="text-slate-700 bg-slate-50 p-3 rounded-xl">{selectedSub.description}</p>
                </div>
              )}
              
              {['hosting_domain', 'website_maintenance', 'custom'].includes(selectedSub.subscriptionType) && selectedSub.hostingDetails && selectedSub.hostingDetails.domainName && (
                <>
                  <hr className="border-slate-100" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2 flex items-center gap-2"><FiServer size={12}/> Hosting & Domain</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-400">Domain Name</p>
                        <p className="font-medium text-slate-800">{selectedSub.hostingDetails.domainName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Provider</p>
                        <p className="font-medium text-slate-800">{selectedSub.hostingDetails.provider || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">cPanel URL</p>
                        {selectedSub.hostingDetails.hostingUrl ? (
                          <a href={selectedSub.hostingDetails.hostingUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline break-all">{selectedSub.hostingDetails.hostingUrl}</a>
                        ) : '—'}
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Expiry Date</p>
                        <p className="font-medium text-slate-800">{selectedSub.hostingDetails.expiryDate ? new Date(selectedSub.hostingDetails.expiryDate).toLocaleDateString() : '—'}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              {selectedSub.subscriptionType.startsWith('social_media') && selectedSub.socialMediaLinks && (
                <>
                  <hr className="border-slate-100" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-pink-700 mb-2">Social Media Links</p>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(selectedSub.socialMediaLinks).map(([platform, url]) => (
                        <div key={platform}>
                          <p className="text-xs text-slate-400 capitalize">{platform}</p>
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline break-all truncate block">{url}</a>
                          ) : <p className="text-slate-300">—</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </Modal>
      </AnimatePresence>

      {subDeleteModal}
    </div>
  )
}
