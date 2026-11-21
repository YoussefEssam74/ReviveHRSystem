/** Shared display helpers for the Evaluations screens (Mock UI/HR pages-evaluations.js). */

/** Score → mock colour bands (≥75 green, ≥60 yellow, else red). */
export function scoreTone(score: number | null | undefined): string {
  if (score == null) return 'text-charcoal-500'
  return score >= 75 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'
}

export function scoreBarTone(score: number): string {
  return score >= 75 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
}

/** Active/Open read as live; everything else is archived. */
export function formStatusClass(status: string): string {
  return status === 'Active' || status === 'Open' ? 'badge-success' : 'badge-gray'
}

/** The builder's question-kind label ("Open Question" / "Choose Option" / "Checkboxes"). */
export function questionTypeLabel(type: string | null | undefined): string {
  const normalized = (type ?? '').toLowerCase()
  if (normalized === 'checkbox') return 'Checkboxes'
  if (normalized === 'choose' || normalized === 'multiplechoice') return 'Choose Option'
  return 'Open Question'
}

/** Kind badge colour: brand for evaluation, blue for hiring. */
export function kindBadgeClass(kind: 'evaluation' | 'hiring'): string {
  return kind === 'evaluation' ? 'badge-brand' : 'badge-blue'
}
