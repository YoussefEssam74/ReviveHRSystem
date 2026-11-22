import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, Mail, Phone, Plus, User } from 'lucide-react'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Modal } from '../../../components/ui/modal'
import { useToast } from '../../../components/ui/toast'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatMoney, formatNumber, timeAgo } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import type { CompanyDetail } from '../api/platform.api'
import {
  useArchiveBranch,
  useChangeCompanyStatus,
  useCompany,
  useCompanyAudit,
  useCompanyBilling,
  useCompanyBranches,
  useCompanyEmployees,
  useCompanyHrStaff,
  useCompanyOverview,
  useCreateBranch,
  useUpdateBranch,
} from '../hooks/usePlatform'
import {
  PTbody,
  PTd,
  PTh,
  PTable,
  PThead,
  PTr,
  Panel,
  PanelEmpty,
  PanelError,
  PanelHead,
  PanelLabel,
  PanelLoading,
  PlatformPage,
  TableWrap,
  GymMark,
} from '../components/platform-ui'
import { AttentionStrip } from '../components/AttentionStrip'

type CompanyTab = 'overview' | 'employees' | 'branches' | 'hr' | 'billing'

/** Mock's `.stat-tile`: label, big figure, quiet sub-line, optional brand accent. */
function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-[10px] border border-charcoal-200 bg-white px-2.5 py-2',
        accent && 'border-s-[3px] border-s-brand-600',
      )}
    >
      <p className="pc-stat-label">{label}</p>
      <p className="pc-stat-value">{value}</p>
      {sub && <p className="pc-stat-sub">{sub}</p>}
    </div>
  )
}

/** Definition-list row for the account-facts card. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-charcoal-500">{label}</dt>
      <dd className="text-end font-semibold text-charcoal-800">{children}</dd>
    </div>
  )
}

/** The gym's own audit trail — what changed here, who changed it, and how serious it was. */
function RecentActivityCard({ companyId }: { companyId: number }) {
  const { t } = useTranslation()
  const audit = useCompanyAudit(companyId, 6)

  return (
    <Panel>
      <PanelHead>
        <div className="min-w-0 flex-1">
          <p className="pc-card-label">{t('Recent activity')}</p>
          <p className="mt-0.5 text-[10px] text-charcoal-500">
            {t('{{count}} events on this account', { count: audit.data?.counts.total ?? 0 })}
          </p>
        </div>
        {audit.data && audit.data.counts.warning > 0 && (
          <span className="badge badge-yellow">
            {t('{{count}} warning(s)', { count: audit.data.counts.warning })}
          </span>
        )}
      </PanelHead>
      {audit.isPending ? (
        <PanelLoading />
      ) : audit.isError ? (
        <PanelError
          title={t('Could not load the activity')}
          message={describeApiError(audit.error)}
          onRetry={() => void audit.refetch()}
          compact
        />
      ) : audit.data.items.length === 0 ? (
        <PanelEmpty title={t('Nothing recorded yet')} hint={t('Sign-ins and billing changes appear here.')} />
      ) : (
        <div>
          {audit.data.items.map((entry) => (
            <div key={entry.id} className="flex items-start gap-2 border-b border-charcoal-100 px-3 py-2 last:border-0">
              <span
                className={cn(
                  'mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full',
                  entry.severity === 'critical'
                    ? 'bg-red-500'
                    : entry.severity === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-charcoal-300',
                )}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] leading-tight text-charcoal-700">
                  <span className="font-semibold">{entry.action}</span>
                  {entry.target ? ` · ${entry.target}` : ''}
                </p>
                <p className="mt-0.5 truncate text-[10px] leading-tight text-charcoal-400">
                  {timeAgo(entry.occurredAt)} · {entry.actor.name}
                  {entry.category ? ` · ${entry.category}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

function OverviewTab({
  detail,
  onTabChange,
}: {
  detail: CompanyDetail
  onTabChange: (tab: CompanyTab) => void
}) {
  const { t } = useTranslation()
  const companyId = detail.id
  const overview = useCompanyOverview(companyId)
  const billing = useCompanyBilling(companyId, overview.isSuccess)

  if (overview.isPending) return <PanelLoading />
  if (overview.isError)
    return (
      <PanelError
        title={t('Could not load the overview')}
        message={describeApiError(overview.error)}
        onRetry={() => void overview.refetch()}
      />
    )

  const { roleBreakdown, accountFacts } = overview.data
  const totalUsers = roleBreakdown.total
  const seats = billing.data?.seats
  const seatPercent = seats && seats.limit ? Math.round((seats.used / seats.limit) * 100) : null
  const attendanceRate = detail.health.attendanceRate30d

  const roleRows = [
    { label: t('HR staff'), value: roleBreakdown.hr },
    { label: t('Branch managers'), value: roleBreakdown.branchManager },
    { label: t('Team leaders'), value: roleBreakdown.teamLeader },
    { label: t('Employees'), value: roleBreakdown.employee },
  ]
  const rolePeak = Math.max(1, ...roleRows.map((row) => row.value))

  // Quota pressure: the same numbers the seat cap enforces, next to the cap itself.
  const seatLimit = seats?.limit ?? detail.subscription?.seatLimit ?? null
  const branchLimit = detail.subscription?.branchLimit ?? null
  const seatUsage = seatLimit ? Math.min(100, Math.round((totalUsers / seatLimit) * 100)) : null
  const branchUsage = branchLimit ? Math.min(100, Math.round((detail.counts.branches / branchLimit) * 100)) : null

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      <div className="space-y-3 xl:col-span-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile
            label={t('Total users')}
            value={formatNumber(totalUsers)}
            sub={t('{{count}} employees', { count: roleBreakdown.employee })}
            accent
          />
          <StatTile label={t('HR staff')} value={formatNumber(roleBreakdown.hr)} sub={t('assigned to this gym')} />
          <StatTile
            label={t('Attendance')}
            value={attendanceRate === null ? '—' : `${Math.round(attendanceRate)}%`}
            sub={t('last 30 days')}
          />
          <StatTile
            label={t('Seats used')}
            value={seatPercent === null ? '—' : `${seatPercent}%`}
            sub={
              seats && seats.limit
                ? t('{{used}} of {{limit}}', { used: formatNumber(seats.used), limit: formatNumber(seats.limit) })
                : t('No seat cap')
            }
          />
        </div>

        <Panel>
          <PanelHead>
            <PanelLabel>{t('Users by role')}</PanelLabel>
          </PanelHead>
          <div className="space-y-2 px-3 py-2.5">
            {roleRows.map((row) => (
              <div className="pc-bar-row" key={row.label}>
                <span className="pc-bar-label">{row.label}</span>
                <div className="pc-meter">
                  <div className="pc-meter-fill" style={{ width: `${Math.round((row.value / rolePeak) * 100)}%` }} />
                </div>
                <span className="pc-bar-value">{formatNumber(row.value)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <RecentActivityCard companyId={companyId} />
      </div>

      <div className="space-y-3">
        <Panel>
          <PanelHead>
            <PanelLabel>{t('Account facts')}</PanelLabel>
          </PanelHead>
          <dl className="space-y-1.5 px-3 py-2.5 text-[11px]">
            <Fact label={t('Plan')}>{accountFacts.planName}</Fact>
            <Fact label={t('Billing cycle')}>{accountFacts.billingCycle ?? '—'}</Fact>
            <Fact label={t('Subscribed on')}>
              {accountFacts.subscribedOn ? formatDate(accountFacts.subscribedOn) : '—'}
            </Fact>
            <Fact label={t('Renews on')}>{accountFacts.renewsOn ? formatDate(accountFacts.renewsOn) : '—'}</Fact>
            <Fact label={t('Monthly value')}>{formatMoney(accountFacts.monthlyValue)}</Fact>
            <Fact label={t('Payroll status')}>{accountFacts.payrollStatus ?? '—'}</Fact>
            <Fact label={t('Last activity')}>
              {accountFacts.lastActivityAt ? formatDate(accountFacts.lastActivityAt) : '—'}
            </Fact>
          </dl>
        </Panel>

        <Panel>
          <PanelHead>
            <PanelLabel>{t('Plan limits')}</PanelLabel>
            <Link to="/platform/billing" className="pc-link">
              {t('Change plan →')}
            </Link>
          </PanelHead>
          <div className="space-y-2.5 px-3 py-2.5">
            <div>
              <div className="mb-1 flex items-center justify-between text-[10px]">
                <span className="text-charcoal-500">{t('Seats')}</span>
                <span className="font-semibold text-charcoal-800">
                  {formatNumber(totalUsers)}
                  {seatLimit ? ` / ${formatNumber(seatLimit)}` : ` · ${t('unlimited')}`}
                </span>
              </div>
              <div className="pc-meter">
                <div
                  className={cn(
                    'pc-meter-fill',
                    seatUsage === null ? undefined : seatUsage >= 90 ? 'is-red' : seatUsage >= 75 ? 'is-amber' : undefined,
                  )}
                  style={{ width: `${seatUsage ?? 4}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[10px]">
                <span className="text-charcoal-500">{t('Branches')}</span>
                <span className="font-semibold text-charcoal-800">
                  {formatNumber(detail.counts.branches)}
                  {branchLimit ? ` / ${formatNumber(branchLimit)}` : ` · ${t('unlimited')}`}
                </span>
              </div>
              <div className="pc-meter">
                <div
                  className={cn(
                    'pc-meter-fill',
                    branchUsage === null
                      ? undefined
                      : branchUsage >= 90
                        ? 'is-red'
                        : branchUsage >= 75
                          ? 'is-amber'
                          : undefined,
                  )}
                  style={{ width: `${branchUsage ?? 4}%` }}
                />
              </div>
            </div>
            <p className="text-[10px] leading-relaxed text-charcoal-500">
              {seatPercent !== null && seatPercent >= 90
                ? t('Seats nearly full — the plan caps new accounts until it is upgraded.')
                : t('Limits come from the subscription plan and apply to every new seat or branch.')}
            </p>
          </div>
        </Panel>

        <Panel>
          <PanelHead>
            <PanelLabel>{t('Super Admin actions')}</PanelLabel>
          </PanelHead>
          <div className="space-y-1.5 p-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm w-full justify-start"
              onClick={() => onTabChange('hr')}
            >
              {t('Assign HR staff to this gym')}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm w-full justify-start"
              onClick={() => onTabChange('billing')}
            >
              {t('Review subscription and invoices')}
            </button>
            <Link to="/platform/users" className="btn btn-secondary btn-sm w-full justify-start">
              {t('Open the user directory')}
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function EmployeesTab({ companyId }: { companyId: number }) {
  const { t } = useTranslation()
  const [role, setRole] = useState('')
  const employees = useCompanyEmployees(companyId, { role: role || undefined, pageSize: 50 })

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 px-3 py-1.5">
        {['', 'HR', 'BranchManager', 'TeamLeader', 'Employee'].map((option) => (
          <button
            key={option || 'all'}
            type="button"
            onClick={() => setRole(option)}
            className={cn(
              'h-6 rounded-full border px-2 text-[10px] font-medium transition-colors',
              role === option
                ? 'border-brand-200 bg-brand-50 font-semibold text-brand-700'
                : 'border-charcoal-200 bg-white text-charcoal-600 hover:border-charcoal-300',
            )}
          >
            {option ? t(option) : t('All roles')}
          </button>
        ))}
      </div>

      {employees.isPending ? (
        <PanelLoading />
      ) : employees.isError ? (
        <PanelError
          title={t('Could not load the employees')}
          message={describeApiError(employees.error)}
          onRetry={() => void employees.refetch()}
        />
      ) : employees.data.items.length === 0 ? (
        <PanelEmpty title={t('No employees match')} hint={t('Try a different role filter.')} />
      ) : (
        <>
          <TableWrap>
            <PTable className="pc-table-sticky">
              <PThead>
                <tr>
                  <PTh>{t('Name')}</PTh>
                  <PTh>{t('Role')}</PTh>
                  <PTh>{t('Branch')}</PTh>
                  <PTh>{t('Status')}</PTh>
                  <PTh>{t('Last sign-in')}</PTh>
                </tr>
              </PThead>
              <PTbody>
                {employees.data.items.map((employee) => (
                  <PTr key={employee.userId}>
                    <PTd>
                      <Link
                        to={`/platform/users/${employee.userId}`}
                        className="block truncate text-xs font-semibold leading-tight text-charcoal-800 hover:text-brand-700"
                      >
                        {employee.name}
                      </Link>
                      <span className="block truncate text-[10px] leading-tight text-charcoal-400">
                        {employee.email}
                      </span>
                    </PTd>
                    <PTd className="whitespace-nowrap text-[11px] text-charcoal-600">{t(employee.role)}</PTd>
                    <PTd className="text-[11px] text-charcoal-600">{employee.branchName ?? '—'}</PTd>
                    <PTd>
                      <StatusBadge status={employee.status} />
                    </PTd>
                    <PTd className="whitespace-nowrap text-[11px] text-charcoal-500">
                      {employee.lastLoginAt ? formatDate(employee.lastLoginAt) : t('Never')}
                    </PTd>
                  </PTr>
                ))}
              </PTbody>
            </PTable>
          </TableWrap>
          <p className="border-t border-charcoal-100 px-3 py-1.5 text-[10px] text-charcoal-400">
            {t('{{count}} of {{total}} shown.', { count: employees.data.items.length, total: employees.data.totalCount })}
          </p>
        </>
      )}
    </>
  )
}

type BranchDraftState = {
  id: number | null
  name: string
  area: string
  address: string
  phone: string
}

const emptyBranch = (): BranchDraftState => ({ id: null, name: '', area: '', address: '', phone: '' })

function BranchesTab({ companyId }: { companyId: number }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const branches = useCompanyBranches(companyId)
  const createBranch = useCreateBranch()
  const updateBranch = useUpdateBranch()
  const archiveBranch = useArchiveBranch()
  const [draft, setDraft] = useState<BranchDraftState | null>(null)

  if (branches.isPending) return <PanelLoading />
  if (branches.isError)
    return (
      <PanelError
        title={t('Could not load the branches')}
        message={describeApiError(branches.error)}
        onRetry={() => void branches.refetch()}
      />
    )

  const limitReached = branches.data.branchLimitReached
  const busy = createBranch.isPending || updateBranch.isPending

  const submit = () => {
    if (!draft) return
    const body = {
      name: draft.name.trim(),
      area: draft.area.trim() || null,
      address: draft.address.trim() || null,
      phone: draft.phone.trim() || null,
    }
    const onSuccess = () => {
      toast(draft.id === null ? t('Branch added.') : t('Branch updated.'), 'success')
      setDraft(null)
    }
    const onError = () => toast(t('Could not save the branch.'), 'error')

    if (draft.id === null) createBranch.mutate({ companyId, body }, { onSuccess, onError })
    else updateBranch.mutate({ companyId, branchId: draft.id, body }, { onSuccess, onError })
  }

  const archive = (branchId: number, name: string) => {
    if (!window.confirm(t('Archive {{name}}? Its history stays, but it stops taking new work.', { name }))) return
    archiveBranch.mutate(
      { companyId, branchId },
      {
        onSuccess: () => toast(t('{{name}} was archived.', { name }), 'success'),
        onError: () => toast(t('Could not archive the branch.'), 'error'),
      },
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-charcoal-100 px-3 py-1.5">
        <p className="flex items-center gap-1.5 text-[10px] text-charcoal-500">
          {branches.data.branchLimit !== null
            ? t('{{used}} of {{limit}} branches on this plan', {
                used: branches.data.items.length,
                limit: branches.data.branchLimit,
              })
            : t('{{count}} branches · unlimited on this plan', { count: branches.data.items.length })}
          {limitReached && <Badge color="yellow">{t('Limit reached')}</Badge>}
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm disabled:opacity-40"
          disabled={limitReached}
          title={limitReached ? t('The plan caps branches — upgrade the plan to add more.') : undefined}
          onClick={() => setDraft(emptyBranch())}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {t('Add branch')}
        </button>
      </div>

      {branches.data.items.length === 0 ? (
        <PanelEmpty title={t('No branches yet')} hint={t('A gym needs at least one branch to operate.')} />
      ) : (
        <TableWrap>
          <PTable className="pc-table-sticky">
            <PThead>
              <tr>
                <PTh>{t('Branch')}</PTh>
                <PTh>{t('Area')}</PTh>
                <PTh>{t('Address')}</PTh>
                <PTh>{t('Phone')}</PTh>
                <PTh className="pc-end">{t('Staff')}</PTh>
                <PTh>{t('Status')}</PTh>
                <PTh className="pc-end">{t('Actions')}</PTh>
              </tr>
            </PThead>
            <PTbody>
              {branches.data.items.map((branch) => (
                <PTr key={branch.id}>
                  <PTd>
                    <span className="block text-xs font-semibold leading-tight text-charcoal-800">{branch.name}</span>
                    <span className="block text-[10px] leading-tight text-charcoal-400">{branch.code}</span>
                  </PTd>
                  <PTd className="text-[11px] text-charcoal-600">{branch.area ?? '—'}</PTd>
                  <PTd className="max-w-[220px] truncate text-[11px] text-charcoal-600">{branch.address ?? '—'}</PTd>
                  <PTd className="whitespace-nowrap text-[11px] text-charcoal-600">{branch.phone ?? '—'}</PTd>
                  <PTd className="pc-end text-[11px] text-charcoal-600">{formatNumber(branch.staffCount)}</PTd>
                  <PTd>
                    <StatusBadge status={branch.status} />
                  </PTd>
                  <PTd>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-charcoal-600"
                        onClick={() =>
                          setDraft({
                            id: branch.id,
                            name: branch.name,
                            area: branch.area ?? '',
                            address: branch.address ?? '',
                            phone: branch.phone ?? '',
                          })
                        }
                      >
                        {t('Edit')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-red-600 disabled:opacity-40"
                        disabled={branch.status !== 'Active' || archiveBranch.isPending}
                        onClick={() => archive(branch.id, branch.name)}
                      >
                        {t('Archive')}
                      </button>
                    </div>
                  </PTd>
                </PTr>
              ))}
            </PTbody>
          </PTable>
        </TableWrap>
      )}

      <Modal
        open={draft !== null}
        title={draft?.id === null ? t('Add branch') : t('Edit branch')}
        subtitle={t('Every branch gets its own code and staff scope')}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDraft(null)}>
              {t('Cancel')}
            </Button>
            <Button size="sm" onClick={submit} loading={busy} disabled={!draft?.name.trim()}>
              {draft?.id === null ? t('Add branch') : t('Save branch')}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-2.5">
            <label className="block">
              <span className="pc-label">{t('Branch name')}</span>
              <input
                className="pc-control w-full"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="block">
                <span className="pc-label">{t('Area')}</span>
                <input
                  className="pc-control w-full"
                  placeholder={t('e.g. Smouha')}
                  value={draft.area}
                  onChange={(event) => setDraft({ ...draft, area: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="pc-label">{t('Phone')}</span>
                <input
                  className="pc-control w-full"
                  value={draft.phone}
                  onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                />
              </label>
            </div>
            <label className="block">
              <span className="pc-label">{t('Address')}</span>
              <input
                className="pc-control w-full"
                value={draft.address}
                onChange={(event) => setDraft({ ...draft, address: event.target.value })}
              />
            </label>
          </div>
        )}
      </Modal>
    </>
  )
}

function HrStaffTab({ companyId }: { companyId: number }) {
  const { t } = useTranslation()
  const staff = useCompanyHrStaff(companyId)

  if (staff.isPending) return <PanelLoading />
  if (staff.isError)
    return <PanelError
      title={t('Could not load the HR staff')}
      message={describeApiError(staff.error)}
      onRetry={() => void staff.refetch()}
    />

  if (staff.data.items.length === 0) {
    return (
      <PanelEmpty
        title={t('No HR staff assigned')}
        hint={t('An HR Manager can be granted access to this account from the Users page.')}
      />
    )
  }

  return (
    <TableWrap>
      <PTable className="pc-table-sticky">
        <PThead>
          <tr>
            <PTh>{t('Name')}</PTh>
            <PTh className="pc-end">{t('Companies')}</PTh>
            <PTh>{t('Primary branch')}</PTh>
            <PTh>{t('Status')}</PTh>
          </tr>
        </PThead>
        <PTbody>
          {staff.data.items.map((member) => (
            <PTr key={member.userId}>
              <PTd>
                <Link
                  to={`/platform/users/${member.userId}`}
                  className="block truncate text-xs font-semibold leading-tight text-charcoal-800 hover:text-brand-700"
                >
                  {member.name}
                </Link>
                <span className="block truncate text-[10px] leading-tight text-charcoal-400">{member.email}</span>
              </PTd>
              <PTd className="pc-end text-[11px] text-charcoal-600">{member.assignedCompanyCount}</PTd>
              <PTd className="text-[11px] text-charcoal-600">{member.primaryBranch ?? '—'}</PTd>
              <PTd>
                <StatusBadge status={member.status} />
              </PTd>
            </PTr>
          ))}
        </PTbody>
      </PTable>
    </TableWrap>
  )
}

function BillingTab({ companyId }: { companyId: number }) {
  const { t } = useTranslation()
  const billing = useCompanyBilling(companyId)

  if (billing.isPending) return <PanelLoading />
  if (billing.isError) {
    return (
      <PanelError
        title={t('Could not load the billing terms')}
        message={t('This account may not have an active subscription yet.')}
        onRetry={() => void billing.refetch()}
      />
    )
  }

  const { plan, seats, invoices } = billing.data

  return (
    <div className="flex flex-col gap-2.5">
      <Panel>
        <PanelHead>
          <PanelLabel>{plan.name}</PanelLabel>
          <span className="text-[10px] text-charcoal-500">
            {formatMoney(plan.price)} · {plan.cycleCount} {plan.cycleUnit.toLowerCase()}
          </span>
        </PanelHead>
        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-charcoal-500">{t('Seats')}</span>
            <span className="font-semibold text-charcoal-800">
              {formatNumber(seats.used)}
              {seats.limit === null ? ` / ${t('unlimited')}` : ` / ${formatNumber(seats.limit)}`}
            </span>
          </div>
          {plan.features.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1">
              {plan.features.map((feature) => (
                <li key={feature}>
                  <Badge color="gray">{feature}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHead>
          <PanelLabel>{t('Invoices')}</PanelLabel>
        </PanelHead>
        {invoices.length === 0 ? (
          <PanelEmpty title={t('No invoices yet')} />
        ) : (
          <TableWrap className="max-h-72">
            <PTable className="pc-table-sticky">
              <PThead>
                <tr>
                  <PTh>{t('Invoice')}</PTh>
                  <PTh>{t('Period')}</PTh>
                  <PTh className="pc-end">{t('Amount')}</PTh>
                  <PTh>{t('Issued')}</PTh>
                  <PTh>{t('Status')}</PTh>
                </tr>
              </PThead>
              <PTbody>
                {invoices.map((invoice) => (
                  <PTr key={invoice.id}>
                    <PTd className="text-xs font-semibold text-charcoal-800">{invoice.invoiceNumber}</PTd>
                    <PTd className="whitespace-nowrap text-[11px] text-charcoal-600">{invoice.periodLabel}</PTd>
                    <PTd className="pc-end whitespace-nowrap text-xs text-charcoal-700">
                      {formatMoney(invoice.amount)}
                    </PTd>
                    <PTd className="whitespace-nowrap text-[11px] text-charcoal-500">
                      {formatDate(invoice.issuedOn)}
                    </PTd>
                    <PTd>
                      <StatusBadge status={invoice.status} />
                    </PTd>
                  </PTr>
                ))}
              </PTbody>
            </PTable>
          </TableWrap>
        )}
      </Panel>
    </div>
  )
}

/** A company record: identity card, lifecycle actions and the five working tabs. */
export default function PlatformCompanyDetailPage() {
  const { t } = useTranslation()
  const params = useParams()
  const companyId = Number(params.id)
  const [tab, setTab] = useState<CompanyTab>('overview')

  const company = useCompany(companyId)
  const changeStatus = useChangeCompanyStatus()

  if (!Number.isFinite(companyId) || companyId <= 0) {
    return (
      <PlatformPage>
        <Panel>
          <PanelError title={t('Invalid company')} message={t('The address does not identify an account.')} />
        </Panel>
      </PlatformPage>
    )
  }

  if (company.isPending) {
    return (
      <PlatformPage>
        <Panel>
          <PanelLoading />
        </Panel>
      </PlatformPage>
    )
  }

  if (company.isError) {
    return (
      <PlatformPage>
        <Panel>
          <PanelError
            title={t('Could not load the company')}
            message={describeApiError(company.error)}
            onRetry={() => void company.refetch()}
          />
        </Panel>
      </PlatformPage>
    )
  }

  const detail = company.data
  const suspended = detail.status === 'Suspended'

  const suspend = () => {
    const reason = window.prompt(t('Why is this account being suspended?'))
    if (!reason || reason.trim().length < 3) return
    changeStatus.mutate({ id: detail.id, body: { status: 'Suspended', reason: reason.trim() } })
  }

  const restore = () => changeStatus.mutate({ id: detail.id, body: { status: 'Active' } })

  const tabs: { value: CompanyTab; label: string; count?: number }[] = [
    { value: 'overview', label: t('Overview') },
    { value: 'branches', label: t('Branches'), count: detail.counts.branches },
    { value: 'employees', label: t('Employees'), count: detail.counts.users },
    { value: 'hr', label: t('HR staff'), count: detail.counts.hrStaff },
    { value: 'billing', label: t('Billing'), count: detail.counts.invoices },
  ]

  return (
    <PlatformPage>
      <nav className="flex items-center gap-1.5 text-[10px] text-charcoal-500">
        <Link to="/platform/companies" className="font-medium hover:text-brand-700">
          {t('Gym accounts')}
        </Link>
        <span className="text-charcoal-300">/</span>
        <span className="truncate font-semibold text-charcoal-700">{detail.name}</span>
      </nav>

      <Panel className="p-3">
        <div className="flex flex-wrap items-start gap-3">
          <GymMark name={detail.name} logoUrl={detail.logoUrl} size="lg" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-bold leading-tight text-charcoal-900">{detail.name}</h1>
              <StatusBadge status={detail.status} />
              {detail.subscription && <Badge color="gray">{detail.subscription.planName}</Badge>}
              <Badge color="gray">{detail.code}</Badge>
            </div>
            <p className="mt-0.5 text-[11px] text-charcoal-500">
              {[
                detail.city,
                detail.counts.branches === 1
                  ? t('1 branch')
                  : t('{{count}} branches', { count: detail.counts.branches }),
                t('{{count}} users', { count: detail.counts.users }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {(detail.contact.email || detail.contact.phone || detail.contact.name) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-charcoal-500">
                {detail.contact.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3 text-charcoal-400" aria-hidden="true" />
                    {detail.contact.email}
                  </span>
                )}
                {detail.contact.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3 text-charcoal-400" aria-hidden="true" />
                    {detail.contact.phone}
                  </span>
                )}
                {detail.contact.name && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3 text-charcoal-400" aria-hidden="true" />
                    {detail.contact.name}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTab('hr')}>
              {t('Assign HR staff')}
            </button>
            <Link to="/platform/billing" className="btn btn-secondary btn-sm">
              {t('Open billing')}
            </Link>
            {suspended ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={restore}
                disabled={changeStatus.isPending}
              >
                {t('Restore')}
              </button>
            ) : detail.status !== 'Closed' ? (
              <button
                type="button"
                className="btn btn-danger-outline btn-sm"
                onClick={suspend}
                disabled={changeStatus.isPending}
              >
                {t('Suspend')}
              </button>
            ) : null}
          </div>
        </div>

        {detail.blocking.payrollBlocked && detail.blocking.reason && (
          <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600" aria-hidden="true" />
            <p className="text-[10px] leading-relaxed text-amber-800">
              <strong className="font-semibold">{t('Payroll is blocked.')}</strong> {detail.blocking.reason}
            </p>
          </div>
        )}
      </Panel>

      <AttentionStrip companyId={detail.id} />

      <div className="flex flex-shrink-0 items-center gap-1 overflow-x-auto border-b border-charcoal-200">
        {tabs.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className={cn('pc-tab', tab === item.value && 'active')}
            onClick={() => setTab(item.value)}
          >
            {item.label}
            {item.count !== undefined && <span className="pc-tab-count">{item.count}</span>}
          </button>
        ))}
      </div>

      <div className="pc-grow pc-scroll-region">
        {tab === 'overview' && <OverviewTab detail={detail} onTabChange={setTab} />}
        {tab === 'employees' && <EmployeesTab companyId={companyId} />}
        {tab === 'branches' && <BranchesTab companyId={companyId} />}
        {tab === 'hr' && <HrStaffTab companyId={companyId} />}
        {tab === 'billing' && <BillingTab companyId={companyId} />}
      </div>
    </PlatformPage>
  )
}
