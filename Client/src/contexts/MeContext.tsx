import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMe, postSwitchGym, type MeResponse } from '../features/console/api/console.api'
import { ApiError } from '../lib/api-client'
import { useAuthSession } from './AuthSessionContext'
import { can, type FeatureCode, type FeatureLevels } from '../lib/permissions'

interface MeContextValue {
  me: MeResponse | null
  isLoading: boolean
  error: ApiError | null
  /** Feature levels for the active gym (empty until loaded). */
  featureLevels: FeatureLevels
  /** True when the feature is granted at/above the given level in the active gym. */
  can: (feature: FeatureCode, minLevel?: number) => boolean
  /** Re-fetch /api/me (e.g. after a mutation that changes access). */
  refresh: () => void
  /** POST /api/auth/switch-gym — returns a fresh token and re-gates everything. */
  switchGym: (gymId: number) => Promise<void>
  isSwitching: boolean
}

const MeContext = createContext<MeContextValue | null>(null)

const DEFAULT_EXPIRES_IN_SECONDS = 3600

export function MeProvider({ children }: { children: ReactNode }) {
  const { session, signIn } = useAuthSession()
  const queryClient = useQueryClient()
  const [isSwitching, setIsSwitching] = useState(false)

  const authenticated = Boolean(session)

  const query = useQuery({
    queryKey: ['me'],
    queryFn: ({ signal }) => getMe(signal),
    enabled: authenticated,
    // A 401 here means the token expired; api-client renews it silently, and
    // only clears the session once the refresh credential itself is refused.
    retry: false,
    staleTime: 60_000,
  })

  // Drop cached me data whenever the user signs out (or the session is cleared).
  useEffect(() => {
    if (!authenticated) queryClient.removeQueries({ queryKey: ['me'] })
  }, [authenticated, queryClient])

  const me = query.data ?? null
  // Memoize so the object identity is stable across renders (featureLevels is a
  // fresh object literal otherwise, which defeats downstream memoization).
  const featureLevels = useMemo(() => me?.featureLevels ?? {}, [me])

  const canAccess = useCallback(
    (feature: FeatureCode, minLevel?: number) => can(featureLevels, feature, minLevel, me?.userType),
    [featureLevels, me?.userType],
  )

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['me'] })
  }, [queryClient])

  const switchGym = useCallback(
    async (gymId: number) => {
      if (!session) return
      setIsSwitching(true)
      try {
        const response = await postSwitchGym(gymId)
        // Store the rotated token scoped to the new gym — together with the
        // rotated refresh credential. Dropping the refresh token here left the
        // session unable to renew and signed the user out at access-token expiry.
        signIn({
          accessToken: response.accessToken,
          refreshToken: response.refreshToken ?? session.refreshToken,
          refreshExpiresAt: response.refreshExpiresInSeconds
            ? Date.now() + response.refreshExpiresInSeconds * 1000
            : session.refreshExpiresAt,
          expiresAt: Date.now() + (response.expiresInSeconds ?? DEFAULT_EXPIRES_IN_SECONDS) * 1000,
          user: {
            ...session.user,
            gymId: response.me.activeGym?.gymId ?? null,
            gymName: response.me.activeGym?.gymName ?? null,
          },
        })
        // Feature levels are per-gym: seed the cache from the switch response and
        // invalidate everything scoped to the old gym so lists refetch.
        queryClient.setQueryData(['me'], response.me)
        await queryClient.invalidateQueries()
      } finally {
        setIsSwitching(false)
      }
    },
    [session, signIn, queryClient],
  )

  const value = useMemo<MeContextValue>(
    () => ({
      me,
      isLoading: query.isLoading,
      error: query.error instanceof ApiError ? query.error : null,
      featureLevels,
      can: canAccess,
      refresh,
      switchGym,
      isSwitching,
    }),
    [me, query.isLoading, query.error, featureLevels, canAccess, refresh, switchGym, isSwitching],
  )

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>
}

export function useMe(): MeContextValue {
  const context = useContext(MeContext)
  if (!context) throw new Error('useMe must be used within MeProvider')
  return context
}
