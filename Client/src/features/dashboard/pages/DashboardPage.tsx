import { Navigate } from 'react-router-dom'
import { useAuthSession } from '../../../contexts/AuthSessionContext'

/**
 * Landing page after sign-in. Top Management (the platform owner) belongs in the
 * Super Admin console; everyone else keeps the HR/employee dashboard they had.
 */
const ROLE_PATHS: Record<string, string> = {
  TopManagement: '/platform/dashboard',
  HR: 'hr',
  Employee: 'employee',
}

/** Sends the signed-in user to the surface that matches their role. */
export default function DashboardPage() {
  const { session } = useAuthSession()

  if (!session) return <Navigate to="/login" replace />

  const target = ROLE_PATHS[session.user.userType]
  if (target?.startsWith('/')) return <Navigate to={target} replace />

  return <Navigate to={'/dashboard/' + (target ?? 'employee')} replace />
}
