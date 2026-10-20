import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, Check, ChevronDown, LogOut, Menu, Moon, RefreshCw, Settings, Sun, X, Zap } from 'lucide-react'
import { useAuthSession } from '../../contexts/AuthSessionContext'
import { usePortalSession } from '../../contexts/PortalSessionContext'
import { useTheme } from '../../contexts/ThemeContext'
import {
  BRANCH_ITEMS,
  DROPDOWN_ITEMS,
  MOBILE_ITEMS,
  PAGE_PATHS,
  PERSONAL_ITEMS,
  REHOMED_LABELS,
  REHOME_IDS,
  TEAM_ITEMS,
  titleForPath,
  type PortalNavItem,
} from '../../features/portal/portal-nav'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationsList,
  useUnreadCount,
  type NotificationRow,
} from '../../features/notifications/hooks/use-notifications'
import { cn } from '../../lib/utils'
import { timeAgo } from '../../lib/format'
import { describeApiError } from '../../lib/api-client'
import { Avatar } from '../ui/primitives'
import { ConfirmDialog } from '../ui/modal'
import { useToast } from '../ui/toast'
import { Spinner } from '../async-state'
import { useNavCounters, type NavBadge } from './use-nav-counters'

/* ------------------------------------------------------------------ */
/* Nav model                                                          */
/* ------------------------------------------------------------------ */

interface NavSection {
  title: string
  items: PortalNavItem[]
}

/**
 * Sidebar sections for the current session, mirroring the mock's navPools():
 * the Branch pool is shared by Branch Manager and Team Leader (Team Schedule/
 * Requests re-home under Branch with the manager labels), Recruitment is the
 * only Branch-Manager-only item, and the TL's old Team page trio (My Team /
 * Team Performance / Team Actions) is not in the sidebar — the TL works on the
 * same Branch pages, team-scoped. Key-gated items apply /api/auth/me keys.
 */
function buildNavSections(isTeamLeader: boolean, isBranchManager: boolean, can: (key: string) => boolean): NavSection[] {
  const sections: NavSection[] = [{ title: 'Personal', items: PERSONAL_ITEMS }]

  if (isTeamLeader || isBranchManager) {
    const rehomed = TEAM_ITEMS
      .filter((item) => REHOME_IDS.includes(item.id))
      .map((item) => ({ ...item, label: REHOMED_LABELS[item.id] ?? item.label }))

    const recruitmentIndex = BRANCH_ITEMS.findIndex((item) => item.id === 'recruitment')
    const beyondScope = isBranchManager ? BRANCH_ITEMS.slice(recruitmentIndex) : []
    const branch = [
      ...BRANCH_ITEMS.slice(0, recruitmentIndex),
      ...rehomed,
      ...beyondScope,
    ]
    sections.push({
      title: 'Branch',
      items: branch.filter((item) => !item.permission || can(item.permission)),
    })
  }

  return sections
}

/* ------------------------------------------------------------------ */
/* Dismissable dropdown hook                                          */
/* ------------------------------------------------------------------ */

function useDismissable(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])
  return ref
}

/* ------------------------------------------------------------------ */
/* Layout                                                             */
/* ------------------------------------------------------------------ */

export function PortalLayout() {
  const { session, signOut } = useAuthSession()
  const portal = usePortalSession()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const title = titleForPath(location.pathname)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)

  const bellList = useNotificationsList(bellOpen, 6)
  const unreadCountQuery = useUnreadCount()
  const markAllRead = useMarkAllNotificationsRead()
  const markOneRead = useMarkNotificationRead()
  const counters = useNavCounters()

  const bellRef = useDismissable(bellOpen, () => setBellOpen(false))
  const profileRef = useDismissable(profileOpen, () => setProfileOpen(false))
  const userMenuRef = useDismissable(userMenuOpen, () => setUserMenuOpen(false))

  useEffect(() => {
    setDrawerOpen(false)
    setBellOpen(false)
    setProfileOpen(false)
    setUserMenuOpen(false)
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  useEffect(() => {
    if (!session) navigate('/login', { replace: true })
  }, [session, navigate])

  if (!session) return null

  if (portal.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal-50">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-8 w-8 text-brand-600" />
          <p className="text-xs text-charcoal-500">Loading your session…</p>
        </div>
      </div>
    )
  }

  if (portal.error || !portal.me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal-50 px-4">
        <div className="card max-w-sm p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500" aria-hidden="true" />
          <h1 className="mt-3 text-sm font-semibold text-charcoal-900">Session could not be loaded</h1>
          <p className="mt-1 text-xs text-charcoal-500">{portal.error ?? 'Your session context is unavailable.'}</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button type="button" className="btn btn-primary btn-md" onClick={portal.reload}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
            <button type="button" className="btn btn-secondary btn-md" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    )
  }

  const sections = buildNavSections(portal.isTeamLeader, portal.isBranchManager, portal.can)
  const user = portal.user
  const initials = user?.initials || portal.me.userName.slice(0, 2).toUpperCase()
  const fullName = user?.fullName || portal.me.userName
  const roleLabel = portal.me.roleInActiveGym ?? user?.role ?? portal.me.userType
  const unreadCount = unreadCountQuery.data?.count ?? 0

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 flex-shrink-0 items-center gap-2 border-b border-charcoal-100 px-4">
        <Link to="/employee/dashboard" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
            <Zap className="h-5 w-5 text-white" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold tracking-tight text-charcoal-900">
            Revive<span className="text-brand-600">HR</span>
          </span>
        </Link>
        <button
          type="button"
          className="ml-auto rounded-lg p-1.5 text-charcoal-400 hover:bg-charcoal-100 hover:text-charcoal-700 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 pb-2" aria-label="Portal">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="mt-3 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-charcoal-400 first:mt-0">
              {section.title}
            </div>
            {section.items.map((item) => {
              const badge: NavBadge | undefined = counters[item.id]
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  end
                  className={({ isActive }) => cn('nav-item', isActive && 'active')}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <span className="text-xs">{item.label}</span>
                  {badge && (
                    <span
                      title={badge.label}
                      className="ml-auto flex-shrink-0 inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-600 ring-1 ring-inset ring-amber-200"
                    >
                      {badge.count > 99 ? '99+' : badge.count}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}

      </nav>

      <div className="relative flex-shrink-0 border-t border-charcoal-100 p-3" ref={userMenuRef}>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-lg p-1 text-left transition-colors hover:bg-charcoal-50"
          onClick={() => setUserMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={userMenuOpen}
          aria-label="Account menu"
        >
          <Avatar initials={initials} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-charcoal-900">{fullName}</span>
            <span className="block truncate text-xs text-charcoal-500">{roleLabel}</span>
          </span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 flex-shrink-0 text-charcoal-400 transition-transform', userMenuOpen && 'rotate-180')}
            aria-hidden="true"
          />
        </button>

        {userMenuOpen && (
          <div className="absolute bottom-full left-3 z-40 mb-2 w-52 rounded-xl border border-charcoal-200 bg-white py-1.5 shadow-xl" role="menu">
            <Link
              to={PAGE_PATHS.settings}
              role="menuitem"
              onClick={() => setUserMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-charcoal-700 hover:bg-charcoal-50"
            >
              <Settings className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
              Settings
            </Link>
            <div className="my-1 border-t border-charcoal-100" />
            <button
              type="button"
              role="menuitemradio"
              aria-checked={isDark}
              onClick={toggleTheme}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-charcoal-700 hover:bg-charcoal-50"
            >
              {isDark ? (
                <Sun className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
              ) : (
                <Moon className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
              )}
              <span className="flex-1 text-left">Dark mode</span>
              <span
                aria-hidden="true"
                className={cn('relative h-4 w-7 flex-shrink-0 rounded-full transition-colors', isDark ? 'bg-brand-500' : 'bg-charcoal-300')}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-3 w-3 rounded-full bg-[#ffffff] shadow transition-all',
                    isDark ? 'left-3.5' : 'left-0.5',
                  )}
                />
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-charcoal-50">
      {/* Soft brand backdrop behind all portal pages (fixed, non-interactive) */}
      <div className="portal-backdrop" aria-hidden="true" />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 border-r border-charcoal-200 bg-white lg:block">{sidebar}</aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-56">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-charcoal-100 bg-white px-4 lg:px-5">
          <button
            type="button"
            className="rounded-lg p-1.5 text-charcoal-500 hover:bg-charcoal-100 hover:text-charcoal-800 lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <h1 className="truncate text-sm font-semibold text-charcoal-900">{title}</h1>

          <div className="ml-auto flex items-center gap-2.5">
            {portal.me.gyms.length > 1 && <GymSwitcher />}

            <div className="relative" ref={bellRef}>
              <button
                type="button"
                onClick={() => setBellOpen((open) => !open)}
                className="relative rounded-full p-1.5 text-charcoal-500 hover:bg-charcoal-100 hover:text-charcoal-800"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                aria-expanded={bellOpen}
              >
                <Bell className="h-5 w-5" aria-hidden="true" />
                {unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" />}
              </button>

              {bellOpen && (
                <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-charcoal-200 bg-white p-3 shadow-xl">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-charcoal-900">Notifications</p>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        className="text-[11px] font-medium text-brand-600 hover:text-brand-700"
                        onClick={() => markAllRead.mutate()}
                        disabled={markAllRead.isPending}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="mt-2 max-h-80 space-y-1 overflow-y-auto">
                    <BellList
                      items={bellList.data?.items ?? []}
                      loading={bellList.isLoading}
                      onNavigate={() => setBellOpen(false)}
                      onMarkRead={(id) => markOneRead.mutate(id)}
                    />
                  </div>
                  <Link
                    to={PAGE_PATHS.notifications}
                    onClick={() => setBellOpen(false)}
                    className="mt-2 block border-t border-charcoal-100 pt-2 text-center text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    View all notifications
                  </Link>
                </div>
              )}
            </div>

            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                className="flex items-center gap-1.5 rounded-full p-1 hover:bg-charcoal-100"
                aria-label="Account menu"
                aria-expanded={profileOpen}
              >
                <Avatar initials={initials} size="sm" />
                <ChevronDown className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 z-40 mt-2 w-52 rounded-xl border border-charcoal-200 bg-white py-1.5 shadow-xl">
                  <div className="px-3 py-1.5">
                    <p className="truncate text-xs font-semibold text-charcoal-900">{fullName}</p>
                    <p className="truncate text-[11px] text-charcoal-500">{portal.me.email}</p>
                  </div>
                  <div className="my-1 border-t border-charcoal-100" />
                  {DROPDOWN_ITEMS.map((item) => (
                    <Link
                      key={item.id}
                      to={item.path}
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs text-charcoal-700 hover:bg-charcoal-50"
                    >
                      <item.icon className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
                      {item.label}
                    </Link>
                  ))}
                  <div className="my-1 border-t border-charcoal-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false)
                      setLogoutOpen(true)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* relative: keeps page content painted above the fixed backdrop */}
        <main className="relative w-full px-4 pb-24 pt-4 sm:px-5 lg:px-6 lg:pb-8">
          <Outlet />
        </main>

        <nav
          className="safe-bottom fixed bottom-0 left-0 right-0 z-30 flex border-t border-charcoal-200 bg-white lg:hidden"
          aria-label="Mobile"
        >
          {MOBILE_ITEMS.map((item) => {
            const isNotifications = item.id === 'notifications'
            return (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) =>
                  cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium', isActive ? 'text-brand-600' : 'text-charcoal-500')
                }
              >
                <span className="relative">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  {isNotifications && unreadCount > 0 && (
                    <span className="absolute -right-1.5 -top-0.5 h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" />
                  )}
                </span>
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        title="Sign out?"
        message="You will need to sign in again to use the portal."
        confirmLabel="Sign out"
        danger
        onConfirm={() => {
          setLogoutOpen(false)
          signOut()
          navigate('/login', { replace: true })
        }}
        onCancel={() => setLogoutOpen(false)}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Bell dropdown list                                                 */
/* ------------------------------------------------------------------ */

function BellList({
  items,
  loading,
  onNavigate,
  onMarkRead,
}: {
  items: NotificationRow[]
  loading: boolean
  onNavigate: () => void
  onMarkRead: (id: number) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Spinner className="h-5 w-5 text-brand-600" />
      </div>
    )
  }

  if (items.length === 0) {
    return <p className="py-6 text-center text-xs text-charcoal-500">No notifications yet.</p>
  }

  return (
    <>
      {items.map((item) => {
        const target = (item.link ? (PAGE_PATHS as Record<string, string>)[item.link] : undefined) ?? PAGE_PATHS.notifications
        return (
          <Link
            key={item.id}
            to={target}
            onClick={() => {
              if (!item.read) onMarkRead(item.id)
              onNavigate()
            }}
            className={cn('notif-item rounded-lg p-1.5 hover:bg-charcoal-50', !item.read && 'bg-charcoal-50/60')}
          >
            <span className="notif-icon">
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-charcoal-900">{item.title}</span>
              <span className="line-clamp-2 block text-[11px] text-charcoal-500">{item.description}</span>
              <span className="mt-0.5 block text-[10px] text-charcoal-400">{timeAgo(item.date)}</span>
            </span>
            {!item.read && <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-500" aria-hidden="true" />}
          </Link>
        )
      })}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Gym switcher (multi-gym sessions, ADR-002 Amendment 1)             */
/* ------------------------------------------------------------------ */

function GymSwitcher() {
  const portal = usePortalSession()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const ref = useDismissable(open, () => setOpen(false))

  if (!portal.me) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={portal.switching}
        className="flex max-w-40 items-center gap-1 rounded-lg border border-charcoal-200 px-2.5 py-1.5 text-xs font-medium text-charcoal-700 hover:bg-charcoal-50 lg:max-w-none"
        aria-label="Switch gym"
        aria-expanded={open}
      >
        <span className="truncate">{portal.me.activeGym?.gymName ?? 'Choose gym'}</span>
        {portal.switching ? <Spinner className="h-3 w-3" /> : <ChevronDown className="h-3 w-3 flex-shrink-0 text-charcoal-400" aria-hidden="true" />}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-charcoal-200 bg-white py-1.5 shadow-xl">
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-charcoal-400">Your gyms</p>
          {portal.me.gyms.map((gym) => {
            const active = gym.gymId === portal.me?.activeGym?.gymId
            return (
              <button
                key={gym.gymId}
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs text-charcoal-700 hover:bg-charcoal-50 disabled:opacity-60"
                onClick={async () => {
                  setOpen(false)
                  if (active) return
                  try {
                    await portal.switchGym(gym.gymId)
                    // The new gym is a different context (role, led team, pages):
                    // land on the dashboard instead of staying on a page that may
                    // not exist for this gym's role (e.g. a BM-only attendance URL).
                    navigate('/employee/dashboard')
                  } catch (error) {
                    // A failed switch leaves the session on the current gym, so
                    // say why instead of looking like a dead button (e.g. the
                    // API was unreachable for a moment).
                    toast(`Could not switch gym — ${describeApiError(error)}`, 'error')
                  }
                }}
              >
                <span className="truncate">{gym.gymName}</span>
                {active && <Check className="h-3.5 w-3.5 flex-shrink-0 text-brand-600" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
