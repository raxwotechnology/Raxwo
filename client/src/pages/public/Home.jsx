import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  FiArrowRight, FiCode, FiSmartphone, FiCloud, FiShield,
  FiTrendingUp, FiUsers, FiStar, FiMessageSquare,
  FiMenu, FiX, FiHome, FiLayers, FiPackage, FiBriefcase, FiCheck,
  FiFolder, FiCalendar, FiCreditCard, FiServer, FiGift, FiVideo, FiBell, FiLogOut, FiChevronDown
} from 'react-icons/fi'
import {
  SiReact, SiNodedotjs, SiMongodb, SiNextdotjs, SiDocker,
  SiPostgresql, SiTypescript, SiFirebase, SiGraphql, SiKubernetes,
  SiTailwindcss, SiRedux, SiExpress, SiWordpress,
  SiFigma, SiCanva
} from 'react-icons/si'
import TiltCard from '../../components/ui/TiltCard'
import HomeSignInForm from '../../components/ui/HomeSignInForm'
import SiteLogo from '../../components/branding/SiteLogo'
import useAuthStore from '../../store/authStore'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { mediaUrl } from '../../lib/media'

const ICON_MAP = { FiCode, FiSmartphone, FiCloud, FiShield, FiTrendingUp, FiUsers, FiLayers, FiPackage }

const TECH_STACK = [
  { name: 'React.js',     Icon: SiReact,       color: '#61dafb' },
  { name: 'Node.js',      Icon: SiNodedotjs,   color: '#68a063' },
  { name: 'MongoDB',      Icon: SiMongodb,     color: '#47a248' },
  { name: 'Next.js',      Icon: SiNextdotjs,   color: '#6366f1' },
  { name: 'AWS',          Icon: FiCloud,        color: '#ff9900' },
  { name: 'Docker',       Icon: SiDocker,      color: '#2496ed' },
  { name: 'PostgreSQL',   Icon: SiPostgresql,  color: '#336791' },
  { name: 'TypeScript',   Icon: SiTypescript,  color: '#3178c6' },
  { name: 'Tailwind CSS', Icon: SiTailwindcss, color: '#38bdf8' },
  { name: 'Redux',        Icon: SiRedux,       color: '#764abc' },
  { name: 'Firebase',     Icon: SiFirebase,    color: '#ff8f00' },
  { name: 'GraphQL',      Icon: SiGraphql,     color: '#e10098' },
  { name: 'Kubernetes',   Icon: SiKubernetes,  color: '#326ce5' },
  { name: 'Express.js',   Icon: SiExpress,     color: '#404040' },
  { name: 'WordPress',    Icon: SiWordpress,   color: '#21759b' },
  { name: 'Figma',        Icon: SiFigma,       color: '#f24e1e' },
  { name: 'Canva',        Icon: SiCanva,       color: '#00c4cc' },
  { name: 'CapCut',       Icon: FiSmartphone,   color: '#1a1a1a' },
  { name: 'Draw.io',      Icon: FiLayers,       color: '#f08705' },
  { name: 'React Native', Icon: SiReact,       color: '#20b2f5' },
]



const SERVICES = [
  { icon: FiCode,        title: 'Web Development',       desc: 'Scalable, modern web applications built with React, Node.js, and cloud infrastructure.', color: 'bg-blue-50 text-blue-600' },
  { icon: FiSmartphone,  title: 'Mobile Apps',           desc: 'Cross-platform iOS & Android apps using React Native that deliver native performance and beautiful UX.', color: 'bg-green-50 text-green-600' },
  { icon: FiCloud,       title: 'Cloud & DevOps',        desc: 'AWS/Azure cloud setup, CI/CD pipelines, Docker orchestration, and 24/7 infrastructure monitoring.', color: 'bg-purple-50 text-purple-600' },
  { icon: FiShield,      title: 'Cybersecurity',         desc: 'Penetration testing, security audits, compliance consulting, and secure software development practices.', color: 'bg-red-50 text-red-600' },
  { icon: FiTrendingUp,  title: 'Digital Transformation', desc: 'End-to-end digital transformation strategy, legacy modernisation, and enterprise system integration.', color: 'bg-orange-50 text-orange-600' },
  { icon: FiUsers,       title: 'IT Consulting',         desc: 'Strategic technology consulting, architecture reviews, and dedicated development team augmentation.', color: 'bg-indigo-50 text-indigo-600' },
]



const STATS = [
  { value: 150, suffix: '+', label: 'Projects Delivered' },
  { value: 250, suffix: '+', label: 'Happy Clients' },
  { value: 35,  suffix: '+', label: 'Team Members' },
  { value: 7,   suffix: '+', label: 'Years in Business' },
]

function Counter({ target, suffix }) {
  const [count, setCount] = useState(0)
  const ref  = useRef(null)
  const inView = useInView(ref, { once: true })
  useEffect(() => {
    if (!inView) return
    let start = 0
    const step = Math.ceil(target / 60)
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setCount(target); clearInterval(timer) }
      else setCount(start)
    }, 25)
    return () => clearInterval(timer)
  }, [inView, target])
  return <span ref={ref}>{count}<span className="text-red-500">{suffix}</span></span>
}

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }

/* ── Embedded Home Navbar ─────────────────────────────────────── */
function HomeNav() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false)
  const [productsDropdownOpen, setProductsDropdownOpen] = useState(false)
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false)
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false)
  const servicesRef = useRef(null)
  const productsRef = useRef(null)
  const { user, isAuthenticated, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const isClient = isAuthenticated && user?.role === 'client'

  const { data: servicesData } = useQuery({
    queryKey: ['public-services'],
    queryFn: () => api.get('/content/services').then(r => r.data),
  })
  const allServices = servicesData?.services || []

  useEffect(() => {
    const onDown = (e) => {
      const t = e.target
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

  const handleLogout = () => {
    localStorage.removeItem('raxwo-auth')
    window.location.href = '/'
  }

  return (
    <nav className="absolute top-0 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
      {/* Logo */}
      <SiteLogo to="/" variant="dark" className="flex-shrink-0 mt-4 md:mt-6" />

      {/* Desktop links */}
      <div className="hidden md:flex items-center gap-2">
        <a
          href="https://raxwo.net/"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-base font-semibold text-white/80 hover:text-[#20b2f5] hover:bg-white/10 transition-all"
        >
          <FiHome size={16} /> raxwo.net
        </a>
        
        {/* Services dropdown */}
        <div className="group" ref={servicesRef}>
          <button onClick={() => setServicesDropdownOpen(!servicesDropdownOpen)} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-base font-semibold transition-all whitespace-nowrap ${servicesDropdownOpen ? 'text-white bg-white/15' : 'text-white/80 hover:text-[#20b2f5] hover:bg-white/10'}`}>
            <FiLayers size={16} /> Services <FiChevronDown size={14} className={`transition-transform group-hover:rotate-180`} />
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
                <Link to="/services" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#20b2f5] hover:underline">View all services on this portal →</Link>
              </div>
            </div>
          </div>
        </div>

        {/* Software Products dropdown */}
        <div className="group" ref={productsRef}>
          <button onClick={() => setProductsDropdownOpen(!productsDropdownOpen)} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-base font-semibold transition-all whitespace-nowrap ${productsDropdownOpen ? 'text-white bg-white/15' : 'text-white/80 hover:text-[#20b2f5] hover:bg-white/10'}`}>
            <FiPackage size={16} /> Software Products <FiChevronDown size={14} className={`transition-transform group-hover:rotate-180`} />
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
                <Link to="/software-products" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#20b2f5] hover:underline">View all software products →</Link>
              </div>
            </div>
          </div>
        </div>

        <a
          href="https://raxwo.net/lets-talk/"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-base font-semibold text-white/80 hover:text-[#20b2f5] hover:bg-white/10 transition-all"
        >
          <FiMessageSquare size={16} /> Let's Talk
        </a>
        <Link
          to="/careers"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-base font-semibold text-white/80 hover:text-[#20b2f5] hover:bg-white/10 transition-all"
        >
          <FiBriefcase size={16} /> Careers
        </Link>

        {isAuthenticated && (
          <>
            <Link to={user?.role === 'admin' ? '/admin' : '/my-dashboard'} className="px-4 py-2 rounded-xl text-sm font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-all">Portal</Link>
            <button onClick={handleLogout} className="px-4 py-2 rounded-xl text-sm font-semibold text-red-300 hover:text-red-200 hover:bg-red-500/10 transition-all">Sign Out</button>
          </>
        )}
      </div>

      {/* Mobile toggle */}
      <button
        className="md:hidden p-2 rounded-xl text-white hover:bg-white/10 transition-all"
        onClick={() => setMobileOpen(v => !v)}
      >
        {mobileOpen ? <FiX size={22} /> : <FiMenu size={22} />}
      </button>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="md:hidden fixed inset-0 z-[100] bg-[#0A0F1C]/98 backdrop-blur-xl flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <SiteLogo to="/" variant="dark" className="scale-90 origin-left" />
              <button className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-all border border-white/10" onClick={() => setMobileOpen(false)}>
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
                            <Link key={s._id} to={`/services`} onClick={() => setMobileOpen(false)} className="pl-14 py-2 text-sm font-bold text-white/70 hover:text-[#20b2f5] transition-colors relative">
                              <div className="absolute left-6 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/20" />
                              {s.title}
                            </Link>
                          ))}
                          <Link to="/services" onClick={() => setMobileOpen(false)} className="pl-14 py-2 text-sm font-bold text-[#20b2f5] mt-1 hover:underline">
                            → View All Services
                          </Link>
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
                            <Link key={s._id} to={`/software-products`} onClick={() => setMobileOpen(false)} className="pl-14 py-2 text-sm font-bold text-white/70 hover:text-emerald-400 transition-colors relative">
                              <div className="absolute left-6 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/20" />
                              {s.title}
                            </Link>
                          ))}
                          <Link to="/software-products" onClick={() => setMobileOpen(false)} className="pl-14 py-2 text-sm font-bold text-emerald-400 mt-1 hover:underline">
                            → View All Products
                          </Link>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <Link to="/careers" className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-semibold text-white/80 hover:bg-white/10 hover:text-white transition-all bg-white/5 border border-white/5" onClick={() => setMobileOpen(false)}>
                  <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/60"><FiBriefcase size={18} /></div>
                  Careers
                </Link>
              </div>

              {/* Dashboard / Auth Links */}
              {isAuthenticated ? (
                <div>
                  <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] px-2 mb-4">Portal Access</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Link to="/my-dashboard" onClick={() => setMobileOpen(false)} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white/90 hover:from-white/15 hover:to-white/10 transition-all text-center shadow-lg">
                      <div className="p-3 rounded-2xl bg-[#20b2f5]/20 text-[#20b2f5]"><FiHome size={22} /></div>
                      <span className="text-[12px] font-extrabold tracking-wide">Dashboard</span>
                    </Link>
                    <Link to="/my-projects" onClick={() => setMobileOpen(false)} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white/90 hover:from-white/15 hover:to-white/10 transition-all text-center shadow-lg">
                      <div className="p-3 rounded-2xl bg-amber-400/20 text-amber-400"><FiFolder size={22} /></div>
                      <span className="text-[12px] font-extrabold tracking-wide">My Projects</span>
                    </Link>
                    <Link to="/our-services" onClick={() => setMobileOpen(false)} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white/90 hover:from-white/15 hover:to-white/10 transition-all text-center shadow-lg">
                      <div className="p-3 rounded-2xl bg-indigo-400/20 text-indigo-400"><FiLayers size={22} /></div>
                      <span className="text-[12px] font-extrabold tracking-wide">Services</span>
                    </Link>
                    <Link to="/my-subscriptions" onClick={() => setMobileOpen(false)} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white/90 hover:from-white/15 hover:to-white/10 transition-all text-center shadow-lg">
                      <div className="p-3 rounded-2xl bg-emerald-400/20 text-emerald-400"><FiServer size={22} /></div>
                      <span className="text-[12px] font-extrabold tracking-wide">Subscriptions</span>
                    </Link>
                    <Link to="/payments" onClick={() => setMobileOpen(false)} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white/90 hover:from-white/15 hover:to-white/10 transition-all text-center shadow-lg">
                      <div className="p-3 rounded-2xl bg-rose-400/20 text-rose-400"><FiCreditCard size={22} /></div>
                      <span className="text-[12px] font-extrabold tracking-wide">Payments</span>
                    </Link>
                    <Link to="/booking" onClick={() => setMobileOpen(false)} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white/90 hover:from-white/15 hover:to-white/10 transition-all text-center shadow-lg">
                      <div className="p-3 rounded-2xl bg-cyan-400/20 text-cyan-400"><FiCalendar size={22} /></div>
                      <span className="text-[12px] font-extrabold tracking-wide">Booking</span>
                    </Link>
                    <Link to="/messages" onClick={() => setMobileOpen(false)} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white/90 hover:from-white/15 hover:to-white/10 transition-all text-center shadow-lg">
                      <div className="p-3 rounded-2xl bg-blue-400/20 text-blue-400"><FiMessageSquare size={22} /></div>
                      <span className="text-[12px] font-extrabold tracking-wide">Messages</span>
                    </Link>
                    <Link to="/meetings" onClick={() => setMobileOpen(false)} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white/90 hover:from-white/15 hover:to-white/10 transition-all text-center shadow-lg">
                      <div className="p-3 rounded-2xl bg-fuchsia-400/20 text-fuchsia-400"><FiVideo size={22} /></div>
                      <span className="text-[12px] font-extrabold tracking-wide">Meetings</span>
                    </Link>
                    <Link to="/rewards" onClick={() => setMobileOpen(false)} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white/90 hover:from-white/15 hover:to-white/10 transition-all text-center shadow-lg">
                      <div className="p-3 rounded-2xl bg-yellow-400/20 text-yellow-400"><FiGift size={22} /></div>
                      <span className="text-[12px] font-extrabold tracking-wide">Rewards</span>
                    </Link>
                    <Link to="/notifications" onClick={() => setMobileOpen(false)} className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-white/90 hover:from-white/15 hover:to-white/10 transition-all text-center shadow-lg relative">
                      <div className="p-3 rounded-2xl bg-orange-400/20 text-orange-400"><FiBell size={22} /></div>
                      <span className="text-[12px] font-extrabold tracking-wide">Notifications</span>
                    </Link>
                  </div>

                  <div className="mt-6 space-y-3">
                    <Link to="/my-account" onClick={() => setMobileOpen(false)} className="flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-[15px] font-bold text-white/90 hover:bg-white/10 transition-all">
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-slate-300"><FiUsers size={18} /></div>
                      Account Settings
                    </Link>
                    <button onClick={() => { setMobileOpen(false); handleLogout(); }} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-[15px] font-bold text-red-400 hover:bg-red-500/20 transition-all">
                      <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400"><FiLogOut size={18} /></div>
                      Sign Out Completely
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-6 mt-4 border-t border-white/10">
                  <Link to="/contact" onClick={() => setMobileOpen(false)} className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl bg-[#20b2f5] text-white text-[16px] font-bold shadow-[0_0_30px_rgba(32,178,245,0.4)]">
                    Let's Talk <FiMessageSquare size={18} />
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}

/* ── Home Page ────────────────────────────────────────────────── */
export default function Home() {
  const HOME_SERVICES = [
    { _id:'s1', icon:'FiCode',        title:'Web Development',        color:'bg-blue-50 text-blue-600',   desc:'Scalable, modern web applications built with React, Node.js, and cloud infrastructure.' },
    { _id:'s2', icon:'FiSmartphone',  title:'Mobile Apps',            color:'bg-green-50 text-green-600', desc:'Cross-platform iOS & Android apps using React Native that deliver native performance and beautiful UX.' },
    { _id:'s3', icon:'FiCloud',       title:'Cloud & DevOps',         color:'bg-purple-50 text-purple-600',desc:'AWS/Azure cloud setup, CI/CD pipelines, Docker orchestration, and 24/7 infrastructure monitoring.' },
    { _id:'s4', icon:'FiShield',      title:'Cybersecurity',          color:'bg-red-50 text-red-600',     desc:'Penetration testing, security audits, compliance consulting, and secure software development practices.' },
    { _id:'s5', icon:'FiTrendingUp',  title:'Digital Transformation', color:'bg-orange-50 text-orange-600',desc:'End-to-end digital transformation strategy, legacy modernisation, and enterprise system integration.' },
    { _id:'s6', icon:'FiUsers',       title:'IT Consulting',          color:'bg-indigo-50 text-indigo-600',desc:'Strategic technology consulting, architecture reviews, and dedicated development team augmentation.' },
  ]
  const displayServices = HOME_SERVICES;

  const HOME_PRODUCTS = [
    { _id:'p1', title:'Mobile Shop ERP 📱', desc:'Complete ERP system for mobile phone shops — inventory, sales, repairs, and billing.', img: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&q=80' },
    { _id:'p2', title:'Salon Management ERP 💇', desc:'Full-featured salon management system with appointments, staff, and billing.', img: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80' },
    { _id:'p3', title:'Restaurant & Hotel ERP 🍽️', desc:'Restaurant and hotel management with table orders, kitchen display, and billing.', img: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80' },
    { _id:'p4', title:'Hardware & Distribution ERP 🏗️', desc:'Hardware store management with stock control, orders, and supplier management.', img: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&q=80' },
  ]
  const displayProducts = HOME_PRODUCTS;

  return (
    <div className="overflow-x-hidden">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative min-h-screen bg-gradient-hero flex items-center overflow-hidden">
        {/* Subtle static bg blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
        </div>

        {/* Embedded nav */}
        <HomeNav />

        <div className="container-max relative z-10 pt-28 pb-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left — headline */}
            <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.15 } } }}>
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white/80 text-sm mb-6">
                <span className="w-2 h-2 bg-[#20b2f5] rounded-full animate-pulse" />
                <span className="text-[#20b2f5] font-semibold">Based in Sri Lanka</span> — Serving Globally
              </motion.div>

              <motion.h1 variants={fadeUp} className="text-4xl lg:text-5xl font-bold text-white font-heading leading-tight mb-6">
                <span className="text-[#20b2f5]">Innovative</span><br />
                Software Solutions<br />
                in Sri Lanka
              </motion.h1>

              <motion.p variants={fadeUp} className="text-white/70 text-lg md:text-xl leading-relaxed mb-10 max-w-xl font-normal">
                We build powerful, scalable web & mobile applications that transform businesses. From startups to enterprise — we deliver results that matter.
              </motion.p>

              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row flex-wrap gap-4">
                <Link to="/booking" className="btn-primary btn-lg !rounded-xl w-full sm:w-auto justify-center">
                  Book a Service <FiArrowRight />
                </Link>
                <Link to="/booking" className="btn-secondary btn-lg bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 hover:border-emerald-600 !rounded-xl flex items-center justify-center gap-2 w-full sm:w-auto transition-all">
                  Get a Free Quote
                </Link>
                <Link to="/services" className="btn-outline btn-lg border-white/30 text-white hover:bg-white/10 hover:text-white !rounded-xl flex items-center justify-center w-full sm:w-auto">
                  View Our Services
                </Link>
              </motion.div>

            </motion.div>

            {/* Right — sign-in form */}
            <HomeSignInForm />
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 80L1440 80L1440 20C1200 80 960 0 720 40C480 80 240 0 0 20L0 80Z" fill="#F8FAFC" />
          </svg>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-16">
        <div className="container-max">
          <div className="grid grid-cols-2 gap-y-10 gap-x-4 md:grid-cols-4 md:gap-6">
            {STATS.map(s => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <p className="text-3xl md:text-4xl font-bold text-[#20b2f5] font-heading mb-1">
                  <Counter target={s.value} suffix={s.suffix} />
                </p>
                <p className="text-gray-500 mt-1 text-[11px] sm:text-xs font-semibold uppercase tracking-wider">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech Stack ────────────────────────────────────────── */}
      <section className="bg-white border-y border-slate-100 py-8">
        <p className="text-center text-xs font-semibold text-slate-400 uppercase tracking-widest mb-6">
          Built With Modern, Battle-Tested Technologies & Tools
        </p>
        <div className="flex flex-wrap justify-center gap-3 px-6">
          {TECH_STACK.map((tech, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.03 }}
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <tech.Icon size={16} style={{ color: tech.color }} />
              {tech.name}
            </motion.span>
          ))}
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="container-max">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-14">
            <span className="badge badge-blue mb-4">Our Services</span>
            <h2 className="text-4xl font-bold text-primary font-heading mb-4">What We Build</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">End-to-end software solutions tailored for Sri Lankan businesses and global clients.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 md:gap-12 lg:gap-14">
            {displayServices.map((s, i) => {
              const IconComp = ICON_MAP[s.icon] || FiCode
              return (
                <motion.div key={s._id || s.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="group cursor-pointer h-full">
                  <TiltCard className="h-full">
                    <div className="p-8 sm:p-10 h-full flex flex-col items-start bg-white/60">
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${s.color || 'bg-blue-50 text-blue-600'} flex items-center justify-center mb-5 sm:mb-6 shadow-sm`}>
                        {s.imageUrl
                          ? <img src={s.imageUrl} alt={s.title} className="w-8 h-8 object-contain" />
                          : <IconComp size={26} />}
                      </div>
                      <h3 className="font-bold text-xl text-primary font-heading mb-3">{s.title}</h3>
                      <p className="text-slate-600 text-sm leading-relaxed mb-6 flex-1">{s.desc || s.description}</p>
                      <Link to="/services" className="mt-auto text-secondary font-medium text-sm flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                        Learn more <FiArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </TiltCard>
                </motion.div>
              )
            })}
          </div>

          <div className="text-center mt-10">
            <Link to="/services" className="btn-outline">View All Services <FiArrowRight /></Link>
          </div>
        </div>
      </section>

      {/* ── Software Products Preview ───────────────────────── */}
      <section className="section-padding bg-gray-50">
        <div className="container-max">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-14">
            <span className="badge badge-green mb-4">Software Products</span>
            <h2 className="text-4xl font-bold text-primary font-heading mb-4">Ready-Made Business Systems</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">Our off-the-shelf ERP and management systems — customizable for your business needs.</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-12 lg:gap-14">
            {displayProducts.map((s, i) => {
              return (
                <motion.div key={s._id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="group cursor-pointer h-full">
                  <TiltCard className="h-full">
                    <div className="p-0 h-full flex flex-col bg-white overflow-hidden rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgb(0,0,0,0.12)] transition-all duration-500">
                      <div className="w-full h-48 overflow-hidden relative">
                        <img src={s.img} alt={s.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
                      </div>
                      <div className="p-8 flex flex-col flex-1">
                        <h3 className="font-bold text-lg text-primary font-heading mb-2">{s.title}</h3>
                        <p className="text-slate-600 text-sm leading-relaxed mb-6 flex-1">{s.desc}</p>
                        <Link to="/software-products" className="mt-auto text-secondary font-medium text-sm flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                          See details <FiArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </div>
                    </div>
                  </TiltCard>
                </motion.div>
              )
            })}
          </div>
          <div className="text-center mt-10">
            <Link to="/software-products" className="btn-outline">View All Products <FiArrowRight /></Link>
          </div>
        </div>
      </section>

      {/* ── Start Your Business CTA ──────────────────────────────────────── */}
      <section className="bg-slate-50 section-padding pb-24">
        <div className="container-max">
          <div className="bg-[#0C0227] rounded-3xl relative overflow-hidden py-24 px-8 shadow-2xl border border-slate-800">
            <div className="relative z-10 text-center max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', stiffness: 100 }}
              >
                <h2 className="text-3xl lg:text-4xl font-bold text-white font-heading mb-3 leading-tight">
                  Start your business with <br />
                  <span className="text-[#20b2f5] mt-2 block">Raxwo</span>
                </h2>
                <p className="text-white/80 max-w-2xl mx-auto text-base md:text-lg leading-relaxed mt-4 font-normal">
                  Raxwo Pvt Ltd delivers custom software, web development, and marketing solutions tailored to help businesses grow locally and globally.
                </p>
                <div className="mt-10">
                  <a href="https://raxwo.net/lets-talk/" className="btn-secondary btn-lg bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 hover:border-emerald-600 inline-flex items-center gap-2 px-8">
                    Let's Talk <FiArrowRight />
                  </a>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
