import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import api from '../../lib/api'
import { assignableEmployeesUrl } from '../../lib/employeeApi'
import toast from 'react-hot-toast'
import {
  FiPlus,
  FiX,
  FiFileText,
  FiPrinter,
  FiEye,
  FiSearch,
  FiAlertCircle,
  FiEdit2,
  FiCheck,
  FiDownload,
  FiMail,
  FiBriefcase,
  FiBookOpen,
  FiLayers,
  FiClock,
  FiLogOut,
  FiCheckCircle,
  FiAward,
  FiDollarSign,
  FiShield,
  FiEdit3,
  FiBookmark,
  FiCode,
  FiChevronDown,
  FiTrash2,
} from 'react-icons/fi'
import { absoluteMediaUrl } from '../../lib/media'
import { buildCompanyFromSettings, companyContactLines } from '../../lib/companyBranding'
import { useSiteBranding } from '../../hooks/useSiteBranding'
import { openLetterPrint, downloadLetterPdf, buildLetterheadHtml, buildRefDateHtml, buildSigsHtml, buildFooterHtml } from '../../lib/letterDocument'
import LetterPaginatedPreview from '../../components/documents/LetterPaginatedPreview'
import {
  LETTER_SIGNATORY_ROLES,
  normalizeLetterSignatures,
  letterSignaturesToPayload,
  applySignatoryRole,
} from '../../lib/letterSignatures'
import SignaturePad from '../../components/admin/SignaturePad'
import DocumentAssetPicker from '../../components/branding/DocumentAssetPicker'
import PasswordConfirmModal from '../../components/admin/PasswordConfirmModal'
import EnterpriseLetterBuilder, { generateLetterParts } from '../../components/admin/EnterpriseLetterBuilder'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { lookupLoaders } from '../../lib/lookupApi'

const LETTER_TYPES = [
  // Employee Letters
  { value: 'offer', label: 'Offer letter', Icon: FiMail, accent: 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/40', category: 'employee' },
  { value: 'appointment', label: 'Appointment', Icon: FiBriefcase, accent: 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40', category: 'employee' },
  { value: 'internship', label: 'Internship', Icon: FiBookOpen, accent: 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/40', category: 'employee' },
  { value: 'contract', label: 'Contract', Icon: FiLayers, accent: 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/40', category: 'employee' },
  { value: 'part_time', label: 'Part-time', Icon: FiClock, accent: 'border-slate-200 hover:border-slate-400 hover:bg-slate-50/80', category: 'employee' },
  { value: 'resignation', label: 'Resignation acceptance', Icon: FiLogOut, accent: 'border-slate-200 hover:border-red-200 hover:bg-red-50/30', category: 'employee' },
  { value: 'confirmation', label: 'Confirmation', Icon: FiCheckCircle, accent: 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40', category: 'employee' },
  { value: 'experience', label: 'Experience', Icon: FiAward, accent: 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40', category: 'employee' },
  { value: 'salary', label: 'Salary confirmation', Icon: FiDollarSign, accent: 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/40', category: 'employee' },

  // Client Letters
  { value: 'quotation_cover', label: 'Quotation Cover', Icon: FiFileText, accent: 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40', category: 'client' },
  { value: 'welcome', label: 'Welcome Letter', Icon: FiMail, accent: 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/40', category: 'client' },
  { value: 'thank_you', label: 'Thank You', Icon: FiCheckCircle, accent: 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40', category: 'client' },
  { value: 'overdue_notice', label: 'Overdue Notice', Icon: FiAlertCircle, accent: 'border-slate-200 hover:border-red-300 hover:bg-red-50/30', category: 'client' },
  { value: 'renewal_notice', label: 'Renewal Notice', Icon: FiClock, accent: 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/40', category: 'client' },

  // Shared
  { value: 'service_agreement', label: 'Service Letter Agreement', Icon: FiShield, accent: 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/40', category: 'both' },
  { value: 'custom', label: 'Custom letter', Icon: FiEdit3, accent: 'border-slate-200 hover:border-slate-400 hover:bg-slate-50/80', category: 'both' },
]

const TYPE_MAP = Object.fromEntries(LETTER_TYPES.map((t) => [t.value, t]))

function toInputDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toISOString().split('T')[0]
}

function formatInternDuration(start, end, durationWeeks) {
  if (durationWeeks != null && !Number.isNaN(Number(durationWeeks))) {
    const w = Number(durationWeeks)
    return `${w} week${w === 1 ? '' : 's'}`
  }
  if (!start || !end) return ''
  const ms = new Date(end) - new Date(start)
  if (ms <= 0) return ''
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24))
  const months = Math.round(days / 30)
  if (months >= 1) return `${months} month${months === 1 ? '' : 's'}`
  return `${days} day${days === 1 ? '' : 's'}`
}

function isHtmlContent(s) {
  return typeof s === 'string' && /^\s*</.test(s)
}

const LETTER_QUILL_FORMATS = ['bold', 'italic', 'underline', 'strike', 'size', 'font', 'color', 'background', 'align', 'list', 'blockquote', 'link', 'indent']

export default function AdminLetters() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [preview, setPreview] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [letterEditHtmlSource, setLetterEditHtmlSource] = useState(false)
  const [prefilledType, setPrefilledType] = useState('')
  const [activeTab, setActiveTab] = useState('employee')
  const [signatures, setSignatures] = useState(() =>
    normalizeLetterSignatures({}, {}),
  )
  const [selectedTplId, setSelectedTplId] = useState('')
  const [showLetterTemplates, setShowLetterTemplates] = useState(false)
  const [tplPwdOpen, setTplPwdOpen] = useState(false)
  const [letterPwdOpen, setLetterPwdOpen] = useState(false)
  const [letterDeleteId, setLetterDeleteId] = useState(null)
  const [letterFitToOnePage, setLetterFitToOnePage] = useState(true)
  const [letterScale, setLetterScale] = useState(100)

  const [showBuilder, setShowBuilder] = useState(false)
  const [builderInitialData, setBuilderInitialData] = useState(null)
  const [builderEmployee, setBuilderEmployee] = useState(null)

  // Filters for Issued Letters
  const [filterSearch, setFilterSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const { register, handleSubmit, reset, watch, setValue } = useForm()
  const selectedType = watch('type')
  const watchedEmployeeId = watch('employeeId')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-letters'],
    queryFn: () => api.get('/letters').then((r) => r.data),
  })
  const { data: tplData } = useQuery({
    queryKey: ['letter-templates'],
    queryFn: () => api.get('/letters/templates').then((r) => r.data),
  })
  const { data: empData } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => api.get(assignableEmployeesUrl()).then((r) => r.data),
  })
  const { settings: siteSettings } = useSiteBranding()

  const company = useMemo(() => {
    const co = buildCompanyFromSettings(siteSettings)
    return {
      ...co,
      logo: co.logoPath || co.logo ? absoluteMediaUrl(co.logoPath || co.logo) : '',
      footer: co.footer || co.address || '',
    }
  }, [siteSettings])

  const letterQuillModules = useMemo(
    () => ({
      toolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ size: ['small', false, 'large', 'huge'] }],
        [{ font: [] }],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'link', 'clean'],
      ],
    }),
    []
  )

  const generateMut = useMutation({
    mutationFn: (d) => api.post('/letters/generate', d),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['admin-letters'] })
      toast.success('Letter generated')
      const letter = r.data.letter
      setPreview(letter)
      setEditContent(letter.content)
      setSignatures(normalizeLetterSignatures(letter.signatures, siteSettings))
      setEditMode(false)
      setLetterEditHtmlSource(false)
      closeModal()
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to generate'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/letters/${id}`, payload).then((r) => r.data),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['admin-letters'] })
      const letter = r.letter
      setPreview(letter)
      setEditContent(letter.content)
      setSignatures(normalizeLetterSignatures(letter.signatures, siteSettings))
      setEditMode(false)
      setLetterEditHtmlSource(false)
      toast.success('Letter saved')
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const approvalMut = useMutation({
    mutationFn: ({ id, approvalStatus }) => api.put(`/letters/${id}`, { approvalStatus }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-letters'] })
      toast.success('Approval status updated')
    },
  })

  const saveTplMut = useMutation({
    mutationFn: (body) => api.post('/letters/templates', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['letter-templates'] })
      toast.success('Template saved')
    },
  })

  const delTplMut = useMutation({
    mutationFn: ({ id, password }) => api.delete(`/letters/templates/${id}`, { data: { password } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['letter-templates'] })
      setSelectedTplId('')
      toast.success('Template removed')
    },
  })

  const delLetterMut = useMutation({
    mutationFn: ({ id, password }) => api.delete(`/letters/${id}`, { data: { password } }),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['admin-letters'] })
      qc.invalidateQueries({ queryKey: ['my-letters'] })
      setLetterPwdOpen(false)
      setLetterDeleteId(null)
      setPreview((prev) => (prev && v?.id && prev._id === v.id ? null : prev))
      toast.success('Letter deleted')
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not delete letter'),
  })

  const onSubmit = (d) => {
    if (d.type === 'custom') {
      let builderData = {
         dbLetterType: 'custom',
         dbEmployeeId: d.recipientType === 'employee' ? d.employeeId : undefined,
         dbClientId: d.recipientType === 'client' ? d.clientId : undefined,
         recipientType: d.recipientType || 'employee'
      }
      
      if (d.recipientType === 'employee') {
         const emp = (empData?.employees || []).find(e => e._id === d.employeeId)
         setBuilderEmployee(emp)
      } else {
         setBuilderEmployee(null) // Or fetch client data if needed, but the builder will handle it
      }
      
      let initData = builderData
      if (selectedTplId) {
        const t = templates.find((x) => x._id === selectedTplId)
        if (t) {
          initData = {
            ...initData,
            title: t.name,
            content: t.content,
            structuredData: t.structuredData,
          }
        }
      }
      
      setBuilderInitialData(initData) // New custom letter
      setShowModal(false)
      setShowBuilder(true)
      return
    }

    generateMut.mutate({
      recipientType: d.recipientType || 'employee',
      employeeId: d.recipientType === 'employee' ? d.employeeId : undefined,
      clientId: d.recipientType === 'client' ? d.clientId : undefined,
      type: d.type,
      approvalStatus: d.approvalStatus || 'none',
      data: {
        startDate: d.startDate,
        endDate: d.endDate,
        confirmationDate: d.confirmationDate,
        resignationDate: d.resignationDate,
        noticePeriod: d.noticePeriod,
        purpose: d.purpose,
        scope: d.scope,
        duration: d.duration,
        supervisor: d.supervisor,
        workingHours: d.workingHours,
        workingDays: d.workingDays,
        hourlyRate: d.hourlyRate,
        reportingManager: d.reportingManager,
        signatures: letterSignaturesToPayload(signatures),
      },
    })
  }

  const openModal = (type = '') => {
    setPrefilledType(type)
    const tDef = TYPE_MAP[type]
    const defaultRecipient = tDef?.category === 'client' ? 'client' : 'employee'
    reset({ type: type || '', approvalStatus: 'none', recipientType: defaultRecipient })
    setSignatures(normalizeLetterSignatures({}, siteSettings))
    setSelectedTplId('')
    setShowLetterTemplates(false)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setPrefilledType('')
    setShowLetterTemplates(false)
    reset()
  }

  const openPreview = (l) => {
    let finalContent = l.content
    if (l.type === 'custom' && l.structuredData) {
      const parts = generateLetterParts(l.structuredData, company, l.structuredData.sections || { header: true, from: false, to: true, info: true, body: true, signatures: true, footer: true })
      finalContent = parts.full
    }
    setPreview({ ...l, content: finalContent })
    setEditContent(finalContent)
    setEditMode(false)
    setLetterEditHtmlSource(false)
    setSignatures(normalizeLetterSignatures(l.signatures, siteSettings))
  }

  const resolveLetterBody = (letter) => {
    if (letter.type === 'custom' && letter.structuredData) {
      const parts = generateLetterParts(
        letter.structuredData,
        company,
        letter.structuredData.sections || { header: true, from: false, to: true, info: true, body: true, signatures: true, footer: true },
      )
      return { bodyHtml: parts.full, isFullHtml: true }
    }
    return { bodyHtml: letter.content, isFullHtml: Boolean(letter.structuredData) }
  }

  const printOpts = (letter, sigState = signatures, bodyOverride) => {
    const resolved = bodyOverride || resolveLetterBody(letter)
    return {
      company,
      siteSettings,
      letterTitle: letter.title,
      letterRef: letter.letterRef,
      issuedDate: letter.issuedDate,
      bodyHtml: bodyOverride?.bodyHtml ?? (editMode && preview?._id === letter._id ? editContent : resolved.bodyHtml),
      signatures: sigState,
      isFullHtml: bodyOverride?.isFullHtml ?? resolved.isFullHtml,
      fitToOnePage: letterFitToOnePage,
      letterScale: letterScale / 100,
    }
  }

  const sigsForOutput = (letter) =>
    normalizeLetterSignatures(letter.signatures || signatures, siteSettings)

  const handlePrint = (letter) => {
    openLetterPrint(printOpts(letter, sigsForOutput(letter)))
  }

  const handlePdf = async (letter) => {
    try {
      await downloadLetterPdf(printOpts(letter, sigsForOutput(letter)), letter.letterRef || 'letter')
      toast.success('PDF downloaded')
    } catch {
      toast.error('PDF export failed')
    }
  }

  const letters = data?.letters || []
  const templates = tplData?.templates || []

  const filteredLetters = useMemo(() => {
    return letters.filter((l) => {
      // type filter
      if (filterType === 'employee' && !l.employee) return false
      if (filterType === 'client' && !l.client) return false
      
      // date range
      if (filterDateFrom && new Date(l.issuedDate) < new Date(filterDateFrom)) return false
      if (filterDateTo && new Date(l.issuedDate) > new Date(filterDateTo)) return false

      // search filter
      if (filterSearch) {
        const q = filterSearch.toLowerCase()
        const empName = `${l.employee?.profile?.firstName || ''} ${l.employee?.profile?.lastName || ''}`.trim() || l.employee?.name || ''
        const cliName = l.client?.profile?.companyName || l.client?.name || ''
        const ref = l.letterRef || ''
        
        if (!empName.toLowerCase().includes(q) && 
            !cliName.toLowerCase().includes(q) && 
            !ref.toLowerCase().includes(q) &&
            !l.title?.toLowerCase().includes(q)) {
          return false
        }
      }
      return true
    })
  }, [letters, filterSearch, filterType, filterDateFrom, filterDateTo])

  useEffect(() => {
    if (!showModal || selectedType !== 'internship' || !watchedEmployeeId || watchedEmployeeId === 'custom') return
    let cancelled = false
    api.get(`/employees/${watchedEmployeeId}`)
      .then((res) => {
        if (cancelled) return
        const emp = res.data?.employee
        const intern = emp?.internship
        if (!intern) return
        const start = toInputDate(intern.startDate)
        const end = toInputDate(intern.endDate)
        if (start) setValue('startDate', start, { shouldDirty: true })
        if (end) setValue('endDate', end, { shouldDirty: true })
        const duration = formatInternDuration(intern.startDate, intern.endDate, intern.durationWeeks)
        if (duration) setValue('duration', duration, { shouldDirty: true })
        if (intern.supervisorName) setValue('supervisor', intern.supervisorName, { shouldDirty: true })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [showModal, selectedType, watchedEmployeeId, setValue])

  const loadTemplate = (id) => {
    if (!id) return
    const t = templates.find((x) => x._id === id)
    if (!t) return
    if (t.type) setValue('type', t.type)
    toast.success(`Loaded template: ${t.name}`)
  }

  if (showBuilder) {
    return createPortal(
      <div className="fixed inset-0 z-[99999] bg-slate-50 flex flex-col">
        <EnterpriseLetterBuilder 
          initialData={builderInitialData}
          employee={builderEmployee}
          company={company}
          employeesList={empData?.employees || []}
          letterTypesList={LETTER_TYPES}
          onSave={(payload) => {
             if (builderInitialData?._id) {
               updateMut.mutate({ id: builderInitialData._id, payload: { ...payload, type: payload.dbLetterType } })
             } else {
               generateMut.mutate({ 
                 employeeId: payload.dbEmployeeId || (builderEmployee ? builderEmployee._id : 'custom'), 
                 clientId: builderInitialData?.dbClientId,
                 recipientType: builderInitialData?.recipientType || 'employee',
                 type: payload.dbLetterType || 'custom', 
                 approvalStatus: 'none', 
                 data: payload 
               })
             }
             setShowBuilder(false)
          }}
          onCancel={() => setShowBuilder(false)}
          isSaving={generateMut.isPending || updateMut.isPending}
        />
      </div>,
      document.body
    )
  }

  return (
    <div className="erp-module space-y-8 animate-fade-in pb-12">
      <div className="page-header">
        <div>
          <h1 className="page-title">Letter management</h1>
          <p className="page-subtitle">Corporate HR letters with branding, PDF export, signatures, and approvals</p>
        </div>
        <button type="button" onClick={() => openModal()} className="btn-primary gap-2">
          <FiPlus size={16} /> Generate letter
        </button>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-xl p-3.5 flex items-center justify-between gap-4 flex-wrap text-xs text-blue-900">
        <div className="flex items-center gap-2">
          <span className="font-bold text-primary">💡 Note:</span>
          <span>For full multi-page legal contracts, service agreements, or employee agreements, please use the <strong>Agreements & Contracts Module</strong>.</span>
        </div>
        <a href="/admin/agreements" className="btn-ghost btn-xs text-primary font-bold hover:underline bg-white border border-blue-200">
          Open Agreements →
        </a>
      </div>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Templates</h2>
            <p className="text-xs text-slate-500 mt-0.5">Choose a letter category and type — content is generated with company letterhead on print/PDF</p>
          </div>
        </div>

        {/* Categories Tab Bar */}
        <div className="flex border border-slate-200/80 mb-6 bg-slate-50 p-1 rounded-xl gap-1 max-w-md">
          {[
            { value: 'employee', label: 'HR & Employee' },
            { value: 'client', label: 'Customer' },
            { value: 'both', label: 'General / Shared' }
          ].map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.value
                  ? 'bg-white text-primary shadow-sm border border-slate-200/30'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {(() => {
            const types = LETTER_TYPES.filter(lt => lt.category === activeTab)
            if (!types.length) return <p className="text-sm text-slate-400">No templates found in this category.</p>
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {types.map((lt) => {
                  const Icon = lt.Icon
                  return (
                    <button
                      key={lt.value}
                      type="button"
                      onClick={() => openModal(lt.value)}
                      className={`finance-tx-card text-left p-4 border-2 transition-all group ${lt.accent}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-primary shrink-0 group-hover:border-secondary/40">
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 leading-tight group-hover:text-primary">{lt.label}</p>
                          <p className="text-[11px] text-slate-500 mt-1 capitalize">{lt.value.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </section>

      <section className="card card-body border-slate-200/90">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Issued letters</h2>
          <span className="text-xs text-slate-500">{filteredLetters.length} on file</span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200/60">
          <div className="relative flex-1 min-w-[200px]">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              value={filterSearch} 
              onChange={e => setFilterSearch(e.target.value)} 
              placeholder="Search by name, reference..." 
              className="form-input !pl-9" 
            />
          </div>
          <select className="form-select w-auto" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="all">All Recipients</option>
            <option value="employee">Employees Only</option>
            <option value="client">Customers Only</option>
          </select>
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              className="form-input w-auto text-sm" 
              value={filterDateFrom} 
              onChange={e => setFilterDateFrom(e.target.value)} 
              title="From Date"
            />
            <span className="text-slate-400">-</span>
            <input 
              type="date" 
              className="form-input w-auto text-sm" 
              value={filterDateTo} 
              onChange={e => setFilterDateTo(e.target.value)} 
              title="To Date"
            />
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="table-container border-0 shadow-none rounded-xl overflow-x-auto w-full">
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Employee / Customer</th>
                <th>Type</th>
                <th>Issued</th>
                <th>Approval</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-14">
                    <div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredLetters.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-14 text-slate-400">
                    <FiFileText size={40} className="mx-auto mb-2 opacity-25" />
                    {letters.length === 0 ? 'No letters yet. Generate one from the templates above.' : 'No letters match your filters.'}
                  </td>
                </tr>
              ) : (
                filteredLetters.map((l) => (
                  <tr key={l._id}>
                    <td className="font-mono text-xs text-slate-600">{l.letterRef || '—'}</td>
                    <td>
                      <div className="font-medium text-slate-800">
                        {l.recipientType === 'client' 
                          ? l.client?.name || l.structuredData?.recipientName || 'Unknown Customer' 
                          : l.employee?.userId?.name || l.structuredData?.recipientName || 'Unknown Employee'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {l.recipientType === 'client' ? 'Customer' : l.employee?.employeeNo || 'Employee'}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-navy capitalize">{TYPE_MAP[l.type]?.label || l.type}</span>
                    </td>
                    <td className="text-sm text-slate-600 whitespace-nowrap">
                      {l.issuedDate ? new Date(l.issuedDate).toLocaleDateString('en-LK') : '—'}
                      <div className="text-xs text-slate-400">{l.issuedBy?.name}</div>
                    </td>
                    <td>
                      <select
                        className="form-select text-xs py-1.5 min-w-[7.5rem]"
                        value={l.approvalStatus || 'none'}
                        onChange={(e) => approvalMut.mutate({ id: l._id, approvalStatus: e.target.value })}
                      >
                        <option value="none">None</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                      </select>
                    </td>
                    <td className="text-right">
                      <div className="inline-flex flex-wrap justify-end gap-0.5">
                        <button type="button" title="Preview" onClick={() => openPreview(l)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><FiEye size={15} /></button>
                        <button type="button" title="Print" onClick={() => handlePrint(l)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><FiPrinter size={15} /></button>
                        <button type="button" title="PDF" onClick={() => handlePdf(l)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><FiDownload size={15} /></button>
                        <button type="button" title="Delete letter" onClick={() => { setLetterDeleteId(l._id); setLetterPwdOpen(true) }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><FiTrash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showModal && createPortal(
        <AnimatePresence>
          <div 
            className="fixed inset-0 bg-black/50 flex items-stretch sm:items-center sm:justify-center z-[99999] sm:p-4"
            onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal() }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white sm:rounded-2xl shadow-2xl w-full sm:max-w-lg sm:h-auto sm:max-h-[92vh] flex flex-col"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 sm:p-5 border-b bg-slate-50 shrink-0">
                <h3 className="text-lg font-bold text-primary font-heading">Generate letter</h3>
                <button type="button" onClick={closeModal} className="p-2 hover:bg-slate-200 rounded-lg">
                  <FiX />
                </button>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
                {templates.length === 0 ? (
                  <p className="text-xs text-slate-400 px-0.5">
                    No saved letter templates yet. After you generate a letter, use &quot;Save template&quot; in the preview to store one here.
                  </p>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowLetterTemplates((v) => !v)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100/80 transition-colors"
                    >
                      <span>Optional: apply a saved letter template</span>
                      <FiChevronDown className={`shrink-0 text-slate-400 transition-transform ${showLetterTemplates ? 'rotate-180' : ''}`} size={18} />
                    </button>
                    {showLetterTemplates ? (
                      <div className="px-4 pb-4 pt-0 space-y-2 border-t border-slate-100 bg-white">
                        <p className="text-xs text-slate-500 pt-3 leading-relaxed">
                          Pick a template to set the letter type from your saved list. This does not paste full letter HTML into the form.
                        </p>
                        <div className="flex gap-2">
                          <select
                            className="form-select flex-1 text-sm"
                            value={selectedTplId}
                            onChange={(e) => {
                              setSelectedTplId(e.target.value)
                              loadTemplate(e.target.value)
                            }}
                          >
                            <option value="">Choose template…</option>
                            {templates.map((t) => (
                              <option key={t._id} value={t._id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                          {selectedTplId ? (
                            <button
                              type="button"
                              className="btn-ghost text-xs border border-slate-200 shrink-0 text-red-600 hover:bg-red-50"
                              onClick={() => setTplPwdOpen(true)}
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="radio" value="employee" {...register('recipientType')} className="form-radio" defaultChecked />
                    Employee
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="radio" value="client" {...register('recipientType')} className="form-radio" />
                    Customer
                  </label>
                </div>
                {watch('recipientType') === 'client' ? (
                  <div>
                    <label className="form-label">Customer *</label>
                    <SearchableSelect
                      value={watch('clientId')}
                      onChange={(v) => setValue('clientId', v, { shouldValidate: true })}
                      loadOptions={async (params) => {
                        const res = await lookupLoaders.clients()(params)
                        if (params.page === 1) {
                          const customOpt = { value: 'custom', label: '-- External / Custom (No Customer) --' }
                          if (!params.search || customOpt.label.toLowerCase().includes(params.search.toLowerCase()) || 'custom'.includes(params.search.toLowerCase())) {
                            res.options.unshift(customOpt)
                          }
                        }
                        return res
                      }}
                      placeholder="Search customer…"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="form-label">Employee *</label>
                    <SearchableSelect
                      value={watch('employeeId')}
                      onChange={(v) => setValue('employeeId', v, { shouldValidate: true })}
                      loadOptions={async (params) => {
                        const res = await lookupLoaders.employees()(params)
                        if (params.page === 1) {
                          const customOpt = { value: 'custom', label: '-- External / Custom (No Employee) --' }
                          if (!params.search || customOpt.label.toLowerCase().includes(params.search.toLowerCase()) || 'custom'.includes(params.search.toLowerCase())) {
                            res.options.unshift(customOpt)
                          }
                        }
                        return res
                      }}
                      placeholder="Search employee…"
                    />
                  </div>
                )}
                <div>
                  <label className="form-label">Letter type *</label>
                  <SearchableSelect
                    value={selectedType}
                    onChange={(v) => setValue('type', v, { shouldValidate: true })}
                    loadOptions={async ({ search }) => {
                      const q = (search || '').toLowerCase()
                      const currentRecip = watch('recipientType')
                      const options = LETTER_TYPES
                        .filter(lt => !lt.category || lt.category === 'both' || lt.category === currentRecip)
                        .filter(lt => lt.label.toLowerCase().includes(q) || lt.value.includes(q))
                        .map(lt => ({ value: lt.value, label: lt.label }))
                      return { options, hasMore: false }
                    }}
                    placeholder="Search type…"
                  />
                </div>
                <div>
                  <label className="form-label">Approval before issue (optional)</label>
                  <select {...register('approvalStatus')} className="form-select">
                    <option value="none">None — issue immediately</option>
                    <option value="pending">Mark as pending HR approval</option>
                    <option value="approved">Mark as approved</option>
                  </select>
                </div>

                {(selectedType === 'offer' || selectedType === 'contract' || selectedType === 'part_time' || selectedType === 'internship') && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Start date</label>
                      <input {...register('startDate')} type="date" className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">End date</label>
                      <input {...register('endDate')} type="date" className="form-input" />
                    </div>
                  </div>
                )}
                {selectedType === 'appointment' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Reporting manager</label>
                        <input {...register('reportingManager')} className="form-input" placeholder="Name (overrides employee record)" />
                      </div>
                      <div>
                        <label className="form-label">Working hours</label>
                        <input {...register('workingHours')} className="form-input" placeholder="e.g. 9:00–17:30 Mon–Fri" />
                      </div>
                    </div>
                  </div>
                )}
                {selectedType === 'internship' && (
                  <>
                    <div>
                      <label className="form-label">Duration</label>
                      <input {...register('duration')} className="form-input" placeholder="e.g. 3 months" />
                    </div>
                    <div>
                      <label className="form-label">Supervisor</label>
                      <input {...register('supervisor')} className="form-input" placeholder="Supervisor / mentor" />
                    </div>
                  </>
                )}
                {selectedType === 'contract' && (
                  <div>
                    <label className="form-label">Notice period</label>
                    <input {...register('noticePeriod')} className="form-input" placeholder="e.g. 30 days" />
                  </div>
                )}
                {selectedType === 'part_time' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Hours / day</label>
                      <input {...register('workingHours')} className="form-input" placeholder="e.g. 4 hours" />
                    </div>
                    <div>
                      <label className="form-label">Days / week</label>
                      <input {...register('workingDays')} className="form-input" placeholder="e.g. Mon–Fri" />
                    </div>
                    <div className="col-span-2">
                      <label className="form-label">Hourly rate (LKR)</label>
                      <input {...register('hourlyRate')} className="form-input" placeholder="e.g. 500" />
                    </div>
                  </div>
                )}
                {selectedType === 'resignation' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Resignation date</label>
                      <input {...register('resignationDate')} type="date" className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">Last working date</label>
                      <input {...register('endDate')} type="date" className="form-input" />
                    </div>
                    <div className="col-span-2">
                      <label className="form-label">Notice period</label>
                      <input {...register('noticePeriod')} className="form-input" placeholder="e.g. 30 days" />
                    </div>
                  </div>
                )}
                {selectedType === 'experience' && (
                  <div>
                    <label className="form-label">Last working date</label>
                    <input {...register('endDate')} type="date" className="form-input" />
                  </div>
                )}
                {selectedType === 'confirmation' && (
                  <div>
                    <label className="form-label">Confirmation date</label>
                    <input {...register('confirmationDate')} type="date" className="form-input" />
                  </div>
                )}
                {selectedType === 'salary' && (
                  <div>
                    <label className="form-label">Purpose</label>
                    <input {...register('purpose')} className="form-input" placeholder="e.g. Bank loan" />
                  </div>
                )}
                {selectedType === 'service_agreement' && (
                  <div>
                    <div>
                      <label className="form-label">Start date</label>
                      <input {...register('startDate')} type="date" className="form-input" />
                    </div>
                    <div className="mt-3">
                      <label className="form-label">Scope of service</label>
                      <textarea {...register('scope')} rows={3} className="form-input resize-y min-h-[72px]" placeholder="Scope / responsibilities" />
                    </div>
                  </div>
                )}
                {/* 'custom' type form fields removed as it launches builder */}

                {selectedType && selectedType !== 'custom' && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Signature &amp; seal on print</p>
                    <div>
                      <label className="form-label text-xs">Signatory</label>
                      <select
                        className="form-select text-sm"
                        value={signatures.activeRole || 'admin'}
                        onChange={(e) => setSignatures((s) => applySignatoryRole(e.target.value, siteSettings, s))}
                      >
                        {LETTER_SIGNATORY_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          className="form-checkbox rounded"
                          checked={signatures.includeSignature !== false}
                          onChange={(e) => setSignatures((s) => ({ ...s, includeSignature: e.target.checked }))}
                        />
                        Include signature
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          className="form-checkbox rounded"
                          checked={signatures.includeSeal !== false}
                          onChange={(e) => setSignatures((s) => ({ ...s, includeSeal: e.target.checked }))}
                        />
                        Include company seal
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-500">You can show both, only a signature, only the seal, or neither. Adjust images after generating in the letter preview.</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-slate-100 mt-2">
                  <button type="button" onClick={closeModal} className="btn-ghost flex-1 justify-center gap-2">
                    <FiChevronDown className="rotate-90" /> Cancel
                  </button>
                  <button type="submit" disabled={generateMut.isPending} className="btn-primary flex-1 justify-center">
                    {generateMut.isPending ? <span className="spinner" /> : 'Generate'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {preview &&
        createPortal(
          <div 
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[99999] p-4"
            onMouseDown={(e) => {
              // Close preview when clicking the backdrop (not the modal content)
              if (e.target === e.currentTarget) {
                setPreview(null)
                setEditMode(false)
                setLetterEditHtmlSource(false)
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl h-full sm:max-h-[96vh] overflow-hidden flex flex-col"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Header: title + close */}
              <div className="flex items-center justify-between gap-3 p-3 sm:p-4 border-b bg-slate-50 shrink-0">
                <div className="min-w-0">
                  <p className="text-xs font-mono text-slate-500">{preview.letterRef}</p>
                  <h3 className="font-bold text-slate-900 truncate text-sm sm:text-base">{preview.title}</h3>
                  <span className="badge badge-navy text-[10px] mt-0.5 capitalize">{TYPE_MAP[preview.type]?.label || preview.type}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setPreview(null); setEditMode(false); setLetterEditHtmlSource(false) }}
                  className="p-2 hover:bg-slate-200 rounded-lg shrink-0"
                >
                  <FiX size={18} />
                </button>
              </div>
              {/* Action toolbar — horizontally scrollable on mobile */}
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b bg-white shrink-0 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => {
                      if (preview.type === 'custom') {
                        setBuilderInitialData(preview)
                        setBuilderEmployee(preview.employee)
                        setPreview(null)
                        setShowBuilder(true)
                      } else {
                        setEditMode((m) => {
                          const next = !m
                          if (!next) setLetterEditHtmlSource(false)
                          return next
                        })
                      }
                    }}
                    className={`btn-outline btn-sm ${editMode ? 'border-amber-300 text-amber-700' : ''}`}
                  >
                    <FiEdit2 size={14} /> {preview.type === 'custom' ? 'Open Builder' : (editMode ? 'Done editing' : 'Edit letter')}
                  </button>
                  {editMode && (
                    <button
                      type="button"
                      onClick={() => updateMut.mutate({ id: preview._id, payload: { content: editContent, title: preview.title, type: preview.type, signatures: letterSignaturesToPayload(signatures) } })}
                      disabled={updateMut.isPending}
                      className="btn-primary btn-sm"
                    >
                      {updateMut.isPending ? <span className="spinner" /> : (
                        <>
                          <FiCheck size={14} /> Save
                        </>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const name = window.prompt('Template name')
                      if (!name?.trim()) return
                      saveTplMut.mutate({ name: name.trim(), type: preview.type, content: editContent || preview.content })
                    }}
                    className="btn-ghost btn-sm border border-slate-200"
                  >
                    <FiBookmark size={14} /> Save template
                  </button>
                  <div className="flex flex-wrap items-center gap-3 mr-auto text-xs text-slate-600">
                    <label className="flex items-center gap-1.5 cursor-pointer" title="Tightens spacing and gently shrinks only if needed (min 92%)">
                      <input
                        type="checkbox"
                        checked={letterFitToOnePage}
                        onChange={(e) => setLetterFitToOnePage(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Compact to one page
                    </label>
                    <label className="flex items-center gap-2" title="Adjust print size — preview updates below">
                      <span>Scale</span>
                      <input
                        type="range"
                        min={85}
                        max={115}
                        step={1}
                        value={letterScale}
                        onChange={(e) => setLetterScale(Number(e.target.value))}
                        className="w-28"
                      />
                      <span className="tabular-nums w-10">{letterScale}%</span>
                    </label>
                  </div>
                  <button type="button" onClick={() => handlePrint({ ...preview, content: editContent })} className="btn-primary btn-sm">
                    <FiPrinter size={14} /> Print
                  </button>
                  <button type="button" onClick={() => handlePdf({ ...preview, content: editContent })} className="btn-outline btn-sm">
                    <FiDownload size={14} /> PDF
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setPreview(null); setEditMode(false); setLetterEditHtmlSource(false) }} 
                    className="btn-ghost btn-sm gap-2 border border-slate-200 ml-1 hover:bg-slate-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                  </button>
                </div>

              <div className="overflow-y-auto flex-1 min-h-0">
                <div className="p-4 sm:p-6 bg-[#f1f5f9] space-y-4">

                  {/* â”€â”€ Edit toolbar (only visible in edit mode) â”€â”€ */}
                  {/* ── Letter Editor & Preview (paginated A4 sheets) ── */}
                  <LetterPaginatedPreview
                    scale={letterScale}
                    compact={letterFitToOnePage}
                    measureKey={`${editContent?.length || 0}-${editMode}-${letterScale}-${letterFitToOnePage}`}
                  >
                      {/* Custom letters (with structuredData) already have letterhead, ref, title, sigs, footer baked into content */}
                      {preview.structuredData ? (
                        <>
                          {editMode ? (
                            <div className="mt-4 -mx-[2rem]">
                              <div className="flex flex-wrap items-center justify-between gap-2 px-8 mb-2">
                                <p className="text-[11px] text-slate-500">
                                  <strong>Editing body</strong> — use toolbar for formatting. <span className="font-medium text-slate-600">Raw HTML</span> mode for tables.
                                </p>
                                <button type="button" onClick={() => setLetterEditHtmlSource((s) => !s)} className={`btn-ghost btn-sm shrink-0 border ${letterEditHtmlSource ? 'border-emerald-200 text-emerald-800' : 'border-slate-200'}`}>
                                  <FiCode size={14} /> {letterEditHtmlSource ? 'Rich text' : 'Raw HTML'}
                                </button>
                              </div>
                              {letterEditHtmlSource ? (
                                <div className="px-8"><textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={20} spellCheck={false} className="form-input font-mono text-xs leading-relaxed w-full" /></div>
                              ) : (
                                <div className="border-y border-slate-200 bg-slate-50/30">
                                  <ReactQuill key={`${preview._id}-quill`} theme="snow" value={editContent} onChange={setEditContent} className="letter-quill !border-none" modules={letterQuillModules} formats={LETTER_QUILL_FORMATS} />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="letter-body" style={{ marginTop: '0' }} dangerouslySetInnerHTML={{ __html: editContent || '' }} />
                          )}
                        </>
                      ) : (
                        <>
                          {/* Standard letters: add letterhead and ref, but skip title (body already has its own h1) */}
                          <div dangerouslySetInnerHTML={{ __html: buildLetterheadHtml(company) }} />
                          <div dangerouslySetInnerHTML={{ __html: buildRefDateHtml(preview.letterRef, preview.issuedDate) }} />
                          
                          {editMode ? (
                            <div className="mt-4 -mx-[2rem]">
                              <div className="flex flex-wrap items-center justify-between gap-2 px-8 mb-2">
                                <p className="text-[11px] text-slate-500">
                                  <strong>Editing body</strong> — use toolbar for formatting. <span className="font-medium text-slate-600">Raw HTML</span> mode for tables.
                                </p>
                                <button type="button" onClick={() => setLetterEditHtmlSource((s) => !s)} className={`btn-ghost btn-sm shrink-0 border ${letterEditHtmlSource ? 'border-emerald-200 text-emerald-800' : 'border-slate-200'}`}>
                                  <FiCode size={14} /> {letterEditHtmlSource ? 'Rich text' : 'Raw HTML'}
                                </button>
                              </div>
                              {letterEditHtmlSource ? (
                                <div className="px-8"><textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={20} spellCheck={false} className="form-input font-mono text-xs leading-relaxed w-full" /></div>
                              ) : (
                                <div className="border-y border-slate-200 bg-slate-50/30">
                                  <ReactQuill key={`${preview._id}-quill`} theme="snow" value={editContent} onChange={setEditContent} className="letter-quill !border-none" modules={letterQuillModules} formats={LETTER_QUILL_FORMATS} />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="letter-body" style={{ marginTop: '4px' }} dangerouslySetInnerHTML={{ __html: editContent || '' }} />
                          )}

                          <div dangerouslySetInnerHTML={{ __html: buildSigsHtml(signatures, { siteSettings }) }} />
                          <div dangerouslySetInnerHTML={{ __html: buildFooterHtml(company) }} />
                        </>
                      )}
                  </LetterPaginatedPreview>

                  {/* ── Signatures editor ── */}
                  <div className="max-w-[794px] mx-auto bg-white border border-slate-200/80 rounded-lg p-5 space-y-4">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Signature &amp; seal</p>
                    <p className="text-xs text-slate-500">Choose a saved signatory from Settings. The signature and seal appear on the right side of the letter, matching the printed layout.</p>
                    <div className="flex flex-wrap gap-4 pb-1">
                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          className="form-checkbox rounded"
                          checked={signatures.includeSignature !== false}
                          onChange={(e) => setSignatures((s) => ({ ...s, includeSignature: e.target.checked }))}
                        />
                        Include signature
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          className="form-checkbox rounded"
                          checked={signatures.includeSeal !== false}
                          onChange={(e) => setSignatures((s) => ({ ...s, includeSeal: e.target.checked }))}
                        />
                        Include company seal
                      </label>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="form-label text-xs">Signatory</label>
                        <select
                          className="form-select text-sm"
                          value={signatures.activeRole || 'admin'}
                          onChange={(e) => setSignatures((s) => applySignatoryRole(e.target.value, siteSettings, s))}
                        >
                          {LETTER_SIGNATORY_ROLES.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="form-label text-xs">Signatory name</label>
                        <input
                          className="form-input text-sm"
                          value={signatures.signatory?.name || ''}
                          onChange={(e) => setSignatures((s) => ({
                            ...s,
                            signatory: { ...s.signatory, name: e.target.value },
                          }))}
                        />
                      </div>
                      <div>
                        <label className="form-label text-xs">Title / designation</label>
                        <input
                          className="form-input text-sm"
                          value={signatures.signatory?.title || ''}
                          onChange={(e) => setSignatures((s) => ({
                            ...s,
                            signatory: { ...s.signatory, title: e.target.value },
                          }))}
                        />
                      </div>
                    </div>
                    <DocumentAssetPicker
                      label="Signature image (from Settings or upload)"
                      value={{ data: signatures.signatory?.data || '' }}
                      onChange={(v) => setSignatures((s) => ({
                        ...s,
                        signatory: { ...s.signatory, data: v.data },
                      }))}
                      roleKey={signatures.activeRole === 'custom' ? 'admin' : signatures.activeRole}
                    />
                    <SignaturePad
                      label="Draw signature"
                      value={signatures.signatory?.data || ''}
                      onChange={(data) => setSignatures((s) => ({
                        ...s,
                        signatory: { ...s.signatory, data },
                      }))}
                    />
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-600 mb-2">Company seal (optional)</p>
                      <DocumentAssetPicker
                        label="Seal"
                        assetType="seal"
                        value={{ data: signatures.seal?.data || '' }}
                        onChange={(v) => setSignatures((s) => ({ ...s, seal: { data: v.data } }))}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      onClick={() => updateMut.mutate({ id: preview._id, payload: { signatures: letterSignaturesToPayload(signatures) } })}
                      disabled={updateMut.isPending}
                    >
                      {updateMut.isPending ? <span className="spinner" /> : 'Save signature'}
                    </button>
                  </div>
                </div>
              </div>

            </motion.div>
          </div>,
          document.body
        )}

      <PasswordConfirmModal
        open={tplPwdOpen}
        onClose={() => setTplPwdOpen(false)}
        title="Delete letter template"
        message="This permanently removes the saved template. Enter your account password to confirm."
        confirmLabel="Delete template"
        isSubmitting={delTplMut.isPending}
        onConfirm={async (password) => {
          if (!selectedTplId) return
          await delTplMut.mutateAsync({ id: selectedTplId, password })
        }}
      />

      <PasswordConfirmModal
        open={letterPwdOpen}
        onClose={() => {
          setLetterPwdOpen(false)
          setLetterDeleteId(null)
        }}
        title="Delete issued letter"
        message='This permanently removes the letter from HR records and employee "My letters". Enter your account password to confirm.'
        confirmLabel="Delete letter"
        isSubmitting={delLetterMut.isPending}
        onConfirm={async (password) => {
          if (!letterDeleteId) return
          await delLetterMut.mutateAsync({ id: letterDeleteId, password })
        }}
      />
    </div>
  )
}


