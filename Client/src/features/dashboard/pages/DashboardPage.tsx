import { Navigate } from 'react-router-dom'
import { useAuthSession } from '../../../contexts/AuthSessionContext'

const ROLE_PATHS: Record<string, string> = {
  TopManagement: 'top-management',
  HR: 'hr',
  Employee: 'employee',
}

/** Sends the signed-in user to the dashboard that matches their role. */
export default function DashboardPage() {
  const { session } = useAuthSession()

  if (!session) return <Navigate to="/login" replace />

  const role = ROLE_PATHS[session.user.userType] ?? 'employee'
  return <Navigate to={'/dashboard/' + role} replace />
}
