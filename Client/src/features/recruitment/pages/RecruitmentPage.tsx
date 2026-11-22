import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Briefcase, CalendarX, FileText, Filter, Pencil, Plus, Users } from 'lucide-react'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Pagination } from '../../../components/ui/pagination'
import { Select } from '../../../components/ui/select'
import { StatusBadge } from '../../../components/ui/badge'
import { Textarea } from '../../../components/ui/textarea'
import { useMe } from '../../../contexts/MeContext'
import { describeApiError } from '../../../lib/api-client'
import { formatDate } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import {
  useBlockCandidate,
  useCandidates,
  useConvertFormApplication,
  useDecideVacancyRequest,
  useFormApplications,
  useInterviews,
  useMoveCandidateStage,
  useRejectFormApplication,
  useRemoveFromWaitingList,
  useVacancies,
  useVacancyRequests,
  useWaitingList,
} from '../hooks/useRecruitment'
import { ApplicantAnswersDialog } from '../components/ApplicantAnswersDialog'
import { CandidateDetailDialog } from '../components/CandidateDetailDialog'
import { HireEmployeeDialog } from '../components/HireEmployeeDialog'
import { ScheduleInterviewDialog } from '../components/ScheduleInterviewDialog'
import { VacancyDetailDialog } from '../components/VacancyDetailDialog'
import { VacancyFormDialog } from '../components/VacancyFormDialog'
import {
  HintBar,
  LifecycleEmpty,
  SectionLabel,
} from '../components/recruitment-ui'
import { NameDateFilterBar } from '../components/recruitment-filter'
import {
  NO_NAME_DATE_FILTER,
  matchesName,
  withinDateRange,
  type NameDateFilter,
} from '../lib/name-date-filter'
import {
  ApplicantsTable,
  CandidateTable,
  VacancyRequestsTable,
  WaitingListTable,
} from '../components/recruitment-tables'
import type { CandidateCard, FormApplication, Vacancy, VacancyRequest, WaitingListItem } from '../api/recruitment.api'
import { displayStage } from '../api/recruitment.api'

type RecruitmentTab =
  | 'requests'
  | 'applied'
  | 'first'
  | 'waiting'
  | 'second'
  | 'missed'
  | 'accepted'
  | 'rejected'

const TABS: { id: RecruitmentTab; label: string }[] = [
  { id: 'applied', label: 'Applied' },
  { id: 'first', label: 'First Interview' },
  { id: 'waiting', label: 'Waiting List' },
  { id: 'second', label: 'Second Interview' },
  { id: 'missed', label: 'Missed Interviews' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'requests', label: 'Requests & Vacancies' },
]

const TAB_BADGE: Record<RecruitmentTab, string> = {
  requests: 'badge-brand',
  applied: 'badge-blue',
  first: 'badge-yellow',
  waiting: 'badge-purple',
  second: 'badge-blue',
  missed: 'badge-orange',
  accepted: 'badge-success',
  rejected: 'badge-red',
}

const URGENCY_TONE: Record<string, string> = {
  High: 'badge-red',
  Medium: 'badge-yellow',
  Low: 'badge-blue',
}

const VACANCY_STATUS_OPTIONS = ['', 'Open', 'Draft', 'Closed']

/** "YYYY-MM" month key for the interviews calendar window. */
function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Sunday → next Sunday window for the "interviews this week" KPI. */
function weekRange(): { start: Date; end: Date } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - start.getDay())
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  return { start, end }
}

/**
 * Recruitment & Hiring (mock HR §renderRecruitment): one lifecycle board —
 * Applied → First Interview → Waiting List → Second Interview → Missed
 * Interviews → Accepted → Rejected, with the Requests & Vacancies management
 * tab last.
 */
export default function RecruitmentPage() {
  const { t } = useTranslation()
  const { can } = useMe()
  // UX gate only — the API enforces the recruitment.* keys server-side.
  const canManage = can('recruitment', 2)

  const [tab, setTab] = useState<RecruitmentTab>('applied')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailVacancyId, setDetailVacancyId] = useState<number | null>(null)
  const [editingVacancy, setEditingVacancy] = useState<Vacancy | null>(null)
  const [openCandidateId, setOpenCandidateId] = useState<number | null>(null)

  // One snapshot of every feed the tab badges read, so the counts and the tab
  // bodies can never disagree about where something stands.
  const pendingRequests = useVacancyRequests({ status: 'Pending', page: 1, pageSize: 100 })
  const rejectedRequests = useVacancyRequests({ status: 'Rejected', page: 1, pageSize: 100 })
  const activeCandidates = useCandidates({ view: 'active', page: 1, pageSize: 100 })
  const rejectedCandidates = useCandidates({ view: 'rejected', page: 1, pageSize: 100 })
  const missedCandidates = useCandidates({ view: 'missed', page: 1, pageSize: 100 })
  const blockedCandidates = useCandidates({ blocked: 'true', page: 1, pageSize: 100 })
  const hiredCandidates = useCandidates({ stage: 'Hired', page: 1, pageSize: 100 })
  const waitingList = useWaitingList({ page: 1, pageSize: 100 })
  const formApplications = useFormApplications({ page: 1, pageSize: 100 })
  const interviews = useInterviews({ month: monthKey(new Date()), page: 1, pageSize: 100 })
  const kpiVacancies = useVacancies({ page: 1, pageSize: 100 })

  const active = activeCandidates.data?.items ?? []
  const ofStage = (stage: string) => active.filter((candidate) => displayStage(candidate.stage) === stage)
  const applications = formApplications.data?.items ?? []
  const openApplications = applications.filter(
    (application) => application.status !== 'Rejected' && application.status !== 'Moved to Pipeline',
  )
  const rejectedApplications = applications.filter((application) => application.status === 'Rejected')

  const { start, end } = weekRange()
  const interviewsThisWeek = (interviews.data?.items ?? []).filter((interview) => {
    const date = new Date(`${interview.date}T00:00:00`)
    return !Number.isNaN(date.getTime()) && date >= start && date < end
  }).length

  const openPositions = (kpiVacancies.data?.items ?? []).filter((vacancy) => vacancy.status === 'Open').length

  const counts: Record<RecruitmentTab, number> = {
    requests: pendingRequests.data?.total ?? 0,
    applied: openApplications.length + ofStage('Applied').length,
    first: ofStage('First Interview').length,
    waiting: waitingList.data?.total ?? 0,
    second: ofStage('Second Interview').length,
    missed: missedCandidates.data?.total ?? 0,
    accepted: ofStage('Accepted').length + (hiredCandidates.data?.items.length ?? 0),
    rejected:
      (rejectedCandidates.data?.items.length ?? 0) +
      (blockedCandidates.data?.items.length ?? 0) +
      (rejectedRequests.data?.total ?? 0) +
      rejectedApplications.length,
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-base font-bold text-charcoal-900">{t('Recruitment & Hiring')}</h1>
          <p className="mt-0.5 text-xs text-charcoal-500">
            {t('{{open}} open positions · {{review}} requests to review · {{interviews}} interviews this week', {
              open: openPositions,
              review: counts.requests,
              interviews: interviewsThisWeek,
            })}
          </p>
        </div>
        {canManage && tab === 'requests' && (
          <Button size="sm" className="h-6 px-2 text-[10px]" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3 w-3" aria-hidden="true" />
            {t('Create Vacancy')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-charcoal-200 bg-charcoal-100 p-1">
        <div className="inline-flex flex-wrap items-center gap-1" role="tablist" aria-label={t('Recruitment stages')}>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn('tab-btn flex items-center gap-1', tab === item.id && 'active')}
            >
              {t(item.label)}
              <span className={cn('badge text-[9px]', TAB_BADGE[item.id])}>{counts[item.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        {tab === 'requests' && (
          <RequestsTab
            canManage={canManage}
            onOpenVacancy={setDetailVacancyId}
            onEditVacancy={(vacancy) => setEditingVacancy(vacancy)}
          />
        )}
        {tab === 'applied' && <AppliedTab canManage={canManage} onOpenCandidate={setOpenCandidateId} />}
        {tab === 'first' && <FirstInterviewTab canManage={canManage} onOpenCandidate={setOpenCandidateId} />}
        {tab === 'waiting' && <WaitingListTab canManage={canManage} />}
        {tab === 'second' && <SecondInterviewTab canManage={canManage} onOpenCandidate={setOpenCandidateId} />}
        {tab === 'missed' && <MissedInterviewsTab canManage={canManage} onOpenCandidate={setOpenCandidateId} />}
        {tab === 'accepted' && <AcceptedTab canManage={canManage} onOpenCandidate={setOpenCandidateId} />}
        {tab === 'rejected' && <RejectedTab onOpenCandidate={setOpenCandidateId} />}
      </div>

      {createOpen && <VacancyFormDialog vacancy={null} onClose={() => setCreateOpen(false)} />}

      {editingVacancy != null && (
        <VacancyFormDialog
          key={editingVacancy.id}
          vacancy={editingVacancy}
          onClose={() => setEditingVacancy(null)}
        />
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

      {openCandidateId != null && (
        <CandidateDetailDialog
          key={openCandidateId}
          candidateId={openCandidateId}
          canManage={canManage}
          onClose={() => setOpenCandidateId(null)}
        />
      )}
    </div>
  )
}

/* ==================== 1. Requests & Vacancies ==================== */

function RequestsTab({
  canManage,
  onOpenVacancy,
  onEditVacancy,
}: {
  canManage: boolean
  onOpenVacancy: (id: number) => void
  onEditVacancy: (vacancy: Vacancy) => void
}) {
  const { t } = useTranslation()
  const { me } = useMe()
  const gymOptions = me?.gyms ?? []

  const pending = useVacancyRequests({ status: 'Pending', page: 1, pageSize: 100 })
  const decide = useDecideVacancyRequest()
  const [rejecting, setRejecting] = useState<VacancyRequest | null>(null)
  const [comment, setComment] = useState('')
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [gym, setGym] = useState('')
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<NameDateFilter>(NO_NAME_DATE_FILTER)

  const vacancies = useVacancies({
    searchTerm: search || undefined,
    status: status || undefined,
    gym: gym ? Number(gym) : undefined,
    page,
    pageSize: 20,
  })

  const approve = async (request: VacancyRequest) => {
    setActionError(null)
    setApprovingId(request.id)
    try {
      await decide.mutateAsync({ id: request.id, body: { decision: 'Approved' } })
    } catch (err) {
      setActionError(describeApiError(err))
    } finally {
      setApprovingId(null)
    }
  }

  const reject = async () => {
    if (!rejecting) return
    setActionError(null)
    try {
      await decide.mutateAsync({
        id: rejecting.id,
        body: { decision: 'Rejected', ...(comment.trim() ? { comment: comment.trim() } : {}) },
      })
      setRejecting(null)
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  const awaiting = pending.data?.items ?? []
  const visibleRequests = awaiting.filter(
    (request) =>
      (matchesName(request.position, filter.name) || matchesName(request.submittedBy, filter.name)) &&
      withinDateRange(request.submittedDate, filter.from, filter.to),
  )

  return (
    <div className="space-y-3">
      {actionError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
          {actionError}
        </p>
      )}

      <NameDateFilterBar
        filter={filter}
        onChange={setFilter}
        placeholder={t('Search position or requester…')}
        shown={visibleRequests.length}
        total={awaiting.length}
      />

      {pending.isLoading ? (
        <p className="py-3 text-center text-xs text-charcoal-400">{t('Loading vacancy requests…')}</p>
      ) : pending.error ? (
        <ErrorState message={describeApiError(pending.error)} onRetry={() => void pending.refetch()} />
      ) : awaiting.length === 0 ? (
        <p className="rounded-xl border border-dashed border-charcoal-200 bg-white py-6 text-center text-xs text-charcoal-400">
          {t('No requests awaiting review right now.')}
        </p>
      ) : visibleRequests.length === 0 ? (
        <p className="rounded-xl border border-dashed border-charcoal-200 bg-white py-6 text-center text-xs text-charcoal-400">
          {t('No rows match these filters.')}
        </p>
      ) : (
        <div>
          <SectionLabel count={visibleRequests.length} tone="text-yellow-700">
            {t('Awaiting review')}
          </SectionLabel>
          <VacancyRequestsTable
            requests={visibleRequests}
            canDecide={canManage}
            approvingId={approvingId}
            onApprove={(request) => void approve(request)}
            onDecline={(request) => {
              setActionError(null)
              setComment('')
              setRejecting(request)
            }}
          />
        </div>
      )}
      <p className="text-[9px] text-charcoal-400">
        {t('Decided requests leave this list — the vacancy opens below, declines are kept in the Rejected tab.')}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="bento-label text-charcoal-500">{t('VACANCY MANAGEMENT')}</p>
        <Button size="sm" variant="secondary" onClick={() => setFiltersOpen((open) => !open)}>
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          {t('Filter')}
        </Button>
      </div>

      {filtersOpen && (
        <div className="grid grid-cols-1 gap-2 rounded-xl border border-charcoal-200 bg-white p-2.5 sm:grid-cols-3">
          <Input
            placeholder={t('Search position…')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            aria-label={t('Search vacancies')}
            className="h-9 text-xs"
          />
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            aria-label={t('Filter by status')}
            className="h-9 text-xs"
          >
            {VACANCY_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option ? t(option) : t('All statuses')}
              </option>
            ))}
          </Select>
          <Select
            value={gym}
            onChange={(e) => {
              setGym(e.target.value)
              setPage(1)
            }}
            aria-label={t('Filter by gym')}
            className="h-9 text-xs"
          >
            <option value="">{t('All gyms')}</option>
            {gymOptions.map((option) => (
              <option key={option.gymId} value={String(option.gymId)}>
                {option.gymName}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
        {vacancies.isLoading ? (
          <LoadingState label={t('Loading vacancies…')} />
        ) : vacancies.error ? (
          <ErrorState message={describeApiError(vacancies.error)} onRetry={() => void vacancies.refetch()} />
        ) : (vacancies.data?.items.length ?? 0) === 0 ? (
          <LifecycleEmpty icon={Briefcase}>{t('No vacancies match these filters yet.')}</LifecycleEmpty>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="data-table">
                <thead className="sticky top-0 z-10 bg-charcoal-50">
                  <tr>
                    <th>{t('Position')}</th>
                    <th>{t('Gym')}</th>
                    <th>{t('Headcount')}</th>
                    <th>{t('Urgency')}</th>
                    <th>{t('Candidates')}</th>
                    <th>{t('Status')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {vacancies.data!.items.map((vacancy) => (
                    <tr key={vacancy.id} onClick={() => onOpenVacancy(vacancy.id)} className="cursor-pointer">
                      <td>
                        <p className="text-xs font-medium text-charcoal-900">{vacancy.position}</p>
                        <p className="text-[9px] text-charcoal-400">
                          {t('Created {{date}}', { date: formatDate(vacancy.createdDate) })}
                        </p>
                      </td>
                      <td className="text-xs">{vacancy.gym}</td>
                      <td className="text-xs font-semibold">{vacancy.headcount}</td>
                      <td>
                        <span className={cn('badge text-[9px]', URGENCY_TONE[vacancy.urgency ?? ''] ?? 'badge-gray')}>
                          {vacancy.urgency ? t(vacancy.urgency) : '—'}
                        </span>
                      </td>
                      <td className="text-xs">{vacancy.candidates}</td>
                      <td>
                        <StatusBadge status={vacancy.status} />
                      </td>
                      <td>
                        {canManage && (
                          <button
                            type="button"
                            aria-label={t('Edit vacancy')}
                            onClick={(event) => {
                              event.stopPropagation()
                              onEditVacancy(vacancy)
                            }}
                            className="btn btn-sm btn-ghost"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-charcoal-100 lg:hidden">
              {vacancies.data!.items.map((vacancy) => (
                <li key={vacancy.id}>
                  <button
                    type="button"
                    onClick={() => onOpenVacancy(vacancy.id)}
                    className="flex w-full flex-col gap-1.5 px-3 py-2.5 text-start transition-colors hover:bg-charcoal-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-charcoal-900">{vacancy.position}</p>
                      <StatusBadge status={vacancy.status} />
                    </div>
                    <p className="text-[10px] text-charcoal-500">
                      {vacancy.gym} · {t('{{count}} openings', { count: vacancy.headcount })} ·{' '}
                      {t('{{count}} candidates', { count: vacancy.candidates })}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className={cn('badge text-[9px]', URGENCY_TONE[vacancy.urgency ?? ''] ?? 'badge-gray')}>
                        {vacancy.urgency ? t(vacancy.urgency) : '—'}
                      </span>
                      <span className="text-[9px] text-charcoal-400">
                        {t('Created {{date}}', { date: formatDate(vacancy.createdDate) })}
                      </span>
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
              onPageChange={setPage}
              noun={t('vacancies')}
            />
          </>
        )}
      </div>

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
            <Button variant="danger" onClick={reject} loading={decide.isPending}>
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
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('Why is this request being rejected?')}
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}

/* ==================== 2. Applied ==================== */

function AppliedTab({ canManage, onOpenCandidate }: { canManage: boolean; onOpenCandidate: (id: number) => void }) {
  const { t } = useTranslation()
  const applications = useFormApplications({ page: 1, pageSize: 100 })
  const pipeline = useCandidates({ view: 'active', page: 1, pageSize: 100 })
  const convert = useConvertFormApplication()
  const reject = useRejectFormApplication()

  const [viewing, setViewing] = useState<FormApplication | null>(null)
  const [rejecting, setRejecting] = useState<FormApplication | null>(null)
  const [comment, setComment] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [filter, setFilter] = useState<NameDateFilter>(NO_NAME_DATE_FILTER)

  const all = applications.data?.items ?? []
  const openApplications = all.filter(
    (application) => application.status !== 'Rejected' && application.status !== 'Moved to Pipeline',
  )
  const movedApplications = all.filter((application) => application.status === 'Moved to Pipeline')
  const candidates = (pipeline.data?.items ?? []).filter(
    (candidate) => displayStage(candidate.stage) === 'Applied',
  )

  const matchesFilter = (name: string, date: string | null | undefined) =>
    matchesName(name, filter.name) && withinDateRange(date, filter.from, filter.to)
  const visibleOpen = openApplications.filter((application) => matchesFilter(application.name, application.appliedDate))
  const visibleMoved = movedApplications.filter((application) => matchesFilter(application.name, application.appliedDate))
  const visibleCandidates = candidates.filter((candidate) => matchesFilter(candidate.name, candidate.appliedDate))
  const applicantsTotal = openApplications.length + movedApplications.length
  const shownTotal = visibleOpen.length + visibleMoved.length + visibleCandidates.length

  const toPipeline = async (application: FormApplication) => {
    setActionError(null)
    setBusyId(application.id)
    try {
      await convert.mutateAsync(application.id)
    } catch (err) {
      setActionError(describeApiError(err))
    } finally {
      setBusyId(null)
    }
  }

  const rejectApplication = async () => {
    if (!rejecting) return
    setActionError(null)
    try {
      await reject.mutateAsync({ id: rejecting.id, ...(comment.trim() ? { comment: comment.trim() } : {}) })
      setRejecting(null)
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  if (applications.isLoading) return <LoadingState label={t('Loading applicants…')} />
  if (applications.error) return <ErrorState message={describeApiError(applications.error)} />

  return (
    <div className="space-y-3">
      <HintBar>
        {t(
          'Applications arrive from the hiring forms. Add to Pipeline turns an applicant into a candidate — they start at Applied, then First Interview → Waiting List → branch match → accepted.',
        )}
      </HintBar>

      {actionError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
          {actionError}
        </p>
      )}

      <NameDateFilterBar
        filter={filter}
        onChange={setFilter}
        placeholder={t('Search by applicant or candidate name…')}
        shown={shownTotal}
        total={applicantsTotal + candidates.length}
      />

      <div>
        <SectionLabel
          count={visibleOpen.length + visibleMoved.length}
          tone="text-brand-700"
        >
          {t('WHO APPLIED FROM THE FORM')}
        </SectionLabel>
        <p className="mb-1.5 text-[9px] text-charcoal-400">
          {t('{{open}} to review · {{moved}} already in the pipeline', {
            open: visibleOpen.length,
            moved: visibleMoved.length,
          })}
        </p>
        {applicantsTotal === 0 ? (
          <p className="rounded-xl border border-dashed border-charcoal-200 bg-white py-6 text-center text-xs text-charcoal-400">
            {t('No form applications yet — share a hiring form from the Forms page.')}
          </p>
        ) : visibleOpen.length + visibleMoved.length === 0 ? (
          <p className="rounded-xl border border-dashed border-charcoal-200 bg-white py-6 text-center text-xs text-charcoal-400">
            {t('No rows match these filters.')}
          </p>
        ) : (
          <ApplicantsTable
            applications={[...visibleOpen, ...visibleMoved]}
            canManage={canManage}
            busyId={busyId}
            onViewAnswers={setViewing}
            onConvert={(application) => void toPipeline(application)}
            onReject={(application) => {
              setActionError(null)
              setComment('')
              setRejecting(application)
            }}
          />
        )}
      </div>

      <div>
        <SectionLabel count={visibleCandidates.length} tone="text-blue-700">
          {t('PIPELINE — APPLIED')}
        </SectionLabel>
        {pipeline.isLoading ? (
          <p className="py-3 text-center text-xs text-charcoal-400">{t('Loading candidates…')}</p>
        ) : candidates.length === 0 ? (
          <LifecycleEmpty icon={Users}>
            {t('No candidates waiting for the first interview — add an applicant to the pipeline above.')}
          </LifecycleEmpty>
        ) : visibleCandidates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-charcoal-200 bg-white py-6 text-center text-xs text-charcoal-400">
            {t('No rows match these filters.')}
          </p>
        ) : (
          <CandidateTable
            candidates={visibleCandidates}
            mode="applied"
            onOpen={onOpenCandidate}
            actions={
              canManage
                ? (candidate) => (
                    <div className="flex items-center gap-1">
                      <AdvanceActions
                        candidate={candidate}
                        nextStage="First Interview"
                        nextLabel={t('Move to First Interview →')}
                      />
                    </div>
                  )
                : undefined
            }
          />
        )}
      </div>

      {viewing && <ApplicantAnswersDialog application={viewing} onClose={() => setViewing(null)} />}

      <Dialog
        open={rejecting != null}
        onClose={() => setRejecting(null)}
        title={t('Reject — {{name}}', { name: rejecting?.name ?? '' })}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              {t('Cancel')}
            </Button>
            <Button variant="dangerOutline" onClick={rejectApplication} loading={reject.isPending}>
              {t('Reject application')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-2 text-[10px] text-red-800">
            {t('The applicant leaves the review queue and is kept in the Rejected tab for the record.')}
          </p>
          <div>
            <Label htmlFor="applicant-reject-comment">{t('Reason (optional)')}</Label>
            <Textarea
              id="applicant-reject-comment"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('e.g. shift mismatch / no show')}
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}

/* ==================== 3. First Interview ==================== */

function FirstInterviewTab({
  canManage,
  onOpenCandidate,
}: {
  canManage: boolean
  onOpenCandidate: (id: number) => void
}) {
  const { t } = useTranslation()
  const candidates = useCandidates({ stage: 'First Interview', page: 1, pageSize: 50 })
  const move = useMoveCandidateStage()
  const [scheduling, setScheduling] = useState<CandidateCard | null>(null)
  const [rejecting, setRejecting] = useState<CandidateCard | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [filter, setFilter] = useState<NameDateFilter>(NO_NAME_DATE_FILTER)

  const list = candidates.data?.items ?? []
  const visible = list.filter(
    (candidate) =>
      matchesName(candidate.name, filter.name) &&
      withinDateRange(candidate.iv1?.date, filter.from, filter.to),
  )

  const advance = async (candidate: CandidateCard) => {
    if (!candidate.applicationId) return
    setActionError(null)
    try {
      await move.mutateAsync({ applicationId: candidate.applicationId, stage: 'Second Interview' })
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  if (candidates.isLoading) return <LoadingState label={t('Loading candidates…')} />
  if (candidates.error) return <ErrorState message={describeApiError(candidates.error)} />

  return (
    <div className="space-y-3">
      <HintBar>
        {t(
          'The verdict decides who moves on: passing the first round books the second interview; a rejection sends the candidate to the Rejected tab.',
        )}
      </HintBar>

      {actionError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
          {actionError}
        </p>
      )}

      <NameDateFilterBar
        filter={filter}
        onChange={setFilter}
        placeholder={t('Search by candidate name…')}
        shown={visible.length}
        total={list.length}
      />

      <SectionLabel count={visible.length} tone="text-yellow-700">
        {t('FIRST INTERVIEW — {{count}} CANDIDATES', { count: visible.length })}
      </SectionLabel>
      {list.length === 0 ? (
        <LifecycleEmpty icon={Users}>
          {t('No candidates in the first interview stage — advance someone from the Applied tab.')}
        </LifecycleEmpty>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-charcoal-200 bg-white py-6 text-center text-xs text-charcoal-400">
          {t('No rows match these filters.')}
        </p>
      ) : (
        <>
          <p className="-mt-1 text-[9px] text-charcoal-400">
            {t('On-site or by video · the verdict decides who moves on')}
          </p>
          <CandidateTable
            candidates={visible}
            mode="first"
            onOpen={onOpenCandidate}
            actions={
              canManage
                ? (candidate) => {
                    const scheduled = Boolean(candidate.iv1?.date)
                    return (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setScheduling(candidate)}
                          className={cn('btn btn-sm', scheduled ? 'btn-secondary' : 'btn-primary')}
                        >
                          {scheduled ? t('Reschedule 1st interview') : t('Schedule 1st interview')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void advance(candidate)}
                          disabled={!candidate.applicationId}
                          className="btn btn-sm btn-success"
                        >
                          {t('Move to Second Interview →')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejecting(candidate)}
                          className="btn btn-sm btn-danger-outline"
                        >
                          {t('Reject')}
                        </button>
                      </div>
                    )
                  }
                : undefined
            }
          />
        </>
      )}

      {scheduling && (
        <ScheduleInterviewDialog candidate={scheduling} round="First Interview" onClose={() => setScheduling(null)} />
      )}
      {rejecting && <RejectCandidateDialog candidate={rejecting} onClose={() => setRejecting(null)} />}
    </div>
  )
}

/* ==================== 4. Waiting List ==================== */

function WaitingListTab({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation()
  const waiting = useWaitingList({ page: 1, pageSize: 100 })
  const remove = useRemoveFromWaitingList()
  const [assigning, setAssigning] = useState<WaitingListItem | null>(null)
  const [removing, setRemoving] = useState<WaitingListItem | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [filter, setFilter] = useState<NameDateFilter>(NO_NAME_DATE_FILTER)

  const list = waiting.data?.items ?? []
  const visible = list.filter(
    (item) => matchesName(item.name, filter.name) && withinDateRange(item.since, filter.from, filter.to),
  )

  const confirmRemove = async () => {
    if (!removing) return
    setActionError(null)
    try {
      await remove.mutateAsync(removing.id)
      setRemoving(null)
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  if (waiting.isLoading) return <LoadingState label={t('Loading the waiting list…')} />
  if (waiting.error) return <ErrorState message={describeApiError(waiting.error)} />

  return (
    <div className="space-y-3">
      <HintBar>
        {t(
          'Parked after the interview pipeline — this is the pool branch matches are picked from. Assign to an open position to hire the candidate directly when a seat fits.',
        )}
      </HintBar>

      {actionError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
          {actionError}
        </p>
      )}

      <NameDateFilterBar
        filter={filter}
        onChange={setFilter}
        placeholder={t('Search by candidate name…')}
        shown={visible.length}
        total={list.length}
      />

      <SectionLabel count={visible.length} tone="text-purple-700">
        {t('Waiting candidates')}
      </SectionLabel>

      {list.length === 0 ? (
        <LifecycleEmpty icon={Users}>
          {t('The waiting list is empty — pass a first interview and the candidate lands here.')}
        </LifecycleEmpty>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-charcoal-200 bg-white py-6 text-center text-xs text-charcoal-400">
          {t('No rows match these filters.')}
        </p>
      ) : (
        <WaitingListTable
          items={visible}
          canManage={canManage}
          removingId={remove.isPending ? remove.variables : null}
          onAssign={setAssigning}
          onRemove={(item) => {
            setActionError(null)
            setRemoving(item)
          }}
        />
      )}

      {assigning && <HireEmployeeDialog waiting={assigning} onClose={() => setAssigning(null)} />}

      <Dialog
        open={removing != null}
        onClose={() => setRemoving(null)}
        title={t('Remove from the waiting list')}
        description={removing ? `${removing.name} · ${removing.position ?? ''}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              {t('Cancel')}
            </Button>
            <Button variant="danger" onClick={confirmRemove} loading={remove.isPending}>
              {t('Remove entry')}
            </Button>
          </>
        }
      >
        <p className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-2 text-[10px] text-red-800">
          {t('The candidate leaves the pool and its application record is deleted. This cannot be undone.')}
        </p>
      </Dialog>
    </div>
  )
}

/* ==================== 5. Second Interview ==================== */

function SecondInterviewTab({
  canManage,
  onOpenCandidate,
}: {
  canManage: boolean
  onOpenCandidate: (id: number) => void
}) {
  const { t } = useTranslation()
  const candidates = useCandidates({ stage: 'Second Interview', page: 1, pageSize: 50 })
  const move = useMoveCandidateStage()
  const [scheduling, setScheduling] = useState<CandidateCard | null>(null)
  const [rejecting, setRejecting] = useState<CandidateCard | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [filter, setFilter] = useState<NameDateFilter>(NO_NAME_DATE_FILTER)

  const list = candidates.data?.items ?? []
  const visible = list.filter(
    (candidate) =>
      matchesName(candidate.name, filter.name) &&
      withinDateRange(candidate.iv2?.date, filter.from, filter.to),
  )

  const accept = async (candidate: CandidateCard) => {
    if (!candidate.applicationId) return
    setActionError(null)
    try {
      await move.mutateAsync({ applicationId: candidate.applicationId, stage: 'Accepted' })
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  if (candidates.isLoading) return <LoadingState label={t('Loading candidates…')} />
  if (candidates.error) return <ErrorState message={describeApiError(candidates.error)} />

  return (
    <div className="space-y-3">
      <HintBar>
        {t(
          'The Branch Manager runs the second interview — the verdict lands in Accepted or Rejected and travels back to HR automatically.',
        )}
      </HintBar>

      {actionError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
          {actionError}
        </p>
      )}

      <NameDateFilterBar
        filter={filter}
        onChange={setFilter}
        placeholder={t('Search by candidate name…')}
        shown={visible.length}
        total={list.length}
      />

      <SectionLabel count={visible.length} tone="text-blue-700">
        {t('WITH THE BRANCH — {{count}} MATCHES', { count: visible.length })}
      </SectionLabel>
      {list.length === 0 ? (
        <LifecycleEmpty icon={Users}>
          {t('Nobody in a second interview right now — move a first-interview candidate forward.')}
        </LifecycleEmpty>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-charcoal-200 bg-white py-6 text-center text-xs text-charcoal-400">
          {t('No rows match these filters.')}
        </p>
      ) : (
        <>
          <p className="-mt-1 text-[9px] text-charcoal-400">
            {t("Waiting on the BM's call / 2nd interview verdict")}
          </p>
          <CandidateTable
            candidates={visible}
            mode="second"
            onOpen={onOpenCandidate}
            actions={
              canManage
                ? (candidate) => {
                    const scheduled = Boolean(candidate.iv2?.date)
                    return (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setScheduling(candidate)}
                          className={cn('btn btn-sm', scheduled ? 'btn-secondary' : 'btn-primary')}
                        >
                          {scheduled ? t('Reschedule 2nd interview') : t('Schedule 2nd interview')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void accept(candidate)}
                          disabled={!candidate.applicationId}
                          className="btn btn-sm btn-success"
                        >
                          {t('Accept → hire')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejecting(candidate)}
                          className="btn btn-sm btn-danger-outline"
                        >
                          {t('Reject')}
                        </button>
                      </div>
                    )
                  }
                : undefined
            }
          />
        </>
      )}

      {scheduling && (
        <ScheduleInterviewDialog candidate={scheduling} round="Second Interview" onClose={() => setScheduling(null)} />
      )}
      {rejecting && <RejectCandidateDialog candidate={rejecting} onClose={() => setRejecting(null)} />}
    </div>
  )
}

/* ==================== 5b. Missed Interviews ==================== */

/** Scheduled rounds whose slot passed without notes or a verdict (no-shows). */
function MissedInterviewsTab({
  canManage,
  onOpenCandidate,
}: {
  canManage: boolean
  onOpenCandidate: (id: number) => void
}) {
  const { t } = useTranslation()
  const candidates = useCandidates({ view: 'missed', page: 1, pageSize: 100 })
  const [scheduling, setScheduling] = useState<CandidateCard | null>(null)
  const [rejecting, setRejecting] = useState<CandidateCard | null>(null)
  const [filter, setFilter] = useState<NameDateFilter>(NO_NAME_DATE_FILTER)

  const list = candidates.data?.items ?? []
  const visible = list.filter(
    (candidate) =>
      matchesName(candidate.name, filter.name) &&
      withinDateRange(candidate.missed?.scheduledDate, filter.from, filter.to),
  )

  if (candidates.isLoading) return <LoadingState label={t('Loading candidates…')} />
  if (candidates.error) return <ErrorState message={describeApiError(candidates.error)} />

  return (
    <div className="space-y-3">
      <HintBar>
        {t(
          'Scheduled interviews whose slot has passed without notes or a verdict — the candidate did not attend. Rebook the round or move the candidate to the Rejected tab.',
        )}
      </HintBar>

      <NameDateFilterBar
        filter={filter}
        onChange={setFilter}
        placeholder={t('Search by candidate name…')}
        shown={visible.length}
        total={list.length}
      />

      <SectionLabel count={visible.length} tone="text-orange-700">
        {t('MISSED INTERVIEWS — {{count}}', { count: visible.length })}
      </SectionLabel>

      {list.length === 0 ? (
        <LifecycleEmpty icon={CalendarX}>
          {t('No missed interviews — every scheduled round was attended or is still upcoming.')}
        </LifecycleEmpty>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-charcoal-200 bg-white py-6 text-center text-xs text-charcoal-400">
          {t('No rows match these filters.')}
        </p>
      ) : (
        <CandidateTable
          candidates={visible}
          mode="missed"
          onOpen={onOpenCandidate}
          actions={
            canManage
              ? (candidate) => (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setScheduling(candidate)}
                      disabled={!candidate.missed}
                      className="btn btn-sm btn-primary"
                    >
                      {candidate.missed ? t('Rebook {{round}}', { round: t(candidate.missed.stage) }) : t('Rebook')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejecting(candidate)}
                      className="btn btn-sm btn-danger-outline"
                    >
                      {t('Reject')}
                    </button>
                  </div>
                )
              : undefined
          }
        />
      )}

      {scheduling?.missed && (
        <ScheduleInterviewDialog
          candidate={scheduling}
          round={scheduling.missed.stage}
          onClose={() => setScheduling(null)}
        />
      )}
      {rejecting && <RejectCandidateDialog candidate={rejecting} onClose={() => setRejecting(null)} />}
    </div>
  )
}

/* ==================== 6. Accepted ==================== */

function AcceptedTab({ canManage, onOpenCandidate }: { canManage: boolean; onOpenCandidate: (id: number) => void }) {
  const { t } = useTranslation()
  const accepted = useCandidates({ stage: 'Accepted', page: 1, pageSize: 50 })
  const hired = useCandidates({ stage: 'Hired', page: 1, pageSize: 50 })
  const [hiring, setHiring] = useState<CandidateCard | null>(null)
  const [filter, setFilter] = useState<NameDateFilter>(NO_NAME_DATE_FILTER)

  const acceptedList = accepted.data?.items ?? []
  const hiredList = hired.data?.items ?? []

  // Accepted rows age by their decision date, hired ones by the hire date.
  const visibleAccepted = acceptedList.filter(
    (candidate) =>
      matchesName(candidate.name, filter.name) &&
      withinDateRange(candidate.decision?.date, filter.from, filter.to),
  )
  const visibleHired = hiredList.filter(
    (candidate) =>
      matchesName(candidate.name, filter.name) &&
      withinDateRange(candidate.hiredDate ?? candidate.decision?.date, filter.from, filter.to),
  )
  const total = acceptedList.length + hiredList.length
  const shown = visibleAccepted.length + visibleHired.length

  if (accepted.isLoading) return <LoadingState label={t('Loading candidates…')} />
  if (accepted.error) return <ErrorState message={describeApiError(accepted.error)} />

  return (
    <div className="space-y-3">
      <HintBar>
        {t(
          'Accepted at the second interview (or accepted from the pipeline). The last step: create the employee account — the hire wizard turns the whole interview trail into an employee record and closes the seat.',
        )}
      </HintBar>

      <NameDateFilterBar
        filter={filter}
        onChange={setFilter}
        placeholder={t('Search by candidate name…')}
        shown={shown}
        total={total}
      />

      {visibleAccepted.length > 0 && (
        <div>
          <SectionLabel count={visibleAccepted.length} tone="text-green-700">
            {t('ACCEPTED FROM THE PIPELINE — {{count}}', { count: visibleAccepted.length })}
          </SectionLabel>
          <p className="mb-1.5 text-[9px] text-charcoal-400">
            {t('Create the account — the vacancy seat closes with it')}
          </p>
          <CandidateTable
            candidates={visibleAccepted}
            mode="accepted"
            onOpen={onOpenCandidate}
            actions={
              canManage
                ? (candidate) => (
                    <button type="button" onClick={() => setHiring(candidate)} className="btn btn-sm btn-success">
                      {t('Hire — Salary, Terms & Account →')}
                    </button>
                  )
                : undefined
            }
          />
        </div>
      )}

      {visibleHired.length > 0 && (
        <div>
          <SectionLabel count={visibleHired.length} tone="text-green-700">
            {t('HIRED — ACCOUNT CREATED — {{count}}', { count: visibleHired.length })}
          </SectionLabel>
          <p className="mb-1.5 text-[9px] font-semibold text-green-700">
            {t('Account created · onboarding started ✓')}
          </p>
          <CandidateTable candidates={visibleHired} mode="hired" onOpen={onOpenCandidate} />
        </div>
      )}

      {total === 0 ? (
        <LifecycleEmpty icon={Users}>
          {t('Nobody accepted yet — matches awaiting a verdict are in the Second Interview tab.')}
        </LifecycleEmpty>
      ) : shown === 0 ? (
        <p className="rounded-xl border border-dashed border-charcoal-200 bg-white py-6 text-center text-xs text-charcoal-400">
          {t('No rows match these filters.')}
        </p>
      ) : null}

      {hiring && <HireEmployeeDialog candidate={hiring} onClose={() => setHiring(null)} />}
    </div>
  )
}

/* ==================== 7. Rejected ==================== */

function RejectedTab({ onOpenCandidate }: { onOpenCandidate: (id: number) => void }) {
  const { t } = useTranslation()
  const rejected = useCandidates({ view: 'rejected', page: 1, pageSize: 100 })
  const blocked = useCandidates({ blocked: 'true', page: 1, pageSize: 100 })
  const declinedRequests = useVacancyRequests({ status: 'Rejected', page: 1, pageSize: 100 })
  const applications = useFormApplications({ page: 1, pageSize: 100 })
  const restore = useBlockCandidate()
  const [viewing, setViewing] = useState<FormApplication | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [filter, setFilter] = useState<NameDateFilter>(NO_NAME_DATE_FILTER)

  const candidates = rejected.data?.items ?? []
  const blockedCandidates = blocked.data?.items ?? []
  const requests = declinedRequests.data?.items ?? []
  const rejectedApplications = (applications.data?.items ?? []).filter(
    (application) => application.status === 'Rejected',
  )
  const total = candidates.length + blockedCandidates.length + requests.length + rejectedApplications.length

  // Blocked cards carry no decision date, so a date window hides them by design.
  const visibleCandidates = candidates.filter(
    (candidate) =>
      matchesName(candidate.name, filter.name) &&
      withinDateRange(candidate.rejectedDate ?? candidate.decision?.date, filter.from, filter.to),
  )
  const visibleBlocked = blockedCandidates.filter(
    (candidate) => matchesName(candidate.name, filter.name) && withinDateRange(null, filter.from, filter.to),
  )
  const visibleRequests = requests.filter(
    (request) =>
      (matchesName(request.position, filter.name) || matchesName(request.submittedBy, filter.name)) &&
      withinDateRange(request.submittedDate, filter.from, filter.to),
  )
  const visibleApplications = rejectedApplications.filter(
    (application) =>
      matchesName(application.name, filter.name) &&
      withinDateRange(application.appliedDate, filter.from, filter.to),
  )
  const shown =
    visibleCandidates.length + visibleBlocked.length + visibleRequests.length + visibleApplications.length

  const restoreCandidate = async (candidate: CandidateCard) => {
    setActionError(null)
    try {
      await restore.mutateAsync({ id: candidate.id, blocked: false })
    } catch (err) {
      setActionError(describeApiError(err))
    }
  }

  if (rejected.isLoading) return <LoadingState label={t('Loading candidates…')} />
  if (rejected.error) return <ErrorState message={describeApiError(rejected.error)} />

  return (
    <div className="space-y-3">
      <HintBar>
        {t(
          'Everyone rejected along the way — HR decisions and interview verdicts from the branches, kept here for the record.',
        )}
      </HintBar>

      {actionError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
          {actionError}
        </p>
      )}

      <NameDateFilterBar
        filter={filter}
        onChange={setFilter}
        placeholder={t('Search by candidate, position or requester…')}
        shown={shown}
        total={total}
      />

      {total === 0 ? (
        <LifecycleEmpty icon={FileText}>{t('Nobody rejected — all clear.')}</LifecycleEmpty>
      ) : shown === 0 ? (
        <p className="rounded-xl border border-dashed border-charcoal-200 bg-white py-6 text-center text-xs text-charcoal-400">
          {t('No rows match these filters.')}
        </p>
      ) : (
        <>
          {visibleCandidates.length > 0 && (
            <div>
              <SectionLabel count={visibleCandidates.length} tone="text-red-600">
                {t('Candidates')}
              </SectionLabel>
              <CandidateTable candidates={visibleCandidates} mode="rejected" onOpen={onOpenCandidate} />
            </div>
          )}

          {visibleBlocked.length > 0 && (
            <div>
              <SectionLabel count={visibleBlocked.length} tone="text-red-600">
                {t('Blocked')}
              </SectionLabel>
              <CandidateTable
                candidates={visibleBlocked}
                mode="blocked"
                onOpen={onOpenCandidate}
                actions={(candidate) => (
                  <button
                    type="button"
                    onClick={() => void restoreCandidate(candidate)}
                    className="btn btn-sm btn-ghost font-bold text-brand-700"
                  >
                    {t('Restore to pipeline')}
                  </button>
                )}
              />
            </div>
          )}

          {visibleRequests.length > 0 && (
            <div>
              <SectionLabel count={visibleRequests.length} tone="text-red-600">
                {t('Requests declined by HR')}
              </SectionLabel>
              <VacancyRequestsTable requests={visibleRequests} />
            </div>
          )}

          {visibleApplications.length > 0 && (
            <div>
              <SectionLabel count={visibleApplications.length} tone="text-red-600">
                {t('Applications')}
              </SectionLabel>
              <ApplicantsTable
                applications={visibleApplications}
                canManage={false}
                onViewAnswers={setViewing}
                onConvert={() => undefined}
                onReject={() => undefined}
              />
            </div>
          )}
        </>
      )}

      {viewing && <ApplicantAnswersDialog application={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

/* ==================== shared actions ==================== */

/** Quick stage-move buttons shown on the Applied cards. */
function AdvanceActions({
  candidate,
  nextStage,
  nextLabel,
}: {
  candidate: CandidateCard
  nextStage: string
  nextLabel: string
}) {
  const { t } = useTranslation()
  const move = useMoveCandidateStage()
  const [rejecting, setRejecting] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() =>
          candidate.applicationId && void move.mutateAsync({ applicationId: candidate.applicationId, stage: nextStage })
        }
        disabled={!candidate.applicationId || move.isPending}
        className="btn btn-sm btn-primary flex-1"
      >
        {nextLabel}
      </button>
      <button type="button" onClick={() => setRejecting(true)} className="btn btn-sm btn-danger-outline">
        {t('Reject')}
      </button>
      {rejecting && <RejectCandidateDialog candidate={candidate} onClose={() => setRejecting(false)} />}
    </>
  )
}

/** Confirmation for moving a candidate to the Rejected stage. */
function RejectCandidateDialog({ candidate, onClose }: { candidate: CandidateCard; onClose: () => void }) {
  const { t } = useTranslation()
  const move = useMoveCandidateStage()
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    if (!candidate.applicationId) {
      setError(t('This card has no linked application, so its stage cannot move.'))
      return
    }
    setError(null)
    try {
      await move.mutateAsync({ applicationId: candidate.applicationId, stage: 'Rejected' })
      onClose()
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('Reject — {{name}}', { name: candidate.name })}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button variant="dangerOutline" onClick={confirm} loading={move.isPending}>
            {t('Reject candidate')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <p className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-2 text-[10px] text-red-800">
          {t('{{name}} leaves the pipeline (currently {{stage}}) and moves to the Rejected tab.', {
            name: candidate.name,
            stage: t(displayStage(candidate.stage)),
          })}
        </p>
      </div>
    </Dialog>
  )
}
