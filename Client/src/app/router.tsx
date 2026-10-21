import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { KioskLayout } from '../components/layout/KioskLayout'
import { PortalRoot } from '../components/layout/PortalRoot'
import { PortalSessionProvider } from '../contexts/PortalSessionContext'
import { LoadingState } from '../components/async-state'

const HomePage = lazy(() => import('../features/home/pages/HomePage'))
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage'))
const AttendancePage = lazy(() => import('../features/attendance/pages/AttendancePage'))
const EnrollmentPage = lazy(() => import('../features/attendance/pages/EnrollmentPage'))
const StationCodePage = lazy(() => import('../features/attendance/pages/StationCodePage'))
const DashboardPage = lazy(() => import('../features/dashboard/pages/DashboardPage'))
const RoleDashboardPage = lazy(() => import('../features/dashboard/pages/RoleDashboardPage'))

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
      // Employees land in the real portal dashboard.
      { path: '/dashboard/employee', element: <Navigate to="/employee/dashboard" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
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
