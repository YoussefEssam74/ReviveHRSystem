import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserPlus, Users } from 'lucide-react'
import { Avatar } from '../../../components/ui/avatar'
import { Badge, StatusBadge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import { EmptyState } from '../../../components/ui/empty-state'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Pagination } from '../../../components/ui/pagination'
import { Table, TBody, TD, TH, THead, TR } from '../../../components/ui/table'
import { describeApiError } from '../../../lib/api-client'
import { formatDateTime } from '../../../lib/format'
import { useTeamMembers } from '../hooks/useHrTeam'
import type { TeamMember } from '../api/hr-team.api'
import { CreateUserDialog } from './CreateUserDialog'
import { ResetPasswordDialog } from './ResetPasswordDialog'
import { UserStatusDialog } from './UserStatusDialog'

const STATUS_OPTIONS = ['', 'Active', 'Suspended']

interface MembersTabProps {
  /** False = read-only (no team.manage): action buttons are not rendered. */
  canManage: boolean
}

/** Members — paged user list with create / status / reset-password actions (team.manage writes). */
export function MembersTab({ canManage }: MembersTabProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const [statusTarget, setStatusTarget] = useState<TeamMember | null>(null)
  const [resetTarget, setResetTarget] = useState<TeamMember | null>(null)

  const { data, isLoading, error } = useTeamMembers({
    search: search || undefined,
    status: status || undefined,
    page,
    pageSize: 20,
  })

  // Reset to page 1 when filters change.
  const onSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }
  const onStatus = (value: string) => {
    setStatus(value)
    setPage(1)
  }

  const statusLabel = (member: TeamMember) => (member.status === 'Active' ? t('Suspend') : t('Reactivate'))

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
        <Input
          placeholder={t('Search by name or email…')}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="sm:max-w-xs"
          aria-label={t('Search team members')}
        />
        <Select
          value={status}
          onChange={(e) => onStatus(e.target.value)}
          className="sm:w-48"
          aria-label={t('Filter by status')}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option ? t(option) : t('All statuses')}
            </option>
          ))}
        </Select>
        {canManage && (
          <Button size="sm" className="sm:ms-auto" onClick={() => setCreating(true)}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {t('Add member')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <LoadingState label={t('Loading members…')} />
      ) : error ? (
        <ErrorState message={describeApiError(error)} />
      ) : (data?.items?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Users}
          title={t('No team members found')}
          message={
            search || status
              ? t('Try adjusting your search or filters.')
              : t('Create the first HR account to start building your team.')
          }
        />
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden md:block">
            <Table>
              <THead>
                <TH>{t('Member')}</TH>
                <TH>{t('Role')}</TH>
                <TH>{t('Gyms')}</TH>
                <TH>{t('Access')}</TH>
                <TH>{t('Status')}</TH>
                <TH>{t('Last active')}</TH>
                <TH className="text-end">{t('Actions')}</TH>
              </THead>
              <TBody>
                {data!.items.map((member) => (
                  <TR key={member.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={member.initials} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{member.name}</p>
                          <p className="truncate text-xs text-slate-500">{member.email}</p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <p className="text-slate-900">{member.role}</p>
                      {member.roles.length > 1 && (
                        <p className="text-xs text-slate-500">{t('+{{count}} more', { count: member.roles.length - 1 })}</p>
                      )}
                    </TD>
                    <TD>
                      {member.gyms.length === 0 ? (
                        <span className="text-xs text-slate-400">{t('None')}</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {member.gyms.slice(0, 2).map((gym) => (
                            <Badge key={gym}>{gym}</Badge>
                          ))}
                          {member.gyms.length > 2 && <Badge>+{member.gyms.length - 2}</Badge>}
                        </div>
                      )}
                    </TD>
                    <TD className="text-slate-600">{t('{{count}} permissions', { count: member.permissionsCount })}</TD>
                    <TD>
                      <StatusBadge status={member.status} />
                    </TD>
                    <TD className="text-slate-500">{formatDateTime(member.lastLoginAt)}</TD>
                    <TD className="text-end">
                      {canManage ? (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setStatusTarget(member)}>
                            {statusLabel(member)}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setResetTarget(member)}>
                            {t('Reset password')}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">{t('View only')}</span>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          {/* Mobile: stacked cards */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {data!.items.map((member) => (
              <li key={member.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={member.initials} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{member.name}</p>
                      <p className="truncate text-xs text-slate-500">{member.email}</p>
                    </div>
                  </div>
                  <StatusBadge status={member.status} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{member.role}</span>
                  <span>{t('{{count}} permissions', { count: member.permissionsCount })}</span>
                  <span>{t('Last active {{date}}', { date: formatDateTime(member.lastLoginAt) })}</span>
                </div>
                {member.gyms.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {member.gyms.slice(0, 3).map((gym) => (
                      <Badge key={gym}>{gym}</Badge>
                    ))}
                    {member.gyms.length > 3 && <Badge>+{member.gyms.length - 3}</Badge>}
                  </div>
                )}
                {canManage && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setStatusTarget(member)}>
                      {statusLabel(member)}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setResetTarget(member)}>
                      {t('Reset password')}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <Pagination
            page={data!.page}
            pageSize={data!.pageSize}
            total={data!.total}
            totalPages={data!.totalPages}
            onPageChange={setPage}
            noun="members"
          />
        </>
      )}

      {creating && <CreateUserDialog open onClose={() => setCreating(false)} />}
      {statusTarget && <UserStatusDialog member={statusTarget} onClose={() => setStatusTarget(null)} />}
      {resetTarget && <ResetPasswordDialog member={resetTarget} onClose={() => setResetTarget(null)} />}
    </Card>
  )
}
