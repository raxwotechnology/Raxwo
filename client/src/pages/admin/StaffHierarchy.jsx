import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import UserAvatar from '../../components/ui/UserAvatar'
import useAuthStore from '../../store/authStore'
import { useDeleteWithPassword } from '../../components/admin/DeletePasswordGate'
import {
  FiUsers, FiUser, FiBriefcase, FiSearch, FiPhone, FiMail,
  FiLayers, FiChevronDown, FiChevronRight, FiGrid, FiList,
  FiShield, FiBookOpen, FiGlobe, FiFilter, FiExternalLink,
  FiX, FiTrash2, FiUserX, FiCheckCircle, FiAward, FiCopy,
  FiCalendar, FiMapPin, FiActivity, FiArrowRight, FiCheck
} from 'react-icons/fi'
import { useSiteBranding } from '../../hooks/useSiteBranding'

export default function StaffHierarchy() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuthStore()
  const { logoSrc, siteName } = useSiteBranding()
  const isAdmin = currentUser?.role === 'admin'
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [viewMode, setViewMode] = useState('tree') // 'tree' | 'team' | 'grid'
  const [selectedMember, setSelectedMember] = useState(null)
  const [copiedId, setCopiedId] = useState(false)
  const [sortBy, setSortBy] = useState('name') // 'name' | 'dept' | 'desig'

  // Permanently Delete Employee Mutation
  const deleteEmployeeMut = useMutation({
    mutationFn: (id) => api.delete(`/employees/${id}`).then(r => r.data),
    onSuccess: (data) => {
      toast.success(data?.message || 'Employee permanently deleted')
      queryClient.invalidateQueries({ queryKey: ['staff-hierarchy'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['team-hub-employees'] })
      queryClient.invalidateQueries({ queryKey: ['public-our-team'] })
      setSelectedMember(null)
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete employee')
    }
  })

  const { requestDelete: requestDeleteEmployee, DeletePasswordModal: employeeDeleteModal } = useDeleteWithPassword(deleteEmployeeMut, {
    title: 'Permanently Delete Employee',
    message: 'Enter your admin password to permanently delete this employee and their user account.',
  })

  // Unassign Leader Mutation
  const unassignLeaderMut = useMutation({
    mutationFn: async (empId) => {
      const res = await api.put(`/employees/${empId}`, { manager: null })
      return res.data
    },
    onSuccess: () => {
      toast.success('Assigned leader removed successfully!')
      queryClient.invalidateQueries({ queryKey: ['staff-hierarchy'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setSelectedMember(null)
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to remove leader')
    }
  })

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
    let list = employees.filter(e => {
      const name = (e.userId?.name || '').toLowerCase()
      const desig = (e.designation || '').toLowerCase()
      const dept = (e.department || '').toLowerCase()
      const empNo = (e.employeeNo || '').toLowerCase()
      const q = search.toLowerCase().trim()

      const matchSearch = !q || name.includes(q) || desig.includes(q) || dept.includes(q) || empNo.includes(q)
      const matchDept = deptFilter === 'all' || e.department === deptFilter
      return matchSearch && matchDept
    })

    if (sortBy === 'name') {
      list.sort((a, b) => (a.userId?.name || '').localeCompare(b.userId?.name || ''))
    } else if (sortBy === 'dept') {
      list.sort((a, b) => (a.department || '').localeCompare(b.department || ''))
    } else if (sortBy === 'desig') {
      list.sort((a, b) => (a.designation || '').localeCompare(b.designation || ''))
    }

    return list
  }, [employees, search, deptFilter, sortBy])

  // Direct reports map (key: userId or employeeId -> count)
  const directReportsMap = useMemo(() => {
    const map = {}
    employees.forEach(emp => {
      const mgrId = emp.manager?._id || emp.manager
      if (mgrId) {
        map[String(mgrId)] = (map[String(mgrId)] || 0) + 1
      }
    })
    return map
  }, [employees])

  // Group employees into hierarchical tiers based on role and designation
  const hierarchyTiers = useMemo(() => {
    if (!isAdmin) {
      const pmLeader = []
      const teamLeads = []
      const engineers = []
      const interns = []

      let foundSelf = false
      filteredEmployees.forEach(emp => {
        const uid = String(emp.userId?._id || emp.userId || '')
        const isSelf = uid === String(currentUser?._id)
        const isIntern = emp.employmentType === 'intern'
        const desig = (emp.designation || '').toLowerCase()
        const role = (emp.userId?.role || '').toLowerCase()

        if (isSelf) {
          foundSelf = true
          pmLeader.push(emp)
        } else if (isIntern) {
          interns.push(emp)
        } else if (role === 'manager' || desig.includes('lead') || desig.includes('leader') || desig.includes('manager')) {
          teamLeads.push(emp)
        } else {
          engineers.push(emp)
        }
      })

      if (!foundSelf && currentUser && (deptFilter === 'all' || currentUser.department === deptFilter)) {
        pmLeader.push({
          _id: currentUser._id,
          userId: currentUser,
          designation: 'Project Manager',
          department: 'Project Management',
          employmentType: 'permanent',
        })
      }

      return {
        isManagerScoped: true,
        directors: pmLeader,
        admins: [],
        projectManagers: teamLeads,
        engineers,
        interns,
      }
    }

    const directors = []
    const admins = []
    const projectManagers = []
    const engineers = []
    const interns = []

    filteredEmployees.forEach(emp => {
      const role = (emp.userId?.role || '').toLowerCase()
      const desig = (emp.designation || '').toLowerCase()
      const isIntern = emp.employmentType === 'intern'

      if (isIntern) {
        interns.push(emp)
      } else if (desig.includes('director') || desig.includes('ceo') || desig.includes('founder') || desig.includes('managing') || desig.includes('chief executive')) {
        directors.push(emp)
      } else if (role === 'admin' || desig.includes('administrator') || desig.includes('system admin') || desig.includes('operations') || desig.includes('hr') || desig.includes('general manager')) {
        admins.push(emp)
      } else if (role === 'manager' || desig.includes('manager') || desig.includes('team lead') || desig.includes('tech lead') || desig.includes('lead')) {
        projectManagers.push(emp)
      } else {
        engineers.push(emp)
      }
    })

    return { isManagerScoped: false, directors, admins, projectManagers, engineers, interns }
  }, [filteredEmployees, isAdmin, currentUser, deptFilter])

  // Group employees by team leaders & their direct reports (Team Wise)
  const teamHierarchy = useMemo(() => {
    const leaderMap = new Map()
    const unassignedMembers = []

    const employeeByUserMap = new Map()
    employees.forEach(emp => {
      const uid = String(emp.userId?._id || emp.userId || '')
      if (uid) employeeByUserMap.set(uid, emp)
    })

    if (!isAdmin && currentUser && !leaderMap.has(String(currentUser._id))) {
      const selfEmp = employeeByUserMap.get(String(currentUser._id))
      leaderMap.set(String(currentUser._id), {
        id: String(currentUser._id),
        user: currentUser,
        employee: selfEmp || {
          _id: currentUser._id,
          userId: currentUser,
          designation: 'Project Manager',
          department: 'Project Management',
          employmentType: 'permanent',
        },
        members: []
      })
    }

    employees.forEach(emp => {
      if (emp.manager?._id) {
        const mgrId = String(emp.manager._id)
        if (!leaderMap.has(mgrId)) {
          const leaderEmp = employeeByUserMap.get(mgrId)
          leaderMap.set(mgrId, {
            id: mgrId,
            user: emp.manager,
            employee: leaderEmp || null,
            members: []
          })
        }
      }
    })

    employees.forEach(emp => {
      const role = (emp.userId?.role || '').toLowerCase()
      const desig = (emp.designation || '').toLowerCase()
      const uid = String(emp.userId?._id || emp._id)
      const isLeaderRole = role === 'admin' || role === 'manager' || desig.includes('director') || desig.includes('ceo') || desig.includes('lead') || desig.includes('manager')
      
      if (isLeaderRole && !leaderMap.has(uid) && emp.employmentType !== 'intern') {
        leaderMap.set(uid, {
          id: uid,
          user: emp.userId,
          employee: emp,
          members: []
        })
      }
    })

    filteredEmployees.forEach(emp => {
      const mgrId = emp.manager?._id ? String(emp.manager._id) : null
      if (mgrId && leaderMap.has(mgrId)) {
        if (mgrId !== String(emp.userId?._id)) {
          leaderMap.get(mgrId).members.push(emp)
        }
      } else {
        if (String(emp.userId?._id) !== String(currentUser?._id)) {
          unassignedMembers.push(emp)
        }
      }
    })

    const teams = Array.from(leaderMap.values())
      .filter(team => {
        if (!search && deptFilter === 'all') return true
        const matchLeader = (team.user?.name || '').toLowerCase().includes(search.toLowerCase()) ||
                            (team.employee?.designation || '').toLowerCase().includes(search.toLowerCase())
        return matchLeader || team.members.length > 0
      })
      .sort((a, b) => {
        if (!isAdmin) {
          if (String(a.id) === String(currentUser?._id)) return -1
          if (String(b.id) === String(currentUser?._id)) return 1
        }
        return b.members.length - a.members.length
      })

    return { teams, unassignedMembers }
  }, [employees, filteredEmployees, search, deptFilter, isAdmin, currentUser])

  const totalCount = employees.length
  const leaderCount = (hierarchyTiers.directors.length + (hierarchyTiers.admins?.length || 0) + hierarchyTiers.projectManagers.length)
  const devCount = hierarchyTiers.engineers.length
  const internCount = hierarchyTiers.interns.length

  const handleCopyEmployeeId = (text) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedId(true)
    toast.success(`Copied "${text}" to clipboard`)
    setTimeout(() => setCopiedId(false), 2000)
  }

  // ── Render Modern Member Card ──
  const renderMemberCard = (emp, tierType = 'regular') => {
    const isIntern = emp.employmentType === 'intern'
    const isExecutive = tierType === 'executive'
    const isAdminTier = tierType === 'admin'
    const isLead = tierType === 'lead'
    const reportsCount = directReportsMap[String(emp.userId?._id)] || directReportsMap[String(emp._id)] || 0
    const photo = emp.profilePhoto || emp.userId?.avatar

    return (
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        transition={{ duration: 0.2 }}
        onClick={() => setSelectedMember(emp)}
        key={emp._id}
        className={`group relative bg-white rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer shadow-xs hover:shadow-xl flex flex-col justify-between text-left overflow-hidden ${
          isExecutive
            ? 'border-indigo-200/90 ring-1 ring-indigo-500/20 bg-gradient-to-b from-indigo-50/30 via-white to-white'
            : isAdminTier
            ? 'border-blue-200/90 ring-1 ring-blue-500/20 bg-gradient-to-b from-blue-50/30 via-white to-white'
            : isLead
            ? 'border-sky-200/90 ring-1 ring-sky-500/20 bg-gradient-to-b from-sky-50/25 via-white to-white'
            : isIntern
            ? 'border-amber-200/80 hover:border-amber-400 bg-gradient-to-b from-amber-50/15 via-white to-white'
            : 'border-slate-200/90 hover:border-[#20b2f5]/60 hover:shadow-sky-500/5'
        }`}
      >
        {/* Subtle Top Accent bar on hover */}
        <div className={`absolute top-0 left-0 right-0 h-1 transition-opacity duration-300 ${
          isExecutive
            ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 opacity-90'
            : isAdminTier
            ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 opacity-90'
            : isLead
            ? 'bg-gradient-to-r from-sky-500 via-blue-600 to-sky-500 opacity-80'
            : isIntern
            ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 opacity-70'
            : 'bg-gradient-to-r from-slate-400 to-[#20b2f5] opacity-0 group-hover:opacity-100'
        }`} />

        <div className="flex items-start gap-3.5">
          {/* Avatar with Status Ring */}
          <div className="relative shrink-0 w-14 h-14 min-w-[56px] min-h-[56px] max-w-[56px] max-h-[56px]">
            <div className={`w-14 h-14 min-w-[56px] min-h-[56px] max-w-[56px] max-h-[56px] rounded-2xl p-0.5 shadow-xs transition-transform duration-300 group-hover:scale-105 ${
              isExecutive
                ? 'bg-gradient-to-tr from-indigo-600 to-purple-500'
                : isAdminTier
                ? 'bg-gradient-to-tr from-blue-600 to-cyan-500'
                : isLead
                ? 'bg-gradient-to-tr from-sky-500 to-blue-600'
                : isIntern
                ? 'bg-gradient-to-tr from-amber-400 to-orange-500'
                : 'bg-gradient-to-tr from-slate-200 to-slate-300'
            }`}>
              <div className="w-full h-full rounded-[14px] overflow-hidden bg-white flex items-center justify-center">
                <UserAvatar
                  user={{ name: emp.userId?.name, avatar: photo }}
                  className="w-full h-full"
                  imgClassName="w-full h-full object-cover object-top"
                />
              </div>
            </div>
            
            {/* Crown / Shield Badge */}
            {isExecutive && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-md border-2 border-white" title="Executive Board">
                <FiShield size={10} />
              </span>
            )}
            {isAdminTier && !isExecutive && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md border-2 border-white" title="Admin Panel">
                <FiShield size={10} />
              </span>
            )}
            {isLead && !isExecutive && !isAdminTier && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-sky-600 text-white rounded-full flex items-center justify-center shadow-md border-2 border-white" title="Team Lead">
                <FiAward size={10} />
              </span>
            )}
            {isIntern && (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-md border-2 border-white" title="Intern">
                <FiBookOpen size={9} />
              </span>
            )}
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-secondary transition-colors font-heading leading-tight">
                {emp.userId?.name || 'Staff Member'}
              </h4>
            </div>

            <p className="text-xs font-semibold text-secondary truncate mt-0.5">
              {emp.designation || 'Specialist'}
            </p>

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {emp.department && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100/90 px-2 py-0.5 rounded-md truncate max-w-[120px]">
                  <FiBriefcase size={10} className="shrink-0 text-slate-400" />
                  <span className="truncate">{emp.department}</span>
                </span>
              )}
              {emp.employeeNo && (
                <span className="text-[10px] font-mono text-slate-400 font-semibold">
                  {emp.employeeNo}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card Footer: Tier Pill & Reports */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
          <span className={`font-bold px-2.5 py-0.5 rounded-full border shadow-2xs flex items-center gap-1.5 ${
            isExecutive
              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
              : isAdminTier
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : isLead
              ? 'bg-sky-50 text-sky-700 border-sky-200'
              : isIntern
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}>
            {isExecutive ? (
              <><FiShield size={11} className="text-indigo-600" /> Executive</>
            ) : isAdminTier ? (
              <><FiShield size={11} className="text-blue-600" /> Admin Panel</>
            ) : isLead ? (
              <><FiAward size={11} className="text-sky-600" /> Team Lead</>
            ) : isIntern ? (
              <><FiBookOpen size={11} className="text-amber-600" /> Intern</>
            ) : (
              <><FiBriefcase size={11} className="text-slate-500" /> Specialist</>
            )}
          </span>

          <div className="flex items-center gap-2">
            {reportsCount > 0 && (
              <span className="font-bold text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded-full flex items-center gap-1 border border-indigo-100/80 text-[10px]" title="Direct Reports">
                <FiUsers size={11} /> {reportsCount} report{reportsCount !== 1 ? 's' : ''}
              </span>
            )}
            <span className="text-slate-300 group-hover:text-secondary group-hover:translate-x-0.5 transition-all">
              <FiArrowRight size={13} />
            </span>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* ── Standard ERP Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{!isAdmin ? 'Project Team Hierarchy' : 'Company Hierarchy & Directory'}</h1>
          <p className="page-subtitle">
            {!isAdmin
              ? 'Interactive reporting structure for assigned project teams, technical team leads, and interns.'
              : 'Explore corporate governance, executive leadership, technical reporting lines, and personnel directory.'}
          </p>
        </div>

        {/* View Mode Segmented Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 shrink-0 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'tree' ? 'bg-white text-slate-900 shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FiLayers size={13} className={viewMode === 'tree' ? 'text-indigo-600' : ''} />
              <span>Org Tree</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('team')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'team' ? 'bg-white text-slate-900 shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FiUsers size={13} className={viewMode === 'team' ? 'text-secondary' : ''} />
              <span>Team Pods</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FiGrid size={13} className={viewMode === 'grid' ? 'text-emerald-600' : ''} />
              <span>Staff Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Standard ERP KPI Cards (Categorized Figures) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="kpi-card kpi-blue">
          <p className="text-xs uppercase text-slate-500 font-medium">Total Personnel</p>
          <p className="text-2xl font-bold text-primary mt-1">{totalCount}</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Active staff directory</p>
        </div>

        <div className="kpi-card kpi-purple">
          <p className="text-xs uppercase text-slate-500 font-medium">{!isAdmin ? 'Team Leads' : 'Leadership & PMs'}</p>
          <p className="text-2xl font-bold text-primary mt-1">{leaderCount}</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Executive & Management</p>
        </div>

        <div className="kpi-card kpi-green">
          <p className="text-xs uppercase text-slate-500 font-medium">Core Specialists</p>
          <p className="text-2xl font-bold text-primary mt-1">{devCount}</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Engineers & Designers</p>
        </div>

        <div className="kpi-card kpi-orange">
          <p className="text-xs uppercase text-slate-500 font-medium">Active Interns</p>
          <p className="text-2xl font-bold text-primary mt-1">{internCount}</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Trainees & Interns</p>
        </div>
      </div>

      {/* ── Search & Filter Control Bar ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <FiSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, role, department, employee ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-input !pl-10 !py-2.5 !text-xs w-full rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-secondary transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <FiX size={13} />
            </button>
          )}
        </div>

        {/* Right side: Department Pills & Sort */}
        <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-thin">
          <div className="flex items-center gap-1.5 shrink-0">
            {departments.map(dept => (
              <button
                key={dept}
                onClick={() => setDeptFilter(dept)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize whitespace-nowrap transition-all cursor-pointer ${
                  deptFilter === dept
                    ? 'bg-secondary text-white shadow-sm shadow-secondary/30'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {dept === 'all' ? 'All Departments' : dept}
              </button>
            ))}
          </div>

          {/* Sort By Dropdown */}
          <div className="shrink-0 flex items-center gap-1.5 border-l border-slate-200 pl-3">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="form-select !py-1 !px-2.5 !text-xs rounded-xl border-slate-200 bg-slate-50 text-slate-700 font-semibold"
            >
              <option value="name">Name (A-Z)</option>
              <option value="dept">Department</option>
              <option value="desig">Designation</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200">
          <div className="w-10 h-10 border-4 border-secondary/20 border-t-secondary rounded-full animate-spin mb-3" />
          <p className="text-xs font-semibold text-slate-400">Loading hierarchy structure...</p>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODE 1: INTERACTIVE HIERARCHY ORG TREE (REAL TREE CONNECTIONS)
      ───────────────────────────────────────────────────────────── */}
      {!isLoading && viewMode === 'tree' && (
        <div className="space-y-12">
          {/* ── 🏢 COMPANY ROOT APEX NODE ── */}
          <div className="flex flex-col items-center">
            <div className="relative group bg-white border border-slate-200/90 hover:border-indigo-300 rounded-3xl p-6 sm:p-7 shadow-sm hover:shadow-xl transition-all max-w-xl w-full text-center overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-100/40 to-sky-100/40 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-600 via-secondary to-purple-600" />
              
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-secondary p-0.5 shadow-sm mb-3">
                  <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center p-1.5 overflow-hidden">
                    <img
                      src={logoSrc || '/logo.png'}
                      alt={siteName || 'Raxwo'}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        if (!e.currentTarget.dataset.fallbackTried) {
                          e.currentTarget.dataset.fallbackTried = '1';
                          e.currentTarget.src = '/raxwo-logo.png';
                        } else {
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                        }
                      }}
                    />
                    <div className="hidden w-full h-full items-center justify-center text-indigo-600 font-extrabold text-xl">R</div>
                  </div>
                </div>
                
                <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 tracking-wider uppercase mb-1.5 flex items-center gap-1.5 shadow-2xs">
                  <FiShield size={12} className="text-indigo-600" /> Corporate Apex · Organization Root
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-heading tracking-tight">
                  Raxwo (Pvt) Ltd
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1 max-w-md">
                  Enterprise Cloud ERP & Multi-tenant Business Management Infrastructure
                </p>

                {/* Corporate Meta Badges */}
                <div className="flex items-center justify-center gap-3 mt-4 pt-3.5 border-t border-slate-100 flex-wrap text-xs">
                  <span className="inline-flex items-center gap-1.5 text-slate-600 font-semibold bg-slate-50 px-3 py-1 rounded-xl border border-slate-200/80 shadow-2xs">
                    <FiUsers size={12} className="text-secondary" /> {totalCount} Active Personnel
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-slate-600 font-semibold bg-slate-50 px-3 py-1 rounded-xl border border-slate-200/80 shadow-2xs">
                    <FiLayers size={12} className="text-indigo-600" /> {Math.max(1, departments.length - 1)} Departments
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200/80 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Operational
                  </span>
                </div>
              </div>
            </div>

            {/* Connecting Stem from Company Apex to Next Level */}
            <div className="flex flex-col items-center my-6">
              <div className="w-0.5 h-10 bg-gradient-to-b from-indigo-500 to-sky-500 rounded-full" />
              <div className="w-2.5 h-2.5 rounded-full bg-sky-500 ring-4 ring-sky-100" />
            </div>
          </div>

          {/* Tier 1: Board of Directors & Managing Directors */}
          {hierarchyTiers.directors.length > 0 && (
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-sm shadow-xs">
                    <FiShield size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider font-heading">
                      {!isAdmin ? `Tier 1: Project Management Leadership (${hierarchyTiers.directors.length})` : `Tier 1: Executive Board & Managing Directors (${hierarchyTiers.directors.length})`}
                    </h2>
                    <p className="text-xs text-slate-400">Highest authority & corporate strategic oversight</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {hierarchyTiers.directors.map(emp => renderMemberCard(emp, 'executive'))}
              </div>

              {/* Connecting Tree Stem to Next Tier */}
              <div className="flex justify-center my-6">
                <div className="flex flex-col items-center">
                  <div className="w-0.5 h-8 bg-gradient-to-b from-indigo-500 to-blue-500 rounded-full" />
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-100" />
                </div>
              </div>
            </div>
          )}

          {/* Tier 2: Admin Panel & Executive Administration (Admins) */}
          {isAdmin && hierarchyTiers.admins.length > 0 && (
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-sm shadow-xs">
                    <FiShield size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider font-heading">
                      Tier 2: Admin Panel & Executive Administration ({hierarchyTiers.admins.length})
                    </h2>
                    <p className="text-xs text-slate-400">System administrators, operations oversight, and HR governance</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {hierarchyTiers.admins.map(emp => renderMemberCard(emp, 'admin'))}
              </div>

              <div className="flex justify-center my-6">
                <div className="flex flex-col items-center">
                  <div className="w-0.5 h-8 bg-gradient-to-b from-blue-500 to-sky-500 rounded-full" />
                  <div className="w-2.5 h-2.5 rounded-full bg-sky-500 ring-4 ring-sky-100" />
                </div>
              </div>
            </div>
          )}

          {/* Tier 3: Project Managers & Technical Team Leads */}
          {hierarchyTiers.projectManagers.length > 0 && (
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center font-bold text-sm shadow-xs">
                    <FiAward size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider font-heading">
                      {!isAdmin ? `Tier 2: Technical Team Leads (${hierarchyTiers.projectManagers.length})` : `Tier 3: Department Managers & Technical Team Leads (${hierarchyTiers.projectManagers.length})`}
                    </h2>
                    <p className="text-xs text-slate-400">Direct technical leaders managing sprint execution, departments & staff</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {hierarchyTiers.projectManagers.map(emp => renderMemberCard(emp, 'lead'))}
              </div>

              <div className="flex justify-center my-6">
                <div className="flex flex-col items-center">
                  <div className="w-0.5 h-8 bg-gradient-to-b from-sky-500 to-emerald-500 rounded-full" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                </div>
              </div>
            </div>
          )}

          {/* Tier 4: Core Software Engineers, Designers & Specialists */}
          {hierarchyTiers.engineers.length > 0 && (
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold text-sm shadow-xs">
                    <FiUsers size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider font-heading">
                      {!isAdmin ? `Tier 3: Software Engineers & Specialists (${hierarchyTiers.engineers.length})` : `Tier 4: Software Engineers, Designers & Core Specialists (${hierarchyTiers.engineers.length})`}
                    </h2>
                    <p className="text-xs text-slate-400">Core software architects, developers, UI/UX, and QA staff</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {hierarchyTiers.engineers.map(emp => renderMemberCard(emp, 'regular'))}
              </div>

              <div className="flex justify-center my-6">
                <div className="flex flex-col items-center">
                  <div className="w-0.5 h-8 bg-gradient-to-b from-emerald-500 to-amber-500 rounded-full" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-amber-100" />
                </div>
              </div>
            </div>
          )}

          {/* Tier 4/5: Associate & Engineering Interns */}
          {hierarchyTiers.interns.length > 0 && (
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold text-sm shadow-xs">
                    <FiBookOpen size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider font-heading">
                      {!isAdmin ? `Tier 4: Engineering & Associate Interns (${hierarchyTiers.interns.length})` : `Tier 5: Engineering & Associate Interns (${hierarchyTiers.interns.length})`}
                    </h2>
                    <p className="text-xs text-slate-400">Undergraduate trainees, associate engineers, and interns</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {hierarchyTiers.interns.map(emp => renderMemberCard(emp, 'regular'))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODE 2: TEAM WISE PODS (GROUPED BY LEADER)
      ───────────────────────────────────────────────────────────── */}
      {!isLoading && viewMode === 'team' && (
        <div className="space-y-8">
          {teamHierarchy.teams.length > 0 ? (
            teamHierarchy.teams.map((team) => {
              const internCount = team.members.filter(m => m.employmentType === 'intern').length
              const staffCount = team.members.filter(m => m.employmentType !== 'intern').length
              const leaderPhoto = team.employee?.profilePhoto || team.user?.avatar

              return (
                <div
                  key={team.id}
                  className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-7 space-y-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Clean Light Executive Team Leader Banner */}
                  <div className="bg-gradient-to-r from-slate-50 via-sky-50/30 to-indigo-50/20 border border-slate-200/90 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-sky-200/20 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative z-10 flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-16 h-16 min-w-[64px] min-h-[64px] max-w-[64px] max-h-[64px] rounded-2xl p-0.5 bg-gradient-to-tr from-sky-400 to-indigo-500 shadow-sm shrink-0">
                        <div className="w-full h-full rounded-[14px] overflow-hidden bg-white flex items-center justify-center">
                          <UserAvatar
                            user={{ name: team.user?.name, avatar: leaderPhoto }}
                            className="w-full h-full"
                            imgClassName="w-full h-full object-cover object-top"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg sm:text-xl font-bold text-slate-900 font-heading tracking-tight">
                            {team.user?.name || 'Team Leader'}
                          </h3>
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-secondary text-white shadow-2xs flex items-center gap-1">
                            <FiAward size={11} /> TEAM LEADER
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium mt-0.5">
                          {team.employee?.designation || team.user?.role || 'Leader'} · {team.employee?.department || 'Engineering'}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                          {team.user?.email && (
                            <a href={`mailto:${team.user.email}`} className="hover:text-secondary flex items-center gap-1 transition-colors">
                              <FiMail size={12} /> {team.user.email}
                            </a>
                          )}
                          {team.employee?.primaryPhone && (
                            <a href={`tel:${team.employee.primaryPhone}`} className="hover:text-secondary flex items-center gap-1 transition-colors">
                              <FiPhone size={12} /> {team.employee.primaryPhone}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Team Metrics & View Profile */}
                    <div className="relative z-10 flex items-center gap-2.5 flex-wrap">
                      <span className="px-3.5 py-2 rounded-xl bg-white text-slate-700 text-xs font-bold flex items-center gap-1.5 border border-slate-200/90 shadow-2xs">
                        <FiUsers size={13} className="text-secondary" /> {team.members.length} Member{team.members.length !== 1 ? 's' : ''}
                      </span>
                      {staffCount > 0 && (
                        <span className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200/80 flex items-center gap-1">
                          <FiBriefcase size={12} /> {staffCount} Core
                        </span>
                      )}
                      {internCount > 0 && (
                        <span className="px-3 py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200/80 flex items-center gap-1">
                          <FiBookOpen size={12} /> {internCount} Intern{internCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {team.employee && (
                        <button
                          type="button"
                          onClick={() => setSelectedMember(team.employee)}
                          className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200/90 transition-all cursor-pointer shadow-2xs hover:border-slate-300"
                        >
                          View Leader
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Team Members List */}
                  <div>
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2 font-heading">
                        <span>Assigned Team Members</span>
                        <span className="text-[11px] font-bold text-slate-400">({team.members.length})</span>
                      </h4>
                    </div>

                    {team.members.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {team.members.map(member => renderMemberCard(member))}
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                        No team members currently assigned under this leader.
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
              No teams match the current search or filters.
            </div>
          )}

          {/* Unassigned / Cross-functional Personnel Pod */}
          {teamHierarchy.unassignedMembers.length > 0 && (
            <div className="bg-amber-50/40 border border-amber-200/80 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    Direct Company Personnel & Unassigned Staff ({teamHierarchy.unassignedMembers.length})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Staff and interns reporting directly to corporate administration without an assigned team lead.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-2">
                {teamHierarchy.unassignedMembers.map(member => renderMemberCard(member))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODE 3: ENTERPRISE PERSONNEL DIRECTORY GRID
      ───────────────────────────────────────────────────────────── */}
      {!isLoading && viewMode === 'grid' && (
        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Displaying {filteredEmployees.length} Personnel
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredEmployees.map(emp => renderMemberCard(emp))}
          </div>

          {filteredEmployees.length === 0 && (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
              No personnel match your search criteria.
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MEMBER INSPECTION MODAL / SLIDE-OVER DRAWER
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
            >
              {/* Clean Light Header Hero Banner */}
              <div className="relative bg-gradient-to-r from-slate-50 via-indigo-50/30 to-white p-6 border-b border-slate-200/80 text-slate-900 overflow-hidden">
                <button
                  onClick={() => setSelectedMember(null)}
                  className="absolute top-4 right-4 p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                >
                  <FiX size={16} />
                </button>

                <div className="flex items-center gap-4.5">
                  <div className="w-20 h-20 min-w-[80px] min-h-[80px] max-w-[80px] max-h-[80px] rounded-2xl p-0.5 bg-gradient-to-tr from-sky-400 to-indigo-500 shadow-sm shrink-0">
                    <div className="w-full h-full rounded-[14px] overflow-hidden bg-white flex items-center justify-center">
                      <UserAvatar
                        user={{
                          name: selectedMember.userId?.name,
                          avatar: selectedMember.profilePhoto || selectedMember.userId?.avatar
                        }}
                        className="w-full h-full"
                        imgClassName="w-full h-full object-cover object-top"
                      />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-bold font-heading text-slate-900 truncate">
                      {selectedMember.userId?.name || 'Staff Member'}
                    </h3>
                    <p className="text-xs text-secondary font-semibold truncate mt-0.5">
                      {selectedMember.designation || 'Specialist'}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border shadow-2xs flex items-center gap-1 ${
                        selectedMember.employmentType === 'intern'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-sky-50 text-sky-700 border-sky-200'
                      }`}>
                        {selectedMember.employmentType === 'intern' ? (
                          <><FiBookOpen size={11} className="text-amber-600" /> INTERN</>
                        ) : (
                          <><FiBriefcase size={11} className="text-sky-600" /> PERMANENT STAFF</>
                        )}
                      </span>
                      {selectedMember.employeeNo && (
                        <button
                          type="button"
                          onClick={() => handleCopyEmployeeId(selectedMember.employeeNo)}
                          className="text-[10px] font-mono font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors shadow-2xs"
                          title="Click to copy ID"
                        >
                          {selectedMember.employeeNo}
                          {copiedId ? <FiCheck size={10} className="text-emerald-500" /> : <FiCopy size={10} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Body Details */}
              <div className="p-6 space-y-5 text-xs max-h-[70vh] overflow-y-auto">
                {/* Reporting Chain Box */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <FiLayers size={11} /> Reporting Line & Hierarchy Chain
                  </p>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 flex-wrap">
                    <span className="text-indigo-600 font-bold">Executive Board</span>
                    <FiArrowRight size={12} className="text-slate-400" />
                    <span className="text-sky-600 font-bold">
                      {selectedMember.manager?.name || 'Direct / Independent'}
                    </span>
                    <FiArrowRight size={12} className="text-slate-400" />
                    <span className="text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                      {selectedMember.userId?.name}
                    </span>
                  </div>
                </div>

                {/* Key Employment Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-2xs">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Department</p>
                    <p className="font-bold text-slate-800 mt-0.5 truncate">{selectedMember.department || '—'}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-2xs">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Branch</p>
                    <p className="font-bold text-slate-800 mt-0.5 truncate">{selectedMember.branch?.name || 'Headquarters'}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-2xs">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Direct Reports</p>
                    <p className="font-bold text-indigo-600 mt-0.5">
                      {directReportsMap[String(selectedMember.userId?._id)] || directReportsMap[String(selectedMember._id)] || 0} Members
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-2xs">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Joined Date</p>
                    <p className="font-bold text-slate-800 mt-0.5">
                      {selectedMember.joinedDate ? new Date(selectedMember.joinedDate).toLocaleDateString('en-LK') : '—'}
                    </p>
                  </div>
                </div>

                {/* Contact Actions */}
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Direct Communication</p>
                  <div className="flex items-center gap-2">
                    {selectedMember.userId?.email && (
                      <a
                        href={`mailto:${selectedMember.userId.email}`}
                        className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        <FiMail size={14} className="text-secondary" /> Email Staff
                      </a>
                    )}
                    {selectedMember.primaryPhone && (
                      <a
                        href={`tel:${selectedMember.primaryPhone}`}
                        className="flex-1 py-2.5 rounded-xl bg-secondary text-white font-bold flex items-center justify-center gap-2 hover:bg-secondary/90 shadow-sm transition-colors"
                      >
                        <FiPhone size={14} /> Call Direct
                      </a>
                    )}
                  </div>
                </div>

                {/* Administrative Controls */}
                {(selectedMember.manager || isAdmin) && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    {selectedMember.manager && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Remove assigned leader for ${selectedMember.userId?.name || 'this employee'}?`)) {
                            unassignLeaderMut.mutate(selectedMember._id)
                          }
                        }}
                        disabled={unassignLeaderMut.isPending}
                        className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl border border-amber-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <FiUserX size={14} /> {unassignLeaderMut.isPending ? 'Removing Leader...' : 'Remove Assigned Leader'}
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => requestDeleteEmployee(selectedMember._id)}
                        disabled={deleteEmployeeMut.isPending}
                        className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl border border-rose-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <FiTrash2 size={14} /> {deleteEmployeeMut.isPending ? 'Deleting...' : 'Permanently Delete Employee'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {employeeDeleteModal}
    </div>
  )
}
