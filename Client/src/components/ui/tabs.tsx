import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/utils'

export interface TabItem<T extends string> {
  value: T
  label: string
  /** Optional count shown next to the label. */
  count?: number
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  /** `compact` = the mock's small charcoal segmented bar (HR dialog/section tabs). */
  variant?: 'default' | 'compact'
}

/** Segmented tab bar used for list filters (requests status, employee views). */
export function Tabs<T extends string>({ items, value, onChange, className, variant = 'default' }: TabsProps<T>) {
  const { t } = useTranslation()
  const compact = variant === 'compact'
  return (
    <div
      className={cn(
        'flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1',
        compact && 'gap-0.5 rounded-lg bg-charcoal-100 p-0.5',
        className,
      )}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              compact && 'gap-1 rounded-md px-3 py-1.5 text-[11px]',
              active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
              compact && !active && 'text-charcoal-500 hover:text-charcoal-700',
            )}
          >
            {t(item.label)}
            {item.count != null && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs',
                  compact && 'rounded-md px-1 text-[10px]',
                  active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600',
                  compact && !active && 'bg-charcoal-200 text-charcoal-600',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
