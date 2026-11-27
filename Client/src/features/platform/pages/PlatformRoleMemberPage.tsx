import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Check, Search, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { describeApiError } from '../../../lib/api-client'
import { formatNumber } from '../../../lib/format'
import { useToast } from '../../../components/ui/toast'
import {
  Panel,
  PanelEmpty,
  PanelError,
  PanelHead,
  PanelLabel,
  PanelLoading,
  PlatformPage,
  PlatformPageHeader,
} from '../components/platform-ui'
import { usePermissionCatalog, useRoleMember, useSaveUserAutoApproval, useSaveUserPermissions } from '../../hr-team/hooks/useHrTeam'

/**
 * One person's access as seen through a single role.
 *
 * Gym access lists only the gyms where THIS role is held, so a Branch Manager in
 * Main Gym and Team Leader in Second Gym does not show both under one role. The
 * auto-approval switch is HR's per-person grant: a cleared desk account approves
 * requests as the final decision instead of forwarding them to HR.
 */
export default function PlatformRoleMemberPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { id: idParam, userId: userIdParam } = useParams<{ id: string; userId: string }>()
  const roleId = Number(idParam)
  const userId = Number(userIdParam)

  const member = useRoleMember(roleId, userId)
  const catalog = usePermissionCatalog()
  const savePermissions = useSaveUserPermissions(userId)
  const saveAutoApproval = useSaveUserAutoApproval(userId)

  const [directPermissions, setDirectPermissions] = useState<string[]>([])
  const [autoApproveTypes, setAutoApproveTypes] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!member.data) return
    setDirectPermissions(member.data.permissions)
    setAutoApproveTypes(Object.fromEntries(member.data.autoApproveRequestTypes.map((type) => [type.id, type.enabled])))
  }, [member.data])

  const rolePermissionSet = useMemo(() => new Set(member.data?.effectivePermissions ?? []), [member.data?.effectivePermissions])
  // Only the two desk roles can ever finalize a request, so the grant is meaningless elsewhere.
  const canAutoApprove = member.data
    ? member.data.roleName === 'Branch Manager' || member.data.roleName === 'Team Leader'
    : false

  // The matrix is laid out per portal page; the tab opens the portal this role lives in.
  const catalogPages = catalog.data?.pages ?? []
  const portals = useMemo(() => [...new Set(catalogPages.map((page) => page.portal))], [catalogPages])
  const [portalChoice, setPortalChoice] = useState<string | null>(null)
  const rolePortal = member.data?.roleName === 'Super Admin'
    ? 'Super Admin portal'
    : ['Employee', 'Team Leader', 'Branch Manager'].includes(member.data?.roleName ?? '')
      ? 'Employee portal'
      : 'HR portal'
  const activePortal = portalChoice && portals.includes(portalChoice)
    ? portalChoice
    : portals.includes(rolePortal) ? rolePortal : (portals[0] ?? '')
  const pagesOfPortal = catalogPages.filter((page) => page.portal === activePortal)

  const togglePage = (keys: string[], clear: boolean) => setDirectPermissions((current) => {
    const next = new Set(current)
    for (const key of keys) {
      if (clear) next.delete(key)
      else next.add(key)
    }
    return [...next]
  })
  const directDirty = member.data
    && (directPermissions.length !== member.data.permissions.length
      || directPermissions.some((key) => !member.data!.permissions.includes(key)))
  const autoDirty = member.data
    ? member.data.autoApproveRequestTypes.some((type) => (autoApproveTypes[type.id] ?? false) !== type.enabled)
    : false

  const togglePermission = (key: string) => setDirectPermissions((current) =>
    current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
  )

  const savePermissionDraft = () => savePermissions.mutate([...directPermissions].sort(), {
    onSuccess: () => toast(t('Permissions saved.'), 'success'),
    onError: (error) => toast(describeApiError(error), 'error'),
  })
  const saveAutoDraft = () => saveAutoApproval.mutate(autoApproveTypes, {
    onSuccess: () => toast(t('Auto-approval settings saved.'), 'success'),
    onError: (error) => toast(describeApiError(error), 'error'),
  })

  return (
    <PlatformPage>
      <PlatformPageHeader
        title={member.data?.name ?? t('Member access')}
        subtitle={
          member.data
            ? t('Access for the {{role}} role', { role: member.data.roleName })
            : t('Review and edit this person’s permissions and access.')
        }
        actions={
          <Link to={`/platform/roles/${roleId}`} className="btn btn-secondary btn-sm">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {t('Back to role')}
          </Link>
        }
      />

      {member.isPending ? (
        <Panel><PanelLoading /></Panel>
      ) : member.isError ? (
        <Panel>
          <PanelError
            title={t('Could not load this member')}
            message={describeApiError(member.error)}
            onRetry={() => void member.refetch()}
          />
        </Panel>
      ) : (
        <div className="grid min-h-0 gap-2.5 xl:grid-cols-[minmax(0,1.6fr)_minmax(250px,0.8fr)]">
          <Panel>
            <PanelHead>
              <div className="min-w-0 flex-1">
                <PanelLabel>{t('Direct permissions')}</PanelLabel>
                <p className="mt-0.5 truncate text-[9px] text-charcoal-500">
                  {member.data.email} · {t('Effective')}: {formatNumber(member.data.effectivePermissions.length)}
                </p>
              </div>
              <Button
                size="sm"
                onClick={savePermissionDraft}
                disabled={!directDirty || catalog.isPending}
                loading={savePermissions.isPending}
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {t('Save')}
              </Button>
            </PanelHead>
            {catalog.isPending ? <PanelLoading /> : catalog.isError ? (
              <PanelError
                title={t('Could not load permissions')}
                message={describeApiError(catalog.error)}
                onRetry={() => void catalog.refetch()}
              />
            ) : (
              <div className="max-h-[68vh] overflow-y-auto">
                <div className="sticky top-0 z-10 flex flex-wrap gap-1 border-b border-charcoal-100 bg-white px-3 py-2">
                  {portals.map((portal) => (
                    <button
                      key={portal}
                      type="button"
                      onClick={() => setPortalChoice(portal)}
                      className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                        activePortal === portal
                          ? 'bg-brand-600 text-white'
                          : 'bg-charcoal-50 text-charcoal-600 hover:bg-charcoal-100'
                      }`}
                    >
                      {t(portal)}
                    </button>
                  ))}
                </div>
                <div className="space-y-3 px-3 py-2">
                  <p className="text-[9px] leading-relaxed text-charcoal-500">
                    {t('Every page lists the permissions it needs. Granting a page grants its keys to this person directly; role grants stay inherited.')}
                  </p>
                  {pagesOfPortal.map((page) => {
                    const allChecked = page.permissions.every((key) => directPermissions.includes(key))
                    return (
                      <section key={`${page.portal}:${page.page}`}>
                        <div className="mb-1 flex items-center justify-between gap-2 border-b border-charcoal-100 pb-1">
                          <h3 className="text-[9px] font-bold uppercase tracking-wide text-charcoal-600">
                            {t(page.label)}
                          </h3>
                          <button
                            type="button"
                            onClick={() => togglePage(page.permissions, allChecked)}
                            className="text-[9px] font-semibold text-brand-700 hover:underline"
                          >
                            {allChecked ? t('Clear page') : t('Grant page')}
                          </button>
                        </div>
                        <div className="grid gap-0.5 sm:grid-cols-2">
                          {page.permissions.map((key) => (
                            <label key={`${page.page}:${key}`} className="flex cursor-pointer items-start gap-1.5 rounded-md px-1.5 py-1 hover:bg-charcoal-50">
                              <input
                                type="checkbox"
                                checked={directPermissions.includes(key)}
                                onChange={() => togglePermission(key)}
                                className="mt-0.5 h-3 w-3 shrink-0 accent-brand-600"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block break-all text-[9px] font-medium text-charcoal-700">{key}</span>
                                <span className="block text-[8px] text-charcoal-400">
                                  {directPermissions.includes(key)
                                    ? t('Direct grant')
                                    : rolePermissionSet.has(key) ? t('Inherited from role') : t('Not granted')}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </section>
                    )
                  })}
                </div>
              </div>
            )}
          </Panel>

          <div className="grid gap-2.5 self-start">
            <Panel>
              <PanelHead>
                <div className="min-w-0 flex-1">
                  <PanelLabel>{t('Auto-approval by request type')}</PanelLabel>
                  <p className="mt-0.5 text-[9px] text-charcoal-500">
                    {canAutoApprove
                      ? t('Choose the request types this person may approve as the final decision. Anything left on “HR decides” still goes to HR.')
                      : t('Only a Branch Manager or Team Leader can auto-approve requests.')}
                  </p>
                </div>
              </PanelHead>
              <div className="max-h-72 divide-y divide-charcoal-100 overflow-y-auto">
                {member.data.autoApproveRequestTypes.map((type) => (
                  <label
                    key={type.id}
                    className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 hover:bg-charcoal-50"
                  >
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-charcoal-700">{type.label}</span>
                    <select
                      className="pc-control max-w-[140px]"
                      value={autoApproveTypes[type.id] ? 'auto' : 'hr'}
                      disabled={!canAutoApprove}
                      onChange={(event) => setAutoApproveTypes((current) => ({
                        ...current,
                        [type.id]: event.target.value === 'auto',
                      }))}
                    >
                      <option value="hr">{t('HR decides')}</option>
                      <option value="auto">{t('Auto-approve')}</option>
                    </select>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-charcoal-100 px-3 py-2">
                <p className="text-[9px] leading-relaxed text-charcoal-500">
                  {t('Applies to Branch Managers and Team Leaders. Everyone else always forwards requests to HR.')}
                </p>
                <Button
                  size="sm"
                  onClick={saveAutoDraft}
                  disabled={!canAutoApprove || !autoDirty}
                  loading={saveAutoApproval.isPending}
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('Save')}
                </Button>
              </div>
            </Panel>

            <Panel>
              <PanelHead>
                <PanelLabel>{t('Gym access for this role')}</PanelLabel>
                <Badge color="blue">{t('Read only')}</Badge>
              </PanelHead>
              {member.data.gyms.length === 0 ? (
                <PanelEmpty
                  icon={Search}
                  title={t('No gyms for this role')}
                  hint={t('This person does not hold this role in any gym.')}
                />
              ) : (
                <ul className="divide-y divide-charcoal-100">
                  {member.data.gyms.map((gym) => (
                    <li key={gym.id} className="flex items-center gap-2 px-3 py-2">
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold text-charcoal-800">{gym.name}</span>
                        {gym.branch && <span className="block truncate text-[9px] text-charcoal-500">{gym.branch}</span>}
                      </span>
                      <Badge color="gray">{member.data.roleName}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              <p className="border-t border-charcoal-100 px-3 py-2 text-[9px] leading-relaxed text-charcoal-500">
                {t('Only the gyms where this role is held. Role assignments themselves are managed from the role’s member list.')}
              </p>
            </Panel>
          </div>
        </div>
      )}
    </PlatformPage>
  )
}
