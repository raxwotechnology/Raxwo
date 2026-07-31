import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import {
  FiFileText, FiLink, FiServer, FiDollarSign, FiClock, FiAlertCircle, FiDownload, FiCheckCircle
} from 'react-icons/fi'
import { mediaUrl } from '../../lib/media'
import { motion, AnimatePresence } from 'framer-motion'
import ClientPageHeader from '../../components/ui/ClientPageHeader'

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
}

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

export default function ClientSubscriptions() {
  const qc = useQueryClient()
  const [selectedSub, setSelectedSub] = useState(null)
  const [showPaymentForm, setShowPaymentForm] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['client-subscriptions'],
    queryFn: () => api.get('/subscriptions/my-summary').then(r => r.data)
  })

  const subs = data?.subscriptions || []
  const summary = data?.summary || {}

  const payMut = useMutation({
    mutationFn: (payload) => api.post(`/subscriptions/${selectedSub._id}/payments`, payload).then(r => r.data),
    onSuccess: () => {
      toast.success('Payment recorded successfully')
      setShowPaymentForm(false)
      setSelectedSub(null)
      qc.invalidateQueries({ queryKey: ['client-subscriptions'] })
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Payment failed')
  })

  const handlePay = (sub) => {
    setSelectedSub(sub)
    setShowPaymentForm(true)
  }

  // Initialize PayHere checkout
  const handlePayHereCheckout = async () => {
    try {
      const { data } = await api.post('/payments/payhere/init', { 
        itemId: selectedSub._id, 
        itemType: 'subscription' 
      })
      const pd = data.paymentData
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = pd.sandbox ? 'https://sandbox.payhere.lk/pay/checkout' : 'https://www.payhere.lk/pay/checkout'
      Object.entries(pd).filter(([k]) => k !== 'sandbox' && k !== 'paymentId').forEach(([k, v]) => {
        const input = document.createElement('input')
        input.type = 'hidden'; input.name = k; input.value = v
        form.appendChild(input)
      })
      document.body.appendChild(form)
      form.submit()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment initiation failed')
    }
  }

  return (
    <div className="animate-fade-in pb-10">
      <ClientPageHeader 
        title="My Subscriptions" 
        subtitle="Manage your active subscriptions, billing, hosting, and agreements."
      />
      <section className="section-padding bg-slate-50 min-h-screen pt-6 sm:pt-8">
        <div className="container-max space-y-8">

          {/* KPI Summary Cards */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
              <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-500 relative z-10">Active Subscriptions</p>
              <p className="text-2xl sm:text-3xl font-bold text-primary mt-1 relative z-10">{summary.active || 0}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-red-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
              <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-500 relative z-10">Overdue Payments</p>
              <p className="text-2xl sm:text-3xl font-bold text-red-500 mt-1 relative z-10">{summary.overdue || 0}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
              <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-500 relative z-10">Total Due</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 relative z-10 truncate" title={`LKR ${(summary.totalDue || 0).toLocaleString()}`}>
                <span className="text-sm font-medium text-slate-400 mr-1">LKR</span>
                {(summary.totalDue || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
              <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-500 relative z-10">Total Paid</p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1 relative z-10 truncate" title={`LKR ${(summary.totalPaid || 0).toLocaleString()}`}>
                <span className="text-sm font-medium text-emerald-400 mr-1">LKR</span>
                {(summary.totalPaid || 0).toLocaleString()}
              </p>
            </div>
          </motion.div>

          {/* Subscriptions Grid */}
          <motion.div 
            variants={containerVariants} 
            initial="hidden" 
            animate="show" 
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {subs.map(sub => {
              const { isInReminder, isOverdue, daysUntilDue } = getReminderState(sub);
              const hasBalance = sub.remainingBalance > 0;

              return (
                <motion.div 
                  key={sub._id} 
                  variants={itemVariants}
                  className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 relative ${
                    isOverdue ? 'border-red-200' : isInReminder ? 'border-amber-300 ring-2 ring-amber-400/20' : 'border-slate-100'
                  }`}
                >
                  {/* Top Color Accent */}
                  <div className={`h-1.5 w-full ${isOverdue ? 'bg-red-500' : isInReminder ? 'bg-amber-500' : 'bg-primary'}`} />
                  
                  <div className="p-5 sm:p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-4 gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-secondary uppercase tracking-widest bg-secondary/10 px-2 py-0.5 rounded-full shrink-0">
                            {sub.typeLabel}
                          </span>
                          <span className="text-xs text-slate-400 truncate">#{sub.subscriptionNo}</span>
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-slate-800 font-heading leading-tight truncate" title={sub.title}>
                          {sub.title}
                        </h3>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                          sub.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                          sub.status === 'overdue' ? 'bg-red-50 text-red-600 border border-red-100' : 
                          'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {sub.status}
                        </span>
                        {isInReminder && (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                            Due in {daysUntilDue}d
                          </span>
                        )}
                      </div>
                    </div>

                    {sub.description && (
                      <p className="text-sm text-slate-500 mb-5 line-clamp-2" title={sub.description}>
                        {sub.description}
                      </p>
                    )}

                    {/* Financial Block */}
                    <div className={`rounded-xl p-4 space-y-3 mb-5 border ${
                      isOverdue ? 'bg-red-50/50 border-red-100' : isInReminder ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50/70 border-slate-100/50'
                    }`}>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-slate-500">Monthly Amount</span>
                        <span className="text-sm font-bold text-slate-800">LKR {sub.amount?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-slate-500">Next Due Date</span>
                        <span className={`text-sm font-bold flex items-center gap-1.5 ${isInReminder ? 'text-amber-800 font-extrabold' : 'text-slate-800'}`}>
                          <FiClock className={isInReminder ? 'text-amber-600' : 'text-primary opacity-70'} /> 
                          {new Date(sub.nextDueDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="h-px w-full bg-slate-200/60 my-2" />
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-slate-500">Balance Due</span>
                        <span className={`text-base font-black ${hasBalance ? 'text-red-600' : 'text-emerald-500 flex items-center gap-1'}`}>
                          {!hasBalance && <FiCheckCircle size={14} />}
                          LKR {sub.remainingBalance?.toLocaleString()}
                        </span>
                      </div>
                      {isOverdue && (
                        <div className="mt-2 bg-red-100 text-red-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border border-red-200">
                          <FiAlertCircle size={14} className="shrink-0 text-red-600" /> 
                          <span>Payment is {sub.overdueDays || 1} days overdue!</span>
                        </div>
                      )}
                      {isInReminder && (
                        <div className="mt-2 bg-amber-100 text-amber-900 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border border-amber-300">
                          <FiAlertCircle size={14} className="shrink-0 text-amber-700" /> 
                          <span>Payment Reminder: Due in {daysUntilDue} day(s)!</span>
                        </div>
                      )}
                    </div>

                    {/* Details Blocks */}
                    <div className="mt-auto space-y-4">
                      {sub.hostingDetails?.domainName && (
                        <div className="text-sm border border-slate-100 rounded-xl p-3 sm:p-4 hover:bg-slate-50 transition-colors">
                          <p className="font-semibold text-slate-800 flex items-center gap-2 mb-2">
                            <span className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-500 flex items-center justify-center"><FiServer size={12} /></span>
                            Hosting &amp; Domain
                          </p>
                          <div className="text-slate-600 text-xs space-y-1.5 pl-8">
                            <p className="flex justify-between"><span className="text-slate-400">Domain</span> <span className="font-medium text-slate-800 truncate pl-2">{sub.hostingDetails.domainName}</span></p>
                            {sub.hostingDetails.provider && <p className="flex justify-between"><span className="text-slate-400">Provider</span> <span className="font-medium text-slate-800 truncate pl-2">{sub.hostingDetails.provider}</span></p>}
                            {sub.hostingDetails.expiryDate && <p className="flex justify-between"><span className="text-slate-400">Expiry</span> <span className="font-medium text-slate-800 pl-2">{new Date(sub.hostingDetails.expiryDate).toLocaleDateString()}</span></p>}
                            {sub.hostingDetails.hostingUrl && (
                              <a href={sub.hostingDetails.hostingUrl} target="_blank" rel="noreferrer" className="inline-block mt-1 text-primary hover:text-indigo-600 font-medium hover:underline">
                                Manage Panel &rarr;
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {sub.project && (
                        <div className="text-sm border border-slate-100 rounded-xl p-3 sm:p-4 hover:bg-slate-50 transition-colors">
                          <p className="font-semibold text-slate-800 flex items-center gap-2 mb-1">
                            <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-500 flex items-center justify-center"><FiLink size={12} /></span>
                            Linked Project
                          </p>
                          <p className="text-slate-600 text-xs pl-8 mt-1 font-medium truncate" title={sub.project.title}>
                            {sub.project.title}
                          </p>
                        </div>
                      )}

                      {sub.agreements?.length > 0 && (
                        <div className="text-sm border border-slate-100 rounded-xl p-3 sm:p-4">
                          <p className="font-semibold text-slate-800 flex items-center gap-2 mb-3">
                            <span className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-500 flex items-center justify-center"><FiFileText size={12} /></span>
                            Agreements
                          </p>
                          <div className="space-y-2 pl-8">
                            {sub.agreements.map(agr => (
                              <a 
                                key={agr._id} 
                                href={mediaUrl(agr.fileUrl)} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="flex items-center justify-between gap-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 px-3 py-2 rounded-lg transition-colors border border-slate-100 group"
                                title={agr.title}
                              >
                                <span className="truncate">{agr.title}</span>
                                <FiDownload className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="p-4 sm:p-5 bg-white border-t border-slate-100 shrink-0">
                    {hasBalance ? (
                      <button 
                        className="w-full relative group overflow-hidden rounded-xl font-bold text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                        style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}
                        onClick={() => handlePay(sub)}
                      >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                        <span className="relative flex items-center justify-center gap-2 py-3 text-sm">
                          <FiDollarSign size={16} /> Pay LKR {sub.remainingBalance?.toLocaleString()}
                        </span>
                      </button>
                    ) : (
                      <div className="w-full py-3 rounded-xl bg-emerald-50 text-emerald-600 font-bold text-sm flex items-center justify-center gap-2 border border-emerald-100/50">
                        <FiCheckCircle size={16} /> Fully Paid
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>

          {subs.length === 0 && !isLoading && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="py-16 sm:py-24 px-4 text-center bg-white rounded-3xl border border-slate-100 shadow-sm max-w-2xl mx-auto"
            >
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <FiServer size={32} className="text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">No Active Subscriptions</h3>
              <p className="text-slate-500 max-w-md mx-auto text-sm">
                You don't have any active subscriptions or recurring services linked to your account at the moment.
              </p>
            </motion.div>
          )}

          {/* Payment Modal */}
          <AnimatePresence>
            {showPaymentForm && selectedSub && createPortal(
              <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm z-[9999]">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                  animate={{ opacity: 1, scale: 1, y: 0 }} 
                  exit={{ opacity: 0, scale: 0.95, y: 20 }} 
                  className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
                >
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <h2 className="text-xl font-bold font-heading text-slate-800">Complete Payment</h2>
                    <button 
                      onClick={() => setShowPaymentForm(false)} 
                      className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                  <div className="p-6 sm:p-8 space-y-8 overflow-y-auto">
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-500 mb-2">Amount Due for {selectedSub.title}</p>
                      <p className="text-4xl font-black text-slate-800 tracking-tight">
                        <span className="text-xl text-slate-400 font-bold mr-1">LKR</span>
                        {selectedSub.remainingBalance?.toLocaleString()}
                      </p>
                    </div>
                    
                    <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100/50 flex flex-col items-center justify-center gap-2">
                      <div className="flex gap-2">
                        {/* Fake PayHere logos for visual trust */}
                        <div className="w-10 h-6 bg-white rounded shadow-sm flex items-center justify-center text-[8px] font-bold text-blue-600 border border-slate-100">VISA</div>
                        <div className="w-10 h-6 bg-white rounded shadow-sm flex items-center justify-center text-[8px] font-bold text-red-500 border border-slate-100">MC</div>
                      </div>
                      <p className="text-xs font-medium text-indigo-800 text-center mt-1">Secure processing via PayHere</p>
                    </div>

                    <div className="pt-2 flex flex-col gap-3">
                      <button 
                        className="w-full py-3.5 rounded-xl text-white font-bold text-sm shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/40 active:translate-y-0"
                        style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)' }}
                        onClick={handlePayHereCheckout}
                      >
                        Proceed to Pay
                      </button>
                      <button 
                        className="w-full py-3.5 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
                        onClick={() => setShowPaymentForm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>,
              document.body
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  )
}

