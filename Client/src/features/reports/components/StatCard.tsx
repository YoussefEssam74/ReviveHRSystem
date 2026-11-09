import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '../../../components/ui/card'

export interface StatCardProps {
  icon: LucideIcon
  label: string
  /** Pre-formatted display value (use toLocaleString / formatMoney upstream). */
  value: string
  hint?: string | null
}

/** Compact metric tile for the reports overview (dashboard KPI style). */
export function StatCard({ icon: Icon, label, value, hint }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          <p className="truncate text-sm text-slate-500">{label}</p>
          {hint && <p className="truncate text-xs text-slate-400">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
