import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { FiEye, FiEdit2, FiTrash2, FiCheck, FiX, FiBriefcase } from 'react-icons/fi'

export default function AdminBookings() {
  const qc = useQueryClient()
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})

  const { data, isLoading } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: () => api.get('/bookings').then((r) => r.data),
  })

  const bookings = data?.bookings || []

  const updateMut = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/bookings/${id}`, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-bookings'] })
      qc.invalidateQueries({ queryKey: ['admin-projects'] })
      toast.success('Booking updated')
      setEditing(null)
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed to update')
  })

  const delMut = useMutation({
    mutationFn: (id) => api.delete(`/bookings/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-bookings'] })
      toast.success('Booking deleted')
      setViewing(null)
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed to delete')
  })

  const pending = bookings.filter((b) => b.status === 'pending').length
  const confirmed = bookings.filter((b) => b.status === 'confirmed').length
  const inProgress = bookings.filter((b) => b.status === 'in_progress').length

  const openEdit = (b) => {
    setEditing(b)
    setForm({
      service: b.service || '',
      brief: b.brief || '',
      budget: b.budget || b.amount || 0,
      status: b.status || 'pending',
      paymentStatus: b.paymentStatus || 'unpaid'
    })
  }

  const saveEdit = () => {
    updateMut.mutate({ id: editing._id, payload: form })
  }

  return (
    <div className="erp-module space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Booking Management</h1>
          <p className="page-subtitle">Approve and convert client booking requests into active projects.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="kpi-card kpi-blue"><p className="text-xs text-slate-500 uppercase">Pending</p><p className="text-2xl font-bold text-primary">{pending}</p></div>
        <div className="kpi-card kpi-green"><p className="text-xs text-slate-500 uppercase">Confirmed</p><p className="text-2xl font-bold text-primary">{confirmed}</p></div>
        <div className="kpi-card kpi-purple"><p className="text-xs text-slate-500 uppercase">In Progress</p><p className="text-2xl font-bold text-primary">{inProgress}</p></div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr><th>Client</th><th>Service</th><th className="text-right">Budget</th><th>Status</th><th>Payment</th><th className="text-right">Actions</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12"><div className="w-7 h-7 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto" /></td></tr>
            ) : bookings.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400">No bookings found</td></tr>
            ) : bookings.map((item) => (
              <tr key={item._id}>
                <td>
                  <div className="font-medium text-slate-800 flex items-center gap-2">
                    {item.isGuest ? item.guestName : (item.client?.name || item.client?.email || 'Unknown')}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${item.isGuest ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                      {item.isGuest ? 'Guest' : 'Client'}
                    </span>
                  </div>
                </td>
                <td className="text-slate-600 font-medium">{item.service}</td>
                <td className="amount-cell text-slate-800 tabular-nums">
                  <div className="amount-cell-inner min-w-[7rem]">
                    <span className="amount-cell-sign opacity-0 select-none" aria-hidden> </span>
                    <span>LKR {(item.budget || item.amount || 0).toLocaleString()}</span>
                  </div>
                </td>
                <td>
                  <span className={`badge capitalize ${item.status === 'confirmed' ? 'badge-green' : item.status === 'pending' ? 'badge-blue' : item.status === 'cancelled' ? 'badge-red' : 'badge-purple'}`}>
                    {item.status.replace('_', ' ')}
                  </span>
                </td>
                <td>
                  <span className={`badge capitalize ${item.paymentStatus === 'paid' ? 'badge-green' : item.paymentStatus === 'partial' ? 'badge-blue' : 'badge-red'}`}>
                    {item.paymentStatus}
                  </span>
                </td>
                <td className="text-right space-x-1">
                  {item.status === 'pending' && (
                    <>
                      <button onClick={() => { if(window.confirm('Approve this booking?')) updateMut.mutate({ id: item._id, payload: { status: 'confirmed' } }) }} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Approve"><FiCheck size={14} /></button>
                      <button onClick={() => { if(window.confirm('Reject this booking?')) updateMut.mutate({ id: item._id, payload: { status: 'cancelled' } }) }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors mr-1" title="Reject"><FiX size={14} /></button>
                    </>
                  )}
                  <button onClick={() => setViewing(item)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><FiEye size={14} /></button>
                  <button onClick={() => openEdit(item)} className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"><FiEdit2 size={14} /></button>
                  <button onClick={() => { if(window.confirm('Delete this booking?')) delMut.mutate(item._id) }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><FiTrash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Modal */}
      {viewing && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="font-bold text-primary font-heading flex items-center gap-2"><FiBriefcase className="text-secondary" /> Booking Details</h3>
              <button onClick={() => setViewing(null)} className="p-2 hover:bg-gray-100 rounded-lg"><FiX size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Client Details</p>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mt-1">
                    <p className="font-semibold text-slate-800 flex items-center gap-2">
                      {viewing.isGuest ? viewing.guestName : (viewing.client?.name || viewing.client?.email || 'Unknown')}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-bold uppercase ${viewing.isGuest ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                        {viewing.isGuest ? 'Guest' : 'Registered'}
                      </span>
                    </p>
                    {viewing.isGuest && (
                      <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                        <p>Email: {viewing.guestEmail}</p>
                        {viewing.guestPhone && <p>Phone: {viewing.guestPhone}</p>}
                      </div>
                    )}
                  </div>
                </div>
                <div><p className="text-xs text-slate-400 uppercase tracking-wide">Type / Service</p>
                  <p className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                    {viewing.service}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${viewing.bookingType === 'product' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {viewing.bookingType === 'product' ? 'Software Product' : 'Service'}
                    </span>
                  </p>
                </div>
                <div><p className="text-xs text-slate-400 uppercase tracking-wide">Budget / Pricing</p><p className="font-semibold text-emerald-600">{viewing.monthlyPrice ? viewing.monthlyPrice : `LKR ${(viewing.budget || viewing.amount || 0).toLocaleString()}`}</p></div>
                <div><p className="text-xs text-slate-400 uppercase tracking-wide">Preferred Date</p><p className="font-semibold text-slate-800">{viewing.preferredDate ? new Date(viewing.preferredDate).toLocaleDateString() : '—'}</p></div>
                <div><p className="text-xs text-slate-400 uppercase tracking-wide">Status</p><p className="font-semibold capitalize">{viewing.status.replace('_', ' ')}</p></div>
                <div><p className="text-xs text-slate-400 uppercase tracking-wide">Payment</p><p className="font-semibold capitalize">{viewing.paymentStatus}</p></div>
              </div>

              {/* Product / Features Breakdown */}
              {(viewing.productDetails || (viewing.selectedFeatures && viewing.selectedFeatures.length > 0)) && (
                <div className="bg-gradient-to-br from-blue-50/70 to-purple-50/70 border border-blue-100/80 p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Product / Selected Features</p>
                    {viewing.productDetails?.category && (
                      <span className="badge badge-blue text-[10px]">{viewing.productDetails.category}</span>
                    )}
                  </div>
                  {viewing.productDetails?.priceText && (
                    <p className="text-xs text-slate-600 font-medium">Pricing: <span className="font-bold text-secondary">{viewing.productDetails.priceText}</span></p>
                  )}
                  {((viewing.productDetails?.features && viewing.productDetails.features.length > 0) || (viewing.selectedFeatures && viewing.selectedFeatures.length > 0)) && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(viewing.productDetails?.features || viewing.selectedFeatures || []).map((feat, fidx) => (
                        <span key={fidx} className="bg-white border border-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-md font-medium">
                          ✓ {feat}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div><p className="text-xs text-slate-400 uppercase tracking-wide">Brief / Notes</p><div className="mt-1 p-3 bg-slate-50 rounded-xl text-sm text-slate-700 whitespace-pre-wrap">{viewing.brief || 'No notes provided.'}</div></div>
              
              {viewing.status === 'pending' && (
                <div className="flex gap-2 pt-2">
                  <button onClick={() => { updateMut.mutate({ id: viewing._id, payload: { status: 'confirmed' } }); setViewing(null) }} className="flex-1 btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-600 justify-center"><FiCheck size={14}/> Approve</button>
                  <button onClick={() => { updateMut.mutate({ id: viewing._id, payload: { status: 'cancelled' } }); setViewing(null) }} className="flex-1 btn-danger justify-center"><FiX size={14}/> Reject</button>
                </div>
              )}
            </div>
          </motion.div>
        </div>, document.body
      )}

      {/* Edit Modal */}
      {editing && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="font-bold text-primary font-heading">Edit Booking</h3>
              <button onClick={() => setEditing(null)} className="p-2 hover:bg-gray-100 rounded-lg"><FiX size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="form-label">Service</label><input className="form-input" value={form.service} onChange={e=>setForm(s=>({...s, service: e.target.value}))}/></div>
              <div><label className="form-label">Brief</label><textarea className="form-input resize-none" rows={3} value={form.brief} onChange={e=>setForm(s=>({...s, brief: e.target.value}))}/></div>
              <div><label className="form-label">Budget (LKR)</label><input type="number" className="form-input" value={form.budget} onChange={e=>setForm(s=>({...s, budget: Number(e.target.value)}))}/></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={e=>setForm(s=>({...s, status: e.target.value}))}>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed (Creates Project)</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Payment Status</label>
                  <select className="form-select" value={form.paymentStatus} onChange={e=>setForm(s=>({...s, paymentStatus: e.target.value}))}>
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t">
              <button onClick={() => setEditing(null)} className="btn-ghost flex-1 justify-center">Cancel</button>
              <button onClick={saveEdit} disabled={updateMut.isPending} className="btn-primary flex-1 justify-center gap-2">
                {updateMut.isPending ? <span className="spinner"/> : <FiCheck size={14}/>} Save Changes
              </button>
            </div>
          </motion.div>
        </div>, document.body
      )}
    </div>
  )
}
