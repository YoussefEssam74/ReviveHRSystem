/** Shared display formatting for the HR console. */

/** "2026-10-22" or an ISO timestamp → "22 Oct 2026" (local). Blank input → em dash. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value.length === 10 ? value + 'T00:00:00' : value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** ISO timestamp → "14:35" (local). Blank/invalid → em dash. */
export function formatTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/** "2026-10-22T12:34:56" → "22 Oct 2026 · 14:35". Blank → em dash. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return `${formatDate(value)} · ${formatTime(value)}`
}

/** Money in EGP with thousands separators; non-finite → em dash. */
export function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-EG', { maximumFractionDigits: 0 })
}

/** Full name → up to two initials ("Mona Hassan" → "MH"). */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Status string → a Tailwind badge class set (dot + text). */
export function statusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case 'Active':
    case 'Approved':
    case 'On Time':
    case 'Present':
    case 'Completed':
    case 'Eligible':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    case 'Pending':
    case 'PendingHRReview':
    case 'Under Review':
    case 'On Leave':
    case 'Late':
    case 'Notice Period':
      return 'bg-amber-50 text-amber-700 ring-amber-200'
    case 'Suspended':
    case 'Rejected':
    case 'Absent':
    case 'Terminated':
    case 'Banned':
      return 'bg-red-50 text-red-700 ring-red-200'
    case 'Draft':
    case 'Scheduled':
    case 'Day Off':
    case 'Off':
      return 'bg-slate-100 text-slate-600 ring-slate-200'
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200'
  }
}

/** Human label for an action-type code used by the escalated-request queue. */
export function actionTypeLabel(actionType: string | null | undefined): string {
  switch (actionType) {
    case 'Transfer':
      return 'Transfer Gym'
    case 'CompensationChange':
      return 'Compensation Change'
    case 'RoleAssign':
      return 'Role Assign'
    case 'Offboard':
      return 'Offboard'
    case 'BulkImport':
      return 'Bulk Import'
    default:
      return actionType ?? '—'
  }
}

/**
 * Mock UI badge palette (Mock UI/HR/styles.css §BADGES) — the dashboard aggregate
 * echoes these class names from the backend ("badge-blue", "badge-purple", …), so
 * queue cards render with the reference colors.
 */
export function queueBadgeClass(badgeClass: string | null | undefined): string {
  switch (badgeClass) {
    case 'badge-green':
    case 'badge-success':
      return 'bg-[#dcfce7] text-[#00422b]'
    case 'badge-yellow':
      return 'bg-[#fef9c3] text-[#854d0e]'
    case 'badge-red':
      return 'bg-[#fee2e2] text-[#991b1b]'
    case 'badge-blue':
      return 'bg-[#dbeafe] text-[#1e40af]'
    case 'badge-purple':
      return 'bg-[#f3e8ff] text-[#6b21a8]'
    case 'badge-orange':
      return 'bg-[#fff7ed] text-[#9a3412]'
    case 'badge-emerald':
      return 'bg-[#d1fae5] text-[#065f46]'
    case 'badge-brand':
      return 'bg-[#e6f4ee] text-[#006c49]'
    default:
      return 'bg-[#f1f3f5] text-[#495057]'
  }
}
