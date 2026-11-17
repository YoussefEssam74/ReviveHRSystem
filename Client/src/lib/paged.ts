/** Standard list envelope (most list endpoints). */
export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/**
 * Portal-service envelope (`Shared/PaginationResult<T>`): same shape but the
 * count field is `totalCount`. Only a few modules use it — keep both.
 */
export interface PagedCountResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export type QueryValue = string | number | boolean | null | undefined

/** Builds a /api URL with a query string, skipping undefined/null/'' values. */
export function withQuery(path: string, params: Record<string, QueryValue> = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `${path}?${qs}` : path
}

/**
 * Walks a paged endpoint to the end and returns every row — for picker and
 * aggregation callers that must see the whole roster. Page sizes above 100 are
 * clamped server-side (directory, inbox, …), so "everything" cannot come from
 * one big page; callers loop with the max page size instead. `maxPages` caps
 * runaway loops; each round aborts with the caller's signal.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, signal?: AbortSignal) => Promise<PagedResult<T> | PagedCountResult<T>>,
  signal?: AbortSignal,
  maxPages = 10,
): Promise<T[]> {
  const rows: T[] = []
  for (let page = 1; page <= maxPages; page++) {
    const envelope = await fetchPage(page, signal)
    rows.push(...envelope.items)
    if (page >= envelope.totalPages) break
  }
  return rows
}
