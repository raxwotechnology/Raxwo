import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { FiPlus, FiDownload, FiPaperclip, FiX, FiTrendingUp, FiTrendingDown, FiDollarSign, FiFilter, FiEdit2, FiTrash2, FiEye, FiLayers } from 'react-icons/fi'
import { mediaUrl } from '../../lib/media'
import { paymentPillClass, PaymentTypeIcon } from '../../lib/financeDisplay'
import PasswordConfirmModal from '../../components/admin/PasswordConfirmModal'

const EXPENSE_CATEGORIES = ['Salary','Hosting','Domain','Server','Equipment','Marketing','Transport','Utilities','Rent','Other']
const INCOME_CATEGORIES  = ['Client Payment','Subscription','Service Revenue','Invoice Payment','Other']

const now = new Date()
const EMPTY = { type:'income', category:'', title:'', amount:0, note:'', file:null, branch:'', paymentMethod:'Bank Transfer', bankAccount:'' }

function formatLkr(amount) {
  return Number(amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const PAYMENT_FILTER_OPTIONS = ['', 'Cash', 'Bank Transfer', 'Card', 'Online Payment', 'Cheque', 'Other']

export default function FinanceEntries() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [viewingEntry, setViewingEntry] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [customCategory, setCustomCategory] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [deletePwdOpen, setDeletePwdOpen] = useState(false)
  const [entryIdToDelete, setEntryIdToDelete] = useState(null)
  // Legacy month/year kept for query compat
  const [month] = useState(now.getMonth() + 1)
  const [year]  = useState(now.getFullYear())

  const { data: branchData } = useQuery({ queryKey:['branches-list'], queryFn:()=>api.get('/branches').then(r=>r.data) })
  const branches = branchData?.branches || []

  const { data: bankData } = useQuery({ queryKey:['bank-accounts'], queryFn:()=>api.get('/bank-accounts').then(r=>r.data) })
  const bankAccounts = bankData?.accounts || []

  const { data, isLoading } = useQuery({
    queryKey: ['finance-entries', month, year, typeFilter, categoryFilter, fromDate, toDate, branchFilter, paymentFilter],
    queryFn: () => {
      const p = new URLSearchParams({ month, year })
      if (typeFilter)     p.set('type', typeFilter)
      if (categoryFilter) p.set('category', categoryFilter)
      if (fromDate)       p.set('from', fromDate)
      if (toDate)         p.set('to', toDate)
      if (branchFilter)   p.set('branch', branchFilter)
      if (paymentFilter)  p.set('paymentMethod', paymentFilter)
      return api.get(`/finance/entries?${p}`).then(r => r.data)
    },
  })
  const entries    = data?.entries    || []
  const categories = data?.categories || []
  const totals     = data?.totals     || { income:0, expense:0, profit:0 }

  const f = (k,v) => setForm(s => ({...s,[k]:v}))
  const activeCategories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const finalCategory = form.category === 'Other' ? customCategory : form.category

  const handleViewReceipt = (e, fileUrl) => {
    e.preventDefault()
    if (!fileUrl) return
    const url = mediaUrl(fileUrl)
    if (url.startsWith('data:')) {
      try {
        const arr = url.split(',')
        const mime = arr[0].match(/:(.*?);/)[1]
        const bstr = atob(arr[1])
        let n = bstr.length
        const u8arr = new Uint8Array(n)
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n)
        }
        const blob = new Blob([u8arr], { type: mime })
        const blobUrl = URL.createObjectURL(blob)
        const newWin = window.open('', '_blank')
        if (newWin) {
          if (mime.startsWith('image/')) {
            newWin.document.write('<html><body style="margin:0;display:flex;justify-content:center;align-items:center;background:#0f172a;min-height:100vh;"><img src="' + blobUrl + '" style="max-width:100%;max-height:100vh;object-fit:contain;"/></body></html>')
          } else {
            newWin.document.write('<html><body style="margin:0;"><iframe src="' + blobUrl + '" style="width:100vw;height:100vh;border:none;"></iframe></body></html>')
          }
          newWin.document.close()
        }
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
      } catch (err) {
        toast.error('Failed to view receipt')
      }
    } else {
      window.open(url, '_blank')
    }
  }

  const addMut = useMutation({
    mutationFn: payload => {
      const fd = new FormData()
      Object.keys(payload).forEach(k => { if (payload[k] !== null && payload[k] !== undefined && k !== 'file') fd.append(k, payload[k]) })
      if (payload.file) fd.append('bill', payload.file)
      return api.post('/finance/entries', fd, { headers:{ 'Content-Type':'multipart/form-data' } }).then(r => r.data)
    },
    onSuccess: () => {
      toast.success('Entry added')
      setForm(EMPTY); setShowModal(false)
      qc.invalidateQueries({ queryKey:['finance-entries'] })
      qc.invalidateQueries({ queryKey:['finance-overview'] })
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })

  const updateMut = useMutation({
    mutationFn: payload => {
      const fd = new FormData()
      Object.keys(payload).forEach(k => { if (payload[k] !== null && payload[k] !== undefined && k !== 'file') fd.append(k, payload[k]) })
      if (payload.file) fd.append('bill', payload.file)
      return api.put(`/finance/entries/${editingId}`, fd, { headers:{ 'Content-Type':'multipart/form-data' } }).then(r => r.data)
    },
    onSuccess: () => {
      toast.success('Entry updated')
      setForm(EMPTY); setShowModal(false); setEditingId(null)
      qc.invalidateQueries({ queryKey:['finance-entries'] })
      qc.invalidateQueries({ queryKey:['finance-overview'] })
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })

  const deleteMut = useMutation({
    mutationFn: ({ id, password }) => api.delete(`/finance/entries/${id}`, { data: { password } }),
    onSuccess: () => {
      toast.success('Entry deleted')
      setEntryIdToDelete(null)
      qc.invalidateQueries({ queryKey:['finance-entries'] })
      qc.invalidateQueries({ queryKey:['finance-overview'] })
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })

  const exportData = async format => {
    try {
      const p = new URLSearchParams({ dataset: typeFilter==='income'?'incomes':typeFilter==='expense'?'expenses':'financial_overview', format, month, year })
      if (categoryFilter) p.set('category', categoryFilter)
      if (typeFilter)     p.set('type', typeFilter)
      if (branchFilter)   p.set('branch', branchFilter)
      if (paymentFilter)  p.set('paymentMethod', paymentFilter)
      if (fromDate)       p.set('from', fromDate)
      if (toDate)         p.set('to', toDate)
      const res = await api.get(`/finance/export?${p}`, { responseType:'blob' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([res.data], { type:res.headers['content-type'] }))
      a.download = `finance_entries.${format==='excel'?'xlsx':'pdf'}`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(a.href)
      toast.success(`Exported ${format.toUpperCase()}`)
    } catch(e) { toast.error('Export failed') }
  }

  const clearFilters = () => { setTypeFilter(''); setCategoryFilter(''); setFromDate(''); setToDate(''); setBranchFilter(''); setPaymentFilter('') }
  const hasFilters = typeFilter || categoryFilter || fromDate || toDate || branchFilter || paymentFilter

  return (
    <div className="erp-module space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Income & Expenses</h1>
          <p className="page-subtitle">Track, filter and export all financial transactions</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={()=>exportData('excel')} className="btn-export bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50"><FiDownload size={12}/> Excel</button>
          <button type="button" onClick={()=>exportData('pdf')} className="btn-export bg-white border border-rose-200 text-rose-700 hover:bg-rose-50"><FiDownload size={12}/> PDF</button>
          <button type="button" onClick={()=>{setEditingId(null); setForm(EMPTY); setShowModal(true)}} className="btn-primary btn-sm"><FiPlus size={13}/> Add Entry</button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label:'Total Income', value:totals.income||0, icon:<FiTrendingUp size={18}/>, color:'text-emerald-600', bg:'bg-emerald-50', border:'border-emerald-100' },
          { label:'Total Expenses', value:totals.expense||0, icon:<FiTrendingDown size={18}/>, color:'text-red-600', bg:'bg-red-50', border:'border-red-100' },
          { label:'Net Profit', value:totals.profit||0, icon:<FiDollarSign size={18}/>, color:(totals.profit||0)>=0?'text-blue-600':'text-red-600', bg:'bg-blue-50', border:'border-blue-100' },
        ].map(k=>(
          <motion.div key={k.label} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} className={`card card-body flex items-center gap-4 border ${k.border}`}>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${k.bg} ${k.color} flex-shrink-0`}>{k.icon}</div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold">{k.label}</p>
              <p className={`text-xl font-bold font-heading ${k.color}`}>LKR {Number(k.value).toLocaleString()}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="card card-body filter-toolbar space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><FiFilter size={14}/> Filters</div>
          {hasFilters && <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-red-500 transition-colors">Clear all</button>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <div>
            <label className="form-label text-xs">From Date</label>
            <input type="date" className="form-input text-sm py-2" value={fromDate} onChange={e=>setFromDate(e.target.value)}/>
          </div>
          <div>
            <label className="form-label text-xs">To Date</label>
            <input type="date" className="form-input text-sm py-2" value={toDate} onChange={e=>setToDate(e.target.value)}/>
          </div>
          <div>
            <label className="form-label text-xs">Type</label>
            <select className="form-select text-sm py-2" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>
          <div>
            <label className="form-label text-xs">Category</label>
            <select className="form-select text-sm py-2" value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label text-xs">Payment type</label>
            <select className="form-select text-sm py-2" value={paymentFilter} onChange={e=>setPaymentFilter(e.target.value)}>
              {PAYMENT_FILTER_OPTIONS.map((v) => (
                <option key={v || 'all'} value={v}>{v ? v : 'All methods'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label text-xs">Branch</label>
            <select className="form-select text-sm py-2" value={branchFilter} onChange={e=>setBranchFilter(e.target.value)}>
              <option value="">All Branches</option>
              {branches.map(b=><option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Transaction ledger — structured rows */}
      <div>
        <div className="flex items-center justify-between mb-3 px-0.5">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Transaction ledger</h2>
          <span className="text-xs text-slate-400 tabular-nums">{entries.length} record{entries.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="space-y-3">
          {isLoading ? (
            <div className="finance-tx-card flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="finance-tx-card text-center py-16 text-slate-400 text-sm">No entries match the current filters.</div>
          ) : (
            entries.map((e) => {
              const pm = e.paymentMethod || 'Cash'
              return (
                <article
                  key={e._id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow relative"
                >
                  <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${e.type === 'income' ? 'bg-emerald-500' : 'bg-red-500'}`} aria-hidden />
                  <div className="p-4 pl-5 flex flex-col sm:flex-row justify-between gap-4">
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <time className="text-xs font-semibold text-slate-500" dateTime={new Date(e.date).toISOString()}>
                          {new Date(e.date).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </time>
                        <span className={`badge capitalize text-[10px] ${e.type === 'income' ? 'badge-green' : 'badge-red'}`}>
                          {e.type}
                        </span>
                        <span className={`badge text-[10px] flex items-center gap-1 ${paymentPillClass(pm)}`} title="Payment type">
                          <PaymentTypeIcon method={pm} />
                          {pm}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 truncate">{e.title}</h3>
                      <p className="text-xs font-medium text-slate-500">{e.category}</p>
                      
                      {e.bankAccount || e.branch ? (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {e.bankAccount ? (
                            <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md max-w-[240px] truncate" title={e.bankAccount.bankName}>
                              <FiLayers size={10} className="shrink-0 opacity-70" aria-hidden />
                              <span className="truncate">{e.bankAccount.bankName}</span>
                            </span>
                          ) : null}
                          {e.branch ? (
                            <span className="inline-flex items-center text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md max-w-[200px] truncate" title={e.branch.name}>
                              <span className="truncate">Branch · {e.branch.name}</span>
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 mt-0.5">No bank or branch linked</p>
                      )}
                      
                      {e.note ? (
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed line-clamp-2 border-l-2 border-slate-200 pl-2.5">
                          {e.note}
                        </p>
                      ) : null}
                    </div>
                    
                    <div className="flex flex-col sm:items-end justify-between gap-3 shrink-0">
                      <p className={`text-lg font-bold ${e.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {e.type === 'income' ? '+' : '−'} LKR {formatLkr(e.amount)}
                      </p>
                      <div className="flex items-center gap-1 self-start sm:self-end">
                        <button type="button" onClick={() => setViewingEntry(e)} className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="View">
                          <FiEye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setForm({
                              ...e,
                              date: new Date(e.date).toISOString().split('T')[0],
                              bankAccount: e.bankAccount?._id || '',
                              branch: e.branch?._id || '',
                              paymentMethod: e.paymentMethod || 'Cash',
                            })
                            setEditingId(e._id)
                            setShowModal(true)
                          }}
                          className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title="Edit"
                        >
                          <FiEdit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEntryIdToDelete(e._id)
                            setDeletePwdOpen(true)
                          }}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <FiTrash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </div>
      </div>

      {/* Add Entry Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-0 sm:p-4 z-[99999]">
          <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="bg-white rounded-none sm:rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[100dvh] sm:max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b shrink-0">
              <h3 className="font-bold text-primary">{editingId ? 'Edit Financial Entry' : 'Add Financial Entry'}</h3>
              <button onClick={()=>{setShowModal(false); setEditingId(null)}} className="p-2 hover:bg-gray-100 rounded-lg"><FiX size={16}/></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto min-h-0 flex-1">
              {/* Type toggle */}
              <div className="flex gap-2">
                {[['income','Income'],['expense','Expense']].map(([v,l])=>(
                  <button key={v} type="button" onClick={()=>f('type',v)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${form.type===v?(v==='income'?'bg-emerald-600 text-white border-emerald-600':'bg-red-600 text-white border-red-600'):'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    {v==='income'?<FiTrendingUp className="inline mr-1.5" size={13}/>:<FiTrendingDown className="inline mr-1.5" size={13}/>}{l}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Category *</label>
                  <select className="form-select" value={form.category} onChange={e=>f('category',e.target.value)}>
                    <option value="">Select…</option>
                    {activeCategories.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label flex items-center justify-between">
                    <span>Amount (LKR) *</span>
                    <button
                      type="button"
                      onClick={() => {
                        const presets = [3000, 5000, 10000]
                        const cur = Number(form.amount) || 0
                        const idx = presets.indexOf(cur)
                        const nextVal = idx >= 0 && idx < presets.length - 1 ? presets[idx + 1] : presets[0]
                        f('amount', nextVal)
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
                        f('amount', nextVal)
                      }}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors p-1 rounded hover:bg-slate-100"
                      title="Click Dollar mark to auto-fill default amount"
                    >
                      <FiDollarSign size={15} />
                    </button>
                    <input
                      type="number"
                      className="form-input !pl-8"
                      value={form.amount || ''}
                      onChange={e => f('amount', Number(e.target.value || 0))}
                      placeholder="3000.00"
                    />
                  </div>
                </div>
              </div>
              {form.category==='Other' && (
                <div><label className="form-label">Custom Category</label>
                <input className="form-input" value={customCategory} onChange={e=>setCustomCategory(e.target.value)} placeholder="Enter category name"/></div>
              )}
              <div>
                <label className="form-label">Title *</label>
                <input className="form-input" value={form.title} onChange={e=>f('title',e.target.value)} placeholder="Brief description"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Payment Method</label>
                  <select className="form-select" value={form.paymentMethod} onChange={e=>f('paymentMethod',e.target.value)}>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Card</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online Payment">Online Payment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {['Bank Transfer', 'Card', 'Online Payment'].includes(form.paymentMethod) && (
                  <div>
                    <label className="form-label">Bank Account</label>
                    <select className="form-select" value={form.bankAccount} onChange={e=>f('bankAccount',e.target.value)}>
                      <option value="">Select Account…</option>
                      {bankAccounts.map(b=><option key={b._id} value={b._id}>{b.bankName} ({b.accountNumber})</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Branch</label>
                  <select className="form-select" value={form.branch} onChange={e=>f('branch',e.target.value)}>
                    <option value="">No Branch</option>
                    {branches.map(b=><option key={b._id} value={b._id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Note</label>
                  <input className="form-input" value={form.note} onChange={e=>f('note',e.target.value)} placeholder="Optional"/>
                </div>
              </div>
              <div>
                <label className="form-label">Bill / Receipt</label>
                <input type="file" accept="image/*,.pdf" className="form-input text-sm file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  onChange={e=>f('file',e.target.files[0])}/>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t shrink-0 bg-slate-50 pb-safe">
              <button onClick={()=>{setShowModal(false); setEditingId(null)}} className="btn-ghost flex-1 justify-center">Cancel</button>
              <button disabled={addMut.isPending || updateMut.isPending || !form.title || !form.amount || !form.category} onClick={()=>{
                const payload = {...form, category: finalCategory}
                editingId ? updateMut.mutate(payload) : addMut.mutate(payload)
              }} className="btn-primary flex-1 justify-center">
                {addMut.isPending || updateMut.isPending ? <span className="spinner"/> : (editingId ? 'Save Changes' : 'Add Entry')}
              </button>
            </div>
          </motion.div>
        </div>, document.body
      )}

      {/* View Details Modal */}
      {viewingEntry && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[99999]">
          <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className={`p-5 text-white flex justify-between items-center ${viewingEntry.type==='income'?'bg-emerald-600':'bg-red-600'}`}>
              <h3 className="font-bold">Transaction details</h3>
              <button onClick={()=>setViewingEntry(null)} className="p-2 hover:bg-white/20 rounded-lg"><FiX size={16}/></button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className={`rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${viewingEntry.type==='income'?'border-emerald-100':'border-red-100'}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Amount</p>
                  <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                    <span>{new Date(viewingEntry.date).toLocaleDateString('en-LK', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    <span className={`finance-tx-typepill capitalize ${viewingEntry.type==='income'?'finance-tx-typepill--income':'finance-tx-typepill--expense'}`}>{viewingEntry.type}</span>
                    <span className={`finance-payment-pill ${paymentPillClass(viewingEntry.paymentMethod)}`}>
                      <PaymentTypeIcon method={viewingEntry.paymentMethod} />
                      {viewingEntry.paymentMethod || 'Cash'}
                    </span>
                  </p>
                </div>
                <p className={`finance-amount text-xl font-bold shrink-0 ${viewingEntry.type==='income'?'text-emerald-600':'text-red-600'}`}>
                  {viewingEntry.type==='income'?'+':'−'} LKR {formatLkr(viewingEntry.amount)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div><p className="text-slate-400 text-xs mb-1">Category</p><p className="font-medium text-slate-800">{viewingEntry.category}</p></div>
                <div>
                  <p className="text-slate-400 text-xs mb-1">Payment type</p>
                  <span className={`finance-payment-pill ${paymentPillClass(viewingEntry.paymentMethod)}`}>
                    <PaymentTypeIcon method={viewingEntry.paymentMethod} />
                    {viewingEntry.paymentMethod || '—'}
                  </span>
                </div>
                <div className="col-span-2"><p className="text-slate-400 text-xs mb-1">Title</p><p className="font-medium text-slate-800">{viewingEntry.title}</p></div>
              </div>
              
              {(viewingEntry.bankAccount || viewingEntry.branch) && (
                <div className="bg-slate-50 p-3 rounded-xl border space-y-2">
                  {viewingEntry.bankAccount && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 shrink-0">Bank</span>
                      <span className="font-medium text-slate-800 text-right">{viewingEntry.bankAccount.bankName}{viewingEntry.bankAccount.accountNumber ? ` · ${viewingEntry.bankAccount.accountNumber}` : ''}</span>
                    </div>
                  )}
                  {viewingEntry.branch && <div className="flex justify-between"><span className="text-slate-500">Branch</span><span className="font-medium text-slate-800">{viewingEntry.branch.name}</span></div>}
                </div>
              )}
              
              {viewingEntry.note && <div><p className="text-slate-400 text-xs mb-1">Notes</p><p className="text-slate-600 bg-slate-50 p-3 rounded-lg text-xs leading-relaxed">{viewingEntry.note}</p></div>}
              {viewingEntry.billFile && (
                <div className="pt-2">
                  <a href="#" onClick={(e) => handleViewReceipt(e, viewingEntry.billFile)} className="flex items-center justify-center gap-2 w-full py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm">
                    <FiPaperclip size={14}/> View Attached Receipt
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      <PasswordConfirmModal
        open={deletePwdOpen}
        onClose={() => {
          setDeletePwdOpen(false)
          setEntryIdToDelete(null)
        }}
        title="Delete finance entry"
        message="This removes the entry and reverses any linked bank balance. Enter your account password to confirm."
        confirmLabel="Delete entry"
        isSubmitting={deleteMut.isPending}
        onConfirm={async (password) => {
          if (!entryIdToDelete) return
          await deleteMut.mutateAsync({ id: entryIdToDelete, password })
        }}
      />
    </div>
  )
}
