import { useState } from 'react'
import { Button } from '../../../components/ui/button'
import { Dialog } from '../../../components/ui/dialog'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { describeApiError } from '../../../lib/api-client'
import { usePermissionCatalog, useSetRolePermissions } from '../hooks/useHrTeam'
import type { Role } from '../api/hr-team.api'

interface RolePermissionsDialogProps {
  role: Role
  onClose: () => void
}

/** PUT /api/roles/{id}/permissions — the Configure action: wholesale replacement (team.manage). */
export function RolePermissionsDialog({ role, onClose }: RolePermissionsDialogProps) {
  const [selected, setSelected] = useState<string[]>(role.permissions)
  const [error, setError] = useState<string | null>(null)
  const catalog = usePermissionCatalog()
  const save = useSetRolePermissions(role.id)

  const toggle = (key: string) =>
    setSelected((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]))

  const onSubmit = async () => {
    setError(null)
    try {
      await save.mutateAsync(selected)
      onClose()
    } catch (err) {
      setError(describeApiError(err))
    }
  }

  const descriptions = new Map<string, string | null>(
    (catalog.data?.items ?? []).map((item): [string, string | null] => [item.key, item.description]),
  )
  const totalTracked = catalog.data?.totalTracked

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Configure — ${role.name}`}
      description={`${selected.length}${totalTracked != null ? ` of ${totalTracked}` : ''} permissions selected`}
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={save.isPending}>
            Save permissions
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

        {catalog.isLoading ? (
          <LoadingState label="Loading permission catalog…" />
        ) : catalog.error ? (
          <ErrorState message={describeApiError(catalog.error)} />
        ) : (
          <>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelected((catalog.data?.items ?? []).map((item) => item.key))}
              >
                Select all
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelected([])}>
                Clear
              </Button>
            </div>

            <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
              {(catalog.data?.modules ?? []).map((group) => (
                <section key={group.name}>
                  <h4 className="mb-1.5 border-b border-slate-100 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {group.name}
                  </h4>
                  <ul className="space-y-0.5">
                    {group.permissions.map((key) => (
                      <li key={key}>
                        <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={selected.includes(key)}
                            onChange={() => toggle(key)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-emerald-600"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-800">{key}</span>
                            {descriptions.get(key) && (
                              <span className="block text-xs text-slate-500">{descriptions.get(key)}</span>
                            )}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}
