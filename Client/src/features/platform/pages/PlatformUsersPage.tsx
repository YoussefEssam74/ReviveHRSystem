import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
import { AttentionStrip } from '../components/AttentionStrip'
import { useCompanies, usePlatformUsers } from '../hooks/usePlatform'

const ROLES = ['HRManager', 'HR', 'BranchManager', 'TeamLeader', 'Employee']

/**
 * Platform-wide user directory.
 *
 * The HR-manager surface is its own page (`PlatformHrManagersPage`) because the
 * mock gives it a different shape: platform scope, presets and lifecycle actions.
 *
 * The search term lives in the URL so the console's header search can hand it over.
 */
export default function PlatformUsersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [page, setPage] = useState(1)

  const search = searchParams.get('q') ?? ''

  const companies = useCompanies({ pageSize: 200 })

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

  const onSearch = (value: string) => {
    setSearchParams(value ? { q: value } : {}, { replace: true })
    setPage(1)
  }

  const counts = users.data?.counts

  return (
    <PlatformPage>
      <PlatformPageHeader
        title={t('Users')}
        subtitle={t('Every account on the platform, across all companies')}
      />

      <AttentionStrip types={['SeatQuotaNearLimit', 'FailedSignInBurst']} />

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
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-2 top-1/2 h-3 w-3 -translate-y-1/2 text-charcoal-400"
                aria-hidden="true"
              />
              <input
                className="pc-control w-44 ps-6"
                placeholder={t('Search name or email')}
                value={search}
                onChange={(event) => onSearch(event.target.value)}
                aria-label={t('Search users')}
              />
            </div>
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
                            <p className="block truncate text-xs font-semibold leading-tight text-charcoal-800">
                              {user.name}
                            </p>
                            <p className="truncate text-[10px] leading-tight text-charcoal-500">{user.email}</p>
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
