import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppLayout } from '../components/layout/AppLayout'
import { CareersLayout } from '../components/layout/CareersLayout'
import { KioskLayout } from '../components/layout/KioskLayout'
import { ConsoleLayout } from '../features/console/components/ConsoleLayout'
import { PortalRoot } from '../components/layout/PortalRoot'
import { PortalSessionProvider } from '../contexts/PortalSessionContext'
import { LoadingState } from '../components/async-state'
import { useAuthSession } from '../contexts/AuthSessionContext'

const HomePage = lazy(() => import('../features/home/pages/HomePage'))
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage'))
const ApplyPage = lazy(() => import('../features/public/ApplyPage').then((m) => ({ default: m.ApplyRoute })))
const CareersLandingPage = lazy(() => import('../features/public/CareersLandingPage'))
const AttendancePage = lazy(() => import('../features/attendance/pages/AttendancePage'))
const EnrollmentPage = lazy(() => import('../features/attendance/pages/EnrollmentPage'))
const StationCodePage = lazy(() => import('../features/attendance/pages/StationCodePage'))
const DashboardPage = lazy(() => import('../features/dashboard/pages/DashboardPage'))
const RoleDashboardPage = lazy(() => import('../features/dashboard/pages/RoleDashboardPage'))
// HR console (the back office).
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
const EventsPage = lazy(() => import('../features/events/pages/EventsPage'))
const HrTeamPage = lazy(() => import('../features/hr-team/pages/HrTeamPage'))
const SubscriptionsPage = lazy(() => import('../features/subscriptions/pages/SubscriptionsPage'))

// Super Admin console (platform owner) — docs/architecture/super-admin-api.md.
const PlatformLayout = lazy(() =>
  import('../features/platform/components/PlatformLayout').then((m) => ({ default: m.PlatformLayout })),
)
const PlatformDashboardPage = lazy(() => import('../features/platform/pages/PlatformDashboardPage'))
const PlatformCompaniesPage = lazy(() => import('../features/platform/pages/PlatformCompaniesPage'))
const PlatformCompanyDetailPage = lazy(() => import('../features/platform/pages/PlatformCompanyDetailPage'))
const PlatformUsersPage = lazy(() => import('../features/platform/pages/PlatformUsersPage'))
const PlatformUserDetailPage = lazy(() => import('../features/platform/pages/PlatformUserDetailPage'))
const PlatformHrManagersPage = lazy(() => import('../features/platform/pages/PlatformHrManagersPage'))
const PlatformBillingPage = lazy(() => import('../features/platform/pages/PlatformBillingPage'))
const PlatformRevenuePage = lazy(() => import('../features/platform/pages/PlatformRevenuePage'))
const PlatformRevenueDetailPage = lazy(() => import('../features/platform/pages/PlatformRevenueDetailPage'))
const PlatformRolesPage = lazy(() => import('../features/platform/pages/PlatformRolesPage'))
const PlatformSettingsPage = lazy(() => import('../features/platform/pages/PlatformSettingsPage'))

// Employee portal pages (Mock UI/Employee) — built per phase.
const EmployeeDashboardPage = lazy(() => import('../features/portal/pages/EmployeeDashboardPage'))
const MyRequestsPage = lazy(() => import('../features/portal/pages/MyRequestsPage'))
const MyAttendancePage = lazy(() => import('../features/portal/pages/MyAttendancePage'))
const MySchedulePage = lazy(() => import('../features/portal/pages/MySchedulePage'))
const MyPayrollPage = lazy(() => import('../features/portal/pages/MyPayrollPage'))
const MyProfilePage = lazy(() => import('../features/portal/pages/MyProfilePage'))
const MyDocumentsPage = lazy(() => import('../features/portal/pages/MyDocumentsPage'))
const MyHistoryPage = lazy(() => import('../features/portal/pages/MyHistoryPage'))
const MyEvaluationsPage = lazy(() => import('../features/portal/pages/MyEvaluationsPage'))
const NotificationsPage = lazy(() => import('../features/portal/pages/NotificationsPage'))
const SettingsPage = lazy(() => import('../features/portal/pages/SettingsPage'))
// Team Leader / Branch Manager portal pages (mock §13-§19).
const MyTeamPage = lazy(() => import('../features/portal/pages/MyTeamPage'))
const TeamSchedulePage = lazy(() => import('../features/portal/pages/TeamSchedulePage'))
const TeamRequestsPage = lazy(() => import('../features/portal/pages/TeamRequestsPage'))
const TeamPerformancePage = lazy(() => import('../features/portal/pages/TeamPerformancePage'))
const TeamActionsPage = lazy(() => import('../features/portal/pages/TeamActionsPage'))
const MemberProfilePage = lazy(() => import('../features/portal/pages/MemberProfilePage'))
const BranchEmployeesPage = lazy(() => import('../features/portal/pages/BranchEmployeesPage'))
const BranchAttendancePage = lazy(() => import('../features/portal/pages/BranchAttendancePage'))
const BranchRecruitmentPage = lazy(() => import('../features/portal/pages/BranchRecruitmentPage'))
const BranchLeavingPage = lazy(() => import('../features/portal/pages/BranchLeavingPage'))
const BranchPerformancePage = lazy(() => import('../features/portal/pages/BranchPerformancePage'))

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
  const { t } = useTranslation()
  const path = window.location.pathname.replace(/^\/console\/?/, '') || t('this section')
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <h2 className="text-lg font-semibold capitalize text-slate-900">{path.replace(/-/g, ' ')}</h2>
      <p className="mt-1 text-sm text-slate-500">{t('This module is coming soon.')}</p>
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
    // Public careers site: the landing lists every Open hiring form and each
    // form is filled in on its own page. It renders its own shell so no staff
    // navigation (dashboard, sign out, station tools) can appear here.
    path: '/apply',
    element: <CareersLayout />,
    children: [
      { index: true, element: <Page><CareersLandingPage /></Page> },
      { path: ':formId', element: <ApplyPage /> },
      { path: '*', element: <Navigate to="/apply" replace /> },
    ],
  },
  // Friendly alias for the careers landing (e.g. /careers in a job posting).
  { path: '/careers', element: <Navigate to="/apply" replace /> },
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Page><HomePage /></Page> },
      { path: '/login', element: <Page><LoginPage /></Page> },
      // HR-side: register faces for Face-ID attendance (auth session required).
      { path: '/enrollment', element: <Page><EnrollmentPage /></Page> },
      // HR/TopManagement: view + rotate the gym's station enrollment code.
      { path: '/station-code', element: <Navigate to="/console/station-code" replace /> },
      // Role dashboards - /dashboard sends each role to its own page.
      { path: '/dashboard', element: <Page><DashboardPage /></Page> },
      { path: '/dashboard/top-management', element: <Page><RoleDashboardPage role="top-management" /></Page> },
      { path: '/dashboard/hr', element: <Page><RoleDashboardPage role="hr" /></Page> },
      // Employees land in the real portal dashboard.
      { path: '/dashboard/employee', element: <Navigate to="/employee/dashboard" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
  // HR console: the back office behind its own sidebar shell.
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
      // HR/TopManagement: generate the 6-digit kiosk pairing code.
      { path: 'station-code', element: <Page><StationCodePage /></Page> },
      { path: 'events', element: <Page><EventsPage /></Page> },
      { path: 'hr-team', element: <Page><HrTeamPage /></Page> },
      { path: 'subscriptions', element: <Page><SubscriptionsPage /></Page> },
      { path: 'settings', element: <Page><SettingsPage /></Page> },
      // Fallback for any unknown console sub-path.
      { path: '*', element: <ConsolePlaceholder /> },
    ],
  },
  {
    // Super Admin console: the platform owner's surface, above every company.
    // PlatformLayout carries its own guard (Top Management / HR Manager) and
    // its own shell, so no RequireAuth/ConsoleLayout wrapper is needed.
    path: '/platform',
    element: (
      <RequireAuth>
        <Page>
          <PlatformLayout />
        </Page>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/platform/dashboard" replace /> },
      { path: 'dashboard', element: <Page><PlatformDashboardPage /></Page> },
      { path: 'companies', element: <Page><PlatformCompaniesPage /></Page> },
      { path: 'companies/:id', element: <Page><PlatformCompanyDetailPage /></Page> },
      { path: 'users', element: <Page><PlatformUsersPage /></Page> },
      { path: 'users/:id', element: <Page><PlatformUserDetailPage /></Page> },
      { path: 'hr-managers', element: <Page><PlatformHrManagersPage /></Page> },
      { path: 'billing', element: <Page><PlatformBillingPage /></Page> },
      { path: 'revenue', element: <Page><PlatformRevenuePage /></Page> },
      // Each headline revenue figure opens its own breakdown (mock parity).
      { path: 'revenue/:metric', element: <Page><PlatformRevenueDetailPage /></Page> },
      // Plans are the side rail of Billing & quotas (mock parity) — the old route
      // stays as a deep-link so bookmarks keep working.
      { path: 'plans', element: <Navigate to="/platform/billing" replace /> },
      { path: 'roles', element: <Page><PlatformRolesPage /></Page> },
      { path: 'settings', element: <Page><PlatformSettingsPage /></Page> },
      { path: '*', element: <Navigate to="/platform/dashboard" replace /> },
    ],
  },
  {
    // Employee portal (self-service + team leader + branch manager).
    // Session context is fetched here once and shared with every page.
    path: '/employee',
    element: (
      <PortalSessionProvider>
        <PortalRoot />
      </PortalSessionProvider>
    ),
    children: [
      { index: true, element: <Navigate to="/employee/dashboard" replace /> },
      { path: 'dashboard', element: <Page><EmployeeDashboardPage /></Page> },
      { path: 'requests', element: <Page><MyRequestsPage /></Page> },
      { path: 'attendance', element: <Page><MyAttendancePage /></Page> },
      { path: 'schedule', element: <Page><MySchedulePage /></Page> },
      { path: 'payroll', element: <Page><MyPayrollPage /></Page> },
      { path: 'profile', element: <Page><MyProfilePage /></Page> },
      { path: 'documents', element: <Page><MyDocumentsPage /></Page> },
      { path: 'history', element: <Page><MyHistoryPage /></Page> },
      { path: 'evaluations', element: <Page><MyEvaluationsPage /></Page> },
      { path: 'notifications', element: <Page><NotificationsPage /></Page> },
      { path: 'settings', element: <Page><SettingsPage /></Page> },
      // Manager portal (Team section + Branch drill-in).
      { path: 'team', element: <Page><MyTeamPage /></Page> },
      { path: 'team/schedule', element: <Page><TeamSchedulePage /></Page> },
      { path: 'team/requests', element: <Page><TeamRequestsPage /></Page> },
      { path: 'team/performance', element: <Page><TeamPerformancePage /></Page> },
      { path: 'team/actions', element: <Page><TeamActionsPage /></Page> },
      { path: 'branch/employees/:id', element: <Page><MemberProfilePage /></Page> },
      { path: 'branch/employees', element: <Page><BranchEmployeesPage /></Page> },
      { path: 'branch/attendance', element: <Page><BranchAttendancePage /></Page> },
      { path: 'branch/recruitment', element: <Page><BranchRecruitmentPage /></Page> },
      { path: 'branch/leaving', element: <Page><BranchLeavingPage /></Page> },
      { path: 'branch/performance', element: <Page><BranchPerformancePage /></Page> },
      // Not-yet-built portal routes fall back to the dashboard rather than 404ing.
      { path: '*', element: <Navigate to="/employee/dashboard" replace /> },
    ],
  },
])
