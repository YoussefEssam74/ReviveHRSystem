import { useTranslation } from 'react-i18next'
import { cn } from '../../../lib/utils'
import { formatMoney } from '../../../lib/format'

/** Short EGP figure for chart labels: 36,000 → "36k". */
function compactMoney(value: number) {
  if (value >= 1_000_000) return `${Math.round(value / 100_000) / 10}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`
  return String(Math.round(value))
}

/**
 * Billing months as columns with a value axis.
 *
 * The console's ledgers are often flat (one plan, one invoice per month), and a
 * bare set of equal columns reads as an empty block — so the gridlines, the
 * per-month figures and the axis are part of the chart, not decoration.
 */
export function MonthChart({
  rows,
  currentLabel,
  ariaLabel,
  footer,
}: {
  rows: { label: string; value: number }[]
  currentLabel?: string
  ariaLabel: string
  /** Extra line under the chart; the totals row is always shown. */
  footer?: React.ReactNode
}) {
  const { t } = useTranslation()
  const peak = Math.max(...rows.map((row) => row.value), 1)
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  const average = rows.length > 0 ? total / rows.length : 0
  const best = rows.reduce((top, row) => (row.value > top.value ? row : top), rows[0])
  // A flat series has no "best" month — naming one would be a lie.
  const flat = rows.every((row) => row.value === rows[0]?.value)

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          {[0, 0.5, 1].map((fraction) => (
            <div
              key={fraction}
              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-charcoal-200"
              style={{ bottom: `${fraction * 84}px` }}
              aria-hidden="true"
            />
          ))}
          <div className="relative flex h-[84px] items-end gap-1" role="img" aria-label={ariaLabel}>
            {rows.map((row, index) => {
              const active = currentLabel !== undefined && row.label === currentLabel
              const height = row.value > 0 ? Math.max(6, Math.round((row.value / peak) * 100)) : 3
              return (
                <div
                  key={`${row.label}-${index}`}
                  className="group flex h-full flex-1 flex-col justify-end"
                  title={`${row.label} · ${formatMoney(row.value)}`}
                >
                  <span
                    className={cn(
                      'mb-0.5 truncate text-center text-[8px] tabular-nums',
                      active ? 'font-bold text-brand-700' : 'text-charcoal-400',
                    )}
                  >
                    {row.value > 0 ? compactMoney(row.value) : '—'}
                  </span>
                  <span
                    className={cn(
                      'w-full rounded-t-[3px] transition-colors',
                      active ? 'bg-brand-600' : 'bg-brand-300 group-hover:bg-brand-400',
                    )}
                    style={{ height: `${height}%` }}
                  />
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex w-9 flex-col justify-between pb-[14px] text-end text-[8px] tabular-nums text-charcoal-400">
          <span>{compactMoney(peak)}</span>
          <span>{compactMoney(peak / 2)}</span>
          <span>0</span>
        </div>
      </div>

      <div className="mt-1 flex gap-1">
        {rows.map((row, index) => (
          <span
            key={`${row.label}-label-${index}`}
            className={cn(
              'min-w-0 flex-1 truncate text-center text-[8px]',
              row.label === currentLabel ? 'font-semibold text-brand-700' : 'text-charcoal-400',
            )}
          >
            {row.label.split(' ')[0]}
          </span>
        ))}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-t border-charcoal-100 pt-1.5 text-[10px]">
        <span className="text-charcoal-500">
          {t('Total')} <span className="font-semibold text-charcoal-800">{formatMoney(total)}</span>
          {footer}
        </span>
        <span className="text-charcoal-500">
          {t('Average {{amount}}/month', { amount: formatMoney(Math.round(average)) })}
          {!flat && best && best.value > 0 && ` · ${t('best {{month}}', { month: best.label })}`}
        </span>
      </div>
    </div>
  )
}
