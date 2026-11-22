import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound, Search, UserPlus, UserX, UserCheck } from 'lucide-react'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Modal } from '../../../components/ui/modal'
import { describeApiError } from '../../../lib/api-client'
import { useToast } from '../../../components/ui/toast'
import { formatDate, formatNumber, initialsOf } from '../../../lib/format'
import { AttentionStrip } from '../components/AttentionStrip'
import {
  PTbody,
  PTd,
  PTh,
  PTable,
  PThead,
  PTr,
  Pager,
  Panel,
  PanelEmpty,
  PanelError,
  PanelFooter,
  PanelHead,
  PanelLabel,
  PanelLoading,
  PlatformPage,
  PlatformPageHeader,
  TableWrap,
} from '../components/platform-ui'
import { useChangeUserStatus, useCompanies, useCreateHrManager, usePlatformUsers, useResetPassword } from '../hooks/usePlatform'

/**
 * Platform HR manager accounts.
 *
 * A platform HR Manager is not attached to a gym — one account reaches every gym
 * account on the platform — so this surface is deliberately separate from the user
 * directory: scope, preset and account lifecyle live here.
 */
export default function PlatformHrManagersPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [sendInvite, setSendInvite] = useState(true)

  const managers = usePlatformUsers({
    role: 'HRManager',
    status: status || undefined,
    search: search.trim() || undefined,
    pageNumber: page,
    pageSize: 25,
  })
  // Every HR Manager reaches every gym account, so the scope badge needs the total.
  const companies = useCompanies({ pageSize: 200 })
  // The mock's footer counts the gym-scoped HR staff that hold more than one gym.
  const hrStaff = usePlatformUsers({ role: 'HR', pageSize: 100 })

  const createManager = useCreateHrManager()
  const resetPassword = useResetPassword()
  const changeStatus = useChangeUserStatus()

  const gymCount = companies.data?.totalCount ?? 0
  const multiGymStaff = (hrStaff.data?.items ?? []).filter((user) => user.companies.length > 1).length

  // The dashboard's "Create HR manager" lands here with ?new=1.
  const createOpen = createModalOpen || searchParams.get('new') === '1'

  const closeCreate = () => {
    setCreateModalOpen(false)
    if (searchParams.has('new')) setSearchParams({}, { replace: true })
  }

  const onCreate = () => {
    createManager.mutate(
      { fullName: fullName.trim(), email: email.trim(), phone: phone.trim() || null, sendInvite },
      {
        onSuccess: () => {
          toast(
            sendInvite
              ? t('{{email}} can now reach every gym account.', { email: email.trim() })
              : t('{{email}} was created without an activation invite.', { email: email.trim() }),
            'success',
          )
          setCreateModalOpen(false)
          setFullName('')
          setEmail('')
          setPhone('')
          setSendInvite(true)
        },
        onError: () => toast(t('Could not create the HR manager account.'), 'error'),
      },
    )
  }

  const onReset = (id: number, name: string) => {
    resetPassword.mutate(id, {
      onSuccess: (result) =>
        toast(
          t('A temporary password was issued for {{email}}. {{count}} session(s) revoked.', {
            email: result.email,
            count: result.sessionsRevoked,
          }),
          'success',
        ),
      onError: () => toast(t('Could not reset the password for {{name}}.', { name }), 'error'),
    })
  }

  const onToggleStatus = (id: number, name: string, suspended: boolean) => {
    if (suspended) {
      const reason = window.prompt(t('Why is {{name}} being restored?', { name }))
      if (reason === null) return
      changeStatus.mutate(
        { id, body: { status: 'Active', reason: reason || null } },
        {
          onSuccess: () => toast(t('{{name}} is active again.', { name }), 'success'),
          onError: () => toast(t('Could not restore the account.'), 'error'),
        },
      )
      return
    }

    const reason = window.prompt(t('Why is {{name}} being suspended?', { name }))
    if (!reason || reason.trim().length < 3) {
      toast(t('Give a reason of at least 3 characters.'), 'error')
      return
    }

    changeStatus.mutate(
      { id, body: { status: 'Suspended', reason: reason.trim() } },
      {
        onSuccess: () => toast(t('{{name}} is suspended.', { name }), 'success'),
        onError: () => toast(t('Could not suspend the account.'), 'error'),
      },
    )
  }

  const total = managers.data?.totalCount ?? 0
  // Scope the active count to the managers themselves — `counts.active` is
  // platform-wide and would read "3 accounts · 21 active".
  const activeCount = (managers.data?.items ?? []).filter((manager) => manager.status === 'Active').length

  return (
    <PlatformPage>
      <PlatformPageHeader
        title={t('HR manager accounts')}
        subtitle={t('{{count}} accounts · {{active}} active · each reaches all {{gyms}} gyms', {
          count: total,
          active: activeCount,
          gyms: gymCount,
        })}
        actions={
          <Button size="sm" onClick={() => setCreateModalOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Create HR manager account')}
          </Button>
        }
      />

      <AttentionStrip types={['FailedSignInBurst']} />

      <Panel grow>
        <PanelHead className="border-b-0">
          <PanelLabel>{t('Platform accounts')}</PanelLabel>
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              className="pc-control w-auto"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
              aria-label={t('Filter by status')}
            >
              <option value="">{t('Any status')}</option>
              <option value="Active">{t('Active')}</option>
              <option value="Suspended">{t('Suspended')}</option>
            </select>
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-2 top-1/2 h-3 w-3 -translate-y-1/2 text-charcoal-400"
                aria-hidden="true"
              />
              <input
                className="pc-control w-44 ps-6"
                placeholder={t('Search name or email')}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                aria-label={t('Search HR managers')}
              />
            </div>
          </div>
        </PanelHead>

        {managers.isPending ? (
          <PanelLoading />
        ) : managers.isError ? (
          <PanelError
            title={t('Could not load the HR managers')}
            message={describeApiError(managers.error)}
            onRetry={() => void managers.refetch()}
          />
        ) : managers.data.items.length === 0 ? (
          <PanelEmpty
            icon={UserPlus}
            title={t('No HR manager accounts yet')}
            hint={t('Create one to give a person HR access to every gym.')}
          />
        ) : (
          <TableWrap>
            <PTable className="pc-table-sticky">
              <PThead>
                <tr>
                  <PTh>{t('Manager')}</PTh>
                  <PTh>{t('Scope')}</PTh>
                  <PTh>{t('Preset')}</PTh>
                  <PTh>{t('Status')}</PTh>
                  <PTh>{t('Last sign-in')}</PTh>
                  <PTh className="pc-end">{t('Actions')}</PTh>
                </tr>
              </PThead>
              <PTbody>
                {managers.data.items.map((manager) => {
                  const suspended = manager.status === 'Suspended'
                  return (
                    <PTr key={manager.id} onClick={() => navigate(`/platform/users/${manager.id}`)}>
                      <PTd>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[9px] font-semibold text-brand-700">
                            {initialsOf(manager.name) || '?'}
                          </span>
                          <div className="min-w-0">
                            <p className="block truncate text-xs font-semibold leading-tight text-charcoal-800">
                              {manager.name}
                            </p>
                            <p className="truncate text-[10px] leading-tight text-charcoal-500">{manager.email}</p>
                          </div>
                        </div>
                      </PTd>
                      <PTd>
                        <Badge color="green">{t('All {{count}} gym accounts', { count: gymCount })}</Badge>
                      </PTd>
                      <PTd>
                        {manager.preset ? (
                          <Badge color="purple">{manager.preset.replace(/^Standard\s+/, '')}</Badge>
                        ) : (
                          <span className="text-[11px] text-charcoal-400">{t('Custom')}</span>
                        )}
                      </PTd>
                      <PTd>
                        <StatusBadge status={manager.status} />
                      </PTd>
                      <PTd className="whitespace-nowrap text-[11px] text-charcoal-500">
                        {manager.lastLoginAt ? formatDate(manager.lastLoginAt) : t('Never')}
                      </PTd>
                      <PTd>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm text-charcoal-600"
                            onClick={() => onReset(manager.id, manager.name)}
                            disabled={resetPassword.isPending}
                          >
                            <KeyRound className="h-3 w-3" aria-hidden="true" />
                            {t('Reset')}
                          </button>
                          <button
                            type="button"
                            className={
                              suspended
                                ? 'btn btn-ghost btn-sm text-brand-700'
                                : 'btn btn-ghost btn-sm text-red-600 hover:bg-red-50'
                            }
                            onClick={() => onToggleStatus(manager.id, manager.name, suspended)}
                            disabled={changeStatus.isPending}
                          >
                            {suspended ? (
                              <>
                                <UserCheck className="h-3 w-3" aria-hidden="true" />
                                {t('Restore')}
                              </>
                            ) : (
                              <>
                                <UserX className="h-3 w-3" aria-hidden="true" />
                                {t('Suspend')}
                              </>
                            )}
                          </button>
                        </div>
                      </PTd>
                    </PTr>
                  )
                })}
              </PTbody>
            </PTable>
          </TableWrap>
        )}

        {managers.data && managers.data.totalPages > 1 && (
          <Pager
            page={managers.data.page}
            pageSize={managers.data.pageSize}
            total={managers.data.totalCount}
            totalPages={managers.data.totalPages}
            onPageChange={setPage}
            noun={t('accounts')}
          />
        )}

        <PanelFooter>
          <p className="text-[10px] text-charcoal-500">
            {t('{{count}} platform accounts · unscoped by gym', { count: formatNumber(total) })}
          </p>
          <p className="text-[10px] text-charcoal-400">
            {t('{{count}} HR staff are assigned to more than one gym', { count: multiGymStaff })}
          </p>
        </PanelFooter>
      </Panel>

      <Modal
        open={createOpen}
        title={t('Create HR manager account')}
        onClose={closeCreate}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={closeCreate}>
              {t('Cancel')}
            </Button>
            <Button
              size="sm"
              onClick={onCreate}
              loading={createManager.isPending}
              disabled={!fullName.trim() || !email.trim()}
            >
              {t('Create account')}
            </Button>
          </>
        }
      >
        <div className="space-y-2.5">
          <label className="block">
            <span className="pc-label">{t('Full name')}</span>
            <input className="pc-control w-full" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </label>
          <label className="block">
            <span className="pc-label">{t('Email')}</span>
            <input
              type="email"
              className="pc-control w-full"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="pc-label">{t('Phone (optional)')}</span>
            <input className="pc-control w-full" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5 h-3.5 w-3.5 rounded border-charcoal-300 accent-brand-600"
              checked={sendInvite}
              onChange={(event) => setSendInvite(event.target.checked)}
            />
            <span className="min-w-0">
              <span className="block text-[11px] text-charcoal-700">{t('Send an activation invite')}</span>
              <span className="block text-[9px] text-charcoal-400">
                {t('The account reaches every gym account as soon as it is activated.')}
              </span>
            </span>
          </label>
        </div>
      </Modal>
    </PlatformPage>
  )
}
