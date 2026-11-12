import { useTranslation } from 'react-i18next'
import { Briefcase, Users } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Avatar } from '../../../components/ui/avatar'
import { Dialog } from '../../../components/ui/dialog'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { useVacancy } from '../hooks/useRecruitment'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatMoney } from '../../../lib/format'
import type { Vacancy } from '../api/recruitment.api'

export interface VacancyDetailDialogProps {
  vacancyId: number
  /** recruitment Edit — shows the "Edit vacancy" action. */
  canManage: boolean
  onClose: () => void
  onEdit: (vacancy: Vacancy) => void
}

/** Vacancy detail modal: the funnel, current staff on the position and its candidates. */
export function VacancyDetailDialog({ vacancyId, canManage, onClose, onEdit }: VacancyDetailDialogProps) {
  const { t } = useTranslation()
  const { data, isLoading, error } = useVacancy(vacancyId)
  const vacancy = data?.data

  return (
    <Dialog
      open
      onClose={onClose}
      title={vacancy ? vacancy.position : t('Vacancy')}
      description={vacancy ? t('{{gym}} · opened {{date}}', { gym: vacancy.gym, date: formatDate(vacancy.createdDate) }) : undefined}
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Close')}
          </Button>
          {canManage && vacancy && <Button onClick={() => onEdit(vacancy)}>{t('Edit vacancy')}</Button>}
        </>
      }
    >
      {isLoading ? (
        <LoadingState label={t('Loading vacancy…')} />
      ) : error ? (
        <ErrorState message={describeApiError(error)} />
      ) : vacancy && data ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={vacancy.status} />
            {vacancy.urgency && <Badge>{t('{{urgency}} urgency', { urgency: vacancy.urgency })}</Badge>}
            {vacancy.source && <Badge>{t('Source: {{value}}', { value: vacancy.source })}</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('Headcount')}</p>
              <p className="text-sm font-semibold text-slate-900">{vacancy.headcount}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('Candidates')}</p>
              <p className="text-sm font-semibold text-slate-900">{vacancy.candidates}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('Salary')}</p>
              <p className="text-sm font-semibold text-slate-900">{formatMoney(vacancy.salary)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('Shift')}</p>
              <p className="text-sm text-slate-900">{vacancy.shift ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('Requested by')}</p>
              <p className="text-sm text-slate-900">{vacancy.requestedBy ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('Position id')}</p>
              <p className="text-sm text-slate-900">{vacancy.positionId ?? '—'}</p>
            </div>
          </div>

          {(vacancy.description || vacancy.requirements) && (
            <div className="space-y-3">
              {vacancy.description && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('Job description')}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{vacancy.description}</p>
                </div>
              )}
              {vacancy.requirements && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('Requirements')}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{vacancy.requirements}</p>
                </div>
              )}
            </div>
          )}

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('Pipeline funnel')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {data.funnel.length === 0 ? (
                <p className="text-sm text-slate-500">{t('No funnel data yet.')}</p>
              ) : (
                data.funnel.map((stage) => (
                  <span
                    key={stage.stage}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200"
                  >
                    {t(stage.stage)}
                    <span className="rounded-full bg-white px-1.5 text-emerald-700">{stage.count}</span>
                  </span>
                ))
              )}
            </div>
          </div>

          {data.employeesUnderPosition.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {t('Current staff on this position ({{count}})', { count: data.employeesUnderPosition.length })}
              </p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                {data.employeesUnderPosition.map((employee) => (
                  <li key={employee.id} className="flex items-center gap-2">
                    <Avatar name={employee.initials} size="sm" />
                    <span className="text-sm text-slate-700">{employee.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {t('Candidates ({{count}})', { count: data.candidates.length })}
            </p>
            {data.candidates.length === 0 ? (
              <EmptyState icon={Users} title={t('No candidates yet')} message={t('Nobody has applied to this vacancy.')} />
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {data.candidates.map((candidate) => (
                  <li key={candidate.applicationId} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Briefcase className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{candidate.name}</p>
                        <p className="truncate text-xs text-slate-500">{t('Applied {{date}}', { date: formatDate(candidate.appliedDate) })}</p>
                      </div>
                    </div>
                    <StatusBadge status={candidate.stage} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </Dialog>
  )
}
