import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../lib/api'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'
import {
  FiFolder, FiCalendar, FiTrendingUp, FiClock, FiCheckSquare,
  FiAlertCircle, FiChevronDown, FiChevronUp, FiUsers, FiFlag,
  FiCode, FiSearch, FiCheckCircle, FiExternalLink, FiUserPlus
} from 'react-icons/fi'

const STATUS_COLOR = {
  planning:  'badge-gray',
  active:    'badge-green',
  on_hold:   'badge-yellow',
  completed: 'badge-blue',
  paid_completed: 'badge-green',
  cancelled: 'badge-red',
}

const PRIORITY_COLOR = {
  low:      'text-slate-500 bg-slate-50',
  medium:   'text-amber-600 bg-amber-50',
  high:     'text-orange-600 bg-orange-50',
  critical: 'text-red-700 bg-red-50',
}

const TASK_STATUS = {
  todo:        { label: 'To Do',      color: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  review:      { label: 'In Review',   color: 'bg-amber-100 text-amber-700' },
  done:        { label: 'Done',        color: 'bg-emerald-100 text-emerald-700' },
}

function daysLeft(deadline) {
  if (!deadline) return null
  const diff = Math.ceil((new Date(deadline) - Date.now()) / 86400000)
  return diff
}

export default function DeveloperProjects() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['developer-projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  })
  const projects = data?.projects || []

  const taskUpdateMut = useMutation({
    mutationFn: ({ projectId, taskId, status }) =>
      api.put(`/projects/${projectId}/tasks/${taskId}`, { status }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['developer-projects'] }); toast.success('Task updated') },
    onError: e => toast.error(e.response?.data?.message || 'Failed to update task'),
  })

  const completeMut = useMutation({
    mutationFn: ({ projectId, status, progress }) =>
      api.put(`/projects/${projectId}`, {
        status,
        progress,
        ...(status === 'completed' ? { completedDate: new Date() } : {})
      }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer-projects'] })
      qc.invalidateQueries({ queryKey: ['admin-projects'] })
      toast.success('Project status updated successfully!')
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed to update project status')
  })

  const filtered = useMemo(() => {
    let list = projects
    if (statusFilter !== 'all') list = list.filter(p => p.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(p => p.title.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))
    }
    return list
  }, [projects, statusFilter, search])

  // Summary KPIs
  const active    = projects.filter(p => p.status === 'active').length
  const completed = projects.filter(p => p.status === 'completed').length
  const overdue   = projects.filter(p => p.deadline && p.status !== 'completed' && new Date(p.deadline) < new Date()).length
  const avgProgress = projects.length ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length) : 0

  const myTasks = (p) => (p.tasks || []).filter(t =>
    t.assignedTo && (
      (typeof t.assignedTo === 'object' ? t.assignedTo._id : t.assignedTo) === user?._id ||
      t.assignedTo?.userId === user?._id
    )
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Projects</h1>
          <p className="page-subtitle">Track progress, tasks, and delivery milestones for your assigned projects.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active',     val: active,      color: 'kpi-green',  icon: FiFolder },
          { label: 'Completed',  val: completed,   color: 'kpi-blue',   icon: FiCheckSquare },
          { label: 'Overdue',    val: overdue,      color: overdue > 0 ? 'kpi-orange' : 'kpi-gray', icon: FiAlertCircle },
          { label: 'Avg Progress', val: `${avgProgress}%`, color: 'kpi-navy', icon: FiTrendingUp },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className={`kpi-card ${k.color}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">{k.label}</p>
                <p className="text-2xl font-black text-primary mt-1">{k.val}</p>
              </div>
              <k.icon size={18} className="text-slate-300 mt-1" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search projects..." className="form-input !pl-10 w-full" />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {['all', 'active', 'planning', 'on_hold', 'completed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${statusFilter === s ? 'bg-white shadow text-secondary' : 'text-slate-500 hover:text-slate-700'}`}>
              {s === 'all' ? `All (${projects.length})` : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Project list */}
      {isLoading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <FiFolder size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">{search || statusFilter !== 'all' ? 'No matching projects' : 'No projects assigned yet.'}</p>
          {(search || statusFilter !== 'all') && (
            <button onClick={() => { setSearch(''); setStatusFilter('all') }} className="btn-ghost btn-sm mt-3">Clear filters</button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((p, i) => {
            const dl = daysLeft(p.deadline)
            const isExpanded = expandedId === p._id
            const myTsk = myTasks(p)
            const doneTasks = myTsk.filter(t => t.status === 'done').length
            const overdueBadge = dl !== null && dl < 0 && p.status !== 'completed'
            const urgentBadge  = dl !== null && dl >= 0 && dl <= 3 && p.status !== 'completed'

            return (
              <motion.div key={p._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`card overflow-hidden border transition-all ${isExpanded ? 'border-secondary/30 shadow-md' : 'border-slate-100 hover:border-secondary/20 hover:shadow-sm'}`}>
                <div className="p-5">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                      <FiFolder size={18} className="text-secondary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-bold text-primary font-heading">{p.title}</h3>
                        <span className={`badge capitalize text-xs ${STATUS_COLOR[p.status] || 'badge-gray'}`}>{p.status?.replace('_',' ')}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${PRIORITY_COLOR[p.priority] || PRIORITY_COLOR.medium}`}>
                          {p.priority}
                        </span>
                        {overdueBadge && <span className="badge bg-red-100 text-red-700 border-red-200 text-xs flex items-center gap-1"><FiAlertCircle size={10} /> {Math.abs(dl)}d overdue</span>}
                        {urgentBadge && <span className="badge bg-amber-100 text-amber-700 border-amber-200 text-xs flex items-center gap-1"><FiClock size={10} /> {dl}d left</span>}
                      </div>

                      {p.description && <p className="text-sm text-slate-500 mb-3 leading-relaxed line-clamp-2">{p.description}</p>}

                      {/* Progress bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span className="font-medium">Progress</span>
                          <span className="font-bold text-secondary">{p.progress || 0}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${p.progress || 0}%` }} transition={{ duration: 0.8, delay: i * 0.05 + 0.2 }}
                            className={`h-full rounded-full ${p.progress >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-secondary to-blue-500'}`} />
                        </div>
                      </div>

                      {/* Meta info */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        {p.deadline && <span className="flex items-center gap-1"><FiCalendar size={11} /> Due {new Date(p.deadline).toLocaleDateString('en-LK')}</span>}
                        {p.technologies?.length > 0 && <span className="flex items-center gap-1"><FiCode size={11} /> {p.technologies.slice(0,3).join(', ')}{p.technologies.length > 3 ? ` +${p.technologies.length - 3}` : ''}</span>}
                        {myTsk.length > 0 && <span className="flex items-center gap-1"><FiCheckSquare size={11} /> {doneTasks}/{myTsk.length} my tasks done</span>}
                        {p.assignedEmployees?.length > 0 && (
                          <span className="flex items-center gap-1 text-slate-500 font-medium">
                            <FiUsers size={11} /> {p.assignedEmployees.length} team members
                          </span>
                        )}
                      </div>

                      {/* Quick Actions for Developer / PM */}
                      <div className="flex items-center gap-2 pt-3 mt-3 border-t border-slate-100 flex-wrap">
                        {!['completed', 'paid_completed'].includes(p.status) ? (
                          <button
                            type="button"
                            onClick={() => completeMut.mutate({ projectId: p._id, status: 'completed', progress: 100 })}
                            disabled={completeMut.isPending}
                            className="btn-primary btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 text-xs py-1 px-2.5 shadow-xs"
                          >
                            <FiCheckCircle size={13} /> Complete Project (100%)
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1 border border-emerald-200">
                            <FiCheckCircle size={12} /> 100% Completed
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => navigate(`/${user?.role || 'developer'}/projects/${p._id}`)}
                          className="btn-outline btn-sm text-xs font-semibold text-secondary hover:bg-blue-50 py-1 px-2.5 gap-1"
                        >
                          <FiExternalLink size={12} /> View Project & Team
                        </button>
                      </div>
                    </div>

                    {/* Expand button */}
                    <button onClick={() => setExpandedId(isExpanded ? null : p._id)}
                      className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-secondary transition-colors self-start shrink-0">
                      {isExpanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                    </button>
                  </div>

                  {/* Milestones */}
                  {p.milestones?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-50">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Milestones</p>
                      <div className="flex flex-wrap gap-2">
                        {p.milestones.map((m, mi) => (
                          <div key={mi} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${m.completed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${m.completed ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            {m.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Expanded tasks */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-slate-100 bg-slate-50">
                      <div className="p-5">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <FiCheckSquare size={12} /> My Assigned Tasks
                          {myTsk.length > 0 && <span className="badge badge-blue text-xs">{doneTasks}/{myTsk.length} done</span>}
                        </h4>
                        {myTsk.length === 0 ? (
                          <p className="text-sm text-slate-400 py-2">No tasks directly assigned to you in this project.</p>
                        ) : (
                          <div className="space-y-2">
                            {myTsk.map(task => {
                              const taskStatus = TASK_STATUS[task.status] || TASK_STATUS.todo
                              const taskDue = daysLeft(task.dueDate)
                              return (
                                <div key={task._id} className={`flex items-center gap-3 p-3 rounded-xl border ${task.status === 'done' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-slate-200'}`}>
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${taskStatus.color}`}>
                                    <FiCheckSquare size={13} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</p>
                                    {task.dueDate && <p className={`text-xs mt-0.5 ${taskDue < 0 ? 'text-red-500' : 'text-slate-400'}`}><FiCalendar size={10} className="inline mr-1" />{new Date(task.dueDate).toLocaleDateString('en-LK')}</p>}
                                  </div>
                                  <select value={task.status} onChange={e => taskUpdateMut.mutate({ projectId: p._id, taskId: task._id, status: e.target.value })}
                                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 focus:outline-none focus:border-secondary">
                                    {Object.entries(TASK_STATUS).map(([v, cfg]) => <option key={v} value={v}>{cfg.label}</option>)}
                                  </select>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* All project tasks summary */}
                        {(p.tasks || []).length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">All Project Tasks</p>
                            <div className="grid grid-cols-4 gap-2">
                              {Object.entries(TASK_STATUS).map(([status, cfg]) => {
                                const count = (p.tasks || []).filter(t => t.status === status).length
                                return (
                                  <div key={status} className={`text-center p-2 rounded-xl ${cfg.color}`}>
                                    <p className="text-lg font-bold">{count}</p>
                                    <p className="text-[10px] font-medium">{cfg.label}</p>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
