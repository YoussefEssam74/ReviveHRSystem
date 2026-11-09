import { useState } from 'react'
import { ChevronDown, ShieldCheck } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import { EmptyState } from '../../../components/ui/empty-state'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { Pagination } from '../../../components/ui/pagination'
import { cn } from '../../../lib/utils'
import { describeApiError } from '../../../lib/api-client'
import { useRoles } from '../hooks/useHrTeam'
import type { Role } from '../api/hr-team.api'
import { RolePermissionsDialog } from './RolePermissionsDialog'

interface RolesTabProps {
  /** False = read-only (no team.manage): the Configure action is hidden. */
  canManage: boolean
}

/** Roles — named permission presets with counters; expand for keys, Configure to edit (team.manage). */
export function RolesTab({ canManage }: RolesTabProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [configTarget, setConfigTarget] = useState<Role | null>(null)

  const { data, isLoading, error } = useRoles({ search: search || undefined, page, pageSize: 20 })

  return (
    <>
      <Card>
        <div className="border-b border-slate-100 p-4">
          <Input
            placeholder="Search roles by name or description…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="sm:max-w-sm"
            aria-label="Search roles"
          />
        </div>

        {isLoading ? (
          <LoadingState label="Loading roles…" />
        ) : error ? (
          <ErrorState message={describeApiError(error)} />
        ) : (data?.items?.length ?? 0) === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No roles found"
            message={search ? 'Try a different search.' : 'Roles are permission presets you can assign to members.'}
          />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {data!.items.map((role) => (
                <li key={role.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{role.name}</p>
                        {role.isEmpty && <Badge status="Pending">Empty draft</Badge>}
                        {role.isPreset && <Badge>Preset</Badge>}
                      </div>
                      {role.description && <p className="mt-0.5 text-sm text-slate-600">{role.description}</p>}
                      <p className="mt-1 text-xs text-slate-400">
                        {role.permissionsCount} permissions · {role.usersCount} users
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        aria-expanded={expandedId === role.id}
                        onClick={() => setExpandedId((current) => (current === role.id ? null : role.id))}
                      >
                        <ChevronDown
                          className={cn('h-3.5 w-3.5 transition-transform', expandedId === role.id && 'rotate-180')}
                          aria-hidden="true"
                        />
                        Permissions
                      </Button>
                      {canManage && (
                        <Button size="sm" onClick={() => setConfigTarget(role)}>
                          Configure
                        </Button>
                      )}
                    </div>
                  </div>

                  {expandedId === role.id && (
                    <div className="mt-3 rounded-xl bg-slate-50 p-3">
                      {role.permissions.length === 0 ? (
                        <p className="text-sm text-slate-500">This role grants no permissions yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {role.permissions.map((key) => (
                            <Badge key={key}>{key}</Badge>
                          ))}
                        </div>
                      )}
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
              noun="roles"
            />
          </>
        )}
      </Card>

      {configTarget && <RolePermissionsDialog role={configTarget} onClose={() => setConfigTarget(null)} />}
    </>
  )
}
