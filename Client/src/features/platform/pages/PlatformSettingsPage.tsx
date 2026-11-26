import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, ShieldCheck } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { describeApiError } from '../../../lib/api-client'
import { useToast } from '../../../components/ui/toast'
import type { PlatformSettings } from '../api/platform.api'
import {
  Panel,
  PanelError,
  PanelHead,
  PanelLabel,
  PanelLoading,
  PlatformPage,
  PlatformPageHeader,
} from '../components/platform-ui'
import { StationsPanel } from '../components/StationsPanel'
import { usePlatformSettings, useSaveSettings } from '../hooks/usePlatform'

/**
 * The security section is the only settings group that changes behaviour, so it is
 * the only one surfaced. 0 means "never" for the two switches that allow it, which
 * is exactly how the API stores them.
 */
type SecurityDraft = {
  passwordRotationDays: number
  sessionLifetimeDays: number
  maxFailedSignIns: number
  lockoutMinutes: number
  requireMfa: boolean
}

function draftFrom(settings: PlatformSettings): SecurityDraft {
  return {
    passwordRotationDays: settings.security.passwordRotationDays,
    // Stored in minutes; the console works in whole days.
    sessionLifetimeDays: Math.max(1, Math.ceil(settings.security.sessionLifetimeMinutes / 1440)),
    maxFailedSignIns: settings.security.maxFailedSignIns,
    lockoutMinutes: settings.security.lockoutMinutes,
    requireMfa: settings.security.requireMfa,
  }
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="pc-label">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[9px] leading-relaxed text-charcoal-400">{hint}</span>}
    </label>
  )
}

/** Small inline "Never" switch that pins its field to 0. */
function NeverToggle({
  checked,
  fallback,
  onChange,
}: {
  checked: boolean
  fallback: number
  onChange: (value: number) => void
}) {
  const { t } = useTranslation()
  return (
    <label className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-charcoal-500">
      <input
        type="checkbox"
        className="h-3 w-3 rounded border-charcoal-300 accent-brand-600"
        checked={checked}
        onChange={(event) => onChange(event.target.checked ? 0 : fallback)}
      />
      {t('Never')}
    </label>
  )
}

export default function PlatformSettingsPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const settings = usePlatformSettings()
  const save = useSaveSettings()

  // The draft is derived from the fetched settings until the operator touches a
  // field, so no effect has to sync state after the query resolves.
  const [edited, setEdited] = useState<SecurityDraft | null>(null)
  const baseline = settings.data ? draftFrom(settings.data) : null
  const draft = edited ?? baseline

  const set = <K extends keyof SecurityDraft>(key: K, value: SecurityDraft[K]) =>
    setEdited((prev) => ({ ...(prev ?? baseline ?? ({} as SecurityDraft)), [key]: value }))

  const changes =
    baseline && draft ? (Object.keys(draft) as (keyof SecurityDraft)[]).filter((key) => draft[key] !== baseline[key]) : []

  const onSave = () => {
    if (!draft || changes.length === 0) return
    const patch: Record<string, unknown> = {}
    for (const key of changes) {
      patch[key] = key === 'sessionLifetimeDays' ? draft.sessionLifetimeDays * 1440 : draft[key]
    }
    if (changes.includes('sessionLifetimeDays')) delete patch.sessionLifetimeDays
    save.mutate({ security: patch }, {
      onSuccess: () => {
        setEdited(null)
        void settings.refetch()
        toast(t('Security settings saved.'), 'success')
      },
      onError: (error) => toast(describeApiError(error), 'error'),
    })
  }

  if (settings.isPending || !draft) {
    return (
      <PlatformPage>
        <Panel>
          <PanelLoading />
        </Panel>
      </PlatformPage>
    )
  }

  if (settings.isError) {
    return (
      <PlatformPage>
        <Panel>
          <PanelError
            title={t('Could not load the security settings')}
            message={describeApiError(settings.error)}
            onRetry={() => void settings.refetch()}
          />
        </Panel>
      </PlatformPage>
    )
  }

  return (
    <PlatformPage>
      <PlatformPageHeader
        title={t('Platform settings')}
        subtitle={t('Sign-in policy that applies to every platform and HR account')}
        actions={
          <Button size="sm" onClick={onSave} loading={save.isPending} disabled={changes.length === 0}>
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            {changes.length === 0 ? t('Saved') : t('Save {{count}} change(s)', { count: changes.length })}
          </Button>
        }
      />

      <div className="grid gap-2.5 lg:grid-cols-2">
        <Panel>
          <PanelHead>
            <PanelLabel>{t('Passwords & sessions')}</PanelLabel>
            <ShieldCheck className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
          </PanelHead>
          <div className="grid gap-2.5 px-3 py-2.5 sm:grid-cols-2">
            <Field
              label={t('Require a password change every (days)')}
              hint={
                draft.passwordRotationDays === 0
                  ? t('Never — passwords stay valid until the user changes them.')
                  : t('The user is asked to set a new password after this many days (30–365).')
              }
            >
              <input
                type="number"
                min={0}
                max={365}
                className="pc-control w-full"
                value={draft.passwordRotationDays}
                onChange={(event) => set('passwordRotationDays', Number(event.target.value))}
              />
              <NeverToggle
                checked={draft.passwordRotationDays === 0}
                fallback={90}
                onChange={(value) => set('passwordRotationDays', value)}
              />
            </Field>
            <Field
              label={t('Session lifetime (days)')}
              hint={t('How long a sign-in lasts before the user must sign in again. 1–365 days.')}
            >
              <input
                type="number"
                min={1}
                max={365}
                className="pc-control w-full"
                value={draft.sessionLifetimeDays}
                onChange={(event) => set('sessionLifetimeDays', Number(event.target.value))}
              />
            </Field>
          </div>
        </Panel>

        <Panel>
          <PanelHead>
            <PanelLabel>{t('Lockout policy')}</PanelLabel>
          </PanelHead>
          <div className="grid gap-2.5 px-3 py-2.5 sm:grid-cols-2">
            <Field
              label={t('Max failed sign-ins')}
              hint={t('Wrong passwords allowed before the account locks (3–10).')}
            >
              <input
                type="number"
                min={3}
                max={10}
                className="pc-control w-full"
                value={draft.maxFailedSignIns}
                onChange={(event) => set('maxFailedSignIns', Number(event.target.value))}
              />
            </Field>
            <Field
              label={t('Lockout duration (minutes)')}
              hint={
                draft.lockoutMinutes === 0
                  ? t('Never — attempts are only recorded, the account never locks.')
                  : t('How long the account stays locked after the limit is reached.')
              }
            >
              <input
                type="number"
                min={0}
                max={1440}
                className="pc-control w-full"
                value={draft.lockoutMinutes}
                onChange={(event) => set('lockoutMinutes', Number(event.target.value))}
              />
              <NeverToggle
                checked={draft.lockoutMinutes === 0}
                fallback={20}
                onChange={(value) => set('lockoutMinutes', value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 h-3.5 w-3.5 rounded border-charcoal-300 accent-brand-600"
                  checked={draft.requireMfa}
                  onChange={(event) => set('requireMfa', event.target.checked)}
                />
                <span className="min-w-0">
                  <span className="block text-[11px] text-charcoal-700">{t('Require MFA')}</span>
                  <span className="block text-[9px] text-charcoal-400">
                    {t('Applies to platform and HR accounts.')}
                  </span>
                </span>
              </label>
            </div>
          </div>
        </Panel>
      </div>

      <StationsPanel />
    </PlatformPage>
  )
}
