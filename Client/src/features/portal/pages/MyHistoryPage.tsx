import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Briefcase, Building2, ShieldCheck, Sparkles } from 'lucide-react'
import { getOwnHistory, type EmployeeHistoryItem } from '../api/employee-file.api'
import { EmptyState } from '../../../components/ui/primitives'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { formatDateWithYear } from '../../../lib/format'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Mirrors the mock's per-change-type icon: direct JSX keeps lint's static-components rule quiet. */
function eventIcon(type: string) {
  const normalized = type.toLowerCase()
  if (normalized.includes('joined') || normalized.includes('offboard')) {
    return <Sparkles className="h-3.5 w-3.5 flex-shrink-0 text-brand-600" aria-hidden="true" />
  }
  if (normalized.includes('transfer') || normalized.includes('gym')) {
    return <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-brand-600" aria-hidden="true" />
  }
  if (normalized.includes('role')) {
    return <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 text-brand-600" aria-hidden="true" />
  }
  return <Briefcase className="h-3.5 w-3.5 flex-shrink-0 text-brand-600" aria-hidden="true" />
}

interface MonthGroup {
  key: string
  label: string
  events: EmployeeHistoryItem[]
}

export default function MyHistoryPage() {
  const { me } = usePortalSession()
  const employeeId = me?.employeeId ?? null

  const historyQuery = useQuery({
    queryKey: ['portal', 'history', employeeId],
    queryFn: ({ signal }) => getOwnHistory(employeeId!, signal),
    enabled: employeeId != null,
  })

  if (employeeId == null) {
    return <EmptyState title="No employee profile" hint="This account is not linked to an employee profile." />
  }
  if (historyQuery.isLoading) return <LoadingState label="Loading your history…" />
  if (historyQuery.isError) {
    return <ErrorState message={describeApiError(historyQuery.error)} onRetry={() => historyQuery.refetch()} />
  }

  // Newest first, grouped by month for the timeline headings. (A plain compute —
  // the read is cheap and hooks must not sit behind the early returns above.)
  const months: MonthGroup[] = (() => {
    const items = [...(historyQuery.data ?? [])].sort((left, right) => right.date.localeCompare(left.date))
    const groups = new Map<string, MonthGroup>()
    for (const item of items) {
      const key = item.date.slice(0, 7)
      const month = Number(key.slice(5, 7))
      const label = `${MONTH_NAMES[month - 1] ?? ''} ${key.slice(0, 4)}`
      const group = groups.get(key) ?? { key, label, events: [] }
      group.events.push(item)
      groups.set(key, group)
    }
    return [...groups.values()]
  })()

  return (
    <div className="max-w-2xl space-y-2">
      <h1 className="text-lg font-bold text-charcoal-900">Employment History</h1>

      {months.length === 0 ? (
        <EmptyState
          title="No history recorded yet"
          hint="Employment changes (transfers, position changes, new contracts) appear here as they happen."
        />
      ) : (
        <div className="relative">
          <div className="timeline-line" />
          <div className="space-y-4">
            {months.map((group) => (
              <div key={group.key}>
                <p className="mb-2 pl-8 text-[10px] font-semibold uppercase tracking-wider text-charcoal-400">
                  {group.label}
                </p>
                {group.events.map((event, index) => (
                  <EventRow key={`${event.type}-${event.date}-${index}`} event={event} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function EventRow({ event }: { event: EmployeeHistoryItem }) {
  return (
    <div className="mb-3 flex gap-3">
      <div className="flex flex-shrink-0 flex-col items-center">
        <div className="timeline-dot" />
      </div>
      <div className="card flex-1 p-3">
        <div className="mb-1 flex items-center gap-1.5">
          {eventIcon(event.type)}
          <h3 className="text-xs font-semibold text-charcoal-900">{event.type}</h3>
        </div>
        {event.from && event.to && (
          <div className="mb-1 flex items-center gap-1 text-xs">
            <span className="text-charcoal-500">{event.from}</span>
            <ArrowRight className="h-3 w-3 text-charcoal-400" aria-hidden="true" />
            <span className="font-medium text-charcoal-900">{event.to}</span>
          </div>
        )}
        {event.from && !event.to && (
          <div className="mb-1 text-xs text-charcoal-700">{event.from}</div>
        )}
        <div className="flex items-center justify-between">
          {event.detail && <p className="text-[11px] text-charcoal-500">{event.detail}</p>}
          <p className="text-[10px] font-medium text-charcoal-400">{formatDateWithYear(event.date)}</p>
        </div>
      </div>
    </div>
  )
}
