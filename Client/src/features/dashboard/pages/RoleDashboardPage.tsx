import { Navigate } from 'react-router-dom'
import { useAuthSession } from '../../../contexts/AuthSessionContext'

export type DashboardRole = 'top-management' | 'hr' | 'employee'

const ROLE_PATHS: Record<string, DashboardRole> = {
  TopManagement: 'top-management',
  HR: 'hr',
  Employee: 'employee',
}

interface RoleDashboardPageProps {
  role: DashboardRole
}

/**
 * Role dashboard placeholder — intentionally a blank white page until the
 * real dashboards are built. Guards are UX-only; the API enforces access.
 */
export default function RoleDashboardPage({ role }: RoleDashboardPageProps) {
  const { session } = useAuthSession()

  if (!session) return <Navigate to="/login" replace />

  const sessionRole = ROLE_PATHS[session.user.userType] ?? 'employee'
  if (sessionRole !== role) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen bg-white">
      <h1 className="sr-only">Dashboard</h1>
    </div>
  )
}
