import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import ExportBar from '../../components/ui/ExportBar'
import PasswordConfirmModal from '../../components/admin/PasswordConfirmModal'
import { usePasswordProtectedDelete } from '../../hooks/usePasswordProtectedDelete'
import { FiPlus, FiX, FiTrendingUp, FiTrendingDown, FiTrash2, FiCheck, FiPieChart, FiEye, FiEdit2 } from 'react-icons/fi'
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#2563EB','#22C55E','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#F97316']

const CATEGORIES = ['office_supplies','travel','meals','utilities','maintenance','other','fund_top_up']
const CAT_LABEL = { office_supplies:'Office Supplies', travel:'Travel', meals:'Meals', utilities:'Utilities', maintenance:'Maintenance', other:'Other', fund_top_up:'Fund Top-Up' }

const EMPTY = { type:'out', amount:'', date: new Date().toISOString().split('T')[0], description:'', category:'other', paidTo:'', paymentType:'cash', referenceNumber:'', chequeNumber:'', bankAccount:'' }

export default function AdminPettyCash() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('create') // 'create' | 'edit' | 'view'
  const [form, setForm] = useState(EMPTY)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [branchFilter, setBranchFilter] = useState('')

  const { data: branchData } = useQuery({ queryKey: ['branches-list'], queryFn: () => api.get('/branches').then(r => r.data) })
  const branches = branchData?.branches || []
  const { data: bankData } = useQuery({ queryKey: ['bank-accounts'], queryFn: () => api.get('/bank-accounts').then(r => r.data) })
  const bankAccounts = bankData?.accounts || []

  const params = new URLSearchParams()
  if (typeFilter) params.set('type', typeFilter)
  if (catFilter) params.set('category', catFilter)
  if (branchFilter) params.set('branch', branchFilter)
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)

  const { data, isLoading } = useQuery({
    queryKey: ['petty-cash', typeFilter, catFilter, startDate, endDate, branchFilter],
    queryFn: () => api.get(`/petty-cash?${params}`).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: p => api.post('/petty-cash', p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['petty-cash'] }); qc.invalidateQueries({ queryKey: ['bank-accounts'] }); toast.success('Transaction recorded'); setShowModal(false); setForm(EMPTY) },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })
  const updateMut = useMutation({
    mutationFn: p => api.put(`/petty-cash/${p._id}`, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['petty-cash'] }); qc.invalidateQueries({ queryKey: ['bank-accounts'] }); toast.success('Transaction updated'); setShowModal(false); setForm(EMPTY) },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })
  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/petty-cash/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['petty-cash'] }); qc.invalidateQueries({ queryKey: ['bank-accounts'] }); toast.success('Deleted') },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })
  const passwordDelete = usePasswordProtectedDelete({
    mutateFn: (id) => deleteMut.mutateAsync(id),
  })

  const transactions = (data?.transactions || []).filter(t =>
    !search || t.description?.toLowerCase().includes(search.toLowerCase()) || t.paidTo?.toLowerCase().includes(search.toLowerCase())
  )

  // Compute summary from all API transactions (unfiltered by search) for accurate balance KPIs
  const allTransactions = data?.transactions || []
  const totalIn = allTransactions.filter(t => t.type === 'in').reduce((sum, t) => sum + Number(t.amount || 0), 0)
  const totalOut = allTransactions.filter(t => t.type === 'out').reduce((sum, t) => sum + Number(t.amount || 0), 0)
  const summary = { totalIn, totalOut, currentBalance: totalIn - totalOut }
  const handleView = (t) => {
    setForm({
      ...t,
      date: new Date(t.date).toISOString().split('T')[0],
      branch: t.branch?._id || t.branch || '',
      bankAccount: t.bankAccount?._id || t.bankAccount || '',
      chequeNumber: t.chequeNumber || t.referenceNumber || '',
    })
    setModalMode('view')
    setShowModal(true)
  }

  const handleEdit = (t) => {
    setForm({
      ...t,
      date: new Date(t.date).toISOString().split('T')[0],
      branch: t.branch?._id || t.branch || '',
      bankAccount: t.bankAccount?._id || t.bankAccount || '',
      chequeNumber: t.chequeNumber || t.referenceNumber || '',
    })
    setModalMode('edit')
    setShowModal(true)
  }

  const exportColumns = [
    { header: 'Date', accessor: r => new Date(r.date).toLocaleDateString('en-LK') },
    { header: 'Type', accessor: r => r.type.toUpperCase() },
    { header: 'Category', accessor: r => CAT_LABEL[r.category] || r.category },
    { header: 'Description', accessor: 'description' },
    { header: 'Paid To', accessor: r => r.paidTo || '—' },
    { header: 'Amount (LKR)', accessor: r => r.amount },
    { header: 'Payment', accessor: 'paymentType' },
    { header: 'Ref No', accessor: r => r.referenceNumber || '—' },
    { header: 'Recorded By', accessor: r => r.recordedBy?.name || '—' },
  ]

  // Financial Overview data prep
  const expenseByCategory = CATEGORIES.map(c => {
    const total = transactions.filter(t => t.type === 'out' && t.category === c).reduce((sum, t) => sum + t.amount, 0)
    return { name: CAT_LABEL[c], value: total }
  }).filter(d => d.value > 0)

  const ttStyle = { borderRadius: '10px', fontSize: '12px', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }

  return (
    <div className="erp-module space-y-5 animate-fade-in">
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Petty Cash</h1>
          <p className="page-subtitle">{transactions.length} transactions · Balance: <strong className={summary.currentBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}>LKR {summary.currentBalance.toLocaleString()}</strong></p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportBar data={transactions} columns={exportColumns} title="Petty Cash Register" filters={{ Type: typeFilter || 'All', Category: catFilter || 'All', Branch: branchFilter || 'All', From: startDate, To: endDate }} />
          <button onClick={() => { setForm({ ...EMPTY, type: 'in', category: 'fund_top_up', branch: '' }); setModalMode('create'); setShowModal(true) }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors">
            <FiTrendingUp size={14}/> Add Funds
          </button>
          <button onClick={() => { setForm(EMPTY); setModalMode('create'); setShowModal(true) }} className="btn-primary gap-2">
            <FiPlus size={14}/> Record Expense
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label:'Funds Added (IN)', value:summary.totalIn, icon:<FiTrendingUp size={18}/>, color:'text-emerald-600', bg:'bg-emerald-50', border:'border-emerald-100' },
          { label:'Total Spent (OUT)',  value:summary.totalOut, icon:<FiTrendingDown size={18}/>, color:'text-red-600', bg:'bg-red-50', border:'border-red-100' },
          { label:'Cash Balance',      value:summary.currentBalance, icon:<FiCheck size={18}/>, color:summary.currentBalance>=0?'text-blue-600':'text-red-600', bg:summary.currentBalance>=0?'bg-blue-50':'bg-red-50', border:summary.currentBalance>=0?'border-blue-100':'border-red-100' },
        ].map(k=>(
          <motion.div key={k.label} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} className={`card card-body flex items-center gap-4 border ${k.border}`}>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${k.bg} ${k.color}`}>{k.icon}</div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">{k.label}</p>
              <p className={`text-xl font-bold font-heading ${k.color}`}>LKR {Number(k.value).toLocaleString()}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Financial Overview Chart */}
      {expenseByCategory.length > 0 && (
        <div className="card card-body bg-slate-50/50 border border-slate-100">
          <h3 className="font-bold text-primary font-heading mb-0.5 flex items-center gap-2"><FiPieChart className="text-secondary"/> Financial Overview</h3>
          <p className="text-xs text-slate-400 mb-4">Expense breakdown by category for the selected period</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expenseByCategory} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <RechartsTooltip formatter={(v) => `LKR ${v.toLocaleString()}`} contentStyle={ttStyle} />
                <Legend iconType="circle" iconSize={8} formatter={v => <span className="text-xs text-slate-500">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card card-body filter-toolbar">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="col-span-2 lg:col-span-2">
            <label className="form-label text-xs">Search</label>
            <input className="form-input text-sm py-2" placeholder="Search description or payee…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <div className="col-span-1">
            <label className="form-label text-xs">From Date</label>
            <input type="date" className="form-input text-sm py-2" value={startDate} onChange={e=>setStartDate(e.target.value)}/>
          </div>
          <div className="col-span-1">
            <label className="form-label text-xs">To Date</label>
            <input type="date" className="form-input text-sm py-2" value={endDate} onChange={e=>setEndDate(e.target.value)}/>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="form-label text-xs">Type</label>
            <select className="form-select text-sm py-2" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              <option value="in">IN (Top-Up)</option>
              <option value="out">OUT (Expense)</option>
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="form-label text-xs">Category</label>
            <select className="form-select text-sm py-2" value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c=><option key={c} value={c}>{CAT_LABEL[c]}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Transactions table */}
      {/* Transactions table */}
      <div className="table-container hidden md:block">
        <table className="table">
          <thead>
            <tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Paid To</th><th className="text-right">Amount</th><th>Payment</th><th>By</th><th></th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="text-center py-12"><div className="w-7 h-7 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto"/></td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-slate-400">No transactions found.</td></tr>
            ) : transactions.map(t => (
              <tr key={t._id}>
                <td className="text-sm text-slate-600 whitespace-nowrap">{new Date(t.date).toLocaleDateString('en-LK')}</td>
                <td>
                  <span className={`badge gap-1 ${t.type === 'in' ? 'badge-green' : 'badge-red'}`}>
                    {t.type === 'in' ? <FiTrendingUp size={11}/> : <FiTrendingDown size={11}/>}
                    {t.type.toUpperCase()}
                  </span>
                </td>
                <td className="text-sm text-slate-600">{CAT_LABEL[t.category] || t.category}</td>
                <td className="font-medium text-slate-800 max-w-[180px] truncate">{t.description}</td>
                <td className="text-sm text-slate-500">{t.paidTo || '—'}</td>
                <td className={`amount-cell ${t.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                  <div className="amount-cell-inner">
                    <span className="amount-cell-sign">{t.type === 'in' ? '+' : '−'}</span>
                    <span>LKR {Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </td>
                <td className="text-xs text-slate-400 capitalize">{t.paymentType?.replace('_',' ')}</td>
                <td className="text-xs text-slate-400">{t.recordedBy?.name || '—'}</td>
                <td className="whitespace-nowrap">
                  <div className="flex items-center gap-1 justify-end">
                    <button type="button" onClick={() => handleView(t)}
                      title="View Transaction"
                      className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors">
                      <FiEye size={13}/>
                    </button>
                    <button type="button" onClick={() => handleEdit(t)}
                      title="Edit Transaction"
                      className="p-1.5 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-lg transition-colors">
                      <FiEdit2 size={13}/>
                    </button>
                    <button type="button" onClick={() => passwordDelete.requestDelete(t._id)}
                      title="Delete Transaction"
                      className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                      <FiTrash2 size={13}/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="block md:hidden space-y-3">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-7 h-7 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto"/>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-200">
            No transactions found.
          </div>
        ) : (
          transactions.map(t => (
            <div key={t._id} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">{new Date(t.date).toLocaleDateString('en-LK')}</span>
                <span className={`badge gap-1 ${t.type === 'in' ? 'badge-green' : 'badge-red'} text-[10px]`}>
                  {t.type === 'in' ? <FiTrendingUp size={10}/> : <FiTrendingDown size={10}/>}
                  {t.type.toUpperCase()}
                </span>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-slate-800 text-sm leading-snug">{t.description}</p>
                {t.paidTo && <p className="text-xs text-slate-500">Paid to: {t.paidTo}</p>}
              </div>

              <div className="flex flex-wrap gap-2 text-[10px] items-center text-slate-600">
                <span className="bg-slate-100 px-2 py-0.5 rounded-full">{CAT_LABEL[t.category] || t.category}</span>
                <span className="bg-slate-100 px-2 py-0.5 rounded-full capitalize">{t.paymentType?.replace('_',' ')}</span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">Amount</span>
                  <p className={`font-bold text-sm ${t.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {t.type === 'in' ? '+' : '−'} LKR {Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[9px] text-slate-400">By: {t.recordedBy?.name || '—'}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => handleView(t)}
                      className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors">
                      <FiEye size={14}/>
                    </button>
                    <button type="button" onClick={() => handleEdit(t)}
                      className="p-1.5 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-lg transition-colors">
                      <FiEdit2 size={14}/>
                    </button>
                    <button type="button" onClick={() => passwordDelete.requestDelete(t._id)}
                      className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                      <FiTrash2 size={14}/>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] p-4">
          <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="font-bold text-primary font-heading">
                {modalMode === 'view' ? 'View Transaction' : modalMode === 'edit' ? 'Edit Transaction' : form.type === 'in' ? 'Add Funds to Petty Cash' : 'Record Expense'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><FiX size={16}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="form-label">Transaction Type</label>
                <div className="flex gap-3">
                  {[{v:'out',l:'Expense (OUT)'},{v:'in',l:'Fund Top-Up (IN)'}].map(o => (
                    <label key={o.v} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={form.type===o.v} disabled={modalMode!=='create'} onChange={() => setForm(s=>({...s, type:o.v, category: o.v==='in'?'fund_top_up':'other'}))} className="accent-secondary"/> {o.l}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="form-label">Date *</label>
                  <input type="date" className="form-input" disabled={modalMode==='view'} value={form.date} onChange={e=>setForm(s=>({...s,date:e.target.value}))}/></div>
                <div><label className="form-label">Amount (LKR) *</label>
                  <input type="number" className="form-input" disabled={modalMode==='view'} value={form.amount} onChange={e=>setForm(s=>({...s,amount:e.target.value}))} placeholder="0.00"/></div>
              </div>
              <div><label className="form-label">Description *</label>
                <input className="form-input" disabled={modalMode==='view'} value={form.description} onChange={e=>setForm(s=>({...s,description:e.target.value}))} placeholder="What is this for?"/></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="form-label">Category</label>
                  <select className="form-select" disabled={modalMode==='view'} value={form.category} onChange={e=>setForm(s=>({...s,category:e.target.value}))}>
                    {CATEGORIES.map(c=><option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                  </select></div>
                <div><label className="form-label">Payment Method</label>
                  <select className="form-select" disabled={modalMode==='view'} value={form.paymentType} onChange={e=>setForm(s=>({...s,paymentType:e.target.value}))}>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>
              
              {form.paymentType === 'cheque' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                  <div>
                    <label className="form-label text-indigo-700 font-semibold">Cheque Number *</label>
                    <input
                      className="form-input border-indigo-200 focus:border-indigo-500"
                      disabled={modalMode==='view'}
                      value={form.chequeNumber || form.referenceNumber || ''}
                      onChange={e => setForm(s => ({ ...s, chequeNumber: e.target.value, referenceNumber: e.target.value }))}
                      placeholder="e.g. CHQ-001234"
                    />
                  </div>
                  <div>
                    <label className="form-label text-indigo-700 font-semibold">Bank Account *</label>
                    <select
                      className="form-select border-indigo-200 focus:border-indigo-500"
                      disabled={modalMode==='view'}
                      value={form.bankAccount || ''}
                      onChange={e => setForm(s => ({ ...s, bankAccount: e.target.value }))}
                    >
                      <option value="">Select Bank Account</option>
                      {bankAccounts.map(b => <option key={b._id} value={b._id}>{b.bankName} — {b.accountNumber}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {['bank_transfer', 'card'].includes(form.paymentType) && (
                <div>
                  <label className="form-label text-blue-600 font-semibold">Paying From Bank Account</label>
                  <select className="form-select border-blue-200" disabled={modalMode==='view'} value={form.bankAccount || ''} onChange={e=>setForm(s=>({...s,bankAccount:e.target.value}))}>
                    <option value="">Select Bank Account</option>
                    {bankAccounts.map(b => <option key={b._id} value={b._id}>{b.bankName} — {b.accountNumber}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {form.type === 'out' ? (
                  <div><label className="form-label">Paid To</label>
                    <input className="form-input" disabled={modalMode==='view'} value={form.paidTo} onChange={e=>setForm(s=>({...s,paidTo:e.target.value}))} placeholder="Person or vendor name"/></div>
                ) : <div />}
                <div><label className="form-label">Branch (Optional)</label>
                  <select className="form-select" disabled={modalMode==='view'} value={form.branch || ''} onChange={e=>setForm(s=>({...s,branch:e.target.value}))}>
                    <option value="">No Branch</option>
                    {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                  </select></div>
              </div>
              <div><label className="form-label">Reference No.</label>
                <input className="form-input" disabled={modalMode==='view'} value={form.referenceNumber} onChange={e=>setForm(s=>({...s,referenceNumber:e.target.value}))} placeholder="Optional receipt / ref number"/></div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t">
              <button onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center">
                {modalMode === 'view' ? 'Close' : 'Cancel'}
              </button>
              {modalMode !== 'view' && (
                <button onClick={() => { 
                  if (!form.amount || !form.description) { toast.error('Amount and description required'); return } 
                  if (form.paymentType === 'cheque') {
                    if (!form.chequeNumber && !form.referenceNumber) { toast.error('Cheque Number is required'); return }
                    if (!form.bankAccount) { toast.error('Bank Account is required for Cheque payment'); return }
                  }
                  if (modalMode === 'edit') {
                    updateMut.mutate(form)
                  } else {
                    createMut.mutate(form)
                  }
                }}
                  disabled={createMut.isPending || updateMut.isPending}
                  className={`flex-1 justify-center flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium transition-colors ${form.type==='in'?'bg-emerald-600 hover:bg-emerald-700':'bg-secondary hover:bg-secondary/90'}`}>
                  {(createMut.isPending || updateMut.isPending) ? <span className="spinner"/> : <FiCheck size={14}/>}
                  {modalMode === 'edit' ? 'Save Changes' : form.type === 'in' ? 'Add Funds' : 'Record Expense'}
                </button>
              )}
            </div>
          </motion.div>
        </div>, document.body
      )}

      <PasswordConfirmModal
        open={passwordDelete.deleteModalOpen}
        onClose={passwordDelete.cancelDelete}
        onConfirm={passwordDelete.confirmDelete}
        isSubmitting={passwordDelete.isSubmitting || deleteMut.isPending}
        title="Delete petty cash transaction"
        message="Enter your admin password to permanently delete this transaction. Linked bank entries will be reversed."
      />
    </div>
  )
}
