import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, KeyRound, RefreshCw } from 'lucide-react'
import { useAuthSession } from '../../../contexts/AuthSessionContext'
import { ApiError, describeApiError } from '../../../lib/api-client'
import { Button } from '../../../components/ui/button'
import { Label } from '../../../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card'
import { getStationCode, rotateStationCode } from '../api/attendance.api'

/**
 * HR/TopManagement station-code management: view the gym's active 6-digit code
 * or rotate it (the old code stops working immediately, so connected stations
 * must re-login). This code is what a station exchanges for its gym-bound
 * token via POST /api/kiosk/login — there are no hardcoded codes anywhere.
 */
export default function StationCodePage() {
  const { session } = useAuthSession()
  const queryClient = useQueryClient()
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')

  const gyms = session?.user.gymAccess ?? []
  const defaultGymId = session?.user.gymId ?? gyms[0]?.gymId ?? 0
  const [selectedGymId, setSelectedGymId] = useState<number | null>(null)
  // Falls back to the session's gym until the user picks another one.
  const gymId = selectedGymId ?? defaultGymId

  const currentCode = useQuery({
    queryKey: ['station-code', gymId],
    queryFn: () => getStationCode(gymId),
    enabled: Boolean(session) && gymId > 0,
    retry: false,
  })

  const rotate = useMutation({
    mutationFn: () => rotateStationCode(gymId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['station-code', gymId], updated)
      setCopyState('idle')
    },
  })

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

  const code = currentCode.data?.code ?? null
  const notFound = currentCode.error instanceof ApiError && currentCode.error.status === 404

  const onCopy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      // Clipboard unavailable (permissions) — the code is visible anyway.
    }
  }

  const onRotate = () => {
    // Rotating immediately invalidates the code stations are using.
    if (window.confirm('Generate a new station code? The current code stops working immediately and connected stations must reconnect.')) {
      rotate.mutate()
    }
  }

  const errorMessage = currentCode.error && !notFound ? describeApiError(currentCode.error) : null

  return (
    <StationCodeShell>
      <Card>
        <CardHeader>
          <CardTitle>Station code</CardTitle>
          <CardDescription>
            Enter this six-digit code on an attendance station to connect it to this gym. The code can be
            exchanged once per connection for a gym-bound station token.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {gyms.length > 1 && (
            <div>
              <Label htmlFor="station-code-gym">Gym</Label>
              <select
                id="station-code-gym"
                value={gymId}
                onChange={(event) => {
                  setSelectedGymId(Number(event.target.value))
                  rotate.reset()
                }}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {gyms.map((gym) => (
                  <option key={gym.gymId} value={gym.gymId}>
                    {gym.gymName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {errorMessage && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          )}

          {rotate.error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {describeApiError(rotate.error)}
            </p>
          )}

          {currentCode.isPending && gymId > 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Loading station code…</p>
          ) : notFound || !code ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center">
              <KeyRound className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold text-slate-700">No active station code</p>
              <p className="mt-1 text-xs text-slate-500">Generate one to connect an attendance station.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-5 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Active code</p>
              <p
                className="mt-2 font-mono text-4xl font-bold tracking-[0.3em] text-slate-900"
                aria-label={`Station code ${code.split('').join(' ')}`}
              >
                {code}
              </p>
              {currentCode.data?.generatedAt && (
                <p className="mt-2 text-xs text-slate-500">
                  Generated {new Date(currentCode.data.generatedAt).toLocaleString()}
                </p>
              )}
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void onCopy()}>
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
              </Button>
            </div>
          )}

          <Button size="lg" className="w-full" loading={rotate.isPending} onClick={onRotate}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {code ? 'Generate new code' : 'Generate code'}
          </Button>
        </CardContent>
      </Card>
    </StationCodeShell>
  )
}

function StationCodeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="mb-8 text-center">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <KeyRound className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Attendance station code</h1>
        <p className="mt-1 text-sm text-slate-500">Connect attendance stations to a gym with a generated code.</p>
      </div>
      {children}
    </div>
  )
}
