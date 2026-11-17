import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Phone, Plus, ScanFace, UserRound } from 'lucide-react'
import {
  createVacancyRequest,
  decideVacancyRequest,
  getEmployeeDirectory,
  getVacancyRequests,
  reopenVacancyRequest,
  type VacancyRequestRow,
} from '../api/branch.api'
import { getCandidates, getVacancies, type CandidateCard } from '../../recruitment/api/recruitment.api'
import { EmptyState } from '../../../components/ui/primitives'
import { StatusBadge } from '../../../components/ui/badge'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { useToast } from '../../../components/ui/toast'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { cn } from '../../../lib/utils'
import { formatDate, formatMoney, humanize } from '../../../lib/format'

/**
 * Recruitment (mock §23 renderRecruitment): the BM's headcount-requisition
 * queue — submit a vacancy request and follow its real state
 * (Pending → HR decides → Approved/Rejected). The mock's candidate-match /
 * second-interview stage machine is HR-side in the real domain (documented
 * deviation), so the tabs are the three real statuses. Decide/Reopen buttons
 * render only for `recruitment.vacancy_request.approve` key holders.
 */

/**
 * The branch's own hiring funnel, in the order a position travels it: a request
 * waits for HR, its candidates reach the second interview, HR approves the
 * position, and the accepted newcomer still needs his face enrolled.
 */
type Tab = 'All' | 'AwaitingMatch' | 'SecondInterview' | 'Approved' | 'NewComers'
const TABS: Tab[] = ['All', 'AwaitingMatch', 'SecondInterview', 'Approved', 'NewComers']

/** Tabs backed by vacancy requests; the pipeline tabs read a different feed. */
const POSITION_TABS: Tab[] = ['All', 'AwaitingMatch', 'Approved']

/** The status chips inside All Positions — the two decision states of a requisition. */
type AllFilter = 'All' | 'Pending' | 'Rejected'
const ALL_FILTERS: AllFilter[] = ['All', 'Pending', 'Rejected']

/** How far back a hire still counts as a newcomer the branch must enroll. */
const NEWCOMER_WINDOW_DAYS = 30

const URGENCY_BADGE: Record<string, string> = {
  high: 'bg-red-50 text-red-700',
  medium: 'bg-yellow-50 text-yellow-700',
  low: 'bg-blue-50 text-blue-700',
}

function urgencyClass(urgency: string | null): string {
  if (!urgency) return 'bg-charcoal-50 text-charcoal-600'
  return URGENCY_BADGE[urgency.trim().toLowerCase()] ?? 'bg-charcoal-50 text-charcoal-600'
}

function Chip({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold', className)}>
      {children}
    </span>
  )
}

export default function BranchRecruitmentPage() {
  const { t } = useTranslation()
  const me = usePortalSession()

  // Recruitment is a Branch-Manager surface (never served to a Team Leader,
  // even as an empty state): the keys AND the active-gym role must both say
  // Branch Manager.
  if (!me.isBranchManager || (!me.can('recruitment.view') && !me.can('recruitment.vacancy_request.create'))) {
    return (
      <EmptyState
        title={t('Recruitment is for Branch Managers')}
        hint={t('Submitting vacancy requests requires the requisition keys and the Branch Manager role in the active gym.')}
      />
    )
  }

  return <RecruitmentWorkspace />
}

function RecruitmentWorkspace() {
  const { t } = useTranslation()
  const { me, can } = usePortalSession()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('All')
  const [allFilter, setAllFilter] = useState<AllFilter>('All')
  const [page, setPage] = useState(1)
  const [newOpen, setNewOpen] = useState(false)
  const [detail, setDetail] = useState<VacancyRequestRow | null>(null)

  const isPositionTab = POSITION_TABS.includes(tab)

  // The requisition status the list asks for: All Positions narrows to the chip the
  // manager picked, "no match yet" reads the approved feed, everything else is direct.
  const statusFilter: string | undefined =
    tab === 'All' ? (allFilter === 'All' ? undefined : allFilter) : tab === 'AwaitingMatch' ? 'Approved' : tab

  const listQuery = useQuery({
    queryKey: ['portal', 'vacancy-requests', tab, allFilter, page],
    queryFn: ({ signal }) =>
      getVacancyRequests({
        status: statusFilter,
        page,
        pageSize: 12,
        signal,
      }),
    enabled: isPositionTab,
    placeholderData: (previous) => previous,
  })

  // Tab counts — three cheap pageSize=1 count queries (real-state tabs).
  const tabsQuery = useQuery({
    queryKey: ['portal', 'vacancy-requests', 'counts'],
    queryFn: ({ signal }) =>
      Promise.all(
        (['Pending', 'Approved', 'Rejected'] as const).map(async (status) => {
          const envelope = await getVacancyRequests({ status, page: 1, pageSize: 1, signal })
          return [status, envelope.total] as const
        }),
      ),
  })

  // The two pipeline stages read their own feeds: candidates waiting on a second
  // interview, and the newcomers whose face the kiosk still has to learn. They share
  // their query keys with the sections below, so opening a tab costs no extra call.
  const secondInterviewQuery = useQuery({
    queryKey: ['portal', 'candidates', 'Second Interview'],
    queryFn: ({ signal }) => getCandidates({ stage: 'Second Interview', pageSize: 50 }, signal),
  })
  const newcomersQuery = useQuery({
    queryKey: ['portal', 'employees', 'new-comers'],
    queryFn: ({ signal }) => getEmployeeDirectory({ page: 1, pageSize: 200, signal }),
  })

  // An approved opening splits on whether anyone has been matched to it yet: the
  // vacancy row carries its count of non-rejected applicants.
  const vacanciesQuery = useQuery({
    queryKey: ['portal', 'vacancies', 'match-counts'],
    queryFn: ({ signal }) => getVacancies({ page: 1, pageSize: 200 }, signal),
  })
  const approvedSplitQuery = useQuery({
    queryKey: ['portal', 'vacancy-requests', 'approved-split'],
    queryFn: ({ signal }) => getVacancyRequests({ status: 'Approved', page: 1, pageSize: 100, signal }),
  })

  if (isPositionTab && listQuery.isLoading) return <LoadingState />
  if (isPositionTab && listQuery.error)
    return <ErrorState message={describeApiError(listQuery.error)} onRetry={() => void listQuery.refetch()} />

  const applicationsByVacancy = new Map(
    (vacanciesQuery.data?.items ?? []).map((vacancy) => [vacancy.id, vacancy.candidates]),
  )
  const applicationsByPosition = new Map(
    (vacanciesQuery.data?.items ?? []).map((vacancy) => [vacancy.position.trim().toLowerCase(), vacancy.candidates]),
  )
  const applicantsOf = (row: VacancyRequestRow): number => {
    if (row.vacancyId != null && applicationsByVacancy.has(row.vacancyId)) {
      return applicationsByVacancy.get(row.vacancyId) ?? 0
    }
    // A requisition and its vacancy are seeded (and sometimes recorded) independently,
    // so an approved request falls back to its position label to find its applicant count.
    return applicationsByPosition.get(row.position.trim().toLowerCase()) ?? 0
  }

  const approvedItems = approvedSplitQuery.data?.items ?? []
  const awaitingMatchCount = approvedItems.filter((row) => applicantsOf(row) === 0).length
  const matchedApprovedCount = approvedItems.length - awaitingMatchCount

  const rows = (listQuery.data?.items ?? []).filter((row) => {
    if (tab !== 'AwaitingMatch' && tab !== 'Approved') return true
    return tab === 'AwaitingMatch' ? applicantsOf(row) === 0 : applicantsOf(row) > 0
  })
  const total = listQuery.data?.total ?? 0
  const totalPages = listQuery.data?.totalPages ?? 1
  const openPositions = rows.reduce((sum, row) => sum + row.headcount, 0)
  const counts = new Map(tabsQuery.data?.map(([status, value]) => [status, value]))

  const newcomerCount = recentHires(newcomersQuery.data?.items ?? []).length
  const tabCount = (option: Tab): number => {
    if (option === 'All') return Math.max(total, 0)
    if (option === 'AwaitingMatch') return awaitingMatchCount
    if (option === 'SecondInterview') return secondInterviewQuery.data?.total ?? 0
    if (option === 'NewComers') return newcomerCount
    if (option === 'Approved') return matchedApprovedCount
    return counts.get(option) ?? 0
  }
  const tabLabel = (option: Tab): string => {
    if (option === 'All') return t('All Positions')
    if (option === 'AwaitingMatch') return t('Approved · No Match Yet')
    if (option === 'SecondInterview') return t('Waiting for 2nd Interview')
    if (option === 'NewComers') return t('New Comers')
    return t('{{status}} Positions', { status: t(option) })
  }

  const allFilterCount = (option: AllFilter): number =>
    option === 'All'
      ? (counts.get('Pending') ?? 0) + (counts.get('Approved') ?? 0) + (counts.get('Rejected') ?? 0)
      : (counts.get(option) ?? 0)

  const refreshLists = () => {
    void queryClient.invalidateQueries({ queryKey: ['portal', 'vacancy-requests'] })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-charcoal-900">{t('Recruitment')}</h1>
          <p className="mt-0.5 text-xs text-charcoal-500">
            {t('{{positions}} open positions on this page · {{requests}} requests · {{gym}}', {
              positions: openPositions,
              requests: Math.max(total, rows.length),
              gym: me?.activeGym?.gymName || t('your gym'),
            })}
          </p>
        </div>
        {can('recruitment.vacancy_request.create') && (
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t('New Request')}
          </Button>
        )}
      </div>

      {/* State tabs with live counts */}
      <div className="flex overflow-x-auto rounded-xl border border-charcoal-200 bg-white px-1.5">
        {TABS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setTab(option)
              setPage(1)
            }}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs font-semibold transition-colors',
              tab === option
                ? 'border-b-2 border-brand-600 text-brand-700'
                : 'border-b-2 border-transparent text-charcoal-500 hover:text-charcoal-700',
            )}
          >
            {tabLabel(option)}
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                tab === option ? 'bg-brand-100 text-brand-700' : 'bg-charcoal-100 text-charcoal-600',
              )}
            >
              {tabCount(option)}
            </span>
          </button>
        ))}
      </div>

      {tab === 'All' && (
        <div className="flex flex-wrap items-center gap-1">
          {ALL_FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setAllFilter(option)
                setPage(1)
              }}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                allFilter === option
                  ? 'bg-charcoal-800 text-white'
                  : 'bg-charcoal-100 text-charcoal-600 hover:bg-charcoal-200',
              )}
            >
              {option === 'All' ? t('All') : t('{{status}} Positions', { status: t(option) })}
              <span className="ms-1.5 text-[10px] opacity-70">{allFilterCount(option)}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'SecondInterview' ? (
        <SecondInterviewSection />
      ) : tab === 'NewComers' ? (
        <NewComersSection />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-charcoal-200 bg-white p-8 text-center">
          <UserRound className="mx-auto mb-2 h-10 w-10 text-charcoal-300" aria-hidden="true" />
          <p className="text-xs text-charcoal-500">{t('No requests here right now.')}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <RecruitmentCard key={row.id} row={row} onOpen={() => setDetail(row)} />
          ))}
        </div>
      )}

      {isPositionTab && (totalPages > 1 || (listQuery.data?.page ?? 1) > 1) && (
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="secondary"
            disabled={(listQuery.data?.page ?? 1) <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            {t('Previous')}
          </Button>
          <span className="text-[11px] text-charcoal-500">
            {t('Page {{page}} of {{total}}', { page: listQuery.data?.page ?? 1, total: totalPages })}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={(listQuery.data?.page ?? 1) >= totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            {t('Next')}
          </Button>
        </div>
      )}

      {newOpen && <NewRequestModal onClose={() => setNewOpen(false)} onSaved={refreshLists} />}

      {detail && (
        <RecruitmentDetailModal
          row={detail}
          canApprove={can('recruitment.vacancy_request.approve')}
          canRaise={can('recruitment.vacancy_request.create')}
          onClose={() => setDetail(null)}
          onRaise={() => {
            setDetail(null)
            setNewOpen(true)
          }}
          onChanged={(next) => {
            refreshLists()
            if (next) setDetail(next)
            else setDetail(null)
          }}
        />
      )}
    </div>
  )
}

/* ==================== card ==================== */

/* ==================== pipeline stages ==================== */

/** Employees hired inside the newcomer window — the faces the kiosk still has to learn. */
function recentHires<T extends { hireDate: string | null }>(rows: T[]): T[] {
  const cutoff = Date.now() - NEWCOMER_WINDOW_DAYS * 24 * 60 * 60 * 1000
  return rows.filter((row) => {
    if (!row.hireDate) return false
    const hired = new Date(row.hireDate).getTime()
    return Number.isFinite(hired) && hired >= cutoff
  })
}

/**
 * Candidates HR has pushed to the second interview for one of this branch's
 * positions. The branch's job here is the phone call: agree a date with the
 * applicant and tell HR, who records it on the application.
 */
function SecondInterviewSection() {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['portal', 'candidates', 'Second Interview'],
    queryFn: ({ signal }) => getCandidates({ stage: 'Second Interview', pageSize: 50 }, signal),
  })

  if (query.isLoading) return <LoadingState />
  if (query.error) return <ErrorState message={describeApiError(query.error)} onRetry={() => void query.refetch()} />

  const rows = query.data?.items ?? []
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-charcoal-200 bg-white p-8 text-center">
        <UserRound className="mx-auto mb-2 h-10 w-10 text-charcoal-300" aria-hidden="true" />
        <p className="text-xs text-charcoal-500">{t('Nobody is waiting for a second interview.')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-charcoal-500">
        {t('Call the applicant to agree the second-interview date — HR records the appointment on the application.')}
      </p>
      {rows.map((candidate) => (
        <SecondInterviewCard key={candidate.id} candidate={candidate} />
      ))}
    </div>
  )
}

function SecondInterviewCard({ candidate }: { candidate: CandidateCard }) {
  const { t } = useTranslation()
  const form = candidate.form

  return (
    <div className="rounded-xl border border-charcoal-200 bg-white p-3">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
            {candidate.initials}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-charcoal-900">{candidate.name}</p>
            <p className="truncate text-[10px] text-charcoal-500">
              {candidate.position}
              {candidate.appliedDate ? ` · ${t('Applied {{date}}', { date: formatDate(candidate.appliedDate) })}` : ''}
            </p>
          </div>
        </div>
        {candidate.phone && (
          <a
            href={`tel:${candidate.phone.replace(/\s+/g, '')}`}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-brand-300 bg-brand-50 px-2.5 py-1.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-100 sm:self-auto"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            {candidate.phone}
          </a>
        )}
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] sm:grid-cols-4">
        <Detail label={t('Email')} value={form?.email ?? null} />
        <Detail
          label={t('Experience')}
          value={form?.expYears != null ? t('{{years}} years', { years: form.expYears }) : null}
        />
        <Detail label={t('Salary expectation')} value={form?.salaryExp != null ? formatMoney(form.salaryExp) : null} />
        <Detail label={t('Availability')} value={form?.availability ?? null} />
        <Detail label={t('Shift preference')} value={form?.shift ?? null} />
        <Detail label={t('Preferred gym')} value={form?.gymPref ?? null} />
        <Detail label={t('Source')} value={form?.source ?? null} />
        <Detail
          label={t('First interview')}
          value={candidate.iv1?.verdict ?? (candidate.iv1?.date ? formatDate(candidate.iv1.date) : null)}
        />
      </dl>

      {candidate.iv2?.date && (
        <p className="mt-2 rounded-lg bg-charcoal-50 px-2 py-1 text-[10px] text-charcoal-600">
          {t('Second interview booked for {{date}}', { date: formatDate(candidate.iv2.date) })}
        </p>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <dt className="bento-label text-charcoal-400">{label}</dt>
      <dd className="truncate font-medium text-charcoal-800">{value}</dd>
    </div>
  )
}

/** Accepted newcomers: enrolled into payroll already, just missing the face. */
function NewComersSection() {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['portal', 'employees', 'new-comers'],
    queryFn: ({ signal }) => getEmployeeDirectory({ page: 1, pageSize: 200, signal }),
  })

  if (query.isLoading) return <LoadingState />
  if (query.error) return <ErrorState message={describeApiError(query.error)} onRetry={() => void query.refetch()} />

  const rows = recentHires(query.data?.items ?? [])
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-charcoal-200 bg-white p-8 text-center">
        <UserRound className="mx-auto mb-2 h-10 w-10 text-charcoal-300" aria-hidden="true" />
        <p className="text-xs text-charcoal-500">
          {t('No newcomers from the last {{days}} days.', { days: NEWCOMER_WINDOW_DAYS })}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-charcoal-500">
        {t('Newcomers hired in the last {{days}} days — enroll each face so the kiosk recognises them.', {
          days: NEWCOMER_WINDOW_DAYS,
        })}
      </p>
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-col justify-between gap-2 rounded-xl border border-charcoal-200 bg-white p-3 sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-700">
              {row.initials}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-charcoal-900">{row.name}</p>
              <p className="truncate text-[10px] text-charcoal-500">
                {[row.position, row.employeeNumber, row.hireDate ? t('Hired {{date}}', { date: formatDate(row.hireDate) }) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
          <Link
            to={`/enrollment?employeeNumber=${encodeURIComponent(row.employeeNumber)}`}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-charcoal-300 px-2.5 py-1.5 text-[11px] font-semibold text-charcoal-700 hover:bg-charcoal-50 sm:self-auto"
          >
            <ScanFace className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Enroll face')}
          </Link>
        </div>
      ))}
    </div>
  )
}

function RecruitmentCard({ row, onOpen }: { row: VacancyRequestRow; onOpen: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-xl border border-charcoal-200 bg-white p-3 text-start transition-all hover:shadow-sm card-interactive"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50">
            <UserRound className="h-4 w-4 text-brand-600" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-charcoal-900">
              {row.position}
              {row.headcount > 1 && <span className="font-normal text-charcoal-500"> x{row.headcount}</span>}
            </p>
            <p className="truncate text-[10px] text-charcoal-500">
              {row.submittedBy ?? '—'} · {formatDate(row.submittedDate)}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <span className={cn('rounded px-2 py-0.5 text-[9px] font-semibold', urgencyClass(row.urgency))}>
            {row.urgency ?? '—'}
          </span>
          <StatusBadge status={humanize(row.status)} />
        </div>
      </div>
      <p className="mt-2 text-[10px] text-charcoal-600">{row.reason}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Chip className="bg-charcoal-50 text-charcoal-600">
          {t('Wants {{shift}}', { shift: row.shift ?? t('any shift') })}
        </Chip>
        <Chip className="bg-charcoal-50 text-charcoal-600">
          EGP {row.salary != null ? formatMoney(row.salary) : '—'}
        </Chip>
        {row.vacancyId && (
          <Chip className="bg-blue-50 text-blue-700">{t('Vacancy #{{id}} opened', { id: row.vacancyId })}</Chip>
        )}
      </div>
    </button>
  )
}

/* ==================== new request modal (mock openNewRecruitment) ==================== */

function NewRequestModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { user } = usePortalSession()
  const { toast } = useToast()
  const [position, setPosition] = useState('')
  const [urgency, setUrgency] = useState('Medium')
  const [shift, setShift] = useState('Morning')
  const [salary, setSalary] = useState('')
  const [headcount, setHeadcount] = useState('1')
  const [reason, setReason] = useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      createVacancyRequest({
        position: position.trim(),
        urgency,
        reason: reason.trim(),
        salary: salary ? Number(salary) : null,
        shift,
        headcount: Math.max(1, Number(headcount) || 1),
      }),
    onSuccess: () => {
      toast(`${position.trim()} request submitted · awaiting HR`)
      onSaved()
      onClose()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <Modal open title={t('New Recruitment Request')} onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-lg border border-brand-100 bg-brand-50 p-2.5 text-[10px] leading-relaxed text-brand-800">
          {t('Tell HR exactly what you need — the shift and the expected salary are what HR matches candidates against.')}
        </div>
        <div>
          <label className="form-label" htmlFor="rec-position">
            {t('Position')}
          </label>
          <input
            id="rec-position"
            type="text"
            className="form-input"
            placeholder={t('e.g. Senior Trainer')}
            value={position}
            onChange={(event) => setPosition(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label" htmlFor="rec-count">
              {t('Count')}
            </label>
            <input
              id="rec-count"
              type="number"
              min={1}
              className="form-input"
              value={headcount}
              onChange={(event) => setHeadcount(event.target.value)}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="rec-urgency">
              {t('Urgency')}
            </label>
            <select id="rec-urgency" className="form-input" value={urgency} onChange={(event) => setUrgency(event.target.value)}>
              <option value="Low">{t('Low')}</option>
              <option value="Medium">{t('Medium')}</option>
              <option value="High">{t('High')}</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label" htmlFor="rec-shift">
              {t('Shift you want')}
            </label>
            <select id="rec-shift" className="form-input" value={shift} onChange={(event) => setShift(event.target.value)}>
              <option value="Morning">{t('Morning')}</option>
              <option value="Evening">{t('Evening')}</option>
              <option value="Night">{t('Night')}</option>
              <option value="Flexible">{t('Flexible')}</option>
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="rec-salary">
              {t('Expected salary (EGP, optional)')}
            </label>
            <input
              id="rec-salary"
              type="number"
              min={0}
              step={500}
              className="form-input"
              placeholder={t('e.g. 12000')}
              value={salary}
              onChange={(event) => setSalary(event.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="form-label" htmlFor="rec-reason">
            {t('Reason')}
          </label>
          <textarea
            id="rec-reason"
            rows={2}
            className="form-input"
            placeholder={t('Why is this position needed?')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button
            size="sm"
            disabled={position.trim().length === 0 || reason.trim().length === 0}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {t('Submit Request')}
          </Button>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-charcoal-400">
        {t('Filed by {{name}} — the request lands straight in HR pending queue.', { name: user?.fullName ?? t('you') })}
      </p>
    </Modal>
  )
}

/* ==================== detail modal (mock openRecruitmentDetail, real stages) ==================== */

function RecruitmentDetailModal({
  row,
  canApprove,
  canRaise,
  onClose,
  onRaise,
  onChanged,
}: {
  row: VacancyRequestRow
  canApprove: boolean
  canRaise: boolean
  onClose: () => void
  onRaise: () => void
  onChanged: (row: VacancyRequestRow | null) => void
}) {
  const { t } = useTranslation()
  const { toast } = useToast()

  const decideMutation = useMutation({
    mutationFn: (decision: 'approve' | 'reject') => decideVacancyRequest(row.id, { decision, comment: null }),
    onSuccess: (updated) => {
      toast(
        updated.data.status === 'Approved'
          ? t('Request approved — vacancy created.')
          : t('Request rejected.'),
      )
      onChanged(updated.data)
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  const reopenMutation = useMutation({
    mutationFn: () => reopenVacancyRequest(row.id),
    onSuccess: (result) => {
      toast(
        result.vacancyWithdrawn
          ? t('Reopened — the vacancy had no applicants and was withdrawn.')
          : t('Request reopened — back to pending.'),
      )
      onChanged(null)
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <Modal open title={row.position} subtitle={row.gym} width="wide" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded px-2 py-0.5 text-[9px] font-semibold', urgencyClass(row.urgency))}>
            {t('{{urgency}} urgency', { urgency: row.urgency ?? '—' })}
          </span>
          <StatusBadge status={humanize(row.status)} />
          <span className="text-[10px] text-charcoal-400">
            {t('submitted {{date}} · by {{name}}', {
              date: formatDate(row.submittedDate),
              name: row.submittedBy ?? '—',
            })}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-charcoal-50 p-2.5">
            <p className="text-[10px] text-charcoal-500">{t('Positions')}</p>
            <p className="text-xs font-semibold text-charcoal-900">{row.headcount}</p>
          </div>
          {row.vacancyId && (
            <div className="rounded-lg bg-charcoal-50 p-2.5">
              <p className="text-[10px] text-charcoal-500">{t('Opened vacancy')}</p>
              <p className="text-xs font-semibold text-charcoal-900">#{row.vacancyId}</p>
            </div>
          )}
        </div>

        <div>
          <p className="form-label">{t('Reason')}</p>
          <p className="text-xs text-charcoal-600">{row.reason}</p>
        </div>

        {/* what the BM asked for */}
        <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white">
          <div className="border-b border-charcoal-100 bg-charcoal-50/50 px-3 py-2">
            <p className="bento-label">{t('WHAT YOU ASKED FOR')}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
            <div>
              <p className="bento-label text-charcoal-500">{t('Position')}</p>
              <p className="mt-0.5 text-xs font-semibold text-charcoal-900">
                {row.position}
                {row.headcount > 1 ? ` x${row.headcount}` : ''}
              </p>
            </div>
            <div>
              <p className="bento-label text-charcoal-500">{t('Shift')}</p>
              <p className="mt-0.5 text-xs font-semibold text-charcoal-900">{row.shift ?? t('Any')}</p>
            </div>
            <div>
              <p className="bento-label text-charcoal-500">{t('Expected salary')}</p>
              <p className="mt-0.5 text-xs font-semibold text-charcoal-900">
                {row.salary != null ? formatMoney(row.salary) : '—'}
              </p>
            </div>
            <div>
              <p className="bento-label text-charcoal-500">{t('Requested by')}</p>
              <p className="mt-0.5 text-xs font-semibold text-charcoal-900">{row.submittedBy ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* what happens next, per the real state */}
        {row.status === 'Pending' && (
          <div className="rounded-xl border border-purple-100 bg-purple-50 p-3">
            <p className="mb-0.5 text-xs font-bold text-purple-800">{t('With HR — awaiting decision')}</p>
            <p className="text-[11px] leading-snug text-purple-700">
              {t("HR reviews the position, shift and salary. You can't do anything here yet; you'll be notified either way.")}
            </p>
          </div>
        )}
        {row.status === 'Approved' && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3">
            <p className="mb-0.5 text-xs font-bold text-green-800">
              {row.vacancyId
                ? t('Approved — vacancy #{{id}} is open', { id: row.vacancyId })
                : t('Approved — HR is opening the vacancy')}
            </p>
            <p className="text-[11px] leading-snug text-green-700">
              {t('HR creates the account and the contract once hiring completes. Decided by {{name}}.', {
                name: row.decidedBy ?? '—',
              })}
            </p>
            {canApprove && (
              <div className="mt-2">
                <Button size="sm" variant="danger" loading={reopenMutation.isPending} onClick={() => reopenMutation.mutate()}>
                  {t('Reopen')}
                </Button>
              </div>
            )}
          </div>
        )}
        {row.status === 'Rejected' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="mb-1 text-xs font-bold text-red-800">{t('HR rejected this request')}</p>
            <p className="text-[11px] leading-snug text-red-700">
              {t('Decision recorded by {{name}}.', { name: row.decidedBy ?? '—' })}
            </p>
            {canRaise && (
              <div className="mt-2">
                <Button size="sm" onClick={onRaise}>
                  {t('Raise a new request')}
                </Button>
              </div>
            )}
          </div>
        )}

        {canApprove && row.status === 'Pending' && (
          <div className="rounded-xl border border-charcoal-200 bg-white p-3">
            <p className="bento-label mb-1.5 text-charcoal-700">{t('You hold the approval key')}</p>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" loading={decideMutation.isPending && decideMutation.variables === 'approve'} onClick={() => decideMutation.mutate('approve')}>
                {t('Approve — open the vacancy')}
              </Button>
              <Button size="sm" variant="danger" onClick={() => decideMutation.mutate('reject')}>
                {t('Reject')}
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="secondary" onClick={onClose}>
            {t('Close')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
