import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiPlus, FiEdit2, FiTrash2, FiX, FiPackage, FiChevronDown,
  FiCheck, FiLayers, FiTag, FiFilter, FiUpload, FiZap, FiKey,
  FiDollarSign, FiMessageSquare, FiInfo, FiChevronRight, FiChevronLeft
} from 'react-icons/fi'
import { useDeleteWithPassword } from '../../components/admin/DeletePasswordGate'
import { mediaUrl } from '../../lib/media'

const EMPTY_SERVICE = {
  title: '',
  tagline: '',
  description: '',
  type: 'product',
  category: 'ERP',
  badge: 'ERP',
  topHighlights: ['', '', '', ''],
  categorizedFeatures: [
    { categoryName: 'Core Module Features', items: [''] }
  ],
  demoUrl: '',
  demoUsername: '',
  demoPassword: '',
  autoLoginUrl: '',
  price: 0,
  currency: 'LKR',
  billingPeriod: 'monthly',
  priceText: '',
  contactActionType: 'whatsapp',
  whatsappNumber: '',
  imageUrl: '',
  logoUrl: '',
  active: true,
  order: 0
}

export default function AdminServices() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('product') // 'product' | 'service'
  const [filterCategory, setFilterCategory] = useState('All')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_SERVICE)
  const [imageFile, setImageFile] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [step, setStep] = useState(1) // 1, 2, 3, 4
  const [isDragOver, setIsDragOver] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-services'],
    queryFn: () => api.get('/content/services/admin').then(r => r.data),
  })

  const allTabServices = (data?.services || []).filter(s => s.type === tab || (!s.type && tab === 'product'))
  const categories = ['All', ...Array.from(new Set(allTabServices.map(s => s.badge || s.category).filter(Boolean)))]
  const services = filterCategory === 'All' ? allTabServices : allTabServices.filter(s => (s.badge || s.category) === filterCategory)

  // Upload Logo helper
  const uploadImage = async () => {
    if (!imageFile) return form.logoUrl || form.imageUrl || ''
    const fd = new FormData()
    fd.append('image', imageFile)
    const { data: up } = await api.post('/uploads/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    return up.imageUrl
  }

  const createMut = useMutation({
    mutationFn: async (payload) => api.post('/content/services', payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-services'] })
      toast.success('Product/Service created successfully!')
      closeModal()
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed to create item'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/content/services/${id}`, payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-services'] })
      toast.success('Product/Service updated successfully!')
      closeModal()
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed to update item'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/content/services/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-services'] }); toast.success('Deleted') },
  })

  const { requestDelete: requestDeleteService, DeletePasswordModal: serviceDeleteModal } = useDeleteWithPassword(deleteMut, {
    title: 'Delete Item',
    message: 'Enter your admin password to permanently delete this item.',
  })

  const closeModal = () => {
    setShowModal(false)
    setEditing(null)
    setForm(EMPTY_SERVICE)
    setImageFile(null)
    setStep(1)
  }

  const openAddModal = () => {
    setEditing(null)
    setForm({ ...EMPTY_SERVICE, type: tab })
    setImageFile(null)
    setStep(1)
    setShowModal(true)
  }

  const openEditModal = (s) => {
    setEditing(s)
    setForm({
      title: s.title || '',
      tagline: s.tagline || '',
      description: s.description || '',
      type: s.type || 'product',
      category: s.category || 'ERP',
      badge: s.badge || s.category || 'ERP',
      topHighlights: s.topHighlights && s.topHighlights.length === 4 ? s.topHighlights : [(s.topHighlights?.[0] || ''), (s.topHighlights?.[1] || ''), (s.topHighlights?.[2] || ''), (s.topHighlights?.[3] || '')],
      categorizedFeatures: (s.categorizedFeatures && s.categorizedFeatures.length > 0)
        ? s.categorizedFeatures
        : [{ categoryName: 'Core Features', items: s.features || [''] }],
      demoUrl: s.demoUrl || '',
      demoUsername: s.demoUsername || '',
      demoPassword: s.demoPassword || '',
      autoLoginUrl: s.autoLoginUrl || '',
      price: s.price || 0,
      currency: s.currency || 'LKR',
      billingPeriod: s.billingPeriod || 'monthly',
      priceText: s.priceText || '',
      contactActionType: s.contactActionType || 'whatsapp',
      whatsappNumber: s.whatsappNumber || '',
      imageUrl: s.imageUrl || '',
      logoUrl: s.logoUrl || s.imageUrl || '',
      active: s.active !== undefined ? s.active : true,
      order: s.order || 0
    })
    setImageFile(null)
    setStep(1)
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) return toast.error('Please provide a Title in Step 1')
    try {
      const logoUrl = await uploadImage()
      const payload = {
        ...form,
        logoUrl,
        imageUrl: logoUrl,
        topHighlights: form.topHighlights.filter(Boolean),
        categorizedFeatures: form.categorizedFeatures.map(cat => ({
          categoryName: cat.categoryName,
          items: (cat.items || []).filter(Boolean)
        })).filter(c => c.categoryName && c.items.length > 0)
      }

      if (editing) {
        updateMut.mutate({ id: editing._id, payload })
      } else {
        createMut.mutate(payload)
      }
    } catch (err) {
      toast.error('Image upload failed')
    }
  }

  // Feature Builder Handlers
  const addCategory = () => {
    setForm(prev => ({
      ...prev,
      categorizedFeatures: [...prev.categorizedFeatures, { categoryName: '', items: [''] }]
    }))
  }

  const removeCategory = (catIdx) => {
    setForm(prev => ({
      ...prev,
      categorizedFeatures: prev.categorizedFeatures.filter((_, idx) => idx !== catIdx)
    }))
  }

  const addFeatureItem = (catIdx) => {
    setForm(prev => ({
      ...prev,
      categorizedFeatures: prev.categorizedFeatures.map((cat, idx) => {
        if (idx !== catIdx) return cat
        return { ...cat, items: [...cat.items, ''] }
      })
    }))
  }

  const updateFeatureItem = (catIdx, itemIdx, val) => {
    setForm(prev => ({
      ...prev,
      categorizedFeatures: prev.categorizedFeatures.map((cat, idx) => {
        if (idx !== catIdx) return cat
        const newItems = [...cat.items]
        newItems[itemIdx] = val
        return { ...cat, items: newItems }
      })
    }))
  }

  const removeFeatureItem = (catIdx, itemIdx) => {
    setForm(prev => ({
      ...prev,
      categorizedFeatures: prev.categorizedFeatures.map((cat, idx) => {
        if (idx !== catIdx) return cat
        return { ...cat, items: cat.items.filter((_, iIdx) => iIdx !== itemIdx) }
      })
    }))
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {serviceDeleteModal}

      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Products &amp; Software Services</h1>
          <p className="page-subtitle">Configure ready-made ERP products, software services, 1-click demo logins, and pricing quotes.</p>
        </div>
        <button onClick={openAddModal} className="btn-primary gap-2">
          <FiPlus size={16} /> Add New {tab === 'product' ? 'Product' : 'Service'}
        </button>
      </div>

      {/* Type Toggle & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => { setTab('product'); setFilterCategory('All') }}
            className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${tab === 'product' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            📦 Software Products (ERP / SaaS)
          </button>
          <button
            onClick={() => { setTab('service'); setFilterCategory('All') }}
            className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${tab === 'service' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            🛠 Software Services
          </button>
        </div>

        {categories.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto">
            <FiFilter size={13} className="text-slate-400" />
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  filterCategory === cat
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Items List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <span className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : services.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 space-y-3">
          <FiLayers size={40} className="mx-auto text-slate-300" />
          <h3 className="font-bold text-slate-700">No {tab}s Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">Click below to create your first software item with demo login credentials and feature highlights.</p>
          <button onClick={openAddModal} className="btn-primary mt-2">
            <FiPlus size={14} /> Add {tab === 'product' ? 'Product' : 'Service'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map(item => (
            <div key={item._id} className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase rounded-full border border-blue-100">
                    {item.badge || item.category || item.type}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {item.active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {item.logoUrl || item.imageUrl ? (
                    <img src={mediaUrl(item.logoUrl || item.imageUrl)} alt={item.title} className="w-12 h-12 rounded-xl object-contain border border-slate-100 bg-slate-50 p-1" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                      <FiPackage size={20} />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-slate-900 text-base line-clamp-1">{item.title}</h3>
                    <p className="text-xs text-slate-500 font-mono font-bold">
                      {item.priceText || (item.price ? `${item.currency} ${item.price.toLocaleString()}` : 'Custom')}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2">{item.tagline || item.description}</p>

                {/* Highlights */}
                {item.topHighlights && item.topHighlights.length > 0 && (
                  <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Top 4 Highlights</span>
                    {item.topHighlights.slice(0, 4).map((h, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-700 font-medium">
                        <FiCheck className="text-emerald-500 shrink-0" size={12} />
                        <span className="truncate">{h}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">
                  {item.demoUrl ? '🔗 Demo Set' : 'No Demo'}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEditModal(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Edit">
                    <FiEdit2 size={15} />
                  </button>
                  <button onClick={() => requestDeleteService(item._id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Delete">
                    <FiTrash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 4-STEP ADMIN CREATION / EDITING WIZARD MODAL ───────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto border border-slate-100"
            >
              {/* Wizard Modal Header */}
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div>
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block">
                    {editing ? 'Edit Item Configuration' : 'Create Showcase Item'}
                  </span>
                  <h2 className="text-xl font-bold text-white">
                    {form.title || (tab === 'product' ? 'New Software Product' : 'New Software Service')}
                  </h2>
                </div>
                <button onClick={closeModal} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all">
                  <FiX size={20} />
                </button>
              </div>

              {/* 4 Steps Navigation Indicator */}
              <div className="bg-slate-800/90 text-white px-6 py-3 border-b border-slate-700 flex items-center justify-between text-xs font-semibold overflow-x-auto">
                {[
                  { num: 1, label: 'Basic Info & Logo' },
                  { num: 2, label: 'Feature Management' },
                  { num: 3, label: 'Demo & Auto-Login' },
                  { num: 4, label: 'Pricing & Quote Action' }
                ].map(st => (
                  <button
                    key={st.num}
                    onClick={() => setStep(st.num)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                      step === st.num ? 'bg-blue-600 text-white font-bold shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-extrabold ${step === st.num ? 'bg-white text-blue-600' : 'bg-slate-700 text-slate-300'}`}>
                      {st.num}
                    </span>
                    <span>{st.label}</span>
                  </button>
                ))}
              </div>

              {/* Wizard Step Body */}
              <div className="p-6 overflow-y-auto max-h-[65vh] custom-scrollbar space-y-5">
                {/* ── STEP 1: BASIC INFORMATION ────────────────────────────────── */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-700">Category Selection:</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, type: 'product' })}
                          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${form.type === 'product' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'}`}
                        >
                          📦 Product (SaaS / ERP)
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, type: 'service' })}
                          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${form.type === 'service' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'}`}
                        >
                          🛠 Software Service
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Item Title *</label>
                        <input
                          type="text"
                          required
                          value={form.title}
                          onChange={e => setForm({ ...form, title: e.target.value })}
                          placeholder="e.g. Gym Management ERP System"
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Badge Name</label>
                        <input
                          type="text"
                          value={form.badge}
                          onChange={e => setForm({ ...form, badge: e.target.value, category: e.target.value })}
                          placeholder="e.g. ERP, SaaS, Mobile App, Custom Web"
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Short Summary / Tagline (Front Card)</label>
                      <input
                        type="text"
                        value={form.tagline}
                        onChange={e => setForm({ ...form, tagline: e.target.value })}
                        placeholder="Complete ERP system for gym membership, access control, and trainer payroll."
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Detailed Description (Detail Page)</label>
                      <textarea
                        rows={4}
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        placeholder="Full overview of the system capabilities, modules, and architecture..."
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium resize-none focus:bg-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    {/* Logo Drag-and-Drop Area */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Logo / Image Upload (Drag and Drop)</label>
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={(e) => {
                          e.preventDefault()
                          setIsDragOver(false)
                          if (e.dataTransfer.files?.[0]) setImageFile(e.dataTransfer.files[0])
                        }}
                        className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                          isDragOver ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => e.target.files?.[0] && setImageFile(e.target.files[0])}
                          className="hidden"
                          id="logo-file-input"
                        />
                        <label htmlFor="logo-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                          <FiUpload size={24} className="text-blue-500" />
                          <span className="text-xs font-bold text-slate-700">
                            {imageFile ? imageFile.name : (form.logoUrl ? 'Click or Drag to Replace Logo' : 'Drag & Drop Logo Image here or Click to Browse')}
                          </span>
                          <span className="text-[10px] text-slate-400">PNG, JPG, SVG up to 5MB</span>
                        </label>
                      </div>

                      {(imageFile || form.logoUrl) && (
                        <div className="mt-3 flex items-center gap-3 p-2 bg-slate-100 rounded-xl border border-slate-200 w-fit">
                          <img
                            src={imageFile ? URL.createObjectURL(imageFile) : mediaUrl(form.logoUrl)}
                            alt="Logo preview"
                            className="w-10 h-10 object-contain rounded-lg bg-white p-1"
                          />
                          <span className="text-xs font-semibold text-slate-700">Logo Preview</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── STEP 2: FEATURE MANAGEMENT ───────────────────────────────── */}
                {step === 2 && (
                  <div className="space-y-6">
                    {/* Top 4 Front Card Highlights */}
                    <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-100 space-y-3">
                      <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">
                        Front Card Primary Highlights (Top 4 Features with Green Checkmarks)
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[0, 1, 2, 3].map(idx => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                            <input
                              type="text"
                              value={form.topHighlights[idx] || ''}
                              onChange={e => {
                                const newH = [...form.topHighlights]
                                newH[idx] = e.target.value
                                setForm({ ...form, topHighlights: newH })
                              }}
                              placeholder={`Highlight feature ${idx + 1}`}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Advanced Categorized Features Breakdown */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Categorized Features Breakdown (Modal &amp; Detail Page)
                        </span>
                        <button
                          type="button"
                          onClick={addCategory}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 flex items-center gap-1 transition-all"
                        >
                          <FiPlus size={13} /> Add Feature Category
                        </button>
                      </div>

                      {form.categorizedFeatures.map((cat, catIdx) => (
                        <div key={catIdx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <input
                              type="text"
                              value={cat.categoryName}
                              onChange={e => {
                                const newCats = [...form.categorizedFeatures]
                                newCats[catIdx].categoryName = e.target.value
                                setForm({ ...form, categorizedFeatures: newCats })
                              }}
                              placeholder="Category Name (e.g. Attendance System)"
                              className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                            />
                            {form.categorizedFeatures.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeCategory(catIdx)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
                              >
                                <FiTrash2 size={14} />
                              </button>
                            )}
                          </div>

                          <div className="space-y-2 pl-2">
                            {cat.items.map((itemVal, itemIdx) => (
                              <div key={itemIdx} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                <input
                                  type="text"
                                  value={itemVal}
                                  onChange={e => updateFeatureItem(catIdx, itemIdx, e.target.value)}
                                  placeholder="Feature item (e.g. QR Code Scanner Support)"
                                  className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-blue-500 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeFeatureItem(catIdx, itemIdx)}
                                  className="p-1.5 text-slate-400 hover:text-red-500"
                                >
                                  <FiX size={14} />
                                </button>
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={() => addFeatureItem(catIdx)}
                              className="mt-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              <FiPlus size={12} /> Add Feature to {cat.categoryName || 'Category'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── STEP 3: DEMO & AUTO-LOGIN CONFIG ───────────────────────────── */}
                {step === 3 && (
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 space-y-1">
                      <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <FiKey size={14} className="text-amber-600" /> 1-Click Auto Login Configuration
                      </span>
                      <p className="text-xs text-amber-800">
                        When a customer clicks "Auto Login" on the front card, they will be automatically redirected into the live demo system without having to manually type credentials.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Live Demo System URL</label>
                      <input
                        type="url"
                        value={form.demoUrl}
                        onChange={e => setForm({ ...form, demoUrl: e.target.value })}
                        placeholder="https://demo.gymsystem.com"
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Demo Username / Email</label>
                        <input
                          type="text"
                          value={form.demoUsername}
                          onChange={e => setForm({ ...form, demoUsername: e.target.value })}
                          placeholder="admin@demo.com"
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Demo Password</label>
                        <input
                          type="text"
                          value={form.demoPassword}
                          onChange={e => setForm({ ...form, demoPassword: e.target.value })}
                          placeholder="demo123"
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Custom Single-Click Auto Login Hash/URL (Optional)</label>
                      <input
                        type="url"
                        value={form.autoLoginUrl}
                        onChange={e => setForm({ ...form, autoLoginUrl: e.target.value })}
                        placeholder="https://demo.gymsystem.com/#autologin=true&user=admin&pass=demo123"
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">Leave empty to automatically append credentials to the Live Demo URL.</span>
                    </div>
                  </div>
                )}

                {/* ── STEP 4: PRICING & LEAD GENERATION ──────────────────────────── */}
                {step === 4 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Price Amount</label>
                        <input
                          type="number"
                          value={form.price}
                          onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                          placeholder="35000"
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Currency</label>
                        <select
                          value={form.currency}
                          onChange={e => setForm({ ...form, currency: e.target.value })}
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                        >
                          <option value="LKR">LKR (Sri Lankan Rupee)</option>
                          <option value="USD">USD (US Dollar)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Billing Period</label>
                        <select
                          value={form.billingPeriod}
                          onChange={e => setForm({ ...form, billingPeriod: e.target.value, priceType: e.target.value })}
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                        >
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                          <option value="one-time">One-time</option>
                          <option value="lifetime">Lifetime</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Custom Price Text (Overrules Amount)</label>
                      <input
                        type="text"
                        value={form.priceText}
                        onChange={e => setForm({ ...form, priceText: e.target.value })}
                        placeholder="From LKR 35,000 / one-time"
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-3">
                      <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                        "Get Quote" Button Contact Action
                      </span>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                          <input
                            type="radio"
                            name="contactAction"
                            value="whatsapp"
                            checked={form.contactActionType === 'whatsapp'}
                            onChange={() => setForm({ ...form, contactActionType: 'whatsapp' })}
                          />
                          Direct WhatsApp Chat
                        </label>
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                          <input
                            type="radio"
                            name="contactAction"
                            value="form"
                            checked={form.contactActionType === 'form'}
                            onChange={() => setForm({ ...form, contactActionType: 'form' })}
                          />
                          Quote Request Lead Form Modal
                        </label>
                      </div>

                      {form.contactActionType === 'whatsapp' && (
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">WhatsApp Mobile Number</label>
                          <input
                            type="text"
                            value={form.whatsappNumber}
                            onChange={e => setForm({ ...form, whatsappNumber: e.target.value })}
                            placeholder="94770000000"
                            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Wizard Footer Controls */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  disabled={step === 1}
                  onClick={() => setStep(s => Math.max(1, s - 1))}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold rounded-xl disabled:opacity-40 flex items-center gap-1"
                >
                  <FiChevronLeft size={16} /> Back
                </button>

                <div className="flex items-center gap-2">
                  {step < 4 ? (
                    <button
                      type="button"
                      onClick={() => setStep(s => Math.min(4, s + 1))}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1"
                    >
                      Next Step <FiChevronRight size={16} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={createMut.isPending || updateMut.isPending}
                      className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                    >
                      {(createMut.isPending || updateMut.isPending) ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <FiCheck size={16} /> Save &amp; Publish Item
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
