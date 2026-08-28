import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import useAuthStore from '../../store/authStore'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts'
import { FiCalendar, FiUsers, FiDollarSign, FiFolder } from 'react-icons/fi'
import { formatMoney, chartMoneyTick, tooltipMoney } from '../../lib/currencies'

const COLORS = ['#2563EB','#22C55E','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#F97316']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const money = (v) => formatMoney(v)

export default function AdminAnalytics() {
  const { user } = useAuthStore()
  const isTopManager = user?.role === 'admin' || user?.email === 'manager@raxwo.com' || (user?.name || '').toLowerCase().includes('rashin')

  if (!isTopManager) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm max-w-lg mx-auto mt-12 space-y-3">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-xl font-bold">🚫</div>
        <h2 className="text-lg font-bold text-slate-800">Access Restricted</h2>
        <p className="text-sm text-slate-500">
          Access to Analytics is strictly reserved for Admin and Top Manager (Rashin Sheran).
        </p>
      </div>
    )
  }

  const now = new Date()
  const thisYear = now.getFullYear()
  const [startDate, setStartDate] = useState(`${thisYear}-01-01`)
  const [endDate, setEndDate] = useState(`${thisYear}-12-31`)
  const [branchFilter, setBranchFilter] = useState('')

  const { data: branchData } = useQuery({ queryKey: ['branches-list'], queryFn: () => api.get('/branches').then(r => r.data) })
  const branches = branchData?.branches || []

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['admin-dashboard', branchFilter],
    queryFn: () => api.get(`/system-metrics/dashboard${branchFilter ? `?branch=${branchFilter}` : ''}`).then(r => r.data),
  })
  const { data: advData, isLoading: advLoading } = useQuery({
    queryKey: ['advanced-analytics', startDate, endDate, branchFilter],
    queryFn: () => api.get(`/system-metrics/advanced?startDate=${startDate}&endDate=${endDate}${branchFilter ? `&branch=${branchFilter}` : ''}`).then(r => r.data),
  })

  const kpis = dashData?.kpis || {}
  const charts = dashData?.charts || {}

  // Build 12-month skeleton and fill from API
  const buildMonthlyChart = (apiData, valueKey = 'total') => {
    const map = {}
    ;(apiData || []).forEach(d => { map[d._id] = d[valueKey] })
    return MONTHS_SHORT.map((m, i) => ({ month: m, value: map[i + 1] || 0 }))
  }

  const revenueChart = buildMonthlyChart(charts.revenueData)
  const expenseChart = buildMonthlyChart(charts.expenseData)
  const payrollChart = buildMonthlyChart(charts.payrollCost)

  // Merge revenue + expense into one chart
  const revExpChart = MONTHS_SHORT.map((m, i) => ({
    month: m,
    revenue: (charts.revenueData || []).find(d => d._id === i + 1)?.total || 0,
    expense: (charts.expenseData || []).find(d => d._id === i + 1)?.total || 0,
  }))

  const deptChart = (charts.deptDist || []).map(d => ({ dept: d._id || 'Unknown', count: d.count || 0 }))
  const projectPie = (charts.projectStatus || []).map(d => ({ name: d._id || 'Unknown', value: d.count || 0 }))
  const attChart = (charts.attendanceByStatus || []).map(d => ({ name: d._id || 'Unknown', value: d.count || 0 }))

  const leaveChart = (advData?.leaveByType || []).map(d => ({ type: d._id || 'Unknown', count: d.count || 0, days: d.totalDays || 0 }))
  const projectTypeChart = (advData?.projectsByType || []).map(d => ({ type: d._id || 'Unknown', count: d.count || 0 }))
  const attTrend = (advData?.attendanceTrend || []).map(d => ({
    month: d.month || d._id,
    present: d.present || 0,
    absent: d.absent || 0,
    leave: d.leave || 0,
  }))

  const kpiCards = [
    { label: 'Total Employees', value: kpis.totalEmployees || 0, sub: `${kpis.activeEmployees || 0} active`, icon: FiUsers },
    { label: 'Revenue YTD', value: money(kpis.totalRevenue), sub: `Net: ${money(kpis.netProfit)}`, icon: FiDollarSign },
    { label: 'Total Projects', value: kpis.totalProjects || 0, sub: `${kpis.activeProjects || 0} active`, icon: FiFolder },
    { label: 'Total Clients', value: kpis.clientCount || 0, sub: `${kpis.totalSubscriptions || 0} subscriptions`, icon: FiUsers },
  ]

  const tooltipStyle = { borderRadius: '10px', fontSize: '12px', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics & Reports</h1>
          <p className="page-subtitle">Business intelligence with date range filtering</p>
        </div>
        <div className="w-full sm:w-auto mt-3 sm:mt-0 flex flex-col sm:flex-row items-center gap-2 sm:gap-3 bg-white sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none border sm:border-0 border-slate-100">
          <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="form-select py-2 sm:py-1.5 text-sm sm:text-xs w-full sm:w-auto">
            <option value="">All Branches</option>
            {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <FiCalendar size={14} className="text-gray-400 hidden sm:block"/>
            <input type="date" className="form-input py-2 sm:py-1.5 text-sm sm:text-xs flex-1 sm:w-36" value={startDate} onChange={e => setStartDate(e.target.value)}/>
            <span className="text-gray-400 text-xs">to</span>
            <input type="date" className="form-input py-2 sm:py-1.5 text-sm sm:text-xs flex-1 sm:w-36" value={endDate} onChange={e => setEndDate(e.target.value)}/>
          </div>
        </div>
      </div>

      {/* KPIs */}
      {dashLoading ? (
        <div className="flex justify-center py-12"><div className="w-10 h-10 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin"/></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpiCards.map((k, i) => (
            <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className="card card-body">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary flex-shrink-0">
                  <k.icon size={16}/>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">{k.label}</p>
                  <p className="text-xl font-bold text-primary font-heading">{k.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Revenue vs Expenses */}
      <div className="card card-body">
        <h3 className="font-bold text-primary font-heading mb-1">Revenue vs Expenses (YTD)</h3>
        <p className="text-xs text-gray-400 mb-4">Monthly comparison — blue=revenue, red=expenses</p>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={revExpChart}>
            <defs>
              <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={chartMoneyTick}/>
            <Tooltip formatter={(v, n) => tooltipMoney(v, n)} contentStyle={tooltipStyle}/>
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2563EB" strokeWidth={2.5} fill="url(#revG)"/>
            <Area type="monotone" dataKey="expense" name="Expenses" stroke="#EF4444" strokeWidth={2} fill="url(#expG)"/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Payroll + Dept */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card card-body">
          <h3 className="font-bold text-primary font-heading mb-1">Monthly Payroll Cost</h3>
          <p className="text-xs text-gray-400 mb-4">Net payroll paid each month (LKR)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={payrollChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={chartMoneyTick}/>
              <Tooltip formatter={(v) => tooltipMoney(v, 'Payroll')} contentStyle={tooltipStyle}/>
              <Bar dataKey="value" name="Payroll" fill="#2563EB" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card card-body">
          <h3 className="font-bold text-primary font-heading mb-1">Employees by Department</h3>
          <p className="text-xs text-gray-400 mb-4">Headcount per department</p>
          {deptChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false}/>
                <YAxis dataKey="dept" type="category" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} width={85}/>
                <Tooltip contentStyle={tooltipStyle}/>
                <Bar dataKey="count" name="Employees" fill="#0B1F3A" radius={[0,4,4,0]}/>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No department data yet</div>}
        </div>
      </div>

      {/* Project Status Pie + Attendance Pie */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card card-body">
          <h3 className="font-bold text-primary font-heading mb-1">Project Status Distribution</h3>
          <p className="text-xs text-gray-400 mb-4">All projects by current status</p>
          {projectPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={projectPie} cx="50%" cy="50%" outerRadius={82} innerRadius={45} dataKey="value" paddingAngle={3}>
                  {projectPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle}/>
                <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: 11, color: '#6B7280', textTransform: 'capitalize' }}>{v}</span>}/>
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No project data yet</div>}
        </div>

        <div className="card card-body">
          <h3 className="font-bold text-primary font-heading mb-1">Attendance This Month</h3>
          <p className="text-xs text-gray-400 mb-4">Breakdown by status this month</p>
          {attChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={attChart} cx="50%" cy="50%" outerRadius={82} innerRadius={45} dataKey="value" paddingAngle={3}>
                  {attChart.map((entry, i) => (
                    <Cell key={i} fill={
                      entry.name === 'present' ? '#22c55e' :
                      entry.name === 'absent' ? '#ef4444' :
                      entry.name === 'leave' ? '#f59e0b' :
                      COLORS[i % COLORS.length]
                    }/>
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle}/>
                <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: 11, color: '#6B7280', textTransform: 'capitalize' }}>{v}</span>}/>
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No attendance data this month</div>}
        </div>
      </div>

      {/* Advanced — Leave + Projects by Type */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card card-body">
          <h3 className="font-bold text-primary font-heading mb-1">Leave by Type (Selected Period)</h3>
          <p className="text-xs text-gray-400 mb-4">Requests and total days per leave type</p>
          {advLoading ? (
            <div className="h-48 flex items-center justify-center"><div className="w-6 h-6 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin"/></div>
          ) : leaveChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={leaveChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false}/>
                <Tooltip contentStyle={tooltipStyle}/>
                <Bar dataKey="days" name="Total Days" fill="#F59E0B" radius={[4,4,0,0]}/>
                <Bar dataKey="count" name="Requests" fill="#2563EB" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No leave data for selected period</div>}
        </div>

        <div className="card card-body">
          <h3 className="font-bold text-primary font-heading mb-1">Projects by Service Type</h3>
          <p className="text-xs text-gray-400 mb-4">Project count per service category</p>
          {advLoading ? (
            <div className="h-48 flex items-center justify-center"><div className="w-6 h-6 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin"/></div>
          ) : projectTypeChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={projectTypeChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false}/>
                <Tooltip contentStyle={tooltipStyle}/>
                <Bar dataKey="count" name="Projects" fill="#8B5CF6" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No project type data for period</div>}
        </div>
      </div>

      {/* Attendance Trend */}
      {attTrend.length > 0 && (
        <div className="card card-body">
          <h3 className="font-bold text-primary font-heading mb-1">Attendance Trend (Selected Period)</h3>
          <p className="text-xs text-gray-400 mb-4">Monthly present / absent / leave</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={attTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip contentStyle={tooltipStyle}/>
              <Bar dataKey="present" name="Present" fill="#22c55e" radius={[4,4,0,0]}/>
              <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[4,4,0,0]}/>
              <Bar dataKey="leave" name="Leave" fill="#f59e0b" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
