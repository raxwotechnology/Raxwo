import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import useAuthStore from '../../store/authStore'
import { FiCalendar, FiDollarSign, FiCheckSquare, FiFileText, FiClock, FiTrendingUp, FiKey, FiTarget } from 'react-icons/fi'
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar } from 'recharts'

export default function EmployeeDashboard() {
  const { user } = useAuthStore()

  const { data: empData } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get('/employees/me').then(r => r.data),
  })
  const { data: leavesData } = useQuery({
    queryKey: ['my-leaves'],
    queryFn: () => api.get('/leaves/my').then(r => r.data),
  })
  const { data: payrollData } = useQuery({
    queryKey: ['my-payrolls'],
    queryFn: () => api.get('/payroll/my').then(r => r.data),
  })
  const { data: projectsData } = useQuery({
    queryKey: ['developer-projects-summary'],
    queryFn: () => api.get('/projects').then(r => r.data),
  })

  const emp = empData?.employee
  const leaves = leavesData?.leaves || []
  const payrolls = payrollData?.payrolls || []
  const projects = projectsData?.projects || []

  const pendingLeaves = leaves.filter(l => l.status === 'pending').length
  const latestPayroll = payrolls[0]
  const approvedLeaves = leaves.filter(l => l.status === 'approved').length
  const assignedTasks = projects.flatMap((p) => (p.tasks || []).filter((t) => t.assignedTo?._id === user?._id || t.assignedTo === user?._id))
  const completedTasks = assignedTasks.filter((t) => t.status === 'done').length
  const pendingTasks = assignedTasks.filter((t) => t.status !== 'done').length
  const attendancePct = 92
  const salaryTrend = payrolls.slice(0, 6).reverse().map((p) => ({
    month: new Date(0, p.month - 1).toLocaleString('default', { month: 'short' }),
    net: p.netSalary || 0,
  }))
  const taskChart = [
    { name: 'Completed', value: completedTasks },
    { name: 'Pending', value: pendingTasks },
  ]
  const projectStatusData = [
    { name: 'Active', value: projects.filter((p) => p.status === 'active').length },
    { name: 'Planning', value: projects.filter((p) => p.status === 'planning').length },
    { name: 'Completed', value: projects.filter((p) => p.status === 'completed').length },
  ]
  const recentActivity = [
    ...assignedTasks.slice(0, 3).map((t) => ({ text: `Task updated: ${t.title}`, type: 'task' })),
    ...(latestPayroll ? [{ text: `Salary credited for ${new Date(0, latestPayroll.month - 1).toLocaleString('default', { month: 'long' })}`, type: 'salary' }] : []),
    ...leaves.slice(0, 2).map((l) => ({ text: `Leave ${l.status}: ${l.leaveType}`, type: 'leave' })),
  ].slice(0, 6)

  const rolePath = ['developer', 'designer', 'marketing'].includes(user?.role) ? user.role : 'developer'

  const quickLinks = [
    { label: 'My Projects', to: `/${rolePath}/projects`, icon: FiTrendingUp, color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
    { label: 'Request Leave', to: `/${rolePath}/leaves`, icon: FiCalendar, color: 'bg-amber-50 text-amber-600 hover:bg-amber-100' },
    { label: 'View Payslips', to: `/${rolePath}/payslips`, icon: FiDollarSign, color: 'bg-green-50 text-green-600 hover:bg-green-100' },
    { label: 'My Tasks', to: `/${rolePath}/tasks`, icon: FiCheckSquare, color: 'bg-purple-50 text-purple-600 hover:bg-purple-100' },
    { label: 'My Tools', to: `/${rolePath}/tools`, icon: FiKey, color: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' },
    { label: 'My Requests', to: `/${rolePath}/requests`, icon: FiFileText, color: 'bg-orange-50 text-orange-600 hover:bg-orange-100' },
    { label: 'Performance', to: `/${rolePath}/performance`, icon: FiTarget, color: 'bg-rose-50 text-rose-600 hover:bg-rose-100' },
    { label: 'Work Logs', to: `/${rolePath}/work-logs`, icon: FiClock, color: 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="bg-gradient-hero rounded-3xl p-6 sm:p-7 md:p-8 relative overflow-hidden shadow-navy">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2"/>
        </div>
        <div className="relative">
          <p className="text-white/60 text-sm mb-1">Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'} 👋</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-heading">{user?.name}</h1>
          {emp && <p className="text-white/70 mt-1 text-xs sm:text-sm">{emp.designation} · {emp.department} · <span className="font-medium">{emp.employeeNo}</span></p>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: 'Approved Leaves', value: approvedLeaves, icon: FiCalendar, sub: `${pendingLeaves} pending`, color: 'kpi-blue' },
          { label: 'Total Projects', value: projects.length, icon: FiTrendingUp, sub: 'Assigned projects', color: 'kpi-navy' },
          { label: 'Completed Tasks', value: completedTasks, icon: FiCheckSquare, sub: `${pendingTasks} pending`, color: 'kpi-green' },
          { label: 'Pending Tasks', value: pendingTasks, icon: FiClock, sub: 'Needs action', color: 'kpi-orange' },
          { label: 'Net Salary', value: latestPayroll ? `LKR ${latestPayroll.netSalary?.toLocaleString()}` : '—', icon: FiDollarSign, sub: latestPayroll ? `${new Date(0, latestPayroll.month - 1).toLocaleString('default',{month:'long'})} ${latestPayroll.year}` : 'No payslip yet', color: 'kpi-green' },
          { label: 'Attendance', value: `${attendancePct}%`, icon: FiCalendar, sub: 'This month', color: 'kpi-purple' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className={`kpi-card ${s.color}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{s.label}</p>
                <p className="text-xl font-bold text-primary font-heading">{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
              </div>
              <s.icon className="text-gray-300 shrink-0" size={22}/>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        {quickLinks.map(q => (
          <Link key={q.label} to={q.to} className={`dashboard-shell p-3.5 flex flex-col items-center justify-center gap-2 text-center transition-all hover:scale-105 active:scale-95 ${q.color} rounded-2xl border border-slate-100 shadow-xs`}>
            <q.icon size={20}/>
            <span className="text-xs font-semibold leading-tight">{q.label}</span>
          </Link>
        ))}
      </div>


      <div className="grid xl:grid-cols-2 gap-6">
        <div className="card card-body">
          <h3 className="font-bold text-primary font-heading mb-4">Task Progress</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={taskChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card card-body">
          <h3 className="font-bold text-primary font-heading mb-4">Monthly Salary Trend</h3>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={salaryTrend}>
              <defs>
                <linearGradient id="salaryFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v) => `LKR ${Number(v).toLocaleString()}`} />
              <Area type="monotone" dataKey="net" stroke="#1d4ed8" fill="url(#salaryFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card card-body">
          <h3 className="font-bold text-primary font-heading mb-4">Project Status Distribution</h3>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={projectStatusData} dataKey="value" outerRadius={80}>
                {[0, 1, 2].map((idx) => <Cell key={idx} fill={['#1d4ed8', '#5b21b6', '#22c55e'][idx]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card card-body">
          <h3 className="font-bold text-primary font-heading mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {recentActivity.map((a, idx) => (
              <div key={`${a.text}-${idx}`} className="rounded-xl border border-slate-200 p-3 bg-slate-50/70">
                <p className="text-sm text-slate-700">{a.text}</p>
              </div>
            ))}
            {recentActivity.length === 0 ? <p className="text-sm text-slate-400">No recent activity</p> : null}
          </div>
        </div>

        {/* Recent leaves */}
        <div className="card card-body">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-primary font-heading">Recent Leave Requests</h3>
            <Link to={`/${user?.role || 'developer'}/leaves`} className="text-secondary text-xs hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {leaves.slice(0, 4).map(l => (
              <div key={l._id} className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-800 capitalize">{l.leaveType} Leave</p>
                  <p className="text-xs text-gray-400">{new Date(l.startDate).toLocaleDateString('en-LK')} · {l.days} day{l.days > 1 ? 's' : ''}</p>
                </div>
                <span className={`badge text-xs ${l.status === 'approved' ? 'badge-green' : l.status === 'rejected' ? 'badge-red' : 'badge-yellow'} capitalize`}>{l.status}</span>
              </div>
            ))}
            {leaves.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No leave requests yet</p>}
          </div>
        </div>

        {/* Payroll summary */}
        <div className="card card-body">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-primary font-heading">Latest Payslip</h3>
            <Link to={`/${user?.role || 'developer'}/payslips`} className="text-secondary text-xs hover:underline">All payslips</Link>
          </div>
          {latestPayroll ? (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500 mb-3 font-medium">
                  {new Date(0, latestPayroll.month - 1).toLocaleString('default', { month: 'long' })} {latestPayroll.year}
                  <span className={`ml-2 badge ${latestPayroll.status === 'paid' ? 'badge-green' : 'badge-yellow'} text-xs`}>{latestPayroll.status}</span>
                </p>
                {[
                  { label: 'Basic Salary', val: latestPayroll.basicSalary, type: 'neutral' },
                  { label: 'Allowances', val: latestPayroll.allowances, type: 'positive' },
                  { label: 'EPF Deduction (8%)', val: latestPayroll.epfEmployee, type: 'negative' },
                  { label: 'Other Deductions', val: latestPayroll.deductions, type: 'negative' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-sm py-1 border-b border-gray-100">
                    <span className="text-gray-600">{row.label}</span>
                    <span className={row.type === 'negative' ? 'text-red-600' : row.type === 'positive' ? 'text-green-600' : 'text-gray-800'}>
                      {row.type === 'negative' ? '−' : row.type === 'positive' ? '+' : ''}LKR {row.val?.toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between mt-3 pt-2 font-bold">
                  <span className="text-gray-700">Net Pay</span>
                  <span className="text-green-700 text-lg">LKR {latestPayroll.netSalary?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <FiDollarSign size={36} className="mb-2 opacity-30"/>
              <p className="text-sm">No payslips generated yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
