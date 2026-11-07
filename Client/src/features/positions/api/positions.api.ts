import { apiRequest } from '../../../lib/api-client'

/** One row of the org-wide positions catalog (GET /api/positions). */
export interface PositionItem {
  id: number
  title: string
  /** Level chips split from the stored level string. */
  levels: string[]
  department: string | null
  gym: string
  headcount: number
  /** Active employees currently holding the position. */
  active: number
  /** max(headcount − active, 0). */
  open: number
  /** Percent of headcount filled (0 when headcount is 0). */
  fill: number
}

/** Flat catalog envelope — no pager; `total` is the full list length. */
export interface PositionCatalog {
  items: PositionItem[]
  total: number
}

export interface PositionListParams {
  gym?: number
  /** Title substring (case-insensitive). */
  searchTerm?: string
  /** true = only rows flagged active. */
  active?: boolean
}

export function getPositions(params: PositionListParams = {}, signal?: AbortSignal): Promise<PositionCatalog> {
  const query = new URLSearchParams()
  if (params.gym != null) query.set('gym', String(params.gym))
  if (params.searchTerm) query.set('searchTerm', params.searchTerm)
  if (params.active != null) query.set('active', String(params.active))
  const qs = query.toString()
  return apiRequest<PositionCatalog>(`/api/positions${qs ? '?' + qs : ''}`, { signal })
}

/** One branch (GET /api/gyms) — the catalog's gym filter options. */
export interface GymOption {
  id: number
  name: string
  branch: string | null
  employees: number
}

export function getGyms(signal?: AbortSignal): Promise<GymOption[]> {
  return apiRequest<GymOption[]>('/api/gyms', { signal })
}
