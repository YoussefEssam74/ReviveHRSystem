import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bell, ChevronDown, LogOut, Menu, Search, ShieldCheck, X, Zap, Languages, Moon, Sun } from 'lucide-react'
import { useAuthSession } from '../../../contexts/AuthSessionContext'
import { useMe } from '../../../contexts/MeContext'
import { useTheme } from '../../../contexts/ThemeContext'
import { useLanguage } from '../../../i18n/useLanguage'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingState } from '../../../components/async-state'
import { cn } from '../../../lib/utils'
import { initialsOf } from '../../../lib/format'
import { PLATFORM_NAV } from './platform-nav'
import { WorkspaceBanner, useWorkspaceSession } from './WorkspaceBanner'
import { usePlatformAlerts } from '../hooks/usePlatform'
import { alertHref } from './platform-ui'

/**
 * Route guard for the Super Admin console.
 *
 * The API is the real authority — it refuses every `/api/platform/**` call from a
 * caller without the right key. This gate only stops a signed-in HR user from
 * landing on an empty console and being confused by a wall of 401s.
 */
function PlatformGuard({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { me, isLoading } = useMe()
  const userType = me?.userType

  if (isLoading && !me) {
    return (
      <div className="pc-card">
        <LoadingState label={t('Checking your access…')} />
      </div>
    )
  }

  if (userType !== 'TopManagement' && userType !== 'HRManager') {
    return (
      <div className="pc-card">
        <EmptyState
          icon={ShieldCheck}
          title={t('Platform console')}
          message={t('Only a Super Admin or HR Manager can open the platform console.')}
          action={
            <Link to="/console/dashboard" className="btn btn-secondary btn-sm">
              {t('Back to the HR console')}
            </Link>
          }
        />
      </div>
    )
  }

  return <>{children}</>
}

/** Closes an open popover on outside click / Escape. */
function useDismiss(open: boolean, setOpen: (open: boolean) => void) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, setOpen])

  return ref
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { me } = useMe()
  const { signOut } = useAuthSession()
  const { language, toggleLanguage } = useLanguage()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const isSuperAdmin = me?.userType === 'TopManagement'
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useDismiss(menuOpen, setMenuOpen)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 flex-shrink-0 items-center gap-2.5 border-b border-charcoal-100 px-4">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-600">
          <Zap className="h-4 w-4 text-white" aria-hidden="true" fill="currentColor" stroke="none" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight text-charcoal-900">
            Revive<span className="text-brand-600">HR</span>
          </p>
          <p className="text-[9px] font-semibold uppercase leading-tight tracking-wider text-charcoal-400">
            {t('Platform console')}
          </p>
        </div>
      </div>

      <nav aria-label={t('Platform')} className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {PLATFORM_NAV.map((group, index) => {
          // Governance and commercial surfaces are Super-Admin-only; an HR Manager
          // would only collect 401s from them.
          const items = group.items.filter((item) => isSuperAdmin || !item.superAdminOnly)
          if (items.length === 0) return null

          return (
            <div key={group.title ?? index}>
              {group.title && <p className="pc-nav-section">{t(group.title)}</p>}
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => cn('pc-nav-item', isActive && 'active')}
                    onClick={onNavigate}
                  >
                    <item.icon aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{t(item.label)}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="relative flex-shrink-0 border-t border-charcoal-100 px-3 py-2" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex w-full items-center gap-2 rounded p-0.5 text-start transition-colors hover:bg-charcoal-50"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={t('Account menu')}
        >
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
            {initialsOf(me?.userName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold leading-tight text-charcoal-900">
              {me?.userName ?? t('Signed in')}
            </p>
            <p className="truncate text-[10px] leading-tight text-charcoal-500">
              {me?.roleInActiveGym ?? me?.userType ?? ''}
            </p>
          </div>
          <ChevronDown
            className={cn('h-3 w-3 flex-shrink-0 text-charcoal-400 transition-transform', menuOpen && 'rotate-180')}
            aria-hidden="true"
          />
        </button>

        {menuOpen && (
          <div className="absolute bottom-full start-2 z-50 mb-1.5 w-52 rounded-lg border border-charcoal-200 bg-white py-1.5 shadow-xl" role="menu">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={language === 'ar'}
              onClick={() => {
                toggleLanguage()
                setMenuOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-charcoal-700 hover:bg-charcoal-50"
            >
              <Languages className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
              <span className="flex-1 text-start">{t('Language')}</span>
              <span className="rounded border border-charcoal-200 px-1.5 py-0.5 text-[9px] font-semibold text-charcoal-600">
                {language === 'ar' ? 'العربية' : 'English'}
              </span>
            </button>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={isDark}
              onClick={toggleTheme}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-charcoal-700 hover:bg-charcoal-50"
            >
              {isDark ? (
                <Sun className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
              ) : (
                <Moon className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
              )}
              <span className="flex-1 text-start">{t('Dark mode')}</span>
              <span
                aria-hidden="true"
                className={cn(
                  'relative h-4 w-7 flex-shrink-0 rounded-full transition-colors',
                  isDark ? 'bg-brand-500' : 'bg-charcoal-300',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-3 w-3 rounded-full bg-[#ffffff] shadow transition-all',
                    isDark ? 'left-3.5' : 'left-0.5',
                  )}
                />
              </span>
            </button>
            <div className="my-1 border-t border-charcoal-100" />
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                signOut()
                navigate('/login')
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              {t('Sign out')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Bell + dropdown listing the attention queue (derived server-side). */
function AlertsBell() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, setOpen)
  const alerts = usePlatformAlerts(undefined)
  const items = alerts.data?.items ?? []
  const count = items.length

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded p-1.5 transition-colors hover:bg-charcoal-100"
        aria-label={t('Alerts')}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4 text-charcoal-600" aria-hidden="true" />
        {count > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-3.5 min-w-[15px] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full z-50 mt-1.5 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-charcoal-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-charcoal-100 px-3 py-2">
            <p className="text-xs font-semibold text-charcoal-900">{t('Needs your attention')}</p>
            <span className={count > 0 ? 'badge badge-red' : 'badge badge-gray'}>{count}</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {alerts.isPending ? (
              <p className="px-3 py-4 text-center text-[11px] text-charcoal-400">{t('Loading…')}</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-4 text-center text-[11px] text-charcoal-400">{t('Nothing needs attention')}</p>
            ) : (
              items.slice(0, 8).map((alert) => (
                <Link
                  key={alert.id}
                  to={alertHref(alert)}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-2 border-b border-charcoal-100 px-3 py-2.5 last:border-0 hover:bg-charcoal-50"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md',
                      alert.severity === 'critical' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600',
                    )}
                  >
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold leading-tight text-charcoal-800">
                      {alert.title}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-charcoal-500">{alert.detail}</span>
                    <span className="mt-1 inline-block text-[10px] font-semibold text-brand-700">
                      {alert.actionLabel} →
                    </span>
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AccountMenu() {
  const { t } = useTranslation()
  const { me } = useMe()
  const { signOut } = useAuthSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, setOpen)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded px-1.5 py-1 transition-colors hover:bg-charcoal-50"
        aria-label={t('Account menu')}
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
          {initialsOf(me?.userName)}
        </span>
        <span className="hidden text-start md:block">
          <span className="block text-xs font-semibold leading-tight text-charcoal-900">
            {me?.userName ?? t('Signed in')}
          </span>
          <span className="block text-[10px] leading-tight text-charcoal-500">
            {me?.roleInActiveGym ?? me?.userType ?? ''}
          </span>
        </span>
        <ChevronDown className="hidden h-3 w-3 text-charcoal-400 md:block" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute end-0 z-50 mt-1.5 w-52 rounded-lg border border-charcoal-100 bg-white py-1.5 shadow-lg">
          <div className="border-b border-charcoal-100 px-3 py-1.5">
            <p className="truncate text-xs font-medium text-charcoal-900">{me?.userName ?? t('Signed in')}</p>
            <p className="truncate text-[10px] text-charcoal-500">{me?.userType ?? ''}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              signOut()
              navigate('/login')
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Sign out')}
          </button>
        </div>
      )}
    </div>
  )
}

/** Header search: hands the term to the user directory, which owns the query. */
function GlobalSearch() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [term, setTerm] = useState('')

  return (
    <form
      className="relative hidden max-w-xs flex-1 md:block"
      onSubmit={(event) => {
        event.preventDefault()
        const value = term.trim()
        navigate(value ? `/platform/users?q=${encodeURIComponent(value)}` : '/platform/users')
      }}
    >
      <Search
        className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-charcoal-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder={t('Search users and gyms…')}
        aria-label={t('Search the platform')}
        className="pc-control w-full ps-7"
      />
    </form>
  )
}

/** The platform console shell: 232px sidebar + 48px header, no document scroll. */
export function PlatformLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [lastPath, setLastPath] = useState(location.pathname)
  const workspace = useWorkspaceSession()

  // Close the mobile drawer on every route change (adjusting state during render
  // avoids a cascading render, same pattern as ConsoleLayout).
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setMobileOpen(false)
  }

  return (
    <div className="hr-portal platform-console bg-charcoal-50 font-sans text-charcoal-800 antialiased">
      <div className="pc-shell flex flex-col">
        {workspace.data?.active && (
          <div className="flex-shrink-0">
            <WorkspaceBanner workspace={workspace.data} onLeave={() => window.location.reload()} />
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-[232px] flex-shrink-0 border-e border-charcoal-200 bg-white lg:block">
            <Sidebar />
          </aside>

          {mobileOpen && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} aria-hidden="true" />
              <aside className="absolute inset-y-0 start-0 flex w-[232px] max-w-[85vw] flex-col bg-white shadow-xl">
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label={t('Close menu')}
                  className="absolute end-2 top-2 z-10 rounded-lg p-1.5 text-charcoal-400 hover:bg-charcoal-100"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
                <Sidebar onNavigate={() => setMobileOpen(false)} />
              </aside>
            </div>
          )}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header className="z-20 flex h-12 flex-shrink-0 items-center gap-2.5 border-b border-charcoal-100 bg-white px-3 sm:px-4">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label={t('Open menu')}
                className="-ms-1 rounded p-1.5 hover:bg-charcoal-100 lg:hidden"
              >
                <Menu className="h-4 w-4 text-charcoal-600" aria-hidden="true" />
              </button>

              <GlobalSearch />

              <div className="ms-auto flex flex-shrink-0 items-center gap-1.5">
                <AlertsBell />
                <AccountMenu />
              </div>
            </header>

            <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-[0.625rem] sm:px-4">
              <PlatformGuard>
                <Outlet />
              </PlatformGuard>
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
