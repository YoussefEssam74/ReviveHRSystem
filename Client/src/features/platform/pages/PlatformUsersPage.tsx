import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Search, UserCog, UserCheck, UserX, Users } from 'lucide-react'
import { StatusBadge } from '../../../components/ui/badge'
import { describeApiError } from '../../../lib/api-client'
import { formatDate, formatNumber, initialsOf } from '../../../lib/format'
import {
  KpiTile,
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
  PanelHead,
  PanelLabel,
  PanelLoading,
  PlatformPage,
  PlatformPageHeader,
  TableWrap,
} from '../components/platform-ui'
import { useCompanies, usePlatformAlerts, usePlatformUsers } from '../hooks/usePlatform'
import type { PlatformAlert } from '../api/platform.api'

const ROLES = ['HRManager', 'HR', 'BranchManager', 'TeamLeader', 'Employee']

/**
 * Platform-wide user directory.
 *
 * The HR-manager surface is its own page (`PlatformHrManagersPage`) because the
 * mock gives it a different shape: platform scope, presets and lifecycle actions.
 *
 * Platform owners (Top Management) are deliberately absent: the directory manages
 * the accounts below them, so the signed-in Super Admin never appears here.
 */
export default function PlatformUsersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [page, setPage] = useState(1)

  const companies = useCompanies({ pageSize: 200 })

  // The sidebar badge points here; these markers say which account each alert is about.
  const alerts = usePlatformAlerts()
  const alertsByUser = new Map<number, PlatformAlert[]>()
  for (const alert of alerts.data?.items ?? []) {
    if (alert.userId === null) continue
    alertsByUser.set(alert.userId, [...(alertsByUser.get(alert.userId) ?? []), alert])
  }

  const users = usePlatformUsers({
    search: search.trim() || undefined,
    role: role || undefined,
    status: status || undefined,
    companyId: companyId || undefined,
    pageNumber: page,
    pageSize: 25,
  })

  const resetTo = (update: () => void) => {
    update()
    setPage(1)
  }

  const counts = users.data?.counts

  return (
    <PlatformPage>
      <PlatformPageHeader
        title={t('Users')}
        subtitle={t('Every account on the platform, across all companies')}
      />

      {counts && (
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <KpiTile label={t('Total users')} value={formatNumber(counts.total)} icon={Users} />
          <KpiTile label={t('Active')} value={formatNumber(counts.active)} icon={UserCheck} />
          <KpiTile label={t('Suspended')} value={formatNumber(counts.suspended)} icon={UserX} />
          <KpiTile label={t('HR managers')} value={formatNumber(counts.hrManagers)} icon={UserCog} />
        </div>
      )}

      <Panel grow>
        <PanelHead className="border-b-0">
          <PanelLabel>{t('All accounts')}</PanelLabel>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-2 top-1/2 h-3 w-3 -translate-y-1/2 text-charcoal-400"
                aria-hidden="true"
              />
              <input
                className="pc-control w-44 ps-6"
                placeholder={t('Search name or email')}
                value={search}
                onChange={(event) => resetTo(() => setSearch(event.target.value))}
                aria-label={t('Search users')}
              />
            </div>
            <select
              className="pc-control w-auto"
              value={role}
              onChange={(event) => resetTo(() => setRole(event.target.value))}
              aria-label={t('Filter by role')}
            >
              <option value="">{t('All roles')}</option>
              {ROLES.map((option) => (
                <option key={option} value={option}>
                  {t(option)}
                </option>
              ))}
            </select>
            <select
              className="pc-control w-auto"
              value={status}
              onChange={(event) => resetTo(() => setStatus(event.target.value))}
              aria-label={t('Filter by status')}
            >
              <option value="">{t('Any status')}</option>
              <option value="Active">{t('Active')}</option>
              <option value="Suspended">{t('Suspended')}</option>
            </select>
            <select
              className="pc-control w-auto"
              value={companyId}
              onChange={(event) => resetTo(() => setCompanyId(event.target.value))}
              aria-label={t('Filter by company')}
            >
              <option value="">{t('Every company')}</option>
              {companies.data?.items.map((company) => (
                <option key={company.id} value={String(company.id)}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
        </PanelHead>

        {users.isPending ? (
          <PanelLoading />
        ) : users.isError ? (
          <PanelError
            title={t('Could not load the users')}
            message={describeApiError(users.error)}
            onRetry={() => void users.refetch()}
          />
        ) : users.data.items.length === 0 ? (
          <PanelEmpty icon={Users} title={t('No accounts match')} hint={t('Try clearing the filters.')} />
        ) : (
          <>
            <TableWrap>
              <PTable className="pc-table-sticky">
                <PThead>
                  <tr>
                    <PTh>{t('Name')}</PTh>
                    <PTh>{t('Role')}</PTh>
                    <PTh>{t('Companies')}</PTh>
                    <PTh>{t('Status')}</PTh>
                    <PTh>{t('Last sign-in')}</PTh>
                  </tr>
                </PThead>
                <PTbody>
                  {users.data.items.map((user) => (
                    <PTr key={user.id} onClick={() => navigate(`/platform/users/${user.id}`)}>
                      <PTd>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-charcoal-100 text-[9px] font-semibold text-charcoal-700">
                            {initialsOf(user.name) || '?'}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="block truncate text-xs font-semibold leading-tight text-charcoal-800">
                                {user.name}
                              </p>
                              {(() => {
                                const userAlerts = alertsByUser.get(user.id) ?? []
                                if (userAlerts.length === 0) return null
                                return (
                                  <span
                                    className={
                                      userAlerts.some((alert) => alert.severity === 'critical')
                                        ? 'inline-flex flex-shrink-0 items-center rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-red-600 ring-1 ring-inset ring-red-200'
                                        : 'inline-flex flex-shrink-0 items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-600 ring-1 ring-inset ring-amber-200'
                                    }
                                    title={userAlerts.map((alert) => `${alert.title} — ${alert.detail}`).join('\n')}
                                  >
                                    {userAlerts.length}
                                  </span>
                                )
                              })()}
                            </div>
                            <p className="truncate text-[10px] leading-tight text-charcoal-500">{user.email}</p>
                            {(() => {
                              const first = (alertsByUser.get(user.id) ?? [])[0]
                              if (!first) return null
                              return (
                                <p
                                  className={
                                    first.severity === 'critical'
                                      ? 'truncate text-[10px] leading-tight text-red-600'
                                      : 'truncate text-[10px] leading-tight text-amber-600'
                                  }
                                >
                                  {first.title}
                                </p>
                              )
                            })()}
                          </div>
                        </div>
                      </PTd>
                      <PTd className="whitespace-nowrap text-[11px] text-charcoal-600">{t(user.role)}</PTd>
                      <PTd className="max-w-[240px] text-[11px] text-charcoal-600">
                        <span className="block truncate">
                          {user.scope === 'AllCompanies'
                            ? t('All companies')
                            : user.companies.length > 0
                              ? user.companies.map((company) => company.name).join(', ')
                              : (user.branch ?? '—')}
                        </span>
                      </PTd>
                      <PTd>
                        <StatusBadge status={user.status} />
                      </PTd>
                      <PTd className="whitespace-nowrap text-[11px] text-charcoal-500">
                        {user.lastLoginAt ? formatDate(user.lastLoginAt) : t('Never')}
                      </PTd>
                    </PTr>
                  ))}
                </PTbody>
              </PTable>
            </TableWrap>
            <Pager
              page={users.data.page}
              pageSize={users.data.pageSize}
              total={users.data.totalCount}
              totalPages={users.data.totalPages}
              onPageChange={setPage}
              noun={t('users')}
            />
          </>
        )}
      </Panel>
    </PlatformPage>
  )
}
