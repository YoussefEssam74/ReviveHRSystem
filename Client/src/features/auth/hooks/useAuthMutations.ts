import { useMutation } from '@tanstack/react-query'
import { postLogin, postSelectGym, type LoginResponse } from '../api/auth.api'
import { useAuthSession } from '../../../contexts/AuthSessionContext'
import type { StoredSession } from '../../../lib/session-store'
import type { GymSelectionValues, LoginValues } from '../types'

const DEFAULT_EXPIRES_IN_SECONDS = 3600

function toStoredSession(response: LoginResponse): StoredSession | null {
  const user = response.user
  if (!response.accessToken || !user) return null
  return {
    accessToken: response.accessToken,
    expiresAt: Date.now() + (response.expiresInSeconds ?? DEFAULT_EXPIRES_IN_SECONDS) * 1000,
    user: {
      id: user.id ?? 0,
      email: user.email ?? '',
      userName: user.userName ?? user.email ?? 'User',
      userType: user.userType ?? 'Employee',
      gymName: user.gymName ?? null,
      gymId: user.gymId ?? null,
      gymAccess: (user.gymAccess ?? [])
        .filter((gym): gym is { gymId: number; gymName: string } => typeof gym.gymId === 'number')
        .map((gym) => ({ gymId: gym.gymId, gymName: gym.gymName ?? '' })),
    },
  }
}

/** POST /api/auth/login — single-gym users complete here; others get a gym challenge (see LoginPage). */
export function useLogin() {
  const { signIn } = useAuthSession()
  return useMutation({
    mutationFn: (values: LoginValues) => postLogin(values),
    onSuccess: (response) => {
      const session = toStoredSession(response)
      if (session) signIn(session)
    },
  })
}

/** POST /api/auth/login/select-gym — completes a multi-gym login. */
export function useSelectGym() {
  const { signIn } = useAuthSession()
  return useMutation({
    mutationFn: (values: GymSelectionValues) => postSelectGym(values),
    onSuccess: (response) => {
      const session = toStoredSession(response)
      if (session) signIn(session)
    },
  })
}
