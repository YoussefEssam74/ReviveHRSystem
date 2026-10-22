import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useAuthSession } from './AuthSessionContext'
import { getCurrentUser, getMe, postSwitchGym, type CurrentUserResponse, type GymOption, type MeResponse } from '../features/auth/api/me.api'
import { describeApiError } from '../lib/api-client'
import type { StoredSession } from '../lib/session-store'

/** Role labels as MeResponse.roleInActiveGym reports them (Shared/Authorization/RoleNames.cs). */
export const ROLE_LABEL_BRANCH_MANAGER = 'Branch Manager'
export const ROLE_LABEL_TEAM_LEADER = 'Team Leader'

export interface PortalSessionValue {
  /** GET /api/me — session contract (gym context, led team, own employee id). */
  me: MeResponse | null
  /** GET /api/auth/me — portal profile + permission keys. */
  user: CurrentUserResponse | null
  loading: boolean
  error: string | null
  reload: () => void
  /** Per-gym role data scope from /api/me. */
  isTeamLeader: boolean
  isBranchManager: boolean
  /** Permission-key check against GET /api/auth/me permissions[]. */
  can: (permissionKey: string) => boolean
  switchGym: (gymId: number) => Promise<void>
  switching: boolean
}

const PortalSessionContext = createContext<PortalSessionValue | null>(null)

export function PortalSessionProvider({ children }: { children: ReactNode }) {
  const { session, signIn } = useAuthSession()
  const queryClient = useQueryClient()

  // Keys carry the access token so a new login (new token) can never be served
  // the previous account's cached context — belt and braces behind the cache
  // purge in AuthSessionProvider. 'anon' = signed out (queries are disabled).
  const tokenScope = session?.accessToken ?? 'anon'

  const meQuery = useQuery({
    queryKey: ['portal', 'me', tokenScope],
    queryFn: ({ signal }) => getMe(signal),
    enabled: Boolean(session),
    staleTime: 60_000,
    retry: false,
  }) as UseQueryResult<MeResponse>

  const userQuery = useQuery({
    queryKey: ['portal', 'user', tokenScope],
    queryFn: ({ signal }) => getCurrentUser(signal),
    enabled: Boolean(session),
    staleTime: 60_000,
    retry: false,
  }) as UseQueryResult<CurrentUserResponse>

  const reload = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['portal'] })
  }, [queryClient])

  const switchMutation = useMutation({
    mutationFn: (gymId: number) => postSwitchGym(gymId),
    onSuccess: (response) => {
      if (!session) return
      // Persist the fresh token + session user snapshot before any refetch —
      // subsequent /api calls must carry the newly-scoped token.
      const next: StoredSession = {
        accessToken: response.accessToken,
        expiresAt: Date.now() + response.expiresInSeconds * 1000,
        user: {
          ...session.user,
          gymId: response.me.activeGym?.gymId ?? null,
          gymName: response.me.activeGym?.gymName ?? null,
          gymAccess: response.me.gyms.map((gym) => ({ gymId: gym.gymId, gymName: gym.gymName })),
        },
      }
      signIn(next)
      // signIn() above drops every ['portal'] cache entry (cross-gym stale data
      // from the old gym would otherwise serve for up to 45–60s). Seed the
      // me context under the NEW token to avoid a layout loading-flash, then
      // invalidate everything so all active portal queries refetch per gym.
      queryClient.setQueryData(['portal', 'me', next.accessToken], response.me)
      void queryClient.invalidateQueries({ queryKey: ['portal'] })
    },
  })

  const switchGym = useCallback(
    async (gymId: number) => {
      if (!session) throw new Error('No active session.')
      await switchMutation.mutateAsync(gymId)
    },
    [session, switchMutation],
  )

  const value = useMemo<PortalSessionValue>(() => {
    const me = meQuery.data ?? null
    const user = userQuery.data ?? null
    const permissions = user?.permissions ?? []
    return {
      me,
      user,
      loading: Boolean(session) && (meQuery.isLoading || userQuery.isLoading),
      error: meQuery.error ? describeApiError(meQuery.error) : userQuery.error ? describeApiError(userQuery.error) : null,
      reload,
      isTeamLeader: (me?.ledTeamId ?? null) !== null,
      isBranchManager: me?.roleInActiveGym === ROLE_LABEL_BRANCH_MANAGER,
      can: (permissionKey: string) => permissions.includes(permissionKey),
      switchGym,
      switching: switchMutation.isPending,
    }
  }, [session, meQuery, userQuery, reload, switchGym, switchMutation.isPending])

  return <PortalSessionContext.Provider value={value}>{children}</PortalSessionContext.Provider>
}

export function usePortalSession(): PortalSessionValue {
  const context = useContext(PortalSessionContext)
  if (!context) throw new Error('usePortalSession must be used inside PortalSessionProvider')
  return context
}

/** The employee id every self-service route is addressed by, or null. */
export function useOwnEmployeeId(): number | null {
  const { me } = usePortalSession()
  return me?.employeeId ?? null
}

export type GymSwitchOption = GymOption
