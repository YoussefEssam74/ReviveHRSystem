import { Suspense } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Languages, Moon, Sun } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useLanguage } from '../../i18n/useLanguage'
import { LoadingState } from '../async-state'
import { cn } from '../../lib/utils'

const iconButtonClass =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition-colors hover:border-emerald-300 hover:text-emerald-700'

const CURRENT_YEAR = new Date().getFullYear()

/**
 * Shell for the public careers site (`/apply/*`).
 *
 * Deliberately separate from AppLayout: these pages are shared with candidates,
 * so the staff chrome (Dashboard, Sign out, station tools) must never render
 * here — even when the visitor happens to be signed in to Revive HR.
 */
export function CareersLayout() {
  const { t } = useTranslation()
  const { language, toggleLanguage } = useLanguage()
  const { isDark, toggleTheme } = useTheme()

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            to="/apply"
            className="flex min-w-0 items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-sm font-bold text-white shadow-sm shadow-emerald-600/25">
              R
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-bold tracking-tight text-slate-900">Revive HR</span>
              <span className="text-[11px] font-semibold text-emerald-700">{t('Careers')}</span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={toggleLanguage}
              aria-label={t('Change language')}
              title={t('Change language')}
              className={iconButtonClass}
            >
              <Languages className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{language === 'ar' ? 'English' : 'العربية'}</span>
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? t('Switch to light mode') : t('Switch to dark mode')}
              title={isDark ? t('Switch to light mode') : t('Switch to dark mode')}
              className={cn(iconButtonClass, 'w-8 px-0')}
            >
              {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {CURRENT_YEAR} Revive HR</p>
          <p>{t('Your details are used only for recruitment.')}</p>
        </div>
      </footer>
    </div>
  )
}
