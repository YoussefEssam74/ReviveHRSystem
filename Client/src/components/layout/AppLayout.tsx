import { Suspense } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuthSession } from '../../contexts/AuthSessionContext'
import { LoadingState } from '../async-state'
import { Button } from '../ui/button'
import { GymLogo } from '../ui/gym-logo'
import { cn } from '../../lib/utils'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
    isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  )
}

/** HR & TopManagement manage station codes; employees never do. */
function canManageStationCodes(userType: string): boolean {
  return userType === 'HR' || userType === 'TopManagement'
}

export function AppLayout() {
  const { session, signOut } = useAuthSession()
  const { pathname } = useLocation()
  const isLoginPage = pathname === '/login'

  return (
    <div className="app-background flex min-h-screen flex-col bg-slate-50 bg-cover bg-center bg-fixed">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">
              R
            </span>
            <span className="shrink-0 text-lg font-bold tracking-tight text-slate-900">Revive HR</span>
            {session?.user.gymName && (
              <>
                <span className="hidden h-6 w-px shrink-0 bg-slate-200 sm:block" aria-hidden="true" />
                <GymLogo
                  gym={{ id: session.user.gymId, name: session.user.gymName }}
                  className="hidden h-6 w-6 rounded-md sm:block"
                />
                <span className="hidden max-w-[10rem] truncate text-xs font-semibold text-slate-500 md:inline">
                  {session.user.gymName}
                </span>
              </>
            )}
          </Link>

          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            {session && (
              <NavLink to="/enrollment" className={navLinkClass}>
                Enroll face
              </NavLink>
            )}

            {session && canManageStationCodes(session.user.userType) && (
              <NavLink to="/console/station-code" className={navLinkClass}>
                Station code
              </NavLink>
            )}

            {session ? (
              <div className="ml-1 flex items-center gap-2">
                <Link
                  to="/dashboard"
                  className="hidden max-w-[10rem] truncate text-sm font-medium text-slate-600 hover:text-emerald-700 md:inline"
                >
                  Dashboard
                </Link>
                <Button variant="outline" size="sm" onClick={signOut}>
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  Sign out
                </Button>
              </div>
            ) : !isLoginPage ? (
              <Link
                to="/login"
                className="ml-1 inline-flex h-8 items-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                Sign in
              </Link>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </main>

      {!isLoginPage && (
        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
          Revive HR System · Attendance &amp; workforce management
        </footer>
      )}
    </div>
  )
}
