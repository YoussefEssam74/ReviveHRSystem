import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserX } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { Card } from '../../../components/ui/card'
import { Select } from '../../../components/ui/select'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Avatar } from '../../../components/ui/avatar'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { Pagination } from '../../../components/ui/pagination'
import { Table, TBody, TD, TH, THead, TR } from '../../../components/ui/table'
import { useSeparations } from '../hooks/useTerminations'
import { SeparationDetailDialog } from '../components/SeparationDetailDialog'
import { InitiateSeparationDialog } from '../components/InitiateSeparationDialog'
import { useMe } from '../../../contexts/MeContext'
import { formatDate } from '../../../lib/format'
import { describeApiError } from '../../../lib/api-client'
import { SEPARATION_STATUSES } from '../api/terminations.api'

const STATUS_OPTIONS = ['', ...SEPARATION_STATUSES]
const TYPE_OPTIONS = ['', 'Resignation', 'Termination']

/** Separation cases (S5.6/S9.4) — checklist, verdict and finalize workflow. */
export default function TerminationsPage() {
  const { t } = useTranslation()
  const { can, me } = useMe()
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [gym, setGym] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [initiating, setInitiating] = useState(false)

  const { data, isLoading, error } = useSeparations({
    gym: gym ? Number(gym) : undefined,
    status: status || undefined,
    type: type || undefined,
    page,
    pageSize: 20,
  })

  // UX gate only — the API enforces offboarding permissions server-side.
  const canManage = can('offboarding', 2)
  const gymOptions = me?.gyms ?? []

  return (
    <div>
      <PageHeader
        title={t('Terminations')}
        description={
          me?.activeGym
            ? t('Separation cases at {{gym}}', { gym: me.activeGym.gymName })
            : t('Exit lifecycle: checklist, verdict and finalization')
        }
        actions={
          canManage ? (
            <Button onClick={() => setInitiating(true)}>
              <UserX className="h-4 w-4" aria-hidden="true" />
              {t('New separation')}
            </Button>
          ) : undefined
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="sm:w-52" aria-label={t('Filter by status')}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option ? t(option) : t('All statuses')}
              </option>
            ))}
          </Select>
          <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1) }} className="sm:w-48" aria-label={t('Filter by type')}>
            {TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option ? t(option) : t('All types')}
              </option>
            ))}
          </Select>
          {gymOptions.length > 0 && (
            <Select value={gym} onChange={(e) => { setGym(e.target.value); setPage(1) }} className="sm:w-52" aria-label={t('Filter by gym')}>
              <option value="">{t('All gyms')}</option>
              {gymOptions.map((option) => (
                <option key={option.gymId} value={String(option.gymId)}>
                  {option.gymName}
                </option>
              ))}
            </Select>
          )}
        </div>

        {isLoading ? (
          <LoadingState label={t('Loading separation cases…')} />
        ) : error ? (
          <ErrorState message={describeApiError(error)} />
        ) : (data?.items?.length ?? 0) === 0 ? (
          <EmptyState
            icon={UserX}
            title={t('No separation cases')}
            message={
              status || type || gym
                ? t('Try adjusting your filters.')
                : t('No employee is currently going through offboarding.')
            }
          />
        ) : (
          <>
            {/* Desktop: table. Mobile: stacked cards. */}
            <Table className="hidden sm:block">
              <THead>
                <TH>{t('Employee')}</TH>
                <TH>{t('Gym')}</TH>
                <TH>{t('Type')}</TH>
                <TH>{t('Last day')}</TH>
                <TH>{t('Checklist')}</TH>
                <TH>{t('Status')}</TH>
              </THead>
              <TBody>
                {data!.items.map((separation) => (
                  <TR key={separation.id} onClick={() => setSelectedId(separation.id)}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={separation.employee.slice(0, 1).toUpperCase()} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{separation.employee}</p>
                          <p className="truncate text-xs text-slate-500">{separation.position}</p>
                        </div>
                      </div>
                    </TD>
                    <TD className="text-slate-500">{separation.gym}</TD>
                    <TD>
                      <Badge>{separation.separationType}</Badge>
                    </TD>
                    <TD className="text-slate-500">{formatDate(separation.lastDay)}</TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full bg-slate-100">
                          <div
                            className="h-1.5 rounded-full bg-emerald-500"
                            style={{ width: `${Math.max(0, Math.min(100, separation.progress))}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{separation.progress}%</span>
                      </div>
                    </TD>
                    <TD>
                      <StatusBadge status={separation.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <ul className="divide-y divide-slate-100 sm:hidden">
              {data!.items.map((separation) => (
                <li key={separation.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(separation.id)}
                    className="flex w-full flex-col gap-2 px-4 py-3 text-start transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-slate-900">{separation.employee}</p>
                      <StatusBadge status={separation.status} />
                    </div>
                    <p className="text-sm text-slate-600">
                      {separation.position} · {separation.gym}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <Badge>{separation.separationType}</Badge>
                      <span>{t('Last day {{date}}', { date: formatDate(separation.lastDay) })}</span>
                      <span>{t('{{percent}}% checklist', { percent: separation.progress })}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <Pagination
              page={data!.page}
              pageSize={data!.pageSize}
              total={data!.total}
              totalPages={data!.totalPages}
              onPageChange={setPage}
              noun={t('cases')}
            />
          </>
        )}
      </Card>

      {selectedId != null && (
        <SeparationDetailDialog key={selectedId} separationId={selectedId} canManage={canManage} onClose={() => setSelectedId(null)} />
      )}

      {initiating && <InitiateSeparationDialog onClose={() => setInitiating(false)} />}
    </div>
  )
}
