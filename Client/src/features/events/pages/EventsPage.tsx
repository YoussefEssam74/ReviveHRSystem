import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { Card } from '../../../components/ui/card'
import { Select } from '../../../components/ui/select'
import { Badge } from '../../../components/ui/badge'
import { Tabs, type TabItem } from '../../../components/ui/tabs'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { Table, TBody, TD, TH, THead, TR } from '../../../components/ui/table'
import { Pagination } from '../../../components/ui/pagination'
import { useEvents, useGyms } from '../hooks/useEvents'
import { useMe } from '../../../contexts/MeContext'
import { formatDate } from '../../../lib/format'
import { describeApiError } from '../../../lib/api-client'

type TypeTab = '' | 'documents' | 'requests' | 'leaving' | 'transfers' | 'vacancies' | 'payroll'

/** Type filter per tab — the server matches comma-separated type words. */
const TYPE_FILTERS: Record<TypeTab, string | undefined> = {
  '': undefined,
  documents: 'Document Expiry,Contract Expiry',
  requests: 'PendingHRReview',
  leaving: 'Resignation,Termination',
  transfers: 'TransferRequest',
  vacancies: 'PendingVacancyRequest',
  payroll: 'PayrollApproval',
}

const TAB_ITEMS: TabItem<TypeTab>[] = [
  { value: '', label: 'All' },
  { value: 'documents', label: 'Documents' },
  { value: 'requests', label: 'Requests' },
  { value: 'leaving', label: 'Leaving' },
  { value: 'transfers', label: 'Transfers' },
  { value: 'vacancies', label: 'Vacancies' },
  { value: 'payroll', label: 'Payroll' },
]

const URGENCIES = [
  { value: '', label: 'Any urgency' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

/** Human label for the server's type word. */
function typeLabel(type: string): string {
  switch (type) {
    case 'PendingHRReview':
      return 'Request review'
    case 'TransferRequest':
      return 'Transfer ticket'
    case 'PendingVacancyRequest':
      return 'Vacancy request'
    case 'PayrollApproval':
      return 'Payroll approval'
    default:
      return type
  }
}

function urgencyLabel(urgency: string): string {
  return urgency.charAt(0).toUpperCase() + urgency.slice(1)
}

/** Badge classes per urgency (days-to-due derived). */
function urgencyClass(urgency: string): string {
  switch (urgency.toLowerCase()) {
    case 'high':
      return 'bg-red-50 text-red-700 ring-red-200'
    case 'medium':
      return 'bg-amber-50 text-amber-700 ring-amber-200'
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200'
  }
}

/** HR events queue (S5.6) — paged, gym/type/urgency/resolved filtered, read-only. */
export default function EventsPage() {
  const { t } = useTranslation()
  const { me } = useMe()
  const [tab, setTab] = useState<TypeTab>('')
  const [gym, setGym] = useState('')
  const [urgency, setUrgency] = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const [page, setPage] = useState(1)

  const gyms = useGyms()
  const { data, isLoading, error } = useEvents({
    gym: gym || undefined,
    type: TYPE_FILTERS[tab],
    urgency: urgency || undefined,
    resolved: showResolved || undefined,
    page,
    pageSize: 20,
  })

  const onFilter = (apply: () => void) => {
    apply()
    setPage(1)
  }

  return (
    <div>
      <PageHeader
        title={t('Events')}
        description={
          me?.activeGym
            ? t('Pending HR action queue — active gym: {{gym}}', { gym: me.activeGym.gymName })
            : t('Pending HR action queue across your branches')
        }
      />

      <Tabs
        items={TAB_ITEMS.map((item) => ({ ...item, label: t(item.label) }))}
        value={tab}
        onChange={(value) => onFilter(() => setTab(value))}
        className="mb-4 w-fit"
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <Select
            value={gym}
            onChange={(e) => onFilter(() => setGym(e.target.value))}
            className="sm:w-52"
            aria-label={t('Filter by branch')}
          >
            <option value="">{t('All branches')}</option>
            {(gyms.data ?? []).map((option) => (
              <option key={option.id} value={String(option.id)}>
                {option.name}
              </option>
            ))}
          </Select>
          <Select
            value={urgency}
            onChange={(e) => onFilter(() => setUrgency(e.target.value))}
            className="sm:w-44"
            aria-label={t('Filter by urgency')}
          >
            {URGENCIES.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </Select>
          <Select
            value={showResolved ? 'resolved' : 'open'}
            onChange={(e) => onFilter(() => setShowResolved(e.target.value === 'resolved'))}
            className="sm:w-44"
            aria-label={t('Filter by state')}
          >
            <option value="open">{t('Open')}</option>
            <option value="resolved">{t('Resolved')}</option>
          </Select>
        </div>

        {isLoading ? (
          <LoadingState label={t('Loading events…')} />
        ) : error ? (
          <ErrorState message={describeApiError(error)} />
        ) : (data?.items?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Sparkles}
            title={t('No events')}
            message={
              showResolved
                ? t('Nothing is resolved in this view yet.')
                : t('The queue is clear — nothing needs attention.')
            }
          />
        ) : (
          <>
            {data!.hidden > 0 && (
              <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                {t('{{count}} events hidden from this view by your permissions.', { count: data!.hidden })}
              </p>
            )}
            <Table>
              <THead>
                <TH>{t('Event')}</TH>
                <TH>{t('Type')}</TH>
                <TH>{t('Urgency')}</TH>
                <TH>{t('Due')}</TH>
                <TH>{t('Branch')}</TH>
                <TH>{t('Status')}</TH>
              </THead>
              <TBody>
                {data!.items.map((item) => (
                  <TR key={item.id}>
                    <TD>
                      <p className="font-medium text-slate-900">{item.title}</p>
                      {item.detail && <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>}
                      {(item.employee || item.position) && (
                        <p className="mt-0.5 text-xs text-slate-600">
                          {item.employee ?? '—'}
                          {item.position ? ` · ${item.position}` : ''}
                        </p>
                      )}
                    </TD>
                    <TD>
                      <Badge>{t(typeLabel(item.type))}</Badge>
                    </TD>
                    <TD>
                      <Badge className={urgencyClass(item.urgency)}>{t(urgencyLabel(item.urgency))}</Badge>
                    </TD>
                    <TD className="whitespace-nowrap text-slate-500">{formatDate(item.date)}</TD>
                    <TD className="text-slate-500">{item.branch ?? '—'}</TD>
                    <TD>
                      <Badge
                        className={
                          item.resolved
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : 'bg-amber-50 text-amber-700 ring-amber-200'
                        }
                      >
                        {item.resolved ? t('Resolved') : t('Open')}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={data!.page}
              pageSize={data!.pageSize}
              total={data!.total}
              totalPages={data!.totalPages}
              onPageChange={setPage}
              noun="events"
            />
          </>
        )}
      </Card>
    </div>
  )
}
