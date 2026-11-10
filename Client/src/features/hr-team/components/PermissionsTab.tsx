import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import { Card } from '../../../components/ui/card'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { describeApiError } from '../../../lib/api-client'
import { usePermissionCatalog } from '../hooks/useHrTeam'

interface PermissionsTabProps {
  /** False = read-only (no team.manage). */
  canManage: boolean
}

/**
 * Permissions — the full permission catalog grouped by area (GET /api/permissions).
 * There is no portal-wide feature×level editor endpoint; assignments are made per
 * role (Roles tab) or per member (PUT /api/users/{id}/permissions), so this view
 * stays a read-only matrix of keys.
 */
export function PermissionsTab({ canManage }: PermissionsTabProps) {
  const { t } = useTranslation()
  const { data, isLoading, error } = usePermissionCatalog()

  const descriptions = new Map<string, string | null>(
    (data?.items ?? []).map((item): [string, string | null] => [item.key, item.description]),
  )

  return (
    <Card>
      {isLoading ? (
        <LoadingState label={t('Loading permissions…')} />
      ) : error ? (
        <ErrorState message={describeApiError(error)} />
      ) : (
        <div className="space-y-6 p-4 sm:p-6">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {t('{{count}} tracked permission keys', { count: data!.totalTracked })}
            </p>
            <p className="mt-0.5 text-sm text-slate-500">
              {t(
                'The portal catalog grouped by area. Permissions are assigned per role (Roles tab) or per member — this matrix shows every key that can be granted.',
              )}
            </p>
          </div>

          {data!.modules.map((group) => (
            <section key={group.name}>
              <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.name}</h3>
                <span className="text-xs text-slate-400">{t('{{count}} keys', { count: group.permissions.length })}</span>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {group.permissions.map((key) => (
                  <li key={key} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                    <p className="break-all font-mono text-xs font-semibold text-slate-700">{key}</p>
                    {descriptions.get(key) && (
                      <p className="mt-0.5 text-xs text-slate-500">{descriptions.get(key)}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {!canManage && (
            <p className="flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-400">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t('Read-only — changing assignments requires the team.manage permission.')}
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
