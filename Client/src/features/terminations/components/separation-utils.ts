import type { Separation } from '../api/terminations.api'

/** Per-stage palette of the pipeline board (mock _sepStageColors). */
export const STAGE_META: Record<string, { dot: string; value: string; bar: string }> = {
  Requested: { dot: 'bg-purple-500', value: 'text-purple-600', bar: 'bg-purple-500' },
  'Notice Period': { dot: 'bg-blue-500', value: 'text-blue-600', bar: 'bg-blue-500' },
  'Exit In Progress': { dot: 'bg-amber-500', value: 'text-amber-600', bar: 'bg-amber-400' },
  'Under Review': { dot: 'bg-orange-500', value: 'text-orange-600', bar: 'bg-amber-400' },
  Completed: { dot: 'bg-green-500', value: 'text-charcoal-900', bar: 'bg-green-500' },
}

const GYM_TONES = [
  'bg-purple-50 text-purple-700 ring-purple-200',
  'bg-blue-50 text-blue-700 ring-blue-200',
  'bg-amber-50 text-amber-700 ring-amber-200',
  'bg-emerald-50 text-emerald-700 ring-emerald-200',
]

/** Stable gym → colour mapping so a branch keeps its tint across columns. */
export function gymTone(gym: string): string {
  let hash = 0
  for (const char of gym) hash = (hash + char.charCodeAt(0)) % GYM_TONES.length
  return GYM_TONES[hash]
}

/** Whole days between today and the last working day (never negative). */
export function noticeDaysLeft(lastDay: string | null | undefined): number | null {
  if (!lastDay) return null
  const end = new Date(`${lastDay}T00:00:00`)
  if (Number.isNaN(end.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((end.getTime() - today.getTime()) / 86_400_000))
}

/** "BM Omar Hassan" for manager-raised cases, the plain user name otherwise. */
export function requesterLabel(separation: Separation): string {
  const name = separation.requestedByUser ?? separation.requestedBy ?? '—'
  return separation.requestedBy === 'Branch Manager' ? `BM ${name}` : name
}
