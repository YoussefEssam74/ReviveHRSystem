import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Search, ShieldCheck } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { describeApiError } from '../../../lib/api-client'
import { formatNumber } from '../../../lib/format'
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
  PanelHead,
  PanelLabel,
  PanelLoading,
  PlatformPage,
  PlatformPageHeader,
  TableWrap,
} from '../components/platform-ui'
import { getRoles } from '../../hr-team/api/hr-team.api'

/**
 * Read-only view of the role catalogue across the platform.
 *
 * Role authoring stays in the HR console (`/console/hr-team`) — the platform
 * surface only needs to show which roles exist and how far each one reaches.
 */
export default function PlatformRolesPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const roles = useQuery({
    queryKey: ['platform', 'roles', search, page],
    queryFn: ({ signal }) => getRoles({ search: search.trim() || undefined, page, pageSize: 25 }, signal),
  })

  return (
    <PlatformPage>
      <PlatformPageHeader
        title={t('Roles & permissions')}
        subtitle={t('Every role defined on the platform and the reach of each one')}
      />

      <Panel grow>
        <PanelHead className="border-b-0">
          <PanelLabel>{t('Role catalogue')}</PanelLabel>
          <div className="relative">
            <Search
              className="pointer-events-none absolute start-2 top-1/2 h-3 w-3 -translate-y-1/2 text-charcoal-400"
              aria-hidden="true"
            />
            <input
              className="pc-control w-44 ps-6"
              placeholder={t('Search roles')}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              aria-label={t('Search roles')}
            />
          </div>
        </PanelHead>

        {roles.isPending ? (
          <PanelLoading />
        ) : roles.isError ? (
          <PanelError
            title={t('Could not load the roles')}
            message={describeApiError(roles.error)}
            onRetry={() => void roles.refetch()}
          />
        ) : roles.data.items.length === 0 ? (
          <PanelEmpty icon={ShieldCheck} title={t('No roles match')} hint={t('Try a different search.')} />
        ) : (
          <>
            <TableWrap>
              <PTable className="pc-table-sticky">
                <PThead>
                  <tr>
                    <PTh>{t('Role')}</PTh>
                    <PTh className="pc-end w-28">{t('Permissions')}</PTh>
                    <PTh className="pc-end w-32">{t('Assigned users')}</PTh>
                    <PTh className="w-24">{t('Status')}</PTh>
                    <PTh className="w-24">{t('Origin')}</PTh>
                  </tr>
                </PThead>
                <PTbody>
                  {roles.data.items.map((role) => (
                    <PTr key={role.id}>
                      <PTd>
                        <span className="block text-xs font-semibold leading-tight text-charcoal-800">{role.name}</span>
                        {role.description && (
                          <span className="block truncate text-[10px] leading-tight text-charcoal-500">
                            {role.description}
                          </span>
                        )}
                      </PTd>
                      <PTd className="pc-end whitespace-nowrap">
                        <span className="text-xs text-charcoal-700">{formatNumber(role.permissionsCount)}</span>
                        {role.isEmpty && (
                          <Badge color="yellow" className="ms-1.5">
                            {t('Empty')}
                          </Badge>
                        )}
                      </PTd>
                      <PTd className="pc-end text-xs text-charcoal-600">{formatNumber(role.usersCount)}</PTd>
                      <PTd>
                        <Badge color={role.status === 'Active' ? 'green' : 'gray'}>{role.status}</Badge>
                      </PTd>
                      <PTd className="text-[11px] text-charcoal-500">{role.isPreset ? t('Preset') : t('Custom')}</PTd>
                    </PTr>
                  ))}
                </PTbody>
              </PTable>
            </TableWrap>
            <Pager
              page={roles.data.page}
              pageSize={roles.data.pageSize}
              total={roles.data.total}
              totalPages={roles.data.totalPages}
              onPageChange={setPage}
              noun={t('roles')}
            />
          </>
        )}
      </Panel>
    </PlatformPage>
  )
}
