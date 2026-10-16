import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { KioskLayout } from '../components/layout/KioskLayout'
import { LoadingState } from '../components/async-state'

const HomePage = lazy(() => import('../features/home/pages/HomePage'))
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage'))
const AttendancePage = lazy(() => import('../features/attendance/pages/AttendancePage'))
const EnrollmentPage = lazy(() => import('../features/attendance/pages/EnrollmentPage'))
const StationCodePage = lazy(() => import('../features/attendance/pages/StationCodePage'))
const DashboardPage = lazy(() => import('../features/dashboard/pages/DashboardPage'))
const RoleDashboardPage = lazy(() => import('../features/dashboard/pages/RoleDashboardPage'))

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
      { path: '/dashboard/employee', element: <Page><RoleDashboardPage role="employee" /></Page> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])