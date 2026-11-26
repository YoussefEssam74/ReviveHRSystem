import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, AlertTriangle, ChevronRight, Inbox, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../../lib/utils'
import { Spinner } from '../../../components/async-state'

/**
 * Compact building blocks for the Super Admin console.
 *
 * Shapes and density mirror `Mock UI/Super Admin2` exactly: 10px-radius cards on
 * 1px borders, 10-12px type, 32px controls, and a page shell that fills the
 * viewport so only a table body ever scrolls. They live here — rather than in
 * `components/ui` — because the HR portal keeps its roomier scale.
 */

export function PlatformPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('pc-page gap-2.5', className)}>{children}</div>
}

export function PlatformPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h1 className="text-[1.125rem] font-bold leading-tight text-charcoal-800">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[0.625rem] text-charcoal-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
  )
}

export function Panel({
  children,
  className,
  grow = false,
}: {
  children: ReactNode
  className?: string
  /** Fill the remaining page height and scroll the inner body. */
  grow?: boolean
}) {
  return <div className={cn('pc-card', grow && 'pc-card-grow', className)}>{children}</div>
}

export function PanelHead({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('pc-card-head', className)}>{children}</div>
}

export function PanelLabel({ children }: { children: ReactNode }) {
  return <p className="pc-card-label min-w-0 flex-1 truncate">{children}</p>
}

/** KPI tile: label + value on the left, a small tinted icon on the right. */
export function KpiTile({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon: LucideIcon
  tone?: 'red' | 'amber'
}) {
  return (
    <Panel className="px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="pc-stat-label">{label}</p>
          <p
            className={cn(
              'pc-stat-value mt-0.5',
              tone === 'red' && 'text-red-600',
              tone === 'amber' && 'text-amber-600',
            )}
          >
            {value}
          </p>
        </div>
        <span
          className={cn(
            'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg',
            tone === 'red'
              ? 'bg-red-50 text-red-600'
              : tone === 'amber'
                ? 'bg-amber-50 text-amber-600'
                : 'bg-charcoal-100 text-charcoal-500',
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
      {sub !== undefined && <p className="pc-stat-sub mt-1">{sub}</p>}
    </Panel>
  )
}

/** Clickable headline figure that opens its own breakdown page (mock `.stat-card`). */
export function MetricCard({
  to,
  label,
  value,
  sub,
  tone,
}: {
  to: string
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'red' | 'amber'
}) {
  return (
    <Link
      to={to}
      className="group pc-card block px-3 py-2 text-start transition-colors hover:border-brand-200 hover:shadow-[0_2px_10px_-4px_rgba(0,108,73,0.28)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
    >
      <span className="flex items-center gap-1.5">
        <span className="pc-stat-label min-w-0 flex-1 truncate">{label}</span>
        <ChevronRight
          className="h-3 w-3 flex-shrink-0 text-charcoal-300 transition-colors group-hover:text-brand-600"
          aria-hidden="true"
        />
      </span>
      <span
        className={cn(
          'pc-stat-value mt-0.5 block',
          tone === 'red' && 'text-red-600',
          tone === 'amber' && 'text-amber-600',
        )}
      >
        {value}
      </span>
      {sub !== undefined && <span className="pc-stat-sub mt-1 block truncate">{sub}</span>}
    </Link>
  )
}

/** A figure inside a summary strip. */export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="pc-stat-label truncate">{label}</p>
      <p className="pc-stat-value">{value}</p>
    </div>
  )
}

/** One card, several figures, thin dividers — the mock's "quiet summary strip". */
export function SummaryStrip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('pc-card flex flex-wrap items-stretch px-1 py-1.5', className)}>{children}</div>
}

export function SummaryItem({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'green' | 'red' | 'amber'
}) {
  return (
    <div className="min-w-0 flex-1 basis-40 px-2.5 [&:not(:first-child)]:border-s [&:not(:first-child)]:border-charcoal-100">
      <p className="pc-stat-label truncate">{label}</p>
      <p
        className={cn(
          'text-sm font-bold leading-tight text-charcoal-900',
          tone === 'green' && 'text-brand-700',
          tone === 'amber' && 'text-amber-600',
          tone === 'red' && 'text-red-600',
        )}
      >
        {value}
      </p>
      {hint !== undefined && <p className="pc-stat-sub truncate">{hint}</p>}
    </div>
  )
}

/** Labelled filter row: filters at the start edge, search pinned to the end. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-1.5', className)}>{children}</div>
}

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('pc-table-wrap', className)}>{children}</div>
}

export function PTable({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={cn('pc-table', className)}>{children}</table>
}

export function PThead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>
}

export function PTh({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={className} {...props}>
      {children}
    </th>
  )
}

export function PTbody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>
}

export function PTr({
  children,
  className,
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <tr className={cn(onClick && 'is-clickable', className)} onClick={onClick}>
      {children}
    </tr>
  )
}

export function PTd({ children, className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={className} {...props}>
      {children}
    </td>
  )
}

/** Card-sized loading placeholder — one short row, so the card keeps its shape. */
export function PanelLoading({ label }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-charcoal-400">
      <Spinner className="h-4 w-4" />
      <span>{label ?? 'Loading…'}</span>
    </div>
  )
}

/** Card-sized failure with the shared retry affordance. */
export function PanelError({
  title,
  message,
  onRetry,
  compact = false,
}: {
  title: string
  message?: string
  onRetry?: () => void
  compact?: boolean
}) {
  if (compact) {
    return (
      <div className="pc-empty gap-1">
        <AlertTriangle className="h-5 w-5 text-red-500" aria-hidden="true" />
        <p className="font-medium text-red-700">{title}</p>
        {message && <p className="text-[0.625rem] text-charcoal-400">{message}</p>}
        {onRetry && (
          <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    )
  }

  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
      <AlertCircle className="h-7 w-7 text-red-500" aria-hidden="true" />
      <p className="text-sm font-semibold text-red-800">{title}</p>
      {message && <p className="text-[0.6875rem] text-red-700">{message}</p>}
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function PanelEmpty({
  title,
  hint,
  icon: Icon = Inbox,
}: {
  title: string
  hint?: string
  icon?: LucideIcon
}) {
  return (
    <div className="pc-empty">
      <Icon className="mb-1.5 h-6 w-6" aria-hidden="true" />
      <p className="font-medium text-charcoal-500">{title}</p>
      {hint && <p className="mt-0.5 text-[0.625rem]">{hint}</p>}
    </div>
  )
}

/** Footer strip for a paged panel: "showing x–y of n" on one line. */
export function PanelFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-2 border-t border-charcoal-100 px-3 py-1.5', className)}>
      {children}
    </div>
  )
}

/** Compact pager used by every list page. */
export function Pager({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  noun,
}: {
  page: number
  pageSize: number
  total: number
  totalPages: number
  onPageChange: (page: number) => void
  noun?: string
}) {
  const { t } = useTranslation()
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <PanelFooter>
      <p className="text-[10px] text-charcoal-500">
        {t('Showing')} <span className="font-semibold text-charcoal-700">{from}</span>–
        <span className="font-semibold text-charcoal-700">{to}</span> {t('of')}{' '}
        <span className="font-semibold text-charcoal-700">{total}</span> {noun ? t(noun) : t('results')}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="btn btn-secondary btn-sm disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {t('Previous')}
        </button>
        <span className="text-[10px] text-charcoal-500">
          {t('Page')} {page} / {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm disabled:opacity-40"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t('Next')}
        </button>
      </div>
    </PanelFooter>
  )
}

/** Thin usage bar; `tone` follows the mock's amber/red pressure thresholds. */export function Meter({ value, max }: { value: number; max: number | null }) {
  const percent = max && max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="pc-meter">
      <div
        className={cn('pc-meter-fill', percent >= 90 ? 'is-red' : percent >= 75 && 'is-amber')}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

/** Alert deep link: the queue carries a target kind, not a route. */
export function alertHref(alert: { actionTarget: string; companyId: number | null }) {
  if (alert.actionTarget === 'company-detail' && alert.companyId) return `/platform/companies/${alert.companyId}`
  if (alert.actionTarget === 'user-detail') return '/platform/users'
  return '/platform/dashboard'
}

/** Square monogram used for a gym account when no logo image is uploaded. */
export function GymMark({
  name,
  logoUrl,
  size = 'md',
}: {
  name: string
  logoUrl?: string | null
  size?: 'md' | 'lg'
}) {
  const box = size === 'lg' ? 'h-14 w-14 rounded-[10px] text-sm' : 'h-9 w-9 rounded-[7px] text-[0.6875rem]'

  if (logoUrl) {
    return (
      <span
        className={cn('flex-shrink-0 border border-brand-100 bg-cover bg-center', box)}
        style={{ backgroundImage: `url('${logoUrl}')` }}
        aria-hidden="true"
      />
    )
  }

  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <span
      className={cn(
        'flex flex-shrink-0 items-center justify-center border border-brand-100 bg-brand-50 font-bold text-brand-600',
        box,
      )}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}
