import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Check, Search, Users } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { Avatar } from '../../../components/ui/avatar'
import { describeApiError } from '../../../lib/api-client'
import { cn } from '../../../lib/utils'
import { useMe } from '../../../contexts/MeContext'
import { getEmployees, type EmployeeListItem } from '../../employees/api/employees.api'
import { useAssignRole, useCreateTeam, useRoles, useTeamMembers } from '../hooks/useHrTeam'
import type { TeamMember } from '../api/hr-team.api'

interface AssignRoleDialogProps {
  open: boolean
  onClose: () => void
  /** Called after a team was created so the page can toast the assignment. */
  onTeamCreated?: (name: string, members: number) => void
}

/** Every active employee of the active gym, for the team picker. */
async function fetchGymRoster(signal: AbortSignal): Promise<EmployeeListItem[]> {
  const pageSize = 100
  const first = await getEmployees({ page: 1, pageSize, status: 'Active' }, signal)
  const rows = [...first.items]
  for (let page = 2; page <= first.totalPages; page++) {
    const next = await getEmployees({ page, pageSize, status: 'Active' }, signal)
    rows.push(...next.items)
  }
  return rows
}

/**
 * Assign a role to an existing member (PUT /api/users/{id}/roles) — this page
 * changes access, it does not create accounts. Choosing "Team Leader" also opens
 * the team setup, so the leader leaves the dialog with a real team
 * (POST /api/teams) built from the gym's employees.
 */
export function AssignRoleDialog({ open, onClose, onTeamCreated }: AssignRoleDialogProps) {
  const { t } = useTranslation()
  const { me } = useMe()
  const [memberQuery, setMemberQuery] = useState('')
  const [target, setTarget] = useState<TeamMember | null>(null)
  const [rolePreset, setRolePreset] = useState('')
  const [teamName, setTeamName] = useState('')
  const [memberIds, setMemberIds] = useState<number[]>([])
  const [rosterSearch, setRosterSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const members = useTeamMembers({ page: 1, pageSize: 100, type: 'all' }, open)
  const roles = useRoles({ pageSize: 100 }, open)
  const assignRole = useAssignRole()
  const createTeam = useCreateTeam()

  const isTeamLeader = rolePreset.trim().toLowerCase() === 'team leader'

  // Super Admin rows are platform-managed and never reassigned from here.
  const candidates = useMemo(() => {
    const rows = members.data?.items ?? []
    const term = memberQuery.trim().toLowerCase()
    return rows
      .filter(
        (row) =>
          ![row.role, ...row.roles].some((role) => {
            const value = (role ?? '').toLowerCase()
            return value.includes('super admin') || value === 'topmanagement' || value === 'top management'
          }),
      )
      .filter((row) =>
        term === '' || [row.name, row.email, row.role].some((value) => value.toLowerCase().includes(term)),
      )
  }, [members.data, memberQuery])

  const roster = useQuery({
    queryKey: ['hr-team', 'roster'],
    queryFn: ({ signal }) => fetchGymRoster(signal),
    enabled: open && isTeamLeader,
    staleTime: 60_000,
  })

  const visibleRoster = useMemo(() => {
    const rows = roster.data ?? []
    const term = rosterSearch.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((row) =>
      [row.name, row.employeeNumber, row.position]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    )
  }, [roster.data, rosterSearch])

  const busy = assignRole.isPending || createTeam.isPending
  const valid = target != null && rolePreset.trim().length > 0 && (!isTeamLeader || teamName.trim().length > 0)

  const toggleMember = (id: number) =>
    setMemberIds((current) => (current.includes(id) ? current.filter((memberId) => memberId !== id) : [...current, id]))

  const onSubmit = async () => {
    if (!valid || !target) return
    setError(null)
    try {
      await assignRole.mutateAsync({ id: target.id, rolePreset: rolePreset.trim() })
      if (isTeamLeader) {
        await createTeam.mutateAsync({
          name: teamName.trim(),
          leaderUserId: target.id,
          memberEmployeeIds: memberIds,
        })
        onTeamCreated?.(teamName.trim(), memberIds.length)
      }
      onClose()
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('Assign a role')}
      description={t('Change what an existing member can do — accounts are never created here.')}
      className="max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={onSubmit} loading={busy} disabled={!valid}>
            {isTeamLeader ? t('Assign role & team') : t('Assign role')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div>
          <Label>{t('Member')}</Label>
          <p className="mt-0.5 text-[11px] text-charcoal-500">
            {t('Any user of this gym — an employee can be promoted to a role here.')}
          </p>
          <div className="relative mt-1.5">
            <Search
              className="pointer-events-none absolute inset-y-0 start-2.5 my-auto h-3.5 w-3.5 text-charcoal-400"
              aria-hidden="true"
            />
            <Input
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder={t('Search by name, email or role…')}
              aria-label={t('Search members')}
              className="h-9 ps-8 text-xs"
            />
          </div>

          {members.isLoading ? (
            <p className="mt-1.5 text-xs text-charcoal-500">{t('Loading members…')}</p>
          ) : members.error ? (
            <p className="mt-1.5 text-xs text-red-600">{describeApiError(members.error)}</p>
          ) : candidates.length === 0 ? (
            <p className="mt-1.5 rounded-lg border border-charcoal-200 px-3 py-3 text-center text-xs text-charcoal-500">
              {t('No users match this search.')}
            </p>
          ) : (
            <ul className="mt-1.5 max-h-44 space-y-1 overflow-y-auto rounded-lg border border-charcoal-200 p-1.5">
              {candidates.map((member) => {
                const selected = target?.id === member.id
                return (
                  <li key={member.id}>
                    <button
                      type="button"
                      onClick={() => setTarget(member)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-xs transition-colors',
                        selected ? 'bg-brand-50 text-charcoal-900 ring-1 ring-brand-300' : 'hover:bg-charcoal-50',
                      )}
                    >
                      <Avatar name={member.initials} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-charcoal-900">{member.name}</span>
                        <span className="block truncate text-[10px] text-charcoal-400">
                          {member.email} · {member.role}
                        </span>
                      </span>
                      {selected && <Check className="h-3.5 w-3.5 flex-shrink-0 text-brand-600" aria-hidden="true" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="assign-role">{t('New role')}</Label>
            <Select id="assign-role" value={rolePreset} onChange={(e) => setRolePreset(e.target.value)}>
              <option value="">{t('Select a role…')}</option>
              {(roles.data?.items ?? []).map((role) => (
                <option key={role.id} value={role.name}>
                  {role.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="rounded-lg bg-charcoal-50 px-3 py-2 text-[11px] text-charcoal-500">
            {t('The role replaces the member’s current role preset; direct permissions are kept.')}
            {me?.activeGym ? ` · ${me.activeGym.gymName}` : ''}
          </div>
        </div>

        {isTeamLeader && (
          <section className="rounded-xl border border-brand-200 bg-brand-50/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-brand-700" aria-hidden="true" />
                <p className="text-xs font-bold text-charcoal-900">{t('Team for this leader')}</p>
                <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-800">
                  {memberIds.length} {t('selected')}
                </span>
              </div>
              <span className="text-[10px] text-charcoal-500">
                {t('Employees of {{gym}} only', { gym: me?.activeGym?.gymName ?? t('the active gym') })}
              </span>
            </div>

            <div className="mt-2.5">
              <Label htmlFor="team-name">{t('Team name')}</Label>
              <Input
                id="team-name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder={t('e.g. Morning Shift Floor Team')}
              />
            </div>

            <div className="mt-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-charcoal-700">
                  {t('Employees to assign')}
                  <span className="ms-1 text-[10px] font-normal text-charcoal-400">
                    {t('({{count}} in this gym)', { count: roster.data?.length ?? 0 })}
                  </span>
                </p>
                <div className="relative w-full sm:w-56">
                  <Search
                    className="pointer-events-none absolute inset-y-0 start-2 my-auto h-3.5 w-3.5 text-charcoal-400"
                    aria-hidden="true"
                  />
                  <Input
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder={t('Search employees…')}
                    aria-label={t('Search employees…')}
                    className="h-8 ps-7 text-xs"
                  />
                </div>
              </div>

              {roster.isLoading ? (
                <p className="mt-1.5 text-xs text-charcoal-500">{t('Loading employees…')}</p>
              ) : roster.error ? (
                <p className="mt-1.5 text-xs text-red-600">{describeApiError(roster.error)}</p>
              ) : visibleRoster.length === 0 ? (
                <p className="mt-1.5 rounded-lg border border-charcoal-200 bg-white px-3 py-3 text-center text-xs text-charcoal-500">
                  {t('No employees match this search.')}
                </p>
              ) : (
                <ul className="mt-1.5 grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-charcoal-200 bg-white p-1.5 sm:grid-cols-2">
                  {visibleRoster.map((employee) => {
                    const checked = memberIds.includes(employee.id)
                    return (
                      <li key={employee.id}>
                        <label
                          className={cn(
                            'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                            checked ? 'bg-brand-50 text-charcoal-900' : 'text-charcoal-700 hover:bg-charcoal-50',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleMember(employee.id)}
                            className="h-3.5 w-3.5 rounded border-charcoal-300 accent-brand-600"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{employee.name}</span>
                            <span className="block truncate text-[10px] text-charcoal-400">
                              {employee.employeeNumber} · {employee.position}
                            </span>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
              {memberIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMemberIds([])}
                  className="mt-1.5 text-[10px] font-semibold text-charcoal-500 hover:text-red-600"
                >
                  {t('Clear selection')}
                </button>
              )}
            </div>
          </section>
        )}

        <p className="rounded-lg bg-charcoal-50 px-3 py-2 text-[11px] text-charcoal-500">
          {t('Only members of this gym can be listed. Super Admin accounts are managed by the platform team.')}
        </p>
      </div>
    </Dialog>
  )
}
