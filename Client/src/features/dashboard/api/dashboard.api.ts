import { apiRequest } from '../../../lib/api-client'

/** GET /api/dashboard/hr — KPI strip, actions-needed feed, branch oversight. */
export interface HrDashboardKpis {
  totalGyms: number
  totalStaff: number
  totalPendingRequests: number
  actionsNeeded: number
}

export interface HrDashboardAction {
  id: string
  kind: string
  badge: string
  badgeClass: string
  title: string
  subtitle: string
  detail: string
  date: string
  gymId: number | null
  gym: string | null
}

export interface HrDashboardBranch {
  gymId: number
  name: string
  location: string | null
  headcount: number
  pendingActions: number
  summary: string | null
}

export interface HrDashboard {
  greeting: string | null
  userName: string | null
  kpis: HrDashboardKpis
  actions: HrDashboardAction[]
  branches: HrDashboardBranch[]
}

export function getHrDashboard(signal?: AbortSignal): Promise<HrDashboard> {
  return apiRequest<HrDashboard>('/api/dashboard/hr', { signal })
}
