import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import { postEndWorkspace, getCurrentWorkspace, type CurrentWorkspace } from '../api/platform.api'

/** Storage key holding the console session while a workspace is active. */
export const CONSOLE_SESSION_KEY = 'revive.console-session'

/**
 * Banner shown while a Super Admin is acting inside a gym workspace.
 *
 * It exists for two reasons: the operator must never forget which company they are
 * writing into, and the session must be closable without remembering how.
 *
 * The server parks both credentials in HttpOnly cookies; localStorage holds only
 * the non-secret UI snapshot needed to restore the console layout.
 */
export function WorkspaceBanner({ workspace, onLeave }: { workspace: CurrentWorkspace; onLeave: () => void }) {
  const { t } = useTranslation()

  const leave = async () => {
    try {
      if (workspace.sessionId) await postEndWorkspace(workspace.sessionId)
    } catch {
      // The session may already have expired; restoring the console token is still correct.
    } finally {
      const parked = localStorage.getItem(CONSOLE_SESSION_KEY)
      if (parked) {
        localStorage.setItem('revive.session', parked)
        localStorage.removeItem(CONSOLE_SESSION_KEY)
      }
      onLeave()
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <span className="min-w-0 truncate">
        {t('Acting inside {{company}}', { company: workspace.companyName ?? t('a workspace') })}
        {workspace.branchName ? ` · ${workspace.branchName}` : ''}
        {workspace.effectiveRole ? ` · ${t('as')} ${workspace.effectiveRole}` : ''}
      </span>
      <Button size="sm" variant="secondary" onClick={leave}>
        {t('Return to console')}
      </Button>
    </div>
  )
}

/** Loads the caller's workspace session, if their token carries one. */
export function useWorkspaceSession() {
  return useQuery({
    queryKey: ['platform', 'workspace-session'],
    queryFn: ({ signal }) => getCurrentWorkspace(signal),
    retry: false,
    refetchInterval: 60_000,
  })
}
