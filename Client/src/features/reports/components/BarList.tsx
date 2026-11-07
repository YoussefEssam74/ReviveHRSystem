import { cn } from '../../../lib/utils'

export interface BarItem {
  label: string
  value: number
  /** Optional pill classes for the label chip (e.g. from statusBadgeClass). */
  chipClass?: string
}

/** A simple CSS bar list — label, value, and a proportional emerald bar. */
export function BarList({ items, className }: { items: BarItem[]; className?: string }) {
  const max = items.reduce((peak, item) => Math.max(peak, item.value), 0)

  return (
    <ul className={cn('space-y-2.5', className)}>
      {items.map((item) => {
        const width = max > 0 ? (item.value / max) * 100 : 0
        return (
          <li key={item.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              {item.chipClass ? (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                    item.chipClass,
                  )}
                >
                  {item.label}
                </span>
              ) : (
                <span className="text-slate-600">{item.label}</span>
              )}
              <span className="font-semibold tabular-nums text-slate-900">{item.value.toLocaleString()}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${width}%` }} aria-hidden="true" />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
