import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDate, initialsOf } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import type { Separation } from '../api/terminations.api'

/** Employee avatar + name + position, shared by every workflow table. */
export function EmployeeCell({ separation }: { separation: Separation }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-[11px] font-semibold text-red-700 ring-1 ring-red-100"
        aria-hidden="true"
      >
        {initialsOf(separation.employee)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-charcoal-900">{separation.employee}</p>
        <p className="truncate text-[11px] text-charcoal-500">
          {separation.employeeNumber ? `${separation.employeeNumber} · ` : ''}
          {separation.position}
        </p>
      </div>
    </div>
  )
}

/** Filter chip used above the workflow tables. */
export function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
        active ? 'bg-charcoal-900 text-white' : 'bg-charcoal-50 text-charcoal-600 hover:bg-charcoal-100',
      )}
    >
      {children}
    </button>
  )
}

/** Section card used by the exit interview form. */
export function FormSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-xl border border-charcoal-200 bg-white p-3', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-charcoal-900">{title}</h3>
          {description && <p className="mt-0.5 text-[11px] text-charcoal-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  )
}

/** Read-only label/value pair used by the employee-information block. */
export function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-charcoal-400">{label}</p>
      <p className="truncate text-xs font-medium text-charcoal-800" title={typeof value === 'string' ? value : undefined}>
        {value || '—'}
      </p>
    </div>
  )
}

/** "yyyy-MM-dd" + "HH:mm" for <input type="date"|"time"> from an ISO timestamp. */
export function localDateTimeInputs(value: string | null | undefined): { date: string; time: string } {
  if (!value) return { date: '', time: '' }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return { date: '', time: '' }
  const pad = (part: number) => String(part).padStart(2, '0')
  return {
    date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
  }
}

/** Local date + time inputs → ISO instant; null when either part is missing. */
export function isoFromLocalInputs(date: string, time: string): string | null {
  if (!date) return null
  const parsed = new Date(`${date}T${time || '09:00'}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/** Today as yyyy-MM-dd (for scheduling defaults). */
export function todayInputValue(): string {
  return localDateTimeInputs(new Date().toISOString()).date
}

/** "Oct 14, 2025" style hire/termination dates. */
export function fullDate(value: string | null | undefined): string {
  return formatDate(value, { withYear: 'always' })
}

/** The employee-information strip shown above every request/interview form. */
export function EmployeeSummary({ separation }: { separation: Separation }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-charcoal-200 bg-charcoal-50/70 px-3 py-2.5">
      <EmployeeCell separation={separation} />
      <div className="grid flex-1 grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
        <InfoItem label={t('Branch')} value={separation.gym} />
        <InfoItem label={t('Hire date')} value={fullDate(separation.hireDate)} />
        <InfoItem label={t('Last working day')} value={fullDate(separation.lastDay)} />
        <InfoItem label={t('Request date')} value={fullDate(separation.submittedDate)} />
      </div>
    </div>
  )
}
