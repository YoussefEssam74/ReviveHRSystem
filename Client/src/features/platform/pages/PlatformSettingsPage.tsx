import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, ShieldCheck } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { describeApiError } from '../../../lib/api-client'
import { useToast } from '../../../components/ui/toast'
import type { PlatformSettings } from '../api/platform.api'
import { Panel, PanelError, PanelHead, PanelLabel, PanelLoading, PlatformPage, PlatformPageHeader } from '../components/platform-ui'
import { AttentionStrip } from '../components/AttentionStrip'
import { usePlatformSettings, useSaveSettings } from '../hooks/usePlatform'

/** Only the security section is surfaced: the other settings groups are not actionable. */
type SecurityDraft = {
  passwordRotationDays: number
  sessionLifetimeMinutes: number
  maxFailedSignIns: number
  lockoutMinutes: number
  requireMfa: boolean
}

function draftFrom(settings: PlatformSettings): SecurityDraft {
  return {
    passwordRotationDays: settings.security.passwordRotationDays,
    sessionLifetimeMinutes: settings.security.sessionLifetimeMinutes,
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
      {hint && <span className="mt-0.5 block text-[9px] text-charcoal-400">{hint}</span>}
    </label>
  )
}

/**
 * Platform security defaults.
 *
 * The mock has no settings screen; of the settings the API stores, only these five
 * change how the platform actually behaves, so this page surfaces just them.
 */
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
    for (const key of changes) patch[key] = draft[key]
    save.mutate({ security: patch }, {
      onSuccess: () => {
        setEdited(null)
        void settings.refetch()
        toast(t('Security settings saved.'), 'success')
      },
      onError: () => toast(t('Could not save the settings.'), 'error'),
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
        title={t('Security')}
        subtitle={t('Sign-in policy that applies to every platform and HR account')}
        actions={
          <Button size="sm" onClick={onSave} loading={save.isPending} disabled={changes.length === 0}>
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            {changes.length === 0 ? t('Saved') : t('Save {{count}} change(s)', { count: changes.length })}
          </Button>
        }
      />

      <AttentionStrip types={['FailedSignInBurst']} />

      <div className="grid gap-2.5 lg:grid-cols-2">
        <Panel>
          <PanelHead>
            <PanelLabel>{t('Passwords & sessions')}</PanelLabel>
            <ShieldCheck className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
          </PanelHead>
          <div className="grid gap-2.5 px-3 py-2.5 sm:grid-cols-2">
            <Field label={t('Password rotation (days)')}>
              <input
                type="number"
                className="pc-control w-full"
                value={draft.passwordRotationDays}
                onChange={(event) => set('passwordRotationDays', Number(event.target.value))}
              />
            </Field>
            <Field label={t('Session lifetime (minutes)')}>
              <input
                type="number"
                className="pc-control w-full"
                value={draft.sessionLifetimeMinutes}
                onChange={(event) => set('sessionLifetimeMinutes', Number(event.target.value))}
              />
            </Field>
          </div>
        </Panel>

        <Panel>
          <PanelHead>
            <PanelLabel>{t('Lockout policy')}</PanelLabel>
          </PanelHead>
          <div className="grid gap-2.5 px-3 py-2.5 sm:grid-cols-2">
            <Field label={t('Max failed sign-ins')}>
              <input
                type="number"
                className="pc-control w-full"
                value={draft.maxFailedSignIns}
                onChange={(event) => set('maxFailedSignIns', Number(event.target.value))}
              />
            </Field>
            <Field label={t('Lockout duration (minutes)')}>
              <input
                type="number"
                className="pc-control w-full"
                value={draft.lockoutMinutes}
                onChange={(event) => set('lockoutMinutes', Number(event.target.value))}
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

      <Panel>
        <PanelHead>
          <PanelLabel>{t('How this applies')}</PanelLabel>
        </PanelHead>
        <ul className="space-y-1 px-3 py-2.5 text-[11px] text-charcoal-600">
          <li>{t('Lockout is enforced on the next sign-in attempt; sessions already issued keep working until they expire.')}</li>
          <li>{t('Password rotation pushes a change prompt on the next sign-in after the configured number of days.')}</li>
          <li>{t('Session lifetime caps the access token; refresh tokens keep the browser signed in without a prompt.')}</li>
        </ul>
      </Panel>
    </PlatformPage>
  )
}
