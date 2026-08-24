import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import { mediaUrl } from '../../lib/media'
import {
  FiUsers, FiUser, FiBriefcase, FiSearch, FiPhone, FiMail,
  FiLayers, FiChevronDown, FiChevronRight, FiGrid, FiList,
  FiShield, FiBookOpen, FiGlobe, FiFilter, FiExternalLink, FiX
} from 'react-icons/fi'

export default function StaffHierarchy() {
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [viewMode, setViewMode] = useState('tree') // 'tree' | 'grid'
  const [selectedMember, setSelectedMember] = useState(null)

  // Fetch all active employees with populated user & manager
  const { data: empData, isLoading } = useQuery({
    queryKey: ['staff-hierarchy'],
    queryFn: () => api.get('/employees?assignable=1').then(r => r.data),
  })

  const employees = useMemo(() => {
    const list = empData?.employees || []
    return list.filter(e => {
      const isInactive = ['inactive', 'suspended', 'former', 'terminated', 'resigned', 'intern_ended'].includes(e.status)
      const isUserInactive = e.userId?.isActive === false
      return !isInactive && !isUserInactive
    })
  }, [empData])

  // Extract unique departments
  const departments = useMemo(() => {
    const set = new Set(employees.map(e => e.department).filter(Boolean))
    return ['all', ...Array.from(set)]
  }, [employees])

  // Filtered employees by search & department
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const name = (e.userId?.name || '').toLowerCase()
      const desig = (e.designation || '').toLowerCase()
      const dept = (e.department || '').toLowerCase()
      const q = search.toLowerCase().trim()

      const matchSearch = !q || name.includes(q) || desig.includes(q) || dept.includes(q)
      const matchDept = deptFilter === 'all' || e.department === deptFilter
      return matchSearch && matchDept
    })
  }, [employees, search, deptFilter])

  // Group employees into hierarchical tiers based on role and designation
  const hierarchyTiers = useMemo(() => {
    const directors = []
    const management = []
    const projectManagers = []
    const engineers = []
    const interns = []

    employees.forEach(emp => {
      const role = (emp.userId?.role || '').toLowerCase()
      const desig = (emp.designation || '').toLowerCase()
      const isIntern = emp.employmentType === 'intern'

      if (isIntern) {
        interns.push(emp)
      } else if (role === 'admin' || desig.includes('director') || desig.includes('ceo') || desig.includes('founder') || desig.includes('managing')) {
        directors.push(emp)
      } else if (desig.includes('secretary') || desig.includes('operations') || desig.includes('hr lead') || desig.includes('general manager')) {
        management.push(emp)
      } else if (role === 'manager' || desig.includes('manager') || desig.includes('team lead') || desig.includes('tech lead') || desig.includes('lead')) {
        projectManagers.push(emp)
      } else {
        engineers.push(emp)
      }
    })

    return { directors, management, projectManagers, engineers, interns }
  }, [employees])

  // Calculate direct reports count for any given user ID
  const directReportsMap = useMemo(() => {
    const map = {}
    employees.forEach(emp => {
      const mgrId = emp.manager?._id || emp.manager
      if (mgrId) {
        map[mgrId] = (map[mgrId] || 0) + 1
      }
    })
    return map
  }, [employees])

  const totalCount = employees.length
  const leaderCount = hierarchyTiers.directors.length + hierarchyTiers.management.length + hierarchyTiers.projectManagers.length
  const devCount = hierarchyTiers.engineers.length
  const internCount = hierarchyTiers.interns.length

  const renderMemberCard = (emp, isRoot = false) => {
    const isIntern = emp.employmentType === 'intern'
    const reportsCount = directReportsMap[emp.userId?._id] || directReportsMap[emp._id] || 0
    const photo = emp.profilePhoto || emp.userId?.avatar

    return (
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        onClick={() => setSelectedMember(emp)}
        key={emp._id}
        className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between space-y-3 relative overflow-hidden text-left ${
          isRoot
            ? 'border-purple-300 ring-2 ring-purple-500/20 bg-gradient-to-b from-purple-50/20 to-white'
            : isIntern
            ? 'border-amber-200 hover:border-amber-400'
            : 'border-slate-200 hover:border-secondary'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shadow-inner">
              {photo ? (
                <img src={mediaUrl(photo)} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-bold text-sm text-slate-700">{emp.userId?.name?.charAt(0)}</span>
              )}
            </div>
            {isIntern && (
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-white" title="Intern" />
            )}
            {isRoot && (
              <span className="absolute -top-1 -right-1 text-xs" title="Executive">👑</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 truncate leading-tight">{emp.userId?.name || 'Unnamed'}</p>
            <p className="text-[11px] font-semibold text-secondary truncate mt-0.5">{emp.designation || 'Staff Member'}</p>
            <p className="text-[10px] text-slate-400 truncate">{emp.department || 'General'}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
          <span className={`font-semibold px-2 py-0.5 rounded-full border ${
            isIntern
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : isRoot
              ? 'bg-purple-50 text-purple-700 border-purple-200'
              : 'bg-blue-50 text-blue-700 border-blue-200'
          }`}>
            {isIntern ? '🎓 Intern' : isRoot ? '⭐ Executive' : '💼 Staff'}
          </span>

          {reportsCount > 0 && (
            <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-purple-100">
              <FiUsers size={10} /> {reportsCount} report{reportsCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-secondary uppercase tracking-wider mb-1">
            <FiLayers size={13} />
            <span>Organization Chart & Staff Directory</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Company Hierarchy</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Explore corporate leadership, reporting structures, project managers, developers, and interns.
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setViewMode('tree')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              viewMode === 'tree' ? 'bg-white text-secondary shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FiLayers size={14} /> Hierarchy Tree
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              viewMode === 'grid' ? 'bg-white text-secondary shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FiGrid size={14} /> Directory Grid
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FiUsers size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Total Personnel</p>
            <h3 className="text-xl font-bold text-slate-800 mt-0.5">{totalCount}</h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <FiShield size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Leadership & PMs</p>
            <h3 className="text-xl font-bold text-purple-600 mt-0.5">{leaderCount}</h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <FiBriefcase size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Core Engineers</p>
            <h3 className="text-xl font-bold text-emerald-600 mt-0.5">{devCount}</h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FiBookOpen size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Active Interns</p>
            <h3 className="text-xl font-bold text-amber-600 mt-0.5">{internCount}</h3>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <FiSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search staff by name, title, department..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-input !pl-9 !py-2 !text-xs w-full rounded-xl"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <FiX size={12} />
            </button>
          )}
        </div>

        {/* Department Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {departments.map(dept => (
            <button
              key={dept}
              onClick={() => setDeptFilter(dept)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all shrink-0 ${
                deptFilter === dept
                  ? 'bg-secondary text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {dept === 'all' ? 'All Departments' : dept}
            </button>
          ))}
        </div>
      </div>

      {/* ── VIEW MODE 1: HIERARCHY TREE VIEW ── */}
      {viewMode === 'tree' && (
        <div className="space-y-8">
          {/* Level 1: Board & Executive Directors */}
          {hierarchyTiers.directors.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Tier 1: Executive & Managing Directors ({hierarchyTiers.directors.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {hierarchyTiers.directors.map(emp => renderMemberCard(emp, true))}
              </div>
            </div>
          )}

          {/* Level 2: Operations & Secretary */}
          {hierarchyTiers.management.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Tier 2: Operations, HR & General Management ({hierarchyTiers.management.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {hierarchyTiers.management.map(emp => renderMemberCard(emp))}
              </div>
            </div>
          )}

          {/* Level 3: Project Managers & Team Leaders */}
          {hierarchyTiers.projectManagers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Tier 3: Project Managers & Technical Team Leads ({hierarchyTiers.projectManagers.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {hierarchyTiers.projectManagers.map(emp => renderMemberCard(emp))}
              </div>
            </div>
          )}

          {/* Level 4: Core Engineers */}
          {hierarchyTiers.engineers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Tier 4: Software Engineers & Specialists ({hierarchyTiers.engineers.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {hierarchyTiers.engineers.map(emp => renderMemberCard(emp))}
              </div>
            </div>
          )}

          {/* Level 5: Interns */}
          {hierarchyTiers.interns.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Tier 5: Engineering & Associate Interns ({hierarchyTiers.interns.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {hierarchyTiers.interns.map(emp => renderMemberCard(emp))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VIEW MODE 2: DIRECTORY GRID VIEW ── */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredEmployees.map(emp => renderMemberCard(emp))}
          {filteredEmployees.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
              No staff members match the selected filters.
            </div>
          )}
        </div>
      )}

      {/* ── Member Detail Modal / Drawer ── */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white relative">
              <button
                onClick={() => setSelectedMember(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <FiX size={16} />
              </button>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                  {selectedMember.profilePhoto || selectedMember.userId?.avatar ? (
                    <img src={mediaUrl(selectedMember.profilePhoto || selectedMember.userId?.avatar)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-white">{selectedMember.userId?.name?.charAt(0)}</span>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-bold">{selectedMember.userId?.name}</h3>
                  <p className="text-xs text-slate-300">{selectedMember.designation || 'Staff Member'}</p>
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1.5 border ${
                    selectedMember.employmentType === 'intern'
                      ? 'bg-amber-400 text-slate-900 border-amber-300'
                      : 'bg-blue-400 text-slate-900 border-blue-300'
                  }`}>
                    {selectedMember.employmentType === 'intern' ? '🎓 INTERN' : '💼 PERMANENT STAFF'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-400">Employee ID</span>
                  <span className="font-mono font-bold text-slate-700">{selectedMember.employeeNo || '—'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-400">Department</span>
                  <span className="font-semibold text-slate-700">{selectedMember.department || '—'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-400">Reporting Leader</span>
                  <span className="font-semibold text-purple-700">{selectedMember.manager?.name || 'Independent / Executive'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-400">Direct Reports</span>
                  <span className="font-bold text-slate-800">
                    {directReportsMap[selectedMember.userId?._id] || directReportsMap[selectedMember._id] || 0} members
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-400">Joined Date</span>
                  <span className="font-medium text-slate-700">
                    {selectedMember.joinedDate ? new Date(selectedMember.joinedDate).toLocaleDateString('en-LK') : '—'}
                  </span>
                </div>
              </div>

              {/* Quick Contact Links */}
              <div className="pt-2 flex items-center gap-2">
                {selectedMember.userId?.email && (
                  <a
                    href={`mailto:${selectedMember.userId.email}`}
                    className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FiMail size={13} /> Email
                  </a>
                )}
                {selectedMember.primaryPhone && (
                  <a
                    href={`tel:${selectedMember.primaryPhone}`}
                    className="flex-1 py-2 rounded-xl bg-secondary text-white font-bold flex items-center justify-center gap-1.5 hover:bg-secondary/90 transition-colors"
                  >
                    <FiPhone size={13} /> Call
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
