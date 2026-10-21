/** Date/money formatting helpers matching the mock's display conventions. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toDate(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "Oct 14" / "Oct 14, 2025" (year appended when not the current year). */
export function formatDate(value: Date | string | number, opts: { withYear?: 'auto' | 'always' | 'never' } = {}): string {
  const date = toDate(value)
  if (!date) return '—'
  const sameYear = date.getFullYear() === new Date().getFullYear()
  const withYear = opts.withYear === 'always' || (opts.withYear === 'auto' && !sameYear)
  const base = `${MONTHS[date.getMonth()]} ${date.getDate()}`
  return withYear ? `${base}, ${date.getFullYear()}` : base
}

/** "Oct 14, 2026" (explicit year — history/payslip labels). */
export function formatDateWithYear(value: Date | string | number): string {
  return formatDate(value, { withYear: 'always' })
}

/** "9:14 AM" */
export function formatTime(value: Date | string | number): string {
  const date = toDate(value)
  if (!date) return '—'
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** "Today · 9:14 AM" / "Oct 12 · 8:47 AM" */
export function formatDayTime(value: Date | string | number): string {
  const date = toDate(value)
  if (!date) return '—'
  const today = new Date()
  const sameDay = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()
  const day = sameDay ? 'Today' : formatDate(date)
  return `${day} · ${formatTime(date)}`
}

/** "2h ago" / "Yesterday 9:14 AM" / "Oct 10 9:14 AM" */
export function timeAgo(value: Date | string | number): string {
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

/** 1450 → "1,450" (no currency) */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return Number.isInteger(value) ? value.toLocaleString('en-US') : value.toFixed(2)
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
