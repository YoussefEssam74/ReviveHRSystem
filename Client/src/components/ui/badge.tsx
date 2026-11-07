import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { statusBadgeClass } from '../../lib/format'

export interface BadgeProps {
  children: ReactNode
  /** Precomputed Tailwind ring/text classes (e.g. from statusBadgeClass). */
  className?: string
  /** When set, derives colors from a known status string. */
  status?: string
}

/** Small pill used for statuses across the console. */
export function Badge({ children, className, status }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        status ? statusBadgeClass(status) : 'bg-slate-100 text-slate-600 ring-slate-200',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Status pill with a leading dot, matching the mock's status chips. */
export function StatusBadge({ status }: { status: string | null | undefined }) {
  const label = status ?? '—'
  return <Badge status={status ?? undefined}>{label}</Badge>
}
