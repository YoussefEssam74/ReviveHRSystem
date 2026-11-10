import { common } from './ar/common'
import { shell } from './ar/shell'
import { home } from './ar/home'
import { portal } from './ar/portal'
import { console as consoleCopy } from './ar/console'
import { workflows } from './ar/workflows'
import { shellUi } from './ar/shell-ui'
import { nouns } from './ar/nouns'
import { gaps } from './ar/gaps'
import { branchActions } from './ar/branch-actions'
import { teamRequests } from './ar/team-requests'
import { teamSchedule } from './ar/team-schedule'

/**
 * Arabic resource bundle. Keys are the English source copy (see
 * `src/i18n/index.ts`), so anything not listed here falls back to English.
 * Later spreads win, so area files can refine a shared term.
 */
export const ar: Record<string, string> = {
  ...common,
  ...shell,
  ...home,
  ...shellUi,
  ...portal,
  ...consoleCopy,
  ...workflows,
  ...nouns,
  ...branchActions,
  ...teamRequests,
  ...teamSchedule,
  ...gaps,
}
