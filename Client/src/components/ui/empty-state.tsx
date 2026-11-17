import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'

export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  message?: string
  /** Optional call-to-action rendered under the message. */
  action?: React.ReactNode
}

/** Friendly "nothing here" panel for empty lists and no-result states. */
export function EmptyState({ icon: Icon = Inbox, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="mt-1 text-base font-semibold text-slate-900">{title}</h3>
      {message && <p className="max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
