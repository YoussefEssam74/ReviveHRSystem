import type { StartWorkspaceResponse } from '../api/platform.api'

/**
 * Session switching for "Enter workspace".
 *
 * The console token is parked under `revive.console-session` while a gym-scoped
 * impersonation token is active, so "Return to console" can restore it without a
 * re-login (the same key `WorkspaceBanner` already uses).
 */
export const CONSOLE_SESSION_KEY = 'revive.console-session'

/** Non-secret description of the active workspace, used to label the banner. */
export const CONSOLE_WORKSPACE_KEY = 'revive.console-workspace'

/** The workspace session itself, kept so a boot can re-assert it (see reconcile). */
export const WORKSPACE_SESSION_KEY = 'revive.console-workspace-session'

export interface ConsoleWorkspaceInfo {
  companyName: string
  branchName: string | null
  roleName: string | null
  sessionId: number
}

export function readConsoleWorkspace(): ConsoleWorkspaceInfo | null {
  try {
    const raw = window.localStorage.getItem(CONSOLE_WORKSPACE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ConsoleWorkspaceInfo>
    return typeof parsed.companyName === 'string' ? (parsed as ConsoleWorkspaceInfo) : null
  } catch {
    return null
  }
}

/**
 * Swaps the console session for the workspace token the API just issued.
 *
 * The workspace token carries no refresh credential, so it lives exactly as long as
 * the impersonation session (the API caps it). Returning to the console restores the
 * parked token instead of asking for the password again.
 */
export function enterGymWorkspace(response: StartWorkspaceResponse) {
  const consoleSession = window.localStorage.getItem('revive.session')
  if (consoleSession) {
    window.localStorage.setItem(CONSOLE_SESSION_KEY, consoleSession)
  }

  const workspaceSession = {
    version: 2,
    accessToken: response.accessToken,
    expiresAt: Date.now() + response.expiresInSeconds * 1000,
    user: {
      id: response.actor.userId,
      email: '',
      userName: response.actor.name,
      userType: response.actor.userType,
      gymName: response.company.name,
      gymId: response.branch?.id ?? null,
    },
  }

  const serialized = JSON.stringify(workspaceSession)
  window.localStorage.setItem('revive.session', serialized)
  window.localStorage.setItem(WORKSPACE_SESSION_KEY, serialized)
  window.localStorage.setItem(
    CONSOLE_WORKSPACE_KEY,
    JSON.stringify({
      companyName: response.company.name,
      branchName: response.branch?.name ?? null,
      roleName: response.effectiveRole?.name ?? null,
      sessionId: response.sessionId,
    } satisfies ConsoleWorkspaceInfo),
  )
}

/** Restores the parked console token. Returns false when nothing was parked. */
export function returnToConsole(): boolean {
  const parked = window.localStorage.getItem(CONSOLE_SESSION_KEY)
  window.localStorage.removeItem(CONSOLE_WORKSPACE_KEY)
  window.localStorage.removeItem(WORKSPACE_SESSION_KEY)
  if (!parked) return false
  window.localStorage.setItem('revive.session', parked)
  window.localStorage.removeItem(CONSOLE_SESSION_KEY)
  return true
}

/**
 * Re-asserts the workspace session on boot.
 *
 * Swapping `revive.session` while the console page is still alive races with any
 * in-flight silent refresh there: the refresh resolves with a fresh console token
 * and overwrites the workspace one. Keeping the workspace session under its own
 * key lets the next boot put it back before `AuthSessionProvider` reads storage.
 */
export function reconcileWorkspaceSession() {
  const raw = window.localStorage.getItem(WORKSPACE_SESSION_KEY)
  if (!raw) return
  try {
    const session = JSON.parse(raw) as { accessToken?: string; expiresAt?: number }
    if (!session.accessToken || typeof session.expiresAt !== 'number' || session.expiresAt <= Date.now()) {
      window.localStorage.removeItem(WORKSPACE_SESSION_KEY)
      window.localStorage.removeItem(CONSOLE_WORKSPACE_KEY)
      return
    }
    if (window.localStorage.getItem('revive.session') !== raw) {
      window.localStorage.setItem('revive.session', raw)
    }
  } catch {
    window.localStorage.removeItem(WORKSPACE_SESSION_KEY)
    window.localStorage.removeItem(CONSOLE_WORKSPACE_KEY)
  }
}
