import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Search, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/badge'
import { describeApiError } from '../../../lib/api-client'
import { formatNumber } from '../../../lib/format'
import {
  Pager,
  Panel,
  PanelEmpty,
  PanelError,
  PanelHead,
  PanelLabel,
  PanelLoading,
  PlatformPage,
  PlatformPageHeader,
} from '../components/platform-ui'
import { getRole } from '../../hr-team/api/hr-team.api'
import { useTeamMembers } from '../../hr-team/hooks/useHrTeam'
import type { TeamMember } from '../../hr-team/api/hr-team.api'

/**
 * One role: its reach and the people who hold it.
 *
 * Per-person permissions, role-scoped gym access and the auto-approval grant live
 * on the dedicated member page so this view stays a readable roster.
 */
export default function PlatformRoleDetailPage() {
  const { t } = useTranslation()
  const { id: idParam } = useParams<{ id: string }>()
  const roleId = Number(idParam)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const role = useQuery({
    queryKey: ['platform', 'role', roleId],
    queryFn: ({ signal }) => getRole(roleId, signal),
    enabled: Number.isInteger(roleId) && roleId > 0,
  })
  const members = useTeamMembers(
    { type: 'all', roleId, search: search.trim() || undefined, page, pageSize: 20 },
    Number.isInteger(roleId) && roleId > 0,
  )

  return (
    <PlatformPage>
      <PlatformPageHeader
        title={role.data?.name ?? t('Role details')}
        subtitle={role.data?.description ?? t('Review the people who hold this role, then open one to manage their access.')}
        actions={
          <Link to="/platform/roles" className="btn btn-secondary btn-sm">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Back to roles')}
          </Link>
        }
      />

      {role.isPending ? (
        <Panel><PanelLoading /></Panel>
      ) : role.isError ? (
        <Panel>
          <PanelError
            title={t('Could not load this role')}
            message={describeApiError(role.error)}
            onRetry={() => void role.refetch()}
          />
        </Panel>
      ) : (
        <>
          <Panel>
            <PanelHead>
              <PanelLabel>{t('Role overview')}</PanelLabel>
              <Badge color={role.data.status === 'Active' ? 'green' : 'gray'}>{role.data.status}</Badge>
              <Badge color={role.data.isPreset ? 'blue' : 'gray'}>{role.data.isPreset ? t('Preset') : t('Custom')}</Badge>
            </PanelHead>
            <div className="grid grid-cols-2 gap-2 px-3 py-2 sm:grid-cols-4">
              <Summary label={t('Assigned users')} value={formatNumber(role.data.usersCount)} />
              <Summary label={t('Role permissions')} value={formatNumber(role.data.permissionsCount)} />
              <Summary label={t('Origin')} value={role.data.isPreset ? t('Preset') : t('Custom')} />
              <Summary label={t('Status')} value={t(role.data.status)} />
            </div>
          </Panel>

          <Panel grow>
            <PanelHead>
              <PanelLabel>{t('People assigned to this role')}</PanelLabel>
              <span className="text-[10px] text-charcoal-500">{formatNumber(members.data?.total ?? 0)}</span>
            </PanelHead>
            <div className="relative border-b border-charcoal-100 p-2">
              <Search
                className="pointer-events-none absolute start-4 top-1/2 h-3 w-3 -translate-y-1/2 text-charcoal-400"
                aria-hidden="true"
              />
              <input
                className="pc-control w-full ps-7"
                placeholder={t('Search people')}
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1) }}
                aria-label={t('Search people assigned to this role')}
              />
            </div>
            {members.isPending ? (
              <PanelLoading />
            ) : members.isError ? (
              <PanelError
                title={t('Could not load assigned people')}
                message={describeApiError(members.error)}
                onRetry={() => void members.refetch()}
              />
            ) : members.data.items.length === 0 ? (
              <PanelEmpty
                icon={Users}
                title={t('No assigned people')}
                hint={t('No accounts currently have this role assigned.')}
              />
            ) : (
              <>
                <ul className="divide-y divide-charcoal-100">
                  {members.data.items.map((member) => (
                    <MemberRow key={member.id} roleId={roleId} member={member} />
                  ))}
                </ul>
                <Pager
                  page={members.data.page}
                  pageSize={members.data.pageSize}
                  total={members.data.total}
                  totalPages={members.data.totalPages}
                  onPageChange={setPage}
                />
              </>
            )}
          </Panel>
        </>
      )}
    </PlatformPage>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-charcoal-50 px-2.5 py-2">
      <p className="pc-stat-label">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-charcoal-800">{value}</p>
    </div>
  )
}

function MemberRow({ roleId, member }: { roleId: number; member: TeamMember }) {
  const { t } = useTranslation()
  return (
    <li>
      <Link
        to={`/platform/roles/${roleId}/members/${member.id}`}
        className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-charcoal-50"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-semibold text-charcoal-800">{member.name}</span>
          <span className="block truncate text-[9px] text-charcoal-500">{member.email}</span>
        </span>
        <span className="text-[9px] text-charcoal-400">{t('Manage access')}</span>
        <Badge color={member.status === 'Active' ? 'green' : 'gray'}>{member.status}</Badge>
      </Link>
    </li>
  )
}
