import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { Badge, type BadgeColor } from './badge'
import { Button } from './button'
import { Skeleton } from './skeleton'

/* ==================== Empty state ==================== */

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty-state flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="text-charcoal-400">{icon}</div>}
      <p className="text-sm font-medium text-charcoal-700">{title}</p>
      {hint && <p className="max-w-sm text-xs text-charcoal-500">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/* ==================== Section card ==================== */

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('card overflow-hidden', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-4 pb-3 pt-3.5">
          <div className="min-w-0">
            {title && <h2 className="truncate text-sm font-semibold text-charcoal-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[11px] text-charcoal-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn('px-4 pb-4', bodyClassName)}>{children}</div>
    </section>
  )
}

/* ==================== Stat tiles ==================== */

export function StatTile({
  label,
  value,
  accent = false,
  badge,
  onClick,
  className,
}: {
  label: string
  value: ReactNode
  accent?: boolean
  badge?: { color: BadgeColor; text: string }
  onClick?: () => void
  className?: string
}) {
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'card block px-3 py-2.5 text-left',
        accent && 'stat-highlight border-l-4 border-l-brand-600',
        onClick && 'card-interactive',
        className,
      )}
    >
      <p className="bento-label">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-lg font-bold text-charcoal-900">{value}</span>
        {badge && <Badge color={badge.color}>{badge.text}</Badge>}
      </div>
    </Wrapper>
  )
}

export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6', className)}>{children}</div>
}

/* ==================== Progress ==================== */

export function ProgressBar({ value, max = 100, colorClass = 'bg-brand-600', className }: { value: number; max?: number; colorClass?: string; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-charcoal-200', className)}>
      <div className={cn('h-full rounded-full transition-all', colorClass)} style={{ width: `${pct}%` }} />
    </div>
  )
}

/* ==================== Tabs ==================== */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { id: T; label: string; count?: number }[]
  value: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-1 overflow-x-auto border-b border-charcoal-200', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={cn('tab-btn', value === tab.id && 'active')}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {typeof tab.count === 'number' && <span className="ml-1.5 text-[10px] text-charcoal-500">{tab.count}</span>}
        </button>
      ))}
    </div>
  )
}

/* ==================== Avatar ==================== */

export function Avatar({ initials, size = 'md', className }: { initials: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-base' }
  return (
    <div
      className={cn('flex flex-shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700', sizes[size], className)}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}

/* ==================== Table loading skeleton ==================== */

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  )
}

/* ==================== Page header ==================== */

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-charcoal-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-charcoal-500">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  )
}

export { Button }
