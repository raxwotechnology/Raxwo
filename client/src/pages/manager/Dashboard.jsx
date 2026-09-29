import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import useAuthStore from '../../store/authStore'
import UserAvatar from '../../components/ui/UserAvatar'
import { formatMoney } from '../../lib/currencies'
import {
  FiUsers, FiFolder, FiCheckSquare, FiFileText, FiBarChart2, FiAlertTriangle,
  FiArrowRight, FiCalendar, FiActivity, FiClipboard, FiDollarSign, FiCreditCard,
  FiTrendingUp, FiClock, FiShield, FiEdit3, FiLayers, FiCheckCircle, FiXCircle
} from 'react-icons/fi'

const QuickLink = ({ to, icon: Icon, label, color }) => (
  <Link
    to={to}
    className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm font-medium text-slate-700 transition-all duration-150 ${color} hover:shadow-sm`}
  >
    <Icon size={16} className="shrink-0" />
    <span className="truncate">{label}</span>
    <FiArrowRight size={12} className="ml-auto opacity-40 shrink-0" />
  </Link>
)

export default function ManagerDashboard() {
  const { user } = useAuthStore()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['manager-dashboard-metrics'],
    queryFn: () => api.get('/system-metrics/manager-dashboard').then(r => r.data),
    refetchInterval: 30000,
    staleTime: 15000,
  })

  const kpis = data?.kpis || {}
  const attendance = data?.attendance || {}
  const projects = data?.projects || []
  const pendingActions = data?.pendingActions || {}

  const pendingLeaves = kpis.pendingLeavesCount || 0
  const pendingLogs = kpis.pendingWorkLogsCount || 0
  const pendingRequests = kpis.pendingRequestsCount || 0
  const overdueProjects = kpis.overdueProjects || 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* ── Welcome Banner ── */}
      <div className="bg-gradient-hero rounded-2xl p-6 sm:p-7 relative overflow-hidden shadow-sm">
        <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white/90 text-xs font-semibold uppercase tracking-wider">
              Project Manager Workspace
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-heading mt-2">
              Welcome back, {user?.name} 👋
            </h1>
            <p className="text-white/70 text-sm mt-1">
              Here is your project status, team attendance, and earnings summary for today.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap shrink-0">
            <Link to="/manager/projects" className="btn-secondary btn-sm shadow-sm flex items-center gap-1.5">
              <FiFolder size={14} /> My Projects
            </Link>
            <Link to="/manager/attendance" className="btn-outline btn-sm !bg-white/10 !text-white !border-white/20 hover:!bg-white/20 flex items-center gap-1.5">
              <FiClipboard size={14} /> Attendance
            </Link>
          </div>
        </div>
      </div>

      {/* ── Section: Earnings & Project Financials ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <FiDollarSign className="text-secondary" /> Project Financials &amp; Earnings
          </p>
          <span className="text-xs text-slate-400">Scoped to your assigned projects &amp; team</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            {
              label: 'Projects Managed',
              val: `${kpis.totalProjects ?? 0}`,
              sub: `${kpis.activeProjects ?? 0} active · ${kpis.completedProjects ?? 0} done`,
              icon: FiFolder,
              accent: '#2563eb',
              bg: 'bg-blue-50 text-blue-700',
            },
            {
              label: 'Total Project Value',
              val: formatMoney(kpis.totalBudget || 0),
              sub: 'Allocated budget',
              icon: FiTrendingUp,
              accent: '#059669',
              bg: 'bg-emerald-50 text-emerald-700',
            },
            {
              label: 'Payments Received',
              val: formatMoney(kpis.totalPaid || 0),
              sub: 'Collected on projects',
              icon: FiCheckCircle,
              accent: '#16a34a',
              bg: 'bg-green-50 text-green-700',
            },
            {
              label: 'Pending Payments',
              val: formatMoney(kpis.pendingPayments || 0),
              sub: 'Remaining to collect',
              icon: FiAlertTriangle,
              accent: '#ea580c',
              bg: 'bg-amber-50 text-amber-700',
              alert: (kpis.pendingPayments || 0) > 0,
            },
            {
              label: 'My Advance Balance',
              val: formatMoney(kpis.managerAdvanceBalance || 0),
              sub: `Taken: ${formatMoney(kpis.managerAdvanceTotal || 0)}`,
              icon: FiCreditCard,
              accent: '#8b5cf6',
              bg: 'bg-purple-50 text-purple-700',
              alert: (kpis.managerAdvanceBalance || 0) > 0,
            },
            {
              label: 'Team Members',
              val: `${kpis.totalTeamMembers ?? 0}`,
              sub: 'Under your hierarchy',
              icon: FiUsers,
              accent: '#06b6d4',
              bg: 'bg-cyan-50 text-cyan-700',
            },
          ].map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`card card-body relative overflow-hidden ${c.alert ? 'border-amber-200 ring-1 ring-amber-300' : ''}`}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: c.accent }} />
              <div className="pl-2">
                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">{c.label}</p>
                <p className="text-xl font-bold text-slate-900 font-heading mt-1">{c.val}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">{c.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Pending Action Alerts ── */}
      {(pendingLeaves > 0 || pendingLogs > 0 || pendingRequests > 0 || overdueProjects > 0) && (
        <div className="card card-body space-y-2.5 border-amber-200/80 bg-amber-50/20">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
            <FiAlertTriangle size={16} className="text-amber-500" /> Pending Approvals &amp; Alerts
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {pendingLeaves > 0 && (
              <Link
                to="/manager/leaves"
                className="flex items-center gap-3 p-3 bg-white border border-amber-200 rounded-xl hover:bg-amber-50 transition-colors shadow-xs"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <FiCalendar size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800">{pendingLeaves} Leave Request{pendingLeaves !== 1 ? 's' : ''}</p>
                  <p className="text-[10px] text-slate-400">Awaiting your approval</p>
                </div>
                <FiArrowRight size={13} className="text-amber-500 shrink-0" />
              </Link>
            )}
            {pendingLogs > 0 && (
              <Link
                to="/manager/work-logs"
                className="flex items-center gap-3 p-3 bg-white border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors shadow-xs"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <FiClipboard size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800">{pendingLogs} Daily Work Log{pendingLogs !== 1 ? 's' : ''}</p>
                  <p className="text-[10px] text-slate-400">Review employee logs</p>
                </div>
                <FiArrowRight size={13} className="text-blue-500 shrink-0" />
              </Link>
            )}
            {pendingRequests > 0 && (
              <Link
                to="/manager/signature-requests"
                className="flex items-center gap-3 p-3 bg-white border border-purple-200 rounded-xl hover:bg-purple-50 transition-colors shadow-xs"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <FiEdit3 size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800">{pendingRequests} Signature Request{pendingRequests !== 1 ? 's' : ''}</p>
                  <p className="text-[10px] text-slate-400">Signature &amp; seal review</p>
                </div>
                <FiArrowRight size={13} className="text-purple-500 shrink-0" />
              </Link>
            )}
            {overdueProjects > 0 && (
              <Link
                to="/manager/projects"
                className="flex items-center gap-3 p-3 bg-white border border-red-200 rounded-xl hover:bg-red-50 transition-colors shadow-xs"
              >
                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                  <FiFolder size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-red-800">{overdueProjects} Overdue Project{overdueProjects !== 1 ? 's' : ''}</p>
                  <p className="text-[10px] text-slate-400">Check project milestones</p>
                </div>
                <FiArrowRight size={13} className="text-red-500 shrink-0" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Section: Team Attendance Today ── */}
      <div className="card card-body space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 font-heading text-base flex items-center gap-2">
              <FiClipboard className="text-secondary" /> Team Attendance Today
            </h3>
            <p className="text-xs text-slate-400">
              Live attendance status for employees under your project management
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge badge-green text-xs">Present: {attendance.presentCount || 0}</span>
            <span className="badge badge-amber text-xs">Late: {attendance.lateCount || 0}</span>
            <span className="badge badge-purple text-xs">Leave: {attendance.onLeaveCount || 0}</span>
            <span className="badge badge-red text-xs">Absent: {attendance.absentCount || 0}</span>
            <Link to="/manager/attendance" className="btn-outline btn-xs ml-2">
              Full Attendance →
            </Link>
          </div>
        </div>

        {/* Team Members Attendance Grid */}
        {(!attendance.teamList || attendance.teamList.length === 0) ? (
          <p className="text-xs text-slate-400 py-6 text-center">No assigned employees found in your scope.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto pr-1">
            {attendance.teamList.map((emp) => {
              const isPresent = emp.status === 'present'
              const isLate = emp.status === 'late'
              const isOnLeave = emp.status === 'leave'
              const isAbsent = emp.status === 'absent'

              return (
                <div
                  key={emp.employeeId}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                    <UserAvatar
                      user={{ name: emp.name, avatar: emp.avatar }}
                      className="w-full h-full rounded-xl"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{emp.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{emp.designation}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        isPresent
                          ? 'bg-emerald-100 text-emerald-800'
                          : isLate
                          ? 'bg-amber-100 text-amber-800'
                          : isOnLeave
                          ? 'bg-purple-100 text-purple-800'
                          : isAbsent
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {emp.status === 'not_marked' ? 'Not Marked' : emp.status.replace('_', ' ')}
                    </span>
                    {emp.checkIn && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(emp.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Section: Managed Projects & Financial Progress ── */}
      <div className="card card-body space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 font-heading text-base flex items-center gap-2">
              <FiFolder className="text-secondary" /> My Projects &amp; Financial Tracking
            </h3>
            <p className="text-xs text-slate-400">
              Only projects assigned to you and your working team members
            </p>
          </div>
          <Link to="/manager/projects" className="text-xs font-semibold text-secondary hover:underline">
            Manage all projects →
          </Link>
        </div>

        {projects.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No projects currently assigned to you.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full text-xs">
              <thead>
                <tr className="text-slate-400 uppercase text-[10px] border-b border-slate-100">
                  <th className="py-2.5">Project</th>
                  <th>Client</th>
                  <th>Progress</th>
                  <th>Budget</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 font-semibold text-slate-800">
                      <Link to={`/manager/projects/${p._id}`} className="hover:text-secondary">
                        {p.title}
                      </Link>
                      <p className="text-[10px] text-slate-400 font-normal">{p.serviceType || 'Standard'}</p>
                    </td>
                    <td className="text-slate-600">{p.clientName}</td>
                    <td className="w-32">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-secondary rounded-full"
                            style={{ width: `${p.progress || 0}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium">{p.progress || 0}%</span>
                      </div>
                    </td>
                    <td className="font-semibold text-slate-700">{formatMoney(p.budget || 0)}</td>
                    <td className="text-emerald-600 font-medium">{formatMoney(p.totalPaid || 0)}</td>
                    <td className={`font-medium ${p.remainingBalance > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {formatMoney(p.remainingBalance || 0)}
                    </td>
                    <td>
                      <span
                        className={`badge text-[10px] capitalize ${
                          p.status === 'active'
                            ? 'badge-green'
                            : p.status === 'overdue'
                            ? 'badge-red'
                            : p.status === 'completed' || p.status === 'paid_completed'
                            ? 'badge-blue'
                            : 'badge-gray'
                        }`}
                      >
                        {p.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="text-right">
                      <Link
                        to={`/manager/projects/${p._id}`}
                        className="btn-ghost btn-xs text-secondary hover:underline"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section: Quick Actions for Manager ── */}
      <div className="card card-body space-y-4">
        <h3 className="font-bold text-slate-900 font-heading text-sm flex items-center gap-2">
          <FiActivity size={16} className="text-secondary" /> Management Shortcuts
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
          <QuickLink to="/manager/projects" icon={FiFolder} label="Projects" color="hover:bg-blue-50 border-slate-200" />
          <QuickLink to="/manager/team-hub" icon={FiUsers} label="Team Hub" color="hover:bg-emerald-50 border-slate-200" />
          <QuickLink to="/manager/staff-hierarchy" icon={FiLayers} label="Hierarchy" color="hover:bg-purple-50 border-slate-200" />
          <QuickLink to="/manager/attendance" icon={FiClipboard} label="Attendance" color="hover:bg-cyan-50 border-slate-200" />
          <QuickLink to="/manager/work-logs" icon={FiCheckSquare} label="Daily Work Logs" color="hover:bg-indigo-50 border-slate-200" />
          <QuickLink to="/manager/leaves" icon={FiCalendar} label="Leave Approvals" color="hover:bg-amber-50 border-slate-200" />
          <QuickLink to="/manager/policies" icon={FiShield} label="Policies" color="hover:bg-teal-50 border-slate-200" />
          <QuickLink to="/manager/letters" icon={FiFileText} label="Letters" color="hover:bg-sky-50 border-slate-200" />
          <QuickLink to="/manager/signature-requests" icon={FiEdit3} label="Signatures" color="hover:bg-violet-50 border-slate-200" />
          <QuickLink to="/manager/performance" icon={FiTrendingUp} label="Performance" color="hover:bg-rose-50 border-slate-200" />
          <QuickLink to="/manager/quotations" icon={FiFileText} label="Quotations" color="hover:bg-orange-50 border-slate-200" />
          <QuickLink to="/manager/invoices" icon={FiCreditCard} label="Invoices" color="hover:bg-emerald-50 border-slate-200" />
          <QuickLink to="/manager/agreements" icon={FiFileText} label="Agreements" color="hover:bg-blue-50 border-slate-200" />
          <QuickLink to="/manager/requests" icon={FiClock} label="Requests" color="hover:bg-slate-50 border-slate-200" />
        </div>
      </div>
    </div>
  )
}
