import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Check, Copy, ExternalLink, Smartphone, Unplug, Zap } from 'lucide-react'
import { useAuthSession } from '../../../contexts/AuthSessionContext'
import { describeApiError } from '../../../lib/api-client'
import { Button } from '../../../components/ui/button'
import { Label } from '../../../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card'
import { rotateStationCode, revokeStationSessions } from '../api/attendance.api'

/**
 * HR/TopManagement station-code management: generate a short-lived 6-digit
 * enrollment code for a gym (expires after the configured lifetime - 5 minutes
 * by default). Rotating invalidates the old code immediately, while already
 * enrolled stations keep working until their session expires or is disconnected
 * here. This code is what a station exchanges once for a station session via
 * POST /api/kiosk/login - there are no hardcoded codes anywhere.
 *
 * No code is fetched on mount: the page only ever shows a code this user just
 * generated, so a previously issued (possibly already redeemed) code is never
 * left sitting on screen.
 */
export default function StationCodePage() {
  const { session } = useAuthSession()
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')

  const gyms = session?.user.gymAccess ?? []
  const defaultGymId = session?.user.gymId ?? gyms[0]?.gymId ?? 0
  const [selectedGymId, setSelectedGymId] = useState<number | null>(null)
  // Falls back to the session's gym until the user picks another one.
  const gymId = selectedGymId ?? defaultGymId

  const rotate = useMutation({
    mutationFn: () => rotateStationCode(gymId),
    onSuccess: () => setCopyState('idle'),
  })

  const revoke = useMutation({
    mutationFn: () => revokeStationSessions(gymId),
  })

  const generated = rotate.data ?? null

  // Ticks once a second so the countdown badge stays honest while the card is up.
  // `now` stays 0 until the first tick; the badge falls back to the static
  // lifetime label for that one second rather than seeding state during render.
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (!generated?.expiresAtUtc) return undefined
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [generated?.expiresAtUtc])

  const expiresInLabel = useMemo(
    () => formatRemaining(generated?.expiresAtUtc ?? undefined, now),
    [generated?.expiresAtUtc, now],
  )

  if (!session) return <Navigate to="/login" replace />

  // Employees never see this page; the API enforces access too.
  if (session.user.userType !== 'HR' && session.user.userType !== 'TopManagement') {
    return <Navigate to="/dashboard" replace />
  }

  if (gymId === 0) {
    return (
      <StationCodeShell>
        <Card>
          <CardHeader>
            <CardTitle>No gym assigned</CardTitle>
            <CardDescription>Your account is not linked to a gym, so there is no station code to show.</CardDescription>
          </CardHeader>
        </Card>
      </StationCodeShell>
    )
  }

  const code = generated?.code ?? null
  const gymName = gyms.find((gym) => gym.gymId === gymId)?.gymName ?? generated?.gymName ?? 'this gym'
  const expired = expiresInLabel === null ? false : expiresInLabel.startsWith('expired')

  const onCopy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      // Clipboard unavailable (permissions) - the code is visible anyway.
    }
  }

  const onGenerate = () => {
    // Rotating immediately invalidates the code stations would redeem next.
    if (window.confirm('Generate a new station code? Any previous code stops working immediately.')) {
      rotate.mutate()
    }
  }

  const onRevokeSessions = () => {
    if (
      window.confirm(
        `Disconnect every station currently enrolled with ${gymName} only? Other branches are unaffected, and these stations will have to enter a new code.`,
      )
    ) {
      revoke.mutate()
    }
  }

  return (
    <StationCodeShell>
      <Card>
        <CardHeader>
          <CardTitle>Station code</CardTitle>
          <CardDescription>
            Generate a six-digit code for a gym branch. The terminal computer at the gym enters this
            code on the Attendance Station page, which binds it to that branch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Smartphone className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900">Authorize attendance kiosk terminal</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                Generate a secure 6-digit code for a gym branch. The terminal computer at the gym will
                enter this code on the Attendance Station page to bind itself strictly to that gym branch.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="station-code-gym">Target gym branch</Label>
            <select
              id="station-code-gym"
              value={gymId}
              onChange={(event) => {
                setSelectedGymId(Number(event.target.value))
                // A code belongs to one gym only; drop whatever was on screen for the last one.
                rotate.reset()
                revoke.reset()
                setCopyState('idle')
              }}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              {gyms.map((gym) => (
                <option key={gym.gymId} value={gym.gymId}>
                  {gym.gymName} (Branch ID: {gym.gymId})
                </option>
              ))}
            </select>
          </div>

          {rotate.error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {describeApiError(rotate.error)}
            </p>
          )}

          <Button size="lg" className="w-full" loading={rotate.isPending} onClick={onGenerate}>
            <Zap className="h-4 w-4" aria-hidden="true" />
            Generate 6-digit pairing code
          </Button>

          {code && (
            <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-4 text-center text-white shadow-xl">
              <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1 font-semibold text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                  {gymName}
                </span>
                <span className="font-mono text-slate-400">
                  {expired ? 'Expired' : `Valid for ${expiresInLabel ?? DEFAULT_EXPIRY_HINT}`}
                </span>
              </div>

              <div className="my-3 flex items-center justify-center">
                <span
                  className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 font-mono text-3xl font-extrabold tracking-widest text-white shadow-inner sm:text-4xl"
                  aria-label={`Station code ${code.split('').join(' ')}`}
                >
                  {code}
                </span>
              </div>

              {generated?.generatedAt && (
                <p className="text-[11px] text-slate-300">
                  Generated {new Date(generated.generatedAt).toLocaleString()}
                </p>
              )}
              <p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-slate-300">
                Open the Attendance Station on the branch computer and enter this code to bind it
                specifically to <strong className="text-white">{gymName}</strong>.
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => void onCopy()}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                >
                  {copyState === 'copied' ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      Copy code
                    </>
                  )}
                </button>
                <a
                  href="/attendance"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  Open attendance station
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          )}

          <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
            <p className="font-bold text-slate-800">Branch geofence security rules:</p>
            <ul className="list-inside list-disc space-y-0.5">
              <li>Once connected, the station only shows employees assigned to this gym.</li>
              <li>Employees from another branch are refused at the terminal.</li>
              <li>If the computer breaks down, generate a new code here and pair the replacement PC.</li>
            </ul>
          </div>

          {revoke.data && (
            <p role="status" className="text-center text-xs text-slate-500">
              Disconnected {revoke.data.revokedCount} station session
              {revoke.data.revokedCount === 1 ? '' : 's'} at {gymName}.
            </p>
          )}
          {revoke.error && (
            <p role="alert" className="text-center text-xs text-red-600">
              {describeApiError(revoke.error)}
            </p>
          )}

          <Button variant="outline" className="w-full" loading={revoke.isPending} onClick={onRevokeSessions}>
            <Unplug className="h-4 w-4" aria-hidden="true" />
            Disconnect stations at {gymName}
          </Button>
        </CardContent>
      </Card>
    </StationCodeShell>
  )
}

/** Marketing-free fallback when the server did not report an expiry (never expires). */
const DEFAULT_EXPIRY_HINT = '5 minutes'

/** "4:32" until the code stops being accepted; null when it never expires. */
function formatRemaining(expiresAtUtc: string | undefined, now: number): string | null {
  if (!expiresAtUtc) return null
  // `now` is seeded by the ticking effect one tick after the code lands; until
  // then report no countdown so the badge falls back to the static lifetime.
  if (now <= 0) return null
  const remainingMs = new Date(expiresAtUtc).getTime() - now
  if (remainingMs <= 0) return 'expired - generate a new code'
  const totalSeconds = Math.floor(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function StationCodeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="mb-8 text-center">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <Zap className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Authorize attendance kiosk</h1>
        <p className="mt-1 text-sm text-slate-500">Pair an attendance station to a gym branch with a one-time code.</p>
      </div>
      {children}
    </div>
  )
}
