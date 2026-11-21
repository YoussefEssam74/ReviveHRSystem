/** Name + date-window filter shared by every recruitment lifecycle tab. */

export interface NameDateFilter {
  name: string
  /** YYYY-MM-DD (input[type=date]); empty = no lower bound. */
  from: string
  /** YYYY-MM-DD; empty = no upper bound. */
  to: string
}

export const NO_NAME_DATE_FILTER: NameDateFilter = { name: '', from: '', to: '' }

export function isFilterActive(filter: NameDateFilter): boolean {
  return Boolean(filter.name.trim() || filter.from || filter.to)
}

/** Case-insensitive substring match; a blank term keeps every row. */
export function matchesName(value: string | null | undefined, term: string): boolean {
  const needle = term.trim().toLowerCase()
  return needle === '' || (value ?? '').toLowerCase().includes(needle)
}

/**
 * Inclusive day-window test. Timestamps and DateOnly values both compare on
 * their YYYY-MM-DD prefix, so no timezone math is involved.
 */
export function withinDateRange(value: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true
  if (!value) return false
  const day = value.slice(0, 10)
  if (from && day < from) return false
  if (to && day > to) return false
  return true
}
