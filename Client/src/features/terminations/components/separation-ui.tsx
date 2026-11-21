import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '../../../components/ui/badge'
import { formatMoney } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import type { SeparationVerdict } from '../api/terminations.api'
import { gymTone } from './separation-utils'

export function GymPill({ gym, className }: { gym: string | null | undefined; className?: string }) {
  if (!gym) return null
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        gymTone(gym),
        className,
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      <span className="truncate">{gym}</span>
    </span>
  )
}

/** Settlement + rehire pills carried by a saved verdict. */
export function VerdictChips({ verdict, className }: { verdict: SeparationVerdict | null; className?: string }) {
  const { t } = useTranslation()
  if (!verdict) return null
  const settlement = verdict.settlement
  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {settlement?.direction === 'owedToEmployee' ? (
        <Badge color="green">{t('Pay out {{amount}}', { amount: formatMoney(settlement.amount) })}</Badge>
      ) : settlement?.direction === 'employeeOwes' ? (
        <Badge color="red">{t('Owes {{amount}}', { amount: formatMoney(settlement.amount) })}</Badge>
      ) : (
        <Badge color="gray">{t('No balance')}</Badge>
      )}
      {verdict.rehire &&
        (verdict.rehire.status === 'Eligible' ? (
          <Badge color="green">{t('Rehire eligible')}</Badge>
        ) : (
          <Badge color="red">{t(verdict.rehire.status)}</Badge>
        ))}
    </div>
  )
}

/** White sub-card used by the detail dialog sections. */
export function Block({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-charcoal-200 p-2.5">
      {(title || action) && (
        <div className="flex items-center justify-between gap-2">
          {title && (
            <p className="text-[10px] font-semibold uppercase tracking-wide text-charcoal-400">{title}</p>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
