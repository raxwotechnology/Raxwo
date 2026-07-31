import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import useAuthStore from '../../store/authStore'
import {
  FiFolder, FiCreditCard, FiCheckCircle, FiClock, FiTrendingUp,
  FiGift, FiServer, FiArrowRight, FiCalendar, FiMessageSquare,
  FiBriefcase, FiStar, FiBell, FiFileText
} from 'react-icons/fi'
import { formatMoney } from '../../lib/currencies'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts'
import ClientPageHeader from '../../components/ui/ClientPageHeader'

const QuickAction = ({ to, icon: Icon, label, color, badge }) => (
  <Link to={to}
    className={`card p-4 flex flex-col items-center gap-2 text-center hover:shadow-md transition-all group border ${color}`}>
    <div className="w-10 h-10 rounded-xl bg-current/10 flex items-center justify-center group-hover:scale-110 transition-transform relative">
      <Icon size={20} className="text-current" />
      {badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white leading-none z-10">{badge > 9 ? '9+' : badge}</span>
      )}
    </div>
    <span className="text-xs font-semibold text-slate-700">{label}</span>
  </Link>
)

const getDaysLeft = (deadline) => {
  if (!deadline) return null
  const diff = new Date(deadline) - new Date()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  return days > 0 ? days : 0
}

export default function ClientDashboard() {
  const { user } = useAuthStore()

  const { data: projData }    = useQuery({ queryKey: ['client-projects'],              queryFn: () => api.get('/projects').then(r => r.data) })
  const { data: invData }     = useQuery({ queryKey: ['client-invoices'],              queryFn: () => api.get('/invoices').then(r => r.data) })
  const { data: rewardsData } = useQuery({ queryKey: ['client-rewards-dashboard'],     queryFn: () => api.get('/rewards/me').then(r => r.data) })
  const { data: subData }     = useQuery({ queryKey: ['client-subscriptions-dashboard'], queryFn: () => api.get('/subscriptions/my-summary').then(r => r.data) })
  const { data: notifData }   = useQuery({ queryKey: ['notifications'],                queryFn: () => api.get('/system-metrics/notifications').then(r => r.data) })
  const { data: bookingData } = useQuery({ queryKey: ['client-bookings-dash'],         queryFn: () => api.get('/bookings').then(r => r.data) })
  const { data: quoteData }   = useQuery({ queryKey: ['client-quotations-dash'],       queryFn: () => api.get('/quotations').then(r => r.data).catch(() => ({ quotations: [] })) })

  const projects     = projData?.projects  || []
  const invoices     = invData?.invoices   || []
  const bookings     = bookingData?.bookings || []
  const quotations   = quoteData?.quotations || []
  
  const activeProjects  = projects.filter(p => p.status === 'active').length
  const completedProjects = projects.filter(p => p.status === 'completed').length
  const pendingInvoices = invoices.filter(i => i.status === 'sent').length
  const overdueInvoices = invoices.filter(i => i.status === 'overdue').length
  const totalPaid    = invoices.filter(i => i.status === 'paid').reduce((a, b) => a + (b.total || 0), 0)
  const pendingQuotes = quotations.filter(q => q.status === 'sent').length

  const rewardPoints = rewardsData?.reward?.totalPoints || 0
  const rewardTier   = rewardsData?.reward?.tier || 'Silver'
  const activeSubs   = subData?.summary?.active || 0
  const overdueSubs  = subData?.summary?.overdue || 0
  const unreadNotifs = (notifData?.notifications || []).filter(n => !n.read).length
  const pendingBookings = bookings.filter(b => b.status === 'pending').length

  const tierColors = {
    Silver:   'text-slate-600 bg-slate-100',
    Gold:     'text-amber-700 bg-amber-100',
    Platinum: 'text-violet-700 bg-violet-100',
  }

  // Chart Data
  const projectChartData = [
    { name: 'Active', value: activeProjects, color: '#3b82f6' },
    { name: 'Completed', value: completedProjects, color: '#10b981' },
    { name: 'Pending', value: projects.filter(p => p.status === 'pending').length, color: '#94a3b8' },
  ].filter(d => d.value > 0)

  const invoiceChartData = [
    { name: 'Paid', count: invoices.filter(i => i.status === 'paid').length },
    { name: 'Pending', count: pendingInvoices },
    { name: 'Overdue', count: overdueInvoices },
  ]

  return (
    <div className="animate-fade-in">
      <ClientPageHeader 
        title={`Welcome back, ${user?.name} 👋`} 
        subtitle="Overview of your projects, payments, and subscriptions"
        rightContent={
          <Link to="/booking" className="btn-primary bg-white hover:bg-white/90 text-primary gap-2">
            <FiBriefcase size={14} /> Book a Service <FiArrowRight size={13} />
          </Link>
        }
      />
      
      <section className="section-padding bg-slate-50 min-h-screen">
        <div className="container-max space-y-6">

      {/* Quick Actions */}
      <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { to: '/my-projects',      icon: FiFolder,       label: 'Projects',       color: 'text-blue-600 border-blue-100',    badge: 0 },
          { to: '/payments',         icon: FiCreditCard,   label: 'Invoices',       color: 'text-emerald-600 border-emerald-100', badge: pendingInvoices },
          { to: '/my-subscriptions', icon: FiServer,       label: 'Subscriptions',  color: 'text-purple-600 border-purple-100', badge: overdueSubs },
          { to: '/booking',          icon: FiBriefcase,    label: 'Book Service',   color: 'text-orange-600 border-orange-100', badge: 0 },
          { to: '/rewards',          icon: FiGift,         label: 'Rewards',        color: 'text-amber-600 border-amber-100',  badge: 0 },
          { to: '/messages',         icon: FiMessageSquare,label: 'Messages',       color: 'text-teal-600 border-teal-100',    badge: 0 },
          { to: '/payments',         icon: FiFileText,     label: 'Quotations',     color: 'text-pink-600 border-pink-100',    badge: pendingQuotes },
          { to: '/notifications',    icon: FiBell,         label: 'Alerts',         color: 'text-slate-600 border-slate-100',  badge: unreadNotifs },
        ].map((a, i) => (
          <motion.div key={a.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
            <QuickAction {...a} />
          </motion.div>
        ))}
      </div>

      {/* Advanced KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Active Projects',   value: activeProjects,          icon: FiFolder,     color: 'kpi-blue' },
          { label: 'Pending Quotes',    value: pendingQuotes,           icon: FiFileText,   color: 'kpi-orange' },
          { label: 'Pending Invoices',  value: pendingInvoices,         icon: FiClock,      color: overdueSubs > 0 ? 'kpi-orange' : 'kpi-blue' },
          { label: 'Active Subs',       value: activeSubs,              icon: FiServer,     color: 'kpi-navy' },
          { label: 'Total Paid',        value: formatMoney(totalPaid),  icon: FiCreditCard, color: 'kpi-purple' },
          { label: 'Reward Points',     value: rewardPoints.toLocaleString(), icon: FiGift, color: 'kpi-green' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className={`kpi-card ${s.color}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{s.label}</p>
                <p className="text-xl font-bold text-primary font-heading">{s.value}</p>
              </div>
              <s.icon size={18} className="text-gray-300 mt-0.5" />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Charts Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card card-body h-[280px] flex flex-col">
            <h3 className="font-bold text-primary font-heading text-sm mb-4">Project Status</h3>
            <div className="flex-1 min-h-0">
              {projectChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={projectChartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {projectChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">No projects found</div>
              )}
            </div>
          </div>
          
          <div className="card card-body h-[280px] flex flex-col">
            <h3 className="font-bold text-primary font-heading text-sm mb-4">Invoices Overview</h3>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={invoiceChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="count" fill="#20b2f5" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Projects panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card card-body h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-primary font-heading">My Active Projects</h3>
              <Link to="/my-projects" className="text-secondary text-xs hover:underline flex items-center gap-1">
                View all <FiArrowRight size={11} />
              </Link>
            </div>
            <div className="space-y-4 flex-1">
              {projects.filter(p => p.status !== 'cancelled').slice(0, 5).map(p => {
                const daysLeft = getDaysLeft(p.deadline)
                return (
                  <div key={p._id} className="p-4 bg-gray-50 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-800 text-sm truncate">{p.title}</h4>
                        {daysLeft !== null && p.status === 'active' && (
                          <p className="text-xs text-orange-600 mt-1 font-medium flex items-center gap-1">
                            <FiClock size={12} /> {daysLeft} days to finish
                          </p>
                        )}
                        {p.status === 'completed' && <p className="text-xs text-emerald-600 mt-1 font-medium">Completed</p>}
                      </div>
                      <span className={`badge text-xs capitalize shrink-0 ${p.status === 'active' ? 'badge-green' : p.status === 'completed' ? 'badge-blue' : 'badge-gray'}`}>
                        {p.status}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${p.progress || 0}%` }} transition={{ duration: 0.8 }}
                        className="h-full rounded-full bg-gradient-to-r from-secondary to-blue-500" />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-2">
                      <span>Progress</span>
                      <span className="font-medium text-slate-600">{p.progress || 0}%</span>
                    </div>
                  </div>
                )
              })}
              {projects.length === 0 && (
                <div className="text-center py-10">
                  <FiFolder size={32} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-gray-400 text-sm font-medium">No projects yet</p>
                  <Link to="/booking" className="text-secondary text-sm hover:underline mt-2 block">Book a service to get started →</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent invoices */}
        <div className="card card-body">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-primary font-heading text-sm">Recent Invoices</h3>
            <Link to="/payments" className="text-secondary text-xs hover:underline flex items-center gap-1">View all <FiArrowRight size={11} /></Link>
          </div>
          <div className="space-y-3">
            {invoices.slice(0, 5).map(inv => (
              <div key={inv._id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                    <FiCreditCard size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{inv.invoiceNo}</p>
                    <p className="text-xs text-gray-500 mt-0.5">LKR {inv.total?.toLocaleString()}</p>
                  </div>
                </div>
                <span className={`badge text-[10px] uppercase tracking-wider ${inv.status === 'paid' ? 'badge-green' : inv.status === 'sent' ? 'badge-blue' : inv.status === 'overdue' ? 'badge-red' : 'badge-gray'}`}>
                  {inv.status}
                </span>
              </div>
            ))}
            {invoices.length === 0 && <p className="text-gray-400 text-xs text-center py-4">No invoices yet</p>}
          </div>
        </div>

        {/* Bookings summary */}
        <div className="card card-body">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-primary font-heading text-sm">Recent Bookings</h3>
            <Link to="/booking" className="btn-primary btn-sm gap-1 text-xs"><FiBriefcase size={11} /> New Booking</Link>
          </div>
          {bookings.length === 0 ? (
            <div className="text-center py-8">
              <FiBriefcase size={28} className="mx-auto text-slate-300 mb-3" />
              <p className="text-xs text-gray-400">No bookings yet</p>
              <Link to="/booking" className="text-secondary text-xs hover:underline mt-2 block">Book your first service →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.slice(0, 5).map(b => (
                <div key={b._id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{b.service}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{new Date(b.date).toLocaleDateString()} · LKR {(b.budget || 0).toLocaleString()}</p>
                  </div>
                  <span className={`badge text-[10px] uppercase tracking-wider shrink-0 ml-3 ${b.status === 'confirmed' ? 'badge-green' : b.status === 'pending' ? 'badge-blue' : b.status === 'cancelled' ? 'badge-red' : 'badge-purple'}`}>
                    {b.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </section>
    </div>
  )
}
