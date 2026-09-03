import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import { getApiBaseUrl } from '../../lib/devApi'
import { mediaUrl } from '../../lib/media'
import UserAvatar from '../../components/ui/UserAvatar'
import toast from 'react-hot-toast'
import {
  FiUser, FiX, FiCheck, FiCreditCard, FiFileText,
  FiClock, FiAlertTriangle, FiRefreshCw, FiTrash2,
  FiCalendar, FiTrendingUp, FiDollarSign, FiFolder, FiActivity,
} from 'react-icons/fi'
import EmployeePasswordPanel from '../../components/admin/EmployeePasswordPanel'
import { EMPLOYEE_STATUSES } from '../../constants/employeeStatus'

// Convert relative /uploads/... paths to full backend URL so "View" links
// don't accidentally resolve against the frontend origin.
const API_ORIGIN = (() => {
  const base = getApiBaseUrl()
  if (base.startsWith('http')) {
    try { return new URL(base).origin } catch { return 'http://localhost:5000' }
  }
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:5000'
})()
const resolveUrl = (url) => {
  if (!url) return url
  const resolved = mediaUrl(url)
  if (resolved) return resolved
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`
}

function openEmployeeDocument(url, label) {
  const href = resolveUrl(url)
  if (!href) {
    toast.error(`${label || 'Document'} not uploaded`)
    return
  }
  const w = window.open(href, '_blank', 'noopener,noreferrer')
  if (!w) toast.error('Allow pop-ups to open this document')
}

const TABS = ['Dashboard', 'Overview', 'Bank & Pay', 'Internship', 'Loans', 'Overtime', 'Payroll', 'Statutory', 'Documents', 'History']

const Field = ({ label, value }) => (
  <div className="py-2 border-b border-gray-50 text-sm flex justify-between gap-2">
    <span className="text-slate-500 flex-shrink-0">{label}</span>
    <span className="font-medium text-slate-800 text-right">{value || '—'}</span>
  </div>
)

export default function EmployeeDetail({ employee, onClose, onEdit }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState('Dashboard')
  const [convertDate, setConvertDate] = useState(new Date().toISOString().split('T')[0])
  const [removeReason, setRemoveReason] = useState('')
  const [showConvert, setShowConvert] = useState(false)
  const [showRemove, setShowRemove] = useState(false)

  const empId = employee?._id

  const { data: fullEmployee } = useQuery({
    queryKey: ['employee-detail-full', empId],
    queryFn: () => api.get(`/employees/${empId}`).then((r) => r.data?.employee),
    enabled: !!empId,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  // ── Dashboard data fetches ──────────────────────────────────────────────────
  const now = new Date()
  const curMonth = now.getMonth() + 1
  const curYear = now.getFullYear()

  const { data: attData } = useQuery({
    queryKey: ['emp-detail-att', empId, curMonth, curYear],
    queryFn: () => api.get(`/attendance?employeeId=${empId}&month=${curMonth}&year=${curYear}`).then(r => r.data),
    enabled: !!empId && tab === 'Dashboard',
  })
  const { data: leaveData } = useQuery({
    queryKey: ['emp-detail-leaves', empId],
    queryFn: () => api.get(`/leaves?employee=${empId}&limit=5`).then(r => r.data),
    enabled: !!empId && tab === 'Dashboard',
  })
  const { data: payrollData } = useQuery({
    queryKey: ['emp-detail-payroll', empId],
    queryFn: () => api.get(`/payroll?employee=${empId}&limit=3`).then(r => r.data),
    enabled: !!empId && tab === 'Dashboard',
  })
  const { data: projectData } = useQuery({
    queryKey: ['emp-detail-projects', empId],
    queryFn: () => api.get(`/projects?employee=${empId}&limit=5`).then(r => r.data),
    enabled: !!empId && tab === 'Dashboard',
  })
  const { data: loanSummary } = useQuery({
    queryKey: ['emp-detail-loans-sum', empId],
    queryFn: () => api.get(`/loans/employee-summary/${empId}`).then(r => r.data),
    enabled: !!empId && (tab === 'Dashboard' || tab === 'Bank & Pay'),
  })
  const { data: allLoans } = useQuery({
    queryKey: ['emp-detail-loans-all', empId],
    queryFn: () => api.get(`/loans?employeeId=${empId}`).then(r => r.data),
    enabled: !!empId && tab === 'Loans',
  })
  const { data: allOt } = useQuery({
    queryKey: ['emp-detail-ot-all', empId],
    queryFn: () => api.get(`/payroll/overtime?employeeId=${empId}`).then(r => r.data),
    enabled: !!empId && tab === 'Overtime',
  })
  const { data: allPayroll } = useQuery({
    queryKey: ['emp-detail-payroll-all', empId],
    queryFn: () => api.get(`/payroll?employee=${empId}`).then(r => r.data),
    enabled: !!empId && tab === 'Payroll',
  })
  const { data: epfHistory } = useQuery({
    queryKey: ['emp-detail-epf-all', empId],
    queryFn: () => api.get(`/epf-records?employeeId=${empId}`).then(r => r.data),
    enabled: !!empId && tab === 'Statutory',
  })

  const isIntern = employee?.employmentType === 'intern'

  const convertMut = useMutation({
    mutationFn: () => api.put(`/employees/${employee._id}/convert-intern`, { newStartDate: convertDate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'], exact: false })
      toast.success('Intern converted to permanent employee!')
      setShowConvert(false)
      onClose()
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })

  const removeMut = useMutation({
    mutationFn: () => api.put(`/employees/${employee._id}/remove-intern`, { reason: removeReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'], exact: false })
      toast.success('Intern removed. All data retained.')
      setShowRemove(false)
      onClose()
    },
    onError: e => toast.error(e.response?.data?.message || 'Failed'),
  })

  if (!employee) return null
  const e = fullEmployee || employee
  const u = e.userId || {}
  const profilePhotoSrc = e.profilePhoto ? mediaUrl(e.profilePhoto) : ''
  const internship = e.internship || {}
  const history = e.historyLog || []
  const docs = e.documents || []

  const daysLeft = e.internshipDaysRemaining != null
    ? e.internshipDaysRemaining
    : (internship.endDate ? Math.max(0, Math.ceil((new Date(internship.endDate) - new Date()) / 86400000)) : null)

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-end sm:justify-end z-[99999]">
      <motion.div
        initial={{ opacity: 0, x: 80 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 80 }}
        className="bg-white h-full sm:h-full w-full sm:w-[560px] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b bg-gradient-to-r from-[#0B1F3A] to-[#1a3a6b] text-white flex-shrink-0">
          <div className="relative flex-shrink-0">
            <UserAvatar
              user={{ name: u.name, avatar: e.profilePhoto || u.avatar }}
              className="w-14 h-14 rounded-xl border-2 border-white/30 shadow-lg"
              imgClassName="w-full h-full rounded-xl object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base truncate">{u.name}</p>
            <p className="text-xs text-white/70 truncate">{e.designation} · {e.department}</p>
            <div className="flex gap-1.5 mt-1 flex-wrap">
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{e.employeeNo}</span>
              {isIntern && <span className="text-xs bg-amber-400/80 text-amber-900 px-2 py-0.5 rounded-full font-medium">INTERN</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${e.status === 'active' ? 'bg-emerald-400/80 text-emerald-900' : 'bg-white/20'}`}>{e.status}</span>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={onEdit} className="p-2 hover:bg-white/10 rounded-lg text-white/80 hover:text-white" title="Edit">
              <FiRefreshCw size={14} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white/80 hover:text-white">
              <FiX size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-slate-50 flex-shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${tab === t ? 'border-b-2 border-secondary text-secondary bg-white' : 'text-slate-500 hover:text-slate-700'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">

          {/* ─── DASHBOARD ──────────────────────────────────────────────── */}
          {tab === 'Dashboard' && (() => {
            const records = attData?.records || []
            const presentCount = records.filter(r => !r.isHalfDay && r.status === 'present').length
            const halfDayCount = records.filter(r => r.isHalfDay).length
            const absentCount = records.filter(r => r.status === 'absent').length
            const leaveCount = records.filter(r => r.status === 'leave').length

            const leaves = leaveData?.leaves || []
            const approvedLeaves = leaves.filter(l => l.status === 'approved').length
            const pendingLeaves = leaves.filter(l => l.status === 'pending').length

            const payrolls = payrollData?.payrolls || []
            const lastPayroll = payrolls[0]

            const projects = (projectData?.projects || []).filter(p =>
              (p.assignedEmployees || []).some(ae => String(ae._id || ae) === String(empId))
            )
            const activeProjects = projects.filter(p => p.status === 'active').length
            const completedProjects = projects.filter(p => p.status === 'completed').length

            const ls = loanSummary?.summary

            return (
              <div className="space-y-5">
                {/* KPI strip */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                    <p className="text-xs text-emerald-600 font-medium">Present</p>
                    <p className="text-2xl font-extrabold text-emerald-700">{presentCount}</p>
                    <p className="text-xs text-emerald-500">{halfDayCount} half-days</p>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                    <p className="text-xs text-red-600 font-medium">Absent</p>
                    <p className="text-2xl font-extrabold text-red-700">{absentCount}</p>
                    <p className="text-xs text-red-500">{leaveCount} on leave</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                    <p className="text-xs text-blue-600 font-medium">Projects</p>
                    <p className="text-2xl font-extrabold text-blue-700">{completedProjects}</p>
                    <p className="text-xs text-blue-500">{activeProjects} active</p>
                  </div>
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
                    <p className="text-xs text-purple-600 font-medium">Leaves</p>
                    <p className="text-2xl font-extrabold text-purple-700">{approvedLeaves}</p>
                    <p className="text-xs text-purple-500">{pendingLeaves} pending</p>
                  </div>
                </div>

                {/* Last Payroll */}
                {lastPayroll && (
                  <div className="bg-slate-800 text-white rounded-xl p-4">
                    <p className="text-xs text-slate-400 font-medium mb-2 flex items-center gap-1"><FiDollarSign size={11} /> Last Payroll — {lastPayroll.month}/{lastPayroll.year}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-slate-400 text-xs">Basic</p>
                        <p className="font-semibold">LKR {(lastPayroll.basicSalary || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Gross</p>
                        <p className="font-semibold">LKR {(lastPayroll.grossSalary || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">EPF (Emp)</p>
                        <p className="font-semibold text-orange-300">- LKR {(lastPayroll.epfEmployee || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Net Pay</p>
                        <p className="font-bold text-emerald-400 text-base">LKR {(lastPayroll.netSalary || 0).toLocaleString()}</p>
                      </div>
                    </div>
                    {lastPayroll.loanDeduction > 0 && (
                      <p className="text-xs text-orange-300 mt-2">Loan deducted: LKR {lastPayroll.loanDeduction.toLocaleString()}</p>
                    )}
                    {lastPayroll.leaveDeduction > 0 && (
                      <p className="text-xs text-red-300 mt-1">Leave deducted: LKR {lastPayroll.leaveDeduction.toLocaleString()}</p>
                    )}
                  </div>
                )}

                {/* Loan/Advance summary */}
                {ls && (ls.activeLoansCount > 0 || ls.totalAdvanceBalance > 0) && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-1.5">
                    <p className="text-xs font-bold text-orange-700 uppercase">Financial Obligations</p>
                    {ls.totalAdvanceBalance > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Advance Balance</span>
                        <span className="font-semibold text-orange-700">LKR {ls.totalAdvanceBalance.toLocaleString()}</span>
                      </div>
                    )}
                    {ls.activeLoansCount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Active Loans</span>
                        <span className="font-semibold text-red-600">{ls.activeLoansCount} — LKR {ls.totalMonthlyLoanDeductions.toLocaleString()}/mo</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Active projects list */}
                {projects.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><FiFolder size={11} /> Assigned Projects</p>
                    <div className="space-y-2">
                      {projects.slice(0, 4).map(p => (
                        <div key={p._id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-sm font-medium text-slate-700 truncate">{p.name || p.title}</span>
                          <span className={`badge text-xs ml-2 flex-shrink-0 capitalize ${
                            p.status === 'active' ? 'badge-green' :
                            p.status === 'completed' ? 'badge-blue' : 'badge-gray'
                          }`}>{p.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent leaves */}
                {leaves.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><FiCalendar size={11} /> Recent Leave Requests</p>
                    <div className="space-y-2">
                      {leaves.slice(0, 4).map(l => (
                        <div key={l._id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                          <div>
                            <p className="text-xs font-medium text-slate-700 capitalize">{l.leaveType?.replace('_', ' ')} — {l.totalDays}d</p>
                            <p className="text-xs text-slate-400">{l.startDate ? new Date(l.startDate).toLocaleDateString('en-LK') : ''}</p>
                          </div>
                          <span className={`badge text-xs capitalize ${
                            l.status === 'approved' ? 'badge-green' :
                            l.status === 'rejected' ? 'badge-red' : 'badge-yellow'
                          }`}>{l.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
          {/* ─── OVERVIEW ─────────────────────────────────────────────────── */}
          {tab === 'Overview' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Personal</p>
                <Field label="Full Name" value={u.name} />
                <Field label="Email" value={u.email} />
                <Field label="Primary Phone" value={e.primaryPhone} />
                <Field label="Secondary Phone" value={e.secondaryPhone} />
                <Field label="Gender" value={e.gender} />
                <Field label="Date of Birth" value={e.dob ? new Date(e.dob).toLocaleDateString('en-LK') : null} />
                <Field label="ID Type" value={e.idType?.toUpperCase()} />
                <Field label="ID Number" value={e.idNumber} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Employment</p>
                <Field label="Employee No" value={e.employeeNo} />
                <Field label="Department" value={e.department} />
                <Field label="Designation" value={e.designation} />
                <Field label="Employment Type" value={e.employmentType ? e.employmentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : '—'} />
                <Field label="Joined Date" value={e.joinedDate ? new Date(e.joinedDate).toLocaleDateString('en-LK') : null} />
                <Field label="EPF/ETF Enrolled" value={e.epfEtfEnrolled ? 'Yes' : 'No'} />
                <Field label="EPF Number" value={e.epfNumber} />
                <Field label="ETF Number" value={e.etfNumber} />
                <Field label="Status" value={EMPLOYEE_STATUSES.find(s => s.value === e.status)?.label || e.status} />
                {(e.status === 'resigned' || e.resignationDate) && (
                  <>
                    <Field label="Resignation date" value={e.resignationDate ? new Date(e.resignationDate).toLocaleDateString('en-LK') : null} />
                    <Field label="Resignation reason" value={e.resignationReason} />
                  </>
                )}
              </div>
              <EmployeePasswordPanel employeeId={e._id} email={u.email} />
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Emergency Contact</p>
                <Field label="Name" value={e.emergencyContact?.name} />
                <Field label="Phone" value={e.emergencyContact?.phone} />
                <Field label="Relationship" value={e.emergencyContact?.relationship} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Address</p>
                <Field label="Current" value={e.currentAddress || e.address} />
                <Field label="Permanent" value={e.permanentAddress} />
              </div>
              {e.portfolioUrl && (
                <a href={e.portfolioUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-secondary hover:underline">
                  <FiUser size={13} /> {e.portfolioUrl}
                </a>
              )}
            </div>
          )}

          {/* ─── BANK & PAY ─────────────────────────────────────────────────── */}
          {tab === 'Bank & Pay' && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Salary</p>
                <Field label="Basic Salary" value={e.basicSalary ? `LKR ${e.basicSalary.toLocaleString()}` : null} />
                <Field label="Allowances" value={e.allowances ? `LKR ${e.allowances.toLocaleString()}` : null} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Bank Details</p>
                <Field label="Bank Name" value={e.bank} />
                <Field label="Branch" value={e.bankBranch} />
                <Field label="Account No" value={e.accountNumber} />
                <Field label="Account Holder" value={e.accountHolder} />
                <Field label="Account Type" value={e.accountType} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Advance / Loan Balance</p>
                {loanSummary?.summary ? (
                  <div className="p-3 bg-orange-50 border border-orange-100 rounded-xl space-y-1.5">
                    <Field label="Advance Balance" value={loanSummary.summary.totalAdvanceBalance > 0 ? `LKR ${loanSummary.summary.totalAdvanceBalance.toLocaleString()}` : 'None'} />
                    <Field label="Active Loans" value={`${loanSummary.summary.activeLoansCount} loan(s)`} />
                    <Field label="Monthly Deduction" value={loanSummary.summary.totalMonthlyLoanDeductions > 0 ? `LKR ${loanSummary.summary.totalMonthlyLoanDeductions.toLocaleString()}` : 'None'} />
                  </div>
                ) : (
                  <>
                    <Field label="Advance Balance" value={e.advanceBalance ? `LKR ${e.advanceBalance.toLocaleString()}` : 'None'} />
                    <Field label="Loan Balance" value={e.loanBalance ? `LKR ${e.loanBalance.toLocaleString()}` : 'None'} />
                  </>
                )}
              </div>
            </div>
          )}

          {/* ─── INTERNSHIP ───────────────────────────────────────────────── */}
          {tab === 'Internship' && (
            <div className="space-y-4">
              {!isIntern && e.employmentType !== 'permanent' ? (
                <div className="text-center py-10 text-slate-400">
                  <FiUser size={36} className="mx-auto mb-2 opacity-30" />
                  <p>This employee is not an intern.</p>
                </div>
              ) : (
                <>
                  {isIntern && daysLeft !== null && (
                    <div className={`rounded-xl p-4 flex items-center gap-3 ${daysLeft <= 7 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                      <FiAlertTriangle size={18} />
                      <div>
                        <p className="font-semibold text-sm">{daysLeft <= 0 ? 'Internship Expired' : `${daysLeft} days remaining`}</p>
                        <p className="text-xs opacity-75">Ends: {internship.endDate ? new Date(internship.endDate).toLocaleDateString('en-LK') : '—'}</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Internship Details</p>
                    <Field label="Start Date" value={internship.startDate ? new Date(internship.startDate).toLocaleDateString('en-LK') : null} />
                    <Field label="End Date" value={internship.endDate ? new Date(internship.endDate).toLocaleDateString('en-LK') : null} />
                    <Field label="Duration (weeks)" value={internship.durationWeeks} />
                    <Field label="University / Institute" value={internship.university} />
                    <Field label="Supervisor" value={internship.supervisorName} />
                    {internship.convertedAt && (
                      <Field label="Converted On" value={new Date(internship.convertedAt).toLocaleDateString('en-LK')} />
                    )}
                  </div>

                  {isIntern && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button onClick={() => setShowConvert(true)}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors">
                        <FiCheck size={14} /> Convert to Permanent
                      </button>
                      <button onClick={() => setShowRemove(true)}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-semibold transition-colors border border-red-200">
                        <FiTrash2 size={14} /> Remove Intern
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ─── LOANS ─────────────────────────────────────────────────── */}
          {tab === 'Loans' && (
            <div className="space-y-6">
              {allLoans?.loans?.length > 0 ? (
                allLoans.loans.map(loan => (
                  <div key={loan._id} className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-200 bg-white">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-slate-800">LKR {loan.totalAmount.toLocaleString()}</p>
                          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">{loan.reason || 'Personal Loan'}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          loan.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>{loan.status}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-y-2 mt-3">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Installment: <span className="text-slate-700">LKR {loan.monthlyInstallment.toLocaleString()}</span></div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Outstanding: <span className="text-red-600 font-bold">LKR {loan.outstandingBalance.toLocaleString()}</span></div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Progress: <span className="text-slate-700">{loan.installmentsPaid} / {loan.totalInstallments}</span></div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Method: <span className="text-slate-700 capitalize">{loan.deductionType?.replace('_', ' ')}</span></div>
                      </div>
                    </div>
                    {/* Payments Table */}
                    <div className="p-4 bg-slate-50/50">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-widest">Payment History</p>
                      {loan.payments?.length > 0 ? (
                        <div className="space-y-2">
                          {loan.payments.map((p, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                              <div>
                                <p className="font-semibold text-slate-700">LKR {p.amount.toLocaleString()}</p>
                                <p className="text-[10px] text-slate-400 font-medium capitalize">{p.method?.replace('_', ' ')}</p>
                              </div>
                              <p className="text-[10px] text-slate-500 font-bold">{new Date(p.date).toLocaleDateString('en-LK')}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No payments recorded yet</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <FiCreditCard size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-medium">No loan records found</p>
                </div>
              )}
            </div>
          )}

          {/* ─── OVERTIME ───────────────────────────────────────────────── */}
          {tab === 'Overtime' && (
            <div className="space-y-3">
              {allOt?.records?.length > 0 ? (
                allOt.records.map((ot, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex justify-between items-center">
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">{ot.month}/{ot.year}</p>
                      <p className="text-sm font-bold text-slate-800">{ot.hours} Hours OT</p>
                      <p className="text-[10px] text-slate-500 font-medium italic">{ot.note || 'Regular overtime'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600">LKR {ot.amount.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(ot.createdAt).toLocaleDateString('en-LK')}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <FiClock size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-medium">No overtime history found</p>
                </div>
              )}
            </div>
          )}

          {/* ─── PAYROLL ───────────────────────────────────────────────── */}
          {tab === 'Payroll' && (
            <div className="space-y-4">
              {allPayroll?.payrolls?.length > 0 ? (
                allPayroll.payrolls.map(p => (
                  <div key={p._id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-slate-50 -mr-8 -mt-8 rotate-45 group-hover:bg-slate-100 transition-colors" />
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{p.month}/{p.year}</p>
                          <p className="font-bold text-lg text-slate-800">LKR {p.netSalary.toLocaleString()}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          p.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>{p.status}</span>
                      </div>
                      <div className="space-y-2 border-t border-slate-50 pt-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 font-medium">Basic Salary</span>
                          <span className="text-slate-800 font-bold">LKR {p.basicSalary.toLocaleString()}</span>
                        </div>
                        {p.otPay > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500 font-medium">Overtime ({p.otHours}h)</span>
                            <span className="text-emerald-600 font-bold">+ LKR {p.otPay.toLocaleString()}</span>
                          </div>
                        )}
                        {p.loanDeduction > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500 font-medium">Loan Deduction</span>
                            <span className="text-red-500 font-bold">- LKR {p.loanDeduction.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs pt-2 border-t border-slate-50">
                          <span className="text-slate-400 font-bold uppercase">Paid Date</span>
                          <span className="text-slate-700 font-bold">{p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-LK') : '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <FiDollarSign size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-medium">No payroll history found</p>
                </div>
              )}
            </div>
          )}

          {/* ─── STATUTORY ─────────────────────────────────────────────── */}
          {tab === 'Statutory' && (
            <div className="space-y-4">
              {epfHistory?.records?.length > 0 ? (() => {
                const sr = epfHistory?.statutoryRates ?? { epfEmployee: 8, epfEmployer: 12, etfEmployer: 3 }
                return epfHistory.records.map(rec => (
                  <div key={rec._id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{rec.month}/{rec.year}</p>
                        <p className="font-bold text-slate-800">LKR {rec.basicSalary.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Basic Salary for Statutory</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        rec.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>{rec.isPaid ? 'Contributed' : 'Pending'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 border-t border-slate-50 pt-3">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employee (EPF {sr.epfEmployee}%)</p>
                        <p className="text-sm font-bold text-red-500">LKR {rec.epfEmployee.toLocaleString()}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employer (EPF {sr.epfEmployer}%)</p>
                        <p className="text-sm font-bold text-slate-700">LKR {rec.epfEmployer.toLocaleString()}</p>
                      </div>
                      <div className="space-y-1 col-span-2 pt-2 border-t border-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employer (ETF {sr.etfEmployer}%)</p>
                        <p className="text-sm font-bold text-slate-700">LKR {rec.etfEmployer.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))
              })() : (
                <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <FiActivity size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-medium">No statutory history found</p>
                </div>
              )}
            </div>
          )}

          {/* ─── DOCUMENTS ───────────────────────────────────────────────── */}
          {tab === 'Documents' && (
            <div className="space-y-3">
              {/* Profile Photo */}
              {e.profilePhoto && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <div className="flex items-center gap-3">
                    <img src={resolveUrl(e.profilePhoto)} alt={u.name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-white shadow"/>
                    <div>
                      <p className="text-sm font-medium text-slate-700">Profile Photo</p>
                      <p className="text-xs text-slate-400">Employee photo</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => openEmployeeDocument(e.profilePhoto, 'Profile photo')}
                    className="text-xs text-secondary hover:underline font-medium">View</button>
                </div>
              )}
              {[
                { label: 'CV / Resume', url: e.cvUrl, type: 'PDF' },
                { label: 'Employment Agreement', url: e.agreementUrl, type: 'PDF' },
                { label: 'NIC / Licence — Front', url: e.nicPhotoUrl, type: 'Image / PDF' },
                { label: 'NIC / Licence — Back', url: e.nicPhotoBackUrl, type: 'Image / PDF' },
              ].map(doc => (
                <div key={doc.label} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <FiFileText size={16} className={doc.url ? 'text-secondary' : 'text-slate-300'} />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{doc.label}</p>
                      <p className="text-xs text-slate-400">{doc.type}</p>
                    </div>
                  </div>
                  {doc.url
                    ? <button type="button" onClick={() => openEmployeeDocument(doc.url, doc.label)} className="text-xs text-secondary hover:underline font-medium">View</button>
                    : <span className="text-xs text-slate-400">Not uploaded</span>
                  }
                </div>
              ))}
              {docs.map((d, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <FiFileText size={16} className="text-secondary" />
                    <div>
                      <p className="text-sm font-medium text-slate-700 capitalize">{d.type?.replace('_', ' ')}</p>
                      <p className="text-xs text-slate-400">{d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString('en-LK') : ''}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => openEmployeeDocument(d.url, d.type)} className="text-xs text-secondary hover:underline font-medium">View</button>
                </div>
              ))}
              {!e.cvUrl && !e.agreementUrl && !e.nicPhotoUrl && docs.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                  <FiFileText size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No documents uploaded yet.</p>
                </div>
              )}
            </div>
          )}

          {/* ─── HISTORY ─────────────────────────────────────────────────── */}
          {tab === 'History' && (
            <div className="space-y-2">
              {history.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <FiClock size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No history entries yet.</p>
                </div>
              ) : [...history].reverse().map((h, i) => (
                <div key={i} className="flex gap-3 items-start p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <FiClock size={13} className="text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 capitalize">{h.action?.replace('_', ' ')}</p>
                    <p className="text-xs text-slate-500">{h.note}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{h.date ? new Date(h.date).toLocaleString('en-LK') : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Convert Confirm */}
        {showConvert && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-6 z-10">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
              <h4 className="font-bold text-primary font-heading">Convert to Permanent</h4>
              <p className="text-sm text-slate-500">This will change <strong>{u.name}</strong>'s type to <strong>permanent</strong> and log the action.</p>
              <div>
                <label className="form-label">New Start Date</label>
                <input type="date" className="form-input" value={convertDate} onChange={e => setConvertDate(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowConvert(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
                <button onClick={() => convertMut.mutate()} disabled={convertMut.isPending}
                  className="flex-1 justify-center flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold">
                  {convertMut.isPending ? <span className="spinner" /> : <FiCheck size={14} />} Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Remove Intern Confirm */}
        {showRemove && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-6 z-10">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
              <h4 className="font-bold text-primary font-heading text-red-700">Remove Intern</h4>
              <p className="text-sm text-slate-500">All attendance, payroll and project data will be retained. This cannot be undone.</p>
              <div>
                <label className="form-label">Reason</label>
                <textarea className="form-input resize-none" rows={2} value={removeReason} onChange={e => setRemoveReason(e.target.value)} placeholder="e.g. Internship period completed" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowRemove(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
                <button onClick={() => removeMut.mutate()} disabled={removeMut.isPending}
                  className="flex-1 justify-center flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold">
                  {removeMut.isPending ? <span className="spinner" /> : <FiTrash2 size={14} />} Remove
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  )
}
