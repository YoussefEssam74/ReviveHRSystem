import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronLeft, KeyRound, Languages, LogOut, Menu, Moon, Settings, Sun, X } from 'lucide-react'
import { useAuthSession } from '../../../contexts/AuthSessionContext'
import { useMe } from '../../../contexts/MeContext'
import { useTheme } from '../../../contexts/ThemeContext'
import { useLanguage } from '../../../i18n/useLanguage'
import { MAIN_NAV, ADMIN_NAV, type NavItem } from '../nav'
import { GymSwitcher } from './GymSwitcher'
import { NotificationsBell } from './NotificationsBell'
import { ConsoleHeaderSlotProvider, useConsoleHeaderInfoValue } from './ConsoleHeaderSlot'
import { Avatar } from '../../../components/ui/avatar'
import { initialsOf } from '../../../lib/format'
import { cn } from '../../../lib/utils'

function navLinkClass(isActive: boolean) {
  return cn(
    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  )
}

/** Closes an open popover on outside click / Escape (same behaviour as the portal). */
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
  const { language, toggleLanguage } = useLanguage()
  const { isDark, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useDismiss(menuOpen, setMenuOpen)

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

      {/* Account block, mirroring the employee portal's sidebar footer. */}
      <div className="relative flex-shrink-0 border-t border-charcoal-100 p-3" ref={menuRef}>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-lg p-1 text-start transition-colors hover:bg-charcoal-50"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={t('Account menu')}
        >
          <Avatar name={initialsOf(me?.userName)} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-charcoal-900">{me?.userName ?? t('Signed in')}</span>
            <span className="block truncate text-xs text-charcoal-500">{me?.roleInActiveGym ?? me?.userType ?? ''}</span>
          </span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 flex-shrink-0 text-charcoal-400 transition-transform', menuOpen && 'rotate-180')}
            aria-hidden="true"
          />
        </button>

        {menuOpen && (
          <div className="absolute bottom-full start-3 z-40 mb-2 w-52 rounded-xl border border-charcoal-200 bg-white py-1.5 shadow-xl" role="menu">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={language === 'ar'}
              aria-label={t('Change language')}
              onClick={() => {
                toggleLanguage()
                setMenuOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-charcoal-700 hover:bg-charcoal-50"
            >
              <Languages className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
              <span className="flex-1 text-start">{t('Language')}</span>
              <span className="rounded-md border border-charcoal-200 px-1.5 py-0.5 text-[10px] font-semibold text-charcoal-600">
                {language === 'ar' ? 'العربية' : 'English'}
              </span>
            </button>
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
              <span className="flex-1 text-start">{t('Dark mode')}</span>
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
}

/** Header account menu — the employee portal's avatar dropdown, console routes. */
function AccountMenu() {
  const { t } = useTranslation()
  const { me } = useMe()
  const { signOut } = useAuthSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, setOpen)

  const items = [
    { to: '/console/my-access', label: t('My Access'), icon: KeyRound },
    { to: '/console/settings', label: t('Settings'), icon: Settings },
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="touch-target flex items-center gap-1.5 rounded-full p-1 hover:bg-charcoal-100"
        aria-label={t('Account menu')}
        aria-expanded={open}
      >
        <Avatar name={initialsOf(me?.userName)} size="sm" />
        <ChevronDown className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute end-0 z-40 mt-2 w-52 rounded-xl border border-charcoal-200 bg-white py-1.5 shadow-xl">
          <div className="px-3 py-1.5">
            <p className="truncate text-xs font-semibold text-charcoal-900">{me?.userName ?? t('Signed in')}</p>
            <p className="truncate text-[11px] text-charcoal-500">{me?.roleInActiveGym ?? me?.userType ?? ''}</p>
          </div>
          <div className="my-1 border-t border-charcoal-100" />
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
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

/** The HR console shell: fixed sidebar (desktop) / drawer (mobile) + header. */
export function ConsoleLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [lastPath, setLastPath] = useState(location.pathname)
  const headerInfo = useConsoleHeaderInfoValue()

  // Close the mobile drawer whenever the route changes (incl. back/forward).
  // Adjusting state during render (not in an effect) avoids a cascading render.
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setMobileOpen(false)
  }

  return (
    <ConsoleHeaderSlotProvider>
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
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {/* A page that publishes header info turns this button into "back". */}
                {headerInfo ? (
                  <button
                    type="button"
                    onClick={headerInfo.onBack}
                    aria-label={t('Back')}
                    title={t('Back')}
                    className="touch-target flex-shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMobileOpen(true)}
                    aria-label={t('Open menu')}
                    className="touch-target rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
                  >
                    <Menu className="h-5 w-5" aria-hidden="true" />
                  </button>
                )}

                {headerInfo && (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{headerInfo.label}</p>
                    {headerInfo.hint && <p className="truncate text-[11px] text-slate-500">{headerInfo.hint}</p>}
                  </div>
                )}
              </div>

              <div className="flex flex-shrink-0 items-center gap-2">
                <GymSwitcher />
                <NotificationsBell />
                <AccountMenu />
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-[1600px] px-4 py-4">
            <Outlet />
          </main>
        </div>
      </div>
    </ConsoleHeaderSlotProvider>
  )
}
