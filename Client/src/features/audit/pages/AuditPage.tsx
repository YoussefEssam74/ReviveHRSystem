import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, ScrollText } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { Card } from '../../../components/ui/card'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { EmptyState } from '../../../components/ui/empty-state'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Pagination } from '../../../components/ui/pagination'
import { Table, TBody, TD, TH, THead, TR } from '../../../components/ui/table'
import { useMe } from '../../../contexts/MeContext'
import { describeApiError } from '../../../lib/api-client'
import { formatDateTime } from '../../../lib/format'
import { VIEW } from '../../../lib/permissions'
import { useAuditActors, useAuditGyms, useAuditLog } from '../hooks/useAudit'
import type { AuditLogItem } from '../api/audit.api'

/** The backend's action-category filter values (blank = all). */
const ACTION_OPTIONS = ['', 'Employee', 'Payroll', 'Recruitment', 'Bulk Import']

/**
 * Tone for an action badge through the shared palette (Badge → statusBadgeClass):
 * destructive = red, creates/logins = emerald, updates/resets = amber, else slate.
 */
function actionStatus(action: string): string {
  const value = action.toLowerCase()
  if (value.includes('delete') || value.includes('suspend') || value.includes('terminate') || value.includes('reject')) {
    return 'Terminated'
  }
  if (value.includes('create') || value.includes('add') || value.includes('approve') || value.includes('login') || value.includes('reactivate')) {
    return 'Active'
  }
  if (value.includes('update') || value.includes('change') || value.includes('reset') || value.includes('edit')) {
    return 'Pending'
  }
  return 'Draft'
}

/** Audit log (S5.9) — paged, filterable, read-only; gated on audit.view. */
export default function AuditPage() {
  const { t } = useTranslation()
  const { can, isLoading: meLoading } = useMe()
  // The gate is UX-only: the API still enforces audit.view server-side.
  const canView = can('audit', VIEW)

  const [action, setAction] = useState('')
  const [gym, setGym] = useState('')
  const [actor, setActor] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, error } = useAuditLog(
    {
      action: action || undefined,
      gym: gym ? Number(gym) : undefined,
      user: actor ? Number(actor) : undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      pageSize: 20,
    },
    canView,
  )
  const gyms = useAuditGyms(canView)
  const actors = useAuditActors(canView)

  const onAction = (value: string) => {
    setAction(value)
    setPage(1)
  }
  const onGym = (value: string) => {
    setGym(value)
    setPage(1)
  }
  const onActor = (value: string) => {
    setActor(value)
    setPage(1)
  }
  const onFrom = (value: string) => {
    setFrom(value)
    setPage(1)
  }
  const onTo = (value: string) => {
    setTo(value)
    setPage(1)
  }
  const clearFilters = () => {
    setAction('')
    setGym('')
    setActor('')
    setFrom('')
    setTo('')
    setPage(1)
  }

  return (
    <>
      <PageHeader title={t('Audit Log')} description={t('Read-only trail of activity across your gyms')} />

      {meLoading ? (
        <Card>
          <LoadingState label={t('Checking your access…')} />
        </Card>
      ) : !canView ? (
        <Card>
          <EmptyState
            icon={Lock}
            title={t("You don't have access to the audit log")}
            message={t('Ask your administrator to grant the audit feature for this gym.')}
          />
        </Card>
      ) : (
        <Card>
          {/* Filters */}
          <div className="border-b border-slate-100 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label htmlFor="audit-action">{t('Action')}</Label>
                <Select id="audit-action" value={action} onChange={(e) => onAction(e.target.value)}>
                  {ACTION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option ? t(option) : t('All actions')}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="audit-gym">{t('Gym')}</Label>
                <Select
                  id="audit-gym"
                  value={gym}
                  onChange={(e) => onGym(e.target.value)}
                  disabled={gyms.isLoading || (gyms.data?.length ?? 0) === 0}
                >
                  <option value="">{t('All gyms')}</option>
                  {(gyms.data ?? []).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="audit-user">{t('User')}</Label>
                <Select
                  id="audit-user"
                  value={actor}
                  onChange={(e) => onActor(e.target.value)}
                  disabled={!actors.data || actors.data.items.length === 0}
                >
                  <option value="">{t('All users')}</option>
                  {(actors.data?.items ?? []).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="audit-from">{t('From')}</Label>
                  <Input id="audit-from" type="date" value={from} onChange={(e) => onFrom(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="audit-to">{t('To')}</Label>
                  <Input id="audit-to" type="date" value={to} onChange={(e) => onTo(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                {t('Clear filters')}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <LoadingState label={t('Loading audit log…')} />
          ) : error ? (
            <ErrorState message={describeApiError(error)} />
          ) : (data?.items?.length ?? 0) === 0 ? (
            <EmptyState
              icon={ScrollText}
              title={t('No audit entries')}
              message={t('No activity matches the current filters.')}
            />
          ) : (
            <>
              {/* Desktop: dense table */}
              <div className="hidden md:block">
                <Table>
                  <THead>
                    <TH>{t('Timestamp')}</TH>
                    <TH>{t('Actor')}</TH>
                    <TH>{t('Action')}</TH>
                    <TH>{t('Target')}</TH>
                    <TH>{t('Gym')}</TH>
                    <TH>{t('Details')}</TH>
                  </THead>
                  <TBody>
                    {data!.items.map((row: AuditLogItem) => (
                      <TR key={row.id}>
                        <TD className="whitespace-nowrap text-slate-500">{formatDateTime(row.timestamp)}</TD>
                        <TD className="font-medium text-slate-900">{row.user}</TD>
                        <TD>
                          <Badge status={actionStatus(row.action)}>{row.action}</Badge>
                        </TD>
                        <TD className="text-slate-700">{row.target}</TD>
                        <TD className="whitespace-nowrap text-slate-600">{row.gym}</TD>
                        <TD className="max-w-[20rem] truncate text-slate-500">{row.detail}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>

              {/* Mobile: stacked rows */}
              <ul className="divide-y divide-slate-100 md:hidden">
                {data!.items.map((row: AuditLogItem) => (
                  <li key={row.id} className="space-y-1 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge status={actionStatus(row.action)}>{row.action}</Badge>
                      <span className="shrink-0 text-xs text-slate-400">{formatDateTime(row.timestamp)}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900">
                      {row.user} <span className="font-normal text-slate-500">→ {row.target}</span>
                    </p>
                    <p className="text-xs text-slate-400">{row.gym}</p>
                    {row.detail && <p className="text-sm text-slate-600">{row.detail}</p>}
                  </li>
                ))}
              </ul>

              <Pagination
                page={data!.page}
                pageSize={data!.pageSize}
                total={data!.total}
                totalPages={data!.totalPages}
                onPageChange={setPage}
                noun="audit entries"
              />
            </>
          )}
        </Card>
      )}
    </>
  )
}
