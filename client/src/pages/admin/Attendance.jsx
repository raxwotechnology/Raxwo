import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import { assignableEmployeesUrl } from '../../lib/employeeApi'
import { lookupLoaders } from '../../lib/lookupApi'
import SearchableSelect from '../../components/ui/SearchableSelect'
import toast from 'react-hot-toast'
import useAuthStore from '../../store/authStore'
import FilterBar from '../../components/ui/FilterBar'
import ExportBar from '../../components/ui/ExportBar'
import SideDrawer from '../../components/ui/SideDrawer'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts'
import {
  FiPlus, FiEdit2, FiX, FiCheck, FiUsers, FiClock,
  FiAlertTriangle, FiCalendar, FiEye, FiLogIn, FiLogOut, FiCoffee, FiCheckCircle,
} from 'react-icons/fi'

const STATUS_OPTIONS = ['present', 'present_short', 'absent', 'leave', 'half_day', 'short_leave', 'late']
const STATUS_COLOR = {
  present: 'badge-green', present_short: 'badge-blue', absent: 'badge-red',
  leave: 'badge-yellow', half_day: 'badge-blue', short_leave: 'badge-purple', late: 'badge-yellow',
}
const PIE_COLORS = ['#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316']

const fmt = (d) => d ? new Date(d).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' }) : '—'
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const EMPTY_FORM = {
  employeeId: '', date: new Date().toISOString().split('T')[0],
  status: 'present', checkIn: '', checkOut: '',
  breakStart: '', breakEnd: '',
  lateDeductionAmount: 0, hourlyDeductionAmount: 0,
  isHalfDay: false, isFullDay: true, notes: '',
}

export default function AdminAttendance() {
  const { user } = useAuthStore()
  const canMarkAttendance = user?.role === 'admin' || user?.email === 'manager@raxwo.com' || (user?.name || '').toLowerCase().includes('rashin')
  const qc = useQueryClient()
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const [filterMode, setFilterMode] = useState('single') // default to Daily View (Day-by-Day)
  const [singleDate, setSingleDate] = useState(todayStr)
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [dateFrom, setDateFrom] = useState(todayStr)
  const [dateTo, setDateTo] = useState(todayStr)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [empFilter, setEmpFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [viewRecord, setViewRecord] = useState(null)

  const handleSingleDateChange = (val) => {
    setSingleDate(val)
    setDateFrom(val)
    setDateTo(val)
  }

  const handlePrevDay = () => {
    const parts = singleDate.split('-').map(Number)
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2] - 1)
      const prevStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      handleSingleDateChange(prevStr)
    }
  }

  const handleNextDay = () => {
    const parts = singleDate.split('-').map(Number)
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2] + 1)
      const nextStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      handleSingleDateChange(nextStr)
    }
  }

  // ── Data fetching ────────────────────────────────────────────────────────────
  const { data: branchData } = useQuery({ queryKey: ['branches-list'], queryFn: () => api.get('/branches').then(r => r.data) })
  const branches = branchData?.branches || []

  const { data: attData, isLoading } = useQuery({
    queryKey: ['admin-attendance', month, year, empFilter, statusFilter, branchFilter, filterMode, dateFrom, dateTo],
    queryFn: () => {
      const p = new URLSearchParams()
      if (filterMode === 'month') { p.set('month', month); p.set('year', year) }
      else { if (dateFrom) p.set('startDate', dateFrom); if (dateTo) p.set('endDate', dateTo) }
      if (empFilter) p.set('employeeId', empFilter)
      if (statusFilter) p.set('status', statusFilter)
      if (branchFilter) p.set('branch', branchFilter)
      return api.get(`/attendance?${p.toString()}`).then(r => r.data)
    },
  })
  const { data: analyticsData } = useQuery({
    queryKey: ['attendance-analytics', month, year, branchFilter, filterMode, dateFrom, dateTo],
    queryFn: () => {
      const p = new URLSearchParams()
      if (filterMode === 'month') { p.set('month', month); p.set('year', year) }
      else { if (dateFrom) p.set('startDate', dateFrom); if (dateTo) p.set('endDate', dateTo) }
      if (branchFilter) p.set('branch', branchFilter)
      return api.get(`/attendance/analytics?${p.toString()}`).then(r => r.data)
    },
  })
  const { data: empData } = useQuery({
    queryKey: ['employees-list-mini'],
    queryFn: () => api.get(assignableEmployeesUrl()).then(r => r.data),
  })

  const records = useMemo(() => {
    const all = attData?.records || []
    if (!search) return all
    const s = search.toLowerCase()
    return all.filter(r =>
      r.employee?.userId?.name?.toLowerCase().includes(s) ||
      r.employee?.employeeNo?.toLowerCase().includes(s)
    )
  }, [attData, search])

  const employees = empData?.employees || []
  const analytics = analyticsData || {}

  // ── Self Attendance Punch (Clock In / Clock Out for logged in user) ──────────
  const { data: todayData } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: () => api.get('/attendance/today').then(r => r.data),
    refetchInterval: 30000,
  })
  const todayRecord = todayData?.record

  const invalidateSelf = () => {
    qc.invalidateQueries({ queryKey: ['attendance-today'] })
    qc.invalidateQueries({ queryKey: ['admin-attendance'] })
    qc.invalidateQueries({ queryKey: ['attendance-analytics'] })
  }

  const selfClockInMut = useMutation({
    mutationFn: () => api.post('/attendance/clock-in'),
    onSuccess: () => { toast.success('Clocked in successfully! 🎉'); invalidateSelf() },
    onError: e => toast.error(e.response?.data?.message || 'Clock-in failed'),
  })
  const selfClockOutMut = useMutation({
    mutationFn: () => api.post('/attendance/clock-out'),
    onSuccess: () => { toast.success('Clocked out successfully! 👋'); invalidateSelf() },
    onError: e => toast.error(e.response?.data?.message || 'Clock-out failed'),
  })
  const selfStartBreakMut = useMutation({
    mutationFn: () => api.post('/attendance/break/start'),
    onSuccess: () => { toast.success('Break started'); invalidateSelf() },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })
  const selfEndBreakMut = useMutation({
    mutationFn: () => api.post('/attendance/break/end'),
    onSuccess: () => { toast.success('Break ended'); invalidateSelf() },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })

  const isSelfClockedIn = !!todayRecord?.checkIn
  const isSelfClockedOut = !!todayRecord?.checkOut
  const hasSelfActiveBreak = (todayRecord?.breakTimes || []).some(b => b.breakIn && !b.breakOut)

  // ── Mutations ────────────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-attendance'] })
    qc.invalidateQueries({ queryKey: ['attendance-analytics'] })
  }

  const saveMut = useMutation({
    mutationFn: (payload) => (editingRecord && !editingRecord.isDummy)
      ? api.put(`/attendance/${editingRecord._id}`, payload)
      : api.post('/attendance', payload),
    onSuccess: () => {
      toast.success(editingRecord ? 'Record updated' : 'Record added')
      invalidate(); closeModal()
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })

  const closeModal = () => { setShowModal(false); setEditingRecord(null); setForm(EMPTY_FORM) }

  const openCreate = () => {
    setEditingRecord(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (rec) => {
    setEditingRecord(rec)
    const lastBreak = (rec.breakTimes || []).slice(-1)[0]
    setForm({
      employeeId: rec.employee?._id || rec.employee,
      date: new Date(rec.date).toISOString().split('T')[0],
      status: rec.status || 'present',
      checkIn: rec.checkIn ? new Date(rec.checkIn).toTimeString().slice(0, 5) : '',
      checkOut: rec.checkOut ? new Date(rec.checkOut).toTimeString().slice(0, 5) : '',
      breakStart: lastBreak?.breakIn ? new Date(lastBreak.breakIn).toTimeString().slice(0, 5) : '',
      breakEnd: lastBreak?.breakOut ? new Date(lastBreak.breakOut).toTimeString().slice(0, 5) : '',
      lateDeductionAmount: rec.lateDeductionAmount || 0,
      hourlyDeductionAmount: rec.hourlyDeductionAmount || 0,
      isHalfDay: rec.isHalfDay || false,
      isFullDay: rec.isFullDay !== false,
      notes: rec.notes || '',
    })
    setShowModal(true)
  }

  const handleSubmit = () => {
    const payload = {
      employeeId: form.employeeId,
      date: form.date,
      status: form.status,
      lateDeductionAmount: Number(form.lateDeductionAmount) || 0,
      hourlyDeductionAmount: Number(form.hourlyDeductionAmount) || 0,
      isHalfDay: form.isHalfDay,
      isFullDay: form.isFullDay,
      notes: form.notes,
    }
    if (form.checkIn) {
      const [h, m] = form.checkIn.split(':')
      const d = new Date(form.date)
      d.setHours(Number(h), Number(m), 0, 0)
      payload.checkIn = d.toISOString()
    }
    if (form.checkOut) {
      const [h, m] = form.checkOut.split(':')
      const d = new Date(form.date)
      d.setHours(Number(h), Number(m), 0, 0)
      payload.checkOut = d.toISOString()
    }
    if (form.breakStart && form.breakEnd) {
      const mk = (t) => {
        const [h, m] = t.split(':')
        const d = new Date(form.date)
        d.setHours(Number(h), Number(m), 0, 0)
        return d.toISOString()
      }
      payload.breakTimes = [{ breakIn: mk(form.breakStart), breakOut: mk(form.breakEnd) }]
    }
    saveMut.mutate(payload)
  }

  // ── Analytics derived ────────────────────────────────────────────────────────
  const pieData = Object.entries(analytics.byStatus || {}).map(([k, v]) => ({ name: k.replace('_', ' '), value: v }))
  const dailyTrend = analytics.dailyTrend || []
  const byEmployee = analytics.byEmployee || []

  // ── Export columns ───────────────────────────────────────────────────────────
  const exportColumns = [
    { header: 'Employee', accessor: r => r.employee?.userId?.name || '—' },
    { header: 'Emp No', accessor: r => r.employee?.employeeNo || '—' },
    { header: 'Date', accessor: r => fmtDate(r.date) },
    { header: 'Status', accessor: r => r.isHalfDay ? 'half_day' : r.status },
    { header: 'Clock In', accessor: r => fmt(r.checkIn) },
    { header: 'Clock Out', accessor: r => fmt(r.checkOut) },
    { header: 'Worked (h)', accessor: r => r.totalWorkedHours || '—' },
    { header: 'Break (h)', accessor: r => r.breakHours || '—' },
    { header: 'OT (h)', accessor: r => r.otHours || '—' },
    { header: 'Notes', accessor: r => r.notes || '' },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">
            {records.length} records · {filterMode === 'range' ? `${fmtDate(dateFrom)}${dateFrom !== dateTo ? ` to ${fmtDate(dateTo)}` : ''}` : `${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportBar data={records} columns={exportColumns} title="Attendance Report"
            filters={{ Period: filterMode === 'range' ? `${fmtDate(dateFrom)}${dateFrom !== dateTo ? ` to ${fmtDate(dateTo)}` : ''}` : `${month}/${year}`, Status: statusFilter || 'All', Employee: empFilter || 'All', Branch: branchFilter || 'All' }} />
          {canMarkAttendance && (
            <button onClick={openCreate} className="btn-primary gap-2"><FiPlus size={14} /> Add Record</button>
          )}
        </div>
      </div>

      {/* ── My Personal Clock In / Clock Out Control Bar ───────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0">
            <FiClock size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white">Daily Attendance Punch</h3>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                isSelfClockedOut ? 'bg-slate-700 text-slate-200 border-slate-600' :
                hasSelfActiveBreak ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                isSelfClockedIn ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}>
                {isSelfClockedOut ? `🏁 Clocked Out (${fmt(todayRecord?.checkOut)})` :
                 hasSelfActiveBreak ? '☕ On Break' :
                 isSelfClockedIn ? `🟢 Clocked In (${fmt(todayRecord?.checkIn)})` :
                 '🔴 Not Clocked In Today'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Logged in as <span className="font-semibold text-white">{user?.name}</span> ({user?.role})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(!isSelfClockedIn || isSelfClockedOut) ? (
            <button
              type="button"
              onClick={() => selfClockInMut.mutate()}
              disabled={selfClockInMut.isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <FiLogIn size={15} /> {selfClockInMut.isPending ? 'Clocking In...' : 'Clock In Now'}
            </button>
          ) : (
            <>
              {!hasSelfActiveBreak ? (
                <button
                  type="button"
                  onClick={() => selfStartBreakMut.mutate()}
                  disabled={selfStartBreakMut.isPending}
                  className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <FiCoffee size={14} /> Start Break
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => selfEndBreakMut.mutate()}
                  disabled={selfEndBreakMut.isPending}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <FiCoffee size={14} /> End Break
                </button>
              )}

              <button
                type="button"
                onClick={() => selfClockOutMut.mutate()}
                disabled={selfClockOutMut.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <FiLogOut size={15} /> {selfClockOutMut.isPending ? 'Clocking Out...' : 'Clock Out'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Analytics cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="kpi-card kpi-green">
          <p className="text-xs text-slate-500 uppercase font-medium">Present</p>
          <p className="text-2xl font-bold text-emerald-700">{analytics.byStatus?.present || 0}</p>
        </div>
        <div className="kpi-card kpi-red">
          <p className="text-xs text-slate-500 uppercase font-medium">Absent</p>
          <p className="text-2xl font-bold text-red-700">{analytics.byStatus?.absent || 0}</p>
        </div>
        <div className="kpi-card kpi-yellow">
          <p className="text-xs text-slate-500 uppercase font-medium">Leave</p>
          <p className="text-2xl font-bold text-amber-700">{analytics.byStatus?.leave || 0}</p>
        </div>
        <div className="kpi-card kpi-blue">
          <p className="text-xs text-slate-500 uppercase font-medium">Half Day</p>
          <p className="text-2xl font-bold text-blue-700">{analytics.byStatus?.half_day || 0}</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily trend */}
        <div className="card card-body lg:col-span-2">
          <h3 className="font-bold text-primary font-heading mb-3 text-sm">Daily Attendance Trend</h3>
          {dailyTrend.length === 0
            ? <div className="text-center py-10 text-slate-400 text-sm">No data for this period</div>
            : <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyTrend} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="present" name="Present" fill="#22c55e" radius={[2, 2, 0, 0]} stackId="a" />
                  <Bar dataKey="half_day" name="Half Day" fill="#3b82f6" radius={[2, 2, 0, 0]} stackId="a" />
                  <Bar dataKey="leave" name="Leave" fill="#f59e0b" radius={[2, 2, 0, 0]} stackId="a" />
                  <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[2, 2, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
          }
        </div>

        {/* Status pie */}
        <div className="card card-body">
          <h3 className="font-bold text-primary font-heading mb-3 text-sm">Status Breakdown</h3>
          {pieData.length === 0
            ? <div className="text-center py-10 text-slate-400 text-sm">No data</div>
            : <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={65} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="capitalize">{d.name}</span>
                      </div>
                      <span className="font-semibold">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
          }
        </div>
      </div>

      {/* Employee summary table */}
      {byEmployee.length > 0 && (
        <div className="card card-body">
          <h3 className="font-bold text-primary font-heading mb-3 text-sm">
            Employee Summary — {filterMode === 'range' ? `${fmtDate(dateFrom)}${dateFrom !== dateTo ? ` to ${fmtDate(dateTo)}` : ''}` : `${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}`}
          </h3>
          <div className="overflow-x-auto">
            <table className="table text-sm">
              <thead>
                <tr><th>Employee</th><th>Present</th><th>Half Day</th><th>Leave</th><th>Absent</th></tr>
              </thead>
              <tbody>
                {byEmployee.slice(0, 10).map(e => (
                  <tr key={e.employeeId}>
                    <td className="font-medium">{e.name} <span className="text-xs text-slate-400">#{e.employeeNo}</span></td>
                    <td><span className="badge badge-green">{e.present}</span></td>
                    <td><span className="badge badge-blue">{e.half_day}</span></td>
                    <td><span className="badge badge-yellow">{e.leave}</span></td>
                    <td><span className="badge badge-red">{e.absent}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Period Selector — Daily View, Month View, or Date Range */}
      <div className="card card-body">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
            <button onClick={() => { setFilterMode('single'); handleSingleDateChange(singleDate); }} className={`px-3 py-1.5 font-medium transition-colors ${filterMode === 'single' ? 'bg-secondary text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Daily View</button>
            <button onClick={() => setFilterMode('range')} className={`px-3 py-1.5 font-medium transition-colors ${filterMode === 'range' ? 'bg-secondary text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Date Range</button>
            <button onClick={() => setFilterMode('month')} className={`px-3 py-1.5 font-medium transition-colors ${filterMode === 'month' ? 'bg-secondary text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Month View</button>
          </div>

          {filterMode === 'single' ? (
            <div className="flex items-center gap-1.5">
              <button onClick={handlePrevDay} className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors">
                ◄ Prev
              </button>
              <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2 py-1 bg-white">
                <FiCalendar size={14} className="text-slate-400" />
                <input
                  type="date"
                  className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none"
                  value={singleDate}
                  onChange={e => handleSingleDateChange(e.target.value)}
                />
              </div>
              <button onClick={() => handleSingleDateChange(todayStr)} className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs transition-colors">
                Today
              </button>
              <button onClick={handleNextDay} className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors">
                Next ►
              </button>
            </div>
          ) : filterMode === 'month' ? (
            <div className="flex items-center gap-2">
              <FiCalendar size={14} className="text-slate-400" />
              <select className="form-select py-2 text-sm" value={month} onChange={e => setMonth(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
                ))}
              </select>
              <input type="number" className="form-input py-2 text-sm w-24" value={year} onChange={e => setYear(Number(e.target.value))} />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <FiCalendar size={14} className="text-slate-400" />
              <input type="date" className="form-input py-1.5 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <span className="text-slate-400 text-sm">to</span>
              <input type="date" className="form-input py-1.5 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          )}

          <FilterBar
            search={search} onSearchChange={setSearch}
            searchPlaceholder="Search employee..."
            extraFilters={
              <>
                <select className="form-select py-2 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="">All Statuses</option>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>)}
                </select>
                <select className="form-select py-2 text-sm" value={empFilter} onChange={e => setEmpFilter(e.target.value)}>
                  <option value="">All Employees</option>
                  {employees.map(e => <option key={e._id} value={e._id}>{e.userId?.name} ({e.employeeNo})</option>)}
                </select>
                <select className="form-select py-2 text-sm" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
                  <option value="">All Branches</option>
                  {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
              </>
            }
          />
        </div>
      </div>

      {/* Records table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th><th>Date</th><th>Status</th>
              <th>Clock In</th><th>Clock Out</th><th>Worked</th><th>Notes</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12">
                <div className="w-7 h-7 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin mx-auto" />
              </td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-400">No records found for this period.</td></tr>
            ) : records.map(r => (
              <tr key={r._id}>
                <td>
                  <div className="font-medium text-slate-800">{r.employee?.userId?.name || '—'}</div>
                  <div className="text-xs text-slate-400">{r.employee?.employeeNo}</div>
                </td>
                <td className="text-slate-600 text-sm whitespace-nowrap">{fmtDate(r.date)}</td>
                <td>
                  <span className={`badge capitalize ${STATUS_COLOR[r.isHalfDay ? 'half_day' : r.status] || 'badge-gray'}`}>
                    {r.isHalfDay ? 'Half Day' : (r.status || '').replace('_', ' ')}
                  </span>
                </td>
                <td className="text-slate-600 text-sm">{fmt(r.checkIn)}</td>
                <td className="text-slate-600 text-sm">{fmt(r.checkOut)}</td>
                <td className="text-slate-600 text-sm font-medium">
                  {r.totalWorkedHours ? `${r.totalWorkedHours}h` : '—'}
                </td>
                <td className="text-slate-500 text-xs max-w-[120px] truncate">{r.notes || '—'}</td>
                <td>
                  <div className="flex gap-1">
                    <button onClick={() => setViewRecord(r)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-secondary" title="View">
                      <FiEye size={13} />
                    </button>
                    {canMarkAttendance && (
                      <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-secondary" title="Edit">
                        <FiEdit2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[99999]">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="font-bold text-primary font-heading">{editingRecord ? 'Edit Attendance Record' : 'Add Attendance Record'}</h3>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg"><FiX size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              {!editingRecord && (
                <div>
                  <label className="form-label">Employee *</label>
                  <SearchableSelect
                    value={form.employeeId}
                    onChange={(v) => setForm(s => ({ ...s, employeeId: v }))}
                    loadOptions={lookupLoaders.employees()}
                    placeholder="Search employee…"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-input" value={form.date} onChange={e => setForm(s => ({ ...s, date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={e => setForm(s => ({ ...s, status: e.target.value }))}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Clock In</label>
                  <input type="time" className="form-input" value={form.checkIn} onChange={e => setForm(s => ({ ...s, checkIn: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Clock Out</label>
                  <input type="time" className="form-input" value={form.checkOut} onChange={e => setForm(s => ({ ...s, checkOut: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Break start</label>
                  <input type="time" className="form-input" value={form.breakStart} onChange={e => setForm(s => ({ ...s, breakStart: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Break end</label>
                  <input type="time" className="form-input" value={form.breakEnd} onChange={e => setForm(s => ({ ...s, breakEnd: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label text-orange-600">Late Deduction (LKR)</label>
                  <input type="number" min="0" className="form-input" value={form.lateDeductionAmount} onChange={e => setForm(s => ({ ...s, lateDeductionAmount: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label text-orange-600">Hourly Deduction (LKR)</label>
                  <input type="number" min="0" className="form-input" value={form.hourlyDeductionAmount} onChange={e => setForm(s => ({ ...s, hourlyDeductionAmount: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.isHalfDay} onChange={e => setForm(s => ({ ...s, isHalfDay: e.target.checked }))} className="rounded" />
                  Half Day
                </label>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea className="form-input resize-none" rows={2} value={form.notes} onChange={e => setForm(s => ({ ...s, notes: e.target.value }))} placeholder="Optional notes..." />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t">
              <button onClick={closeModal} className="btn-ghost flex-1 justify-center">Cancel</button>
              <button onClick={handleSubmit} disabled={saveMut.isPending} className="btn-primary flex-1 justify-center gap-2">
                {saveMut.isPending ? <span className="spinner" /> : <FiCheck size={14} />}
                {editingRecord ? 'Save Changes' : 'Add Record'}
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* View drawer */}
      <SideDrawer open={!!viewRecord} onClose={() => setViewRecord(null)} title="Attendance Detail" width="sm">
        {viewRecord && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                {viewRecord.employee?.userId?.name?.charAt(0) || '?'}
              </div>
              <div>
                <p className="font-bold text-slate-800">{viewRecord.employee?.userId?.name || '—'}</p>
                <p className="text-xs text-slate-400">{viewRecord.employee?.employeeNo}</p>
              </div>
            </div>
            {[
              ['Date', fmtDate(viewRecord.date)],
              ['Status', (viewRecord.isHalfDay ? 'Half Day' : viewRecord.status)?.replace('_', ' ')],
              ['Clock In', fmt(viewRecord.checkIn)],
              ['Clock Out', fmt(viewRecord.checkOut)],
              ['Total Worked', viewRecord.totalWorkedHours ? `${viewRecord.totalWorkedHours} hours` : '—'],
              ['Break Hours', viewRecord.breakHours ? `${viewRecord.breakHours} hours` : '—'],
              ['Overtime', viewRecord.otHours ? `${viewRecord.otHours} hours` : '—'],
              ['Non-worked', viewRecord.nonWorkedHours ? `${viewRecord.nonWorkedHours} hours` : '—'],
              ['Late Deduction', viewRecord.lateDeductionAmount ? `LKR ${viewRecord.lateDeductionAmount}` : '—'],
              ['Hourly Deduction', viewRecord.hourlyDeductionAmount ? `LKR ${viewRecord.hourlyDeductionAmount}` : '—'],
              ['Notes', viewRecord.notes || '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-2 border-b border-gray-50 text-sm">
                <span className="text-slate-500">{label}</span>
                <span className="font-medium text-slate-800 capitalize">{value}</span>
              </div>
            ))}
            {(viewRecord.breakTimes || []).length > 0 && (
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase mb-2">Break Times</p>
                {viewRecord.breakTimes.map((b, i) => (
                  <div key={i} className="text-sm text-slate-600 py-1">
                    Break {i + 1}: {fmt(b.breakIn)} – {fmt(b.breakOut)}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => { openEdit(viewRecord); setViewRecord(null) }} className="btn-outline w-full justify-center mt-4">
              <FiEdit2 size={14} /> Edit Record
            </button>
          </div>
        )}
      </SideDrawer>
    </div>
  )
}
