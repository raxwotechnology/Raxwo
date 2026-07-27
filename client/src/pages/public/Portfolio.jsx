import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FiExternalLink, FiArrowRight, FiFilter, FiSearch, FiGrid, FiList } from 'react-icons/fi'
import api from '../../lib/api'
import { mediaUrl } from '../../lib/media'
import TiltCard from '../../components/ui/TiltCard'

const STATIC_PROJECTS = [
  { title: 'TechCorp ERP System', category: 'Enterprise', tech: ['React', 'Node.js', 'MongoDB'], desc: 'Full ERP system with HR, payroll, inventory, and client management for a Colombo-based tech firm.', color: 'from-blue-500 to-blue-700', result: '40% ops efficiency gain' },
  { title: 'FashionHub E-Commerce', category: 'E-Commerce', tech: ['Next.js', 'Stripe', 'PostgreSQL'], desc: 'Multi-vendor e-commerce platform with vendor dashboards, inventory tracking, and payment processing.', color: 'from-purple-500 to-purple-700', result: '3x revenue increase' },
  { title: 'HealthCare Patient Portal', category: 'Healthcare', tech: ['React Native', 'Node.js', 'MySQL'], desc: 'Patient management system with appointment scheduling, medical records, and billing integration.', color: 'from-green-500 to-green-700', result: '60% admin time saved' },
  { title: 'LogiTrack Delivery App', category: 'Logistics', tech: ['React Native', 'Google Maps', 'Socket.io'], desc: 'Real-time delivery tracking app for a logistics company with driver and customer portals.', color: 'from-orange-500 to-orange-700', result: '25% delivery efficiency' },
  { title: 'SchoolMS Learning Platform', category: 'Education', tech: ['React', 'Express', 'MongoDB'], desc: 'Comprehensive school management system with student, teacher, and parent portals.', color: 'from-red-500 to-red-700', result: '5,000+ daily users' },
  { title: 'FinPro Accounting Suite', category: 'Finance', tech: ['Vue.js', 'Node.js', 'PostgreSQL'], desc: 'Cloud-based accounting software with GST/VAT, invoicing, and financial reporting.', color: 'from-teal-500 to-teal-700', result: '200+ businesses using' },
]

const CATEGORY_COLORS = {
  Enterprise: 'bg-blue-100 text-blue-700 border-blue-200',
  'E-Commerce': 'bg-purple-100 text-purple-700 border-purple-200',
  Healthcare: 'bg-green-100 text-green-700 border-green-200',
  Logistics: 'bg-orange-100 text-orange-700 border-orange-200',
  Education: 'bg-red-100 text-red-700 border-red-200',
  Finance: 'bg-teal-100 text-teal-700 border-teal-200',
}

export default function Portfolio() {
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('grid')

  const { data } = useQuery({
    queryKey: ['public-portfolio'],
    queryFn: () => api.get('/content/portfolio').then(r => r.data),
  })

  const dynamicProjects = data?.items || []
  const allProjects = dynamicProjects.map(p => ({
      title: p.title, category: p.category,
      tech: p.technologies || [],
      desc: p.description,
      result: p.result || 'Delivered',
      color: '',
      gradientStyle: { backgroundImage: `linear-gradient(135deg, ${p.colorFrom || '#3b82f6'}, ${p.colorTo || '#1d4ed8'})` },
      caseStudyUrl: p.caseStudyUrl || '',
      imageUrl: p.imageUrl ? mediaUrl(p.imageUrl) : '',
    }))

  const categories = useMemo(() => ['all', ...new Set(allProjects.map(p => p.category))], [allProjects])

  const filtered = allProjects.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || p.title.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q) || p.tech.some(t => t.toLowerCase().includes(q))
    const matchCat = category === 'all' || p.category === category
    return matchSearch && matchCat
  })

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-hero section-padding pt-32 text-center relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-10 right-10 w-64 h-64 bg-secondary/15 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-10 w-48 h-48 bg-blue-400/10 rounded-full blur-3xl" />
        </div>
        <div className="container-max relative">
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95, filter: 'blur(10px)' }} 
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }} 
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            className="flex flex-col items-center"
          >
            <motion.span 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
              className="badge bg-white/10 text-white border border-white/20 mb-6 shadow-xl px-4 py-2"
            >
              Our Work
            </motion.span>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-3xl lg:text-5xl font-bold text-white font-heading mb-6 tracking-tight drop-shadow-2xl"
            >
              Portfolio & Case Studies
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-white/80 max-w-2xl mx-auto text-xl md:text-2xl leading-relaxed font-normal"
            >
              Real projects, real results — see how we've transformed businesses across Sri Lanka and beyond.
            </motion.p>
          </motion.div>

          {/* Stats bar */}
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.9 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            transition={{ delay: 0.7, type: 'spring' }}
            className="flex flex-wrap justify-center gap-8 mt-12 bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-2xl max-w-4xl mx-auto"
          >
            {[['250+', 'Happy Clients'], ['150+', 'Projects Delivered'], ['35+', 'Team Members'], ['7+', 'Years in Business']].map(([n, l], i) => (
              <motion.div 
                key={l} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + (i * 0.1) }}
                className="text-center flex-1 min-w-[140px]"
              >
                <p className="text-4xl font-black text-[#20b2f5] mb-2">{n}</p>
                <p className="text-white/80 text-sm font-medium">{l}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Filter + Grid */}
      <section className="section-padding bg-gray-50">
        <div className="container-max">
          {/* Search + Filter toolbar */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <FiSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by project, tech stack..."
                className="form-input !pl-10 w-full bg-white" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {categories.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all capitalize ${
                    c === category ? 'bg-secondary text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:border-secondary/40'
                  }`}>
                  {c === 'all' ? `All (${allProjects.length})` : c}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-slate-200 p-1 rounded-xl shrink-0">
              {[['grid', FiGrid], ['list', FiList]].map(([v, Icon]) => (
                <button key={v} onClick={() => setView(v)}
                  className={`p-2 rounded-lg transition-all ${view === v ? 'bg-white shadow text-secondary' : 'text-slate-500'}`}>
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          <p className="text-sm text-slate-500 mb-4">{filtered.length} project{filtered.length !== 1 ? 's' : ''} shown</p>

          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-slate-400 font-medium">No projects match your search.</p>
              <button onClick={() => { setSearch(''); setCategory('all') }} className="btn-ghost mt-3 text-sm">Clear filters</button>
            </div>
          ) : view === 'grid' ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="wait">
                {filtered.map((p, i) => (
                  <motion.div key={p.title}
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: i * 0.1, type: 'spring', stiffness: 100 }}
                    className="h-full">
                    <TiltCard className="h-full">
                      <div className="card card-hover overflow-hidden group h-full bg-white/90">
                        {/* Header */}
                        <div className={`h-44 ${p.gradientStyle ? '' : `bg-gradient-to-br ${p.color}`} relative flex items-end p-5 overflow-hidden`}
                          style={p.gradientStyle || undefined}>
                          {p.imageUrl && (
                            <img src={p.imageUrl} alt={p.title}
                              className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity group-hover:scale-105 duration-700" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                          <span className={`badge text-xs border relative z-10 ${CATEGORY_COLORS[p.category] || 'bg-white/20 text-white border-white/30'}`} style={{ transform: 'translateZ(30px)' }}>
                            {p.category}
                          </span>
                        </div>

                        <div className="card-body">
                          <h3 className="text-lg font-bold text-primary font-heading mb-2" style={{ transform: 'translateZ(40px)' }}>{p.title}</h3>
                          <p className="text-gray-500 text-sm leading-relaxed mb-4 line-clamp-2" style={{ transform: 'translateZ(20px)' }}>{p.desc}</p>
                          <div className="flex flex-wrap gap-1.5 mb-4" style={{ transform: 'translateZ(25px)' }}>
                            {p.tech.slice(0, 4).map(t => <span key={t} className="badge badge-blue text-xs">{t}</span>)}
                            {p.tech.length > 4 && <span className="badge badge-gray text-xs">+{p.tech.length - 4}</span>}
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t border-gray-100" style={{ transform: 'translateZ(10px)' }}>
                            <span className="text-accent font-semibold text-sm">✓ {p.result}</span>
                            {p.caseStudyUrl
                              ? <a href={p.caseStudyUrl} target="_blank" rel="noreferrer" className="text-secondary text-sm flex items-center gap-1 hover:gap-2 transition-all">
                                  Case study <FiExternalLink size={13} />
                                </a>
                              : <span className="text-secondary text-sm flex items-center gap-1 hover:gap-2 transition-all cursor-pointer">
                                  View more <FiExternalLink size={13} />
                                </span>}
                          </div>
                        </div>
                      </div>
                    </TiltCard>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            /* List view */
            <div className="space-y-4">
              {filtered.map((p, i) => (
                <motion.div 
                  key={p.title} 
                  initial={{ opacity: 0, x: -30 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  transition={{ delay: i * 0.08, type: 'spring', stiffness: 100 }}
                  className="card card-body card-hover flex gap-5 items-center group hover:scale-[1.02] transition-transform"
                >
                  <div className={`w-16 h-16 rounded-2xl flex-shrink-0 ${p.gradientStyle ? '' : `bg-gradient-to-br ${p.color}`}`}
                    style={p.gradientStyle || undefined} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-primary font-heading">{p.title}</h3>
                      <span className={`badge text-xs border ${CATEGORY_COLORS[p.category] || 'badge-gray'}`}>{p.category}</span>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-1">{p.desc}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {p.tech.slice(0, 5).map(t => <span key={t} className="badge badge-blue text-xs">{t}</span>)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-accent">✓ {p.result}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-white text-center">
        <div className="container-max">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl font-bold text-primary font-heading mb-4">Have a Project in Mind?</h2>
            <p className="text-gray-500 mb-8 max-w-xl mx-auto">Let's discuss your requirements and build something amazing together.</p>
            <Link to="/contact" className="btn-primary btn-lg">Start a Project <FiArrowRight /></Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
