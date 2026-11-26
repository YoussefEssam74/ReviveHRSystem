import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { Building2, KeyRound, LogIn, ShieldCheck, ShieldOff, UserCheck, UserX } from 'lucide-react'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Modal } from '../../../components/ui/modal'
import { describeApiError } from '../../../lib/api-client'
import { useToast } from '../../../components/ui/toast'
import { formatDate, formatDateTime, formatNumber, initialsOf, timeAgo } from '../../../lib/format'
import { cn } from '../../../lib/utils'
import { enterGymWorkspace } from '../lib/workspace-switch'
import {
  GymMark,
  KpiTile,
  Panel,
  PanelEmpty,
  PanelError,
  PanelHead,
  PanelLabel,
  PanelLoading,
  PlatformPage,
} from '../components/platform-ui'
import {
  useChangeUserStatus,
  useCompanies,
  useLauncherRoles,
  usePlatformUser,
  useResetPassword,
  useRevokeSessions,
  useStartWorkspace,
} from '../hooks/usePlatform'

/** One `<dt>/<dd>` pair; the employment record renders them two-up. */
function RecordRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 border-b border-charcoal-100 py-1 last:border-0">
      <dt className="w-[6.5rem] flex-shrink-0 truncate text-charcoal-500">{label}</dt>
      <dd className="min-w-0 flex-1 truncate font-semibold text-charcoal-800">{children}</dd>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-charcoal-500">{label}</dt>
      <dd className="min-w-0 truncate text-end font-semibold text-charcoal-800">{children}</dd>
    </div>
  )
}

/**
 * One platform account: employment record, access, permissions and the user's
 * own slice of the audit trail — the mock's full profile page, not a drawer.
 */
export default function PlatformUserDetailPage() {
  const { t } = useTranslation()
  const params = useParams()
  const userId = Number(params.id)
  const { toast } = useToast()

  const user = usePlatformUser(userId)
  const resetPassword = useResetPassword()
  const revokeSessions = useRevokeSessions()
  const changeStatus = useChangeUserStatus()
  const startWorkspace = useStartWorkspace()

  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [workspaceCompanyId, setWorkspaceCompanyId] = useState('')
  const [workspaceRoleId, setWorkspaceRoleId] = useState('')
  const [workspaceReason, setWorkspaceReason] = useState('')
  const companies = useCompanies({ pageSize: 200 }, workspaceOpen)
  const launcherRoles = useLauncherRoles(workspaceOpen)

  if (!Number.isFinite(userId) || userId <= 0) {
    return (
      <PlatformPage>
        <Panel>
          <PanelError title={t('Invalid user')} message={t('The address does not identify an account.')} />
        </Panel>
      </PlatformPage>
    )
  }

  if (user.isPending) {
    return (
      <PlatformPage>
        <Panel>
          <PanelLoading />
        </Panel>
      </PlatformPage>
    )
  }

  if (user.isError) {
    return (
      <PlatformPage>
        <Panel>
          <PanelError
            title={t('Could not load the account')}
            message={describeApiError(user.error)}
            onRetry={() => void user.refetch()}
          />
        </Panel>
      </PlatformPage>
    )
  }

  const detail = user.data
  const company = detail.company
  // A gym-scoped account carries its primary gym; a platform role carries every gym.
  const multiGym = detail.companies.length > 1
  const allGymsLabel =
    detail.companies.length > 0
      ? t('All {{gyms}} gym accounts', { gyms: formatNumber(detail.companies.length) })
      : t('All gym accounts')
  const gymScope = company ? `${company.name}${company.city ? ` — ${company.city}` : ''}` : allGymsLabel
  const isSuperAdmin = detail.userType === 'TopManagement'

  const onReset = () => {
    resetPassword.mutate(detail.id, {
      onSuccess: (result) => {
        toast(
          t('A temporary password was issued for {{email}}. {{count}} session(s) revoked.', {
            email: result.email,
            count: result.sessionsRevoked,
          }),
          'success',
        )
      },
      onError: () => toast(t('Could not reset the password.'), 'error'),
    })
  }

  const onRevoke = () => {
    revokeSessions.mutate(detail.id, {
      onSuccess: (result) => toast(t('{{count}} session(s) revoked.', { count: result.sessionsRevoked }), 'success'),
      onError: () => toast(t('Could not revoke the sessions.'), 'error'),
    })
  }

  const onToggleStatus = () => {
    const suspended = detail.status === 'Suspended'
    const reason = window.prompt(
      suspended
        ? t('Why is {{name}} being restored?', { name: detail.name })
        : t('Why is {{name}} being suspended?', { name: detail.name }),
    )
    if (reason === null) return
    if (!suspended && reason.trim().length < 3) {
      toast(t('Give a reason of at least 3 characters.'), 'error')
      return
    }

    changeStatus.mutate(
      { id: detail.id, body: { status: suspended ? 'Active' : 'Suspended', reason: reason.trim() || null } },
      {
        onSuccess: () =>
          toast(
            suspended
              ? t('{{name}} is active again.', { name: detail.name })
              : t('{{name}} is suspended.', { name: detail.name }),
            'success',
          ),
        onError: () => toast(t('Could not change the account status.'), 'error'),
      },
    )
  }

  const openWorkspaceModal = () => {
    setWorkspaceCompanyId(company ? String(company.id) : '')
    // Pre-filled so the primary action is never blocked by an empty reason.
    setWorkspaceReason(t('Support review from the platform console'))
    setWorkspaceOpen(true)
  }

  const permissionGroups = Object.entries(detail.permissions.groups).sort((a, b) => b[1] - a[1])

  return (
    <PlatformPage>
      <nav className="flex items-center gap-1.5 text-[10px] text-charcoal-500">
        <Link to="/platform/users" className="font-medium hover:text-brand-700">
          {t('Users')}
        </Link>
        <span className="text-charcoal-300">/</span>
        <span className="truncate font-semibold text-charcoal-700">{detail.name}</span>
      </nav>

      <Panel className="p-3">
        <div className="flex flex-wrap items-start gap-3">
          <span
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700"
            aria-hidden="true"
          >
            {detail.initials || initialsOf(detail.name) || '?'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="text-base font-bold leading-tight text-charcoal-900">{detail.name}</h1>
              <StatusBadge status={detail.status} />
              <Badge color={detail.userType === 'HRManager' ? 'purple' : detail.userType === 'HR' ? 'blue' : 'gray'}>
                {detail.role}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-charcoal-500">
              {detail.email}
              {detail.phone ? ` · ${detail.phone}` : ''}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-charcoal-500">
              {company ? (
                <Link
                  to={`/platform/companies/${company.id}`}
                  className="flex min-w-0 items-center gap-1.5 font-medium hover:text-brand-700"
                >
                  <GymMark name={company.name} />
                  <span className="truncate">
                    {company.name}
                    {company.city ? ` — ${company.city}` : ''}
                    {multiGym && (
                      <span className="ms-1 font-semibold text-brand-700">
                        · {t('{{count}} gyms', { count: detail.companies.length })}
                      </span>
                    )}
                  </span>
                </Link>
              ) : (
                <span className="flex items-center gap-1 font-semibold text-purple-700">
                  <Building2 className="h-3 w-3" aria-hidden="true" />
                  {allGymsLabel}
                </span>
              )}
              {detail.branch && (
                <span className="flex items-center gap-1">
                  {t('Branch')}:{' '}
                  <span className="font-semibold text-charcoal-700">
                    {detail.branch.name} ({detail.branch.code})
                  </span>
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className="btn btn-primary btn-sm" onClick={openWorkspaceModal}>
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              {company ? t('Enter gym as {{role}}', { role: detail.role }) : t('Enter a gym workspace')}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onReset}
              disabled={resetPassword.isPending}
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              {t('Reset password')}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onRevoke}
              disabled={revokeSessions.isPending}
            >
              <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
              {t('Revoke sessions')}
            </button>
            {!isSuperAdmin && (
              <button
                type="button"
                className={detail.status === 'Suspended' ? 'btn btn-success btn-sm' : 'btn btn-danger-outline btn-sm'}
                onClick={onToggleStatus}
                disabled={changeStatus.isPending}
              >
                {detail.status === 'Suspended' ? (
                  <>
                    <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('Reactivate')}
                  </>
                ) : (
                  <>
                    <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('Suspend')}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <KpiTile
          label={t('Role')}
          value={detail.role}
          sub={detail.roleType ? t('{{type}} role', { type: detail.roleType }) : t('No role assigned')}
          icon={ShieldCheck}
        />
        <KpiTile
          label={t('Permissions')}
          value={formatNumber(detail.permissions.total)}
          sub={detail.roleScope ? t('{{scope}} scope', { scope: detail.roleScope }) : t('No scope')}
          icon={KeyRound}
        />
        <KpiTile
          label={t('Last sign-in')}
          value={detail.lastLoginAt ? timeAgo(detail.lastLoginAt) : t('Never')}
          sub={detail.lastLoginAt ? formatDateTime(detail.lastLoginAt) : t('Invitation still pending')}
          icon={UserCheck}
        />
        <KpiTile
          label={t('Scope')}
          value={company ? detail.branch?.name ?? company.name : allGymsLabel}
          sub={company ? detail.branch?.code ?? t('All branches') : t('platform-wide')}
          icon={Building2}
        />
      </div>

      <div className="pc-grow pc-scroll-region grid grid-cols-1 gap-2.5 xl:grid-cols-3">
        <div className="flex flex-col gap-2.5 xl:col-span-2">
          <Panel>
            <PanelHead>
              <PanelLabel>{t('Employment record')}</PanelLabel>
            </PanelHead>
            <dl className="grid gap-x-6 px-3 py-2.5 text-[11px] sm:grid-cols-2">
              <RecordRow label={t('User ID')}>{`#${detail.id}`}</RecordRow>
              <RecordRow label={t('Full name')}>{detail.name}</RecordRow>
              <RecordRow label={t('Work email')}>{detail.email}</RecordRow>
              <RecordRow label={t('Phone')}>{detail.phone ?? '—'}</RecordRow>
              <RecordRow label={t('Gym account')}>{gymScope}</RecordRow>
              <RecordRow label={t('Branch')}>{detail.branch?.name ?? '—'}</RecordRow>
              <RecordRow label={t('Branch code')}>{detail.branch?.code ?? '—'}</RecordRow>
              <RecordRow label={t('Role')}>{detail.role}</RecordRow>
              <RecordRow label={t('Permission preset')}>
                {detail.preset ?? t('Standard {{role}}', { role: detail.role })}
              </RecordRow>
              <RecordRow label={t('Joined')}>{detail.joinedOn ? formatDate(detail.joinedOn) : '—'}</RecordRow>
              <RecordRow label={t('Created by')}>{detail.createdBy ?? '—'}</RecordRow>
              <RecordRow label={t('Account status')}>
                <StatusBadge status={detail.status} />
              </RecordRow>
            </dl>
          </Panel>

          <Panel className="flex flex-1 flex-col">
            <PanelHead>
              <PanelLabel>{t('Recent activity')}</PanelLabel>
              <Link to="/platform/settings" className="pc-link">
                {t('Security settings →')}
              </Link>
            </PanelHead>
            {detail.recentAudit.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <PanelEmpty
                  title={t('No recorded activity')}
                  hint={t('Nothing this account did has been audited yet.')}
                />
              </div>
            ) : (
              <div>
                {detail.recentAudit.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2 border-b border-charcoal-100 px-3 py-2 last:border-0"
                  >
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
                      <p className="text-[11px] leading-tight text-charcoal-700">
                        <span className="font-semibold">{entry.action}</span>
                        {entry.target ? ` · ${entry.target}` : ''}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-tight text-charcoal-400">
                        {timeAgo(entry.occurredAt)}
                        {entry.severity ? ` · ${t(entry.severity)}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-2.5">
          <Panel>
            <PanelHead>
              <PanelLabel>{t('Permissions from role')}</PanelLabel>
              <span className="badge badge-gray">{formatNumber(detail.permissions.total)}</span>
            </PanelHead>
            <div className="space-y-1.5 px-3 py-2.5">
              {permissionGroups.length === 0 ? (
                <p className="text-[10px] text-charcoal-400">{t('This role has no permissions assigned.')}</p>
              ) : (
                permissionGroups.map(([area, count]) => (
                  <div key={area} className="flex items-center justify-between gap-2">
                    <span className="truncate text-[10px] text-charcoal-600">{area}</span>
                    <span className="flex-shrink-0 text-[10px] font-semibold text-charcoal-800">{count}</span>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-charcoal-100 px-2 py-1.5">
              <Link to="/platform/roles" className="btn btn-ghost btn-sm w-full text-brand-700">
                {t('Manage roles →')}
              </Link>
            </div>
          </Panel>

          <Panel>
            <PanelHead>
              <PanelLabel>{t('Access details')}</PanelLabel>
            </PanelHead>
            <dl className="space-y-1.5 px-3 py-2.5 text-[10px]">
              <Fact label={t('Last sign-in')}>
                {detail.lastLoginAt ? formatDateTime(detail.lastLoginAt) : t('Never')}
              </Fact>
              <Fact label={t('Gym scope')}>{gymScope}</Fact>
              <Fact label={t('Branch scope')}>
                {detail.branch ? `${detail.branch.name} (${detail.branch.code})` : t('All branches')}
              </Fact>
              <Fact label={t('Role scope')}>{detail.roleScope ?? '—'}</Fact>
              <Fact label={t('User type')}>{detail.userType}</Fact>
            </dl>
          </Panel>

          <Panel>
            <PanelHead>
              <PanelLabel>{t('Personal details')}</PanelLabel>
            </PanelHead>
            <dl className="space-y-1.5 px-3 py-2.5 text-[10px]">
              <Fact label={t('Phone')}>{detail.phone ?? '—'}</Fact>
              <Fact label={t('Hire date')}>
                {detail.hireDate ? formatDate(detail.hireDate) : '—'}
              </Fact>
              <Fact label={t('Date of birth')}>
                {detail.dateOfBirth ? formatDate(detail.dateOfBirth) : '—'}
              </Fact>
              <Fact label={t('Gender')}>{detail.gender ?? '—'}</Fact>
              <Fact label={t('National ID')}>{detail.nationalId ?? '—'}</Fact>
            </dl>
          </Panel>
        </div>
      </div>

      <Modal
        open={workspaceOpen}
        title={t('Enter a gym workspace')}
        subtitle={t('Acts inside the gym as you — every action is audited.')}
        onClose={() => setWorkspaceOpen(false)}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setWorkspaceOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button
              size="sm"
              loading={startWorkspace.isPending}
              disabled={!workspaceCompanyId || workspaceReason.trim().length < 5}
              onClick={() =>
                startWorkspace.mutate(
                  {
                    companyId: Number(workspaceCompanyId),
                    effectiveRoleId: workspaceRoleId ? Number(workspaceRoleId) : null,
                    reason: workspaceReason.trim(),
                  },
                  {
                    onSuccess: (result) => {
                      enterGymWorkspace(result)
                      window.location.assign('/console/dashboard')
                    },
                    onError: () => toast(t('Could not enter the workspace.'), 'error'),
                  },
                )
              }
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              {t('Open workspace')}
            </Button>
          </>
        }
      >
        <div className="space-y-2.5">
          <label className="block">
            <span className="pc-label">{t('Gym account')}</span>
            <select
              className="pc-control w-full"
              value={workspaceCompanyId}
              onChange={(event) => setWorkspaceCompanyId(event.target.value)}
            >
              <option value="">{t('Choose a gym account')}</option>
              {companies.data?.items.map((gym) => (
                <option key={gym.id} value={String(gym.id)}>
                  {gym.name}
                  {gym.city ? ` — ${gym.city}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="pc-label">{t('Act as')}</span>
            <select
              className="pc-control w-full"
              value={workspaceRoleId}
              onChange={(event) => setWorkspaceRoleId(event.target.value)}
            >
              <option value="">{t("The gym's own scope")}</option>
              {launcherRoles.data?.items.map((role) => (
                <option key={role.roleId} value={String(role.roleId)}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="pc-label">{t('Reason')}</span>
            <input
              className="pc-control w-full"
              placeholder={t('Why are you entering?')}
              value={workspaceReason}
              onChange={(event) => setWorkspaceReason(event.target.value)}
            />
          </label>
        </div>
      </Modal>
    </PlatformPage>
  )
}
