import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  FiUsers, FiArrowRight, FiX, FiCheckCircle,
  FiShield, FiBriefcase, FiStar, FiAward, FiUser
} from 'react-icons/fi'
import api from '../../lib/api'
import { mediaUrl } from '../../lib/media'

/* ─────────────── Animation Variants ─────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] },
  }),
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
}

/* ─────────────── Tier Config ─────────────── */
const TIER = {
  director: {
    label: 'Executive Leadership',
    sub: 'Board of Directors',
    badge: 'Executive Director',
    accent: 'from-violet-600 to-indigo-600',
    ring: 'ring-violet-200',
    pill: 'bg-violet-50 text-violet-700 border-violet-200',
    dot: 'bg-violet-600',
    avatar: 'bg-gradient-to-br from-violet-100 to-indigo-100 border-violet-200',
    icon: <FiShield size={14} />,
    divider: 'bg-violet-200',
  },
  manager: {
    label: 'Department Managers',
    sub: 'Team Leads & Heads',
    badge: 'Department Manager',
    accent: 'from-blue-600 to-cyan-500',
    ring: 'ring-blue-200',
    pill: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-600',
    avatar: 'bg-gradient-to-br from-blue-100 to-cyan-100 border-blue-200',
    icon: <FiAward size={14} />,
    divider: 'bg-blue-200',
  },
  employee: {
    label: 'Engineering Staff',
    sub: 'Developers & Specialists',
    badge: 'Staff Member',
    accent: 'from-slate-600 to-slate-500',
    ring: 'ring-slate-200',
    pill: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-500',
    avatar: 'bg-gradient-to-br from-slate-100 to-slate-50 border-slate-200',
    icon: <FiBriefcase size={14} />,
    divider: 'bg-slate-200',
  },
}

/* ─────────────── Member Card ─────────────── */
function MemberCard({ emp, level, index, onClick }) {
  const t = TIER[level]
  const photo = emp.profilePhoto || emp.userId?.avatar
  const name = emp.userId?.name || 'Team Member'
  const desig = emp.designation || 'Specialist'
  const dept = emp.department || 'Raxwo Technology'
  const isIntern = emp.employmentType === 'intern'

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      whileHover={{ y: -6, scale: 1.025 }}
      onClick={() => onClick(emp)}
      className={`group bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/80 shadow-sm
        hover:shadow-xl hover:bg-white transition-all duration-300 cursor-pointer relative overflow-hidden
        ring-1 ${t.ring} ring-offset-0`}
    >
      {/* Top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${t.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      {/* Avatar + Info */}
      <div className="flex items-center gap-4 mb-4">
        <div className={`relative w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden border ${t.avatar} shrink-0`}>
          {photo ? (
            <img src={mediaUrl(photo)} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className={`font-bold text-lg bg-gradient-to-br ${t.accent} bg-clip-text text-transparent`}>
              {name.charAt(0)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 truncate leading-tight">{name}</p>
          <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">{desig}</p>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">{dept}</p>
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-[11px]">
        <span className={`font-bold px-2.5 py-1 rounded-full border ${
          isIntern && level === 'employee'
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : t.pill
        }`}>
          {isIntern && level === 'employee' ? 'Associate Intern' : t.badge}
        </span>
        <span className="text-xs font-bold text-slate-400 group-hover:text-blue-600 transition-colors flex items-center gap-1">
          View <FiArrowRight size={11} />
        </span>
      </div>
    </motion.div>
  )
}

/* ─────────────── Tier Section ─────────────── */
function TierSection({ level, members, onSelect, cols = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3', sectionIndex }) {
  const t = TIER[level]
  if (members.length === 0) return null

  return (
    <motion.div
      custom={sectionIndex}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      className="space-y-5"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-1 h-8 rounded-full bg-gradient-to-b ${t.accent}`} />
          <div>
            <h2 className="text-base font-extrabold text-slate-900 leading-tight">{t.label}</h2>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{t.sub}</p>
          </div>
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${t.pill} flex items-center gap-1.5`}>
          {t.icon}
          {members.length} {members.length === 1 ? t.badge : t.label.split(' ')[0]}
        </span>
      </div>

      {/* Cards Grid */}
      <div className={`grid ${cols} gap-4`}>
        {members.map((emp, i) => (
          <MemberCard key={emp._id} emp={emp} level={level} index={i} onClick={onSelect} />
        ))}
      </div>
    </motion.div>
  )
}

/* ─────────────── Tree Connector ─────────────── */
function TreeConnector({ gradient }) {
  return (
    <div className="flex flex-col items-center gap-0 my-2">
      <motion.div
        initial={{ scaleY: 0, opacity: 0 }}
        whileInView={{ scaleY: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ transformOrigin: 'top' }}
        className={`w-px h-10 ${gradient}`}
      />
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className={`w-2 h-2 rounded-full ${gradient.replace('bg-gradient-to-b', 'bg-blue-400')}`}
      />
    </div>
  )
}

/* ─────────────── Member Modal ─────────────── */
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
        className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          key="modal"
          variants={scaleIn}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={e => e.stopPropagation()}
          className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
        >
          {/* Header gradient banner */}
          <div className={`relative bg-gradient-to-br ${t.accent} p-6 text-white`}>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
            >
              <FiX size={16} />
            </button>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                {photo ? (
                  <img src={mediaUrl(photo)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-extrabold text-white">{name.charAt(0)}</span>
                )}
              </div>
              <div>
                <h3 className="font-extrabold text-base leading-tight">{name}</h3>
                <p className="text-xs text-white/80 font-semibold mt-0.5">{member.designation || 'Staff Member'}</p>
                <p className="text-[11px] text-white/60 mt-0.5">{member.department || 'Raxwo Technology'}</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 text-xs">
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-400 font-semibold">Department</span>
                <span className="font-bold text-slate-800">{member.department || 'Raxwo Team'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-400 font-semibold">Employment Type</span>
                <span className="font-bold text-slate-800 capitalize">
                  {member.employmentType?.replace(/_/g, ' ') || 'Full-time'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-400 font-semibold">Status</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <FiCheckCircle size={11} /> Active Member
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400 font-semibold">Role Level</span>
                <span className={`font-bold px-2.5 py-0.5 rounded-full border ${t.pill}`}>{t.badge}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ─────────────── Main Page ─────────────── */
export default function OurTeam() {
  const [selectedMember, setSelectedMember] = useState(null)

  const { data: empData, isLoading } = useQuery({
    queryKey: ['public-our-team'],
    queryFn: () => api.get('/employees?assignable=1').then(r => r.data),
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

  const totalCount = directors.length + managers.length + staff.length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 pt-24 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">

      {/* Decorative background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-violet-100/50 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-80 h-80 bg-blue-100/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-cyan-100/30 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10 space-y-14">

        {/* ── Page Header ── */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="text-center space-y-5 max-w-2xl mx-auto"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm text-xs font-bold text-slate-600 uppercase tracking-widest"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Corporate Organization
          </motion.span>

          <motion.h1
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight"
          >
            Meet{' '}
            <span className="bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
              Our Team
            </span>
          </motion.h1>

          <motion.p
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-sm text-slate-500 leading-relaxed font-medium"
          >
            The passionate people behind Raxwo Technology — from our executive leadership
            and department managers to our dedicated engineering staff.
          </motion.p>

          {/* Stats Strip */}
          {!isLoading && totalCount > 0 && (
            <motion.div
              custom={3}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="flex items-center justify-center gap-6 pt-2"
            >
              {[
                { label: 'Executives', count: directors.length, color: 'text-violet-700' },
                { label: 'Managers', count: managers.length, color: 'text-blue-700' },
                { label: 'Staff', count: staff.length, color: 'text-slate-700' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={`text-2xl font-extrabold ${s.color}`}>{s.count}</p>
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* ── Hierarchy Content ── */}
        {isLoading ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold text-slate-400">Loading organizational hierarchy...</p>
          </div>
        ) : totalCount === 0 ? (
          <div className="py-24 text-center space-y-2">
            <FiUsers size={40} className="mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-400">No team members to display yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* TIER 1 */}
            <TierSection
              level="director"
              members={directors}
              onSelect={setSelectedMember}
              cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              sectionIndex={0}
            />

            {directors.length > 0 && (managers.length > 0 || staff.length > 0) && (
              <div className="flex flex-col items-center py-4 gap-0">
                <motion.div
                  initial={{ scaleY: 0, opacity: 0 }}
                  whileInView={{ scaleY: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  style={{ transformOrigin: 'top' }}
                  className="w-px h-10 bg-gradient-to-b from-violet-300 to-blue-300"
                />
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 }}
                  className="w-2.5 h-2.5 rounded-full bg-blue-400 ring-4 ring-blue-100"
                />
              </div>
            )}

            {/* TIER 2 */}
            <TierSection
              level="manager"
              members={managers}
              onSelect={setSelectedMember}
              cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              sectionIndex={1}
            />

            {managers.length > 0 && staff.length > 0 && (
              <div className="flex flex-col items-center py-4 gap-0">
                <motion.div
                  initial={{ scaleY: 0, opacity: 0 }}
                  whileInView={{ scaleY: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  style={{ transformOrigin: 'top' }}
                  className="w-px h-10 bg-gradient-to-b from-blue-300 to-slate-300"
                />
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 }}
                  className="w-2.5 h-2.5 rounded-full bg-slate-400 ring-4 ring-slate-100"
                />
              </div>
            )}

            {/* TIER 3 */}
            <TierSection
              level="employee"
              members={staff}
              onSelect={setSelectedMember}
              cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
              sectionIndex={2}
            />
          </div>
        )}

        {/* ── CTA Banner ── */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-800 rounded-3xl p-8 sm:p-10 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl overflow-hidden"
        >
          {/* Background grid pattern */}
          <div className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
              backgroundSize: '24px 24px',
            }}
          />
          <div className="space-y-2 z-10 text-center md:text-left">
            <p className="text-xs font-bold text-blue-200 uppercase tracking-widest">Join the Team</p>
            <h3 className="text-2xl font-extrabold leading-tight">
              Want to build the future with us?
            </h3>
            <p className="text-sm text-blue-100/80 font-medium">
              Explore open positions, internships, and developer roles at Raxwo Technology.
            </p>
          </div>
          <Link
            to="/careers"
            className="z-10 shrink-0 px-6 py-3 bg-white text-blue-900 hover:bg-blue-50 font-bold text-sm rounded-xl shadow-lg inline-flex items-center gap-2 transition-all hover:scale-105 hover:shadow-xl"
          >
            Explore Careers <FiArrowRight size={16} />
          </Link>
        </motion.div>
      </div>

      {/* ── Member Profile Modal ── */}
      {selectedMember && (
        <MemberModal member={selectedMember} onClose={() => setSelectedMember(null)} />
      )}
    </div>
  )
}
