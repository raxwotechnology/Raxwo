import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { FiPlus, FiX, FiFileText, FiCheck, FiArrowRight, FiTrash2, FiEdit2, FiSearch, FiEye, FiSend, FiUpload, FiImage, FiDownload } from 'react-icons/fi'
import { mediaUrl } from '../../lib/media'
import useAuthStore from '../../store/authStore'
import { SITE_SETTINGS_QUERY_KEY } from '../../hooks/useSiteBranding'
import QuotationPreviewPanel from '../../components/documents/QuotationPreviewPanel'
import { buildQuotationDraft } from '../../lib/buildQuotationDraft'
import { calcDocumentTotals } from '../../lib/documentTotals'
import {
  QUOTATION_CURRENCIES,
  formatMoney,
  convertAmountBetweenCurrencies,
  suggestedExchangeToLKR,
} from '../../lib/currencies'
import ConfirmModal from '../../components/ui/ConfirmModal'
import PasswordConfirmModal from '../../components/admin/PasswordConfirmModal'
import SearchableSelect from '../../components/ui/SearchableSelect'
import ExportBar from '../../components/ui/ExportBar'
import { lookupLoaders } from '../../lib/lookupApi'

const STATUS_COLOR = {
  draft:'badge-gray', sent:'badge-blue', accepted:'badge-green', confirmed:'badge-green',
  rejected:'badge-red', expired:'badge-yellow', converted:'badge-purple'
}

const STATUS_LIFECYCLE = ['draft','sent','accepted','rejected','expired']
const SERVICE_TYPES = ['ERP', 'POS', 'Hosting', 'Website', 'Maintenance', 'Custom', 'Other']
const PAYMENT_METHODS = [
  { value: '', label: '— Select —' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'online', label: 'Online Payment' },
  { value: 'custom', label: 'Custom' },
]
const DIRECTOR_ROLE_OPTIONS = [
  { value: '', label: 'Use default' },
  { value: 'director', label: 'Director' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'hr', label: 'HR' },
]

export default function AdminQuotations() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [deletePending, setDeletePending] = useState(null)
  const [editing, setEditing] = useState(null)
  const [mobileTab, setMobileTab] = useState('form')
  const [viewing, setViewing] = useState(null)
  const [quickView, setQuickView] = useState(null)
  const [sendTarget, setSendTarget] = useState(null)
  const [sendMethods, setSendMethods] = useState({ email: true, sms: false, link: true, pdf: true })
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [serviceTypeFilter, setServiceTypeFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [convertTarget, setConvertTarget] = useState(null)
  const [clientSelectLabel, setClientSelectLabel] = useState('')
  const prevCurrencyRef = useRef('LKR')

  const { register, handleSubmit, reset, setValue, watch, control } = useForm({
    defaultValues: {
      items: [{ description: '', quantity: 1, unitPrice: 0, discount: 0, total: 0 }],
      currency: 'LKR',
      exchangeRateToLKR: 1,
      advanceAmount: 0,
      showSeal: true,
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const watchItems = watch('items') || []
  const watchedCurrency = watch('currency') || 'LKR'
  const docTotals = calcDocumentTotals(watchItems, {
    taxRate: watch('taxRate') || 0,
    globalDiscountValue: watch('globalDiscountValue') || 0,
    globalDiscountType: watch('globalDiscountType') || 'fixed',
    transportCharge: watch('transportCharge') || 0,
  })
  const { grossSubtotal: subtotal, discountTotal, tax, transportCharge, total } = docTotals
  const taxRate = Number(watch('taxRate') || 0)
  const advanceAmount = Number(watch('advanceAmount') || 0)
  const balance = Math.max(0, total - advanceAmount)

  const handleCurrencyChange = (newCurrency) => {
    const prev = prevCurrencyRef.current || watchedCurrency
    if (newCurrency === prev) return
    const items = watchItems.map((item) => ({
      ...item,
      unitPrice: convertAmountBetweenCurrencies(Number(item.unitPrice || 0), prev, newCurrency),
    }))
    items.forEach((item, idx) => {
      setValue(`items.${idx}.unitPrice`, item.unitPrice, { shouldDirty: true })
    })
    const newAdvance = convertAmountBetweenCurrencies(advanceAmount, prev, newCurrency)
    setValue('advanceAmount', newAdvance, { shouldDirty: true })
    setValue('exchangeRateToLKR', suggestedExchangeToLKR(newCurrency), { shouldDirty: true })
    setValue('currency', newCurrency, { shouldDirty: true })
    prevCurrencyRef.current = newCurrency
  }

  useEffect(() => {
    if (showModal) prevCurrencyRef.current = watchedCurrency
  }, [showModal, editing?._id])

  const buildQuery = () => {
    const p = new URLSearchParams()
    if (statusFilter) p.set('status', statusFilter)
    if (startDate) p.set('startDate', startDate)
    if (endDate) p.set('endDate', endDate)
    if (serviceTypeFilter) p.set('serviceType', serviceTypeFilter)
    if (branchFilter) p.set('branch', branchFilter)
    if (clientFilter) p.set('client', clientFilter)
    return p.toString()
  }

  const { data: quotData, isLoading } = useQuery({
    queryKey: ['quotations', statusFilter, startDate, endDate, serviceTypeFilter, branchFilter, clientFilter],
    queryFn: () => api.get(`/quotations?${buildQuery()}`).then(r => r.data),
  })
  const { data: clientData } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/clients').then(r => r.data),
    enabled: showModal,
  })
  const watchedClientQ = watch('client')
  const { data: branchQuotData } = useQuery({
    queryKey: ['branches-for-quotation-modal'],
    queryFn: () => api.get('/branches').then((r) => r.data),
  })
  const { data: projQuotData } = useQuery({
    queryKey: ['projects-for-quotation-modal'],
    queryFn: () => api.get('/projects').then((r) => r.data),
    enabled: showModal,
  })
  const branchesQuot = branchQuotData?.branches || []
  const projectsQuot = (projQuotData?.projects || []).filter(
    (p) => !watchedClientQ || String(p.client?._id || p.client) === String(watchedClientQ)
  )
  const { data: siteData } = useQuery({
    queryKey: SITE_SETTINGS_QUERY_KEY,
    queryFn: () => api.get('/site-settings').then((r) => r.data),
  })
  const siteSettings = siteData?.settings || {}
  const { data: bankData } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => api.get('/bank-accounts').then((r) => r.data),
    enabled: showModal || !!viewing,
  })
  const banks = bankData?.accounts || []

  const bankLabelFor = (bankId) => {
    if (!bankId) return ''
    const b = banks.find((x) => String(x._id) === String(bankId))
    return b ? `${b.bankName} · ${b.accountNumber}` : ''
  }
  const directorMetaForRole = (role) => {
    const key = role || siteSettings.quotationDirectorRole || ''
    const profile = siteSettings.signatures?.[key] || null
    return {
      role: key,
      name: profile?.label || siteSettings.quotationDirectorName || '',
      sealUrl: siteSettings.sealUrl || '',
    }
  }

  const previewSaveMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/quotations/${id}`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries(['quotations'])
      qc.invalidateQueries(['quotation', id])
      toast.success('Quotation updated from preview')
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Save failed'),
  })

  const sendMut = useMutation({
    mutationFn: ({ id, methods }) => api.post(`/quotations/${id}/send`, { methods }),
    onSuccess: (res, { methods }) => {
      qc.invalidateQueries(['quotations'])
      const link = res.data?.shareLink
      if (link && methods?.includes('link')) {
        navigator.clipboard?.writeText(link).then(() => toast.success(`${res.data?.message || 'Sent'} · Link copied`)).catch(() => toast.success(res.data?.message || 'Sent'))
      } else {
        toast.success(res.data?.message || 'Sent')
      }
      setSendTarget(null)
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Send failed'),
  })

  const openSavedQuotationPreview = async (quotation) => {
    if (!quotation?._id) return
    closeModal()
    try {
      const full = await api.get(`/quotations/${quotation._id}`).then((r) => r.data?.quotation)
      setViewing(full || quotation)
    } catch {
      setViewing(quotation)
    }
  }

  const downloadQuotationPdf = async (id, quotationNo) => {
    try {
      const { htmlStringToPdfDownload } = await import('../../lib/pdfGenerator');
      const res = await api.get(`/quotations/${id}/pdf?html=true`, { responseType: 'text' });
      const htmlStr = typeof res.data === 'string' ? res.data : await res.data.text();
      const fname = `${quotationNo || viewing?.quotationNo || 'quotation'}.pdf`;
      toast.loading('Generating PDF...', { id: 'pdf-toast' });
      await htmlStringToPdfDownload(htmlStr, fname);
      toast.success('PDF downloaded', { id: 'pdf-toast' });
    } catch (err) {
      console.error(err);
      toast.error('PDF download failed', { id: 'pdf-toast' });
    }
  }

  const createMut = useMutation({
    mutationFn: d => api.post('/quotations', d),
    onSuccess: (res) => {
      qc.invalidateQueries(['quotations'])
      toast.success('Quotation created')
      openSavedQuotationPreview(res.data?.quotation)
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/quotations/${id}`, data),
    onSuccess: (res) => {
      qc.invalidateQueries(['quotations'])
      toast.success('Updated')
      openSavedQuotationPreview(res.data?.quotation)
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })
  const statusMut = useMutation({
    mutationFn: ({ id, status }) => api.put(`/quotations/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries(['quotations']); toast.success('Status updated') },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })
  const convertMut = useMutation({
    mutationFn: id => api.post(`/quotations/${id}/convert-to-invoice`),
    onSuccess: (res) => {
      qc.invalidateQueries(['quotations'])
      qc.invalidateQueries(['admin-invoices'])
      toast.success(`Invoice ${res?.data?.invoice?.invoiceNo || ''} created successfully`)
      setConvertTarget(null)
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })
  const deleteMut = useMutation({
    mutationFn: ({ id, password }) => api.delete(`/quotations/${id}`, { data: { password } }),
    onSuccess: () => { qc.invalidateQueries(['quotations']); toast.success('Deleted') },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })
  const clients = (clientData?.clients || clientData?.users || []).filter(u => !u.role || u.role === 'client')
  const formSnapshot = watch()
  const livePreviewQuotation = useMemo(
    () => buildQuotationDraft(formSnapshot, { clients, editing, user }),
    [formSnapshot, clients, editing, user],
  )
  const quotations = (quotData?.quotations || []).filter(q =>
    !search || q.title?.toLowerCase().includes(search.toLowerCase()) ||
    q.client?.name?.toLowerCase().includes(search.toLowerCase()) ||
    q.quotationNo?.toLowerCase().includes(search.toLowerCase())
  )

  const closeModal = () => { setShowModal(false); setEditing(null); setMobileTab('form'); setClientSelectLabel(''); reset({ items: [{ description: '', quantity: 1, unitPrice: 0, discount: 0, total: 0 }], currency: 'LKR', branch: '', project: '', client: '' }) }
  const openCreate = () => {
    const directorMeta = directorMetaForRole(siteSettings.quotationDirectorRole || '')
    reset({
      quotationDate: new Date().toISOString().split('T')[0],
      items: [{ description: '', quantity: 1, unitPrice: 0, discount: 0, total: 0 }],
      currency: 'LKR',
      branch: '',
      project: '',
      client: '',
      transportCharge: 0,
      globalDiscountType: 'fixed',
      globalDiscountValue: 0,
      preparedBy: user?.name || '',
      bankBranch: '',
      directorRole: directorMeta.role || '',
      directorName: directorMeta.name || '',
      directorSealUrl: directorMeta.sealUrl || '',
      showSeal: true,
      notes: siteSettings.quotationNotesTemplate || '',
      terms: siteSettings.quotationTermsTemplate || '',
    })
    setClientSelectLabel('')
    setEditing(null)
    setShowModal(true)
  }
  const openEdit = (q) => {
    const directorMeta = directorMetaForRole(q.directorRole || '')
    reset({
      client: q.client?._id || q.client,
      title: q.title || '',
      serviceType: q.serviceType || 'Other',
      branch: q.branch?._id || q.branch || '',
      project: q.project?._id || q.project || '',
      currency: q.currency || 'LKR',
      exchangeRateToLKR: q.exchangeRateToLKR ?? suggestedExchangeToLKR(q.currency || 'LKR'),
      advanceAmount: q.advanceAmount || 0,
      quotationDate: q.quotationDate ? new Date(q.quotationDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      validUntil: q.validUntil ? new Date(q.validUntil).toISOString().split('T')[0] : '',
      taxRate: q.taxRate || 0,
      notes: q.notes || '',
      terms: q.terms || '',
      transportCharge: q.transportCharge || 0,
      globalDiscountType: q.globalDiscountType || 'fixed',
      globalDiscountValue: q.globalDiscountValue || 0,
      paymentMethod: q.paymentMethod || '',
      paymentMethodCustom: q.paymentMethodCustom || '',
      bankAccount: q.bankAccount?._id || q.bankAccount || '',
      bankBranch: q.bankBranch || q.bankAccount?.branchName || '',
      preparedBy: q.preparedBy || q.generatedBy?.name || '',
      directorRole: q.directorRole || directorMeta.role || '',
      directorName: q.directorName || directorMeta.name || '',
      directorSealUrl: q.directorSealUrl || directorMeta.sealUrl || '',
      showSeal: q.showSeal !== false,
      items: (q.items && q.items.length > 0) ? q.items.map(i => ({ description: i.description || '', quantity: i.quantity || 1, unitPrice: i.unitPrice || 0, discount: i.discount || 0, total: i.total || 0 })) : [{ description: '', quantity: 1, unitPrice: 0, discount: 0, total: 0 }],
    })
    setClientSelectLabel(
      q.client?.name ? `${q.client.name}${q.client.email ? ` (${q.client.email})` : ''}` : ''
    )
    setEditing(q)
    setShowModal(true)
  }

  const onSubmit = d => {
    if (!d.client) {
      toast.error('Please select a client')
      return
    }
    const items = (d.items || []).map(item => ({
      ...item,
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unitPrice || 0),
      discount: Number(item.discount || 0),
      total: Number(item.quantity || 1) * Number(item.unitPrice || 0) * (1 - Number(item.discount || 0) / 100),
    }))
    const tRate = Number(d.taxRate || 0)
    const transport = Number(d.transportCharge || 0)
    const totals = calcDocumentTotals(items, {
      taxRate: tRate,
      globalDiscountValue: d.globalDiscountValue || 0,
      globalDiscountType: d.globalDiscountType || 'fixed',
      transportCharge: transport,
    })
    const payload = {
      ...d,
      items: totals.items,
      subtotal: totals.grossSubtotal,
      discountTotal: totals.discountTotal,
      globalDiscountType: d.globalDiscountType || 'fixed',
      globalDiscountValue: Number(d.globalDiscountValue || 0),
      tax: totals.tax,
      taxRate: tRate,
      transportCharge: transport,
      total: totals.total,
      advanceAmount: Number(d.advanceAmount || 0),
      exchangeRateToLKR: Number(d.exchangeRateToLKR) || suggestedExchangeToLKR(d.currency || 'LKR'),
      notes: String(d.notes || '').trim(),
      terms: String(d.terms || '').trim(),
      bankBranch: String(d.bankBranch || '').trim(),
      directorRole: d.directorRole || '',
      directorName: String(d.directorName || '').trim(),
      directorSealUrl: String(d.directorSealUrl || '').trim(),
      showSeal: d.showSeal !== false,
    }
    if (!payload.branch) delete payload.branch
    if (!payload.project) delete payload.project
    if (!payload.bankAccount) delete payload.bankAccount
    const validItems = items.filter((i) => i.description?.trim())
    if (validItems.length === 0) {
      toast.error('Add at least one line item with a description')
      return
    }
    payload.items = validItems
    editing ? updateMut.mutate({ id: editing._id, data: payload }) : createMut.mutate(payload)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Quotations</h1>
          <p className="page-subtitle">{quotData?.count || 0} quotations total</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ExportBar
            data={quotations}
            columns={[
              { header: 'Quotation No.', accessor: 'quotationNo' },
              { header: 'Client', accessor: q => q.client?.name || '—' },
              { header: 'Title', accessor: q => q.title || '—' },
              { header: 'Service', accessor: q => q.serviceType || 'Other' },
              { header: 'Total', accessor: q => formatMoney(q.total || 0, q.currency || 'LKR') },
              { header: 'Valid Until', accessor: q => q.validUntil ? new Date(q.validUntil).toLocaleDateString('en-LK') : '—' },
              { header: 'Status', accessor: 'status' }
            ]}
            title="Quotations Report"
            filters={{
              Status: statusFilter || 'All',
              Service: serviceTypeFilter || 'All',
              Branch: branchesQuot.find(b => b._id === branchFilter)?.name || (branchFilter ? 'Filtered' : 'All'),
              Client: clientData?.users?.find(c => c._id === clientFilter)?.name || (clientFilter ? 'Filtered' : 'All'),
              'Start Date': startDate || 'Any',
              'End Date': endDate || 'Any'
            }}
          />
          <button onClick={openCreate} className="btn-primary whitespace-nowrap"><FiPlus size={15}/> New Quotation</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative w-full sm:flex-1 sm:w-auto sm:min-w-[200px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14}/>
          <input placeholder="Search quotations..." className="form-input !pl-10 py-2 text-sm w-full" value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <select className="form-select py-2 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {['draft','sent','confirmed','rejected','expired','converted'].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
        <select className="form-select py-2 text-sm" value={serviceTypeFilter} onChange={e => setServiceTypeFilter(e.target.value)}>
          <option value="">All Services</option>
          {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="form-select py-2 text-sm" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
          <option value="">All Branches</option>
          {branchesQuot.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
        <select className="form-select py-2 text-sm max-w-xs" value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
          <option value="">All Customers</option>
          {(clientData?.users || clientData?.clients || []).filter(u => !u.role || u.role === 'client').map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        {/* Styled date range picker */}
        <div className="flex items-center gap-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-2 border-r border-slate-100">
            <svg className="text-slate-400 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From</span>
          </div>
          <input
            type="date"
            className="border-0 bg-transparent text-sm text-slate-700 px-2 py-2 focus:outline-none focus:ring-0 w-[130px]"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
          <div className="px-1 text-slate-300 select-none">→</div>
          <div className="flex items-center gap-1.5 px-3 py-2 border-l border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To</span>
          </div>
          <input
            type="date"
            className="border-0 bg-transparent text-sm text-slate-700 px-2 py-2 focus:outline-none focus:ring-0 w-[130px]"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => { setStartDate(''); setEndDate('') }}
              className="px-2 py-2 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors border-l border-slate-100"
              title="Clear dates"
            >
              <FiX size={13}/>
            </button>
          )}
        </div>
      </div>


      {/* Mobile card list */}
      <div className="sm:hidden space-y-3">
        {isLoading ? (
          <div className="text-center py-12"><div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto"/></div>
        ) : quotations.length === 0 ? (
          <div className="text-center py-12 text-gray-400"><FiFileText size={32} className="mx-auto mb-2 opacity-30"/>No quotations found</div>
        ) : quotations.map(q => (
          <div key={q._id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="badge badge-navy font-mono text-xs tracking-tight">{q.quotationNo}</span>
                <p className="font-semibold text-slate-800 mt-1 truncate">{q.client?.name || '—'}</p>
                <p className="text-xs text-slate-400 truncate">{q.title || q.serviceType || '—'}</p>
              </div>
              <span className={`badge capitalize shrink-0 ${STATUS_COLOR[q.status] || 'badge-gray'}`}>{q.status}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-primary text-base">{formatMoney(q.total || 0, q.currency || 'LKR')}</span>
              <span className="text-xs text-slate-400">{q.validUntil ? `Valid: ${new Date(q.validUntil).toLocaleDateString('en-LK')}` : ''}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
              <button onClick={() => setQuickView(q)} className="flex-1 btn-ghost btn-sm justify-center text-xs"><FiEye size={13}/> View</button>
              <button onClick={() => setViewing(q)} className="flex-1 btn-ghost btn-sm justify-center text-xs"><FiFileText size={13}/> Preview</button>
              <button onClick={() => downloadQuotationPdf(q._id, q.quotationNo)} className="flex-1 btn-ghost btn-sm justify-center text-xs"><FiDownload size={13}/> PDF</button>
              <button onClick={() => { setSendTarget(q); setSendMethods({ email: true, sms: false, link: true }) }} className="flex-1 btn-ghost btn-sm justify-center text-xs"><FiSend size={13}/> Send</button>
              {['draft','sent'].includes(q.status) && (
                <button onClick={() => openEdit(q)} className="flex-1 btn-ghost btn-sm justify-center text-xs"><FiEdit2 size={13}/> Edit</button>
              )}
              {!['converted', 'rejected', 'expired'].includes(q.status) && (
                <button onClick={() => setConvertTarget(q)} className="flex-1 btn-ghost btn-sm justify-center text-xs"><FiArrowRight size={13}/> Invoice</button>
              )}
              <button type="button" onClick={() => setDeletePending(q)} className="flex-1 btn-ghost btn-sm justify-center text-xs text-red-500 hover:bg-red-50"><FiTrash2 size={13}/> Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Quotation No.</th><th>Client</th><th>Title</th><th>Service</th>
              <th>Total</th><th>Valid Until</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12">
                <div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto"/>
              </td></tr>
            ) : quotations.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                <FiFileText size={32} className="mx-auto mb-2 opacity-30"/>No quotations found
              </td></tr>
            ) : quotations.map(q => (
              <tr key={q._id}>
                <td><span className="badge badge-navy font-mono text-xs tracking-tight">{q.quotationNo}</span></td>
                <td>
                  <div className="font-medium text-gray-800">{q.client?.name || '—'}</div>
                  <div className="text-xs text-gray-400">{q.client?.email}</div>
                </td>
                <td className="font-medium text-gray-800 min-w-[200px] whitespace-normal break-words">{q.title || '—'}</td>
                <td className="text-sm text-gray-600 font-medium whitespace-nowrap">{q.serviceType || 'Other'}</td>
                <td className="font-bold text-gray-800 whitespace-nowrap">{formatMoney(q.total || 0, q.currency || 'LKR')}</td>
                <td className="text-sm text-gray-600 font-medium whitespace-nowrap">{q.validUntil ? new Date(q.validUntil).toLocaleDateString('en-LK') : '—'}</td>
                <td><span className={`badge capitalize ${STATUS_COLOR[q.status] || 'badge-gray'}`}>{q.status}</span></td>
                <td>
                  <div className="flex gap-1">
                    <button onClick={() => setQuickView(q)} title="Quick view" className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><FiEye size={13}/></button>
                    <button onClick={() => setViewing(q)} title="Preview & edit" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><FiFileText size={13}/></button>
                    <button onClick={() => downloadQuotationPdf(q._id, q.quotationNo)} title="Download PDF" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><FiDownload size={13}/></button>
                    <button onClick={() => { setSendTarget(q); setSendMethods({ email: true, sms: false, link: true }) }} title="Send" className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><FiSend size={13}/></button>
                    {q.status === 'draft' && (
                      <button onClick={() => statusMut.mutate({ id: q._id, status: 'sent' })} title="Mark Sent" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-xs font-bold">Sent</button>
                    )}
                    {q.status === 'sent' && (
                      <>
                        <button onClick={() => statusMut.mutate({ id: q._id, status: 'accepted' })} title="Mark Accepted" className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"><FiCheck size={13}/></button>
                        <button onClick={() => statusMut.mutate({ id: q._id, status: 'rejected' })} title="Mark Rejected" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><FiX size={13}/></button>
                      </>
                    )}
                    {!['converted', 'rejected', 'expired'].includes(q.status) && (
                      <button onClick={() => setConvertTarget(q)} title="Convert to Invoice" className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"><FiArrowRight size={13}/></button>
                    )}
                    {['draft','sent'].includes(q.status) && (
                      <button onClick={() => openEdit(q)} title="Edit" className="p-1.5 text-gray-400 hover:text-secondary hover:bg-blue-50 rounded-lg transition-colors"><FiEdit2 size={13}/></button>
                    )}
                    <button type="button" onClick={() => setDeletePending(q)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><FiTrash2 size={13}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit — form + live document preview */}
      {showModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-0 sm:p-2 lg:p-4 z-[99999]">
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            className="doc-editor-modal bg-white sm:rounded-2xl shadow-2xl w-full sm:max-w-[95vw] 2xl:max-w-[1600px] h-full sm:h-[96vh] overflow-hidden flex flex-col border-0 sm:border border-slate-200">
            <div className="flex items-center justify-between px-4 py-3 sm:p-4 md:p-5 border-b shrink-0 bg-white z-10">
              <div className="min-w-0 pr-2">
                <h3 className="text-base sm:text-lg font-bold text-primary font-heading truncate">{editing ? 'Edit Quotation' : 'New Quotation'}</h3>
                {(editing?.quotationNo || watch('quotationNo')) && <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">#{editing?.quotationNo || watch('quotationNo')}</p>}
              </div>
              <button type="button" onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg shrink-0"><FiX/></button>
            </div>
            {/* Mobile tab switcher */}
            <div className="lg:hidden flex border-b border-slate-200 shrink-0">
              <button type="button" onClick={() => setMobileTab('form')} className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${mobileTab === 'form' ? 'text-primary border-b-2 border-primary bg-blue-50/50' : 'text-slate-500 hover:bg-slate-50'}`}>Form</button>
              <button type="button" onClick={() => setMobileTab('preview')} className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${mobileTab === 'preview' ? 'text-primary border-b-2 border-primary bg-blue-50/50' : 'text-slate-500 hover:bg-slate-50'}`}>Preview</button>
            </div>
            <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
            <form onSubmit={handleSubmit(onSubmit)} className={`lg:w-[450px] xl:w-[550px] 2xl:w-[600px] overflow-y-auto p-4 md:p-5 space-y-4 border-b lg:border-b-0 lg:border-r border-slate-200 ${mobileTab === 'preview' ? 'hidden lg:flex lg:flex-col lg:shrink-0 lg:flex-none' : 'flex flex-col flex-1 min-h-0 lg:flex-none lg:shrink-0'}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="form-label">Client *</label>
                  <input type="hidden" {...register('client', { required: true })} />
                  <SearchableSelect
                    value={watch('client') || ''}
                    onChange={(v, opt) => {
                      setValue('client', v, { shouldDirty: true, shouldValidate: true })
                      setClientSelectLabel(opt?.label || '')
                    }}
                    loadOptions={lookupLoaders.clients()}
                    placeholder="Search client…"
                    initialLabel={clientSelectLabel}
                  />
                </div>
                <div><label className="form-label">Service Type</label>
                  <select {...register('serviceType')} className="form-select">
                    {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select></div>
              </div>
              <div><label className="form-label">Subject / Title</label>
                <input {...register('title')} className="form-input" placeholder="Project or service proposal title (optional)"/></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="form-label">Branch</label>
                  <select {...register('branch')} className="form-select">
                    <option value="">— None —</option>
                    {branchesQuot.map((b) => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </select></div>
                <div><label className="form-label">Linked project</label>
                  <select
                    {...register('project')}
                    onChange={(e) => {
                      register('project').onChange(e)
                      const pid = e.target.value
                      if (!pid) return
                      const pr = projectsQuot.find((p) => String(p._id) === String(pid))
                      if (pr?.deadline) {
                        setValue('validUntil', new Date(pr.deadline).toISOString().split('T')[0], { shouldDirty: false })
                      }
                    }}
                    className="form-select"
                  >
                    <option value="">— None —</option>
                    {projectsQuot.map((p) => (
                      <option key={p._id} value={p._id}>{p.title}</option>
                    ))}
                  </select></div>
                <div><label className="form-label">Currency</label>
                  <select className="form-select" value={watchedCurrency} onChange={(e) => handleCurrencyChange(e.target.value)}>
                    {QUOTATION_CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select></div>
                <div><label className="form-label">Exchange rate (1 {watchedCurrency} → LKR)</label>
                  <input {...register('exchangeRateToLKR', { valueAsNumber: true })} type="number" step="0.01" min="0.01" className="form-input" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div><label className="form-label">Quotation Date</label>
                  <input {...register('quotationDate')} type="date" className="form-input"/></div>
                <div><label className="form-label">Valid Until</label>
                  <input {...register('validUntil')} type="date" className="form-input"/></div>
                <div><label className="form-label">Tax Rate (%)</label>
                  <input {...register('taxRate', { valueAsNumber: true })} type="number" step="0.1" className="form-input" placeholder="0"/></div>
              </div>

              {/* Line items — each row is one billable line with clear field names */}
              <div>
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <div>
                    <label className="form-label mb-0">Line items</label>
                    <p className="text-[11px] text-slate-500 mt-0.5 max-w-xl leading-snug">
                      Add one row per product or service: <strong>description</strong> (what you are charging for), <strong>quantity</strong>, <strong>unit price</strong> per unit in LKR, and optional <strong>discount %</strong> off that line. Line total updates from those values.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => append({ description: '', quantity: 1, unitPrice: 0, discount: 0, total: 0 })}
                    className="btn-outline btn-sm shrink-0"
                  >
                    <FiPlus size={12} /> Add line
                  </button>
                </div>

                {/* Column guide (desktop) */}
                <div className="hidden md:grid md:grid-cols-12 gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100/80 rounded-t-lg border border-b-0 border-slate-200">
                  <div className="md:col-span-4">Item / service description</div>
                  <div className="md:col-span-2 text-center">Qty</div>
                  <div className="md:col-span-2 text-right">Unit price ({watchedCurrency})</div>
                  <div className="md:col-span-2 text-right">Discount %</div>
                  <div className="md:col-span-2 text-right">Line total ({watchedCurrency})</div>
                </div>

                <div className={`space-y-3 ${fields.length ? 'md:border md:border-t-0 md:border-slate-200 md:rounded-b-lg md:rounded-t-none md:p-3 md:bg-slate-50/30' : ''}`}>
                  {fields.map((field, idx) => {
                    const row = watchItems[idx] || {}
                    const qty = Number(row.quantity || 1)
                    const price = Number(row.unitPrice || 0)
                    const disc = Number(row.discount || 0)
                    const lineTotal = qty * price * (1 - disc / 100)
                    return (
                      <div
                        key={field.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 md:border-0 md:bg-transparent md:p-0 space-y-3 md:space-y-0"
                      >
                        <div className="flex items-center justify-between md:hidden">
                          <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Line {idx + 1}</span>
                          {fields.length > 1 && (
                            <button type="button" onClick={() => remove(idx)} className="text-red-500 hover:text-red-700 p-1" title="Remove line">
                              <FiTrash2 size={15} />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-2 md:items-end">
                          <div className="md:col-span-4">
                            <label className="form-label text-xs mb-1 md:sr-only">Item / service description *</label>
                            <input
                              {...register(`items.${idx}.description`, { required: true })}
                              className="form-input text-sm py-2"
                              placeholder="e.g. ERP module — Phase 1 implementation"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="form-label text-xs mb-1 md:sr-only">Quantity</label>
                            <input
                              {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                              type="number"
                              min="1"
                              step="1"
                              className="form-input text-sm py-2"
                              placeholder="Qty"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="form-label text-xs mb-1 md:sr-only">Unit price ({watchedCurrency})</label>
                            <input
                              {...register(`items.${idx}.unitPrice`, { valueAsNumber: true })}
                              type="number"
                              min="0"
                              step="0.01"
                              className="form-input text-sm py-2"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="form-label text-xs mb-1 md:sr-only">Discount %</label>
                            <input
                              {...register(`items.${idx}.discount`, { valueAsNumber: true })}
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              className="form-input text-sm py-2"
                              placeholder="0"
                            />
                          </div>
                          <div className="md:col-span-2 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1 md:text-right">
                              <p className="text-[10px] font-semibold uppercase text-slate-400 md:hidden">Line total</p>
                              <p className="text-sm font-bold text-primary tabular-nums md:py-2">
                                {formatMoney(lineTotal, watchedCurrency, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                            {fields.length > 1 && (
                              <button
                                type="button"
                                onClick={() => remove(idx)}
                                className="hidden md:inline-flex text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50"
                                title="Remove line"
                              >
                                <FiX size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Global discount type</label>
                    <select {...register('globalDiscountType')} className="form-select">
                      <option value="fixed">Fixed amount</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Global discount value</label>
                    <input {...register('globalDiscountValue', { valueAsNumber: true })} type="number" min="0" step="0.01" className="form-input" placeholder="0" />
                  </div>
                </div>

                <div className="mt-4 p-4 bg-gray-50 rounded-xl space-y-1 text-sm">
                  <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatMoney(subtotal, watchedCurrency)}</span></div>
                  {discountTotal > 0 && (
                    <div className="flex justify-between text-red-600"><span>Discount</span><span>-{formatMoney(discountTotal, watchedCurrency)}</span></div>
                  )}
                  <div className="flex justify-between text-gray-600"><span>Transport</span><span>{formatMoney(transportCharge, watchedCurrency)}</span></div>
                  <div className="flex justify-between text-gray-600"><span>Tax ({taxRate}%)</span><span>{formatMoney(tax, watchedCurrency)}</span></div>
                  <div className="flex justify-between font-bold text-primary pt-1 border-t border-gray-200"><span>Total</span><span>{formatMoney(total, watchedCurrency)}</span></div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div><label className="form-label text-xs">Advance</label>
                      <input {...register('advanceAmount', { valueAsNumber: true })} type="number" min="0" step="0.01" className="form-input" />
                    </div>
                    <div><label className="form-label text-xs">Balance due</label>
                      <p className="form-input bg-white font-semibold">{formatMoney(balance, watchedCurrency)}</p>
                    </div>
                  </div>
                  {watchedCurrency !== 'LKR' && Number(watch('exchangeRateToLKR')) > 0 && (
                    <p className="text-xs text-slate-500">≈ {formatMoney(total * Number(watch('exchangeRateToLKR')), 'LKR')} at current rate</p>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="form-label">Transport charge</label>
                  <input {...register('transportCharge', { valueAsNumber: true })} type="number" min="0" step="0.01" className="form-input" /></div>
                <div><label className="form-label">Prepared by</label>
                  <input {...register('preparedBy')} className="form-input" placeholder={user?.name || 'Your name'} /></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="form-label">Payment method</label>
                  <select {...register('paymentMethod')} className="form-select">
                    {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select></div>
                <div><label className="form-label">Select bank</label>
                  <select
                    {...register('bankAccount')}
                    className="form-select"
                    onChange={(e) => {
                      register('bankAccount').onChange(e)
                      const selected = banks.find((b) => String(b._id) === String(e.target.value))
                      if (selected?.branchName) {
                        setValue('bankBranch', selected.branchName, { shouldDirty: true })
                      }
                    }}
                  >
                    <option value="">— None —</option>
                    {banks.map((b) => <option key={b._id} value={b._id}>{b.bankName} · {b.accountNumber}</option>)}
                  </select></div>
              </div>
              <div><label className="form-label">Bank branch</label>
                <input {...register('bankBranch')} className="form-input" placeholder="e.g. Kandy Branch" /></div>
              {watch('paymentMethod') === 'custom' && (
                <div><label className="form-label">Custom payment label</label>
                  <input {...register('paymentMethodCustom')} className="form-input" /></div>
              )}
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="form-label">Authorized signatory role</label>
                  <select
                    {...register('directorRole')}
                    className="form-select"
                    onChange={(e) => {
                      register('directorRole').onChange(e)
                      const meta = directorMetaForRole(e.target.value)
                      setValue('directorName', meta.name, { shouldDirty: true })
                      setValue('directorSealUrl', meta.sealUrl, { shouldDirty: true })
                    }}
                  >
                    {DIRECTOR_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select></div>
                <div><label className="form-label">Director / signatory name</label>
                  <SearchableSelect
                    value={watch('directorName')}
                    initialLabel={watch('directorName') || ''}
                    onChange={(val, opt) => {
                      // Strip employee number like "John (EMP-001)" → "John"
                      const raw = opt?.label || val || ''
                      const name = raw.replace(/\s*\([^)]*\)\s*$/, '').trim()
                      setValue('directorName', name, { shouldDirty: true })
                    }}
                    loadOptions={lookupLoaders.employeesAll()}
                    placeholder={siteSettings.quotationDirectorName || 'Search or type name...'}
                    allowCustom={true}
                  />
                </div>
              </div>
              <input type="hidden" {...register('directorSealUrl')} />

              {/* Seal picker — upload, select saved, save as default, toggle visibility */}
              <div className="mt-3 p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Director / company seal</p>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                    <input type="checkbox" {...register('showSeal')} className="accent-sky-600 w-3.5 h-3.5" />
                    Show on document
                  </label>
                </div>

                {/* Current seal preview */}
                {watch('directorSealUrl') ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={(() => { const u = watch('directorSealUrl'); return u?.startsWith('data:') || u?.startsWith('http') ? u : mediaUrl(u) })()}
                      alt="Seal"
                      className="max-h-14 object-contain rounded border border-slate-200 bg-white p-1"
                    />
                    <button
                      type="button"
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                      onClick={() => setValue('directorSealUrl', '', { shouldDirty: true })}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No seal selected</p>
                )}

                {/* Select from saved seals (per role) */}
                {(() => {
                  const opts = []
                  if (siteSettings.sealUrl) opts.push({ id: '_company', label: 'Company seal', url: siteSettings.sealUrl })
                  ;['admin', 'manager', 'hr'].forEach((k) => {
                    const sig = siteSettings.signatures?.[k]
                    if (sig?.url) opts.push({ id: k, label: `${sig.label || k.charAt(0).toUpperCase() + k.slice(1)} seal`, url: sig.url })
                  })
                  if (opts.length === 0) return null
                  return (
                    <select
                      className="form-select text-sm"
                      value=""
                      onChange={(e) => {
                        const opt = opts.find((o) => o.id === e.target.value)
                        if (opt) setValue('directorSealUrl', opt.url, { shouldDirty: true })
                        e.target.value = ''
                      }}
                    >
                      <option value="">Select saved seal…</option>
                      {opts.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                  )
                })()}

                {/* Upload new seal */}
                <div className="flex flex-wrap items-center gap-2">
                  <label className="btn-outline btn-sm text-xs cursor-pointer inline-flex items-center gap-1">
                    <FiUpload size={12} />
                    Upload seal
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        try {
                          const fd = new FormData()
                          fd.append('image', file)
                          const { data } = await api.post('/uploads/image', fd)
                          if (data.imageUrl) {
                            setValue('directorSealUrl', data.imageUrl, { shouldDirty: true })
                            toast.success('Seal uploaded')
                          }
                        } catch (err) {
                          toast.error(err.response?.data?.message || 'Upload failed')
                        }
                        e.target.value = ''
                      }}
                    />
                  </label>

                  {/* Save as default for selected role */}
                  {watch('directorSealUrl') && (
                    <button
                      type="button"
                      className="text-xs text-secondary hover:text-blue-700 font-medium underline"
                      onClick={async () => {
                        const role = watch('directorRole')
                        const url = watch('directorSealUrl')
                        if (!url) return
                        try {
                          if (role) {
                            const signatures = { ...(siteSettings.signatures || {}) }
                            signatures[role] = { ...(signatures[role] || {}), url }
                            await api.put('/site-settings', { ...siteSettings, signatures })
                            qc.invalidateQueries(SITE_SETTINGS_QUERY_KEY)
                            toast.success(`Seal saved as default for ${role}`)
                          } else {
                            await api.put('/site-settings', { ...siteSettings, sealUrl: url })
                            qc.invalidateQueries(SITE_SETTINGS_QUERY_KEY)
                            toast.success('Seal saved as company default')
                          }
                        } catch {
                          toast.error('Failed to save seal default')
                        }
                      }}
                    >
                      Save as default{watch('directorRole') ? ` for ${watch('directorRole')}` : ' (company)'}
                    </button>
                  )}
                </div>
              </div>

              <div><label className="form-label">Notes</label>
                <textarea {...register('notes')} rows={2} className="form-input resize-none" placeholder="Additional notes for client"/>
                <button type="button" className="text-xs text-secondary mt-1 underline" onClick={() => api.put('/site-settings', { ...siteSettings, quotationNotesTemplate: watch('notes') }).then(() => toast.success('Notes saved as default template'))}>Save notes as default template</button>
              </div>
              <div><label className="form-label">Terms & Conditions</label>
                <textarea {...register('terms')} rows={2} className="form-input resize-none" placeholder="Payment terms, delivery terms..."/>
                <button type="button" className="text-xs text-secondary mt-1 underline" onClick={() => api.put('/site-settings', { ...siteSettings, quotationTermsTemplate: watch('terms') }).then(() => toast.success('Terms saved as default template'))}>Save terms as default template</button>
              </div>

              <div className="flex gap-3 pt-2 sticky bottom-0 bg-white pb-1">
                <button type="button" onClick={closeModal} className="btn-ghost flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="btn-primary flex-1 justify-center">
                  {createMut.isPending || updateMut.isPending ? <span className="spinner"/> : editing ? 'Save & Preview' : 'Create Quotation'}
                </button>
              </div>
            </form>
            <div className={`flex-1 min-h-0 flex flex-col ${mobileTab === 'form' ? 'hidden lg:flex' : 'flex'}`}>
              <QuotationPreviewPanel
                printRootId="quotation-form-preview-root"
                isDraft={!editing?._id}
                quotation={livePreviewQuotation}
                siteSettings={siteSettings}
                bankLabel={bankLabelFor(watch('bankAccount'))}
                showSeal={watch('showSeal') !== false}
                onSaveDraft={editing?._id ? (draft) => previewSaveMut.mutate({
                  id: editing._id,
                  data: {
                    preparedBy: draft.preparedBy,
                    directorName: draft.directorName,
                    directorRole: draft.directorRole || '',
                    directorSealUrl: draft.directorSealUrl || '',
                    bankBranch: draft.bankBranch || '',
                    notes: draft.notes,
                    terms: draft.terms,
                    showSeal: draft.showSeal !== false,
                  },
                }) : undefined}
              />
            </div>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Full document preview — layout, fonts, editable content */}
      {viewing && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-0 sm:p-4 z-[99999]">
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white sm:rounded-2xl shadow-2xl w-full sm:max-w-[95vw] 2xl:max-w-[1600px] h-full sm:h-[96vh] overflow-hidden flex flex-col border-0 sm:border border-slate-200">
            <div className="flex items-start justify-between gap-4 p-4 sm:p-5 border-b bg-slate-50 shrink-0 no-print">
              <div className="min-w-0 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">Preview</h3>
                  <span className="badge badge-navy font-mono text-[10px] sm:text-xs px-2 py-0.5">{viewing.quotationNo}</span>
                </div>
                <div className="flex items-center">
                  <span className={`badge capitalize text-[10px] sm:text-xs px-2 py-0.5 ${STATUS_COLOR[viewing.status] || 'badge-gray'}`}>{viewing.status}</span>
                </div>
              </div>
              <button type="button" onClick={() => setViewing(null)} className="p-2 sm:p-2.5 bg-white hover:bg-slate-100 rounded-xl shrink-0 border border-slate-200 shadow-sm transition-colors"><FiX size={18}/></button>
            </div>
            <QuotationPreviewPanel
              quotation={viewing}
              siteSettings={siteSettings}
              bankLabel={bankLabelFor(viewing.bankAccount?._id || viewing.bankAccount)}
              saving={previewSaveMut.isPending}
              onSaveDraft={(draft) => previewSaveMut.mutate({
                id: viewing._id,
                data: {
                  preparedBy: draft.preparedBy,
                  directorName: draft.directorName,
                  directorRole: draft.directorRole || '',
                  directorSealUrl: draft.directorSealUrl || '',
                  bankBranch: draft.bankBranch || '',
                  notes: draft.notes,
                  terms: draft.terms,
                },
              })}
              onSend={(draft) => {
                previewSaveMut.mutate({
                  id: viewing._id,
                  data: {
                    preparedBy: draft.preparedBy,
                    directorName: draft.directorName,
                    directorRole: draft.directorRole || '',
                    directorSealUrl: draft.directorSealUrl || '',
                    bankBranch: draft.bankBranch || '',
                    notes: draft.notes,
                    terms: draft.terms,
                  },
                }, { onSuccess: () => { setViewing(null); setSendTarget(viewing); setSendMethods({ email: true, sms: false, link: true, pdf: true }) } })
              }}
              onDownloadPdf={(id) => downloadQuotationPdf(id, viewing?.quotationNo)}
            />
          </motion.div>
        </div>,
        document.body
      )}

      {/* Send options */}
      {sendTarget && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100000]">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-lg">Send {sendTarget.quotationNo}</h3>
            <p className="text-sm text-slate-500">Choose one or more delivery methods.</p>
            <div className="space-y-2">
              {[
                { key: 'email', label: 'Email (PDF attached + portal link)' },
                { key: 'sms', label: 'SMS (share link)' },
                { key: 'link', label: 'Copy shareable link only' },
                { key: 'pdf', label: 'Generate PDF (included with email)' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={sendMethods[key]}
                    onChange={(e) => setSendMethods((m) => ({ ...m, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" className="btn-ghost flex-1 justify-center" onClick={() => setSendTarget(null)}>Cancel</button>
              <button
                type="button"
                className="btn-primary flex-1 justify-center"
                disabled={sendMut.isPending || !Object.values(sendMethods).some(Boolean)}
                onClick={() => {
                  const methods = Object.entries(sendMethods).filter(([, v]) => v).map(([k]) => k)
                  sendMut.mutate({ id: sendTarget._id, methods })
                }}
              >
                {sendMut.isPending ? <span className="spinner" /> : 'Send'}
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Quick view */}
      {quickView && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[99999]">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-mono text-sm text-secondary font-bold">{quickView.quotationNo}</p>
                <h3 className="font-bold text-lg text-slate-800">{quickView.client?.name}</h3>
              </div>
              <button type="button" onClick={() => setQuickView(null)} className="p-2 hover:bg-slate-100 rounded-lg"><FiX/></button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-slate-500">Issued</span><span>{new Date(quickView.quotationDate || quickView.createdAt).toLocaleDateString('en-LK')}</span>
              <span className="text-slate-500">Amount</span><span className="font-bold">{formatMoney(quickView.total, quickView.currency)}</span>
              <span className="text-slate-500">Status</span><span className="capitalize">{quickView.status}</span>
              <span className="text-slate-500">Prepared by</span><span>{quickView.preparedBy || quickView.generatedBy?.name || '—'}</span>
              <span className="text-slate-500">Payment</span><span className="capitalize">{quickView.paymentMethod?.replace('_', ' ') || '—'}</span>
              <span className="text-slate-500">Bank</span><span>{quickView.bankAccount ? `${quickView.bankAccount.bankName} · ${quickView.bankAccount.accountNumber}` : bankLabelFor(quickView.bankAccount) || '—'}</span>
              <span className="text-slate-500">Bank branch</span><span>{quickView.bankBranch || quickView.bankAccount?.branchName || '—'}</span>
            </div>
            {quickView.notes && <p className="text-xs text-slate-600 border-t pt-2 line-clamp-3">{quickView.notes}</p>}
            <button type="button" className="btn-outline w-full justify-center" onClick={() => { setQuickView(null); setViewing(quickView) }}>
              Open full preview
            </button>
          </motion.div>
        </div>,
        document.body
      )}

      <ConfirmModal
        open={!!convertTarget}
        title="Convert to invoice"
        message={convertTarget ? `Create an invoice from quotation ${convertTarget.quotationNo}? This will mark the quotation as converted.` : ''}
        confirmLabel="Convert"
        loading={convertMut.isPending}
        onConfirm={() => convertTarget && convertMut.mutate(convertTarget._id)}
        onCancel={() => !convertMut.isPending && setConvertTarget(null)}
      />
      <PasswordConfirmModal
        open={Boolean(deletePending)}
        onClose={() => setDeletePending(null)}
        title="Delete quotation?"
        message={
          deletePending
            ? `This permanently removes ${deletePending.quotationNo}. Enter your admin password to confirm.`
            : ''
        }
        confirmLabel="Delete quotation"
        isSubmitting={deleteMut.isPending}
        onConfirm={async (password) => {
          if (!deletePending) return
          await deleteMut.mutateAsync({ id: deletePending._id, password })
          setDeletePending(null)
        }}
      />
    </div>
  )
}
