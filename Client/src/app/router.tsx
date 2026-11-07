import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { KioskLayout } from '../components/layout/KioskLayout'
import { ConsoleLayout } from '../features/console/components/ConsoleLayout'
import { LoadingState } from '../components/async-state'
import { useAuthSession } from '../contexts/AuthSessionContext'

const HomePage = lazy(() => import('../features/home/pages/HomePage'))
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage'))
const AttendancePage = lazy(() => import('../features/attendance/pages/AttendancePage'))
const EnrollmentPage = lazy(() => import('../features/attendance/pages/EnrollmentPage'))
const StationCodePage = lazy(() => import('../features/attendance/pages/StationCodePage'))
const DashboardPage = lazy(() => import('../features/dashboard/pages/DashboardPage'))
const RoleDashboardPage = lazy(() => import('../features/dashboard/pages/RoleDashboardPage'))
// HR console (the 17-route back office).
const HrDashboardPage = lazy(() => import('../features/dashboard/pages/HrDashboardPage'))
const EmployeesPage = lazy(() => import('../features/employees/pages/EmployeesPage'))
const EmployeeProfilePage = lazy(() => import('../features/employees/pages/EmployeeProfilePage'))
const AttendanceHrPage = lazy(() => import('../features/attendance-hr/pages/AttendanceHrPage'))
const RequestsPage = lazy(() => import('../features/requests/pages/RequestsPage'))
const BranchQueuePage = lazy(() => import('../features/branch-queue/pages/BranchQueuePage'))
const TerminationsPage = lazy(() => import('../features/terminations/pages/TerminationsPage'))
const RecruitmentPage = lazy(() => import('../features/recruitment/pages/RecruitmentPage'))
const PayrollPage = lazy(() => import('../features/payroll/pages/PayrollPage'))
const EvaluationsPage = lazy(() => import('../features/evaluations/pages/EvaluationsPage'))
const ReportsPage = lazy(() => import('../features/reports/pages/ReportsPage'))
const PositionsPage = lazy(() => import('../features/positions/pages/PositionsPage'))
const SchedulePage = lazy(() => import('../features/schedule/pages/SchedulePage'))
const EventsPage = lazy(() => import('../features/events/pages/EventsPage'))
const NotificationsPage = lazy(() => import('../features/notifications/pages/NotificationsPage'))
const AuditPage = lazy(() => import('../features/audit/pages/AuditPage'))
const HrTeamPage = lazy(() => import('../features/hr-team/pages/HrTeamPage'))
const MyAccessPage = lazy(() => import('../features/my-access/pages/MyAccessPage'))

function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>
}

/** UX-only gate: bounce signed-out users to /login. The API enforces access. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuthSession()
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

/** Shown for console routes whose module isn't built yet. */
function ConsolePlaceholder() {
  const path = window.location.pathname.replace(/^\/console\/?/, '') || 'this section'
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <h2 className="text-lg font-semibold capitalize text-slate-900">{path.replace(/-/g, ' ')}</h2>
      <p className="mt-1 text-sm text-slate-500">This module is coming soon.</p>
    </div>
  )
}

export const router = createBrowserRouter([
  // Public attendance station: no web session, no navigation - just the terminal.
  // Lift it out of AppLayout so no sign-in/sign-out UI can ever appear here.
  {
    path: '/attendance',
    element: <KioskLayout />,
    children: [
      { index: true, element: <Page><AttendancePage /></Page> },
      { path: '*', element: <Navigate to="/attendance" replace /> },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Page><HomePage /></Page> },
      { path: '/login', element: <Page><LoginPage /></Page> },
      // HR-side: register faces for Face-ID attendance (auth session required).
      { path: '/enrollment', element: <Page><EnrollmentPage /></Page> },
      // HR/TopManagement: view + rotate the gym's station enrollment code.
      { path: '/station-code', element: <Page><StationCodePage /></Page> },
      // Role dashboards - /dashboard sends each role to its own page.
      { path: '/dashboard', element: <Page><DashboardPage /></Page> },
      { path: '/dashboard/top-management', element: <Page><RoleDashboardPage role="top-management" /></Page> },
      { path: '/dashboard/hr', element: <Page><RoleDashboardPage role="hr" /></Page> },
      { path: '/dashboard/employee', element: <Page><RoleDashboardPage role="employee" /></Page> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
  // HR console: the 17-route back office behind its own sidebar shell.
  {
    path: '/console',
    element: (
      <RequireAuth>
        <ConsoleLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/console/dashboard" replace /> },
      { path: 'dashboard', element: <Page><HrDashboardPage /></Page> },
      { path: 'employees', element: <Page><EmployeesPage /></Page> },
      { path: 'employees/:id', element: <Page><EmployeeProfilePage /></Page> },
      { path: 'attendance', element: <Page><AttendanceHrPage /></Page> },
      { path: 'requests', element: <Page><RequestsPage /></Page> },
      { path: 'branch-queue', element: <Page><BranchQueuePage /></Page> },
      { path: 'terminations', element: <Page><TerminationsPage /></Page> },
      { path: 'recruitment', element: <Page><RecruitmentPage /></Page> },
      { path: 'payroll', element: <Page><PayrollPage /></Page> },
      { path: 'evaluations', element: <Page><EvaluationsPage /></Page> },
      // Legacy deep-link: the mock's form-builder route aliases Evaluations.
      { path: 'form-builder', element: <Page><EvaluationsPage /></Page> },
      { path: 'reports', element: <Page><ReportsPage /></Page> },
      { path: 'positions', element: <Page><PositionsPage /></Page> },
      { path: 'schedule', element: <Page><SchedulePage /></Page> },
      { path: 'events', element: <Page><EventsPage /></Page> },
      { path: 'notifications', element: <Page><NotificationsPage /></Page> },
      { path: 'audit', element: <Page><AuditPage /></Page> },
      { path: 'hr-team', element: <Page><HrTeamPage /></Page> },
      { path: 'my-access', element: <Page><MyAccessPage /></Page> },
      // Fallback for any unknown console sub-path.
      { path: '*', element: <ConsolePlaceholder /> },
    ],
  },
])