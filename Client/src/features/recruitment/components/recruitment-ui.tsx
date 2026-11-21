import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../../lib/utils'

/* ==================== layout atoms ==================== */

export interface SectionLabelProps {
  count?: number
  /** Tailwind text colour for the stage (e.g. text-yellow-700). */
  tone?: string
  children: ReactNode
}

/** Small caps section heading with an optional count pill. */
export function SectionLabel({ count, tone, children }: SectionLabelProps) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <p className={cn('bento-label', tone ?? 'text-charcoal-600')}>{children}</p>
      {count != null && <span className="badge badge-gray text-[9px]">{count}</span>}
    </div>
  )
}

/** Inline explainer strip shown at the top of each lifecycle tab. */
export function HintBar({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-800">
      {children}
    </p>
  )
}

/** Empty state for a lifecycle tab — icon plus one sentence. */
export function LifecycleEmpty({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-charcoal-200 bg-white px-4 py-8 text-center">
      <Icon className="h-6 w-6 text-charcoal-300" aria-hidden="true" />
      <p className="text-xs text-charcoal-400">{children}</p>
    </div>
  )
}
