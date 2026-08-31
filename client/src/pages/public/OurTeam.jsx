import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  FiArrowRight, FiX, FiCheckCircle,
  FiShield, FiBriefcase, FiAward, FiMail, FiPhone, FiLinkedin
} from 'react-icons/fi'
import api from '../../lib/api'
import { mediaUrl } from '../../lib/media'

/* ─────────── Tier Config ─────────── */
const TIER = {
  director: {
    badge: 'Executive Director',
    gradientCard: 'from-[#0f0c29] via-[#302b63] to-[#24243e]',
    gradientBadge: 'from-violet-500 to-indigo-500',
    accentBorder: 'border-violet-400/30',
    iconBg: 'bg-violet-500/20',
    icon: FiShield,
    pillBg: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
    glow: '0 0 40px rgba(139,92,246,0.25)',
  },
  manager: {
    badge: 'Department Manager',
    gradientCard: 'from-[#0c1f3f] via-[#162d5a] to-[#0c1f3f]',
    gradientBadge: 'from-blue-500 to-cyan-400',
    accentBorder: 'border-blue-400/30',
    iconBg: 'bg-blue-500/20',
    icon: FiAward,
    pillBg: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    glow: '0 0 40px rgba(59,130,246,0.2)',
  },
  employee: {
    badge: 'Staff Member',
    gradientCard: 'from-[#111827] via-[#1f2937] to-[#111827]',
    gradientBadge: 'from-slate-500 to-slate-400',
    accentBorder: 'border-slate-500/30',
    iconBg: 'bg-slate-500/20',
    icon: FiBriefcase,
    pillBg: 'bg-slate-500/10 text-slate-300 border-slate-600/30',
    glow: '0 0 30px rgba(100,116,139,0.15)',
  },
}

/* ─────────── Member Card ─────────── */
function MemberCard({ emp, level, index, onClick }) {
  const t = TIER[level]
  const photo = emp.profilePhoto || emp.userId?.avatar
  const name = emp.userId?.name || 'Team Member'
  const desig = emp.designation || 'Specialist'
  const dept = emp.department || 'Raxwo Technology'
  const isIntern = emp.employmentType === 'intern'
  const Icon = t.icon

  return (
    <motion.div
      custom={index}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -8, scale: 1.02 }}
      onClick={() => onClick(emp)}
      className={`relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br ${t.gradientCard} border ${t.accentBorder} group`}
      style={{ boxShadow: t.glow }}
    >
      {/* Sheen line at top */}
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${t.gradientBadge} opacity-60`} />

      {/* Hover shimmer overlay */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.03] transition-colors duration-300" />

      {/* Content */}
      <div className="relative p-5 flex flex-col gap-4">
        {/* Top row: avatar + info */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className={`w-14 h-14 rounded-xl overflow-hidden border ${t.accentBorder} ${t.iconBg} flex items-center justify-center`}>
              {photo ? (
                <img src={mediaUrl(photo)} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span className={`font-extrabold text-xl bg-gradient-to-br ${t.gradientBadge} bg-clip-text text-transparent`}>
                  {name.charAt(0)}
                </span>
              )}
            </div>
            {/* Level icon badge */}
            <div className={`absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-br ${t.gradientBadge} flex items-center justify-center shadow-lg`}>
              <Icon size={10} className="text-white" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-bold text-white text-sm truncate leading-tight">{name}</p>
            <p className={`text-xs font-semibold truncate mt-0.5 bg-gradient-to-r ${t.gradientBadge} bg-clip-text text-transparent`}>{desig}</p>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">{dept}</p>
          </div>
        </div>

        {/* Bottom row: badge + arrow */}
        <div className={`flex items-center justify-between pt-3 border-t ${t.accentBorder}`}>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${t.pillBg}`}>
            {isIntern && level === 'employee' ? 'Associate Intern' : t.badge}
          </span>
          <span className="text-[11px] font-bold text-slate-500 group-hover:text-white transition-colors flex items-center gap-1">
            View <FiArrowRight size={11} />
          </span>
        </div>
      </div>
    </motion.div>
  )
}

/* ─────────── Section Header ─────────── */
function SectionHeader({ level, count, index }) {
  const t = TIER[level]
  const labels = {
    director: { title: 'Executive Leadership', sub: 'Board of Directors & Founders' },
    manager: { title: 'Department Managers', sub: 'Team Leads & Department Heads' },
    employee: { title: 'Engineering Staff', sub: 'Developers, Designers & Specialists' },
  }
  const l = labels[level]

  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="flex items-center justify-between mb-6"
    >
      <div className="flex items-center gap-3">
        <div className={`w-1.5 h-10 rounded-full bg-gradient-to-b ${t.gradientBadge}`} />
        <div>
          <h2 className="text-lg font-extrabold text-white">{l.title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{l.sub}</p>
        </div>
      </div>
      <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${t.pillBg} flex items-center gap-1.5`}>
        <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${t.gradientBadge}`} />
        {count} {count === 1 ? 'member' : 'members'}
      </span>
    </motion.div>
  )
}

/* ─────────── Connector ─────────── */
function Connector({ from, to }) {
  const fromT = TIER[from]
  const toT = TIER[to]
  return (
    <div className="flex flex-col items-center py-6 gap-1">
      <motion.div
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        style={{ transformOrigin: 'top' }}
        className={`w-px h-12 bg-gradient-to-b ${fromT.gradientBadge}`}
      />
      <motion.div
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5 }}
        className={`w-2 h-2 rounded-full bg-gradient-to-br ${toT.gradientBadge}`}
      />
    </div>
  )
}

/* ─────────── Modal ─────────── */
function MemberModal({ member, onClose }) {
  if (!member) return null
  const photo = member.profilePhoto || member.userId?.avatar
  const name = member.userId?.name || 'Team Member'
  const role = (member.userId?.role || '').toLowerCase()
  const desig = (member.designation || '').toLowerCase()
  const isDir = role === 'admin' || desig.includes('director') || desig.includes('ceo') || desig.includes('founder')
  const isMgr = role === 'manager' || desig.includes('manager') || desig.includes('lead')
  const level = isDir ? 'director' : isMgr ? 'manager' : 'employee'
  const t = TIER[level]

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
        onClick={onClose}
      >
        <motion.div
          key="modal"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          onClick={e => e.stopPropagation()}
          className={`w-full max-w-sm overflow-hidden rounded-3xl border ${t.accentBorder} bg-gradient-to-br ${t.gradientCard}`}
          style={{ boxShadow: `${t.glow}, 0 25px 60px rgba(0,0,0,0.5)` }}
        >
          {/* Sheen */}
          <div className={`h-px bg-gradient-to-r ${t.gradientBadge}`} />

          {/* Header */}
          <div className="relative p-6">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <FiX size={16} />
            </button>

            <div className="flex items-center gap-4">
              <div className={`w-18 h-18 w-16 h-16 rounded-xl overflow-hidden border ${t.accentBorder} ${t.iconBg} flex items-center justify-center shrink-0`}>
                {photo ? (
                  <img src={mediaUrl(photo)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className={`text-2xl font-extrabold bg-gradient-to-br ${t.gradientBadge} bg-clip-text text-transparent`}>
                    {name.charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">{name}</h3>
                <p className={`text-xs font-bold mt-0.5 bg-gradient-to-r ${t.gradientBadge} bg-clip-text text-transparent`}>
                  {member.designation || 'Staff Member'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">{member.department || 'Raxwo Technology'}</p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className={`mx-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent`} />

          {/* Body */}
          <div className="p-6 space-y-3 text-xs">
            {[
              { label: 'Department', value: member.department || 'Raxwo Team' },
              { label: 'Employment', value: member.employmentType?.replace(/_/g, ' ') || 'Full-time' },
              { label: 'Role Level', value: t.badge },
              { label: 'Status', value: 'Active Member', green: true },
            ].map(row => (
              <div key={row.label} className={`flex justify-between py-2 border-b border-white/5`}>
                <span className="text-slate-500 font-semibold">{row.label}</span>
                {row.green ? (
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <FiCheckCircle size={11} /> {row.value}
                  </span>
                ) : (
                  <span className="font-bold text-white capitalize">{row.value}</span>
                )}
              </div>
            ))}

            <button
              onClick={onClose}
              className={`w-full mt-3 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r ${t.gradientBadge} hover:opacity-90 transition-opacity cursor-pointer`}
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

  const { directors, managers, staff } = useMemo(() => {
    const directors = [], managers = [], staff = []
    employees.forEach(emp => {
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
  }, [employees])

  const total = directors.length + managers.length + staff.length

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0f0c29 30%, #0a1628 60%, #0d0d1a 100%)' }}>

      {/* ── HERO SECTION ── */}
      <div className="relative pt-28 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* BG orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px]" />
        </div>
        {/* Grid overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-xs font-bold text-slate-400 uppercase tracking-widest"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Corporate Organization
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl sm:text-6xl font-extrabold tracking-tight"
          >
            <span className="text-white">Meet </span>
            <span style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #60a5fa, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Our Team
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base text-slate-400 max-w-xl mx-auto leading-relaxed"
          >
            The people driving innovation at Raxwo Technology — from our executive board to our engineering specialists.
          </motion.p>

          {/* Stats row */}
          {!isLoading && total > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex items-center justify-center gap-8 pt-2"
            >
              {[
                { label: 'Executives', count: directors.length, color: '#a78bfa' },
                { label: 'Managers', count: managers.length, color: '#60a5fa' },
                { label: 'Staff', count: staff.length, color: '#34d399' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-3xl font-extrabold" style={{ color: s.color }}>{s.count}</p>
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1">{s.label}</p>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* ── HIERARCHY CONTENT ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 relative z-10">
        {isLoading ? (
          <div className="py-24 text-center space-y-4">
            <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500">Loading organizational hierarchy...</p>
          </div>
        ) : total === 0 ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
              <FiBriefcase size={28} className="text-slate-600" />
            </div>
            <p className="text-sm text-slate-500 font-medium">No team members to display yet.</p>
          </div>
        ) : (
          <div className="space-y-2">

            {/* TIER 1 — DIRECTORS */}
            {directors.length > 0 && (
              <div>
                <SectionHeader level="director" count={directors.length} index={0} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {directors.map((emp, i) => (
                    <MemberCard key={emp._id} emp={emp} level="director" index={i} onClick={setSelectedMember} />
                  ))}
                </div>
              </div>
            )}

            {directors.length > 0 && managers.length > 0 && <Connector from="director" to="manager" />}

            {/* TIER 2 — MANAGERS */}
            {managers.length > 0 && (
              <div>
                <SectionHeader level="manager" count={managers.length} index={1} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {managers.map((emp, i) => (
                    <MemberCard key={emp._id} emp={emp} level="manager" index={i} onClick={setSelectedMember} />
                  ))}
                </div>
              </div>
            )}

            {managers.length > 0 && staff.length > 0 && <Connector from="manager" to="employee" />}

            {/* TIER 3 — STAFF */}
            {staff.length > 0 && (
              <div>
                <SectionHeader level="employee" count={staff.length} index={2} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {staff.map((emp, i) => (
                    <MemberCard key={emp._id} emp={emp} level="employee" index={i} onClick={setSelectedMember} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CTA BANNER ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-20 relative overflow-hidden rounded-3xl border border-white/10"
          style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81, #1e3a5f)' }}
        >
          {/* Dot pattern */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.07]"
            style={{
              backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
              backgroundSize: '20px 20px',
            }}
          />
          {/* Orb */}
          <div className="absolute right-0 top-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 p-8 sm:p-10">
            <div className="text-center md:text-left space-y-2">
              <p className="text-xs font-bold text-blue-300 uppercase tracking-widest">Join the Team</p>
              <h3 className="text-2xl font-extrabold text-white leading-tight">
                Want to build the future with us?
              </h3>
              <p className="text-sm text-slate-400">
                Explore open positions, internships, and developer roles at Raxwo Technology.
              </p>
            </div>
            <Link
              to="/careers"
              className="shrink-0 group inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white border border-white/20 bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all hover:scale-105"
            >
              Explore Careers
              <FiArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </motion.div>
      </div>

      {/* ── MEMBER MODAL ── */}
      {selectedMember && (
        <MemberModal member={selectedMember} onClose={() => setSelectedMember(null)} />
      )}
    </div>
  )
}
