import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useAuthStore from '../store/authStore'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import SiteLogo from '../components/branding/SiteLogo'
import UserAvatar from '../components/ui/UserAvatar'
import { resolveNotificationLink } from '../lib/notificationLink'
import {
  FiHome, FiUsers, FiCalendar, FiDollarSign, FiFileText, FiBriefcase,
  FiFolder, FiBarChart2, FiSettings, FiLogOut, FiMenu, FiX, FiBell,
  FiUser, FiCheckSquare, FiCreditCard, FiLayers, FiTrendingUp, FiClipboard, FiPieChart, FiMessageSquare, FiBook, FiChevronDown,
  FiDownload, FiSearch,
  FiGift, FiServer, FiZap, FiMapPin, FiShield, FiFileText as FiQuote, FiTarget, FiKey, FiMail, FiVideo, FiEdit3
} from 'react-icons/fi'
import toast from 'react-hot-toast'

const adminNav = [
  { group: 'Overview', items: [
    { to: '/admin', label: 'Dashboard', icon: FiHome, exact: true },
    { to: '/admin/analytics', label: 'Analytics', icon: FiBarChart2 },
    { to: '/admin/ai-analyzer', label: 'AI Analyzer', icon: FiZap },
    { to: '/admin/social-analytics', label: 'Social Analytics', icon: FiPieChart },
  ]},
  { group: 'Human Resources', items: [
    { to: '/admin/employees', label: 'Employees', icon: FiUsers },
    { to: '/admin/team-hub', label: 'Team Leaders & Members', icon: FiUsers },
    { to: '/admin/staff-hierarchy', label: 'Organization Hierarchy', icon: FiLayers },
    { to: '/admin/attendance', label: 'Attendance', icon: FiClipboard },
    { to: '/admin/leaves', label: 'Leave Management', icon: FiCalendar },
    { to: '/admin/policies', label: 'Policy Management', icon: FiShield },
    { to: '/admin/payroll', label: 'Payroll', icon: FiDollarSign },
    { to: '/admin/epf', label: 'EPF / ETF', icon: FiTrendingUp },
    { to: '/admin/advances', label: 'Advances', icon: FiCreditCard },
    { to: '/admin/loans', label: 'Loans', icon: FiCreditCard },
    { to: '/admin/letters', label: 'Letters', icon: FiFileText },
    { to: '/admin/signature-requests', label: 'Signature & Seal', icon: FiEdit3 },
    { to: '/admin/performance', label: 'Performance', icon: FiTrendingUp },
  ]},
  { group: 'Recruitment', items: [
    { to: '/admin/recruitment', label: 'Recruitment / ATS', icon: FiBriefcase },
  ]},
  { group: 'Business', items: [
    { to: '/admin/projects', label: 'Projects', icon: FiFolder },
    { to: '/admin/clients', label: 'Clients', icon: FiUsers },
    { to: '/admin/quotations', label: 'Quotations', icon: FiQuote },
    { to: '/admin/invoices', label: 'Invoices', icon: FiCreditCard },
    { to: '/admin/agreements', label: 'Agreements', icon: FiFileText },
    { to: '/admin/subscriptions', label: 'Subscriptions', icon: FiServer },
    { to: '/admin/bookings', label: 'Bookings', icon: FiBook },
    { to: '/admin/services', label: 'Services & Products', icon: FiLayers },
    { to: '/admin/leaders', label: 'Leaders', icon: FiUsers },
    { to: '/admin/rewards', label: 'Rewards & Loyalty', icon: FiGift },
    { to: '/admin/feedback', label: 'Feedback', icon: FiMessageSquare },
  ]},
  { group: 'Finance', items: [
    { to: '/admin/financial', label: 'Financial Overview', icon: FiDollarSign },
    { to: '/admin/financial-reports', label: 'Financial Reports', icon: FiPieChart },
    { to: '/admin/finance-entries', label: 'Income & Expenses', icon: FiClipboard },
    { to: '/admin/petty-cash', label: 'Petty Cash', icon: FiCreditCard },
    { to: '/admin/cheques', label: 'Cheques', icon: FiTarget },
    { to: '/admin/bank-management', label: 'Bank Management', icon: FiBarChart2 },
    { to: '/admin/bank-transactions', label: 'Bank Transactions', icon: FiClipboard },
    { to: '/admin/income-tax', label: 'Income Tax', icon: FiDollarSign },
    { to: '/admin/exports', label: 'Export Center', icon: FiDownload },
  ]},
  { group: 'System', items: [
    { to: '/admin/branches', label: 'Branch Management', icon: FiMapPin },
    { to: '/admin/log-centre', label: 'Log Centre', icon: FiShield },
    { to: '/admin/messages', label: 'Messages', icon: FiMessageSquare },
    { to: '/admin/meetings', label: 'Meetings', icon: FiVideo },
    { to: '/admin/requests', label: 'Requests', icon: FiClipboard },
    { to: '/admin/tool-assignments', label: 'Tool Assignments', icon: FiKey },
    { to: '/admin/settings', label: 'Settings', icon: FiSettings },
  ]},
]

const excludedManagerPaths = [
  '/admin/financial-reports',
  '/admin/payroll',
  '/admin/income-tax',
  '/admin/branches',
  '/admin/bank-management',
  '/admin/bank-transactions',
  '/admin/financial',
  '/admin/finance-entries',
]

const managerNav = adminNav.map(group => ({
  ...group,
  items: group.items
    .filter(item => !excludedManagerPaths.includes(item.to))
    .map(item => ({
      ...item,
      to: item.to.replace('/admin', '/manager')
    }))
})).filter(group => group.items.length > 0)

const developerNav = [
  { group: 'My Workspace', items: [
    { to: '/developer', label: 'Dashboard', icon: FiHome, exact: true },
    { to: '/developer/projects', label: 'My Projects', icon: FiFolder },
    { to: '/developer/profile', label: 'My Profile', icon: FiUser },
    { to: '/developer/tasks', label: 'Assigned Tasks', icon: FiCheckSquare },
    { to: '/developer/work-logs', label: 'Daily Work Log', icon: FiClipboard },
    { to: '/developer/requests', label: 'My Requests', icon: FiFileText },
    { to: '/developer/tools', label: 'My Tools', icon: FiKey },
    { to: '/developer/performance', label: 'Performance', icon: FiTrendingUp },
  ]},
  { group: 'Compensation', items: [
    { to: '/developer/attendance', label: 'Attendance', icon: FiClipboard },
    { to: '/developer/leaves', label: 'Leave Requests', icon: FiCalendar },
    { to: '/developer/payslips', label: 'Salary + EPF/ETF', icon: FiDollarSign },
    { to: '/developer/export', label: 'Export Center', icon: FiDownload },
    { to: '/developer/letters', label: 'Letters', icon: FiFileText },
    { to: '/developer/signature-requests', label: 'Signature & Seal', icon: FiEdit3 },
    { to: '/developer/messages', label: 'Messages', icon: FiMessageSquare },
    { to: '/developer/meetings', label: 'Meetings', icon: FiVideo },
    { to: '/developer/notifications', label: 'Notifications', icon: FiBell },
  ]},
]

const withBasePath = (groups, basePath) =>
  groups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      to: item.to.startsWith('/developer') ? item.to.replace('/developer', basePath) : item.to,
    })),
  }))

const navMap = {
  admin: adminNav,
  manager: managerNav,
  developer: developerNav,
  designer: withBasePath(developerNav, '/designer'),
  marketing: withBasePath(developerNav, '/marketing'),
}

export default function DashboardLayout({ role }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const notifButtonRef = useRef(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchBox, setShowSearchBox] = useState(false)
  const searchBoxRef = useRef(null)

  const isTopManager = user?.role === 'admin' || user?.email === 'manager@raxwo.com' || (user?.name || '').toLowerCase().includes('rashin')

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/system-metrics/notifications').then(r => r.data).catch(() => ({ notifications: [] })),
    refetchInterval: 30000,
    staleTime: 15 * 1000,
  })

  const notifications = notifData?.notifications || []
  const unreadCount = notifications.filter(n => !n.read).length

  const handleNotificationClick = async (n) => {
    const finalRole = user?.role || role
    try {
      if (!n.read) {
        await api.put(`/system-metrics/notifications/${n._id}/read`)
        qc.setQueryData(['notifications'], (prev) => {
          if (!prev?.notifications) return prev
          return {
            ...prev,
            notifications: prev.notifications.map((x) => (x._id === n._id ? { ...x, read: true, readAt: new Date().toISOString() } : x)),
          }
        })
      }
    } catch (_) {}
    qc.invalidateQueries({ queryKey: ['notifications'] })
    qc.invalidateQueries({ queryKey: ['developer-notifications'] })
    qc.invalidateQueries({ queryKey: ['client-notifications-page'] })
    setShowNotif(false)
    navigate(resolveNotificationLink(n.link, finalRole, n._id))
  }

  const handleMarkAllRead = async () => {
    try {
      await api.put('/system-metrics/notifications/read')
      qc.setQueryData(['notifications'], (prev) => {
        if (!prev?.notifications) return prev
        return {
          ...prev,
          notifications: prev.notifications.map((x) => ({ ...x, read: true, readAt: new Date().toISOString() })),
        }
      })
    } catch (_) {}
    qc.invalidateQueries({ queryKey: ['notifications'] })
    qc.invalidateQueries({ queryKey: ['developer-notifications'] })
    qc.invalidateQueries({ queryKey: ['client-notifications-page'] })
  }

  const handleLogout = () => {
    localStorage.removeItem('raxwo-auth')
    window.location.href = '/'
  }

  const rawNavGroups = navMap[user?.role] || navMap[role] || []

  const navGroups = useMemo(() => {
    if (isTopManager) return rawNavGroups
    const restrictedEndings = ['/ai-analyzer', '/analytics', '/social-analytics']
    return rawNavGroups.map(group => ({
      ...group,
      items: group.items.filter(item => !restrictedEndings.some(end => item.to.endsWith(end)))
    })).filter(group => group.items.length > 0)
  }, [rawNavGroups, isTopManager])

  const searchResults = useMemo(() => {
    if (!searchQuery) return []
    const q = searchQuery.toLowerCase()
    const results = []
    navGroups.forEach(group => {
      group.items.forEach(item => {
        if (item.label.toLowerCase().includes(q) || group.group.toLowerCase().includes(q)) {
          results.push({ ...item, group: group.group })
        }
      })
    })
    return results.slice(0, 8)
  }, [searchQuery, navGroups])



  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        // Only close if we didn't click the search toggle button (to prevent double toggle)
        if (!e.target.closest('.search-toggle-btn')) {
          setShowSearchBox(false)
        }
      }
    }
    if (showSearchBox) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSearchBox])

  // When mobile sidebar opens, scroll the active nav item into view so user sees their selected tab
  useEffect(() => {
    if (!sidebarOpen) return
    // Small delay to let CSS transition start
    const timer = setTimeout(() => {
      const activeLink = document.querySelector('.lg\\:hidden aside .sidebar-link.active')
      if (activeLink) {
        activeLink.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [sidebarOpen])

  const renderSidebar = () => (
    <div className="h-full flex flex-col bg-white border-r border-slate-200 overflow-hidden">
      {/* Logo */}
      <div className="p-6 border-b border-slate-200">
        <div>
          <SiteLogo to="/" variant="light" />
          <p className="text-slate-400 text-xs capitalize mt-2 pl-1">{user?.role} Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        {navGroups.map(group => (
          <div key={group.group}>
            <p className="sidebar-group-label mb-2">{group.group}</p>
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={16} className={isActive ? 'text-white' : 'text-slate-500'} />
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
          <UserAvatar user={user} className="w-9 h-9 rounded-full flex-shrink-0" imgClassName="w-full h-full object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-slate-800 text-sm font-medium truncate">{user?.name}</p>
            <p className="text-slate-400 text-xs capitalize truncate">{user?.role}</p>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="Logout">
            <FiLogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0 bg-white shadow-card">
        {renderSidebar()}
      </aside>

      {/* Mobile sidebar backdrop - still animated via AnimatePresence */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar - ALWAYS in the DOM so nav scroll position is preserved between opens */}
      <aside
        className={`lg:hidden fixed left-0 top-0 bottom-0 w-72 max-w-[85vw] z-50 shadow-2xl transition-transform duration-300 ease-in-out will-change-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!sidebarOpen}
      >
        {renderSidebar()}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 relative z-10">
        {/* Top bar */}
        <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-3 sm:px-4 md:px-6 py-3 flex items-center justify-between shadow-card flex-shrink-0 relative z-30">
          <button className="lg:hidden p-2 -ml-2 text-gray-600 hover:text-primary" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <FiMenu size={22} />
          </button>

          <div className="flex-1 px-4 lg:px-8 max-w-xl flex items-center justify-end sm:justify-start">
            {/* Mobile Search Toggle */}
            <button 
              className="search-toggle-btn sm:hidden p-2 text-slate-400 hover:text-primary mr-2"
              onClick={() => setShowSearchBox(!showSearchBox)}
            >
              <FiSearch size={20} />
            </button>
            <div className="relative hidden sm:block w-full">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search navigation..." 
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setShowSearchBox(true)}
              />
            </div>
            
            {/* Mobile Search Overlay */}
            <AnimatePresence>
              {showSearchBox && (
                <motion.div
                  ref={searchBoxRef}
                  key="mobile-search-overlay"
                  initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 sm:mt-2 bg-white sm:rounded-xl shadow-2xl border-b sm:border border-slate-100 py-2 z-[300] max-h-[60vh] overflow-y-auto"
                >
                  <div className="sm:hidden px-4 pb-2 mb-2 border-b border-slate-100">
                    <input 
                      type="text" 
                      placeholder="Search..." 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {searchQuery && searchResults.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-500">No matching pages found</div>
                  ) : searchQuery ? (
                    searchResults.map((res, i) => (
                      <NavLink
                        key={i}
                        to={res.to}
                        className="flex items-center gap-3 px-4 py-3 sm:py-2 hover:bg-slate-50"
                        onClick={() => { setShowSearchBox(false); setSearchQuery(''); }}
                      >
                        <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500"><res.icon size={16} sm:size={14} /></div>
                        <div>
                          <p className="text-[15px] sm:text-sm font-medium text-slate-700">{res.label}</p>
                          <p className="text-[11px] sm:text-[10px] text-slate-400 uppercase">{res.group}</p>
                        </div>
                      </NavLink>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate-400 sm:hidden">Type to search...</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notifications */}
            <div className="relative z-[230]">
              <button
                ref={notifButtonRef}
                onClick={() => setShowNotif(!showNotif)}
                className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-xs"
                title="Notifications"
              >
                <FiBell size={22} className="text-slate-700" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[22px] h-5 px-1.5 bg-red-500 text-white text-[11px] rounded-full flex items-center justify-center font-extrabold border-2 border-white shadow-sm leading-none z-10">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotif && (
                  <>
                    {/* Mobile Backdrop */}
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/40 z-[999] sm:hidden"
                      onClick={() => setShowNotif(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.96 }}
                      className="absolute right-0 top-14 w-[calc(100vw-24px)] sm:w-[450px] md:w-[480px] max-w-[480px] bg-white rounded-3xl shadow-2xl z-[1000] border border-slate-200/90 origin-top-right overflow-hidden"
                    >
                      <div className="p-4 px-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/90">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-base">Notifications</h3>
                          {unreadCount > 0 && <span className="badge badge-blue font-bold px-2 py-0.5 text-xs">{unreadCount} new</span>}
                        </div>
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors cursor-pointer"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-[70vh] sm:max-h-96 overflow-y-auto custom-scrollbar pb-2">
                        {notifications.length === 0 ? (
                          <p className="text-center text-slate-400 text-sm py-12 sm:py-8">No notifications</p>
                        ) : notifications.slice(0, 10).map(n => (
                          <button key={n._id} type="button" onClick={() => handleNotificationClick(n)} className={`w-full text-left p-4 sm:p-4 border-b border-slate-100/70 transition-all flex items-start gap-3.5 relative group ${n.read ? 'bg-white hover:bg-slate-50' : 'bg-[#20b2f5]/5 hover:bg-[#20b2f5]/10'}`}>
                            {!n.read && <div className="absolute top-1/2 -translate-y-1/2 left-0 w-1.5 h-10 bg-[#20b2f5] rounded-r-md" />}
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xs ${n.read ? 'bg-slate-100 text-slate-400' : 'bg-[#20b2f5]/20 text-[#20b2f5]'}`}>
                              <FiBell size={18} />
                            </div>
                            <div className="flex-1 min-w-0 pr-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className={`text-sm font-bold truncate ${n.read ? 'text-slate-700' : 'text-slate-900'}`}>{n.title}</p>
                                <span className="text-[10px] text-slate-400 font-medium shrink-0">{new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                              </div>
                              <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">{n.message}</p>
                              <p className="text-[10px] text-slate-400 mt-1.5 font-medium">{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* User profile menu */}
            <div className="relative z-[240]">
              <button
                onClick={() => setShowProfileMenu((s) => !s)}
                className="h-11 px-3 sm:px-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center gap-2.5 text-slate-800 font-semibold text-sm transition-all hover:scale-105 active:scale-95 shadow-xs"
              >
                <UserAvatar user={user} className="w-8 h-8 rounded-xl bg-white border border-slate-200" imgClassName="w-full h-full rounded-xl object-cover" />
                <span className="hidden sm:inline max-w-[8rem] truncate font-bold text-slate-900">{user?.name?.split(' ')[0]}</span>
                <FiChevronDown size={16} className="text-slate-500 hidden sm:block" />
              </button>
              <AnimatePresence>
                {showProfileMenu && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[260] sm:hidden"
                      onClick={() => setShowProfileMenu(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      className="absolute right-0 top-14 w-64 sm:w-64 p-3 z-[270] rounded-2xl border border-slate-200 bg-white shadow-2xl origin-top-right overflow-hidden space-y-1"
                    >
                      {/* Profile Header Header Box */}
                      <div className="p-3 mb-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                        <UserAvatar user={user} className="w-10 h-10 rounded-xl bg-white border border-slate-200 shrink-0" imgClassName="w-full h-full rounded-xl object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 text-sm truncate leading-tight">{user?.name}</p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{user?.email}</p>
                          <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-extrabold uppercase tracking-wider rounded-md border border-blue-100">
                            {user?.role}
                          </span>
                        </div>
                      </div>

                      <NavLink
                        to={['developer', 'designer', 'marketing'].includes(user?.role) ? `/${user?.role}/profile` : user?.role === 'manager' ? '/manager' : '/admin/settings'}
                        onClick={() => setShowProfileMenu(false)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50/70 transition-all text-left"
                      >
                        <FiUser size={16} className="text-slate-400" />
                        <span>View Profile</span>
                      </NavLink>

                      <NavLink
                        to={['developer', 'designer', 'marketing'].includes(user?.role) ? `/${user?.role}/notifications` : user?.role === 'manager' ? '/manager/profile' : '/admin/settings'}
                        onClick={() => setShowProfileMenu(false)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50/70 transition-all text-left"
                      >
                        <FiSettings size={16} className="text-slate-400" />
                        <span>Settings</span>
                      </NavLink>

                      <div className="pt-1 mt-1 border-t border-slate-100">
                        <button
                          onClick={() => { setShowProfileMenu(false); handleLogout(); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-all text-left"
                        >
                          <FiLogOut size={16} className="text-red-500" />
                          <span>Logout</span>
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-5 relative z-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
