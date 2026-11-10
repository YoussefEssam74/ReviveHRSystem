import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../../components/ui/page-header'
import { Card } from '../../../components/ui/card'
import { Avatar } from '../../../components/ui/avatar'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Select } from '../../../components/ui/select'
import { Label } from '../../../components/ui/label'
import { Table, TBody, TD, TH, THead, TR } from '../../../components/ui/table'
import { ErrorState, LoadingState } from '../../../components/async-state'
import { useMe } from '../../../contexts/MeContext'
import { describeApiError } from '../../../lib/api-client'
import { initialsOf } from '../../../lib/format'
import { EDIT, VIEW, levelOf, type FeatureCode } from '../../../lib/permissions'
import { cn } from '../../../lib/utils'
import { useGyms, useMyAccess, usePermissionCatalog } from '../hooks/useMyAccess'

/** Console features (ADR-003) rendered in the level matrix, in nav order. */
const FEATURE_ROWS: { code: FeatureCode; label: string }[] = [
  { code: 'employees', label: 'Employees' },
  { code: 'attendance', label: 'Attendance' },
  { code: 'schedule', label: 'Schedule' },
  { code: 'requests', label: 'Requests' },
  { code: 'payroll', label: 'Payroll' },
  { code: 'evaluations', label: 'Evaluations' },
  { code: 'recruitment', label: 'Recruitment' },
  { code: 'offboarding', label: 'Offboarding' },
  { code: 'documents', label: 'Documents' },
  { code: 'reports', label: 'Reports' },
  { code: 'announcements', label: 'Announcements' },
  { code: 'audit', label: 'Audit log' },
]

function levelLabel(level: number): string {
  if (level >= EDIT) return 'Edit'
  if (level >= VIEW) return 'View'
  return 'None'
}

/**
 * Palette reuse through the shared helper: "Active" = emerald, "Pending" = amber,
 * "Draft" = slate (statusBadgeClass is applied by Badge's `status` prop).
 */
function levelStatus(level: number): string {
  if (level >= EDIT) return 'Active'
  if (level >= VIEW) return 'Pending'
  return 'Draft'
}

/** My Access — self-service, read-only: identity, gym switcher, levels and permission matrix. */
export default function MyAccessPage() {
  const { t } = useTranslation()
  const { me, isLoading: meLoading, featureLevels, switchGym, isSwitching } = useMe()
  const [selectedGym, setSelectedGym] = useState<number | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)

  const profile = useMyAccess(me?.userId ?? 0)
  const catalog = usePermissionCatalog()
  const gyms = useGyms()

  // GET /api/gyms first (the switcher's canonical source), falling back to the
  // session's own gym list while it loads or if it fails.
  const gymsData = gyms.data ?? []
  const gymOptions =
    gymsData.length > 0
      ? gymsData.map((gym) => ({ id: gym.id, name: gym.name }))
      : (me?.gyms ?? []).map((gym) => ({ id: gym.gymId, name: gym.gymName }))

  const activeGymId = me?.activeGym?.gymId ?? null
  const selectedValue = selectedGym ?? activeGymId ?? gymOptions[0]?.id ?? null

  const onSwitch = async () => {
    if (selectedValue == null || selectedValue === activeGymId) return
    setSwitchError(null)
    try {
      // Reuses MeContext: rotates the token and re-gates every query.
      await switchGym(selectedValue)
    } catch (err) {
      setSwitchError(describeApiError(err))
    }
  }

  const granted = new Set(profile.data?.effectivePermissions ?? [])
  const tracked = profile.data?.trackedCount ?? 0
  const grantedCount = profile.data?.grantedCount ?? 0
  const percent = tracked > 0 ? Math.min(100, Math.round((grantedCount / tracked) * 100)) : 0

  const descriptions = new Map<string, string | null>(
    (catalog.data?.items ?? []).map((item): [string, string | null] => [item.key, item.description]),
  )

  return (
    <>
      <PageHeader title={t('My Access')} description={t('Your role, gyms, and access levels for the active gym')} />

      {meLoading || !me ? (
        <Card>
          {meLoading ? (
            <LoadingState label={t('Loading your profile…')} />
          ) : (
            <ErrorState message={t('Your session could not be loaded. Please sign in again.')} />
          )}
        </Card>
      ) : (
        <>
          {/* Identity + gym switcher */}
          <Card className="mb-4">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={initialsOf(me.userName)} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-slate-900">{me.userName}</p>
                  <p className="truncate text-sm text-slate-500">{me.email}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                      {profile.data?.role ?? me.roleInActiveGym ?? me.userType}
                    </Badge>
                    <Badge>{me.activeGym?.gymName ?? t('No active gym')}</Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-end gap-2">
                <div>
                  <Label htmlFor="my-access-gym" className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('Active gym')}
                  </Label>
                  <Select
                    id="my-access-gym"
                    aria-label={t('Select gym')}
                    className="sm:w-56"
                    value={String(selectedValue ?? '')}
                    onChange={(e) => setSelectedGym(Number(e.target.value))}
                    disabled={isSwitching || gymOptions.length === 0}
                  >
                    {gymOptions.length === 0 && <option value="">{t('No gyms available')}</option>}
                    {gymOptions.map((gym) => (
                      <option key={gym.id} value={gym.id}>
                        {gym.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  variant="outline"
                  onClick={onSwitch}
                  loading={isSwitching}
                  disabled={selectedValue == null || selectedValue === activeGymId}
                >
                  {t('Switch')}
                </Button>
              </div>
            </div>
            {switchError && (
              <p role="alert" className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {switchError}
              </p>
            )}
          </Card>

          {/* Access summary + assigned gyms */}
          <Card className="mb-4">
            {profile.isLoading ? (
              <LoadingState label={t('Loading your access…')} />
            ) : profile.error ? (
              <ErrorState message={describeApiError(profile.error)} />
            ) : (
              <div className="space-y-4 p-4">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{t('Permission access')}</p>
                      <p className="text-sm text-slate-500">
                        {t('{{granted}} of {{tracked}} tracked permissions granted', { granted: grantedCount, tracked })}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-700">{percent}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">
                    {t('{{direct}} direct · {{effective}} effective (including your role)', {
                      direct: profile.data?.permissions.length ?? 0,
                      effective: profile.data?.effectivePermissions.length ?? 0,
                    })}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('Assigned gyms')}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(profile.data?.gyms ?? []).map((gym) => (
                      <Badge key={gym.id}>
                        {gym.name}
                        {gym.branch ? ` · ${gym.branch}` : ''}
                      </Badge>
                    ))}
                    {profile.data && profile.data.gyms.length === 0 && (
                      <span className="text-sm text-slate-500">{t('No gyms assigned to your account.')}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Feature access levels (None / View / Edit) */}
          <Card className="mb-4">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold text-slate-900">{t('Feature access')}</h2>
              <p className="text-xs text-slate-500">
                {me.activeGym
                  ? t('Your access level per console feature at {{gym}}.', { gym: me.activeGym.gymName })
                  : t('Your access level per console feature.')}
              </p>
            </div>
            <div className="hidden md:block">
              <Table>
                <THead>
                  <TH>{t('Feature')}</TH>
                  <TH>{t('Access level')}</TH>
                </THead>
                <TBody>
                  {FEATURE_ROWS.map((row) => {
                    const level = levelOf(featureLevels, row.code)
                    return (
                      <TR key={row.code}>
                        <TD className="font-medium text-slate-900">{t(row.label)}</TD>
                        <TD>
                          <Badge status={levelStatus(level)}>{t(levelLabel(level))}</Badge>
                        </TD>
                      </TR>
                    )
                  })}
                </TBody>
              </Table>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
              {FEATURE_ROWS.map((row) => {
                const level = levelOf(featureLevels, row.code)
                return (
                  <li key={row.code} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-sm font-medium text-slate-900">{t(row.label)}</span>
                    <Badge status={levelStatus(level)}>{t(levelLabel(level))}</Badge>
                  </li>
                )
              })}
            </ul>
          </Card>

          {/* Permission matrix (catalog-backed, granted vs not granted) */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">{t('Permission detail')}</h2>
                <p className="text-xs text-slate-500">{t('Every tracked permission key and whether it is granted to you.')}</p>
              </div>
              {profile.data && (
                <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                  {grantedCount} / {tracked}
                </Badge>
              )}
            </div>

            {catalog.isLoading ? (
              <LoadingState label={t('Loading permissions…')} />
            ) : catalog.error ? (
              // team.view is required for the full catalog — degrade to your granted set.
              <div className="space-y-3 p-4">
                <p className="text-sm text-slate-500">
                  {t('The full catalog needs the team.view permission — showing your effective permissions instead.')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(profile.data?.effectivePermissions ?? []).map((key) => (
                    <Badge key={key} status="Active">
                      {key}
                    </Badge>
                  ))}
                </div>
                {profile.data && profile.data.effectivePermissions.length === 0 && (
                  <p className="text-sm text-slate-500">{t('No permissions are granted to your account.')}</p>
                )}
              </div>
            ) : (
              <div className="space-y-5 p-4">
                {(catalog.data?.modules ?? []).map((group) => {
                  const groupGranted = group.permissions.filter((key) => granted.has(key)).length
                  return (
                    <section key={group.name}>
                      <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.name}</h3>
                        <span className="text-xs text-slate-400">
                          {t('{{granted}} of {{total}} granted', { granted: groupGranted, total: group.permissions.length })}
                        </span>
                      </div>
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {group.permissions.map((key) => {
                          const isGranted = granted.has(key)
                          return (
                            <li
                              key={key}
                              className={cn(
                                'rounded-xl border px-3 py-2',
                                isGranted ? 'border-emerald-100 bg-emerald-50/60' : 'border-slate-100 bg-slate-50',
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="min-w-0 break-all font-mono text-xs font-semibold text-slate-700">
                                  {key}
                                </span>
                                <Badge status={isGranted ? 'Active' : 'Draft'} className="shrink-0">
                                  {isGranted ? t('Granted') : t('None')}
                                </Badge>
                              </div>
                              {descriptions.get(key) && (
                                <p className="mt-1 text-xs text-slate-500">{descriptions.get(key)}</p>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </section>
                  )
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </>
  )
}
