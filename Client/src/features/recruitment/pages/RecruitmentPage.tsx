import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Briefcase, FileText, Users } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { Card } from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Avatar } from '../../../components/ui/avatar'
import { Button } from '../../../components/ui/button'
import { Tabs } from '../../../components/ui/tabs'
import { Dialog } from '../../../components/ui/dialog'
import { Label } from '../../../components/ui/label'
import { Textarea } from '../../../components/ui/textarea'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { Pagination } from '../../../components/ui/pagination'
import { Table, TBody, TD, TH, THead, TR } from '../../../components/ui/table'
import { useCandidates, useDecideVacancyRequest, useVacancies, useVacancyRequests } from '../hooks/useRecruitment'
import { VacancyFormDialog } from '../components/VacancyFormDialog'
import { VacancyDetailDialog } from '../components/VacancyDetailDialog'
import { CandidateDetailDialog } from '../components/CandidateDetailDialog'
import { useMe } from '../../../contexts/MeContext'
import { formatDate, formatMoney } from '../../../lib/format'
import { describeApiError } from '../../../lib/api-client'
import { CANDIDATE_STAGES, type Vacancy, type VacancyRequest } from '../api/recruitment.api'

type ModuleTab = 'vacancies' | 'pipeline' | 'requests'

const TABS: { value: ModuleTab; label: string }[] = [
  { value: 'vacancies', label: 'Vacancies' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'requests', label: 'Vacancy Requests' },
]

const VACANCY_STATUS_OPTIONS = ['', 'Open', 'Draft', 'Closed']
const REQUEST_STATUS_OPTIONS = ['', 'Pending', 'Approved', 'Rejected']
const STAGE_OPTIONS = ['', ...CANDIDATE_STAGES]

/** Recruitment & hiring (S5.1) — vacancies, candidate pipeline, vacancy requests. */
export default function RecruitmentPage() {
  const { t } = useTranslation()
  const { can, me } = useMe()
  // UX gate only — the API enforces the recruitment.* keys server-side
  // (vacancies.manage / candidates.manage / vacancy_request.approve share this level).
  const canManage = can('recruitment', 2)
  const gymOptions = me?.gyms ?? []

  const [tab, setTab] = useState<ModuleTab>('vacancies')

  // Vacancies tab filters.
  const [vSearch, setVSearch] = useState('')
  const [vStatus, setVStatus] = useState('')
  const [vGym, setVGym] = useState('')
  const [vPage, setVPage] = useState(1)

  // Pipeline tab filters.
  const [pSearch, setPSearch] = useState('')
  const [pStage, setPStage] = useState('')
  const [pPage, setPPage] = useState(1)

  // Vacancy requests tab filters.
  const [rStatus, setRStatus] = useState('Pending')
  const [rGym, setRGym] = useState('')
  const [rPage, setRPage] = useState(1)

  // Dialogs.
  const [detailVacancyId, setDetailVacancyId] = useState<number | null>(null)
  const [editingVacancy, setEditingVacancy] = useState<Vacancy | 'new' | null>(null)
  const [candidateId, setCandidateId] = useState<number | null>(null)
  const [rejecting, setRejecting] = useState<VacancyRequest | null>(null)
  const [rejectComment, setRejectComment] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const vacancies = useVacancies({
    gym: vGym ? Number(vGym) : undefined,
    status: vStatus || undefined,
    searchTerm: vSearch || undefined,
    page: vPage,
    pageSize: 20,
  })

  const candidates = useCandidates({
    searchTerm: pSearch || undefined,
    stage: pStage || undefined,
    page: pPage,
    pageSize: 20,
  })

  const requests = useVacancyRequests({
    status: rStatus || undefined,
    gym: rGym ? Number(rGym) : undefined,
    page: rPage,
    pageSize: 20,
  })

  const decide = useDecideVacancyRequest()

  const onDecide = async (id: number, decision: 'Approved' | 'Rejected', comment?: string) => {
    setActionError(null)
    try {
      await decide.mutateAsync({ id, body: { decision, ...(comment?.trim() ? { comment: comment.trim() } : {}) } })
      setRejecting(null)
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  return (
    <div>
      <PageHeader
        title={t('Recruitment')}
        description={
          me?.activeGym
            ? t('Hiring at {{gym}}', { gym: me.activeGym.gymName })
            : t('Vacancies, candidate pipeline and vacancy requests')
        }
        actions={
          canManage && tab === 'vacancies' ? (
            <Button onClick={() => setEditingVacancy('new')}>
              <Briefcase className="h-4 w-4" aria-hidden="true" />
              {t('New vacancy')}
            </Button>
          ) : undefined
        }
      />

      <Tabs
        items={TABS.map((item) => ({ ...item, label: t(item.label) }))}
        value={tab}
        onChange={setTab}
        className="mb-4 w-fit"
      />

      {tab === 'vacancies' && (
        <Card>
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
            <Input
              placeholder={t('Search position…')}
              value={vSearch}
              onChange={(e) => { setVSearch(e.target.value); setVPage(1) }}
              className="sm:max-w-xs"
              aria-label={t('Search vacancies')}
            />
            <Select value={vStatus} onChange={(e) => { setVStatus(e.target.value); setVPage(1) }} className="sm:w-44" aria-label={t('Filter by status')}>
              {VACANCY_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option ? t(option) : t('All statuses')}
                </option>
              ))}
            </Select>
            {gymOptions.length > 0 && (
              <Select value={vGym} onChange={(e) => { setVGym(e.target.value); setVPage(1) }} className="sm:w-52" aria-label={t('Filter by gym')}>
                <option value="">{t('All gyms')}</option>
                {gymOptions.map((option) => (
                  <option key={option.gymId} value={String(option.gymId)}>
                    {option.gymName}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {vacancies.isLoading ? (
            <LoadingState label={t('Loading vacancies…')} />
          ) : vacancies.error ? (
            <ErrorState message={describeApiError(vacancies.error)} />
          ) : (vacancies.data?.items?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Briefcase}
              title={t('No vacancies')}
              message={
                vSearch || vStatus || vGym
                  ? t('Try adjusting your search or filters.')
                  : t('No vacancy has been opened yet.')
              }
            />
          ) : (
            <>
              <Table className="hidden sm:block">
                <THead>
                  <TH>{t('Position')}</TH>
                  <TH>{t('Gym')}</TH>
                  <TH>{t('Headcount')}</TH>
                  <TH>{t('Candidates')}</TH>
                  <TH>{t('Urgency')}</TH>
                  <TH>{t('Status')}</TH>
                  <TH>{t('Created')}</TH>
                  {canManage && <TH className="text-end">{t('Action')}</TH>}
                </THead>
                <TBody>
                  {vacancies.data!.items.map((vacancy) => (
                    <TR key={vacancy.id} onClick={() => setDetailVacancyId(vacancy.id)}>
                      <TD>
                        <p className="font-medium text-slate-900">{vacancy.position}</p>
                        {vacancy.salary != null && <p className="text-xs text-slate-500">{formatMoney(vacancy.salary)} EGP</p>}
                      </TD>
                      <TD className="text-slate-500">{vacancy.gym}</TD>
                      <TD className="font-medium text-slate-900">{vacancy.headcount}</TD>
                      <TD className="font-medium text-slate-900">{vacancy.candidates}</TD>
                      <TD>
                        <Badge>{vacancy.urgency ?? '—'}</Badge>
                      </TD>
                      <TD>
                        <StatusBadge status={vacancy.status} />
                      </TD>
                      <TD className="text-slate-500">{formatDate(vacancy.createdDate)}</TD>
                      {canManage && (
                        <TD className="text-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setDetailVacancyId(null)
                              setEditingVacancy(vacancy)
                            }}
                          >
                            {t('Edit')}
                          </Button>
                        </TD>
                      )}
                    </TR>
                  ))}
                </TBody>
              </Table>
              <ul className="divide-y divide-slate-100 sm:hidden">
                {vacancies.data!.items.map((vacancy) => (
                  <li key={vacancy.id}>
                    <button
                      type="button"
                      onClick={() => setDetailVacancyId(vacancy.id)}
                      className="flex w-full flex-col gap-2 px-4 py-3 text-start transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium text-slate-900">{vacancy.position}</p>
                        <StatusBadge status={vacancy.status} />
                      </div>
                      <p className="text-sm text-slate-600">{vacancy.gym}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <Badge>{t('{{urgency}} urgency', { urgency: vacancy.urgency ?? '—' })}</Badge>
                        <span>{t('{{count}} openings', { count: vacancy.headcount })}</span>
                        <span>{t('{{count}} candidates', { count: vacancy.candidates })}</span>
                        <span>{formatDate(vacancy.createdDate)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination
                page={vacancies.data!.page}
                pageSize={vacancies.data!.pageSize}
                total={vacancies.data!.total}
                totalPages={vacancies.data!.totalPages}
                onPageChange={setVPage}
                noun={t('vacancies')}
              />
            </>
          )}
        </Card>
      )}

      {tab === 'pipeline' && (
        <Card>
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
            <Input
              placeholder={t('Search name, email, phone…')}
              value={pSearch}
              onChange={(e) => { setPSearch(e.target.value); setPPage(1) }}
              className="sm:max-w-xs"
              aria-label={t('Search candidates')}
            />
            <Select value={pStage} onChange={(e) => { setPStage(e.target.value); setPPage(1) }} className="sm:w-56" aria-label={t('Filter by stage')}>
              {STAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option ? t(option) : t('All stages')}
                </option>
              ))}
            </Select>
          </div>

          {candidates.isLoading ? (
            <LoadingState label={t('Loading candidates…')} />
          ) : candidates.error ? (
            <ErrorState message={describeApiError(candidates.error)} />
          ) : (candidates.data?.items?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Users}
              title={t('No candidates')}
              message={
                pSearch || pStage
                  ? t('Try adjusting your search or stage filter.')
                  : t('The pipeline is empty.')
              }
            />
          ) : (
            <>
              <Table className="hidden sm:block">
                <THead>
                  <TH>{t('Candidate')}</TH>
                  <TH>{t('Position')}</TH>
                  <TH>{t('Stage')}</TH>
                  <TH>{t('Applied')}</TH>
                  <TH>{t('Phone')}</TH>
                </THead>
                <TBody>
                  {candidates.data!.items.map((candidate) => (
                    <TR key={candidate.applicationId} onClick={() => setCandidateId(candidate.id)}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <Avatar name={candidate.initials} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{candidate.name}</p>
                            {candidate.blocked && <Badge className="mt-0.5">{t('Banned')}</Badge>}
                          </div>
                        </div>
                      </TD>
                      <TD className="text-slate-600">{candidate.position}</TD>
                      <TD>
                        <StatusBadge status={candidate.stage} />
                      </TD>
                      <TD className="text-slate-500">{formatDate(candidate.appliedDate)}</TD>
                      <TD className="text-slate-500">{candidate.phone ?? '—'}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <ul className="divide-y divide-slate-100 sm:hidden">
                {candidates.data!.items.map((candidate) => (
                  <li key={candidate.applicationId}>
                    <button
                      type="button"
                      onClick={() => setCandidateId(candidate.id)}
                      className="flex w-full flex-col gap-2 px-4 py-3 text-start transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium text-slate-900">{candidate.name}</p>
                        <StatusBadge status={candidate.stage} />
                      </div>
                      <p className="text-sm text-slate-600">{candidate.position}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>{t('Applied {{date}}', { date: formatDate(candidate.appliedDate) })}</span>
                        <span>{candidate.phone ?? '—'}</span>
                        {candidate.blocked && <Badge>{t('Banned')}</Badge>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination
                page={candidates.data!.page}
                pageSize={candidates.data!.pageSize}
                total={candidates.data!.total}
                totalPages={candidates.data!.totalPages}
                onPageChange={setPPage}
                noun={t('candidates')}
              />
            </>
          )}
        </Card>
      )}

      {tab === 'requests' && (
        <Card>
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
            <Select value={rStatus} onChange={(e) => { setRStatus(e.target.value); setRPage(1) }} className="sm:w-48" aria-label={t('Filter by status')}>
              {REQUEST_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option ? t(option) : t('All statuses')}
                </option>
              ))}
            </Select>
            {gymOptions.length > 0 && (
              <Select value={rGym} onChange={(e) => { setRGym(e.target.value); setRPage(1) }} className="sm:w-52" aria-label={t('Filter by gym')}>
                <option value="">{t('All gyms')}</option>
                {gymOptions.map((option) => (
                  <option key={option.gymId} value={String(option.gymId)}>
                    {option.gymName}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {requests.isLoading ? (
            <LoadingState label={t('Loading vacancy requests…')} />
          ) : requests.error ? (
            <ErrorState message={describeApiError(requests.error)} />
          ) : (requests.data?.items?.length ?? 0) === 0 ? (
            <EmptyState
              icon={FileText}
              title={t('No vacancy requests')}
              message={
                rStatus || rGym
                  ? t('Try adjusting your filters.')
                  : t('Branch managers have not submitted any requests.')
              }
            />
          ) : (
            <>
              <Table className="hidden sm:block">
                <THead>
                  <TH>{t('Position')}</TH>
                  <TH>{t('Gym')}</TH>
                  <TH>{t('Headcount')}</TH>
                  <TH>{t('Urgency')}</TH>
                  <TH>{t('Submitted')}</TH>
                  <TH>{t('Status')}</TH>
                  {canManage && <TH className="text-end">{t('Action')}</TH>}
                </THead>
                <TBody>
                  {requests.data!.items.map((request) => (
                    <TR key={request.id}>
                      <TD>
                        <p className="font-medium text-slate-900">{request.position}</p>
                        {request.reason && <p className="truncate text-xs text-slate-500">{request.reason}</p>}
                      </TD>
                      <TD className="text-slate-500">{request.gym}</TD>
                      <TD className="font-medium text-slate-900">{request.headcount ?? '—'}</TD>
                      <TD>
                        <Badge>{request.urgency ?? '—'}</Badge>
                      </TD>
                      <TD className="text-slate-500">
                        {formatDate(request.submittedDate)}
                        {request.submittedBy ? ` · ${request.submittedBy}` : ''}
                      </TD>
                      <TD>
                        <StatusBadge status={request.status} />
                        {request.decidedBy && <p className="mt-0.5 text-xs text-slate-400">{t('by {{name}}', { name: request.decidedBy })}</p>}
                      </TD>
                      {canManage && (
                        <TD className="text-end">
                          {request.status === 'Pending' && (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => onDecide(request.id, 'Approved')}
                                loading={decide.isPending && decide.variables?.id === request.id}
                              >
                                {t('Approve')}
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => {
                                  setActionError(null)
                                  setRejectComment('')
                                  setRejecting(request)
                                }}
                              >
                                {t('Reject')}
                              </Button>
                            </div>
                          )}
                        </TD>
                      )}
                    </TR>
                  ))}
                </TBody>
              </Table>
              <ul className="divide-y divide-slate-100 sm:hidden">
                {requests.data!.items.map((request) => (
                  <li key={request.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-slate-900">{request.position}</p>
                      <StatusBadge status={request.status} />
                    </div>
                    <p className="text-sm text-slate-600">
                      {request.gym}
                      {request.headcount != null ? ` · ${t('{{count}} openings', { count: request.headcount })}` : ''}
                    </p>
                    {request.reason && <p className="mt-1 text-sm italic text-slate-500">“{request.reason}”</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <Badge>{t('{{urgency}} urgency', { urgency: request.urgency ?? '—' })}</Badge>
                      <span>
                        {t('By {{name}} · {{date}}', {
                          name: request.submittedBy ?? '—',
                          date: formatDate(request.submittedDate),
                        })}
                      </span>
                    </div>
                    {canManage && request.status === 'Pending' && (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" onClick={() => onDecide(request.id, 'Approved')} loading={decide.isPending}>
                          {t('Approve')}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setActionError(null)
                            setRejectComment('')
                            setRejecting(request)
                          }}
                        >
                          {t('Reject')}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {actionError && (
                <p role="alert" className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {actionError}
                </p>
              )}
              <Pagination
                page={requests.data!.page}
                pageSize={requests.data!.pageSize}
                total={requests.data!.total}
                totalPages={requests.data!.totalPages}
                onPageChange={setRPage}
                noun={t('requests')}
              />
            </>
          )}
        </Card>
      )}

      {detailVacancyId != null && (
        <VacancyDetailDialog
          key={detailVacancyId}
          vacancyId={detailVacancyId}
          canManage={canManage}
          onClose={() => setDetailVacancyId(null)}
          onEdit={(vacancy) => {
            setDetailVacancyId(null)
            setEditingVacancy(vacancy)
          }}
        />
      )}

      {editingVacancy != null && (
        <VacancyFormDialog
          key={editingVacancy === 'new' ? 'new' : editingVacancy.id}
          vacancy={editingVacancy === 'new' ? null : editingVacancy}
          onClose={() => setEditingVacancy(null)}
        />
      )}

      {candidateId != null && (
        <CandidateDetailDialog key={candidateId} candidateId={candidateId} canManage={canManage} onClose={() => setCandidateId(null)} />
      )}

      <Dialog
        open={rejecting != null}
        onClose={() => setRejecting(null)}
        title={t('Reject vacancy request')}
        description={rejecting ? `${rejecting.position} · ${rejecting.gym}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              {t('Cancel')}
            </Button>
            <Button variant="danger" onClick={() => rejecting && onDecide(rejecting.id, 'Rejected', rejectComment)} loading={decide.isPending}>
              {t('Reject request')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {actionError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionError}
            </p>
          )}
          <div>
            <Label htmlFor="reject-comment">{t('Comment (optional)')}</Label>
            <Textarea
              id="reject-comment"
              rows={3}
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              placeholder={t('Why is this request being rejected?')}
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
