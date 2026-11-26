import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarPlus, Check, Eye, Star, Trash2, X } from 'lucide-react'
import { Avatar } from '../../../components/ui/avatar'
import { StatusBadge } from '../../../components/ui/badge'
import { formatDate, formatMoney, formatTime, initialsOf } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import type {
  CandidateCard,
  CandidateInterview,
  FormApplication,
  VacancyRequest,
  WaitingListItem,
} from '../api/recruitment.api'

/* ==================== shared cells ==================== */

const URGENCY_TONE: Record<string, string> = {
  High: 'badge-red',
  Medium: 'badge-yellow',
  Low: 'badge-blue',
}

const APPLICATION_STATUS_TONE: Record<string, string> = {
  New: 'badge-blue',
  'In Review': 'badge-yellow',
  Shortlisted: 'badge-purple',
  Rejected: 'badge-red',
  'Moved to Pipeline': 'badge-success',
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const MIDNIGHT = /T00:00(:00(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/

/**
 * Table timestamps: rows carry DateTimes ("2026-11-18T10:00:00") but some
 * sources only have a DateOnly — those must not render a meaningless clock.
 */
function formatWhen(value: string | null | undefined): string {
  if (!value) return '—'
  if (DATE_ONLY.test(value) || MIDNIGHT.test(value)) return formatDate(value)
  return `${formatDate(value)} · ${formatTime(value)}`
}

/** `by` / `rejectedBy` carry a user id — print it as a readable reference. */
function personRef(value: string | null | undefined): string {
  if (!value) return '—'
  return /^\d+$/.test(value) ? `#${value}` : value
}

function TableShell({ children, minWidth }: { children: ReactNode; minWidth: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-charcoal-200 bg-white">
      <table className={cn('data-table w-full', minWidth)}>{children}</table>
    </div>
  )
}

function PersonCell({ name, sub, onOpen }: { name: string; sub?: string | null; onOpen?: () => void }) {
  const body = (
    <>
      <Avatar name={initialsOf(name)} size="sm" />
      <span className="min-w-0 text-start">
        <span className="block truncate text-xs font-semibold text-charcoal-900">{name}</span>
        {sub ? <span className="block truncate text-[10px] text-charcoal-500">{sub}</span> : null}
      </span>
    </>
  )
  return onOpen ? (
    <button type="button" onClick={onOpen} className="flex max-w-[200px] items-center gap-2 text-start">
      {body}
    </button>
  ) : (
    <span className="flex max-w-[200px] items-center gap-2">{body}</span>
  )
}

function RatingCell({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-xs text-charcoal-300">—</span>
  const label = Number.isInteger(value) ? String(value) : value.toFixed(1)
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-charcoal-800">
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
      {label}
    </span>
  )
}

function Dash() {
  return <span className="text-xs text-charcoal-300">—</span>
}

function daysInPool(since: string): number {
  const started = new Date(since).getTime()
  if (Number.isNaN(started)) return 0
  return Math.max(0, Math.floor((Date.now() - started) / 86_400_000))
}

/** Whole days between a past timestamp and now (0 = earlier today). */
function daysSince(value: string | null | undefined): number {
  if (!value) return 0
  const started = new Date(value).getTime()
  if (Number.isNaN(started)) return 0
  return Math.max(0, Math.floor((Date.now() - started) / 86_400_000))
}

/* ==================== 1. Branch vacancy requests ==================== */

export interface VacancyRequestsTableProps {
  requests: VacancyRequest[]
  /** Approve/decline buttons — the pending HR queue. */
  canDecide?: boolean
  approvingId?: number | null
  onApprove?: (request: VacancyRequest) => void
  onDecline?: (request: VacancyRequest) => void
}

/** Pending (or decided) branch requests as one review table. */
export function VacancyRequestsTable({
  requests,
  canDecide = false,
  approvingId = null,
  onApprove,
  onDecline,
}: VacancyRequestsTableProps) {
  const { t } = useTranslation()
  // Decided-by only carries meaning once a request has a decision (Rejected tab).
  const showDecision = requests.some((request) => request.decidedBy)

  return (
    <TableShell minWidth="min-w-[880px]">
      <thead>
        <tr>
          <th>{t('Position')}</th>
          <th>{t('Location')}</th>
          <th>{t('Headcount')}</th>
          <th>{t('Urgency')}</th>
          <th>{t('Requested by')}</th>
          <th>{t('Submitted')}</th>
          <th>{t('Status')}</th>
          {showDecision && <th>{t('Decided by')}</th>}
          {canDecide && <th>{t('Actions')}</th>}
        </tr>
      </thead>
      <tbody>
        {requests.map((request) => {
          const terms = [
            request.salary != null ? formatMoney(request.salary) : null,
            request.shift,
          ].filter(Boolean)
          return (
            <tr key={request.id}>
              <td>
                <p className="text-xs font-semibold text-charcoal-900">{request.position}</p>
                {terms.length > 0 && <p className="text-[10px] text-charcoal-500">{terms.join(' · ')}</p>}
                {request.reason && (
                  <p className="max-w-[240px] truncate text-[10px] text-charcoal-400" title={request.reason}>
                    {request.reason}
                  </p>
                )}
              </td>
              <td className="text-xs whitespace-nowrap">{request.gym}</td>
              <td className="text-xs font-semibold">{request.headcount ?? '—'}</td>
              <td>
                {request.urgency ? (
                  <span className={cn('badge text-[9px]', URGENCY_TONE[request.urgency] ?? 'badge-gray')}>
                    {t(request.urgency)}
                  </span>
                ) : (
                  <Dash />
                )}
              </td>
              <td className="text-xs">{request.submittedBy ?? '—'}</td>
              <td className="text-xs whitespace-nowrap">{formatWhen(request.submittedDate)}</td>
              <td>
                <StatusBadge status={request.status} />
              </td>
              {showDecision && <td className="text-xs">{personRef(request.decidedBy)}</td>}
              {canDecide && (
                <td className="whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onApprove?.(request)}
                      disabled={approvingId === request.id}
                      className="btn btn-sm btn-success"
                    >
                      <Check className="h-3 w-3" aria-hidden="true" />
                      {approvingId === request.id ? t('Approving…') : t('Approve')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDecline?.(request)}
                      disabled={approvingId === request.id}
                      className="btn btn-sm btn-danger-outline"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                      {t('Decline')}
                    </button>
                  </div>
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
    </TableShell>
  )
}

/* ==================== 2. Hiring-form applicants ==================== */

export interface ApplicantsTableProps {
  applications: FormApplication[]
  canManage: boolean
  busyId?: number | null
  onViewAnswers: (application: FormApplication) => void
  onConvert: (application: FormApplication) => void
  onReject: (application: FormApplication) => void
}

/** Hiring-form applicants with their review actions. */
export function ApplicantsTable({
  applications,
  canManage,
  busyId = null,
  onViewAnswers,
  onConvert,
  onReject,
}: ApplicantsTableProps) {
  const { t } = useTranslation()

  return (
    <TableShell minWidth="min-w-[920px]">
      <thead>
        <tr>
          <th>{t('Applicant')}</th>
          <th>{t('Location')}</th>
          <th>{t('Position')}</th>
          <th>{t('Applied')}</th>
          <th>{t('Phone')}</th>
          <th>{t('Status')}</th>
          <th>{t('Actions')}</th>
        </tr>
      </thead>
      <tbody>
        {applications.map((application) => {
          const closed = application.status === 'Rejected' || application.status === 'Moved to Pipeline'
          return (
            <tr key={application.id}>
              <td>
                <PersonCell name={application.name} sub={application.email} />
              </td>
              <td className="text-xs whitespace-nowrap">{application.gym ?? '—'}</td>
              <td className="text-xs">{application.position ?? t('Any position')}</td>
              <td className="text-xs whitespace-nowrap">{formatWhen(application.appliedDate)}</td>
              <td className="text-xs whitespace-nowrap">{application.phone || '—'}</td>
              <td>
                <span
                  className={cn('badge text-[9px]', APPLICATION_STATUS_TONE[application.status] ?? 'badge-gray')}
                >
                  {t(application.status)}
                </span>
              </td>
              <td className="whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onViewAnswers(application)}
                    aria-label={t('View answers')}
                    title={t('View answers')}
                    className="btn btn-sm btn-ghost"
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  {canManage && !closed && (
                    <>
                      <button
                        type="button"
                        onClick={() => onConvert(application)}
                        disabled={busyId === application.id}
                        className="btn btn-sm btn-primary"
                      >
                        {busyId === application.id ? t('Adding…') : t('Add to Pipeline')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(application)}
                        aria-label={t('Reject')}
                        title={t('Reject')}
                        className="btn btn-sm btn-danger-outline"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </TableShell>
  )
}

/* ==================== 3-7. Pipeline candidates ==================== */

export type CandidateTableMode =
  | 'applied'
  | 'first'
  | 'second'
  | 'missed'
  | 'accepted'
  | 'hired'
  | 'rejected'
  | 'blocked'

export interface CandidateTableProps {
  candidates: CandidateCard[]
  mode: CandidateTableMode
  onOpen?: (id: number) => void
  /** Stage-specific row actions (advance / schedule / hire / restore). */
  actions?: (candidate: CandidateCard) => ReactNode
  /** Applied mode only: a separate interview-booking cell before the actions. */
  interviewBooking?: (candidate: CandidateCard) => ReactNode
}

export type InterviewRound = 'First Interview' | 'Second Interview'

const INTERVIEW_ROUNDS: { key: InterviewRound; short: string }[] = [
  { key: 'First Interview', short: '1st' },
  { key: 'Second Interview', short: '2nd' },
]

export interface InterviewBookingCellProps {
  iv1: CandidateInterview | null
  iv2: CandidateInterview | null
  /** Rounds to render, top to bottom — defaults to both. */
  rounds?: InterviewRound[]
  /** Opens the schedule/reschedule dialog for "First Interview" | "Second Interview". */
  onBook: (round: InterviewRound) => void
}

/**
 * Interview rounds as separate pill actions — a dashed "book" pill while
 * unscheduled, a soft green pill with the booked date after.
 */
export function InterviewBookingCell({ iv1, iv2, rounds, onBook }: InterviewBookingCellProps) {
  const { t } = useTranslation()
  const visibleRounds = INTERVIEW_ROUNDS.filter((round) => !rounds || rounds.includes(round.key)).map((round) => ({
    ...round,
    date: (round.key === 'First Interview' ? iv1?.date : iv2?.date) ?? null,
  }))

  return (
    <div className="flex w-[172px] flex-col gap-1">
      {visibleRounds.map((round) => {
        const booked = Boolean(round.date)
        const roundLabel = round.key === 'First Interview' ? t('1st interview') : t('2nd interview')
        const actionLabel = booked
          ? t('Reschedule {{round}}', { round: roundLabel })
          : t('Schedule {{round}}', { round: roundLabel })
        return (
          <button
            key={round.key}
            type="button"
            onClick={() => onBook(round.key)}
            title={actionLabel}
            aria-label={actionLabel}
            className={cn(
              'group flex items-center gap-1.5 rounded-full border py-1 ps-1 pe-2.5 text-[10px] leading-none transition-all hover:-translate-y-px hover:shadow-sm',
              booked
                ? 'border-brand-200 bg-brand-50 text-brand-800 hover:border-brand-300 hover:bg-brand-100'
                : 'border-dashed border-charcoal-300 bg-charcoal-50 text-charcoal-500 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800',
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                booked
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-charcoal-400 ring-1 ring-charcoal-200 group-hover:text-brand-700',
              )}
            >
              {booked ? <Check className="h-3 w-3" aria-hidden="true" /> : <CalendarPlus className="h-3 w-3" aria-hidden="true" />}
            </span>
            <span className="font-semibold">{t(round.short)}</span>
            <span className="ms-auto truncate text-[9px] font-medium opacity-80">
              {booked ? formatDate(round.date) : t('Book')}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * One candidate table for every lifecycle tab. The shared columns are name,
 * location, position and rating; the mode picks the attributes that belong to
 * that stage (interview date + interviewer, missed round, decision, rejection,
 * block).
 */
export function CandidateTable({ candidates, mode, onOpen, actions, interviewBooking }: CandidateTableProps) {
  const { t } = useTranslation()

  return (
    <TableShell minWidth={mode === 'missed' ? 'min-w-[1040px]' : 'min-w-[900px]'}>
      <thead>
        <tr>
          <th>{t('Candidate')}</th>
          <th>{t('Location')}</th>
          <th>{t('Position')}</th>
          {mode === 'applied' && (
            <>
              <th>{t('Applied')}</th>
              <th>{t('Rating')}</th>
              <th>{t('Source')}</th>
            </>
          )}
          {(mode === 'first' || mode === 'second') && (
            <>
              <th>{mode === 'first' ? t('First Interview Date') : t('Second Interview Date')}</th>
              <th>{t('Interviewer')}</th>
              <th>{t('Rating')}</th>
              <th>{t('Verdict')}</th>
            </>
          )}
          {mode === 'missed' && (
            <>
              <th>{t('Missed round')}</th>
              <th>{t('Scheduled')}</th>
              <th>{t('Overdue')}</th>
            </>
          )}
          {(mode === 'accepted' || mode === 'hired') && (
            <>
              <th>{mode === 'hired' ? t('Hired on') : t('Decision date')}</th>
              <th>{t('Rating')}</th>
              <th>{t('Decided by')}</th>
              <th>{t('Note')}</th>
            </>
          )}
          {mode === 'rejected' && (
            <>
              <th>{t('Rejected on')}</th>
              <th>{t('Rating')}</th>
              <th>{t('Rejected by')}</th>
              <th>{t('Reason')}</th>
            </>
          )}
          {mode === 'blocked' && (
            <>
              <th>{t('Rating')}</th>
              <th>{t('Block reason')}</th>
            </>
          )}
          {mode === 'applied' && interviewBooking && <th>{t('Interviews')}</th>}
          {actions && <th>{t('Actions')}</th>}
        </tr>
      </thead>
      <tbody>
        {candidates.map((candidate) => {
          const applicationId = candidate.applicationId ?? candidate.id
          const interview = mode === 'first' ? candidate.iv1 : mode === 'second' ? candidate.iv2 : null
          const decision = candidate.decision
          const rowActions = actions?.(candidate)
          return (
            <tr key={applicationId}>
              <td>
                <PersonCell
                  name={candidate.name}
                  sub={candidate.phone ?? candidate.form?.email ?? null}
                  onOpen={onOpen ? () => onOpen(candidate.id) : undefined}
                />
              </td>
              <td className="text-xs whitespace-nowrap">{candidate.gym ?? candidate.form?.gymPref ?? '—'}</td>
              <td className="text-xs">{candidate.position || '—'}</td>

              {mode === 'applied' && (
                <>
                  <td className="text-xs whitespace-nowrap">{formatWhen(candidate.appliedDate)}</td>
                  <td>
                    <RatingCell value={candidate.rating} />
                  </td>
                  <td className="text-xs">{candidate.form?.source ?? '—'}</td>
                </>
              )}

              {(mode === 'first' || mode === 'second') && (
                <>
                  <td className="text-xs whitespace-nowrap">{formatWhen(interview?.date)}</td>
                  <td className="text-xs whitespace-nowrap">{interview?.by || <Dash />}</td>
                  <td>
                    <RatingCell value={candidate.rating} />
                  </td>
                  <td>{interview?.verdict ? <StatusBadge status={interview.verdict} /> : <Dash />}</td>
                </>
              )}

              {mode === 'missed' && (
                <>
                  <td>
                    <span className="badge badge-orange text-[9px]">
                      {candidate.missed?.stage ? t(candidate.missed.stage) : '—'}
                    </span>
                    {candidate.missed?.interviewer && (
                      <p className="mt-0.5 text-[10px] text-charcoal-400">{candidate.missed.interviewer}</p>
                    )}
                  </td>
                  <td className="text-xs whitespace-nowrap">{formatWhen(candidate.missed?.scheduledDate)}</td>
                  <td>
                    {(() => {
                      const late = daysSince(candidate.missed?.scheduledDate)
                      return (
                        <span className={cn('badge text-[9px]', late >= 3 ? 'badge-red' : 'badge-yellow')}>
                          {late === 0 ? t('Today') : t('{{count}} days late', { count: late })}
                        </span>
                      )
                    })()}
                  </td>
                </>
              )}

              {(mode === 'accepted' || mode === 'hired') && (
                <>
                  <td className="text-xs whitespace-nowrap">
                    {formatWhen(mode === 'hired' ? candidate.hiredDate : decision?.date)}
                  </td>
                  <td>
                    <RatingCell value={candidate.rating} />
                  </td>
                  <td className="text-xs">{personRef(decision?.by)}</td>
                  <td className="max-w-[220px] truncate text-xs" title={decision?.note ?? undefined}>
                    {decision?.note || '—'}
                  </td>
                </>
              )}

              {mode === 'rejected' && (
                <>
                  <td className="text-xs whitespace-nowrap">
                    {formatWhen(candidate.rejectedDate ?? decision?.date)}
                  </td>
                  <td>
                    <RatingCell value={candidate.rating} />
                  </td>
                  <td className="text-xs">{personRef(candidate.rejectedBy ?? decision?.by)}</td>
                  <td className="max-w-[220px] truncate text-xs text-red-700" title={candidate.rejectReason ?? undefined}>
                    {candidate.rejectReason || decision?.note || '—'}
                  </td>
                </>
              )}

              {mode === 'blocked' && (
                <>
                  <td>
                    <RatingCell value={candidate.rating} />
                  </td>
                  <td className="max-w-[260px] truncate text-xs text-red-700">
                    {candidate.blockReason ?? t('Blocked manually by HR')}
                  </td>
                </>
              )}

              {mode === 'applied' && interviewBooking && <td>{interviewBooking(candidate)}</td>}

              {actions && <td className="whitespace-nowrap">{rowActions}</td>}
            </tr>
          )
        })}
      </tbody>
    </TableShell>
  )
}

/* ==================== 4. Waiting list ==================== */

export interface WaitingListTableProps {
  items: WaitingListItem[]
  canManage: boolean
  removingId?: number | null
  onAssign: (item: WaitingListItem) => void
  onRemove: (item: WaitingListItem) => void
}

/** Parked candidates with pool age, skills, location matches and the assign action. */
export function WaitingListTable({
  items,
  canManage,
  removingId = null,
  onAssign,
  onRemove,
}: WaitingListTableProps) {
  const { t } = useTranslation()

  return (
    <TableShell minWidth="min-w-[1000px]">
      <thead>
        <tr>
          <th>{t('Candidate')}</th>
          <th>{t('Location')}</th>
          <th>{t('Position')}</th>
          <th>{t('In pool since')}</th>
          <th>{t('Rating')}</th>
          <th>{t('Skills')}</th>
          <th>{t('Matching vacancies')}</th>
          {canManage && <th>{t('Actions')}</th>}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const days = daysInPool(item.since)
          const [firstMatch, ...restMatches] = item.matchingVacancies
          return (
            <tr key={item.id}>
              <td>
                <PersonCell name={item.name} sub={item.source} />
              </td>
              <td className="text-xs whitespace-nowrap">{item.gym ?? firstMatch?.gym ?? '—'}</td>
              <td className="text-xs">{item.position ?? t('Any position')}</td>
              <td className="whitespace-nowrap">
                <p className="text-xs">{formatWhen(item.since)}</p>
                <p className="text-[10px] text-charcoal-400">{t('{{count}} days in pool', { count: days })}</p>
              </td>
              <td>
                <RatingCell value={item.rating} />
              </td>
              <td>
                {item.skills.length > 0 ? (
                  <div className="flex max-w-[180px] flex-wrap gap-1">
                    {item.skills.slice(0, 3).map((skill) => (
                      <span key={skill} className="badge badge-gray text-[9px]">
                        {skill}
                      </span>
                    ))}
                    {item.skills.length > 3 && (
                      <span className="text-[9px] text-charcoal-400">+{item.skills.length - 3}</span>
                    )}
                  </div>
                ) : (
                  <Dash />
                )}
              </td>
              <td className="text-xs">
                {firstMatch ? (
                  <>
                    <p className="text-charcoal-800">
                      {firstMatch.position}
                      {firstMatch.gym ? ` · ${firstMatch.gym}` : ''}
                    </p>
                    <p className="text-[10px] text-charcoal-400">
                      {t('{{count}} open seats', { count: firstMatch.headcount })}
                      {restMatches.length > 0 ? ` · ${t('+{{count}} more', { count: restMatches.length })}` : ''}
                    </p>
                  </>
                ) : (
                  <span className="text-charcoal-400">{t('No open match')}</span>
                )}
              </td>
              {canManage && (
                <td className="whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => onAssign(item)} className="btn btn-sm btn-success">
                      <Check className="h-3 w-3" aria-hidden="true" />
                      {t('Assign to position')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(item)}
                      disabled={removingId === item.id}
                      aria-label={t('Remove')}
                      title={t('Remove')}
                      className="btn btn-sm btn-danger-outline"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
    </TableShell>
  )
}
