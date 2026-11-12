import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogOut, Menu, X } from 'lucide-react'
import { useAuthSession } from '../../../contexts/AuthSessionContext'
import { useMe } from '../../../contexts/MeContext'
import { MAIN_NAV, ADMIN_NAV, type NavItem } from '../nav'
import { GymSwitcher } from './GymSwitcher'
import { NotificationsBell } from './NotificationsBell'
import { Avatar } from '../../../components/ui/avatar'
import { initialsOf } from '../../../lib/format'
import { cn } from '../../../lib/utils'

function navLinkClass(isActive: boolean) {
  return cn(
    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  )
}

function NavItemLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const { t } = useTranslation()
  const Icon = item.icon
  return (
    <NavLink to={item.to} end={item.to === '/dashboard'} className={({ isActive }) => navLinkClass(isActive)} onClick={onNavigate}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{t(item.label)}</span>
    </NavLink>
  )
}

function NavSection({ title, items, onNavigate }: { title?: string; items: NavItem[]; onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { can } = useMe()
  const visible = items.filter((item) => !item.feature || can(item.feature))
  if (visible.length === 0) return null
  return (
    <div className="space-y-1">
      {title && <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">{t(title)}</p>}
      {visible.map((item) => (
        <NavItemLink key={item.to} item={item} onNavigate={onNavigate} />
      ))}
    </div>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { me } = useMe()
  const { signOut } = useAuthSession()
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">R</span>
        <span className="text-lg font-bold tracking-tight text-slate-900">Revive HR</span>
      </div>

      <nav aria-label={t('Main')} className="flex-1 overflow-y-auto px-3 pb-4">
        <NavSection items={MAIN_NAV} onNavigate={onNavigate} />
        <NavSection title="Administration" items={ADMIN_NAV} onNavigate={onNavigate} />
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <Avatar name={initialsOf(me?.userName)} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{me?.userName ?? t('Signed in')}</p>
            <p className="truncate text-xs text-slate-500">{me?.roleInActiveGym ?? me?.userType ?? ''}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            signOut()
            navigate('/login')
          }}
          className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {t('Sign out')}
        </button>
      </div>
    </div>
  )
}

/** The HR console shell: fixed sidebar (desktop) / drawer (mobile) + header. */
export function ConsoleLayout() {
  const { t } = useTranslation()
  const { me } = useMe()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [lastPath, setLastPath] = useState(location.pathname)

  // Close the mobile drawer whenever the route changes (incl. back/forward).
  // Adjusting state during render (not in an effect) avoids a cascading render.
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setMobileOpen(false)
  }

  return (
    <div className="hr-portal min-h-screen bg-charcoal-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-20 hidden w-64 border-e border-slate-200 bg-white lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label={t('Close menu')}
              className="touch-target absolute end-2 top-2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Content + header */}
      <div className="lg:ps-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label={t('Open menu')}
              className="touch-target rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="flex flex-1 items-center justify-end gap-2 sm:justify-between">
              <div className="hidden sm:block">
                <GymSwitcher />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="sm:hidden">
                  <GymSwitcher />
                </div>
                <NotificationsBell />
                <span className="ms-1 hidden items-center gap-2 sm:flex">
                  <Avatar name={initialsOf(me?.userName)} size="sm" />
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] px-4 py-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
