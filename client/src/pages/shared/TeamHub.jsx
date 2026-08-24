import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import useAuthStore from '../../store/authStore'
import { mediaUrl } from '../../lib/media'
import {
  FiUsers, FiUser, FiCalendar, FiClock, FiCheckCircle, FiAlertCircle,
  FiBriefcase, FiSearch, FiPhone, FiMail,
  FiFileText, FiMessageSquare, FiLayers,
  FiShield, FiUserCheck, FiBookOpen, FiX, FiActivity,
  FiTarget, FiUserPlus, FiAward, FiTrendingUp, FiEdit2, FiPlus, FiTrash2, FiBarChart2
} from 'react-icons/fi'

function highlightMatch(text, query) {
  if (!query || !text) return text
  const safeQ = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = String(text).split(new RegExp(`(${safeQ})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <span key={i} className="font-extrabold text-secondary bg-secondary/15 rounded px-0.5">{part}</span>
      : part
  )
}

const LEAVE_STATUS_BADGE = {
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
}

const ATTENDANCE_STATUS_BADGE = {
  present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  late: 'bg-amber-50 text-amber-700 border-amber-200',
  half_day: 'bg-blue-50 text-blue-700 border-blue-200',
  short_leave: 'bg-purple-50 text-purple-700 border-purple-200',
  absent: 'bg-rose-50 text-rose-700 border-rose-200',
  leave: 'bg-indigo-50 text-indigo-700 border-indigo-200',
}

export default function TeamHub({ isManagerView = false }) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const isAdmin = user?.role === 'admin' && !isManagerView

  // Selection states
  const [selectedLeaderId, setSelectedLeaderId] = useState(isManagerView ? user?._id : 'all')
  const [selectedEmpId, setSelectedEmpId] = useState('all') // 'all' or specific employeeId
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'intern' | 'permanent'
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'details' | 'leaves' | 'attendance' | 'worklogs' | 'targets'

  // Quick Assign Modal state
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignLeaderTarget, setAssignLeaderTarget] = useState('')
  const [assignSelectedEmps, setAssignSelectedEmps] = useState([])
  const [modalLeaderSearch, setModalLeaderSearch] = useState('')
  const [modalLeaderType, setModalLeaderType] = useState('all') // 'all' | 'managers' | 'staff'
  const [modalMemberSearch, setModalMemberSearch] = useState('')
  const [modalMemberType, setModalMemberType] = useState('all') // 'all' | 'intern' | 'permanent' | 'unassigned'
  const [isChangingLeader, setIsChangingLeader] = useState(false)

  // Designate Team Leader Modal state
  const [showDesignateModal, setShowDesignateModal] = useState(false)
  const [designateSearch, setDesignateSearch] = useState('')

  // Target Modal & Filter state
  const [showTargetModal, setShowTargetModal] = useState(false)
  const [editingTarget, setEditingTarget] = useState(null)
  const [targetStatusFilter, setTargetStatusFilter] = useState('all')
  const [targetTypeFilter, setTargetTypeFilter] = useState('all')
  const [targetForm, setTargetForm] = useState({
    title: '',
    description: '',
    type: 'monthly',
    unit: 'projects',
    targetValue: '',
    achievedValue: 0,
    status: 'active',
    month: new Date().getMonth() + 1,
    quarter: Math.ceil((new Date().getMonth() + 1) / 3),
    year: new Date().getFullYear(),
    notes: '',
  })

  // Comment Modal state for work log
  const [commentLogId, setCommentLogId] = useState(null)
  const [newComment, setNewComment] = useState('')

  // Attendance Month & Year filter
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const [attMonth, setAttMonth] = useState(currentMonth)
  const [attYear, setAttYear] = useState(currentYear)

  // 1. Fetch Leaders Summary (Admin only)
  const { data: leadersSummaryData } = useQuery({
    queryKey: ['leaders-summary'],
    queryFn: () => api.get('/employees/leaders/summary').then(r => r.data),
    enabled: Boolean(isAdmin),
  })

  const leaders = useMemo(() => {
    return (leadersSummaryData?.leaders || []).filter(l => l.leader && l.leader.isActive !== false)
  }, [leadersSummaryData])

  const potentialLeaders = useMemo(() => {
    return (leadersSummaryData?.potentialLeaders || []).filter(p => p.isActive !== false)
  }, [leadersSummaryData])

  const unassignedEmployees = useMemo(() => {
    return (leadersSummaryData?.unassigned || []).filter(e => {
      const isInactive = ['inactive', 'suspended', 'former', 'terminated', 'resigned', 'intern_ended'].includes(e.status)
      const isUserInactive = e.userId?.isActive === false
      return !isInactive && !isUserInactive
    })
  }, [leadersSummaryData])

  // If in manager view and not yet selected, match current logged-in user
  const effectiveLeaderId = isManagerView ? (user?._id || '') : selectedLeaderId

  // 2. Fetch Employees (scoped to manager if in manager view)
  const { data: employeesData } = useQuery({
    queryKey: ['employees', 'team-hub', isManagerView ? user?._id : 'all'],
    queryFn: () => {
      const qs = isManagerView && user?._id ? `&manager=${user._id}` : ''
      return api.get(`/employees?assignable=1${qs}`).then(r => r.data)
    },
  })

  // Filter out any inactive/suspended/terminated members
  const allEmployees = useMemo(() => {
    const list = employeesData?.employees || []
    return list.filter(e => {
      const isInactive = ['inactive', 'suspended', 'former', 'terminated', 'resigned', 'intern_ended'].includes(e.status)
      const isUserInactive = e.userId?.isActive === false
      return !isInactive && !isUserInactive
    })
  }, [employeesData])

  // Filter employees belonging to the selected leader
  const leaderTeamEmployees = useMemo(() => {
    if (effectiveLeaderId === 'all') return allEmployees
    if (effectiveLeaderId === 'unassigned') {
      return allEmployees.filter(e => !e.manager)
    }
    return allEmployees.filter(e => {
      const mgrId = e.manager?._id || e.manager
      return String(mgrId) === String(effectiveLeaderId)
    })
  }, [allEmployees, effectiveLeaderId])

  // Filter team members based on search and type filter
  const displayedEmployees = useMemo(() => {
    return leaderTeamEmployees.filter(emp => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        emp.userId?.name?.toLowerCase().includes(q) ||
        emp.employeeNo?.toLowerCase().includes(q) ||
        emp.designation?.toLowerCase().includes(q) ||
        emp.department?.toLowerCase().includes(q)
      
      const matchType = typeFilter === 'all' ||
        (typeFilter === 'intern' ? emp.employmentType === 'intern' : emp.employmentType !== 'intern')

      return matchSearch && matchType
    })
  }, [leaderTeamEmployees, search, typeFilter])

  // Selected target leader object in assign modal
  const selectedTargetLeaderObj = useMemo(() => {
    if (!assignLeaderTarget || assignLeaderTarget === 'none') return null
    return potentialLeaders.find(p => String(p._id) === String(assignLeaderTarget)) || null
  }, [potentialLeaders, assignLeaderTarget])

  // Search & Filter leaders inside Assign Modal
  const filteredModalLeaders = useMemo(() => {
    const q = modalLeaderSearch.toLowerCase().trim()
    return potentialLeaders.filter(p => {
      const name = (p.name || '').toLowerCase()
      const desig = (p.designation || '').toLowerCase()
      const dept = (p.department || '').toLowerCase()
      const role = (p.role || '').toLowerCase()
      const isMgr = p.role === 'manager' || p.role === 'admin'
      
      const matchSearch = !q || name.includes(q) || desig.includes(q) || dept.includes(q) || role.includes(q)
      const matchType = modalLeaderType === 'all' || (modalLeaderType === 'managers' ? isMgr : !isMgr)
      return matchSearch && matchType
    })
  }, [potentialLeaders, modalLeaderSearch, modalLeaderType])

  // Search & Filter members inside Assign Modal
  const filteredModalMembers = useMemo(() => {
    const q = modalMemberSearch.toLowerCase().trim()
    return allEmployees.filter(emp => {
      const name = (emp.userId?.name || '').toLowerCase()
      const desig = (emp.designation || '').toLowerCase()
      const empNo = (emp.employeeNo || '').toLowerCase()
      const dept = (emp.department || '').toLowerCase()
      const leaderName = (emp.manager?.name || '').toLowerCase()
      
      const matchSearch = !q || name.includes(q) || desig.includes(q) || empNo.includes(q) || dept.includes(q) || leaderName.includes(q)
      
      const matchType = modalMemberType === 'all' ||
        (modalMemberType === 'intern' && emp.employmentType === 'intern') ||
        (modalMemberType === 'permanent' && emp.employmentType !== 'intern') ||
        (modalMemberType === 'unassigned' && !emp.manager)

      // Exclude employee from being assigned under themselves if they are selected as leader
      const isSelf = assignLeaderTarget && String(emp.userId?._id || emp.userId) === String(assignLeaderTarget)

      return matchSearch && matchType && !isSelf
    })
  }, [allEmployees, modalMemberSearch, modalMemberType, assignLeaderTarget])

  // Current selected employee object (if single employee is picked)
  const selectedEmployee = useMemo(() => {
    if (selectedEmpId === 'all') return null
    return allEmployees.find(e => String(e._id) === String(selectedEmpId)) || null
  }, [allEmployees, selectedEmpId])

  // 3. Fetch Leaves (for selected employee or team)
  const { data: leavesData, isLoading: loadingLeaves } = useQuery({
    queryKey: ['team-hub-leaves', selectedEmpId, effectiveLeaderId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedEmpId !== 'all') {
        params.set('employee', selectedEmpId)
      } else if (effectiveLeaderId !== 'all' && effectiveLeaderId !== 'unassigned') {
        params.set('manager', effectiveLeaderId)
      }
      const qs = params.toString()
      return api.get(`/leaves${qs ? '?' + qs : ''}`).then(r => r.data)
    },
    enabled: activeTab === 'leaves' || activeTab === 'overview',
  })
  const leavesList = leavesData?.leaves || []

  // Fetch Leave Balances for selected employee
  const { data: balanceData } = useQuery({
    queryKey: ['employee-leave-balances', selectedEmpId],
    queryFn: () => api.get(`/leaves/balance/${selectedEmpId}`).then(r => r.data),
    enabled: Boolean(selectedEmpId && selectedEmpId !== 'all'),
  })
  const leaveBalances = balanceData?.balances || {}

  // 4. Fetch Attendance (for selected employee or team)
  const { data: attendanceData, isLoading: loadingAttendance } = useQuery({
    queryKey: ['team-hub-attendance', selectedEmpId, effectiveLeaderId, attMonth, attYear],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('month', attMonth)
      params.set('year', attYear)
      if (selectedEmpId !== 'all') {
        params.set('employeeId', selectedEmpId)
      } else if (effectiveLeaderId !== 'all' && effectiveLeaderId !== 'unassigned') {
        params.set('manager', effectiveLeaderId)
      }
      return api.get(`/attendance?${params.toString()}`).then(r => r.data)
    },
    enabled: activeTab === 'attendance' || activeTab === 'overview',
  })
  const attendanceRecords = attendanceData?.records || attendanceData?.attendance || []

  // 5. Fetch Work Logs (for selected employee or team)
  const { data: workLogsData, isLoading: loadingWorkLogs } = useQuery({
    queryKey: ['team-hub-worklogs', selectedEmpId, effectiveLeaderId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedEmpId !== 'all') {
        params.set('employee', selectedEmpId)
      } else if (effectiveLeaderId !== 'all' && effectiveLeaderId !== 'unassigned') {
        params.set('manager', effectiveLeaderId)
      }
      return api.get(`/work-logs?${params.toString()}`).then(r => r.data)
    },
    enabled: activeTab === 'worklogs' || activeTab === 'overview',
  })
  const workLogsList = workLogsData?.logs || []

  // 6. Fetch Targets
  const { data: targetsData } = useQuery({
    queryKey: ['targets', selectedEmpId, effectiveLeaderId, attYear],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('year', attYear)
      if (selectedEmpId !== 'all') {
        params.set('employee', selectedEmpId)
      } else if (effectiveLeaderId !== 'all' && effectiveLeaderId !== 'unassigned') {
        params.set('manager', effectiveLeaderId)
      }
      return api.get(`/targets?${params.toString()}`).then(r => r.data)
    },
    enabled: activeTab === 'targets' || activeTab === 'overview',
  })
  const targetsList = targetsData?.targets || []

  // Mutations
  const assignLeaderMutation = useMutation({
    mutationFn: (payload) => api.post('/employees/assign-leader', payload),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Leader assigned successfully')
      qc.invalidateQueries({ queryKey: ['leaders-summary'] })
      qc.invalidateQueries({ queryKey: ['employees'] })
      setShowAssignModal(false)
      setAssignSelectedEmps([])
      setAssignLeaderTarget('')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to assign leader'),
  })

  const designateLeaderMutation = useMutation({
    mutationFn: ({ userId }) => api.post('/employees/designate-leader', { userId, role: 'manager' }),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Designated as Team Leader')
      setShowDesignateModal(false)
      qc.invalidateQueries({ queryKey: ['leaders-summary'] })
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to designate leader'),
  })

  const saveTargetMutation = useMutation({
    mutationFn: (payload) => {
      if (editingTarget?._id) {
        return api.put(`/targets/${editingTarget._id}`, payload)
      }
      return api.post('/targets', payload)
    },
    onSuccess: () => {
      toast.success(editingTarget ? 'Target updated' : 'Target created')
      setShowTargetModal(false)
      setEditingTarget(null)
      qc.invalidateQueries({ queryKey: ['targets'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to save target'),
  })

  const deleteTargetMutation = useMutation({
    mutationFn: (id) => api.delete(`/targets/${id}`),
    onSuccess: () => {
      toast.success('Target deleted')
      qc.invalidateQueries({ queryKey: ['targets'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete target'),
  })

  const updateLeaveStatusMutation = useMutation({
    mutationFn: ({ id, status, remarks }) => api.put(`/leaves/${id}/status`, { status, remarks }),
    onSuccess: () => {
      toast.success('Leave status updated')
      qc.invalidateQueries({ queryKey: ['team-hub-leaves'] })
      qc.invalidateQueries({ queryKey: ['employee-leave-balances'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update leave status'),
  })

  const approveWorkLogMutation = useMutation({
    mutationFn: ({ id, status }) => api.put(`/work-logs/${id}/approve`, { status }),
    onSuccess: () => {
      toast.success('Work log status updated')
      qc.invalidateQueries({ queryKey: ['team-hub-worklogs'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update work log'),
  })

  const addCommentMutation = useMutation({
    mutationFn: ({ id, comment }) => api.post(`/work-logs/${id}/comments`, { comment }),
    onSuccess: () => {
      toast.success('Comment added')
      qc.invalidateQueries({ queryKey: ['team-hub-worklogs'] })
      setCommentLogId(null)
      setNewComment('')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to add comment'),
  })

  // Quick stats calculation
  const totalTeamCount = leaderTeamEmployees.length
  const internCount = leaderTeamEmployees.filter(e => e.employmentType === 'intern').length
  const regularCount = leaderTeamEmployees.filter(e => e.employmentType !== 'intern').length

  // Quick attendance summary for this month
  const presentCount = attendanceRecords.filter(a => a.status === 'present').length
  const lateCount = attendanceRecords.filter(a => a.status === 'late').length
  const absentCount = attendanceRecords.filter(a => a.status === 'absent').length
  const pendingLeavesCount = leavesList.filter(l => l.status === 'pending').length

  const handleQuickAssignSubmit = (e) => {
    e.preventDefault()
    if (assignSelectedEmps.length === 0) {
      toast.error('Please select at least one employee')
      return
    }
    if (!assignLeaderTarget) {
      toast.error('Please choose a team leader or select "Remove Leader"')
      return
    }
    const targetMgrId = assignLeaderTarget === 'none' ? null : assignLeaderTarget
    assignLeaderMutation.mutate({
      employeeIds: assignSelectedEmps,
      managerId: targetMgrId,
    })
  }

  const toggleSelectAssignEmp = (id) => {
    setAssignSelectedEmps(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const openNewTargetModal = () => {
    setEditingTarget(null)
    setTargetForm({
      title: '',
      description: '',
      type: 'monthly',
      unit: 'projects',
      targetValue: '',
      achievedValue: 0,
      status: 'active',
      month: currentMonth,
      quarter: Math.ceil(currentMonth / 3),
      year: currentYear,
      notes: '',
    })
    setShowTargetModal(true)
  }

  const openEditTargetModal = (target) => {
    setEditingTarget(target)
    setTargetForm({
      title: target.title || '',
      description: target.description || '',
      type: target.type || 'monthly',
      unit: target.unit || 'projects',
      targetValue: target.targetValue || '',
      achievedValue: target.achievedValue || 0,
      status: target.status || 'active',
      month: target.month || currentMonth,
      quarter: target.quarter || Math.ceil(currentMonth / 3),
      year: target.year || currentYear,
      notes: target.notes || '',
    })
    setShowTargetModal(true)
  }

  const handleTargetSubmit = (e) => {
    e.preventDefault()
    if (!targetForm.title || !targetForm.targetValue) {
      toast.error('Title and target value are required')
      return
    }
    const payload = {
      ...targetForm,
      targetValue: Number(targetForm.targetValue),
      achievedValue: Number(targetForm.achievedValue || 0),
      year: Number(targetForm.year || currentYear),
      month: targetForm.type === 'monthly' ? Number(targetForm.month) : undefined,
      quarter: targetForm.type === 'quarterly' ? Number(targetForm.quarter) : undefined,
      targetLevel: selectedEmpId !== 'all' ? 'employee' : 'team',
      employee: selectedEmpId !== 'all' ? selectedEmpId : undefined,
      manager: effectiveLeaderId !== 'all' && effectiveLeaderId !== 'unassigned' ? effectiveLeaderId : (user?._id),
    }
    saveTargetMutation.mutate(payload)
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-secondary uppercase tracking-wider mb-1">
            <FiShield size={13} />
            <span>{isAdmin ? 'Administration & Team Hierarchy' : 'Leadership Workspace'}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isAdmin ? 'Team Leaders & Member Hub' : 'My Team & Members'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isAdmin
              ? 'Manage leaders, assign interns & employees, and monitor attendance, leaves, and daily work logs.'
              : 'Monitor attendance, approve leaves, review daily work logs, and manage your assigned team members.'}
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {isAdmin && (
            <>
              <button
                onClick={() => {
                  setDesignateSearch('')
                  setShowDesignateModal(true)
                }}
                className="btn-outline gap-2 shadow-sm text-xs"
              >
                <FiUserPlus size={15} /> Add Team Leader
              </button>
              <button
                onClick={() => {
                  setAssignSelectedEmps([])
                  setAssignLeaderTarget(selectedLeaderId !== 'all' && selectedLeaderId !== 'unassigned' ? selectedLeaderId : '')
                  setShowAssignModal(true)
                }}
                className="btn-primary gap-2 shadow-sm text-xs"
              >
                <FiUserCheck size={15} /> Assign Members to Leader
              </button>
            </>
          )}
          <button
            onClick={openNewTargetModal}
            className="btn-secondary gap-2 shadow-sm text-xs"
          >
            <FiTarget size={15} /> Set Target
          </button>
        </div>
      </div>

      {/* ── Leader Selector Bar (Admin View) ── */}
      {isAdmin && (
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <FiUsers size={14} className="text-secondary" /> Select Team Leader
            </h3>
            <span className="text-xs text-slate-400">
              {leaders.length} Active Leader{leaders.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {/* All Teams Button */}
            <button
              onClick={() => { setSelectedLeaderId('all'); setSelectedEmpId('all'); }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 border transition-all flex items-center gap-2 ${
                selectedLeaderId === 'all'
                  ? 'bg-secondary text-white border-secondary shadow-sm shadow-secondary/20'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <FiLayers size={14} /> All Teams ({allEmployees.length})
            </button>

            {/* Individual Leaders */}
            {leaders.map(({ leader, totalMembers, internsCount, regularCount }) => (
              <button
                key={leader._id}
                onClick={() => { setSelectedLeaderId(leader._id); setSelectedEmpId('all'); }}
                className={`px-3.5 py-2 rounded-xl text-xs shrink-0 border transition-all flex items-center gap-2.5 ${
                  String(selectedLeaderId) === String(leader._id)
                    ? 'bg-secondary text-white border-secondary shadow-sm shadow-secondary/20 font-bold'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="w-6 h-6 rounded-lg bg-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                  {leader.avatar ? (
                    <img src={mediaUrl(leader.avatar)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-[10px] text-slate-700">{leader.name?.charAt(0)}</span>
                  )}
                </div>
                <div className="text-left">
                  <p className="leading-tight truncate max-w-[130px] font-medium">{leader.name}</p>
                  <p className={`text-[10px] ${String(selectedLeaderId) === String(leader._id) ? 'text-white/80' : 'text-slate-400'}`}>
                    {totalMembers} ({internsCount} Intern{internsCount !== 1 ? 's' : ''}, {regularCount} Staff)
                  </p>
                </div>
              </button>
            ))}

            {/* Unassigned Bucket */}
            {unassignedEmployees.length > 0 && (
              <button
                onClick={() => { setSelectedLeaderId('unassigned'); setSelectedEmpId('all'); }}
                className={`px-3.5 py-2 rounded-xl text-xs shrink-0 border transition-all flex items-center gap-2 ${
                  selectedLeaderId === 'unassigned'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm font-bold'
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <FiAlertCircle size={14} />
                <span>Unassigned ({unassignedEmployees.length})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FiUsers size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-400 uppercase">Team Members</p>
            <h3 className="text-xl font-bold text-slate-800 mt-0.5">{totalTeamCount}</h3>
            <p className="text-[11px] text-slate-500 truncate">{internCount} Interns · {regularCount} Permanent</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <FiCheckCircle size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-400 uppercase">Present ({attMonth}/{attYear})</p>
            <h3 className="text-xl font-bold text-slate-800 mt-0.5">{presentCount}</h3>
            <p className="text-[11px] text-slate-500 truncate">{lateCount} Late · {absentCount} Absent</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FiCalendar size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-400 uppercase">Pending Leaves</p>
            <h3 className="text-xl font-bold text-slate-800 mt-0.5">{pendingLeavesCount}</h3>
            <p className="text-[11px] text-slate-500 truncate">{leavesList.length} Total Requests</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <FiFileText size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-400 uppercase">Work Logs</p>
            <h3 className="text-xl font-bold text-slate-800 mt-0.5">{workLogsList.length}</h3>
            <p className="text-[11px] text-slate-500 truncate">Daily logs recorded</p>
          </div>
        </div>
      </div>

      {/* ── Employee Filter & Selection Carousel ── */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Member type filter */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl max-w-fit">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                typeFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All ({leaderTeamEmployees.length})
            </button>
            <button
              onClick={() => setTypeFilter('intern')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                typeFilter === 'intern' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Interns ({leaderTeamEmployees.filter(e => e.employmentType === 'intern').length})
            </button>
            <button
              onClick={() => setTypeFilter('permanent')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                typeFilter === 'permanent' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Staff ({leaderTeamEmployees.filter(e => e.employmentType !== 'intern').length})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <FiSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search member by name, role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input !pl-9 !py-1.5 !text-xs w-full rounded-xl"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <FiX size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Member Cards Strip */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin pt-1">
          {/* "All Members" Overview Card */}
          <button
            onClick={() => setSelectedEmpId('all')}
            className={`p-3 rounded-2xl border text-left shrink-0 transition-all w-48 flex items-center gap-3 ${
              selectedEmpId === 'all'
                ? 'bg-secondary/10 border-secondary ring-2 ring-secondary/20 shadow-sm'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-secondary text-white flex items-center justify-center shrink-0 shadow-sm">
              <FiUsers size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">Entire Team</p>
              <p className="text-[10px] text-slate-500">Summary & all logs</p>
            </div>
          </button>

          {/* Individual Employee Cards */}
          {displayedEmployees.map(emp => {
            const isSelected = String(selectedEmpId) === String(emp._id)
            const isIntern = emp.employmentType === 'intern'
            return (
              <button
                key={emp._id}
                onClick={() => setSelectedEmpId(emp._id)}
                className={`p-3 rounded-2xl border text-left shrink-0 transition-all w-52 flex items-center gap-3 relative overflow-hidden ${
                  isSelected
                    ? 'bg-secondary/10 border-secondary ring-2 ring-secondary/20 shadow-sm'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center shrink-0 overflow-hidden relative">
                  {emp.profilePhoto || emp.userId?.avatar ? (
                    <img src={mediaUrl(emp.profilePhoto || emp.userId?.avatar)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-xs text-slate-600">{emp.userId?.name?.charAt(0)}</span>
                  )}
                  {isIntern && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-bold text-slate-800 truncate leading-tight">{emp.userId?.name || 'Unnamed'}</p>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{emp.designation || 'Member'}</p>
                  <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.2 rounded-md mt-1 border ${
                    isIntern ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {isIntern ? 'Intern' : 'Staff'}
                  </span>
                </div>
              </button>
            )
          })}

          {displayedEmployees.length === 0 && (
            <div className="text-center py-6 px-8 text-slate-400 text-xs w-full bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No team members match the search / filter criteria.
            </div>
          )}
        </div>
      </div>

      {/* ── Selected Employee Banner (if single employee selected) ── */}
      {selectedEmployee && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
              {selectedEmployee.profilePhoto || selectedEmployee.userId?.avatar ? (
                <img src={mediaUrl(selectedEmployee.profilePhoto || selectedEmployee.userId?.avatar)} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-white">{selectedEmployee.userId?.name?.charAt(0)}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold">{selectedEmployee.userId?.name}</h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  selectedEmployee.employmentType === 'intern'
                    ? 'bg-amber-400 text-slate-900 border-amber-300'
                    : 'bg-blue-400 text-slate-900 border-blue-300'
                }`}>
                  {selectedEmployee.employmentType === 'intern' ? '🎓 INTERN' : '💼 PERMANENT STAFF'}
                </span>
                <span className="text-xs text-slate-300 font-mono">#{selectedEmployee.employeeNo || 'EMP'}</span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {selectedEmployee.designation} · {selectedEmployee.department || 'General'} · Leader: <span className="text-white font-medium">{selectedEmployee.manager?.name || 'None'}</span>
              </p>
              {selectedEmployee.employmentType === 'intern' && selectedEmployee.internship?.university && (
                <p className="text-[11px] text-amber-200 mt-1 flex items-center gap-1">
                  <FiBookOpen size={11} /> {selectedEmployee.internship.university}
                  {selectedEmployee.internshipDaysRemaining != null && (
                    <span className="ml-1 bg-amber-500/30 px-2 py-0.2 rounded text-[10px] text-amber-200">
                      ⏳ {selectedEmployee.internshipDaysRemaining} days remaining
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {selectedEmployee.primaryPhone && (
              <a
                href={`tel:${selectedEmployee.primaryPhone}`}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <FiPhone size={12} /> {selectedEmployee.primaryPhone}
              </a>
            )}
            {selectedEmployee.userId?.email && (
              <a
                href={`mailto:${selectedEmployee.userId.email}`}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <FiMail size={12} /> Email
              </a>
            )}
            <button
              onClick={() => setSelectedEmpId('all')}
              className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-bold transition-colors ml-1"
            >
              Close View
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Main Tab Navigation ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-0.5">
        {[
          { key: 'overview', label: 'Overview & Activity', icon: FiActivity },
          { key: 'details', label: 'Profile & Details', icon: FiUser },
          { key: 'targets', label: `Targets & Goals (${targetsList.length})`, icon: FiTarget },
          { key: 'leaves', label: `Leaves (${leavesList.length})`, icon: FiCalendar },
          { key: 'attendance', label: `Attendance (${attendanceRecords.length})`, icon: FiClock },
          { key: 'worklogs', label: `Daily Work Logs (${workLogsList.length})`, icon: FiFileText },
        ].map(t => {
          const Icon = t.icon
          const isActive = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 ${
                isActive
                  ? 'border-secondary text-secondary bg-secondary/5'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon size={15} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── TAB 1: OVERVIEW & ACTIVITY ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Team / Employee Quick Profile Info */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <FiUser size={14} className="text-secondary" />
                {selectedEmployee ? 'Member Profile' : 'Team Composition'}
              </h3>

              {selectedEmployee ? (
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-400">Employee #</span>
                    <span className="font-mono font-bold text-slate-700">{selectedEmployee.employeeNo}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-400">Department</span>
                    <span className="font-medium text-slate-700">{selectedEmployee.department || '—'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-400">Designation</span>
                    <span className="font-medium text-slate-700">{selectedEmployee.designation || '—'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-400">Employment Type</span>
                    <span className="capitalize font-semibold text-secondary">{selectedEmployee.employmentType}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-400">Joined Date</span>
                    <span className="font-medium text-slate-700">
                      {selectedEmployee.joinedDate ? new Date(selectedEmployee.joinedDate).toLocaleDateString('en-LK') : '—'}
                    </span>
                  </div>
                  {selectedEmployee.employmentType === 'intern' && (
                    <>
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-400">University</span>
                        <span className="font-medium text-slate-700">{selectedEmployee.internship?.university || '—'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-400">Supervisor</span>
                        <span className="font-medium text-slate-700">{selectedEmployee.internship?.supervisorName || '—'}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Reporting Leader</span>
                    <span className="font-bold text-slate-800">{selectedEmployee.manager?.name || 'Unassigned'}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    Currently viewing the entire assigned team under this leader.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50">
                      <span className="text-slate-600 font-medium">Total Active Members</span>
                      <span className="font-bold text-slate-800">{displayedEmployees.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-amber-50">
                      <span className="text-amber-800 font-medium">Interns</span>
                      <span className="font-bold text-amber-800">{internCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-blue-50">
                      <span className="text-blue-800 font-medium">Full-time Staff</span>
                      <span className="font-bold text-blue-800">{regularCount}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Recent Pending Leaves */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <FiCalendar size={14} className="text-amber-500" /> Pending Leave Requests
                </h3>
                <button onClick={() => setActiveTab('leaves')} className="text-xs text-secondary font-semibold hover:underline">
                  View all
                </button>
              </div>

              {leavesList.filter(l => l.status === 'pending').length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl">
                  <FiCheckCircle size={28} className="mx-auto text-emerald-500 mb-2 opacity-80" />
                  No pending leave requests at the moment.
                </div>
              ) : (
                <div className="space-y-3">
                  {leavesList.filter(l => l.status === 'pending').slice(0, 3).map(l => (
                    <div key={l._id} className="p-3 rounded-xl border border-amber-200 bg-amber-50/40 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{l.employee?.userId?.name || 'Employee'}</span>
                        <span className="px-2 py-0.5 rounded-full font-semibold uppercase text-[10px] bg-amber-100 text-amber-800">
                          {l.leaveType}
                        </span>
                      </div>
                      <p className="text-slate-600">
                        📅 {new Date(l.startDate).toLocaleDateString('en-LK')} - {new Date(l.endDate).toLocaleDateString('en-LK')} ({l.days} days)
                      </p>
                      {l.reason && <p className="text-slate-500 italic">"{l.reason}"</p>}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => updateLeaveStatusMutation.mutate({ id: l._id, status: 'approved' })}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[11px] font-bold hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateLeaveStatusMutation.mutate({ id: l._id, status: 'rejected' })}
                          className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-[11px] font-bold hover:bg-rose-700"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Work Logs */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <FiFileText size={14} className="text-purple-500" /> Recent Work Logs
                </h3>
                <button onClick={() => setActiveTab('worklogs')} className="text-xs text-secondary font-semibold hover:underline">
                  View all
                </button>
              </div>

              {workLogsList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl">
                  No work logs recorded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {workLogsList.slice(0, 3).map(log => (
                    <div key={log._id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{log.employee?.userId?.name || 'Member'}</span>
                        <span className="font-mono text-slate-500 font-semibold">{log.totalHours} hrs</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {new Date(log.date).toLocaleDateString('en-LK', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                      <div className="text-slate-600">
                        {log.tasks?.slice(0, 2).map((t, idx) => (
                          <p key={idx} className="truncate">• {t.taskName}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PROFILE & DETAILS ── */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          {selectedEmployee ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Info */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
                  <FiUser className="text-secondary" /> Personal Information
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Full Name</span>
                    <span className="font-bold text-slate-800">{selectedEmployee.userId?.name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Email</span>
                    <span className="font-medium text-slate-700">{selectedEmployee.userId?.email || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Primary Phone</span>
                    <span className="font-medium text-slate-700">{selectedEmployee.primaryPhone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Secondary Phone</span>
                    <span className="font-medium text-slate-700">{selectedEmployee.secondaryPhone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">NIC / ID Number</span>
                    <span className="font-mono font-medium text-slate-700">{selectedEmployee.idNumber || selectedEmployee.nic || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Gender</span>
                    <span className="capitalize font-medium text-slate-700">{selectedEmployee.gender || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block mb-0.5">Address</span>
                    <span className="font-medium text-slate-700">{selectedEmployee.address || selectedEmployee.currentAddress || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Employment & Internship */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
                  <FiBriefcase className="text-secondary" /> Employment & Team Details
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Employee ID</span>
                    <span className="font-mono font-bold text-slate-800">{selectedEmployee.employeeNo}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Status</span>
                    <span className="font-bold capitalize text-emerald-600">{selectedEmployee.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Department</span>
                    <span className="font-semibold text-slate-800">{selectedEmployee.department || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Designation</span>
                    <span className="font-semibold text-slate-800">{selectedEmployee.designation || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Joined Date</span>
                    <span className="font-medium text-slate-700">
                      {selectedEmployee.joinedDate ? new Date(selectedEmployee.joinedDate).toLocaleDateString('en-LK') : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Assigned Leader</span>
                    <span className="font-bold text-secondary">{selectedEmployee.manager?.name || 'None'}</span>
                  </div>
                </div>

                {/* Intern-specific panel */}
                {selectedEmployee.employmentType === 'intern' && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2 mt-4">
                    <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">🎓 Internship Details</p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-amber-900">
                      <div>
                        <span className="opacity-70 block">University / School:</span>
                        <span className="font-semibold">{selectedEmployee.internship?.university || '—'}</span>
                      </div>
                      <div>
                        <span className="opacity-70 block">Supervisor:</span>
                        <span className="font-semibold">{selectedEmployee.internship?.supervisorName || '—'}</span>
                      </div>
                      <div>
                        <span className="opacity-70 block">Duration:</span>
                        <span className="font-semibold">{selectedEmployee.internship?.durationWeeks ? `${selectedEmployee.internship.durationWeeks} Weeks` : '—'}</span>
                      </div>
                      <div>
                        <span className="opacity-70 block">End Date:</span>
                        <span className="font-semibold">
                          {selectedEmployee.internship?.endDate ? new Date(selectedEmployee.internship.endDate).toLocaleDateString('en-LK') : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Emergency Contact */}
              {selectedEmployee.emergencyContact && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 col-span-1 md:col-span-2">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
                    <FiPhone className="text-secondary" /> Emergency Contact
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Contact Name</span>
                      <span className="font-bold text-slate-800">{selectedEmployee.emergencyContact.name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Phone</span>
                      <span className="font-medium text-slate-700">{selectedEmployee.emergencyContact.phone || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Relationship</span>
                      <span className="font-medium text-slate-700">{selectedEmployee.emergencyContact.relationship || '—'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
              <FiUsers size={40} className="mx-auto text-slate-300" />
              <h3 className="text-base font-bold text-slate-700">Please select an employee</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Pick a specific employee from the carousel above to view their complete personal, internship, and employment details.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: LEAVES MANAGEMENT ── */}
      {activeTab === 'leaves' && (
        <div className="space-y-6">
          {/* Leave Balances Cards (when specific employee is picked) */}
          {selectedEmployee && Object.keys(leaveBalances).length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Leave Balances Quota ({currentYear})</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {Object.entries(leaveBalances).map(([type, b]) => (
                  <div key={type} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                    <p className="text-[11px] font-bold text-slate-500 capitalize">{type.replace('_', ' ')}</p>
                    <p className="text-lg font-black text-secondary mt-0.5">{b.remaining}</p>
                    <p className="text-[10px] text-slate-400">{b.used} used / {b.quota} total</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Leaves Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                {selectedEmployee ? `${selectedEmployee.userId?.name}'s Leave Requests` : 'Team Leave Requests'}
              </h3>
              <span className="text-xs text-slate-400">{leavesList.length} total request{leavesList.length !== 1 ? 's' : ''}</span>
            </div>

            {loadingLeaves ? (
              <div className="flex justify-center py-12">
                <div className="w-7 h-7 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : leavesList.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                No leave requests found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Employee</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Dates</th>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leavesList.map(l => (
                      <tr key={l._id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">
                              {l.employee?.userId?.name?.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{l.employee?.userId?.name || '—'}</p>
                              <p className="text-[10px] text-slate-400">{l.employee?.designation}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                            {l.leaveType}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-700">
                          {new Date(l.startDate).toLocaleDateString('en-LK')} - {new Date(l.endDate).toLocaleDateString('en-LK')}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-slate-800">{l.days} Day{l.days !== 1 ? 's' : ''}</td>
                        <td className="px-4 py-3.5 text-slate-600 max-w-xs truncate">{l.reason || '—'}</td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase ${LEAVE_STATUS_BADGE[l.status] || ''}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {l.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => updateLeaveStatusMutation.mutate({ id: l._id, status: 'approved' })}
                                className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold hover:bg-emerald-700"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => updateLeaveStatusMutation.mutate({ id: l._id, status: 'rejected' })}
                                className="px-2 py-1 bg-rose-600 text-white rounded text-[11px] font-bold hover:bg-rose-700"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {l.approvedBy?.name ? `by ${l.approvedBy.name}` : 'Processed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: ATTENDANCE RECORDS ── */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* Month / Year selector & Summary */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Month</label>
                <select
                  value={attMonth}
                  onChange={(e) => setAttMonth(Number(e.target.value))}
                  className="form-select !text-xs !py-1.5 w-32"
                >
                  {[
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                  ].map((m, idx) => (
                    <option key={m} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Year</label>
                <select
                  value={attYear}
                  onChange={(e) => setAttYear(Number(e.target.value))}
                  className="form-select !text-xs !py-1.5 w-24"
                >
                  {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                Present: {presentCount}
              </span>
              <span className="text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                Late: {lateCount}
              </span>
              <span className="text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                Absent: {absentCount}
              </span>
            </div>
          </div>

          {/* Attendance Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                {selectedEmployee ? `${selectedEmployee.userId?.name}'s Attendance Log` : 'Team Attendance Log'}
              </h3>
              <span className="text-xs text-slate-400">{attendanceRecords.length} records</span>
            </div>

            {loadingAttendance ? (
              <div className="flex justify-center py-12">
                <div className="w-7 h-7 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : attendanceRecords.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                No attendance logs found for this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Employee</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Check In</th>
                      <th className="px-4 py-3">Check Out</th>
                      <th className="px-4 py-3">Worked Hours</th>
                      <th className="px-4 py-3">OT Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendanceRecords.map((att, idx) => (
                      <tr key={att._id || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-bold text-slate-800">{att.employee?.userId?.name || '—'}</p>
                          <p className="text-[10px] text-slate-400">{att.employee?.designation}</p>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {new Date(att.date).toLocaleDateString('en-LK', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${ATTENDANCE_STATUS_BADGE[att.status] || 'bg-slate-100'}`}>
                            {att.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700">
                          {att.checkIn ? new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700">
                          {att.checkOut ? new Date(att.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">
                          {att.totalWorkedHours ? `${att.totalWorkedHours} hrs` : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-amber-600 font-semibold">
                          {att.otHours ? `${att.otHours} hrs` : '0'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 5: DAILY WORK LOGS ── */}
      {activeTab === 'worklogs' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {selectedEmployee ? `${selectedEmployee.userId?.name}'s Daily Work Logs` : 'Team Daily Work Logs'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Tasks completed, hours logged, and leader reviews.</p>
              </div>
              <span className="text-xs text-slate-400">{workLogsList.length} logs submitted</span>
            </div>

            {loadingWorkLogs ? (
              <div className="flex justify-center py-12">
                <div className="w-7 h-7 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : workLogsList.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                No daily work logs found for this selection.
              </div>
            ) : (
              <div className="space-y-4">
                {workLogsList.map(log => (
                  <div key={log._id} className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/40 space-y-3 hover:border-slate-300 transition-all">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center font-bold text-sm">
                          {log.employee?.userId?.name?.charAt(0) || 'M'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{log.employee?.userId?.name || 'Member'}</p>
                          <p className="text-[11px] text-slate-400">
                            📅 {new Date(log.date).toLocaleDateString('en-LK', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          ⏱ {log.totalHours} Hours
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${
                          log.status === 'approved' || log.approvalStatus === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {log.approvalStatus || log.status}
                        </span>
                      </div>
                    </div>

                    {/* Tasks List */}
                    <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-2">
                      <p className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Tasks Done</p>
                      <div className="divide-y divide-slate-100">
                        {log.tasks?.map((t, idx) => (
                          <div key={idx} className="py-2 flex items-start justify-between gap-3 text-xs">
                            <div>
                              <p className="font-semibold text-slate-800">{t.taskName}</p>
                              {t.notes && <p className="text-slate-500 text-[11px] mt-0.5">{t.notes}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-bold text-slate-700 font-mono">{t.hours} hrs</span>
                              {t.project?.title && (
                                <span className="block text-[10px] text-secondary font-medium">{t.project.title}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Blockers */}
                    {log.blockers && (
                      <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200 text-xs text-rose-800">
                        <span className="font-bold">⚠️ Blockers Reported:</span> {log.blockers}
                      </div>
                    )}

                    {/* Action footer & Comments */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setCommentLogId(log._id); setNewComment(''); }}
                          className="text-slate-500 hover:text-secondary font-semibold flex items-center gap-1.5"
                        >
                          <FiMessageSquare size={13} /> Comments ({log.comments?.length || 0})
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {log.approvalStatus !== 'approved' && (
                          <button
                            onClick={() => approveWorkLogMutation.mutate({ id: log._id, status: 'approved' })}
                            className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 text-xs"
                          >
                            Approve Log
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Comments Thread (if open) */}
                    {commentLogId === log._id && (
                      <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 mt-2">
                        <p className="text-xs font-bold text-slate-700">Comments & Feedback</p>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {log.comments?.map((c, i) => (
                            <div key={i} className="text-xs p-2.5 rounded-lg bg-slate-50">
                              <span className="font-bold text-slate-700">{c.name || 'Leader'}: </span>
                              <span className="text-slate-600">{c.comment}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Add leader feedback or note..."
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                            className="form-input !text-xs !py-1.5 flex-1"
                          />
                          <button
                            onClick={() => addCommentMutation.mutate({ id: log._id, comment: newComment })}
                            className="btn-primary !py-1.5 !px-3 text-xs"
                          >
                            Post
                          </button>
                          <button
                            onClick={() => setCommentLogId(null)}
                            className="btn-ghost !py-1.5 !px-2 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 6: TARGETS & GOAL TRACKING ── */}
      {activeTab === 'targets' && (
        <div className="space-y-6">
          {/* Filter & Action Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Type Filter Pills */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                {[
                  { id: 'all', label: 'All Timeframes' },
                  { id: 'monthly', label: 'Monthly' },
                  { id: 'quarterly', label: 'Quarterly' },
                  { id: 'annual', label: 'Annual' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTargetTypeFilter(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      targetTypeFilter === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                {[
                  { id: 'all', label: 'All Status' },
                  { id: 'active', label: 'Active' },
                  { id: 'achieved', label: 'Achieved' },
                  { id: 'missed', label: 'Missed' },
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => setTargetStatusFilter(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      targetStatusFilter === s.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Year Selector */}
              <select
                value={attYear}
                onChange={e => setAttYear(Number(e.target.value))}
                className="form-select !py-1.5 !text-xs rounded-xl"
              >
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <option key={y} value={y}>Year {y}</option>
                ))}
              </select>
            </div>

            <button
              onClick={openNewTargetModal}
              className="btn-primary gap-2 shadow-sm text-xs"
            >
              <FiPlus size={15} /> Set New Target
            </button>
          </div>

          {/* KPI Summary Cards */}
          {(() => {
            const filteredTargets = targetsList.filter(t => {
              if (targetTypeFilter !== 'all' && t.type !== targetTypeFilter) return false
              if (targetStatusFilter !== 'all' && t.status !== targetStatusFilter) return false
              return true
            })
            const totalCount = filteredTargets.length
            const achievedCount = filteredTargets.filter(t => t.status === 'achieved').length
            const activeCount = filteredTargets.filter(t => t.status === 'active').length
            const totalTargetSum = filteredTargets.reduce((acc, t) => acc + (t.targetValue || 0), 0)
            const totalAchievedSum = filteredTargets.reduce((acc, t) => acc + (t.achievedValue || 0), 0)
            const overallRate = totalTargetSum > 0 ? Math.min(100, Math.round((totalAchievedSum / totalTargetSum) * 100)) : 0

            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <FiTarget size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase">Total Targets</p>
                      <h3 className="text-xl font-bold text-slate-800 mt-0.5">{totalCount}</h3>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <FiAward size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase">Achieved</p>
                      <h3 className="text-xl font-bold text-emerald-600 mt-0.5">{achievedCount}</h3>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <FiClock size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase">In Progress</p>
                      <h3 className="text-xl font-bold text-amber-600 mt-0.5">{activeCount}</h3>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <FiTrendingUp size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase">Completion Rate</p>
                      <h3 className="text-xl font-bold text-blue-600 mt-0.5">{overallRate}%</h3>
                    </div>
                  </div>
                </div>

                {/* Targets Grid */}
                {filteredTargets.length === 0 ? (
                  <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3 shadow-sm">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                      <FiTarget size={24} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">No targets found</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      No team or member targets set for the selected period. Click "Set New Target" to assign goals.
                    </p>
                    <button
                      onClick={openNewTargetModal}
                      className="btn-primary btn-sm gap-2 mt-2"
                    >
                      <FiPlus size={14} /> Set Target
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredTargets.map(t => {
                      const pct = t.targetValue ? Math.min(100, Math.round(((t.achievedValue || 0) / t.targetValue) * 100)) : 0
                      const isAchieved = t.status === 'achieved' || pct >= 100
                      const isMissed = t.status === 'missed'
                      const isCurrency = t.unit?.toLowerCase() === 'lkr' || t.unit?.toLowerCase() === 'usd'
                      const unitLabel = isCurrency ? t.unit.toUpperCase() : t.unit

                      return (
                        <div
                          key={t._id}
                          className={`bg-white p-5 rounded-2xl border transition-all shadow-sm flex flex-col justify-between space-y-4 ${
                            isAchieved ? 'border-emerald-200/80 bg-emerald-50/10' : isMissed ? 'border-rose-200 bg-rose-50/10' : 'border-slate-200'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                  t.type === 'monthly' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                  t.type === 'quarterly' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                  'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {t.type} {t.month ? `· Month ${t.month}` : t.quarter ? `· Q${t.quarter}` : ''} {t.year}
                                </span>
                                <h4 className="text-sm font-bold text-slate-800 mt-2">{t.title}</h4>
                                {t.description && (
                                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.description}</p>
                                )}
                              </div>
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                                isAchieved ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                isMissed ? 'bg-rose-100 text-rose-800 border-rose-300' :
                                'bg-amber-100 text-amber-800 border-amber-300'
                              }`}>
                                {isAchieved ? '🏆 Achieved' : isMissed ? '❌ Missed' : '⏳ In Progress'}
                              </span>
                            </div>

                            {/* Target Progress Bar & Counter */}
                            <div className="mt-4 space-y-2">
                              <div className="flex justify-between items-baseline text-xs font-medium">
                                <span className="text-slate-500">Progress</span>
                                <span className="font-bold text-slate-800">
                                  {isCurrency ? `${unitLabel} ${Number(t.achievedValue || 0).toLocaleString()}` : `${t.achievedValue || 0} ${unitLabel}`}
                                  <span className="text-slate-400 font-normal"> / </span>
                                  {isCurrency ? `${unitLabel} ${Number(t.targetValue).toLocaleString()}` : `${t.targetValue} ${unitLabel}`}
                                  <span className="ml-1.5 font-bold text-secondary font-mono">({pct}%)</span>
                                </span>
                              </div>

                              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isAchieved ? 'bg-emerald-500' : isMissed ? 'bg-rose-500' : 'bg-secondary'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>

                            {/* Assigned Scope */}
                            <div className="mt-3 text-[11px] text-slate-400 flex items-center gap-1.5">
                              <span>Scope:</span>
                              {t.employee ? (
                                <span className="font-semibold text-slate-700">👤 {t.employee.userId?.name || 'Member'}</span>
                              ) : t.manager ? (
                                <span className="font-semibold text-purple-700">👑 {t.manager.name}'s Team</span>
                              ) : (
                                <span className="font-semibold text-slate-700">🏢 Organization</span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                            <div className="flex items-center gap-1.5">
                              {!isAchieved && (
                                <button
                                  onClick={() => {
                                    const nextVal = (t.achievedValue || 0) + 1
                                    saveTargetMutation.mutate({
                                      ...t,
                                      achievedValue: nextVal,
                                      status: nextVal >= t.targetValue ? 'achieved' : t.status,
                                    })
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors"
                                >
                                  +1 {unitLabel}
                                </button>
                              )}
                              {!isAchieved && (
                                <button
                                  onClick={() => {
                                    saveTargetMutation.mutate({
                                      ...t,
                                      achievedValue: t.targetValue,
                                      status: 'achieved',
                                    })
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-[11px] transition-colors"
                                >
                                  Mark Complete
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditTargetModal(t)}
                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                                title="Edit Target"
                              >
                                <FiEdit2 size={13} />
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm(`Delete target "${t.title}"?`)) {
                                    deleteTargetMutation.mutate(t._id)
                                  }
                                }}
                                className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500 transition-colors"
                                title="Delete Target"
                              >
                                <FiTrash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* ── Designate Team Leader Modal (Admin only) ── */}
      {showDesignateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <FiUserPlus className="text-secondary" /> Add Team Leader
                </h3>
                <p className="text-xs text-slate-400">Search and designate an employee as a Team Leader / Manager.</p>
              </div>
              <button onClick={() => setShowDesignateModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                <FiX size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="relative">
                <FiSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff by name, email, department, role..."
                  value={designateSearch}
                  onChange={e => setDesignateSearch(e.target.value)}
                  className="form-input !pl-9 !py-2 !text-xs w-full rounded-xl"
                />
              </div>

              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50/50">
                {allEmployees
                  .filter(e => {
                    const q = designateSearch.toLowerCase()
                    const name = e.userId?.name?.toLowerCase() || ''
                    const email = e.userId?.email?.toLowerCase() || ''
                    const desig = e.designation?.toLowerCase() || ''
                    const dept = e.department?.toLowerCase() || ''
                    return !q || name.includes(q) || email.includes(q) || desig.includes(q) || dept.includes(q)
                  })
                  .map(emp => {
                    const isLeader = emp.userId?.role === 'manager' || emp.userId?.role === 'admin'
                    return (
                      <div key={emp._id} className="p-3 bg-white flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-slate-200 flex items-center justify-center shrink-0 font-bold text-xs text-slate-700">
                            {emp.userId?.name?.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{emp.userId?.name}</p>
                            <p className="text-[11px] text-slate-400 truncate">{emp.designation || 'Staff'} · {emp.department || 'General'}</p>
                          </div>
                        </div>

                        {isLeader ? (
                          <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2.5 py-1 rounded-full border border-purple-200 shrink-0">
                            👑 Active Leader
                          </span>
                        ) : (
                          <button
                            onClick={() => designateLeaderMutation.mutate({ userId: emp.userId?._id })}
                            disabled={designateLeaderMutation.isPending}
                            className="btn-primary !py-1 !px-3 text-xs shrink-0"
                          >
                            Designate as Leader
                          </button>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Set / Edit Target Modal ── */}
      {showTargetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <FiTarget className="text-secondary" /> {editingTarget ? 'Edit Target' : 'Set Team / Member Target'}
                </h3>
                <p className="text-xs text-slate-400">Define milestone, delivery, or revenue targets.</p>
              </div>
              <button onClick={() => setShowTargetModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                <FiX size={16} />
              </button>
            </div>

            <form onSubmit={handleTargetSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="form-label font-bold text-xs">Target Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3 Mobile App Deliveries, Monthly Revenue LKR 1.5M"
                  value={targetForm.title}
                  onChange={e => setTargetForm(f => ({ ...f, title: e.target.value }))}
                  className="form-input text-xs"
                />
              </div>

              <div>
                <label className="form-label font-bold text-xs">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Additional context or milestone deliverables..."
                  value={targetForm.description}
                  onChange={e => setTargetForm(f => ({ ...f, description: e.target.value }))}
                  className="form-input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label font-bold text-xs">Timeframe Type</label>
                  <select
                    value={targetForm.type}
                    onChange={e => setTargetForm(f => ({ ...f, type: e.target.value }))}
                    className="form-select text-xs"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>

                <div>
                  <label className="form-label font-bold text-xs">Unit Type</label>
                  <select
                    value={targetForm.unit}
                    onChange={e => setTargetForm(f => ({ ...f, unit: e.target.value }))}
                    className="form-select text-xs"
                  >
                    <option value="projects">Projects Delivered</option>
                    <option value="orders">Client Orders</option>
                    <option value="tasks">Tasks / Sprints</option>
                    <option value="LKR">Revenue (LKR)</option>
                    <option value="USD">Revenue (USD)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {targetForm.type === 'monthly' && (
                  <div>
                    <label className="form-label font-bold text-xs">Target Month</label>
                    <select
                      value={targetForm.month}
                      onChange={e => setTargetForm(f => ({ ...f, month: Number(e.target.value) }))}
                      className="form-select text-xs"
                    >
                      {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, idx) => (
                        <option key={idx + 1} value={idx + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}

                {targetForm.type === 'quarterly' && (
                  <div>
                    <label className="form-label font-bold text-xs">Target Quarter</label>
                    <select
                      value={targetForm.quarter}
                      onChange={e => setTargetForm(f => ({ ...f, quarter: Number(e.target.value) }))}
                      className="form-select text-xs"
                    >
                      <option value={1}>Q1 (Jan - Mar)</option>
                      <option value={2}>Q2 (Apr - Jun)</option>
                      <option value={3}>Q3 (Jul - Sep)</option>
                      <option value={4}>Q4 (Oct - Dec)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="form-label font-bold text-xs">Target Year</label>
                  <select
                    value={targetForm.year}
                    onChange={e => setTargetForm(f => ({ ...f, year: Number(e.target.value) }))}
                    className="form-select text-xs"
                  >
                    {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label font-bold text-xs">Target Goal Value *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 10, 1500000"
                    value={targetForm.targetValue}
                    onChange={e => setTargetForm(f => ({ ...f, targetValue: e.target.value }))}
                    className="form-input text-xs"
                  />
                </div>

                <div>
                  <label className="form-label font-bold text-xs">Current Achieved Value</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 5"
                    value={targetForm.achievedValue}
                    onChange={e => setTargetForm(f => ({ ...f, achievedValue: e.target.value }))}
                    className="form-input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="form-label font-bold text-xs">Target Status</label>
                <select
                  value={targetForm.status}
                  onChange={e => setTargetForm(f => ({ ...f, status: e.target.value }))}
                  className="form-select text-xs"
                >
                  <option value="active">Active (In Progress)</option>
                  <option value="achieved">Achieved</option>
                  <option value="partial">Partial</option>
                  <option value="missed">Missed</option>
                </select>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTargetModal(false)}
                  className="btn-ghost flex-1 justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveTargetMutation.isPending}
                  className="btn-primary flex-1 justify-center"
                >
                  {saveTargetMutation.isPending ? 'Saving...' : editingTarget ? 'Update Target' : 'Save Target'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── Quick Assign Modal (Admin only) ── */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">Assign Members to Leader</h3>
                <p className="text-xs text-slate-400">Select employees/interns and designate their reporting leader.</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                <FiX size={16} />
              </button>
            </div>

            <form onSubmit={handleQuickAssignSubmit} className="p-5 space-y-5 overflow-y-auto flex-1">
              {/* ── 1. Target Leader Selection (Searchable) ── */}
              <div className="space-y-2">
                <label className="form-label mb-0 flex items-center justify-between">
                  <span className="font-bold text-slate-800">1. Target Team Leader / Manager *</span>
                  {selectedTargetLeaderObj && (
                    <span className="text-[10px] text-secondary font-bold">Selected</span>
                  )}
                </label>

                {/* Selected Leader Card or Unassigned Card */}
                {assignLeaderTarget && !isChangingLeader ? (
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${
                    assignLeaderTarget === 'none'
                      ? 'border-rose-200 bg-rose-50/50'
                      : 'border-secondary/30 bg-secondary/5'
                  }`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0 ${
                        assignLeaderTarget === 'none' ? 'bg-rose-500' : 'bg-secondary'
                      }`}>
                        {assignLeaderTarget === 'none' ? '❌' : (selectedTargetLeaderObj?.name || 'L').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {assignLeaderTarget === 'none' ? 'Remove Leader (Mark as Independent / Unassigned)' : selectedTargetLeaderObj?.name}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {assignLeaderTarget === 'none' ? 'Members will have no assigned leader' : `${selectedTargetLeaderObj?.designation || selectedTargetLeaderObj?.role || 'Leader'} · ${selectedTargetLeaderObj?.department || 'General'}`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsChangingLeader(true)}
                      className="text-xs font-semibold text-secondary hover:underline px-2.5 py-1 rounded-lg hover:bg-secondary/10 shrink-0"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    {/* Search Input for Leaders */}
                    <div className="relative">
                      <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search leader by name, designation, department..."
                        value={modalLeaderSearch}
                        onChange={e => setModalLeaderSearch(e.target.value)}
                        className="form-input !pl-8 !py-1.5 !text-xs w-full bg-white"
                      />
                      {modalLeaderSearch && (
                        <button
                          type="button"
                          onClick={() => setModalLeaderSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <FiX size={12} />
                        </button>
                      )}
                    </div>

                    {/* Filter Pills for Leaders */}
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                      {[
                        { id: 'all', label: `All (${potentialLeaders.length})` },
                        { id: 'managers', label: `Managers (${potentialLeaders.filter(p => p.role === 'manager' || p.role === 'admin').length})` },
                        { id: 'staff', label: `Staff Leads (${potentialLeaders.filter(p => p.role !== 'manager' && p.role !== 'admin').length})` },
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setModalLeaderType(t.id)}
                          className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold transition-all shrink-0 ${
                            modalLeaderType === t.id
                              ? 'bg-secondary text-white'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Leaders List */}
                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-lg">
                      {/* Unassign Option */}
                      <button
                        type="button"
                        onClick={() => { setAssignLeaderTarget('none'); setIsChangingLeader(false); }}
                        className={`w-full text-left p-2.5 hover:bg-rose-50/50 flex items-center justify-between text-xs text-rose-600 font-semibold transition-colors ${
                          assignLeaderTarget === 'none' ? 'bg-rose-50' : ''
                        }`}
                      >
                        <span>❌ Remove Leader (Mark Unassigned)</span>
                        {assignLeaderTarget === 'none' && (
                          <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">Selected</span>
                        )}
                      </button>

                      {filteredModalLeaders.length === 0 ? (
                        <p className="p-3 text-center text-xs text-slate-400">No leaders matching "{modalLeaderSearch}"</p>
                      ) : (
                        filteredModalLeaders.map(p => {
                          const isSelected = String(assignLeaderTarget) === String(p._id)
                          const isMgr = p.role === 'manager' || p.role === 'admin'
                          return (
                            <button
                              key={p._id}
                              type="button"
                              onClick={() => { setAssignLeaderTarget(p._id); setIsChangingLeader(false); }}
                              className={`w-full text-left p-2 hover:bg-secondary/5 flex items-center justify-between transition-colors ${
                                isSelected ? 'bg-secondary/10 border-l-2 border-secondary' : ''
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <p className="text-xs font-bold text-slate-800 truncate">
                                  {isMgr ? '👑 ' : '👤 '}
                                  {highlightMatch(p.name, modalLeaderSearch)}
                                </p>
                                <p className="text-[10px] text-slate-500 truncate">
                                  {highlightMatch(p.designation || p.role || 'Staff', modalLeaderSearch)} · {highlightMatch(p.department || 'General', modalLeaderSearch)}
                                </p>
                              </div>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                isMgr ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {isMgr ? 'Manager' : 'Staff Lead'}
                              </span>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── 2. Team Members Selection (Searchable) ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="form-label mb-0 font-bold text-slate-800">
                    2. Select Team Members ({assignSelectedEmps.length} selected)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const matchingIds = filteredModalMembers.map(e => e._id)
                        setAssignSelectedEmps(prev => Array.from(new Set([...prev, ...matchingIds])))
                      }}
                      className="text-[11px] text-secondary font-bold hover:underline"
                    >
                      Select All Matching ({filteredModalMembers.length})
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => setAssignSelectedEmps([])}
                      className="text-[11px] text-slate-400 hover:text-slate-600 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Member Search Bar & Category Filter Pills */}
                <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="relative">
                    <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Type to filter members by name, role, intern, ID..."
                      value={modalMemberSearch}
                      onChange={e => setModalMemberSearch(e.target.value)}
                      className="form-input !pl-8 !py-1.5 !text-xs w-full bg-white"
                    />
                    {modalMemberSearch && (
                      <button
                        type="button"
                        onClick={() => setModalMemberSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <FiX size={12} />
                      </button>
                    )}
                  </div>

                  <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                    {[
                      { id: 'all', label: `All (${allEmployees.length})` },
                      { id: 'intern', label: `Interns (${allEmployees.filter(e => e.employmentType === 'intern').length})` },
                      { id: 'permanent', label: `Staff (${allEmployees.filter(e => e.employmentType !== 'intern').length})` },
                      { id: 'unassigned', label: `Unassigned (${allEmployees.filter(e => !e.manager).length})` },
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setModalMemberType(t.id)}
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold transition-all shrink-0 ${
                          modalMemberType === t.id
                            ? 'bg-secondary text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Members Checkbox List */}
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-52 overflow-y-auto bg-white">
                    {filteredModalMembers.length === 0 ? (
                      <p className="p-4 text-center text-xs text-slate-400">
                        No team members matching "{modalMemberSearch}"
                      </p>
                    ) : (
                      filteredModalMembers.map(emp => {
                        const isChecked = assignSelectedEmps.includes(emp._id)
                        const isIntern = emp.employmentType === 'intern'
                        return (
                          <label
                            key={emp._id}
                            className={`flex items-center justify-between p-2.5 cursor-pointer hover:bg-slate-50 transition-colors ${
                              isChecked ? 'bg-secondary/5' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectAssignEmp(emp._id)}
                                className="rounded text-secondary focus:ring-secondary shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate">
                                  {highlightMatch(emp.userId?.name || '', modalMemberSearch)}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {highlightMatch(emp.designation || '', modalMemberSearch)} · Leader: <span className="font-semibold text-slate-600">{emp.manager?.name || 'None'}</span>
                                </p>
                              </div>
                            </div>

                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                              isIntern ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {isIntern ? 'Intern' : 'Staff'}
                            </span>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="btn-ghost flex-1 justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignLeaderMutation.isPending || assignSelectedEmps.length === 0}
                  className="btn-primary flex-1 justify-center"
                >
                  {assignLeaderMutation.isPending ? 'Assigning...' : `Assign ${assignSelectedEmps.length} Members`}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
