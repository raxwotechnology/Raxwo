import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import useAuthStore from './store/authStore'
import api from './lib/api'
import { applySiteFavicon } from './lib/siteFavicon'
import { SITE_SETTINGS_QUERY_KEY } from './hooks/useSiteBranding'

// Layouts
import PublicLayout from './layouts/PublicLayout'
import HomeLayout from './layouts/HomeLayout'
import DashboardLayout from './layouts/DashboardLayout'
import WhatsAppButton from './components/ui/WhatsAppButton'

// Public pages
import Home from './pages/public/Home'
import Services from './pages/public/Services'
import SoftwareProducts from './pages/public/SoftwareProducts'
import ShowcaseDetailPage from './pages/public/ShowcaseDetailPage'
import About from './pages/public/About'
import Portfolio from './pages/public/Portfolio'
import Careers from './pages/public/Careers'
import Contact from './pages/public/Contact'
import JobDetail from './pages/public/JobDetail'
import Apply from './pages/public/Apply'


// Auth
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ResetPassword from './pages/auth/ResetPassword'
import ForgotPassword from './pages/auth/ForgotPassword'

// Admin pages
import AdminDashboard from './pages/admin/Dashboard'
import AdminEmployees from './pages/admin/Employees'
import AdminLeaves from './pages/admin/Leaves'
import AdminPayroll from './pages/admin/Payroll'
import AdminEPF from './pages/admin/EPFRecords'
import AdminRecruitment from './pages/admin/Recruitment'
import AdminProjects from './pages/admin/Projects'
import ProjectDetail from './pages/admin/ProjectDetail'
import Agreements from './pages/admin/Agreements'
import AdminClients from './pages/admin/Clients'
import AdminClientProfile from './pages/admin/ClientProfile'
import AdminSubscriptions from './pages/admin/Subscriptions'
import AdminInvoices from './pages/admin/Invoices'
import AdminLetters from './pages/admin/Letters'
import AdminAnalytics from './pages/admin/Analytics'
import AdminSocialAnalytics from './pages/admin/SocialAnalytics'
import AdminSettings from './pages/admin/Settings'
import CandidateProfile from './pages/admin/CandidateProfile'
import AdminBookings from './pages/admin/Bookings'
import AdminFeedbacks from './pages/admin/Feedbacks'
import AdminAttendance from './pages/admin/Attendance'
import AdminPerformance from './pages/admin/Performance'
import AdminExports from './pages/admin/Exports'
import AdminFinancial from './pages/admin/Financial'
import AdminFinanceEntries from './pages/admin/FinanceEntries'
import AdminServices from './pages/admin/Services'
import AdminPortfolio from './pages/admin/Portfolio'
import AdminRewards from './pages/admin/Rewards'
import AdminAIAnalyzer from './pages/admin/AIAnalyzer'
import AdminBranches from './pages/admin/Branches'
import Meetings from './pages/shared/Meetings'
import AdminQuotations from './pages/admin/Quotations'
import AdminPettyCash from './pages/admin/PettyCash'
import AdminAdvances from './pages/admin/Advances'
import AdminLoans from './pages/admin/Loans'
import WorkLogs from './pages/admin/WorkLogs'
import FinancialReports from './pages/admin/FinancialReports'
import PolicyManagement from './pages/admin/PolicyManagement'
import AdminBankManagement from './pages/admin/BankManagement'
import BankTransactionHistory from './pages/admin/BankTransactionHistory'
import AdminCheques from './pages/admin/Cheques'
import IncomeTax from './pages/admin/IncomeTax'
import AdminRequests from './pages/admin/Requests'
import ToolAssignments from './pages/admin/ToolAssignments'
import LogCentre from './pages/admin/LogCentre'
import AdminLeaders from './pages/admin/AdminLeaders'
import ManagerDashboard from './pages/manager/Dashboard'
import ManagerProjects from './pages/manager/Projects'
import ManagerTeam from './pages/manager/Team'
import ManagerReports from './pages/manager/Reports'
import ManagerProfile from './pages/manager/Profile'
import ManagerRequests from './pages/manager/Requests'
import MessagesCenter from './pages/shared/MessagesCenter'
import NotificationDetail from './pages/shared/NotificationDetail'
import SignatureRequests from './pages/shared/SignatureRequests'
import TeamHub from './pages/shared/TeamHub'
import StaffHierarchy from './pages/admin/StaffHierarchy'

// Developer pages
import DeveloperDashboard from './pages/employee/Dashboard'
import DeveloperProjects from './pages/employee/Projects'
import DeveloperProfile from './pages/employee/Profile'
import DeveloperTasks from './pages/employee/Tasks'
import DeveloperLeaves from './pages/employee/Leaves'
import DeveloperPayslips from './pages/employee/Payslips'
import DeveloperLetters from './pages/employee/Letters'
import DeveloperAttendance from './pages/employee/Attendance'
import DeveloperNotifications from './pages/employee/Notifications'
import DeveloperExport from './pages/employee/Export'
import EmployeeRequests from './pages/employee/Requests'
import MyTools from './pages/employee/MyTools'
import EmployeePerformance from './pages/employee/Performance'

// Client pages
import ClientProjects from './pages/client/Projects'
import ClientSubscriptions from './pages/client/Subscriptions'
import ClientInvoices from './pages/client/Invoices'
import ClientProfile from './pages/client/Profile'
import ClientMessages from './pages/client/Messages'
import ClientNotifications from './pages/client/Notifications'
import ClientBooking from './pages/client/Booking'

import ClientRewards from './pages/client/Rewards'
import ClientServices from './pages/client/Services'
import ClientDashboard from './pages/client/Dashboard'

// Guard components
const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user?.role)) return <Navigate to="/" replace />
  return children
}

const GuestRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore()
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }
  return children
}

function DynamicFaviconFromSettings() {
  const { data } = useQuery({
    queryKey: SITE_SETTINGS_QUERY_KEY,
    queryFn: () => api.get('/site-settings').then((r) => r.data),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
  useEffect(() => {
    const logoUrl = (data?.settings?.logoUrl || '').trim()
    const v = data?.settings?.updatedAt
      ? new Date(data.settings.updatedAt).getTime()
      : Date.now()
    applySiteFavicon(logoUrl, v)
  }, [data?.settings?.logoUrl, data?.settings?.updatedAt])
  return null
}

export default function App() {
  useEffect(() => {
    const { initAuth, refreshSession } = useAuthStore.getState()
    initAuth()
    refreshSession()

    // When user returns to the tab after inactivity, re-validate session & refresh avatar/profile
    let lastRefresh = Date.now()
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRefresh > 60_000) {
        lastRefresh = Date.now()
        const { token } = useAuthStore.getState()
        if (token) useAuthStore.getState().refreshSession()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return (
    <>
      <DynamicFaviconFromSettings />
      <WhatsAppButton />
      <Routes>
      {/* Home — no header */}
      <Route element={<HomeLayout />}>
        <Route path="/" element={<Home />} />
      </Route>

      {/* Public Website */}
      <Route element={<PublicLayout />}>
        <Route path="/services" element={<Services />} />
        <Route path="/services/:id" element={<ShowcaseDetailPage />} />
        <Route path="/software-products" element={<SoftwareProducts />} />
        <Route path="/software-products/:id" element={<ShowcaseDetailPage />} />
        <Route path="/showcase/:id" element={<ShowcaseDetailPage />} />
        <Route path="/about" element={<About />} />

        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/careers/:id" element={<JobDetail />} />
        <Route path="/careers/:id/apply" element={<Apply />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/my-dashboard" element={<ProtectedRoute roles={['client']}><ClientDashboard /></ProtectedRoute>} />
        <Route path="/my-projects" element={<ProtectedRoute roles={['client']}><ClientProjects /></ProtectedRoute>} />
        <Route path="/my-subscriptions" element={<ProtectedRoute roles={['client']}><ClientSubscriptions /></ProtectedRoute>} />
        <Route path="/booking" element={<ClientBooking />} />
        <Route path="/payments" element={<ProtectedRoute roles={['client']}><ClientInvoices /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute roles={['client']}><ClientMessages /></ProtectedRoute>} />
        <Route path="/meetings" element={<ProtectedRoute roles={['client']}><Meetings /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute roles={['client']}><ClientNotifications /></ProtectedRoute>} />
        <Route path="/notifications/:id" element={<ProtectedRoute roles={['client']}><NotificationDetail /></ProtectedRoute>} />
        <Route path="/my-account" element={<ProtectedRoute roles={['client']}><ClientProfile /></ProtectedRoute>} />

        <Route path="/rewards" element={<ProtectedRoute roles={['client']}><ClientRewards /></ProtectedRoute>} />
        <Route path="/our-services" element={<ProtectedRoute roles={['client']}><ClientServices /></ProtectedRoute>} />
      </Route>

      {/* Auth */}
      <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
      <Route path="/reset-password" element={<GuestRoute><ResetPassword /></GuestRoute>} />
      <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />

      {/* Admin */}
      <Route path="/admin" element={<ProtectedRoute roles={['admin']}><DashboardLayout role="admin" /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="employees" element={<AdminEmployees />} />
        <Route path="leaves" element={<AdminLeaves />} />
        <Route path="payroll" element={<AdminPayroll />} />
        <Route path="epf" element={<AdminEPF />} />
        <Route path="recruitment" element={<AdminRecruitment />} />
        <Route path="recruitment/candidates/:id" element={<CandidateProfile />} />
        <Route path="projects" element={<AdminProjects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="subscriptions" element={<AdminSubscriptions />} />
        <Route path="clients" element={<AdminClients />} />
        <Route path="clients/:id" element={<AdminClientProfile />} />
        <Route path="invoices" element={<AdminInvoices />} />
        <Route path="letters" element={<AdminLetters />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="social-analytics" element={<AdminSocialAnalytics />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="messages" element={<MessagesCenter />} />
        <Route path="notifications/:id" element={<NotificationDetail />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="feedback" element={<AdminFeedbacks />} />
        <Route path="attendance" element={<AdminAttendance />} />
        <Route path="performance" element={<AdminPerformance />} />
        <Route path="exports" element={<AdminExports />} />
        <Route path="financial" element={<AdminFinancial />} />
        <Route path="finance-entries" element={<AdminFinanceEntries />} />
        <Route path="services" element={<AdminServices />} />
        <Route path="portfolio" element={<AdminPortfolio />} />
        <Route path="rewards" element={<AdminRewards />} />
        <Route path="ai-analyzer" element={<AdminAIAnalyzer />} />
        <Route path="branches" element={<AdminBranches />} />
        <Route path="log-centre" element={<LogCentre />} />
        <Route path="leaders" element={<AdminLeaders />} />
        <Route path="team-hub" element={<TeamHub />} />
        <Route path="team" element={<TeamHub />} />
        <Route path="quotations" element={<AdminQuotations />} />
        <Route path="agreements" element={<Agreements />} />
        <Route path="petty-cash" element={<AdminPettyCash />} />
        <Route path="advances" element={<AdminAdvances />} />
        <Route path="loans" element={<AdminLoans />} />
        <Route path="work-logs" element={<WorkLogs />} />
        <Route path="financial-reports" element={<FinancialReports />} />
        <Route path="leave-policies" element={<PolicyManagement />} />
        <Route path="policies" element={<PolicyManagement />} />
        <Route path="bank-management" element={<AdminBankManagement />} />
        <Route path="bank-transactions" element={<BankTransactionHistory />} />
        <Route path="cheques" element={<AdminCheques />} />
        <Route path="income-tax" element={<IncomeTax />} />
        <Route path="requests" element={<AdminRequests />} />
        <Route path="tool-assignments" element={<ToolAssignments />} />
        <Route path="signature-requests" element={<SignatureRequests />} />
        <Route path="staff-hierarchy" element={<StaffHierarchy />} />
        <Route path="meetings" element={<Meetings />} />
      </Route>

      {/* Manager */}
      <Route path="/manager" element={<ProtectedRoute roles={['manager']}><DashboardLayout role="manager" /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="employees" element={<AdminEmployees />} />
        <Route path="leaves" element={<AdminLeaves />} />
        <Route path="epf" element={<AdminEPF />} />
        <Route path="recruitment" element={<AdminRecruitment />} />
        <Route path="recruitment/candidates/:id" element={<CandidateProfile />} />
        <Route path="projects" element={<AdminProjects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="subscriptions" element={<AdminSubscriptions />} />
        <Route path="clients" element={<AdminClients />} />
        <Route path="clients/:id" element={<AdminClientProfile />} />
        <Route path="invoices" element={<AdminInvoices />} />
        <Route path="letters" element={<AdminLetters />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="social-analytics" element={<AdminSocialAnalytics />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="messages" element={<MessagesCenter />} />
        <Route path="notifications/:id" element={<NotificationDetail />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="feedback" element={<AdminFeedbacks />} />
        <Route path="attendance" element={<AdminAttendance />} />
        <Route path="performance" element={<AdminPerformance />} />
        <Route path="exports" element={<AdminExports />} />
        <Route path="services" element={<AdminServices />} />
        <Route path="portfolio" element={<AdminPortfolio />} />
        <Route path="rewards" element={<AdminRewards />} />
        <Route path="ai-analyzer" element={<AdminAIAnalyzer />} />
        <Route path="log-centre" element={<LogCentre />} />
        <Route path="leaders" element={<AdminLeaders />} />
        <Route path="team-hub" element={<TeamHub isManagerView={true} />} />
        <Route path="team" element={<TeamHub isManagerView={true} />} />
        <Route path="quotations" element={<AdminQuotations />} />
        <Route path="agreements" element={<Agreements />} />
        <Route path="petty-cash" element={<AdminPettyCash />} />
        <Route path="advances" element={<AdminAdvances />} />
        <Route path="loans" element={<AdminLoans />} />
        <Route path="work-logs" element={<WorkLogs />} />
        <Route path="leave-policies" element={<PolicyManagement />} />
        <Route path="policies" element={<PolicyManagement />} />
        <Route path="cheques" element={<AdminCheques />} />
        <Route path="requests" element={<AdminRequests />} />
        <Route path="tool-assignments" element={<ToolAssignments />} />
        <Route path="signature-requests" element={<SignatureRequests />} />
        <Route path="meetings" element={<Meetings />} />
      </Route>

      {/* Developer */}
      <Route path="/developer" element={<ProtectedRoute roles={['developer']}><DashboardLayout role="developer" /></ProtectedRoute>}>
        <Route index element={<DeveloperDashboard />} />
        <Route path="projects" element={<DeveloperProjects />} />
        <Route path="profile" element={<DeveloperProfile />} />
        <Route path="tasks" element={<DeveloperTasks />} />
        <Route path="leaves" element={<DeveloperLeaves />} />
        <Route path="payslips" element={<DeveloperPayslips />} />
        <Route path="export" element={<DeveloperExport />} />
        <Route path="letters" element={<DeveloperLetters />} />
        <Route path="messages" element={<MessagesCenter />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="attendance" element={<DeveloperAttendance />} />
        <Route path="work-logs" element={<WorkLogs />} />
        <Route path="requests" element={<EmployeeRequests />} />
        <Route path="tools" element={<MyTools />} />
        <Route path="performance" element={<EmployeePerformance />} />
        <Route path="notifications" element={<DeveloperNotifications />} />
        <Route path="signature-requests" element={<SignatureRequests />} />
        <Route path="notifications/:id" element={<NotificationDetail />} />
        <Route path="social-analytics" element={<AdminSocialAnalytics />} />
      </Route>

      {/* Designer */}
      <Route path="/designer" element={<ProtectedRoute roles={['designer']}><DashboardLayout role="designer" /></ProtectedRoute>}>
        <Route index element={<DeveloperDashboard />} />
        <Route path="projects" element={<DeveloperProjects />} />
        <Route path="profile" element={<DeveloperProfile />} />
        <Route path="tasks" element={<DeveloperTasks />} />
        <Route path="leaves" element={<DeveloperLeaves />} />
        <Route path="payslips" element={<DeveloperPayslips />} />
        <Route path="export" element={<DeveloperExport />} />
        <Route path="letters" element={<DeveloperLetters />} />
        <Route path="messages" element={<MessagesCenter />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="attendance" element={<DeveloperAttendance />} />
        <Route path="work-logs" element={<WorkLogs />} />
        <Route path="requests" element={<EmployeeRequests />} />
        <Route path="tools" element={<MyTools />} />
        <Route path="performance" element={<EmployeePerformance />} />
        <Route path="notifications" element={<DeveloperNotifications />} />
        <Route path="signature-requests" element={<SignatureRequests />} />
        <Route path="notifications/:id" element={<NotificationDetail />} />
        <Route path="social-analytics" element={<AdminSocialAnalytics />} />
      </Route>

      {/* Marketing */}
      <Route path="/marketing" element={<ProtectedRoute roles={['marketing']}><DashboardLayout role="marketing" /></ProtectedRoute>}>
        <Route index element={<DeveloperDashboard />} />
        <Route path="projects" element={<DeveloperProjects />} />
        <Route path="profile" element={<DeveloperProfile />} />
        <Route path="tasks" element={<DeveloperTasks />} />
        <Route path="leaves" element={<DeveloperLeaves />} />
        <Route path="payslips" element={<DeveloperPayslips />} />
        <Route path="export" element={<DeveloperExport />} />
        <Route path="letters" element={<DeveloperLetters />} />
        <Route path="messages" element={<MessagesCenter />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="attendance" element={<DeveloperAttendance />} />
        <Route path="work-logs" element={<WorkLogs />} />
        <Route path="requests" element={<EmployeeRequests />} />
        <Route path="tools" element={<MyTools />} />
        <Route path="performance" element={<EmployeePerformance />} />
        <Route path="notifications" element={<DeveloperNotifications />} />
        <Route path="signature-requests" element={<SignatureRequests />} />
        <Route path="notifications/:id" element={<NotificationDetail />} />
        <Route path="social-analytics" element={<AdminSocialAnalytics />} />
      </Route>

      <Route path="/unauthorized" element={<Navigate to="/" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
