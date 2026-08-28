import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { FiPlus, FiX, FiFileText, FiPrinter, FiEdit2, FiTrash2, FiSearch, FiDownload, FiClock, FiRotateCcw, FiRotateCw, FiMove } from 'react-icons/fi'
import { useDeleteWithPassword } from '../../components/admin/DeletePasswordGate'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { buildAgreementPrintOpts, buildCompanyFromSettings } from '../../lib/companyBranding'
import { openAgreementPrint, downloadAgreementPdf } from '../../lib/agreementPrint'
import { buildLetterheadHtml, buildRefDateHtml, buildFooterHtml } from '../../lib/letterDocument'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { lookupLoaders } from '../../lib/lookupApi'
import SignaturePad from '../../components/admin/SignaturePad'
import DocumentAssetPicker from '../../components/branding/DocumentAssetPicker'
import { FiBookmark, FiEdit } from 'react-icons/fi'

const AGREEMENT_TYPES = [
  { value: 'client_project', label: 'Client Project Agreement' },
  { value: 'subscription_service', label: 'Subscription Service Agreement' },
  { value: 'invoice_payment', label: 'Invoice Payment Agreement' },
  { value: 'employee_agreement', label: 'Employee Agreement' },
  { value: 'general', label: 'General Agreement' },
  { value: 'custom', label: 'Custom Agreement (blank shell)' },
]

const EMPTY_SIG = () => ({
  provider: { data: '', signerName: '', signerDesignation: '', signerIdNumber: '', sideType: 'Service Provider' },
  client: { data: '', signerName: '', signerDesignation: '', signerIdNumber: '', label: 'Client / Counterparty', sideType: 'Client', subRole: 'Authorized Signatory' },
  witness: { name: '', data: '' },
  seal: { data: '' },
})

export default function Agreements() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [historyFor, setHistoryFor] = useState(null)

  const initialProject = searchParams.get('project') || ''
  const initialClient = searchParams.get('client') || ''
  const initialEmployee = searchParams.get('employee') || ''
  const shouldOpenNew = searchParams.get('new') === 'true'

  const { register, handleSubmit, watch, setValue, reset } = useForm({
    defaultValues: {
      agreementType: 'general',
      partyType: initialEmployee ? 'employee' : 'client',
      client: initialClient,
      employee: initialEmployee,
      project: initialProject,
      invoice: '',
      subscription: '',
      title: '',
      agreementDate: new Date().toISOString().split('T')[0],
      hasFrame: false,
    },
  })

  const [editorContent, setEditorContent] = useState('')
  const [step, setStep] = useState(1)
  const [search, setSearch] = useState('')
  const [signatures, setSignatures] = useState(EMPTY_SIG())
  const [linkEntityType, setLinkEntityType] = useState('client')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const tplQuillRef = useRef(null)
  
  const previewContainerRef = useRef(null)
  const [previewScale, setPreviewScale] = useState(1)

  useEffect(() => {
    if (step !== 2 || !previewContainerRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const w = entry.contentRect.width
        const availableW = w - 32
        if (availableW < 794 && availableW > 0) {
          setPreviewScale(availableW / 794)
        } else {
          setPreviewScale(1)
        }
      }
    })
    ro.observe(previewContainerRef.current)
    return () => ro.disconnect()
  }, [step])

  const TEMPLATE_TOKENS = [
    { label: 'Client Name', value: '{{ClientName}}' },
    { label: 'Project Name', value: '{{ProjectName}}' },
    { label: 'Invoice No', value: '{{InvoiceNo}}' },
    { label: 'Agreement Date', value: '{{AgreementDate}}' },
    { label: 'Total Amount', value: '{{TotalAmount}}' },
    { label: 'Company Name', value: '{{CompanyName}}' },
  ]
  
  const [showTemplatesModal, setShowTemplatesModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [templateContent, setTemplateContent] = useState('')
  const [templateHasFrame, setTemplateHasFrame] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['agreements'],
    queryFn: () => api.get('/agreements').then((r) => r.data),
  })
  const { data: templatesRes } = useQuery({
    queryKey: ['agreement-templates'],
    queryFn: () => api.get('/agreements/templates').then((r) => r.data),
  })
  const { data: siteData } = useQuery({
    queryKey: ['site-settings'],
    queryFn: () => api.get('/site-settings').then((r) => r.data),
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
  const { data: clientsData } = useQuery({ queryKey: ['clients'], queryFn: () => api.get('/auth/users').then((r) => r.data) })
  const { data: projectsData } = useQuery({ queryKey: ['projects'], queryFn: () => api.get('/projects').then((r) => r.data) })
  const { data: invoicesData } = useQuery({ queryKey: ['invoices'], queryFn: () => api.get('/invoices').then((r) => r.data) })

  const site = siteData?.settings || {}
  const templates = templatesRes?.templates || []
  const agreements = (data?.agreements || []).filter(
    (a) =>
      !search ||
      a.title?.toLowerCase().includes(search.toLowerCase()) ||
      a.agreementNo?.toLowerCase().includes(search.toLowerCase())
  )
  const clients = (clientsData?.users || []).filter((u) => u.role === 'client')
  const projects = projectsData?.projects || []
  const invoices = invoicesData?.invoices || []

  const buildPrintOptsWithSite = (s, agr, html) => {
    const base = buildAgreementPrintOpts(s, agr, html, agr?.signatures || signatures)
    return {
      ...base,
      title: agr?.title || watch('title'),
      agreementDate: (() => {
        const d = agr?.agreementDate || (watch('agreementDate') ? new Date(watch('agreementDate')) : null)
        return d ? new Date(d).toLocaleDateString('en-LK') : new Date().toLocaleDateString('en-LK')
      })(),
    }
  }

  const fetchFreshSiteSettings = async () => {
    const res = await qc.fetchQuery({
      queryKey: ['site-settings'],
      queryFn: () => api.get('/site-settings').then((r) => r.data),
    })
    return res?.settings || site
  }

  const generatePreviewMut = useMutation({
    mutationFn: (d) => api.post('/agreements/generate-preview', d),
    onSuccess: (res) => {
      setEditorContent(res.data.content)
      setStep(2)
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message || 'Failed to generate preview'),
  })

  const createMut = useMutation({
    mutationFn: (d) => api.post('/agreements', { ...d, content: editorContent, signatures, hasFrame: watch('hasFrame') }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agreements'] })
      toast.success('Agreement created')
      closeModal()
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/agreements/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agreements'] })
      toast.success('Agreement updated')
      closeModal()
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }) => api.put(`/agreements/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agreements'] })
      toast.success('Status updated')
    },
  })

  const updateApprovalMut = useMutation({
    mutationFn: ({ id, approvalStatus }) => api.put(`/agreements/${id}`, { approvalStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agreements'] })
      toast.success('Approval updated')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/agreements/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agreements'] })
      toast.success('Agreement deleted')
    },
  })

  const { requestDelete: requestDeleteAgreement, DeletePasswordModal: agreementDeleteModal } = useDeleteWithPassword(
    { mutateAsync: (id) => deleteMut.mutateAsync(id) },
    {
      title: 'Delete agreement',
      message: 'Enter your admin password to permanently delete this agreement from the database.',
    }
  )

  const createTplMut = useMutation({
    mutationFn: (body) => {
      if (body._id) return api.put(`/agreements/templates/${body._id}`, body)
      return api.post('/agreements/templates', body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agreement-templates'] })
      toast.success('Template saved')
      setEditingTemplate(null)
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save template'),
  })

  const deleteTplMut = useMutation({
    mutationFn: (id) => api.delete(`/agreements/templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agreement-templates'] })
      toast.success('Template removed')
    },
  })

  const closeModal = () => {
    setShowModal(false)
    setEditing(null)
    setStep(1)
    setEditorContent('')
    setSignatures(EMPTY_SIG())
    setSelectedTemplateId('')
    reset({
      agreementType: 'general',
      client: '',
      project: '',
      invoice: '',
      subscription: '',
      title: '',
      agreementDate: new Date().toISOString().split('T')[0],
      hasFrame: false,
    })
  }

  const openCreate = () => {
    reset({
      agreementType: 'general',
      partyType: 'client',
      client: '',
      employee: '',
      project: '',
      invoice: '',
      subscription: '',
      title: '',
      agreementDate: new Date().toISOString().split('T')[0],
      hasFrame: false,
    })
    setLinkEntityType('client')
    setEditorContent('')
    setSignatures(EMPTY_SIG())
    setStep(1)
    setEditing(null)
    setShowModal(true)
  }

  const openEdit = (agr) => {
    setEditing(agr)
    const pType = agr.partyType || (agr.employee || agr.agreementType === 'employee_agreement' ? 'employee' : 'client')
    setLinkEntityType(pType)
    setValue('agreementType', agr.agreementType)
    setValue('partyType', pType)
    setValue('title', agr.title)
    setValue('client', agr.client?._id || '')
    setValue('employee', agr.employee?._id || '')
    setValue('project', agr.project?._id || '')
    setValue('invoice', agr.invoice?._id || '')
    setValue('agreementDate', agr.agreementDate ? new Date(agr.agreementDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
    setValue('hasFrame', agr.hasFrame || false)
    setEditorContent(agr.content || '')
    setSignatures(
      agr.signatures
        ? {
            provider: {
              data: agr.signatures.provider?.data || '',
              signerName: agr.signatures.provider?.signerName || '',
              signerDesignation: agr.signatures.provider?.signerDesignation || '',
              signerIdNumber: agr.signatures.provider?.signerIdNumber || '',
              sideType: agr.signatures.provider?.sideType || 'Service Provider',
            },
            client: {
              data: agr.signatures.client?.data || '',
              signerName: agr.signatures.client?.signerName || '',
              signerDesignation: agr.signatures.client?.signerDesignation || '',
              signerIdNumber: agr.signatures.client?.signerIdNumber || '',
              label: agr.signatures.client?.label || (pType === 'employee' ? 'Employee / Intern' : 'Client / Counterparty'),
              sideType: agr.signatures.client?.sideType || (pType === 'employee' ? 'Employee / Intern' : 'Client'),
              subRole: agr.signatures.client?.subRole || 'Authorized Signatory',
            },
            witness: { name: agr.signatures.witness?.name || '', data: agr.signatures.witness?.data || '' },
            seal: { data: agr.signatures.seal?.data || '' },
          }
        : EMPTY_SIG()
    )
    setStep(2)
    setShowModal(true)
  }

  const handleGenerateClick = (data) => {
    if (!data.title) return toast.error('Please enter an agreement title')
    generatePreviewMut.mutate({ ...data, partyType: linkEntityType })
  }

  const handleSave = (data) => {
    const payload = { ...data, partyType: linkEntityType, content: editorContent, signatures, hasFrame: data.hasFrame }
    editing ? updateMut.mutate({ id: editing._id, data: payload }) : createMut.mutate(payload)
  }

  const handlePrintAgreement = async (agr) => {
    const s = await fetchFreshSiteSettings()
    openAgreementPrint(buildPrintOptsWithSite(s, agr, agr.content))
  }

  const handlePdfAgreement = async (agr) => {
    try {
      const s = await fetchFreshSiteSettings()
      await downloadAgreementPdf(buildPrintOptsWithSite(s, agr, agr.content), agr.agreementNo || 'agreement')
      toast.success('PDF downloaded')
    } catch {
      toast.error('PDF export failed')
    }
  }

  const loadTemplateIntoEditor = (id) => {
    if (!id) return
    const t = templates.find((x) => x._id === id)
    if (!t) return
    setEditorContent(t.content || '')
    setValue('agreementType', t.agreementType || 'custom')
    setValue('hasFrame', t.hasFrame || false)
    setStep(2)
    toast.success(`Loaded template: ${t.name}`)
  }

  const saveCurrentAsTemplate = () => {
    const name = window.prompt('Template name')
    if (!name || !name.trim()) return
    createTplMut.mutate({ name: name.trim(), content: editorContent, agreementType: watch('agreementType'), hasFrame: watch('hasFrame') })
  }

  const type = watch('agreementType')
  const clientVal = watch('client')
  const projectVal = watch('project')
  const invoiceVal = watch('invoice')

  useEffect(() => {
    if (shouldOpenNew) {
      setShowModal(true)
      if (initialProject) setValue('agreementType', 'client_project')
    }
  }, [shouldOpenNew, initialProject, setValue])

  useEffect(() => {
    if (step === 1 && !editing) {
      const cName = clients.find((c) => c._id === clientVal)?.name || ''
      const pName = projects.find((p) => p._id === projectVal)?.title || ''
      const iNo = invoices.find((i) => i._id === invoiceVal)?.invoiceNo || ''

      let t = ''
      if (type === 'employee_agreement') {
        const empVal = watch('employee')
        const selEmp = (employees || []).find((e) => e._id === empVal)
        const empType = selEmp?.employmentType || (selEmp?.status === 'internship' ? 'intern' : 'permanent')
        t = empType === 'intern' ? 'INTERNSHIP AGREEMENT' : (empType === 'contract' ? 'CONTRACT EMPLOYMENT AGREEMENT' : 'EMPLOYMENT AGREEMENT')
      }
      else if (type === 'client_project' && pName) t = `Project Agreement: ${pName}`
      else if (type === 'invoice_payment' && iNo) t = `Payment Agreement: ${iNo}`
      else if (cName) t = `Agreement with ${cName}`
      if (t) setValue('title', t)

      if (!watch('agreementDate')) {
        setValue('agreementDate', new Date().toISOString().split('T')[0])
      }
    }
  }, [type, clientVal, projectVal, invoiceVal, step, editing, clients, projects, invoices, setValue, watch, employees])

  const focusAgreementId = searchParams.get('agreement')
  useEffect(() => {
    if (!focusAgreementId || !(data?.agreements || []).length) return
    const agr = data.agreements.find((a) => String(a._id) === focusAgreementId)
    if (!agr) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('agreement')
        return next
      }, { replace: true })
      return
    }
    openEdit(agr)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('agreement')
        return next
      },
      { replace: true }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openEdit is stable enough for one-shot deep link
  }, [focusAgreementId, data?.agreements, setSearchParams])

  const approvalBadge = (s) => {
    const map = {
      none: 'bg-slate-100 text-slate-600',
      pending: 'bg-amber-100 text-amber-900',
      approved: 'bg-emerald-100 text-emerald-800',
      rejected: 'bg-red-100 text-red-800',
    }
    return map[s] || map.none
  }

  return (
    <div className="erp-module space-y-6 animate-fade-in pb-10">
      <div className="page-header">
        <div>
          <h1 className="page-title">Agreements</h1>
          <p className="page-subtitle">Corporate agreements, templates, signatures, and approvals</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-2 sm:mt-0">
          <button type="button" onClick={() => setShowTemplatesModal(true)} className="w-full sm:w-auto btn-outline justify-center py-2 text-sm font-semibold transition-all">
            <FiBookmark size={14} className="mr-1" /> Manage templates
          </button>
          <button type="button" onClick={openCreate} className="w-full sm:w-auto btn-primary justify-center py-2 text-sm font-semibold shadow-md hover:shadow-lg transition-all">
            <FiPlus size={14} className="mr-1" /> New agreement
          </button>
        </div>
      </div>

      <div className="card overflow-hidden border border-slate-200 shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative w-full sm:flex-1 sm:max-w-md">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agreements…"
              className="form-input !pl-10 bg-white w-full"
            />
          </div>
          <p className="text-xs text-slate-500 sm:ml-auto">Branding comes from Admin → Settings (logo, address, contact).</p>
        </div>
        <div className="p-0">
          {isLoading ? (
            <div className="text-center py-20">
              <div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto" />
            </div>
          ) : agreements.length === 0 ? (
            <div className="text-center py-20 px-4">
              <FiFileText size={48} className="mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 mb-4">No agreements found.</p>
              <button type="button" onClick={openCreate} className="btn-primary btn-sm mx-auto">
                Create first agreement
              </button>
            </div>
          ) : (
            <>
            {/* Scrollable Table */}
            <div className="table-container border-0 shadow-none rounded-xl overflow-x-auto w-full">
          <table className="table">
            <thead>
              <tr>
                <th>Agreement</th>
                <th>Party Type</th>
                <th>Linked</th>
                <th>Document</th>
                <th>Approval</th>
                <th>Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agreements.map((agr) => {
                const isEmployeeParty = agr.partyType === 'employee' || agr.agreementType === 'employee_agreement' || Boolean(agr.employee)
                const linkedEmp = agr.employee
                const linkedEmpName = linkedEmp?.userId?.name || linkedEmp?.name || ''
                const linkedEmpNo = linkedEmp?.employeeNo || ''
                const linkedEmpDesig = linkedEmp?.designation || ''
                const clientName = agr.client?.name || ''

                return (
                  <tr key={agr._id}>
                    <td>
                      <p className="font-semibold text-slate-800">{agr.title}</p>
                      <p className="text-xs text-slate-500 font-mono">
                        {agr.agreementNo} · {AGREEMENT_TYPES.find((t) => t.value === agr.agreementType)?.label || agr.agreementType}
                      </p>
                    </td>
                    <td>
                      {isEmployeeParty ? (
                        <span className="badge badge-purple font-semibold text-[11px] px-2.5 py-1">
                          {linkedEmp?.employmentType === 'intern' || linkedEmp?.status === 'internship' ? '👤 Intern' : (linkedEmp?.employmentType === 'contract' ? '👤 Contract Employee' : '👤 Employee')}
                        </span>
                      ) : (
                        <span className="badge badge-blue font-semibold text-[11px] px-2.5 py-1">
                          🏢 Client / Counterparty
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        {isEmployeeParty ? (
                          linkedEmpName ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-950">
                              <span className="w-2 h-2 rounded-full shrink-0 bg-purple-600"/>
                              {linkedEmpName}
                              {linkedEmpNo ? <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-mono font-bold">{linkedEmpNo}</span> : null}
                              {linkedEmpDesig ? <span className="text-[11px] text-slate-500 font-normal">· {linkedEmpDesig}</span> : null}
                            </span>
                          ) : <span className="text-slate-400 text-xs">Unlinked Employee</span>
                        ) : (
                          clientName ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-950">
                              <span className="w-2 h-2 rounded-full shrink-0 bg-blue-600"/>
                              {clientName} <span className="text-[11px] text-slate-500 font-normal">(Client)</span>
                            </span>
                          ) : null
                        )}
                        {agr.project && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500 truncate max-w-[180px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0"/>
                            {agr.project.title}
                          </span>
                        )}
                        {agr.invoice && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"/>
                            {agr.invoice.invoiceNo}
                          </span>
                        )}
                        {!linkedEmpName && !clientName && !agr.project && !agr.invoice && <span className="text-slate-300 text-xs">—</span>}
                      </div>
                    </td>
                  <td>
                    <select
                      value={agr.status}
                      onChange={(e) => updateStatusMut.mutate({ id: agr._id, status: e.target.value })}
                      className="form-select text-xs py-1.5 min-w-[8.5rem]"
                    >
                      <option value="draft">Draft</option>
                      <option value="finalised">Finalised</option>
                      <option value="signed">Signed</option>
                      <option value="expired">Expired</option>
                    </select>
                  </td>
                  <td>
                    <select
                      value={agr.approvalStatus || 'none'}
                      onChange={(e) => updateApprovalMut.mutate({ id: agr._id, approvalStatus: e.target.value })}
                      className={`form-select text-xs py-1.5 min-w-[8.5rem] font-semibold border-0 ${approvalBadge(agr.approvalStatus || 'none')}`}
                    >
                      <option value="none">None</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </td>
                  <td className="text-slate-600 whitespace-nowrap text-sm">{new Date(agr.createdAt).toLocaleDateString('en-LK')}</td>
                  <td className="text-right">
                    <div className="flex justify-end flex-wrap gap-1.5 items-center">
                      <button
                        type="button"
                        title="Version history"
                        onClick={() => setHistoryFor(agr)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-800 transition-colors"
                      >
                        <FiClock size={12} /> History
                      </button>
                      <button
                        type="button"
                        title="Print agreement"
                        onClick={() => handlePrintAgreement(agr)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors"
                      >
                        <FiPrinter size={12} /> Print
                      </button>
                      <button
                        type="button"
                        title="Download PDF"
                        onClick={() => handlePdfAgreement(agr)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                      >
                        <FiDownload size={12} /> PDF
                      </button>
                      <button
                        type="button"
                        title="Edit agreement"
                        onClick={() => openEdit(agr)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                      >
                        <FiEdit2 size={12} /> Edit
                      </button>
                      <button
                        type="button"
                        title="Delete agreement"
                        onClick={() => requestDeleteAgreement(agr._id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                      >
                        <FiTrash2 size={12} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            </tbody>
          </table>
            </div>
            </>
          )}
        </div>
      </div>

      {historyFor && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[999999]" >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-primary">Agreement history</h3>
              <button type="button" onClick={() => setHistoryFor(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <FiX size={18} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar text-sm space-y-3">
              {(historyFor.history || []).length === 0 ? (
                <p className="text-slate-400">No history entries yet.</p>
              ) : (
                [...(historyFor.history || [])].reverse().map((h, i) => (
                  <div key={`${h.at}-${i}`} className="border border-slate-100 rounded-xl p-3 bg-slate-50/80">
                    <p className="text-xs text-slate-400">{h.at ? new Date(h.at).toLocaleString('en-LK') : ''}</p>
                    <p className="font-semibold text-slate-700 capitalize">{h.action}</p>
                    {h.detail && <p className="text-slate-600 mt-1">{h.detail}</p>}
                    {h.user?.name && <p className="text-xs text-slate-500 mt-1">By {h.user.name}</p>}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {showModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-0 sm:p-2 lg:p-4 z-[99999]">
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            className={`doc-editor-modal bg-white sm:rounded-2xl shadow-2xl w-full ${step === 1 ? 'sm:max-w-2xl' : 'sm:max-w-[95vw] 2xl:max-w-[1600px]'} h-full ${step === 1 ? 'sm:h-auto sm:max-h-[90vh]' : 'sm:h-[96vh]'} overflow-hidden flex flex-col border-0 sm:border border-slate-200 transition-all duration-300`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 sm:p-4 md:p-5 border-b shrink-0 bg-white z-10">
              <div className="min-w-0 pr-2">
                <h3 className="text-base sm:text-lg font-bold text-primary font-heading truncate">{editing ? 'Edit agreement' : 'New agreement'}</h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{step === 1 ? 'Step 1: Type & records' : 'Step 2: Document & signatures'}</p>
              </div>
              <button type="button" onClick={closeModal} className="p-2 hover:bg-slate-200 rounded-lg shrink-0">
                <FiX size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="agr-form" onSubmit={handleSubmit(step === 1 && !editing ? handleGenerateClick : handleSave)} className="space-y-6">
                {step === 1 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 w-full">
                    <div>
                      <label className="form-label">Agreement type</label>
                      <select {...register('agreementType')} className="form-select">
                        {AGREEMENT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="card card-body space-y-3 border-slate-200">
                      <p className="text-sm font-semibold text-slate-700">Saved templates</p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          className="form-select flex-1"
                          value={selectedTemplateId}
                          onChange={(e) => {
                            setSelectedTemplateId(e.target.value)
                            loadTemplateIntoEditor(e.target.value)
                          }}
                        >
                          <option value="">Load a template…</option>
                          {templates.map((t) => (
                            <option key={t._id} value={t._id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        {selectedTemplateId && (
                          <button
                            type="button"
                            className="btn-ghost border border-slate-200 text-sm whitespace-nowrap"
                            onClick={() => {
                              if (window.confirm('Delete this template?')) {
                                deleteTplMut.mutate(selectedTemplateId, {
                                  onSuccess: () => setSelectedTemplateId(''),
                                })
                              }
                            }}
                          >
                            Delete template
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="card card-body space-y-4 border-slate-200">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h4 className="text-sm font-bold text-slate-700">Link records (auto-fills tokens)</h4>
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                          <button
                            type="button"
                            onClick={() => setLinkEntityType('client')}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${linkEntityType === 'client' ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            Client
                          </button>
                          <button
                            type="button"
                            onClick={() => setLinkEntityType('employee')}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${linkEntityType === 'employee' ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            Employee / Intern
                          </button>
                        </div>
                      </div>

                      {linkEntityType === 'client' ? (
                        <div>
                          <label className="form-label">Client</label>
                          <SearchableSelect
                            value={watch('client')}
                            onChange={(v) => setValue('client', v)}
                            loadOptions={lookupLoaders.clients()}
                            placeholder="Search client…"
                            initialLabel={
                              clients.find((c) => c._id === watch('client'))?.name || 
                              (editing?.client?._id === watch('client') ? `${editing.client.name} (${editing.client.email || ''})` : '')
                            }
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="form-label">Employee / Intern</label>
                          <SearchableSelect
                            value={watch('employee')}
                            onChange={async (empId) => {
                              setValue('employee', empId)
                              if (!empId) return
                              try {
                                const { data: empRes } = await api.get(`/employees/${empId}`)
                                const emp = empRes?.employee
                                if (emp) {
                                  const name = emp.userId?.name || ''
                                  const desig = emp.designation || ''
                                  const idNum = emp.nic || emp.idNumber || emp.employeeNo || ''
                                  const empSubLabel = emp.employmentType === 'intern' || emp.status === 'internship' ? 'Intern' : (emp.employmentType === 'contract' ? 'Contract Employee' : 'Employee')
                                  setSignatures(s => ({
                                    ...s,
                                    client: {
                                      ...s.client,
                                      signerName: name || s.client.signerName,
                                      signerDesignation: desig || s.client.signerDesignation,
                                      signerIdNumber: idNum || s.client.signerIdNumber,
                                      label: empSubLabel,
                                      sideType: empSubLabel,
                                      subRole: empSubLabel,
                                    }
                                  }))
                                }
                              } catch { /* ignore */ }
                            }}
                            loadOptions={lookupLoaders.employeesAll()}
                            placeholder="Search employee / intern…"
                            initialLabel={
                              editing?.employee?.name ? `${editing.employee.name} (${editing.employee.email || ''})` : 
                              (editing?.employee?.userId?.name ? `${editing.employee.userId.name} (${editing.employee.employeeNo || ''})` : '')
                            }
                          />
                        </div>
                      )}

                      {type === 'client_project' && (
                        <div>
                          <label className="form-label">Project</label>
                          <select {...register('project')} className="form-select">
                            <option value="">Select project…</option>
                            {projects.filter((p) => !clientVal || p.client?._id === clientVal).map((p) => (
                              <option key={p._id} value={p._id}>
                                {p.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {type === 'invoice_payment' && (
                        <div>
                          <label className="form-label">Invoice</label>
                          <select {...register('invoice')} className="form-select">
                            <option value="">Select invoice…</option>
                            {invoices.filter((i) => !clientVal || i.client?._id === clientVal).map((i) => (
                              <option key={i._id} value={i._id}>
                                {i.invoiceNo} — LKR {i.total}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="form-label">Title *</label>
                        <input {...register('title', { required: true })} required className="form-input" placeholder="e.g. Service agreement" />
                      </div>
                      <div>
                        <label className="form-label">Agreement date</label>
                        <input type="date" {...register('agreementDate')} className="form-input" />
                      </div>
                      <div className="col-span-full">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                          <input type="checkbox" {...register('hasFrame')} className="form-checkbox text-primary rounded" />
                          Add decorative frame to document
                        </label>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col xl:flex-row gap-6 min-h-[50vh]">
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h4 className="font-bold text-slate-800">{watch('title')}</h4>
                        <div className="flex flex-wrap gap-2">
                          {editing && <span className="badge badge-blue">Editing</span>}
                          <button type="button" className="btn-ghost border border-slate-200 text-xs" onClick={saveCurrentAsTemplate}>
                            Save as template
                          </button>
                          <button
                            type="button"
                            className="btn-ghost border border-slate-200 text-xs"
                            onClick={async () => {
                              const s = await fetchFreshSiteSettings()
                              openAgreementPrint(buildPrintOptsWithSite(s, editing, editorContent))
                            }}
                          >
                            <FiPrinter size={13} /> Print
                          </button>
                          <button
                            type="button"
                            className="btn-ghost border border-slate-200 text-xs"
                            onClick={async () => {
                              try {
                                const s = await fetchFreshSiteSettings()
                                await downloadAgreementPdf(buildPrintOptsWithSite(s, editing, editorContent), editing?.agreementNo || 'agreement')
                                toast.success('PDF downloaded')
                              } catch {
                                toast.error('PDF failed')
                              }
                            }}
                          >
                            <FiDownload size={13} /> PDF
                          </button>
                        </div>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner bg-slate-100 p-2 sm:p-4" ref={previewContainerRef}>
                        <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top center', width: '794px', margin: '0 auto' }}>
                          <div style={{ width: '794px', background: '#fff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', padding: '40px', boxSizing: 'border-box', minHeight: '1123px' }}>
                            <div className={watch('hasFrame') ? 'agreement-frame-wrap' : ''} style={watch('hasFrame') ? { border: '12px double #1e3a8a', borderRadius: '8px', outline: '2px solid #1e3a8a', outlineOffset: '-8px', padding: '32px', background: '#fff' } : {}}>
                            <style dangerouslySetInnerHTML={{ __html: `
                              .enterprise-letter h1, .enterprise-letter h2, .enterprise-letter h3 { color: #0f172a; margin-top: 1.25em; margin-bottom: 0.5em; }
                              .enterprise-letter p { margin: 0 0 12px; }
                              .enterprise-letter ul { margin: 0 0 12px 1.2em; }
                              .enterprise-quill-wrapper .ql-toolbar { border: 1px solid #e2e8f0; border-top-left-radius: 8px; border-top-right-radius: 8px; background: #f8fafc; }
                              .enterprise-quill-wrapper .ql-container { border: 1px solid #e2e8f0; border-top: none; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; font-family: 'Segoe UI', system-ui, sans-serif; font-size: 11pt; line-height: 1.6; color: #1e293b; min-height: 400px; }
                              .enterprise-quill-wrapper .ql-editor { min-height: 400px; }
                            `}} />
                            <div className="enterprise-letter">
                              <div dangerouslySetInnerHTML={{ __html: buildLetterheadHtml(buildCompanyFromSettings(site)) + buildRefDateHtml(editing?.agreementNo || '—', watch('agreementDate') || '') }} />
                              {watch('title') && <h2 style={{margin:'0 0 20px',fontSize:'15pt',fontWeight:'800',color:'#0f172a',letterSpacing:'-0.01em',borderLeft:'4px solid #0ea5e9',paddingLeft:'12px'}}>{watch('title')}</h2>}
                              <div className="enterprise-quill-wrapper">
                                <ReactQuill
                                  theme="snow"
                                  value={editorContent}
                                  onChange={setEditorContent}
                                  modules={{
                                    toolbar: [
                                      [{ font: [] }, { size: ['small', false, 'large', 'huge'] }],
                                      [{ header: [1, 2, 3, 4, 5, 6, false] }],
                                      ['bold', 'italic', 'underline', 'strike'],
                                      [{ color: [] }, { background: [] }],
                                      [{ script: 'sub' }, { script: 'super' }],
                                      [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
                                      [{ align: [] }],
                                      ['blockquote', 'code-block'],
                                      ['link', 'image', 'video'],
                                      ['clean'],
                                    ],
                                  }}
                                />
                              </div>
                              <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid #e2e8f0', pageBreakInside: 'avoid' }}>
                                <div style={{ marginLeft: 'auto', width: 'fit-content', minWidth: '200px', textAlign: 'right', fontFamily: 'system-ui, Segoe UI, sans-serif' }}>
                                  
                                  <div style={{ marginBottom: '24px', textAlign: 'right' }}>
                                    <p style={{ margin: '0 0 8px', fontSize: '10px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>{signatures.provider?.label || 'Service provider'}</p>
                                    {signatures.provider.data ? (
                                      <img src={signatures.provider.data} alt="" style={{ maxHeight: '60px', maxWidth: '180px', objectFit: 'contain', marginLeft: 'auto', display: 'block' }} />
                                    ) : (
                                      <div style={{ borderBottom: '1px solid #0f172a', width: '160px', marginLeft: 'auto', marginTop: '28px' }}></div>
                                    )}
                                    {signatures.provider.signerName && <p style={{ margin: '4px 0 0', fontWeight: '600', fontSize: '10pt', color: '#0f172a' }}>{signatures.provider.signerName}</p>}
                                    {signatures.provider.signerDesignation && <p style={{ margin: '2px 0 0', fontSize: '9pt', color: '#475569' }}>{signatures.provider.signerDesignation}</p>}
                                    {signatures.provider.signerIdNumber && <p style={{ margin: '2px 0 0', fontSize: '8.5pt', color: '#64748b', fontFamily: 'monospace' }}>ID: {signatures.provider.signerIdNumber}</p>}
                                    {!signatures.provider.data && !signatures.provider.signerName && <p style={{ margin: '4px 0 0', fontSize: '10pt', color: '#64748b' }}>Signature</p>}
                                  </div>

                                  <div style={{ marginBottom: '24px', textAlign: 'right' }}>
                                    <p style={{ margin: '0 0 8px', fontSize: '10px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>{signatures.client.label || 'Client / counterparty'}</p>
                                    {signatures.client.data ? (
                                      <img src={signatures.client.data} alt="" style={{ maxHeight: '60px', maxWidth: '180px', objectFit: 'contain', marginLeft: 'auto', display: 'block' }} />
                                    ) : (
                                      <div style={{ borderBottom: '1px solid #0f172a', width: '160px', marginLeft: 'auto', marginTop: '28px' }}></div>
                                    )}
                                    {signatures.client.signerName && <p style={{ margin: '4px 0 0', fontWeight: '600', fontSize: '10pt', color: '#0f172a' }}>{signatures.client.signerName}</p>}
                                    {signatures.client.signerDesignation && <p style={{ margin: '2px 0 0', fontSize: '9pt', color: '#475569' }}>{signatures.client.signerDesignation}</p>}
                                    {signatures.client.signerIdNumber && <p style={{ margin: '2px 0 0', fontSize: '8.5pt', color: '#64748b', fontFamily: 'monospace' }}>ID: {signatures.client.signerIdNumber}</p>}
                                    {!signatures.client.data && !signatures.client.signerName && <p style={{ margin: '4px 0 0', fontSize: '10pt', color: '#64748b' }}>Signature</p>}
                                  </div>

                                  {(signatures.witness.name || signatures.witness.data) && (
                                    <div style={{ marginBottom: '24px', textAlign: 'right' }}>
                                      <p style={{ margin: '0 0 ' + (signatures.witness.data ? '8px' : '36px'), fontSize: '10px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>Witness</p>
                                      {signatures.witness.data ? (
                                        <img src={signatures.witness.data} style={{ maxHeight: '60px', maxWidth: '180px', objectFit: 'contain', marginLeft: 'auto', display: 'block' }} />
                                      ) : (
                                        <div style={{ borderBottom: '1px solid #0f172a', width: '160px', marginLeft: 'auto' }}></div>
                                      )}
                                      {signatures.witness.name && <p style={{ margin: '4px 0 0', fontWeight: '600', fontSize: '10pt', color: '#0f172a' }}>{signatures.witness.name}</p>}
                                    </div>
                                  )}

                                  {signatures.seal?.data && (
                                    <div style={{ textAlign: 'right' }}>
                                      <p style={{ margin: '0 0 8px', fontSize: '10px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>Company Seal</p>
                                      <img src={signatures.seal.data} style={{ maxHeight: '80px', maxWidth: '120px', objectFit: 'contain', marginLeft: 'auto', display: 'block' }} />
                                    </div>
                                  )}

                                </div>
                              </div>
                              <div dangerouslySetInnerHTML={{ __html: buildFooterHtml(buildCompanyFromSettings(site)) }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full xl:w-80 shrink-0 space-y-4 border border-slate-200 rounded-xl p-4 bg-slate-50/80">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Digital Signatures & Roles</p>
                      
                      {/* Provider Side Setup */}
                      <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                        <label className="text-xs font-bold text-slate-600">Provider Side</label>
                        <select
                          className="form-select text-xs py-1.5 w-full"
                          value={signatures.provider?.sideType || 'Service Provider'}
                          onChange={(e) => setSignatures((s) => ({ ...s, provider: { ...s.provider, sideType: e.target.value } }))}
                        >
                          <option value="Service Provider">Service Provider</option>
                          <option value="Company">Company</option>
                        </select>
                        <DocumentAssetPicker label="Provider signature" value={{ data: signatures.provider.data }} onChange={(v) => setSignatures((s) => ({ ...s, provider: { ...s.provider, data: v.data } }))} roleKey="hr" />
                        <input
                          className="form-input text-xs"
                          placeholder="Provider Signatory Name"
                          value={signatures.provider.signerName}
                          onChange={(e) => setSignatures((s) => ({ ...s, provider: { ...s.provider, signerName: e.target.value } }))}
                        />
                        <input
                          className="form-input text-xs"
                          placeholder="Provider Designation (Optional)"
                          value={signatures.provider.signerDesignation || ''}
                          onChange={(e) => setSignatures((s) => ({ ...s, provider: { ...s.provider, signerDesignation: e.target.value } }))}
                        />
                        <SignaturePad
                          label="Provider (Draw)"
                          value={signatures.provider.data}
                          onChange={(data) => setSignatures((s) => ({ ...s, provider: { ...s.provider, data } }))}
                        />
                      </div>

                      {/* Counterparty Side Setup */}
                      <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                        <label className="text-xs font-bold text-slate-600">Counterparty Side</label>
                        <select
                          className="form-select text-xs py-1.5 w-full"
                          value={signatures.client?.sideType || 'Client'}
                          onChange={(e) => setSignatures((s) => ({ ...s, client: { ...s.client, sideType: e.target.value, label: e.target.value === 'Employee / Intern' ? 'Employee / Intern' : 'Client' } }))}
                        >
                          <option value="Client">Client</option>
                          <option value="Employee / Intern">Employee / Intern</option>
                        </select>
                        
                        <label className="text-xs font-semibold text-slate-500 block pt-1">Sub-Role</label>
                        <select
                          className="form-select text-xs py-1.5 w-full"
                          value={signatures.client?.subRole || 'Authorized Signatory'}
                          onChange={(e) => setSignatures((s) => ({ ...s, client: { ...s.client, subRole: e.target.value } }))}
                        >
                          <option value="Director">Director</option>
                          <option value="Authorized Signatory">Authorized Signatory</option>
                          <option value="Manager">Manager</option>
                          <option value="HR">HR</option>
                          <option value="Intern">Intern</option>
                          <option value="Employee">Employee</option>
                        </select>

                        <input
                          className="form-input text-xs"
                          placeholder="Signatory Full Name"
                          value={signatures.client.signerName}
                          onChange={(e) => setSignatures((s) => ({ ...s, client: { ...s.client, signerName: e.target.value } }))}
                        />
                        <input
                          className="form-input text-xs"
                          placeholder="Designation / Position"
                          value={signatures.client.signerDesignation || ''}
                          onChange={(e) => setSignatures((s) => ({ ...s, client: { ...s.client, signerDesignation: e.target.value } }))}
                        />
                        <input
                          className="form-input text-xs font-mono"
                          placeholder="NIC / Employee ID No."
                          value={signatures.client.signerIdNumber || ''}
                          onChange={(e) => setSignatures((s) => ({ ...s, client: { ...s.client, signerIdNumber: e.target.value } }))}
                        />
                        <SignaturePad
                          label={`${signatures.client?.sideType || 'Client'} (${signatures.client?.subRole || 'Signatory'})`}
                          value={signatures.client.data}
                          onChange={(data) => setSignatures((s) => ({ ...s, client: { ...s.client, data } }))}
                        />
                      </div>

                      {/* Witness & Seal */}
                      <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                        <input
                          className="form-input text-xs"
                          placeholder="Witness Name (Optional)"
                          value={signatures.witness.name}
                          onChange={(e) => setSignatures((s) => ({ ...s, witness: { ...s.witness, name: e.target.value } }))}
                        />
                        <SignaturePad
                          label="Witness (Draw)"
                          value={signatures.witness.data}
                          onChange={(data) => setSignatures((s) => ({ ...s, witness: { ...s.witness, data } }))}
                        />
                        <DocumentAssetPicker label="Company Seal" assetType="seal" value={{ data: signatures.seal?.data || '' }} onChange={(v) => setSignatures((s) => ({ ...s, seal: { data: v.data } }))} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </form>
            </div>

            <div className="p-6 border-t bg-slate-50 shrink-0 flex gap-3 flex-wrap">
              {step === 2 && !editing && (
                <button type="button" onClick={() => setStep(1)} className="btn-outline px-6">
                  Back
                </button>
              )}
              <div className="flex-1" />
              <button type="button" onClick={closeModal} className="btn-ghost">
                Cancel
              </button>
              <button
                type="submit"
                form="agr-form"
                disabled={generatePreviewMut.isPending || createMut.isPending || updateMut.isPending}
                className="btn-primary px-8"
              >
                {generatePreviewMut.isPending || createMut.isPending || updateMut.isPending ? (
                  <span className="spinner" />
                ) : step === 1 && !editing ? (
                  'Generate document'
                ) : (
                  'Save agreement'
                )}
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {showTemplatesModal && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[999999]" >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 border-b flex justify-between items-center bg-slate-50 shrink-0">
              <h2 className="text-xl font-bold font-heading text-slate-800">Agreement Templates</h2>
              <button type="button" onClick={() => setShowTemplatesModal(false)} className="p-2 hover:bg-slate-200 rounded-lg">
                <FiX size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 flex gap-6 flex-col md:flex-row">
              <div className="w-full md:w-1/3 shrink-0 flex flex-col gap-3">
                <button
                  type="button"
                  className="btn-primary w-full"
                  onClick={() => {
                    setEditingTemplate({ name: 'New Template', agreementType: 'custom' })
                    setTemplateContent('')
                    setTemplateHasFrame(false)
                  }}
                >
                  <FiPlus /> Create Template
                </button>
                <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 bg-white border border-slate-200 rounded-xl p-2">
                  {templates.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center p-4">No templates created yet.</p>
                  ) : (
                    templates.map(t => (
                      <div key={t._id} className={`p-3 rounded-lg border cursor-pointer transition-colors ${editingTemplate?._id === t._id ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-slate-300'}`} onClick={() => {
                        setEditingTemplate(t)
                        setTemplateContent(t.content || '')
                        setTemplateHasFrame(t.hasFrame || false)
                      }}>
                        <p className="font-semibold text-sm text-slate-800 truncate">{t.name}</p>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{t.agreementType}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 flex flex-col min-h-[400px]">
                {editingTemplate ? (
                  <div className="flex flex-col h-full gap-4">
                    <div className="flex gap-3">
                      <input 
                        className="form-input flex-1 font-bold" 
                        placeholder="Template Name"
                        value={editingTemplate.name}
                        onChange={(e) => setEditingTemplate({...editingTemplate, name: e.target.value})}
                      />
                      <select 
                        className="form-select w-48"
                        value={editingTemplate.agreementType}
                        onChange={(e) => setEditingTemplate({...editingTemplate, agreementType: e.target.value})}
                      >
                        {AGREEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={templateHasFrame}
                          onChange={(e) => setTemplateHasFrame(e.target.checked)}
                          className="form-checkbox text-primary rounded" 
                        />
                        Add decorative frame to document
                      </label>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => tplQuillRef.current?.getEditor()?.history?.undo()} title="Undo (Ctrl+Z)" className="p-1.5 text-slate-500 hover:bg-slate-200 rounded">
                          <FiRotateCcw size={14} />
                        </button>
                        <button type="button" onClick={() => tplQuillRef.current?.getEditor()?.history?.redo()} title="Redo (Ctrl+Y)" className="p-1.5 text-slate-500 hover:bg-slate-200 rounded">
                          <FiRotateCw size={14} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Smart Tokens (Drag & Drop)</p>
                      <div className="flex flex-wrap gap-2">
                        {TEMPLATE_TOKENS.map(tk => (
                          <div 
                            key={tk.value} 
                            className="bg-white border border-slate-200 text-xs font-mono px-2 py-1 rounded shadow-sm flex items-center gap-1 cursor-grab active:cursor-grabbing hover:border-primary hover:text-primary transition-colors"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', tk.value)
                            }}
                          >
                            <FiMove size={10} className="text-slate-400" /> {tk.label}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 min-h-[250px] border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                      <ReactQuill
                        ref={tplQuillRef}
                        theme="snow"
                        value={templateContent}
                        onChange={setTemplateContent}
                        className="flex-1 agreement-quill flex flex-col"
                        modules={{
                          history: { delay: 1000, maxStack: 100, userOnly: true },
                          toolbar: [
                            [{ font: [] }, { size: ['small', false, 'large', 'huge'] }],
                            [{ header: [1, 2, 3, 4, 5, 6, false] }],
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ color: [] }, { background: [] }],
                            [{ script: 'sub' }, { script: 'super' }],
                            [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
                            [{ align: [] }],
                            ['blockquote', 'code-block'],
                            ['link', 'image', 'video'],
                            ['clean'],
                          ],
                        }}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      {editingTemplate._id && (
                        <button 
                          type="button" 
                          onClick={() => {
                            if (window.confirm('Delete template?')) {
                              deleteTplMut.mutate(editingTemplate._id)
                              setEditingTemplate(null)
                            }
                          }}
                          className="btn-ghost text-red-600 mr-auto"
                        >
                          Delete
                        </button>
                      )}
                      <button type="button" onClick={() => setEditingTemplate(null)} className="btn-outline">Cancel</button>
                      <button 
                        type="button" 
                        onClick={() => {
                          if (!editingTemplate.name.trim()) return toast.error('Name required')
                          createTplMut.mutate({
                            _id: editingTemplate._id,
                            name: editingTemplate.name,
                            agreementType: editingTemplate.agreementType,
                            content: templateContent,
                            hasFrame: templateHasFrame
                          })
                        }} 
                        className="btn-primary"
                        disabled={createTplMut.isPending}
                      >
                        {createTplMut.isPending ? <span className="spinner" /> : 'Save Template'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <FiBookmark size={48} className="mb-4 opacity-30" />
                    <p>Select a template to edit or create a new one.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
      {agreementDeleteModal}
    </div>
  )
}
