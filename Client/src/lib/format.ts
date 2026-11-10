/** Date/money formatting helpers matching the mock's display conventions. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "Oct 14" / "Oct 14, 2025" (year appended when not the current year). */
export function formatDate(
  value: Date | string | number | null | undefined,
  opts: { withYear?: 'auto' | 'always' | 'never' } = {},
): string {
  const date = toDate(value)
  if (!date) return '—'
  const sameYear = date.getFullYear() === new Date().getFullYear()
  const withYear = opts.withYear === 'always' || (opts.withYear === 'auto' && !sameYear)
  const base = `${MONTHS[date.getMonth()]} ${date.getDate()}`
  return withYear ? `${base}, ${date.getFullYear()}` : base
}

/** "Oct 14, 2026" (explicit year — history/payslip labels). */
export function formatDateWithYear(value: Date | string | number | null | undefined): string {
  return formatDate(value, { withYear: 'always' })
}

/** "9:14 AM" */
export function formatTime(value: Date | string | number | null | undefined): string {
  const date = toDate(value)
  if (!date) return '—'
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/**
 * API clock value ("HH:mm" / "HH:mm:ss" TimeOnly) → "8:08 PM".
 * Display only: <input type="time"> values stay 24-hour.
 */
export function formatTimeOfDay(value: string | null | undefined): string {
  if (!value) return '—'
  const match = /^(\d{1,2}):(\d{2})/.exec(value)
  if (!match) return value
  const hour = Number(match[1])
  if (Number.isNaN(hour) || hour > 23) return value
  const suffix = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 === 0 ? 12 : hour % 12}:${match[2]} ${suffix}`
}

/** Re-formats every clock value inside an API-composed label: "Morning 08:00–16:00" → "Morning 8:00 AM–4:00 PM". */
export function formatTimeLabel(value: string | null | undefined): string {
  if (!value) return '—'
  return value.replace(/\b(\d{1,2}):(\d{2})\b/g, (clock, hourPart: string, minutePart: string) => {
    const hour = Number(hourPart)
    if (Number.isNaN(hour) || hour > 23) return clock
    const suffix = hour >= 12 ? 'PM' : 'AM'
    return `${hour % 12 === 0 ? 12 : hour % 12}:${minutePart} ${suffix}`
  })
}

/** "Today · 9:14 AM" / "Oct 12 · 8:47 AM" */
export function formatDayTime(value: Date | string | number | null | undefined): string {
  const date = toDate(value)
  if (!date) return '—'
  const today = new Date()
  const sameDay = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()
  const day = sameDay ? 'Today' : formatDate(date)
  return `${day} · ${formatTime(date)}`
}

/** "2h ago" / "Yesterday 9:14 AM" / "Oct 10 9:14 AM" */
export function timeAgo(value: Date | string | number | null | undefined): string {
  const date = toDate(value)
  if (!date) return '—'
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${formatDate(date)} ${formatTime(date)}`
}

/** DateOnly string "2025-10-14" → { day: 14, weekday: 'Tue', monthShort: 'Oct' } */
export function dateParts(dateOnly: string): { day: string; weekday: string; month: string; date: Date } {
  const date = new Date(dateOnly + 'T00:00:00')
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    day: String(date.getDate()),
    weekday: weekdays[date.getDay()],
    month: MONTHS[date.getMonth()],
    date,
  }
}

/** 1450 → "1,450 EGP" */
export function formatMoney(value: number | null | undefined, currency = 'EGP'): string {
  if (value === null || value === undefined) return '—'
  const rounded = Number.isInteger(value) ? value.toString() : value.toFixed(2)
  const withSeparators = rounded.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${withSeparators} ${currency}`
}

/** 1450 → "1,450" · 4158.32 → "4,158.32" (grouped, no currency) */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const rounded = Number.isInteger(value) ? value.toString() : value.toFixed(2)
  return rounded.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** 2_400_000 → "2.3 MB" (file sizes in upload feedback). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(/\.0$/, '')} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`
}

/** "FullTime" / "FullTime" enum-ish → "Full-time" display labels. */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—'
  const label = value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')
  const special = new Map([
    ['Full Time', 'Full-time'],
    ['Part Time', 'Part-time'],
    ['Fulltime', 'Full-time'],
    ['Parttime', 'Part-time'],
  ])
  return special.get(label) ?? label
}

/** "22 Oct 2026 · 14:35" — the console's absolute date + time label. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return `${formatDate(value)} · ${formatTime(value)}`
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
