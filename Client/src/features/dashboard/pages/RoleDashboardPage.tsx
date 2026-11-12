import { Navigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
 * Role dashboard router — HR and Top Management are sent straight to the real
 * console dashboard (/console/dashboard, the 17-module back office; Top
 * Management bypasses permission checks per ADR-003 so it sees everything).
 * Employees get a lightweight landing card until their self-service portal
 * ships. Guards are UX-only; the API enforces access.
 */
export default function RoleDashboardPage({ role }: RoleDashboardPageProps) {
  const { session } = useAuthSession()
  const { t } = useTranslation()

  if (!session) return <Navigate to="/login" replace />

  const sessionRole = ROLE_PATHS[session.user.userType] ?? 'employee'
  if (sessionRole !== role) return <Navigate to="/dashboard" replace />

  if (role !== 'employee') return <Navigate to="/console/dashboard" replace />

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">{t('Welcome to Revive HR')}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {t(
            "Your employee self-service portal is coming soon. For now you can clock in at the gym terminal with your branch's station code.",
          )}
        </p>
        <Link
          to="/attendance"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          {t('Open attendance terminal')}
        </Link>
      </div>
    </div>
  )
}
