import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, KeyRound, MapPin, Smartphone, Unplug } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Modal } from '../../../components/ui/modal'
import { describeApiError } from '../../../lib/api-client'
import { useToast } from '../../../components/ui/toast'
import { formatDateTime } from '../../../lib/format'
import {
  Panel,
  PanelEmpty,
  PanelError,
  PanelHead,
  PanelLoading,
  PTbody,
  PTd,
  PTh,
  PTable,
  PThead,
  PTr,
  TableWrap,
} from './platform-ui'
import { useRevokeStationSessions, useRotateStationCode, useStationOverview } from '../hooks/usePlatform'

/** One issued code, kept only in this component so it disappears when the dialog closes. */
interface IssuedCode {
  gymName: string
  code: string
  expiresAtUtc: string | null
}

/**
 * Attendance stations across every gym.
 *
 * Enrollment codes are deliberately absent from the table: a code is a one-time
 * secret, shown only to the operator who generates it, for its five-minute life.
 * The table answers the operational questions instead — who is connected, from
 * which address/device, from where, and since when.
 */
export function StationsPanel() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const stations = useStationOverview()
  const rotate = useRotateStationCode()
  const revoke = useRevokeStationSessions()

  const [issued, setIssued] = useState<IssuedCode | null>(null)
  const [now, setNow] = useState(0)

  // Ticks once a second while the dialog is open so the countdown stays honest.
  useEffect(() => {
    if (!issued?.expiresAtUtc) return undefined
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [issued])

  const gyms = stations.data?.items ?? []

  const onGenerate = (gymId: number, gymName: string) => {
    rotate.mutate(gymId, {
      onSuccess: (code) => {
        setNow(Date.now())
        setIssued({ gymName, code: code.code, expiresAtUtc: code.expiresAtUtc })
      },
      onError: (error) => toast(describeApiError(error), 'error'),
    })
  }

  const onRevoke = (gymId: number, gymName: string) => {
    if (!window.confirm(t('Disconnect every station currently enrolled at {{gym}}?', { gym: gymName }))) return
    revoke.mutate(gymId, {
      onSuccess: (result) =>
        toast(t('Disconnected {{count}} station session(s).', { count: result.revokedCount }), 'success'),
      onError: (error) => toast(describeApiError(error), 'error'),
    })
  }

  return (
    <>
      <Panel>
        <PanelHead>
          <div className="min-w-0 flex-1">
            <p className="pc-card-label">{t('Attendance stations')}</p>
            <p className="mt-0.5 text-[10px] text-charcoal-500">
              {t('Generate a one-time code to bind a kiosk. Connected stations are listed with the address, device and location they enrolled from; disconnect anything you do not recognise.')}
            </p>
          </div>
          <Smartphone className="h-3.5 w-3.5 text-charcoal-400" aria-hidden="true" />
        </PanelHead>

        {stations.isPending ? (
          <PanelLoading />
        ) : stations.isError ? (
          <PanelError
            title={t('Could not load the stations')}
            message={describeApiError(stations.error)}
            onRetry={() => void stations.refetch()}
          />
        ) : gyms.length === 0 ? (
          <PanelEmpty icon={Smartphone} title={t('No gyms yet')} hint={t('Create a gym account to enroll a station.')} />
        ) : (
          <TableWrap>
            <PTable className="pc-table-sticky">
              <PThead>
                <tr>
                  <PTh>{t('Gym')}</PTh>
                  <PTh>{t('Connection')}</PTh>
                  <PTh>{t('Device & address')}</PTh>
                  <PTh>{t('Location')}</PTh>
                  <PTh>{t('Last connected')}</PTh>
                  <PTh className="pc-end">{t('Actions')}</PTh>
                </tr>
              </PThead>
              <PTbody>
                {gyms.map((gym) => {
                  const busy = rotate.isPending || revoke.isPending
                  const connected = gym.sessions.length > 0
                  return (
                    <PTr key={gym.gymId}>
                      <PTd>
                        <p className="text-xs font-semibold leading-tight text-charcoal-800">{gym.gymName}</p>
                        <p className="truncate text-[10px] leading-tight text-charcoal-500">
                          {[gym.companyName, gym.city].filter(Boolean).join(' · ')}
                        </p>
                      </PTd>
                      <PTd>
                        {connected ? (
                          <Badge color="green">{t('{{count}} connected', { count: gym.sessions.length })}</Badge>
                        ) : (
                          <Badge color="gray">{t('No station')}</Badge>
                        )}
                      </PTd>
                      <PTd>
                        {gym.sessions.length === 0 ? (
                          <span className="text-[11px] text-charcoal-400">—</span>
                        ) : (
                          <div className="space-y-1">
                            {gym.sessions.map((session) => (
                              <div key={session.id} className="min-w-0">
                                <p className="truncate font-mono text-[11px] font-semibold text-charcoal-800">
                                  {session.ipAddress ?? t('IP not recorded')}
                                </p>
                                <p
                                  className="max-w-[240px] truncate text-[10px] text-charcoal-500"
                                  title={session.deviceInfo ?? undefined}
                                >
                                  {session.deviceInfo ?? t('Device not recorded')}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </PTd>
                      <PTd>
                        {gym.sessions.some((session) => session.latitude !== null && session.longitude !== null) ? (
                          <div className="space-y-1">
                            {gym.sessions.map((session) =>
                              session.latitude !== null && session.longitude !== null ? (
                                <a
                                  key={session.id}
                                  href={`https://www.google.com/maps?q=${session.latitude},${session.longitude}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline"
                                >
                                  <MapPin className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                                  {session.latitude.toFixed(5)}, {session.longitude.toFixed(5)}
                                </a>
                              ) : (
                                <span key={session.id} className="block text-[10px] text-charcoal-400">
                                  {t('Location not shared')}
                                </span>
                              ),
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-charcoal-400">{t('Not shared')}</span>
                        )}
                      </PTd>
                      <PTd className="whitespace-nowrap text-[11px] text-charcoal-500">
                        {gym.lastConnectedAt ? formatDateTime(gym.lastConnectedAt) : t('Never')}
                      </PTd>
                      <PTd>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm text-charcoal-600"
                            onClick={() => onGenerate(gym.gymId, gym.gymName)}
                            disabled={busy}
                          >
                            <KeyRound className="h-3 w-3" aria-hidden="true" />
                            {t('Generate code')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
                            onClick={() => onRevoke(gym.gymId, gym.gymName)}
                            disabled={busy || !connected}
                          >
                            <Unplug className="h-3 w-3" aria-hidden="true" />
                            {t('Terminate')}
                          </button>
                        </div>
                      </PTd>
                    </PTr>
                  )
                })}
              </PTbody>
            </PTable>
          </TableWrap>
        )}
      </Panel>

      <Modal
        open={issued !== null}
        title={t('Station code')}
        subtitle={issued ? t('Enter this code on the Attendance Station page at {{gym}}.', { gym: issued.gymName }) : undefined}
        onClose={() => setIssued(null)}
        footer={
          <Button size="sm" onClick={() => setIssued(null)}>
            {t('Done')}
          </Button>
        }
      >
        {issued && (
          <div className="space-y-3 text-center">
            <p className="font-mono text-3xl font-extrabold tracking-[0.35em] text-charcoal-900">{issued.code}</p>
            <p className="text-[11px] text-charcoal-500">
              {issued.expiresAtUtc ? (
                remainingLabel(issued.expiresAtUtc, now)
              ) : (
                t('This code never expires in development seeds.')
              )}
            </p>
            <div className="flex justify-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(issued.code)
                    .then(() => toast(t('Code copied.'), 'success'))
                    .catch(() => toast(t('Copy failed — type the code manually.'), 'error'))
                }}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                {t('Copy code')}
              </Button>
            </div>
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-800">
              {t('One-time use: the code stops working as soon as one station connects, and in any case after five minutes. Generate a new one for every device.')}
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}

/** "Expires in 4:59" (or Expired) for a freshly issued code. */
function remainingLabel(expiresAtUtc: string, now: number): string {
  const remaining = Math.floor((new Date(expiresAtUtc).getTime() - Math.max(now, 0)) / 1000)
  if (now <= 0 || remaining <= 0) return 'Expired'
  return `Expires in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
}
