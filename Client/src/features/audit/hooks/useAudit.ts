import { useQuery } from '@tanstack/react-query'
import { getActors, getAuditLog, getGyms, type AuditLogParams } from '../api/audit.api'

/** Paged audit rows (audit.view, UX-gated by the page — the API enforces it too). */
export function useAuditLog(params: AuditLogParams, enabled: boolean = true) {
  return useQuery({
    queryKey: ['audit-log', params],
    queryFn: ({ signal }) => getAuditLog(params, signal),
    enabled,
  })
}

/** Gyms for the gym filter (GET /api/gyms). */
export function useAuditGyms(enabled: boolean = true) {
  return useQuery({
    queryKey: ['audit-gyms'],
    queryFn: ({ signal }) => getGyms(signal),
    enabled,
  })
}

/** Actors for the user filter (GET /api/users — team.view; the filter hides itself on 403). */
export function useAuditActors(enabled: boolean = true) {
  return useQuery({
    queryKey: ['audit-actors'],
    queryFn: ({ signal }) => getActors(signal),
    enabled,
    // A team.view 403 is a permanent answer for this caller — don't retry it.
    retry: false,
  })
}
