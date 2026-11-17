import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CalendarDays, CreditCard, MapPin } from 'lucide-react'
import { StatusBadge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { ErrorState, LoadingState } from '../../../components/async-state'
import {
  downloadDocumentFile,
  useEmployeeAttendance,
  useEmployeeDocuments,
  useEmployeeEvaluations,
  useEmployeeHistory,
  useEmployeeLeaveBalance,
  useEmployeePayroll,
  useEmployeeRequests,
  useEmployeeSchedule,
} from '../hooks/useEmployees'
import type { EmployeeProfile } from '../api/employees.api'
import { describeApiError } from '../../../lib/api-client'
import { cn } from '../../../lib/utils'
import { formatDateWithYear, formatMoney, formatTime, formatTimeOfDay, humanize } from '../../../lib/format'

/** The eight employee-file sections (mirrors the branch portal's management profile). */
const EMPLOYEE_FILE_TABS = [
  { id: 'personal', label: 'Personal' },
  { id: 'documents', label: 'Documents' },
  { id: 'employment', label: 'Employment' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'shift', label: 'Shift' },
  { id: 'requests', label: 'Requests' },
  { id: 'evals', label: 'Evaluations' },
  { id: 'payroll', label: 'Payroll' },
] as const

type EmployeeFileTabId = (typeof EMPLOYEE_FILE_TABS)[number]['id']

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Monday..Sunday dates of the week containing today. */
function currentWeekDates(): { label: string; date: string }[] {
  const anchor = new Date(`${todayIso()}T00:00:00`)
  const monday = new Date(anchor)
  monday.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, index) => {
    const cursor = new Date(monday)
    cursor.setDate(monday.getDate() + index)
    return {
      label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index],
      date: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`,
    }
  })
}

/** Explicit Mon–Sun window for GET /api/employees/{id}/schedule (inclusive). */
function currentWeekRange(): { from: string; to: string } {
  const week = currentWeekDates()
  return { from: week[0].date, to: week[6].date }
}

function currentMonthValue(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function time12(value: string | null): string {
  if (!value) return '—'
  const [hourPart, minutePart] = value.split(':')
  const hour = Number(hourPart)
  return `${hour % 12 === 0 ? 12 : hour % 12}:${minutePart} ${hour >= 12 ? 'PM' : 'AM'}`
}

/** The employee file card: tab strip + the selected section. */
export function EmployeeFile({ employee }: { employee: EmployeeProfile }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<EmployeeFileTabId>('personal')

  return (
    <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      <div className="flex overflow-x-auto border-b border-charcoal-100 bg-charcoal-50/60 px-1.5">
        {EMPLOYEE_FILE_TABS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setTab(option.id)}
            aria-current={tab === option.id ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors',
              tab === option.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-charcoal-500 hover:text-charcoal-700',
            )}
          >
            {t(option.label)}
          </button>
        ))}
      </div>
      <div className="p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {tab === 'personal' && <PersonalTab employee={employee} />}
        {tab === 'documents' && <DocumentsTab employeeId={employee.id} />}
        {tab === 'employment' && <EmploymentTab employeeId={employee.id} />}
        {tab === 'attendance' && <AttendanceTab employeeId={employee.id} />}
        {tab === 'shift' && <ShiftTab employeeId={employee.id} />}
        {tab === 'requests' && <RequestsTab employeeId={employee.id} />}
        {tab === 'evals' && <EvaluationsTab employeeId={employee.id} />}
        {tab === 'payroll' && <PayrollTab employeeId={employee.id} />}
      </div>
    </div>
  )
}

/* ==================== shared bits ==================== */

function TabCard({
  eyebrow,
  title,
  aside,
  children,
}: {
  eyebrow: string
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
      <div className="flex items-center justify-between border-b border-charcoal-100 bg-charcoal-50/50 px-3 py-1.5">
        <div>
          <p className="bento-label">{eyebrow}</p>
          <h3 className="mt-0.5 text-sm font-bold text-charcoal-900">{title}</h3>
        </div>
        {aside}
      </div>
      <div className="grid grid-cols-1 gap-x-2 gap-y-1.5 p-2.5 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <label className="bento-label text-charcoal-500">{label}</label>
      <p className="mt-0.5 text-xs text-charcoal-900">{value || '—'}</p>
    </div>
  )
}

function HrRow({
  label,
  value,
  icon,
  divider = true,
  valueClassName,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  divider?: boolean
  valueClassName?: string
}) {
  // A long value truncates in the narrow side card; the tooltip keeps it readable.
  const tooltip = typeof value === 'string' ? value : undefined
  return (
    <div className={cn('flex items-center justify-between gap-2', divider && 'border-b border-charcoal-200 pb-1.5')}>
      <p className="bento-label shrink-0 text-charcoal-500">{label}</p>
      <span className="flex min-w-0 items-center justify-end gap-1.5">
        <p title={tooltip} className={cn('truncate text-xs font-semibold text-charcoal-900', valueClassName)}>
          {value}
        </p>
        {icon}
      </span>
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="bento-label mb-1.5 text-charcoal-400">{children}</p>
}

/* ==================== personal ==================== */

function PersonalTab({ employee }: { employee: EmployeeProfile }) {
  const { t } = useTranslation()
  const status = humanize(employee.status)
  const iconClass = 'h-3.5 w-3.5 flex-shrink-0 text-charcoal-400'

  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
      <div className="space-y-2 lg:col-span-2">
        <TabCard eyebrow={t('PROFILE DETAILS')} title={t('Personal Info')}>
          <InfoField label={t('Full Name')} value={employee.name} />
          <InfoField
            label={t('Date of Birth')}
            value={employee.dateOfBirth ? formatDateWithYear(employee.dateOfBirth) : null}
          />
          <InfoField label={t('National ID')} value={employee.nationalId} />
          <InfoField label={t('Gender')} value={employee.gender} />
        </TabCard>

        <TabCard eyebrow={t('COMMUNICATION')} title={t('Contact Info')}>
          <InfoField label={t('Mobile Number')} value={employee.phone} />
          <InfoField label={t('Personal Email')} value={employee.email} />
        </TabCard>
      </div>

      <div className="flex flex-col">
        <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-charcoal-200 bg-charcoal-50">
          <div
            className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)] opacity-[0.03]"
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-center justify-between border-b border-charcoal-200 bg-charcoal-100/50 px-3 py-1.5">
            <div>
              <p className="bento-label text-charcoal-600">{t('EMPLOYMENT RECORD')}</p>
              <h3 className="mt-0.5 text-sm font-bold text-charcoal-900">{t('Employment Info')}</h3>
            </div>
          </div>
          <div className="relative z-10 flex flex-1 flex-col justify-between gap-1.5 p-3">
            <HrRow label={t('Employee ID')} value={employee.employeeNumber} icon={<CreditCard className={iconClass} aria-hidden="true" />} />
            <HrRow label={t('Primary Location')} value={employee.gym} icon={<MapPin className={iconClass} aria-hidden="true" />} />
            <HrRow label={t('Job Title / Position')} value={employee.position} />
            <HrRow label={t('Employment Level')} value={employee.level} />
            <HrRow label={t('Monthly Salary')} value={formatMoney(employee.salary)} />
            <HrRow
              label={t('Hire Date')}
              value={formatDateWithYear(employee.hireDate)}
              icon={<CalendarDays className={iconClass} aria-hidden="true" />}
            />
            <HrRow
              label={t('Current Status')}
              divider={false}
              valueClassName="flex items-center gap-1.5"
              value={
                <>
                  <span
                    className={cn('h-2 w-2 rounded-full', status === 'Active' ? 'bg-brand-500' : 'bg-charcoal-400')}
                    aria-hidden="true"
                  />
                  {status + (employee.employmentType ? ` · ${humanize(employee.employmentType)}` : '')}
                </>
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ==================== documents ==================== */

function DocumentsTab({ employeeId }: { employeeId: number }) {
  const { t } = useTranslation()
  const docsQuery = useEmployeeDocuments(employeeId)

  if (docsQuery.isLoading) return <LoadingState label={t('Loading documents…')} />
  if (docsQuery.error)
    return <ErrorState message={describeApiError(docsQuery.error)} onRetry={() => docsQuery.refetch()} />

  const docs = docsQuery.data ?? []
  if (docs.length === 0) return <p className="text-xs text-charcoal-500">{t('No documents on record.')}</p>

  return (
    <div>
      <SectionLabel>{t('EMPLOYEE DOCUMENTS ({{count}})', { count: docs.length })}</SectionLabel>
      <div className="divide-y divide-charcoal-50 rounded-lg border border-charcoal-200">
        {docs.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between gap-2 p-2.5">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-charcoal-900">{doc.name}</p>
              <p className="text-[10px] text-charcoal-500">
                {doc.category} · {t('Uploaded {{date}}', { date: formatDateWithYear(doc.uploadDate) })}
                {doc.expiryDate ? ` · ${t('Expires {{date}}', { date: formatDateWithYear(doc.expiryDate) })}` : ''}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <StatusBadge status={humanize(doc.status)} />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void downloadDocumentFile(employeeId, doc.id, doc.name)}
              >
                {t('Download')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ==================== employment ==================== */

function EmploymentTab({ employeeId }: { employeeId: number }) {
  const { t } = useTranslation()
  const historyQuery = useEmployeeHistory(employeeId)

  if (historyQuery.isLoading) return <LoadingState label={t('Loading employment history…')} />
  if (historyQuery.error)
    return <ErrorState message={describeApiError(historyQuery.error)} onRetry={() => historyQuery.refetch()} />

  const rows = historyQuery.data ?? []
  if (rows.length === 0) return <p className="text-xs text-charcoal-500">{t('No employment changes recorded yet.')}</p>

  return (
    <div>
      <SectionLabel>{t('EMPLOYMENT HISTORY ({{count}})', { count: rows.length })}</SectionLabel>
      <ul className="space-y-1.5">
        {rows.map((item, index) => (
          <li
            key={`${item.type}-${item.date}-${index}`}
            className="flex items-start justify-between gap-3 rounded-lg bg-charcoal-50 p-2.5"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-charcoal-900">{item.type}</p>
              <p className="text-[10px] text-charcoal-500">
                {item.from ? `${item.from} → ${item.to ?? '—'}` : item.to ?? '—'}
              </p>
              {item.detail && <p className="text-[10px] text-charcoal-400">{item.detail}</p>}
            </div>
            <span className="whitespace-nowrap text-[10px] font-semibold text-charcoal-500">
              {formatDateWithYear(item.date)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ==================== attendance ==================== */

function AttendanceTab({ employeeId }: { employeeId: number }) {
  const { t } = useTranslation()
  const [month, setMonth] = useState(currentMonthValue())
  const historyQuery = useEmployeeAttendance(employeeId, month)
  const balanceQuery = useEmployeeLeaveBalance(employeeId)

  if (historyQuery.isLoading) return <LoadingState label={t('Loading attendance…')} />
  if (historyQuery.error)
    return <ErrorState message={describeApiError(historyQuery.error)} onRetry={() => historyQuery.refetch()} />

  const totals = historyQuery.data?.totals
  const balance = balanceQuery.data
  const items = historyQuery.data?.items ?? []

  const late = totals?.late ?? 0
  const early = totals?.early ?? 0
  const absent = totals?.absent ?? 0
  const onTime = Math.max(0, (totals?.present ?? 0) - late - early)
  const sick = balance?.sick?.used ?? 0
  const annual = balance?.dayOff?.used ?? 0
  const segmentsTotal = onTime + late + sick + annual + absent

  const segments = [
    { label: t('On Time'), value: onTime, className: 'bg-brand-500' },
    { label: t('Late'), value: late, className: 'bg-yellow-400' },
    { label: t('Sick Leave'), value: sick, className: 'bg-blue-400' },
    { label: t('Annual Leave'), value: annual, className: 'bg-emerald-400' },
    { label: t('Absent'), value: absent, className: 'bg-red-400' },
  ]

  const tiles = [
    { label: t('On time'), value: onTime, tone: 'text-brand-700' },
    { label: t('Late'), value: late, tone: 'text-yellow-600' },
    { label: t('Sick Leave'), value: sick, tone: 'text-blue-600' },
    { label: t('Annual Leave'), value: annual, tone: 'text-emerald-600' },
    { label: t('Absent'), value: absent, tone: 'text-red-600' },
    { label: t('Unpaid Leave'), value: balance?.unpaid?.used ?? 0, tone: 'text-charcoal-600' },
    { label: t('Cover days'), value: totals?.coverDays ?? 0, tone: 'text-violet-600' },
  ]

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="bento-label text-charcoal-400">{t('ATTENDANCE')}</p>
        <input
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          className="form-input w-36"
          aria-label={t('Attendance month')}
        />
      </div>

      <div className="mb-3">
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-charcoal-100">
          {segmentsTotal > 0 &&
            segments.map((segment) => (
              <div
                key={segment.label}
                className={segment.className}
                style={{ width: `${(segment.value / segmentsTotal) * 100}%` }}
                title={`${segment.label}: ${segment.value}`}
              />
            ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {segments.map((segment) => (
            <span key={segment.label} className="flex items-center gap-1 text-[10px] text-charcoal-500">
              <span className={cn('h-2 w-2 rounded-full', segment.className)} aria-hidden="true" />
              {segment.label} {segment.value}
            </span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center sm:grid-cols-7">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-lg bg-charcoal-50 p-2">
              <p className={cn('text-base font-bold', tile.tone)}>{tile.value}</p>
              <p className="text-[10px] text-charcoal-500">{tile.label}</p>
            </div>
          ))}
        </div>
        {totals && (
          <p className="mt-1 text-[10px] text-charcoal-400">
            {t('{{hours}}h with {{days}} early leaving {{dayLabel}} this month.', {
              hours: totals.hours.toFixed(0),
              days: early,
              dayLabel: early === 1 ? t('day') : t('days'),
            })}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-charcoal-500">{t('No attendance rows for this month.')}</p>
      ) : (
        <div className="divide-y divide-charcoal-50 rounded-lg border border-charcoal-200">
          {items.slice(0, 12).map((item) => (
            <div key={item.date} className="flex items-center justify-between gap-2 p-2.5">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-charcoal-900">
                  {formatDateWithYear(item.date)}
                  {item.coverDays != null && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      {item.coverDays === 1 ? t('Cover: 1 day') : t('Cover: {{count}} days', { count: item.coverDays })}
                    </span>
                  )}
                </p>
                <p className="truncate text-[10px] text-charcoal-500">
                  {formatTimeOfDay(item.checkIn)} → {formatTimeOfDay(item.checkOut)}
                  {item.notes ? ` · ${item.notes}` : ''}
                </p>
              </div>
              <span className="flex flex-shrink-0 items-center gap-2">
                <span className="hidden text-[10px] text-charcoal-400 sm:block">{item.shift}</span>
                <StatusBadge status={humanize(item.status)} />
              </span>
            </div>
          ))}
        </div>
      )}
      {items.length > 12 && (
        <p className="mt-1 text-[10px] text-charcoal-400">
          {t('Showing the 12 latest rows of {{count}}.', { count: items.length })}
        </p>
      )}
    </div>
  )
}

/* ==================== shift ==================== */

function ShiftTab({ employeeId }: { employeeId: number }) {
  const { t } = useTranslation()
  const range = currentWeekRange()
  const scheduleQuery = useEmployeeSchedule(employeeId, range)

  if (scheduleQuery.isLoading) return <LoadingState label={t('Loading shift…')} />
  if (scheduleQuery.error)
    return <ErrorState message={describeApiError(scheduleQuery.error)} onRetry={() => scheduleQuery.refetch()} />

  const schedule = scheduleQuery.data
  const byDate = new Map((schedule?.days ?? []).map((day) => [day.date, day]))
  const inCycle = (date: string) =>
    (schedule?.cycles ?? []).some((cycle) => cycle.start <= date && date <= cycle.end)

  const week = currentWeekDates().map((entry) => ({ ...entry, day: byDate.get(entry.date) }))
  const missing = week.filter((entry) => !entry.day && inCycle(entry.date))

  return (
    <div>
      <SectionLabel>{t('CURRENT WEEK')}</SectionLabel>
      {(schedule?.cycles?.length ?? 0) === 0 && (
        <p className="mb-2 text-[10px] text-charcoal-400">
          {t('No published schedule covers this week — publish a cycle in Schedule to make it visible here.')}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {week.map((entry) => {
          const isToday = entry.date === todayIso()
          const day = entry.day
          const worked = day && !day.isOff && day.shiftName
          const hasGap = !day && inCycle(entry.date)
          return (
            <div
              key={entry.date}
              className={cn(
                'rounded-lg border p-2 text-center',
                hasGap
                  ? 'border-amber-300 bg-amber-50'
                  : isToday
                    ? 'border-brand-300 bg-brand-50/60'
                    : 'border-charcoal-100 bg-charcoal-50',
              )}
            >
              <p className={cn('text-[10px] font-semibold', isToday ? 'text-brand-700' : 'text-charcoal-500')}>
                {(day?.dayName ?? entry.label).slice(0, 3)} {entry.date.slice(8)}
              </p>
              <p className={cn('mt-1 text-[11px] font-bold', hasGap ? 'text-amber-600' : 'text-charcoal-900')}>
                {worked ? day?.shiftName : hasGap ? t('NO SHIFT') : day ? t('OFF') : '—'}
              </p>
              <p className="text-[9px] text-charcoal-500">
                {worked && day?.start ? `${time12(day.start)} – ${time12(day.end)}` : '—'}
              </p>
            </div>
          )
        })}
      </div>
      {schedule?.cycles?.length ? (
        <p className="mt-2 text-[10px] text-charcoal-400">
          {schedule.cycles
            .map((cycle) => `${formatDateWithYear(cycle.start)} – ${formatDateWithYear(cycle.end)} (${cycle.status})`)
            .join(', ')}
        </p>
      ) : null}
      {missing.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-medium text-amber-800">
          <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span>
            {missing.length === 1
              ? t('1 day of this week has no assigned shift — {{days}}.', {
                  days: missing.map((entry) => `${entry.label} ${entry.date.slice(5)}`).join(', '),
                })
              : t('{{count}} days of this week have no assigned shift — {{days}}.', {
                  count: missing.length,
                  days: missing.map((entry) => `${entry.label} ${entry.date.slice(5)}`).join(', '),
                })}
          </span>
        </p>
      )}
    </div>
  )
}

/* ==================== requests ==================== */

function RequestsTab({ employeeId }: { employeeId: number }) {
  const { t } = useTranslation()
  const requestsQuery = useEmployeeRequests(employeeId)

  if (requestsQuery.isLoading) return <LoadingState label={t('Loading requests…')} />
  if (requestsQuery.error)
    return <ErrorState message={describeApiError(requestsQuery.error)} onRetry={() => requestsQuery.refetch()} />

  const requests = requestsQuery.data ?? []
  if (requests.length === 0) return <p className="text-xs text-charcoal-500">{t('No requests filed yet.')}</p>

  return (
    <div>
      <SectionLabel>{t('REQUESTS HISTORY ({{count}})', { count: requests.length })}</SectionLabel>
      <ul className="divide-y divide-charcoal-50 rounded-lg border border-charcoal-200">
        {requests.map((request) => (
          <li key={request.id} className="flex items-center justify-between gap-2 p-2.5">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-charcoal-900">
                {request.type}
                {request.calculatedDays != null && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    {request.calculatedDays === 1
                      ? t('Cover: 1 day')
                      : t('Cover: {{count}} days', { count: request.calculatedDays })}
                  </span>
                )}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-charcoal-500">
                <span>{t('Requested {{date}}', { date: formatDateWithYear(request.requestedDate) })}</span>
                <span>
                  {request.submittedAt
                    ? t('Submitted {{stamp}}', {
                        stamp: `${formatDateWithYear(request.submittedDate)} · ${formatTime(request.submittedAt)}`,
                      })
                    : t('Submitted {{date}}', { date: formatDateWithYear(request.submittedDate) })}
                </span>
                {request.bmDecidedAt && (
                  <span>
                    <span
                      className={cn(
                        'font-semibold',
                        request.bmDecision === 'Approved' ? 'text-brand-700' : 'text-red-600',
                      )}
                    >
                      {t('BM {{decision}}', { decision: request.bmDecision ?? '—' })}
                    </span>{' '}
                    {`${formatDateWithYear(request.bmDecidedAt)} · ${formatTime(request.bmDecidedAt)}`}
                  </span>
                )}
                {request.hrDecidedAt && (
                  <span>
                    <span
                      className={cn(
                        'font-semibold',
                        request.hrDecision === 'Approved' ? 'text-brand-700' : 'text-red-600',
                      )}
                    >
                      {t('HR {{decision}}', { decision: request.hrDecision ?? '—' })}
                    </span>{' '}
                    {`${formatDateWithYear(request.hrDecidedAt)} · ${formatTime(request.hrDecidedAt)}`}
                  </span>
                )}
              </p>
              {request.reason && <p className="text-[10px] text-charcoal-400">{request.reason}</p>}
            </div>
            <StatusBadge status={request.status} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ==================== evaluations ==================== */

function EvaluationsTab({ employeeId }: { employeeId: number }) {
  const { t } = useTranslation()
  const evaluationsQuery = useEmployeeEvaluations(employeeId)

  if (evaluationsQuery.isLoading) return <LoadingState label={t('Loading evaluations…')} />
  if (evaluationsQuery.error)
    return <ErrorState message={describeApiError(evaluationsQuery.error)} onRetry={() => evaluationsQuery.refetch()} />

  const evaluations = evaluationsQuery.data?.items ?? []
  if (evaluations.length === 0) return <p className="text-xs text-charcoal-500">{t('No evaluations yet.')}</p>

  return (
    <div>
      <SectionLabel>{t('EVALUATIONS HISTORY ({{count}})', { count: evaluations.length })}</SectionLabel>
      <ul className="divide-y divide-charcoal-50 rounded-lg border border-charcoal-200">
        {evaluations.map((evaluation) => (
          <li key={evaluation.id} className="flex items-center justify-between gap-2 p-2.5">
            <div className="min-w-0">
              <p className="text-xs font-medium text-charcoal-900">{evaluation.period ?? evaluation.form}</p>
              <p className="text-[10px] text-charcoal-500">
                {t('Score {{score}} · {{result}} · {{form}}', {
                  score: evaluation.score != null ? evaluation.score.toFixed(1) : '—',
                  result: evaluation.result,
                  form: evaluation.form,
                })}
              </p>
            </div>
            <StatusBadge status={evaluation.status} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ==================== payroll ==================== */

function PayrollTab({ employeeId }: { employeeId: number }) {
  const { t } = useTranslation()
  const payrollQuery = useEmployeePayroll(employeeId)

  if (payrollQuery.isLoading) return <LoadingState label={t('Loading payroll snapshot…')} />
  if (payrollQuery.error)
    return <ErrorState message={describeApiError(payrollQuery.error)} onRetry={() => payrollQuery.refetch()} />

  const sheets = payrollQuery.data?.items ?? []
  const latest = sheets[0] ?? null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-lg bg-charcoal-50 p-3">
        <div>
          <p className="text-[10px] text-charcoal-500">{t('LATEST PAYSLIP')}</p>
          <p className="mt-0.5 text-xs font-semibold text-charcoal-900">
            {latest ? latest.period ?? latest.status : t('No payroll sheet yet')}
          </p>
        </div>
        <p className="text-sm font-bold text-charcoal-900">{latest ? formatMoney(latest.net) : '—'}</p>
      </div>

      {sheets.length === 0 ? (
        <p className="text-xs text-charcoal-500">{t('This employee is not on any payroll sheet yet.')}</p>
      ) : (
        <div className="divide-y divide-charcoal-50 rounded-lg border border-charcoal-200">
          {sheets.map((sheet) => (
            <div key={`${sheet.period}-${sheet.status}`} className="flex items-center justify-between gap-2 p-2.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-charcoal-900">{sheet.period ?? t('Open sheet')}</p>
                <p className="text-[10px] text-charcoal-500">
                  {t('Gross {{gross}} · Deductions {{deductions}}', {
                    gross: formatMoney(sheet.gross),
                    deductions: formatMoney(sheet.deductions),
                  })}
                </p>
              </div>
              <span className="flex flex-shrink-0 items-center gap-2">
                <span className="text-xs font-semibold text-charcoal-900">{formatMoney(sheet.net)}</span>
                <StatusBadge status={sheet.status} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
