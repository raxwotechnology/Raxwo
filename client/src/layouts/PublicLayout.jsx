import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import {
  FiMenu,
  FiX,
  FiBell,
  FiChevronDown,
  FiLogOut,
  FiMessageSquare,
  FiCreditCard,
  FiFolder,
  FiHome,
  FiCalendar,
  FiGift,
  FiUsers,
  FiServer,
  FiLayers,
  FiVideo,
  FiPackage,
  FiBriefcase,
} from 'react-icons/fi'
import { FaFacebookF, FaInstagram, FaYoutube, FaLinkedinIn, FaTiktok } from 'react-icons/fa'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import useAuthStore from '../store/authStore'
import { mediaUrl } from '../lib/media'
import SiteLogo from '../components/branding/SiteLogo'
import api from '../lib/api'
import toast from 'react-hot-toast'

// Minimal public navigation (client-only links go in profile dropdown)
const navLinks = [
  { to: '/', label: 'Home', exact: true },
  { to: '/services', label: 'Services' },
  { to: '/contact', label: 'Contact' },
]

const moreLinks = [
  { to: '/careers', label: 'Careers' },

]

export default function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false)
  const [productsDropdownOpen, setProductsDropdownOpen] = useState(false)
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false)
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false)
  const profileRef = useRef(null)
  const notifRef = useRef(null)
  const moreRef = useRef(null)
  const servicesRef = useRef(null)
  const productsRef = useRef(null)
  const topbarRef = useRef(null)
  const [topbarH, setTopbarH] = useState(80)
  const { user, isAuthenticated, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const isClient = isAuthenticated && user?.role === 'client'

  const { data: notifData } = useQuery({
    queryKey: ['client-navbar-notifications'],
    queryFn: () => api.get('/system-metrics/notifications').then((r) => r.data),
    enabled: isClient,
    refetchInterval: 30000,
  })
  const notifications = notifData?.notifications || []
  const unreadCount = notifications.filter((item) => !item.read).length

  const { data: servicesData } = useQuery({
    queryKey: ['public-services'],
    queryFn: () => api.get('/content/services').then(r => r.data),
  })
  const allServices = servicesData?.services || []
  const serviceCategories = Array.from(new Set(allServices.filter(s => s.type === 'service' || !s.type).map(s => s.category).filter(Boolean)))
  const productCategories = Array.from(new Set(allServices.filter(s => s.type === 'product').map(s => s.category).filter(Boolean)))

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10)
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    setScrolled(window.scrollY > 10)
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname])

  useEffect(() => {
    setMenuOpen(false)
    setProfileOpen(false)
    setNotifOpen(false)
    setMoreOpen(false)
  }, [location])

  useEffect(() => {
    const onDown = (e) => {
      const t = e.target
      if (profileRef.current && !profileRef.current.contains(t)) setProfileOpen(false)
      if (notifRef.current && !notifRef.current.contains(t)) setNotifOpen(false)
      if (moreRef.current && !moreRef.current.contains(t)) setMoreOpen(false)
      if (servicesRef.current && !servicesRef.current.contains(t)) setServicesDropdownOpen(false)
      if (productsRef.current && !productsRef.current.contains(t)) setProductsDropdownOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [])

  useEffect(() => {
    if (!topbarRef.current) return

    const el = topbarRef.current
    const update = () => {
      const next = Math.round(el.getBoundingClientRect().height || 0)
      if (next > 0) setTopbarH(next)
    }

    update()
    const ro = new ResizeObserver(() => update())
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('raxwo-auth')
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header ref={topbarRef} className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-primary/95 backdrop-blur-md shadow-navy border-b border-white/15 py-3' : 'bg-primary/95 backdrop-blur-md border-b border-white/10 py-4 md:py-5'
      }`}>
        <div className="w-full px-4 sm:px-6 lg:px-8 flex items-center relative">
          {/* Logo */}
          <SiteLogo to="/" variant="dark" className="flex-shrink-0 group" />

          {/* Desktop nav — centered */}
          <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-1">
            <a href="https://raxwo.net/" className="px-3 py-2 rounded-lg text-base font-semibold transition-all duration-200 text-white/70 hover:text-white hover:bg-white/10 flex items-center gap-1.5 whitespace-nowrap">
              <FiHome size={14} /> Back
            </a>
            <span className="w-px h-4 bg-white/20 mx-1" />
            <NavLink to="/" end className={({ isActive }) => `px-3 py-2 rounded-lg text-base font-semibold transition-all duration-200 whitespace-nowrap ${isActive ? 'text-white bg-white/15' : 'text-white/75 hover:text-white hover:bg-white/10'}`}>Home</NavLink>
            
            {/* Services dropdown */}
            <div className="group" ref={servicesRef}>
              <button onClick={() => setServicesDropdownOpen(!servicesDropdownOpen)} className={`flex items-center gap-1 px-3 py-2 rounded-lg text-base font-semibold transition-all duration-200 whitespace-nowrap ${servicesDropdownOpen || location.pathname === '/services' ? 'text-white bg-white/15' : 'text-white/75 hover:text-white hover:bg-white/10'}`}>
                Services <FiChevronDown size={14} className={`transition-transform group-hover:rotate-180`} />
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[130]">
                <div className="w-[700px] bg-[#f8f9fa] rounded-none shadow-2xl border-t-2 border-primary overflow-hidden p-6">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Our Services</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {allServices.filter(s => s.type === 'service' || !s.type).slice(0, 4).map(s => (
                      <Link key={s._id} to={`/services`} className="group/item flex flex-col items-center text-center">
                        <div className="w-full h-20 mb-2 overflow-hidden rounded-md bg-white border border-slate-100 flex items-center justify-center">
                          <img src={s.imageUrl ? mediaUrl(s.imageUrl) : "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=200&q=80"} alt={s.title} className="w-full h-full object-cover group-hover/item:scale-105 transition-transform duration-500" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 group-hover/item:text-[#20b2f5] transition-colors">{s.title}</h4>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <NavLink to="/services" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#20b2f5] hover:underline">View all services on this portal →</NavLink>
                  </div>
                </div>
              </div>
            </div>

            {/* Software Products dropdown */}
            <div className="group" ref={productsRef}>
              <button onClick={() => setProductsDropdownOpen(!productsDropdownOpen)} className={`flex items-center gap-1 px-3 py-2 rounded-lg text-base font-semibold transition-all duration-200 whitespace-nowrap ${productsDropdownOpen || location.pathname === '/software-products' ? 'text-white bg-white/15' : 'text-white/75 hover:text-white hover:bg-white/10'}`}>
                Software Products <FiChevronDown size={14} className={`transition-transform group-hover:rotate-180`} />
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[130]">
                <div className="w-[700px] bg-[#f8f9fa] rounded-none shadow-2xl border-t-2 border-primary overflow-hidden p-6">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Software Products</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {allServices.filter(s => s.type === 'product').slice(0, 4).map(s => (
                      <Link key={s._id} to={`/software-products`} className="group/item flex flex-col items-center text-center">
                        <div className="w-full h-20 mb-2 overflow-hidden rounded-md bg-white border border-slate-100 flex items-center justify-center">
                          <img src={s.imageUrl ? mediaUrl(s.imageUrl) : "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=200&q=80"} alt={s.title} className="w-full h-full object-cover group-hover/item:scale-105 transition-transform duration-500" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 group-hover/item:text-[#20b2f5] transition-colors">{s.title}</h4>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <NavLink to="/software-products" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#20b2f5] hover:underline">View all software products →</NavLink>
                  </div>
                </div>
              </div>
            </div>

            <NavLink to="/careers" className={({ isActive }) => `px-3 py-2 rounded-lg text-base font-semibold transition-all duration-200 whitespace-nowrap ${isActive ? 'text-white bg-white/15' : 'text-white/75 hover:text-white hover:bg-white/10'}`}>Careers</NavLink>
            <NavLink to="/our-team" className={({ isActive }) => `px-3 py-2 rounded-lg text-base font-semibold transition-all duration-200 whitespace-nowrap ${isActive ? 'text-white bg-white/15' : 'text-white/75 hover:text-white hover:bg-white/10'}`}>Our Team</NavLink>
            <NavLink to="/contact" className={({ isActive }) => `px-3 py-2 rounded-lg text-base font-semibold transition-all duration-200 whitespace-nowrap ${isActive ? 'text-white bg-white/15' : 'text-white/75 hover:text-white hover:bg-white/10'}`}>Let's Talk</NavLink>
          </nav>

          <div className="hidden md:flex items-center gap-3 flex-shrink-0 ml-auto">
            {isAuthenticated ? (
              <>
                <div ref={notifRef} className="relative">
                  <button
                    onClick={() => setNotifOpen((s) => !s)}
                    className="relative w-10 h-10 rounded-xl bg-white/10 border border-white/15 hover:bg-white/15 flex items-center justify-center transition-colors"
                  >
                    <FiBell size={17} className="text-white" />
                    {unreadCount > 0 ? <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold border-2 border-white shadow-xs leading-none z-10">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
                  </button>
                  <AnimatePresence>
                    {notifOpen ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 top-12 w-80 card z-[120]"
                      >
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                          <h4 className="font-semibold text-primary">Notifications</h4>
                          <NavLink to="/notifications" className="text-xs text-secondary hover:underline">See all</NavLink>
                        </div>
                        <div className="max-h-80 overflow-y-auto custom-scrollbar">
                          {notifications.length === 0 ? <p className="text-sm text-slate-400 p-5 text-center">No notifications yet</p> : notifications.slice(0, 6).map((n) => (
                            <button
                              key={n._id}
                              type="button"
                              onClick={async () => {
                                try { if (!n.read) await api.put(`/system-metrics/notifications/${n._id}/read`) } catch (_) {}
                                setNotifOpen(false)
                                navigate(n.link || `/notifications/${n._id}`)
                              }}
                              className={`w-full text-left p-4 border-b border-slate-100/80 transition-all flex items-start gap-3 relative group ${n.read ? 'bg-white hover:bg-slate-50' : 'bg-[#20b2f5]/5 hover:bg-[#20b2f5]/10'}`}
                            >
                              {!n.read && <div className="absolute top-1/2 -translate-y-1/2 left-0 w-1 h-0 group-hover:h-8 transition-all bg-[#20b2f5] rounded-r-md" />}
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${n.read ? 'bg-slate-100 text-slate-400' : 'bg-[#20b2f5]/20 text-[#20b2f5]'}`}>
                                <FiBell size={16} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold truncate ${n.read ? 'text-slate-600' : 'text-slate-900'}`}>{n.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                                {n.createdAt && <p className="text-[10px] text-slate-400 mt-1.5 font-medium">{new Date(n.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>}
                              </div>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
                <div ref={profileRef} className="relative">
                  <button
                    onClick={() => setProfileOpen((s) => !s)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15 transition-colors"
                  >
                    <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-xs font-semibold overflow-hidden">
                      {user?.avatar ? <img src={mediaUrl(user.avatar)} alt={user?.name} className="w-full h-full object-cover" /> : user?.name?.charAt(0)?.toUpperCase()}
                    </span>
                    <span className="text-sm font-medium">{user?.name?.split(' ')[0]}</span>
                    <FiChevronDown size={14} />
                  </button>
                  <AnimatePresence>
                    {profileOpen ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        className="absolute right-0 top-12 w-52 p-2 z-[120] rounded-2xl border border-slate-200 bg-white shadow-2xl"
                      >
                        <NavLink to="/my-dashboard" className="btn-ghost w-full justify-start text-sm"><FiHome size={14} /> Dashboard</NavLink>
                        <NavLink to="/my-projects" className="btn-ghost w-full justify-start text-sm"><FiFolder size={14} /> My Projects</NavLink>
                        <NavLink to="/our-services" className="btn-ghost w-full justify-start text-sm"><FiLayers size={14} /> Services & Products</NavLink>
                        <NavLink to="/my-subscriptions" className="btn-ghost w-full justify-start text-sm"><FiServer size={14} /> Subscriptions</NavLink>
                        <NavLink to="/payments" className="btn-ghost w-full justify-start text-sm"><FiCreditCard size={14} /> Payments</NavLink>
                        <NavLink to="/booking" className="btn-ghost w-full justify-start text-sm"><FiCalendar size={14} /> Booking</NavLink>
                        <NavLink to="/messages" className="btn-ghost w-full justify-start text-sm"><FiMessageSquare size={14} /> Messages</NavLink>
                        <NavLink to="/meetings" className="btn-ghost w-full justify-start text-sm"><FiVideo size={14} /> Meetings</NavLink>
                        <NavLink to="/rewards" className="btn-ghost w-full justify-start text-sm"><FiGift size={14} /> Rewards</NavLink>
                        <NavLink to="/notifications" className="btn-ghost w-full justify-start text-sm"><FiBell size={14} /> Notifications</NavLink>
                        <div className="my-1 border-t border-slate-100" />
                        <NavLink to="/my-account" className="btn-ghost w-full justify-start text-sm"><FiUsers size={14} /> Settings</NavLink>
                        <button onClick={handleLogout} className="btn-ghost w-full justify-start text-sm text-red-500 hover:text-red-600"><FiLogOut size={14} /> Sign Out</button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </>
            ) : null}
          </div>

          {/* Mobile menu toggle */}
          <button className="md:hidden ml-auto text-white p-2 rounded-lg hover:bg-white/10 transition-colors" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="md:hidden fixed inset-0 z-[100] bg-primary flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <SiteLogo to="/" variant="dark" className="scale-90 origin-left" />
              <button className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-all border border-white/10" onClick={() => setMenuOpen(false)}>
                <FiX size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-6 py-6 pb-24 custom-scrollbar space-y-8">
              
              {/* Main Links */}
              <div className="space-y-2.5">
                <a href="https://raxwo.net/" className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-semibold text-white/80 hover:bg-white/10 hover:text-white transition-all bg-white/5 border border-white/5">
                  <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/60"><FiHome size={18} /></div>
                  Back to raxwo.net
                </a>
                <NavLink to="/" end className={({ isActive }) => `flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-semibold transition-all ${isActive ? 'bg-[#20b2f5]/15 text-[#20b2f5] border border-[#20b2f5]/20' : 'bg-white/5 border border-white/5 text-white/80 hover:bg-white/10 hover:text-white'}`} onClick={() => setMenuOpen(false)}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${location.pathname === '/' ? 'bg-[#20b2f5]/20' : 'bg-white/5 text-white/60'}`}><FiHome size={18} /></div>
                  Home
                </NavLink>
                {/* Services Accordion */}
                <div className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
                  <button onClick={() => setMobileServicesOpen(!mobileServicesOpen)} className="w-full flex items-center justify-between px-4 py-3.5 text-[15px] font-semibold text-white/80 hover:bg-white/5 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${location.pathname.startsWith('/services') ? 'bg-[#20b2f5]/20 text-[#20b2f5]' : 'bg-white/5 text-white/60'}`}><FiLayers size={18} /></div>
                      Services
                    </div>
                    <FiChevronDown size={18} className={`transition-transform duration-300 ${mobileServicesOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {mobileServicesOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-[#20b2f5]/5">
                        <div className="px-4 py-3 flex flex-col gap-2">
                          {allServices.filter(s => s.type === 'service' || !s.type).slice(0, 4).map(s => (
                            <Link key={s._id} to={`/services`} onClick={() => setMenuOpen(false)} className="pl-14 py-2 text-sm font-bold text-white/70 hover:text-[#20b2f5] transition-colors relative">
                              <div className="absolute left-6 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/20" />
                              {s.title}
                            </Link>
                          ))}
                          <NavLink to="/services" onClick={() => setMenuOpen(false)} className="pl-14 py-2 text-sm font-bold text-[#20b2f5] mt-1 hover:underline">
                            → View All Services
                          </NavLink>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Software Products Accordion */}
                <div className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
                  <button onClick={() => setMobileProductsOpen(!mobileProductsOpen)} className="w-full flex items-center justify-between px-4 py-3.5 text-[15px] font-semibold text-white/80 hover:bg-white/5 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${location.pathname.startsWith('/software-products') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/60'}`}><FiPackage size={18} /></div>
                      Software Products
                    </div>
                    <FiChevronDown size={18} className={`transition-transform duration-300 ${mobileProductsOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {mobileProductsOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-emerald-500/5">
                        <div className="px-4 py-3 flex flex-col gap-2">
                          {allServices.filter(s => s.type === 'product').slice(0, 4).map(s => (
                            <Link key={s._id} to={`/software-products`} onClick={() => setMenuOpen(false)} className="pl-14 py-2 text-sm font-bold text-white/70 hover:text-emerald-400 transition-colors relative">
                              <div className="absolute left-6 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/20" />
                              {s.title}
                            </Link>
                          ))}
                          <NavLink to="/software-products" onClick={() => setMenuOpen(false)} className="pl-14 py-2 text-sm font-bold text-emerald-400 mt-1 hover:underline">
                            → View All Products
                          </NavLink>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <NavLink to="/careers" className={({ isActive }) => `flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-semibold transition-all ${isActive ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20' : 'bg-white/5 border border-white/5 text-white/80 hover:bg-white/10 hover:text-white'}`} onClick={() => setMenuOpen(false)}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${location.pathname === '/careers' ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-white/60'}`}><FiBriefcase size={18} /></div>
                  Careers
                </NavLink>
              </div>

              {/* Dashboard / Auth Links */}
              {isAuthenticated ? (
                <div>
                  <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] px-2 mb-4">Portal Access</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <NavLink to="/my-dashboard" onClick={() => setMenuOpen(false)} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white/90 hover:from-white/15 hover:to-white/10 transition-all text-center shadow-lg">
                      <div className="p-3 rounded-2xl bg-[#20b2f5]/20 text-[#20b2f5]"><FiHome size={22} /></div>
                      <span className="text-[12px] font-extrabold tracking-wide">Dashboard</span>
                    </NavLink>
                    <NavLink to="/my-projects" onClick={() => setMenuOpen(false)} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white/90 hover:from-white/15 hover:to-white/10 transition-all text-center shadow-lg">
                      <div className="p-3 rounded-2xl bg-amber-400/20 text-amber-400"><FiFolder size={22} /></div>
                      <span className="text-[12px] font-extrabold tracking-wide">My Projects</span>
                    </NavLink>
                    <NavLink to="/our-services" onClick={() => setMenuOpen(false)} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white/90 hover:from-white/15 hover:to-white/10 transition-all text-center shadow-lg">
                      <div className="p-3 rounded-2xl bg-indigo-400/20 text-indigo-400"><FiLayers size={22} /></div>
                      <span className="text-[12px] font-extrabold tracking-wide">Services</span>
                    </NavLink>
                    <NavLink to="/my-subscriptions" onClick={() => setMenuOpen(false)} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white/90 hover:from-white/15 hover:to-white/10 transition-all text-center shadow-lg">
                      <div className="p-3 rounded-2xl bg-emerald-400/20 text-emerald-400"><FiServer size={22} /></div>
                      <span className="text-[12px] font-extrabold tracking-wide">Subscriptions</span>
                    </NavLink>
                    <NavLink to="/payments" onClick={() => setMenuOpen(false)} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white/90 hover:from-white/15 hover:to-white/10 transition-all text-center shadow-lg">
                      <div className="p-3 rounded-2xl bg-rose-400/20 text-rose-400"><FiCreditCard size={22} /></div>
                      <span className="text-[12px] font-extrabold tracking-wide">Payments</span>
                    </NavLink>
                    <NavLink to="/booking" onClick={() => setMenuOpen(false)} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white/90 hover:from-white/15 hover:to-white/10 transition-all text-center shadow-lg">
                      <div className="p-3 rounded-2xl bg-cyan-400/20 text-cyan-400"><FiCalendar size={22} /></div>
                      <span className="text-[12px] font-extrabold tracking-wide">Booking</span>
                    </NavLink>
                    <NavLink to="/messages" onClick={() => setMenuOpen(false)} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white/90 hover:from-white/15 hover:to-white/10 transition-all text-center shadow-lg">
                      <div className="p-3 rounded-2xl bg-blue-400/20 text-blue-400"><FiMessageSquare size={22} /></div>
                      <span className="text-[12px] font-extrabold tracking-wide">Messages</span>
                    </NavLink>
                    <NavLink to="/meetings" onClick={() => setMenuOpen(false)} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white/90 hover:from-white/15 hover:to-white/10 transition-all text-center shadow-lg">
                      <div className="p-3 rounded-2xl bg-fuchsia-400/20 text-fuchsia-400"><FiVideo size={22} /></div>
                      <span className="text-[12px] font-extrabold tracking-wide">Meetings</span>
                    </NavLink>
                    <NavLink to="/rewards" onClick={() => setMenuOpen(false)} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white/90 hover:from-white/15 hover:to-white/10 transition-all text-center shadow-lg">
                      <div className="p-3 rounded-2xl bg-yellow-400/20 text-yellow-400"><FiGift size={22} /></div>
                      <span className="text-[12px] font-extrabold tracking-wide">Rewards</span>
                    </NavLink>
                    <NavLink to="/notifications" onClick={() => setMenuOpen(false)} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white/90 hover:from-white/15 hover:to-white/10 transition-all text-center shadow-lg relative">
                      {unreadCount > 0 && <span className="absolute top-4 right-4 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0A0F1C] animate-pulse" />}
                      <div className="p-3 rounded-2xl bg-orange-400/20 text-orange-400"><FiBell size={22} /></div>
                      <span className="text-[12px] font-extrabold tracking-wide">Notifications</span>
                    </NavLink>
                  </div>

                  <div className="mt-6 space-y-3">
                    <NavLink to="/my-account" onClick={() => setMenuOpen(false)} className="flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-[15px] font-bold text-white/90 hover:bg-white/10 transition-all">
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-slate-300"><FiUsers size={18} /></div>
                      Account Settings
                    </NavLink>
                    <button onClick={() => { setMenuOpen(false); handleLogout(); }} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-[15px] font-bold text-red-400 hover:bg-red-500/20 transition-all">
                      <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400"><FiLogOut size={18} /></div>
                      Sign Out Completely
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-6 mt-4 border-t border-white/10">
                  <a href="https://raxwo.net/lets-talk/" className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl bg-[#20b2f5] text-white text-[16px] font-bold shadow-[0_0_30px_rgba(32,178,245,0.4)]">
                    Let's Talk <FiMessageSquare size={18} />
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page content */}
      <main className="flex-1 bg-slate-50" style={{ paddingTop: topbarH }}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.12 }}
        >
          <Outlet />
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="bg-black text-white relative overflow-hidden border-t border-white/5">
        {/* Subtle World Map / Abstract Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg')] bg-no-repeat bg-center bg-cover md:bg-[length:80%_auto]"
          style={{ filter: 'invert(1)' }}
        />

        <div className="container-max py-16 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
            
            {/* Column 1: Company Section */}
            <div className="flex flex-col space-y-8">
              <div className="mb-2">
                <SiteLogo to="/" variant="dark" asLink={false} />
              </div>
              
              <div className="space-y-6">
                <div>
                  <h4 className="font-heading font-bold text-[#20b2f5] text-[15px] mb-2">Head Office:</h4>
                  <p className="text-white text-[15px]">Weliweriya, Sri lanka</p>
                </div>
                
                <div>
                  <h4 className="font-heading font-bold text-[#20b2f5] text-[15px] mb-2">Contact:</h4>
                  <p className="text-white text-[15px]">+94 74 357 3333</p>
                </div>

                <div className="flex gap-3 pt-2">
                  {[
                    { Icon: FaFacebookF, link: 'https://web.facebook.com/Raxwo' },
                    { Icon: FaInstagram, link: 'https://www.instagram.com/raxwo/' },
                    { Icon: FaYoutube, link: 'https://www.youtube.com/@RaxwoTechnology' },
                    { Icon: FaLinkedinIn, link: 'https://www.linkedin.com/company/raxwo/' },
                    { Icon: FaTiktok, link: 'https://www.tiktok.com/@raxwotech' }
                  ].map((social, idx) => (
                    <a key={idx} href={social.link} target="_blank" rel="noopener noreferrer"
                      className="w-8 h-8 rounded-full bg-[#20b2f5] hover:bg-white hover:text-[#20b2f5] text-white transition-colors duration-300 flex items-center justify-center text-sm shadow-lg">
                      <social.Icon />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Column 2: Quick Links */}
            <div>
              <h4 className="font-heading font-bold text-[#20b2f5] text-lg mb-6">Quick links</h4>
              <ul className="space-y-4">
                {[
                  { name: 'Home', path: '/' },
                  { name: 'Who We Are', path: '/about' },
                  { name: 'Let\'s Talk', path: '/contact' },
                  { name: 'FAQ\'s', path: 'https://raxwo.net/faqs/' },
                  { name: 'Careers', path: '/careers' }
                ].map((link, idx) => (
                  <li key={idx}>
                    {link.path.startsWith('http') ? (
                      <a href={link.path} target="_blank" rel="noopener noreferrer" className="text-white font-bold text-[15px] hover:text-[#20b2f5] transition-colors duration-200">
                        {link.name}
                      </a>
                    ) : (
                      <NavLink to={link.path} className="text-white font-bold text-[15px] hover:text-[#20b2f5] transition-colors duration-200">
                        {link.name}
                      </NavLink>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Services */}
            <div>
              <h4 className="font-heading font-bold text-[#20b2f5] text-lg mb-6">Services</h4>
              <ul className="space-y-4">
                {[
                  { name: 'All Services', path: 'https://raxwo.net/services/' },
                  { name: 'Development Hub', path: 'https://raxwo.net/development-hub/' },
                  { name: 'Creative & Design Studio', path: 'https://raxwo.net/creative-design-studio/' },
                  { name: 'Marketing Lab', path: 'https://raxwo.net/marketing-lab/' },
                  { name: 'Services & Products', path: 'https://raxwo.net/services-products/' }
                ].map((link, idx) => (
                  <li key={idx}>
                    <a href={link.path} className="text-white font-bold text-[15px] hover:text-[#20b2f5] transition-colors duration-200">
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 4: Products */}
            <div>
              <h4 className="font-heading font-bold text-[#20b2f5] text-lg mb-6">Products</h4>
              <ul className="space-y-4">
                {[
                  { name: 'Software Products', path: 'https://raxwo.net/software-products/' },
                  { name: 'Mobile Shop ERP 📱', path: 'https://raxwo.net/mobile-shop-erp/' },
                  { name: 'Salon Management ERP 💇', path: 'https://raxwo.net/salon-management-erp/' },
                  { name: 'Restaurant & Hotel ERP 🍽️', path: 'https://raxwo.net/restaurant-hotel-erp/' },
                  { name: 'Hardware & Distribution ERP 🏗️', path: 'https://raxwo.net/hardware-distribution-erp/' }
                ].map((link, idx) => (
                  <li key={idx}>
                    <a href={link.path} className="text-white font-bold text-[15px] hover:text-[#20b2f5] transition-colors duration-200">
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Bottom Bar */}
          <div className="border-t-[1px] border-dotted border-white/20 mt-16 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-white text-sm font-bold tracking-wide">
              ©{new Date().getFullYear()} - Raxwo (Pvt) ltd. | All Rights Reserved
            </p>
            <div className="flex items-center gap-4 text-sm font-bold tracking-wide">
              <a href="https://raxwo.net/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#20b2f5] transition-colors">Privacy Policy</a>
              <span className="text-white/30">|</span>
              <a href="https://raxwo.net/terms-conditions-tc/" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#20b2f5] transition-colors">Terms & Conditions</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
