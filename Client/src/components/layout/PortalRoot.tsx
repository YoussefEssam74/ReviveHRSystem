import { PortalLayout } from './PortalLayout'
import { useAuthSession } from '../../contexts/AuthSessionContext'

/**
 * The portal shell remounts per access token: every gym switch (and every
 * login) mints a fresh token, and the whole portal context — role, led team,
 * dashboards, schedules, nav badges — is per gym. A remount guarantees no
 * stale per-gym state or query params (e.g. the previous gym's team id, which
 * produced "Team not found" refetches) survive the switch.
 */
export function PortalRoot() {
  const { session } = useAuthSession()
  return <PortalLayout key={session?.accessToken ?? 'anon'} />
}
