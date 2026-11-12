import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  ClipboardList,
  Download,
  KeyRound,
  Megaphone,
  Star,
  UserPlus,
  Users,
} from 'lucide-react'
import { LoadingState, ErrorState } from '../../../components/async-state'
import { useMe } from '../../../contexts/MeContext'
import { describeApiError } from '../../../lib/api-client'
import { cn } from '../../../lib/utils'
import {
  useDashboardBranchReview,
  useDashboardVacancyDecision,
  useHrDashboard,
} from '../hooks/useDashboard'
import { useDecideEmployeeRequest } from '../../requests/hooks/useRequests'
import { requestTypeLabel } from '../../requests/lib/request-status'
import { downloadReportsCsv } from '../../reports/api/reports.api'
import type { HrDashboardAction } from '../api/dashboard.api'
import CreateEmployeeDialog from '../components/CreateEmployeeDialog'
import PasswordAccessDialog from '../components/PasswordAccessDialog'
import CreateHiringFormDialog from '../components/CreateHiringFormDialog'
import CreateEvaluationFormDialog from '../components/CreateEvaluationFormDialog'
import GymsOverviewDialog from '../components/GymsOverviewDialog'
import VacancyRequestDialog from '../components/VacancyRequestDialog'
import ContractRenewalDialog from '../components/ContractRenewalDialog'
import AnnouncementDialog from '../components/AnnouncementDialog'
import ReasonDialog from '../components/ReasonDialog'
import { DashboardToasts } from '../components/DashboardToasts'
import { useMockToast } from '../hooks/useMockToast'

type SectionFilter = 'all' | 'requests' | 'vacancies' | 'branch'

type DialogState =
  | { kind: 'create-employee' }
  | { kind: 'password' }
  | { kind: 'hiring-form' }
  | { kind: 'evaluation-form' }
  | { kind: 'gyms' }
  | { kind: 'announcement' }
  | { kind: 'vacancy'; action: HrDashboardAction }
  | { kind: 'contract'; action: HrDashboardAction }
  | { kind: 'reject-request'; action: HrDashboardAction }
  | { kind: 'decline-branch'; action: HrDashboardAction }
  | null

const BRANCH_KINDS = new Set(['deduction', 'warning', 'bonus'])

/** One KPI tile of the compact strip. */
function KpiTile({
  icon: Icon,
  value,
  label,
  tone,
  accent,
  onClick,
}: {
  icon: typeof Users
  value: number
  label: string
  tone?: string
  accent?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all',
        accent ?? 'border-charcoal-200 bg-white',
        'hover:border-brand-400 hover:shadow-xs',
      )}
    >
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-charcoal-100 text-charcoal-600">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className={cn('text-xl font-extrabold leading-none text-charcoal-900', tone)}>{value}</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-charcoal-500">{label}</p>
      </div>
    </button>
  )
}

/** The HR command-center dashboard (mock pages-dashboard.js renderDashboard). */
export default function HrDashboardPage() {
  const navigate = useNavigate()
  const { me, switchGym, isSwitching } = useMe()
  const { data, isLoading, error } = useHrDashboard()
  const { toasts, toast, remove } = useMockToast()

  const decideRequest = useDecideEmployeeRequest()
  const branchReview = useDashboardBranchReview()
  const vacancyDecision = useDashboardVacancyDecision()

  const [section, setSection] = useState<SectionFilter>('all')
  const [dialog, setDialog] = useState<DialogState>(null)
  const [exporting, setExporting] = useState(false)

  const actions = useMemo(() => data?.actions ?? [], [data])
  const branches = data?.branches ?? []
  const [today] = useState(() =>
    new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }),
  )

  const counts = useMemo(
    () => ({
      all: actions.length,
      requests: actions.filter((action) => action.kind === 'request').length,
      vacancies: actions.filter((action) => action.kind === 'vacancy').length,
      branch: actions.filter((action) => BRANCH_KINDS.has(action.kind)).length,
    }),
    [actions],
  )

  const filtered = useMemo(() => {
    if (section === 'requests') return actions.filter((action) => action.kind === 'request')
    if (section === 'vacancies') return actions.filter((action) => action.kind === 'vacancy')
    if (section === 'branch') return actions.filter((action) => BRANCH_KINDS.has(action.kind))
    return actions
  }, [actions, section])

  const exportReport = async () => {
    setExporting(true)
    try {
      await downloadReportsCsv({ period: 'ytd' })
    } catch (err) {
      toast(describeApiError(err), 'error')
    } finally {
      setExporting(false)
    }
  }

  const branchKindOf = (action: HrDashboardAction): 'deduction' | 'warning' | 'bonus' =>
    action.kind === 'warning' ? 'warning' : action.kind === 'bonus' ? 'bonus' : 'deduction'

  const approve = async (action: HrDashboardAction) => {
    try {
      if (action.kind === 'request') {
        await decideRequest.mutateAsync({ id: action.refId, decision: 'approved' })
        toast('Request approved · employee notified')
      } else if (BRANCH_KINDS.has(action.kind)) {
        await branchReview.mutateAsync({ kind: branchKindOf(action), id: action.refId, decision: 'Approved' })
        toast(`${action.kind} approved for ${action.title}.`)
      } else if (action.kind === 'vacancy') {
        await vacancyDecision.mutateAsync({ id: action.refId, body: { decision: 'Approved' } })
        toast('Vacancy approved — the position is now open.')
      } else if (action.kind === 'contract') {
        setDialog({ kind: 'contract', action })
      } else if (action.kind === 'payroll') {
        navigate('/console/payroll')
      }
    } catch (err) {
      toast(describeApiError(err), 'error')
    }
  }

  const decline = (action: HrDashboardAction) => {
    if (action.kind === 'request') {
      setDialog({ kind: 'reject-request', action })
    } else if (BRANCH_KINDS.has(action.kind)) {
      setDialog({ kind: 'decline-branch', action })
    } else if (action.kind === 'vacancy') {
      setDialog({ kind: 'vacancy', action })
    } else if (action.kind === 'contract') {
      navigate(`/console/employees/${action.employeeId ?? action.refId}`)
    } else if (action.kind === 'payroll') {
      navigate('/console/payroll')
    }
  }

  const review = (action: HrDashboardAction) => {
    if (action.kind === 'vacancy') setDialog({ kind: 'vacancy', action })
    else if (action.kind === 'contract') setDialog({ kind: 'contract', action })
    else if (action.kind === 'payroll') navigate('/console/payroll')
    else navigate('/console/requests')
  }

  if (isLoading) return <LoadingState label="Loading dashboard…" />
  if (error) return <ErrorState message={describeApiError(error)} />
  if (!data) return null

  const roleLabel = me?.roleInActiveGym ?? me?.userType ?? 'HR'
  const firstName = (data.userName ?? me?.userName ?? '').split(/\s+/)[0]

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-charcoal-900">
              {data.greeting ?? 'Welcome back'}, {firstName}
            </h1>
            <span className="inline-flex items-center rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
              {roleLabel}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-charcoal-400">Multi-Branch Operational View · {today}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportReport}
            disabled={exporting}
            className="btn btn-secondary btn-sm flex h-7 items-center gap-1.5 px-2.5 text-xs"
          >
            <Download className="h-3 w-3" aria-hidden="true" />
            {exporting ? 'Exporting…' : 'Export'}
          </button>

          {/* The branch selector lives in the console header (GymSwitcher), like the
              mock's single top-right selector — no second copy here. */}
          {isSwitching && <span className="text-[10px] font-semibold text-charcoal-400">Switching…</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          icon={Building2}
          value={data.kpis.totalGyms}
          label="Gym Branches"
          onClick={() => setDialog({ kind: 'gyms' })}
        />
        <KpiTile
          icon={Users}
          value={data.kpis.totalStaff}
          label="Total Staff"
          onClick={() => navigate('/console/employees')}
        />
        <KpiTile
          icon={ClipboardList}
          value={data.kpis.totalPendingRequests}
          label="Pending Requests"
          onClick={() => navigate('/console/requests')}
        />
        <KpiTile
          icon={AlertTriangle}
          value={data.kpis.actionsNeeded}
          label="Actions Needed"
          tone="text-amber-700"
          accent="border-amber-200 bg-amber-50"
          onClick={() => setSection('all')}
        />
      </div>

      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-12">
        {/* LEFT — decision cards */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-charcoal-200 bg-white lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-charcoal-200 bg-charcoal-50/60 px-3 py-2">
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-charcoal-900">
                Actions You Need To Take
              </h2>
              <p className="text-[10px] text-charcoal-400">Decide, approve, or sign off on these items</p>
            </div>
            <div className="flex items-center rounded-lg bg-charcoal-200/70 p-0.5 text-[10px]">
              {(
                [
                  { value: 'all', label: 'All' },
                  { value: 'requests', label: 'Requests' },
                  { value: 'vacancies', label: 'Vacancies' },
                  { value: 'branch', label: 'Branch' },
                ] as { value: SectionFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setSection(tab.value)}
                  className={cn(
                    'rounded-md px-2 py-0.5 font-medium transition-all',
                    section === tab.value
                      ? 'bg-white font-bold text-charcoal-900 shadow-xs'
                      : 'text-charcoal-600',
                  )}
                >
                  {tab.label} ({counts[tab.value]})
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[420px] space-y-2 overflow-y-auto p-2.5">
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-xs text-charcoal-400">
                <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-charcoal-300" aria-hidden="true" />
                All clear — no urgent actions right now.
              </div>
            ) : (
              filtered.map((action) => (
                <div
                  key={action.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-charcoal-200 bg-charcoal-50/60 p-2.5 transition-all hover:border-charcoal-300 hover:bg-white"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className={cn('badge text-[9px] font-semibold', action.badgeClass || 'badge-gray')}>
                        {requestTypeLabel(action.badge)}
                      </span>
                      <h3 className="truncate text-xs font-bold text-charcoal-900">{action.title}</h3>
                    </div>
                    <p className="text-[11px] text-charcoal-600">{action.subtitle}</p>
                    <p className="truncate text-[10px] text-charcoal-400">{action.detail}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => approve(action)}
                      className="btn btn-success btn-sm h-7 px-2.5 text-[11px]"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => decline(action)}
                      className="btn btn-secondary btn-sm h-7 px-2 text-[11px] text-charcoal-500 hover:text-red-600"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => review(action)}
                      className="btn btn-secondary btn-sm h-7 px-2 text-[11px]"
                    >
                      Review
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between border-t border-charcoal-200 bg-charcoal-50/60 px-3 py-1.5 text-[10px] text-charcoal-400">
            <span>Approve executes sign-off immediately</span>
            <button
              type="button"
              onClick={() => navigate('/console/requests')}
              className="font-semibold text-brand-600 hover:text-brand-800"
            >
              Full Requests Queue →
            </button>
          </div>
        </div>

        {/* RIGHT — fast actions + branches */}
        <div className="flex flex-col gap-2.5 lg:col-span-5">
          <div className="rounded-xl border border-charcoal-200 bg-white p-3">
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-charcoal-900">Fast Actions</h3>
              <span className="badge badge-brand text-[9px]">HR Tools</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <FastAction icon={UserPlus} label="Create Account" onClick={() => setDialog({ kind: 'create-employee' })} />
              <FastAction icon={KeyRound} label="Change Password" onClick={() => setDialog({ kind: 'password' })} />
              <FastAction icon={ClipboardList} label="Hiring Form" onClick={() => setDialog({ kind: 'hiring-form' })} />
              <FastAction icon={Star} label="Evaluation Form" onClick={() => setDialog({ kind: 'evaluation-form' })} />
              <FastAction
                icon={ClipboardList}
                label="See Requests"
                badge={data.kpis.totalPendingRequests}
                onClick={() => navigate('/console/requests')}
              />
              <FastAction icon={Megaphone} label="Announcement" onClick={() => setDialog({ kind: 'announcement' })} />
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-charcoal-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-charcoal-900">Branches Overview</h3>
                <p className="text-[10px] text-charcoal-400">Headcount &amp; required actions</p>
              </div>
              <button
                type="button"
                onClick={() => setDialog({ kind: 'gyms' })}
                className="text-[11px] font-semibold text-brand-600 hover:text-brand-800"
              >
                Details →
              </button>
            </div>

            <div className="max-h-[260px] space-y-1.5 overflow-y-auto">
              {branches.length === 0 ? (
                <p className="py-6 text-center text-xs text-charcoal-400">No branches in scope.</p>
              ) : (
                branches.map((branch) => {
                  const selected = me?.activeGym?.gymId === branch.gymId
                  return (
                    <button
                      key={branch.gymId}
                      type="button"
                      onClick={() => void switchGym(branch.gymId)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-all',
                        selected
                          ? 'border-brand-300 bg-brand-50/70 ring-1 ring-brand-300'
                          : 'border-charcoal-100 bg-charcoal-50 hover:border-charcoal-200 hover:bg-charcoal-100',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            'h-2.5 w-2.5 flex-shrink-0 rounded-full',
                            branch.pendingActions > 0 ? 'bg-amber-500 ring-2 ring-amber-200' : 'bg-emerald-500',
                          )}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-xs font-bold text-charcoal-900">{branch.name}</p>
                            {branch.pendingActions > 0 ? (
                              <span className="flex-shrink-0 rounded border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                                {branch.pendingActions} action{branch.pendingActions === 1 ? '' : 's'}
                              </span>
                            ) : (
                              <span className="flex-shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
                                Clear
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[10px] text-charcoal-400">
                            {branch.pendingActions > 0 ? branch.summary : `${branch.location ?? branch.name} · All clear`}
                          </p>
                        </div>
                      </div>
                      <div className="ml-2 flex-shrink-0 text-right">
                        <span className="text-xs font-bold text-charcoal-900">{branch.headcount}</span>
                        <span className="ml-0.5 text-[10px] text-charcoal-400">staff</span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {dialog?.kind === 'create-employee' && (
        <CreateEmployeeDialog onClose={() => setDialog(null)} toast={toast} />
      )}
      {dialog?.kind === 'password' && <PasswordAccessDialog onClose={() => setDialog(null)} toast={toast} />}
      {dialog?.kind === 'hiring-form' && <CreateHiringFormDialog onClose={() => setDialog(null)} toast={toast} />}
      {dialog?.kind === 'evaluation-form' && (
        <CreateEvaluationFormDialog onClose={() => setDialog(null)} toast={toast} />
      )}
      {dialog?.kind === 'gyms' && <GymsOverviewDialog branches={branches} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'announcement' && <AnnouncementDialog onClose={() => setDialog(null)} toast={toast} />}
      {dialog?.kind === 'vacancy' && (
        <VacancyRequestDialog action={dialog.action} onClose={() => setDialog(null)} toast={toast} />
      )}
      {dialog?.kind === 'contract' && (
        <ContractRenewalDialog action={dialog.action} onClose={() => setDialog(null)} toast={toast} />
      )}

      {dialog?.kind === 'reject-request' && (
        <ReasonDialog
          title="Reject Request"
          description={`${dialog.action.badge} · ${dialog.action.title}`}
          label="Rejection reason (required)"
          placeholder="Why is this request being rejected?"
          confirmLabel="Reject request"
          loading={decideRequest.isPending}
          onClose={() => setDialog(null)}
          onConfirm={async (note) => {
            try {
              await decideRequest.mutateAsync({ id: dialog.action.refId, decision: 'rejected', comment: note })
              toast('Request rejected · employee notified', 'error')
              setDialog(null)
            } catch (err) {
              toast(describeApiError(err), 'error')
            }
          }}
        />
      )}

      {dialog?.kind === 'decline-branch' && (
        <ReasonDialog
          title={`Decline ${dialog.action.badge}`}
          description={`${dialog.action.title} · ${dialog.action.subtitle}`}
          label="Decline reason (required)"
          confirmLabel="Decline"
          loading={branchReview.isPending}
          onClose={() => setDialog(null)}
          onConfirm={async (note) => {
            try {
              await branchReview.mutateAsync({
                kind: branchKindOf(dialog.action),
                id: dialog.action.refId,
                decision: 'Rejected',
                note,
              })
              toast(`${dialog.action.badge} declined.`, 'info')
              setDialog(null)
            } catch (err) {
              toast(describeApiError(err), 'error')
            }
          }}
        />
      )}

      <DashboardToasts toasts={toasts} onDismiss={remove} />
    </div>
  )
}

function FastAction({
  icon: Icon,
  label,
  badge,
  onClick,
}: {
  icon: typeof Users
  label: string
  badge?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5 rounded-lg border border-charcoal-200 bg-charcoal-50/50 p-2.5 text-center transition-all hover:border-brand-300 hover:bg-brand-50"
    >
      <div className="relative flex h-7 w-7 items-center justify-center rounded-lg border border-charcoal-200 bg-white text-charcoal-600 transition-colors group-hover:border-brand-300 group-hover:text-brand-600">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {badge != null && badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
            {badge}
          </span>
        )}
      </div>
      <p className="text-[10px] font-semibold leading-tight text-charcoal-800 group-hover:text-brand-800">{label}</p>
    </button>
  )
}
