import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BadgeCheck,
  CalendarClock,
  ClipboardList,
  FileBarChart,
  PiggyBank,
  ShieldAlert,
  TriangleAlert,
  UserMinus,
  UserPlus,
  UserRoundPen,
} from 'lucide-react'
import {
  createVacancyRequest,
  getEmployeeDirectory,
  getPendingHrQueue,
  type BranchQueueItem,
  issueDeduction,
  issueWarning,
  proposeBonus,
  sendBranchReport,
} from '../api/branch.api'
import { getOwnPayrollSheets } from '../api/payroll.api'
import { fetchAllPages } from '../../../lib/paged'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { StatusBadge } from '../../../components/ui/badge'
import { useToast } from '../../../components/ui/toast'
import { usePortalSession } from '../../../contexts/PortalSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatMoney } from '../../../lib/format'

/**
 * Branch Actions palette (mock §20 `openBranchActions` + BRANCH_ACTIONS): every
 * launcher a manager holds for the active gym. Raise-type actions ("→ HR")
 * create a Pending-HR record for the HR portal to decide; the others navigate
 * to the page that owns the workflow. The seeded permission keys gate each
 * card, mirroring the mock's `perm` vocabulary against /api/auth/me.
 */

/** Reason/category vocabularies — kept in lockstep with BranchActionsService. */
const DEDUCTION_REASONS = [
  'Unapproved absence',
  'Late arrival (30+ min)',
  'Early checkout without approval',
  'Damaged equipment / property',
  'Policy violation',
  'Other (see note)',
]
const WARNING_TYPES = ['Attendance', 'Conduct', 'Performance', 'Safety', 'Policy violation']
const BONUS_TYPES = ['Performance Bonus', 'Overtime Pay', 'Attendance Reward', 'Referral Bonus', 'Other']
const REPORT_TYPES = ['Monthly branch summary', 'Attendance exceptions', 'Incident report', 'Request escalations']

type PaletteRoute =
  | { kind: 'raise'; run: 'deduction' | 'warning' | 'bonus' | 'report' }
  | { kind: 'navigate'; path: string }

interface PaletteAction {
  id: string
  label: string
  desc: string
  icon: React.ComponentType<{ className?: string }>
  /** Permission key required for the card ('' = every authenticated user). */
  permission: string
  toHr: boolean
  route: PaletteRoute
}

const PALETTE_ACTIONS: PaletteAction[] = [
  {
    id: 'deduction',
    label: 'Issue Deduction',
    desc: 'Deduct an amount (absence, late, damage) — sent to HR for approval',
    icon: PiggyBank,
    permission: 'attendance.edit',
    toHr: true,
    route: { kind: 'raise', run: 'deduction' },
  },
  {
    id: 'warning',
    label: 'Issue Warning Notice',
    desc: 'Formal written warning — HR files it to the employee record',
    icon: TriangleAlert,
    permission: 'employees.edit',
    toHr: true,
    route: { kind: 'raise', run: 'warning' },
  },
  {
    id: 'bonus',
    label: 'Propose Bonus',
    desc: 'Recommend a bonus/overtime payout — HR adds it to payroll',
    icon: ShieldAlert,
    permission: 'employees.edit',
    toHr: true,
    route: { kind: 'raise', run: 'bonus' },
  },
  {
    id: 'requests',
    label: 'Review Team Requests',
    desc: 'Stage-1 approve/reject — HR gives the final decision',
    icon: ClipboardList,
    permission: 'requests.view',
    toHr: true,
    route: { kind: 'navigate', path: '/employee/team/requests' },
  },
  {
    id: 'attendance',
    label: 'Correct Attendance',
    desc: 'Fix missing check-ins/outs and flag absences',
    icon: CalendarClock,
    permission: 'attendance.edit',
    toHr: false,
    route: { kind: 'navigate', path: '/employee/branch/attendance' },
  },
  {
    id: 'vacancy',
    label: 'Request Vacancy',
    desc: 'Ask HR to open a new position for the gym',
    icon: UserPlus,
    permission: 'recruitment.vacancy_request.create',
    toHr: true,
    route: { kind: 'navigate', path: '/employee/branch/recruitment' },
  },
  {
    id: 'shifts',
    label: 'Publish Shift Schedule',
    desc: 'Assign shifts for the next cycle and publish',
    icon: BadgeCheck,
    permission: 'schedule.manage',
    toHr: false,
    // ?edit=1 opens the page already in "Assign Shifts" mode (mock quick action).
    route: { kind: 'navigate', path: '/employee/team/schedule?edit=1' },
  },
  {
    id: 'status',
    label: 'Change Employment Status',
    desc: 'Active / On Leave / Suspended / Terminated — on an employee profile',
    icon: UserRoundPen,
    permission: 'employees.status.change',
    toHr: false,
    route: { kind: 'navigate', path: '/employee/branch/employees' },
  },
  {
    id: 'offboard',
    label: 'Offboard Employee',
    desc: 'Start the leaving flow for a branch employee',
    icon: UserMinus,
    permission: 'employees.offboard',
    toHr: true,
    route: { kind: 'navigate', path: '/employee/branch/leaving' },
  },
  {
    id: 'report',
    label: 'Send Report to HR',
    desc: 'Monthly branch summary: attendance, requests, incidents',
    icon: FileBarChart,
    permission: '',
    toHr: true,
    route: { kind: 'raise', run: 'report' },
  },
]

export function BranchActionsPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { can } = usePortalSession()
  const navigate = useNavigate()
  const actions = PALETTE_ACTIONS.filter((a) => a.permission === '' || can(a.permission))
  const [raise, setRaise] = useState<'deduction' | 'warning' | 'bonus' | 'report' | null>(null)

  return (
    <>
      <Modal
        open={open}
        title={t('Branch Actions')}
        subtitle={t('Everything you can do for the active gym — raise actions go to HR.')}
        onClose={onClose}
        width="wide"
      >
        {open && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {actions.map((a) => {
                const Icon = a.icon
                return (
                  <button
                    key={a.id}
                    onClick={() => {
                      if (a.route.kind === 'navigate') {
                        onClose()
                        navigate(a.route.path)
                        return
                      }
                      setRaise(a.route.run)
                    }}
                    className="group flex items-start gap-2.5 rounded-lg border border-charcoal-200 p-3 text-start transition-colors hover:border-brand-300 hover:bg-brand-50/60"
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-charcoal-900">{t(a.label)}</span>
                        {a.toHr && <HrTag />}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-charcoal-500">{t(a.desc)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <AwaitingHrList open={open} />
          </div>
        )}
      </Modal>
      {open && raise === 'deduction' && <IssueDeductionModal onClose={() => setRaise(null)} />}
      {open && raise === 'warning' && <IssueWarningModal onClose={() => setRaise(null)} />}
      {open && raise === 'bonus' && <ProposeBonusModal onClose={() => setRaise(null)} />}
      {open && raise === 'report' && <SendReportModal onClose={() => setRaise(null)} />}
    </>
  )
}

function HrTag() {
  const { t } = useTranslation()
  return (
    <span className="rounded bg-purple-50 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-purple-700 ring-1 ring-inset ring-purple-200">
      <span className="inline-block rtl:rotate-180">→</span> {t('HR')}
    </span>
  )
}

/* Awaiting HR ------------------------------------------------------------- */

function AwaitingHrList({ open }: { open: boolean }) {
  const { t } = useTranslation()
  const queue = useQuery({
    queryKey: ['portal', 'branch-actions', 'pending-hr'],
    queryFn: ({ signal }) => getPendingHrQueue(signal),
    enabled: open,
  })

  if (open && (queue.isLoading || queue.isPending)) return <LoadingState />
  if (queue.error) return <ErrorState message={describeApiError(queue.error)} onRetry={() => queue.refetch()} />

  const items = (queue.data ?? []).filter((i) => i.status === 'Pending HR')
  if (items.length === 0) return null

  return (
    <div className="rounded-lg bg-charcoal-50 p-2.5">
      <p className="bento-label mb-1.5">{t('Awaiting HR ({{count}})', { count: items.length })}</p>
      {items.map((item) => (
        <QueueRow key={`${item.kind}-${item.id}`} item={item} />
      ))}
    </div>
  )
}

function QueueRow({ item }: { item: BranchQueueItem }) {
  return (
    <div className="flex items-center justify-between border-b border-charcoal-100 py-1 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-charcoal-800">
          {item.employee} — {item.detail}
        </p>
        <p className="truncate text-[10px] text-charcoal-500">
          {item.kind} · {formatDate(item.date)}
        </p>
      </div>
      <StatusBadge status={item.status} />
    </div>
  )
}

/* Employee picker (shared) ------------------------------------------------- */

/** The roster a raise modal can act on: everyone for warnings/deductions (server default) or the Active people for bonuses. */
function useRosterOptions(activeOnly: boolean) {
  return useQuery({
    queryKey: ['portal', 'directory', 'roster', activeOnly ? 'active' : 'all'],
    // Pickers must list the whole gym: walk the pages (one page is capped at 100).
    queryFn: ({ signal }) =>
      fetchAllPages(
        (page) => getEmployeeDirectory({ status: activeOnly ? 'Active' : undefined, page, pageSize: 100, signal }),
        signal,
      ),
    staleTime: 60_000,
  })
}

function EmployeeSelect({
  id,
  options,
  value,
  onChange,
}: {
  id: string
  options: { id: number; name: string; position: string }[]
  value: string
  onChange: (v: string) => void
}) {
  const { t } = useTranslation()
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="form-input">
      <option value="">{t('Select employee...')}</option>
      {options.map((e) => (
        <option key={e.id} value={String(e.id)}>
          {e.name} — {e.position}
        </option>
      ))}
    </select>
  )
}

/* Issue Deduction ---------------------------------------------------------- */

function IssueDeductionModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const roster = useRosterOptions(false)
  const options = roster.data?.filter((e) => e.status !== 'Terminated') ?? []

  const [employeeId, setEmployeeId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState(DEDUCTION_REASONS[0])
  const [note, setNote] = useState('')

  const salaryQuery = useQuery({
    queryKey: ['portal', 'salary', employeeId],
    queryFn: ({ signal }) => getOwnPayrollSheets(Number(employeeId), signal),
    enabled: !!employeeId,
  })
  const latestSheet = (salaryQuery.data ?? []).find((sheet) => sheet.visible) ?? null
  const suggestedDaily = latestSheet ? Math.round((latestSheet.baseSalary / 30) * 100) / 100 : null

  const save = useMutation({
    mutationFn: () =>
      issueDeduction({
        employeeId: Number(employeeId),
        date,
        amount: Number(amount),
        reason,
        note: note.trim() || null,
      }),
    onSuccess: (created) => {
      toast(
        t('Deduction of {{amount}} for {{employee}} sent to HR for approval', {
          amount: formatMoney(created.amount),
          employee: created.employee,
        }),
      )
      void queryClient.invalidateQueries({ queryKey: ['portal', 'branch-actions', 'pending-hr'] })
      void queryClient.invalidateQueries({ queryKey: ['portal', 'branch', 'deductions'] })
      onClose()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <Modal open title={t('Issue Deduction → Send to HR')} onClose={onClose} width="md">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!employeeId) return toast(t('Select an employee'), 'error')
          if (!Number.isFinite(Number(amount)) || Number(amount) <= 0)
            return toast(t('Enter a valid amount'), 'error')
          save.mutate()
        }}
        className="space-y-3"
      >
        <div className="rounded-lg border border-purple-100 bg-purple-50 p-2.5 text-[10px] leading-relaxed text-purple-800">
          {t('The deduction is created as a')} <b>{t('Deduction Candidate')}</b> {t('with status')}{' '}
          <b>{t('Pending HR')}</b>.{' '}
          {t("HR reviews and approves it before it appears in payroll or on the employee's payslip.")}
        </div>
        <div>
          <label className="form-label" htmlFor="ded-employee">
            {t('Employee')}
          </label>
          {roster.isPending ? (
            <LoadingState />
          ) : roster.error ? (
            <ErrorState message={describeApiError(roster.error)} onRetry={() => roster.refetch()} />
          ) : (
            <EmployeeSelect
              id="ded-employee"
              options={options}
              value={employeeId}
              onChange={setEmployeeId}
            />
          )}
        </div>
        <div>
          <label className="form-label" htmlFor="ded-date">
            {t('Deduction date')}
          </label>
          <input
            id="ded-date"
            type="date"
            value={date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
            className="form-input"
            required
          />
          <p className="mt-1 text-[10px] text-charcoal-500">
            {t('One deduction per employee per day. A rejected day cannot be re-issued.')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label" htmlFor="ded-amount">
              {t('Amount (EGP)')}
            </label>
            <input
              id="ded-amount"
              type="number"
              min={1}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="form-input"
              placeholder={t('e.g. 150')}
              required
            />
            {suggestedDaily != null && (
              <p className="mt-1 text-[10px] text-charcoal-500">
                {t('Suggested: 1 day ≈ {{amount}} (based on basic salary).', {
                  amount: formatMoney(suggestedDaily),
                })}{' '}
                <button
                  type="button"
                  className="font-semibold text-brand-600 hover:underline"
                  onClick={() => setAmount(String(suggestedDaily))}
                >
                  {t('Use suggested')}
                </button>
              </p>
            )}
          </div>
          <div>
            <label className="form-label" htmlFor="ded-reason">
              {t('Reason')}
            </label>
            <select id="ded-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="form-input">
              {DEDUCTION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(r)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="form-label" htmlFor="ded-note">
            {t('Note for HR (optional)')}
          </label>
          <textarea
            id="ded-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="form-input"
            placeholder={t('Context that helps HR review it faster...')}
          />
        </div>
        {reason === 'Other (see note)' && (
          <p className="text-[10px] text-charcoal-500">
            {t('"Other" requires the note for HR to understand the case.')}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button type="submit" size="sm" variant="primary" loading={save.isPending}>
            {t('Send to HR')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* Issue Warning ------------------------------------------------------------ */

function IssueWarningModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const roster = useRosterOptions(false)
  const options = roster.data?.filter((e) => e.status !== 'Terminated') ?? []

  const [employeeId, setEmployeeId] = useState('')
  const [type, setType] = useState(WARNING_TYPES[0])
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')

  const save = useMutation({
    mutationFn: () =>
      issueWarning({
        employeeId: Number(employeeId),
        type,
        reason: reason.trim(),
        note: note.trim() || null,
      }),
    onSuccess: (created) => {
      toast(t('Warning notice for {{employee}} sent to HR for review', { employee: created.employee }))
      void queryClient.invalidateQueries({ queryKey: ['portal', 'branch-actions', 'pending-hr'] })
      void queryClient.invalidateQueries({ queryKey: ['portal', 'branch', 'warnings'] })
      onClose()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <Modal open title={t('Issue Warning Notice → Send to HR')} onClose={onClose} width="md">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!employeeId) return toast(t('Select an employee'), 'error')
          if (reason.trim().length === 0) return toast(t('Enter a reason for the warning'), 'error')
          save.mutate()
        }}
        className="space-y-3"
      >
        <div className="rounded-lg border border-purple-100 bg-purple-50 p-2.5 text-[10px] leading-relaxed text-purple-800">
          {t('The notice is saved with status')} <b>{t('Pending HR')}</b>.{' '}
          {t(
            "HR reviews it and files it to the employee's record — disciplinary action is HR-owned, the Branch Manager only proposes it.",
          )}
        </div>
        <div>
          <label className="form-label" htmlFor="warn-employee">
            {t('Employee')}
          </label>
          {roster.isPending ? (
            <LoadingState />
          ) : roster.error ? (
            <ErrorState message={describeApiError(roster.error)} onRetry={() => roster.refetch()} />
          ) : (
            <EmployeeSelect
              id="warn-employee"
              options={options}
              value={employeeId}
              onChange={setEmployeeId}
            />
          )}
        </div>
        <div>
          <label className="form-label" htmlFor="warn-type">
            {t('Category')}
          </label>
          <select id="warn-type" value={type} onChange={(e) => setType(e.target.value)} className="form-input">
            {WARNING_TYPES.map((option) => (
              <option key={option} value={option}>
                {t(option)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="warn-reason">
            {t('Reason')}
          </label>
          <input
            id="warn-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="form-input"
            placeholder={t('e.g. 3rd late arrival within one month')}
            required
          />
        </div>
        <div>
          <label className="form-label" htmlFor="warn-note">
            {t('What was said to the employee')}
          </label>
          <textarea
            id="warn-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="form-input"
            placeholder={t('e.g. Verbal warning issued on site; agreed on 08:00 start')}
          />
        </div>
        <div className="rounded-lg bg-charcoal-50 p-2.5 text-[10px] text-charcoal-500">
          {t('The employee does')} <b>{t('not')}</b> {t('see this until HR approves and files it.')}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button type="submit" size="sm" variant="primary" loading={save.isPending}>
            {t('Send to HR')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* Propose Bonus ------------------------------------------------------------ */

function ProposeBonusModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  // Bonuses go to working staff: the Active roster only (no terminated rows).
  const roster = useRosterOptions(true)
  const [employeeId, setEmployeeId] = useState('')
  const [type, setType] = useState(BONUS_TYPES[0])
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')

  const save = useMutation({
    mutationFn: () =>
      proposeBonus({
        employeeId: Number(employeeId),
        type,
        amount: Number(amount),
        reason: reason.trim(),
        note: note.trim() || null,
      }),
    onSuccess: (created) => {
      toast(
        t('Bonus proposal of {{amount}} for {{employee}} sent to HR', {
          amount: formatMoney(created.amount),
          employee: created.employee,
        }),
      )
      void queryClient.invalidateQueries({ queryKey: ['portal', 'branch-actions', 'pending-hr'] })
      void queryClient.invalidateQueries({ queryKey: ['portal', 'branch', 'bonuses'] })
      onClose()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <Modal open title={t('Propose Bonus → Send to HR')} onClose={onClose} width="md">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!employeeId) return toast(t('Select an employee'), 'error')
          if (!Number.isFinite(Number(amount)) || Number(amount) <= 0)
            return toast(t('Enter a valid amount'), 'error')
          if (reason.trim().length === 0) return toast(t('Add a justification for HR'), 'error')
          save.mutate()
        }}
        className="space-y-3"
      >
        <div className="rounded-lg border border-purple-100 bg-purple-50 p-2.5 text-[10px] leading-relaxed text-purple-800">
          {t('HR owns payroll edits')} (<code>payroll.edit</code>) — {t('your proposal lands as')}{' '}
          <b>{t('Pending HR')}</b> {t('and is only added to the payroll run once HR approves it.')}
        </div>
        <div>
          <label className="form-label" htmlFor="bonus-employee">
            {t('Employee')}
          </label>
          {roster.isPending ? (
            <LoadingState />
          ) : roster.error ? (
            <ErrorState message={describeApiError(roster.error)} onRetry={() => roster.refetch()} />
          ) : (
            <EmployeeSelect
              id="bonus-employee"
              options={roster.data ?? []}
              value={employeeId}
              onChange={setEmployeeId}
            />
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label" htmlFor="bonus-type">
              {t('Type')}
            </label>
            <select id="bonus-type" value={type} onChange={(e) => setType(e.target.value)} className="form-input">
              {BONUS_TYPES.map((option) => (
                <option key={option} value={option}>
                  {t(option)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="bonus-amount">
              {t('Amount (EGP)')}
            </label>
            <input
              id="bonus-amount"
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="form-input"
              placeholder={t('e.g. 500')}
              required
            />
          </div>
        </div>
        <div>
          <label className="form-label" htmlFor="bonus-reason">
            {t('Justification')}
          </label>
          <textarea
            id="bonus-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="form-input"
            placeholder={t('Why does this employee deserve it?')}
            required
          />
        </div>
        <div>
          <label className="form-label" htmlFor="bonus-note">
            {t('Supporting note (optional)')}
          </label>
          <textarea
            id="bonus-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="form-input"
            placeholder={t('Numbers that back it up — revenue, coverage, KPIs...')}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button type="submit" size="sm" variant="primary" loading={save.isPending}>
            {t('Send to HR')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* Send Report -------------------------------------------------------------- */

function SendReportModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  // Local year-month, not toISOString(): for positive UTC offsets the first
  // hours of a month land in the previous one.
  const [period, setPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [type, setType] = useState(REPORT_TYPES[0])
  const [message, setMessage] = useState('')

  const save = useMutation({
    mutationFn: () => sendBranchReport({ period, type, message: message.trim() }),
    onSuccess: () => {
      toast(t('Report sent to HR'))
      onClose()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <Modal open title={t('Send Report to HR')} onClose={onClose} width="md">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (message.trim().length === 0) return toast(t('Add the report message'), 'error')
          save.mutate()
        }}
        className="space-y-3"
      >
        <div>
          <label className="form-label" htmlFor="report-period">
            {t('Report period')}
          </label>
          <input
            id="report-period"
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="form-input"
            required
          />
        </div>
        <div>
          <label className="form-label" htmlFor="report-type">
            {t('Report type')}
          </label>
          <select id="report-type" value={type} onChange={(e) => setType(e.target.value)} className="form-input">
            {REPORT_TYPES.map((option) => (
              <option key={option} value={option}>
                {t(option)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="report-message">
            {t('Message')}
          </label>
          <textarea
            id="report-message"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="form-input"
            placeholder={t('Anything HR should know...')}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button type="submit" size="sm" variant="primary" loading={save.isPending}>
            {t('Send to HR')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/*Vacancy request quick-raise ------------------------------------------------
 * The palette's "Request Vacancy" card navigates to the Recruitment page (the
 * full queue — new requisition form included). This dedicated modal exists for
 * the palette's own "New Recruitment Request" flow, identical to the mock's
 * openNewRecruitment form; the Recruitment page reuses it.
 */

export function QuickVacancyRequestModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [position, setPosition] = useState('')
  const [headcount, setHeadcount] = useState(1)
  const [urgency, setUrgency] = useState('Medium')
  const [shift, setShift] = useState('')
  const [salary, setSalary] = useState('')
  const [reason, setReason] = useState('')

  const save = useMutation({
    mutationFn: () =>
      createVacancyRequest({
        position: position.trim(),
        urgency,
        reason: reason.trim(),
        salary: salary ? Number(salary) : null,
        shift: shift || null,
        headcount,
      }),
    onSuccess: (created) => {
      toast(t('{{position}} request submitted · awaiting HR', { position: created.data.position }))
      void queryClient.invalidateQueries({ queryKey: ['portal', 'vacancy-requests'] })
      onClose()
    },
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <Modal
      open
      title={t('New Recruitment Request')}
      subtitle={t('Tell HR exactly what you need — shift and expected salary drive the match.')}
      onClose={onClose}
      width="md"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (save.isPending) return
          if (position.trim().length === 0) return toast(t('Position is required'), 'error')
          if (reason.trim().length === 0) return toast(t('Add the reason for the request'), 'error')
          save.mutate()
        }}
        className="space-y-3"
      >
        <div>
          <label className="form-label" htmlFor="qvac-position">
            {t('Position')}
          </label>
          <input
            id="qvac-position"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="form-input"
            placeholder={t('e.g. Senior Trainer')}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label" htmlFor="qvac-count">
              {t('Count')}
            </label>
            <input
              id="qvac-count"
              type="number"
              min={1}
              value={headcount}
              onChange={(e) => setHeadcount(Number(e.target.value) || 1)}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="qvac-urgency">
              {t('Urgency')}
            </label>
            <select id="qvac-urgency" value={urgency} onChange={(e) => setUrgency(e.target.value)} className="form-input">
              <option value="Low">{t('Low')}</option>
              <option value="Medium">{t('Medium')}</option>
              <option value="High">{t('High')}</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label" htmlFor="qvac-shift">
              {t('Shift you want')}
            </label>
            <select id="qvac-shift" value={shift} onChange={(e) => setShift(e.target.value)} className="form-input">
              <option value="">{t('Any')}</option>
              <option value="Morning">{t('Morning')}</option>
              <option value="Evening">{t('Evening')}</option>
              <option value="Night">{t('Night')}</option>
              <option value="Flexible">{t('Flexible')}</option>
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="qvac-salary">
              {t('Expected salary (EGP)')}
            </label>
            <input
              id="qvac-salary"
              type="number"
              min={0}
              step={500}
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="form-input"
              placeholder={t('e.g. 12000')}
            />
          </div>
        </div>
        <div>
          <label className="form-label" htmlFor="qvac-reason">
            {t('Reason')}
          </label>
          <textarea
            id="qvac-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="form-input"
            placeholder={t('Why is this position needed?')}
            required
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button type="submit" size="sm" variant="primary" loading={save.isPending}>
            {t('Submit Request')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
