import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Search } from 'lucide-react'
import { Input } from '../../../components/ui/input'
import { formatDate, initialsOf } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import type { Separation } from '../api/terminations.api'

/** Employee avatar + name + position, shared by every workflow table. */
export function EmployeeCell({ separation, extra }: { separation: Separation; extra?: ReactNode }) {
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
        {extra}
      </div>
    </div>
  )
}

/**
 * One toolbar row that replaces the stacked filter bars above the workflow
 * tables: search on the start side, compact dropdowns on the end side.
 */
export function ListToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 border-b border-charcoal-100 px-3 py-2.5', className)}>
      {children}
    </div>
  )
}

/** Search box sized for a toolbar row. */
export function ToolbarSearch({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (next: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <div className={cn('relative min-w-[180px] flex-1', className)}>
      <Search
        className="pointer-events-none absolute inset-y-0 start-2.5 my-auto h-3.5 w-3.5 text-charcoal-400"
        aria-hidden="true"
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 ps-8 text-xs"
      />
    </div>
  )
}

/** Compact native select for a toolbar row (counts live in the option labels). */
export function ToolbarSelect({
  value,
  onChange,
  label,
  children,
  className,
}: {
  value: string
  onChange: (next: string) => void
  /** Accessible name — the toolbar shows no visible label. */
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('relative shrink-0', className)}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="h-8 w-full appearance-none rounded-lg border border-charcoal-200 bg-white ps-2.5 pe-7 text-xs font-medium text-charcoal-700 transition-colors hover:border-charcoal-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute end-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-charcoal-400"
        aria-hidden="true"
      />
    </div>
  )
}

/** Muted footnote shown at the bottom of a workflow table card. */
export function ListFootnote({ children }: { children: ReactNode }) {
  return (
    <p className="border-t border-charcoal-100 bg-charcoal-50/40 px-3 py-2 text-[11px] leading-relaxed text-charcoal-500">
      {children}
    </p>
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
