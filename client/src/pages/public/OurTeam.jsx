import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  FiArrowRight, FiX, FiCheckCircle, FiSearch,
  FiShield, FiBriefcase, FiAward, FiUsers, FiGlobe
} from 'react-icons/fi'
import api from '../../lib/api'
import { mediaUrl } from '../../lib/media'

/* ─────────── Tier Configurations (Light Theme) ─────────── */
const TIER = {
  director: {
    badge: 'Executive Leadership',
    cardBorder: 'border-indigo-100 hover:border-indigo-300',
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    avatarBorder: 'border-indigo-500/20 bg-indigo-50/50',
    iconBg: 'bg-indigo-600 text-white',
    accentColor: '#4f46e5',
    icon: FiShield,
  },
  manager: {
    badge: 'Department Lead',
    cardBorder: 'border-blue-100 hover:border-blue-300',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    avatarBorder: 'border-blue-500/20 bg-blue-50/50',
    iconBg: 'bg-[#20b2f5] text-white',
    accentColor: '#20b2f5',
    icon: FiAward,
  },
  employee: {
    badge: 'Specialist',
    cardBorder: 'border-slate-200 hover:border-[#20b2f5]/40',
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
    avatarBorder: 'border-slate-200 bg-slate-50',
    iconBg: 'bg-slate-700 text-white',
    accentColor: '#64748b',
    icon: FiBriefcase,
  },
}

/* ─────────── Member Card (Light UI Theme) ─────────── */
function MemberCard({ emp, level, index, onClick }) {
  const t = TIER[level] || TIER.employee
  const photo = emp.profilePhoto || emp.userId?.avatar
  const name = emp.userId?.name || 'Team Member'
  const desig = emp.designation || 'Specialist'
  const dept = emp.department || 'Raxwo Technology'
  const isIntern = emp.employmentType === 'intern'
  const Icon = t.icon

  return (
    <motion.div
      custom={index}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-20px' }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3) }}
      whileHover={{ y: -6 }}
      onClick={() => onClick(emp)}
      className={`relative cursor-pointer overflow-hidden rounded-2xl bg-white border ${t.cardBorder} p-6 shadow-xs hover:shadow-xl transition-all duration-300 group flex flex-col justify-between`}
    >
      <div>
        <div className="flex items-start gap-4 mb-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className={`w-16 h-16 rounded-2xl overflow-hidden border ${t.avatarBorder} flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform duration-300 bg-slate-100`}>
              {photo ? (
                <img src={mediaUrl(photo)} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span className="font-heading font-extrabold text-2xl text-slate-700">
                  {name.charAt(0)}
                </span>
              )}
            </div>
            {/* Level Icon */}
            <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${t.iconBg} flex items-center justify-center shadow-md border-2 border-white`}>
              <Icon size={12} />
            </div>
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1">
            <h3 className="font-heading font-bold text-slate-900 text-base md:text-lg truncate group-hover:text-[#20b2f5] transition-colors leading-snug">
              {name}
            </h3>
            <p className="text-sm font-semibold text-[#20b2f5] truncate mt-0.5">
              {desig}
            </p>
            <p className="text-xs text-slate-500 truncate mt-1 flex items-center gap-1 font-medium">
              {dept}
            </p>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between">
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${t.badgeBg}`}>
          {isIntern && level === 'employee' ? 'Associate Intern' : t.badge}
        </span>
        <span className="text-xs font-bold text-slate-400 group-hover:text-[#20b2f5] transition-colors flex items-center gap-1">
          View Profile <FiArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
        </span>
      </div>
    </motion.div>
  )
}

/* ─────────── Section Header ─────────── */
function SectionHeader({ level, count }) {
  const labels = {
    director: { title: 'Executive Leadership', sub: 'Board of Directors, Founders & Managing Partners' },
    manager: { title: 'Department Heads & Leads', sub: 'Project Managers, Technical Leads & Supervisors' },
    employee: { title: 'Engineering & Specialists', sub: 'Software Engineers, Designers & Digital Specialists' },
  }
  const l = labels[level] || labels.employee

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 pb-3 border-b border-slate-200">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-slate-900 font-heading">
          {l.title}
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">{l.sub}</p>
      </div>
      <span className="self-start sm:self-auto text-xs font-bold px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 shadow-xs">
        {count} {count === 1 ? 'member' : 'members'}
      </span>
    </div>
  )
}

/* ─────────── Member Modal (Light Theme) ─────────── */
function MemberModal({ member, onClose }) {
  if (!member) return null
  const photo = member.profilePhoto || member.userId?.avatar
  const name = member.userId?.name || 'Team Member'
  const role = (member.userId?.role || '').toLowerCase()
  const desig = (member.designation || '').toLowerCase()
  const isDir = role === 'admin' || desig.includes('director') || desig.includes('ceo') || desig.includes('founder') || desig.includes('managing')
  const isMgr = role === 'manager' || desig.includes('manager') || desig.includes('lead') || desig.includes('head')
  const level = isDir ? 'director' : isMgr ? 'manager' : 'employee'
  const t = TIER[level] || TIER.employee

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          key="modal"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-md overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-2xl"
        >
          {/* Top banner */}
          <div className="bg-gradient-hero p-6 relative text-white">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <FiX size={18} />
            </button>

            <div className="flex items-center gap-4">
              <div className="w-18 h-18 w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/30 bg-white/10 flex items-center justify-center shrink-0 shadow-lg">
                {photo ? (
                  <img src={mediaUrl(photo)} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold font-heading text-white">
                    {name.charAt(0)}
                  </span>
                )}
              </div>
              <div className="min-w-0 pr-8">
                <h3 className="font-bold font-heading text-white text-lg md:text-xl truncate leading-tight">
                  {name}
                </h3>
                <p className="text-xs font-semibold text-[#20b2f5] mt-1 truncate">
                  {member.designation || 'Staff Member'}
                </p>
                <p className="text-[11px] text-white/70 mt-0.5 truncate">
                  {member.department || 'Raxwo Technology'}
                </p>
              </div>
            </div>
          </div>

          {/* Details Body */}
          <div className="p-6 space-y-3 text-sm">
            {[
              { label: 'Department', value: member.department || 'Raxwo Team' },
              { label: 'Employment Type', value: member.employmentType?.replace(/_/g, ' ') || 'Full-time' },
              { label: 'Role Level', value: t.badge },
              { label: 'Status', value: 'Active Member', green: true },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center py-2.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium text-xs md:text-sm">{row.label}</span>
                {row.green ? (
                  <span className="font-bold text-emerald-600 text-xs md:text-sm flex items-center gap-1.5">
                    <FiCheckCircle size={14} /> {row.value}
                  </span>
                ) : (
                  <span className="font-bold text-slate-800 text-xs md:text-sm capitalize">{row.value}</span>
                )}
              </div>
            ))}

            <button
              onClick={onClose}
              className="w-full mt-4 py-3 rounded-xl font-bold text-sm text-white bg-[#0C0227] hover:bg-[#20b2f5] transition-colors cursor-pointer shadow-md"
            >
              Close Profile
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ─────────── Main Page ─────────── */
export default function OurTeam() {
  const [selectedMember, setSelectedMember] = useState(null)

  const { data: empData, isLoading } = useQuery({
    queryKey: ['public-our-team'],
    queryFn: async () => {
      try {
        const res = await api.get('/employees/public-team')
        return res.data
      } catch {
        const fallback = await api.get('/employees?assignable=1')
        return fallback.data
      }
    },
    staleTime: 60_000,
  })

  const employees = useMemo(() => {
    const list = empData?.employees || []
    return list.filter(e => {
      const isInactive = ['inactive', 'suspended', 'former', 'terminated', 'resigned', 'intern_ended'].includes(e.status)
      return !isInactive && e.userId?.isActive !== false
    })
  }, [empData])

  const departments = useMemo(() => {
    return [...new Set(employees.map(e => e.department).filter(Boolean))]
  }, [employees])

  const [search, setSearch] = useState('')
  const [dept, setDept] = useState('')

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const name = (e.userId?.name || '').toLowerCase()
      const desig = (e.designation || '').toLowerCase()
      const department = (e.department || '').toLowerCase()
      const term = search.toLowerCase().trim()
      const matchesSearch = !term || name.includes(term) || desig.includes(term) || department.includes(term)
      const matchesDept = !dept || e.department === dept
      return matchesSearch && matchesDept
    })
  }, [employees, search, dept])

  const { directors, managers, staff } = useMemo(() => {
    const directors = [], managers = [], staff = []
    filteredEmployees.forEach(emp => {
      const role = (emp.userId?.role || '').toLowerCase()
      const desig = (emp.designation || '').toLowerCase()
      if (role === 'admin' || desig.includes('director') || desig.includes('ceo') || desig.includes('founder') || desig.includes('managing')) {
        directors.push(emp)
      } else if (role === 'manager' || desig.includes('manager') || desig.includes('lead') || desig.includes('head') || desig.includes('supervisor')) {
        managers.push(emp)
      } else {
        staff.push(emp)
      }
    })
    return { directors, managers, staff }
  }, [filteredEmployees])

  const totalFiltered = filteredEmployees.length

  return (
    <div className="overflow-x-hidden bg-gray-50 min-h-screen">
      {/* ── HERO SECTION (Matching Site UI Theme) ── */}
      <section className="relative bg-[#0C0227] pt-32 pb-24 overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 right-20 w-72 h-72 bg-[#20b2f5]/15 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-10 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl" />
        </div>

        <div className="container-max relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="badge bg-white/10 text-[#20b2f5] border border-white/20 mb-6 shadow-xl px-4 py-2 inline-flex items-center gap-2">
              <FiUsers size={14} /> Corporate Organization
            </span>
            <h1 className="text-3xl lg:text-5xl font-bold text-white font-heading leading-tight mb-4 tracking-tight">
              Meet Our <span className="text-[#20b2f5]">Team</span>
            </h1>
            <p className="text-white/80 max-w-2xl mx-auto text-base md:text-lg leading-relaxed font-normal mb-6">
              The passionate innovators, architects, and specialists driving digital transformation at Raxwo Technology.
            </p>
            <div className="flex items-center justify-center gap-2 text-white/80 text-sm font-medium">
              <Link to="/" className="flex items-center gap-1 hover:text-[#20b2f5] transition-colors">
                <FiGlobe className="text-[#20b2f5]" /> Home
              </Link>
              <span className="text-white/40">|</span>
              <span className="flex items-center gap-1">
                <FiUsers className="text-[#20b2f5]" /> Our Team
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      {!isLoading && employees.length > 0 && (
        <div className="bg-white border-b border-slate-200 py-6">
          <div className="container-max">
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
              {[
                { label: 'Executive Leadership', count: employees.filter(e => (e.userId?.role === 'admin' || (e.designation || '').toLowerCase().includes('director') || (e.designation || '').toLowerCase().includes('ceo'))).length, color: 'text-indigo-600' },
                { label: 'Department Leads', count: employees.filter(e => (e.userId?.role === 'manager' || (e.designation || '').toLowerCase().includes('manager') || (e.designation || '').toLowerCase().includes('lead'))).length, color: 'text-[#20b2f5]' },
                { label: 'Specialists & Staff', count: employees.filter(e => !['admin', 'manager'].includes(e.userId?.role) && !(e.designation || '').toLowerCase().includes('director') && !(e.designation || '').toLowerCase().includes('manager')).length, color: 'text-slate-700' },
              ].map(s => (
                <div key={s.label} className="text-center p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <p className={`text-2xl md:text-3xl font-extrabold font-heading ${s.color}`}>{s.count}</p>
                  <p className="text-[11px] md:text-xs text-slate-500 font-semibold mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SEARCH & FILTER CONTROLS ── */}
      <section className="py-12">
        <div className="container-max">
          <div className="flex flex-col md:flex-row gap-4 mb-10 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search team members by name or role..."
                className="form-input !pl-10 w-full"
              />
            </div>
            {departments.length > 0 && (
              <select
                value={dept}
                onChange={e => setDept(e.target.value)}
                className="form-select md:w-56"
              >
                <option value="">All Departments</option>
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}
          </div>

          {/* ── HIERARCHY CONTENT ── */}
          {isLoading ? (
            <div className="py-24 text-center space-y-4">
              <div className="w-10 h-10 border-3 border-[#20b2f5]/30 border-t-[#20b2f5] rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-500 font-medium">Loading organization team...</p>
            </div>
          ) : totalFiltered === 0 ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 p-8">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
                <FiUsers size={28} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 font-heading">No team members found</h3>
              <p className="text-sm text-slate-500 mt-1">Try adjusting your search query or department filter.</p>
              {(search || dept) && (
                <button
                  onClick={() => { setSearch(''); setDept(''); }}
                  className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-12">
              {/* TIER 1: EXECUTIVE LEADERSHIP */}
              {directors.length > 0 && (
                <div>
                  <SectionHeader level="director" count={directors.length} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {directors.map((emp, i) => (
                      <MemberCard key={emp._id} emp={emp} level="director" index={i} onClick={setSelectedMember} />
                    ))}
                  </div>
                </div>
              )}

              {/* TIER 2: MANAGERS & LEADS */}
              {managers.length > 0 && (
                <div>
                  <SectionHeader level="manager" count={managers.length} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {managers.map((emp, i) => (
                      <MemberCard key={emp._id} emp={emp} level="manager" index={i} onClick={setSelectedMember} />
                    ))}
                  </div>
                </div>
              )}

              {/* TIER 3: SPECIALISTS & STAFF */}
              {staff.length > 0 && (
                <div>
                  <SectionHeader level="employee" count={staff.length} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {staff.map((emp, i) => (
                      <MemberCard key={emp._id} emp={emp} level="employee" index={i} onClick={setSelectedMember} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── CTA BANNER (Matching Site CTA) ── */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-20 relative overflow-hidden rounded-3xl bg-gradient-hero text-white p-8 md:p-12 shadow-xl border border-white/10"
          >
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left space-y-2">
                <span className="badge bg-white/10 text-[#20b2f5] border border-white/20 text-xs font-bold uppercase tracking-wider">
                  Join The Team
                </span>
                <h3 className="text-2xl md:text-3xl font-bold font-heading text-white">
                  Want to build the future with us?
                </h3>
                <p className="text-white/75 text-sm md:text-base max-w-xl">
                  Explore open positions, internship opportunities, and engineering roles at Raxwo Technology.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/careers"
                  className="btn-primary bg-[#20b2f5] hover:bg-blue-400 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg"
                >
                  Explore Careers <FiArrowRight size={16} />
                </Link>
                <Link
                  to="/contact"
                  className="btn-outline border-white/30 text-white hover:bg-white/10 font-bold px-6 py-3 rounded-xl"
                >
                  Let's Talk
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── MEMBER DETAIL MODAL ── */}
      {selectedMember && (
        <MemberModal member={selectedMember} onClose={() => setSelectedMember(null)} />
      )}
    </div>
  )
}
