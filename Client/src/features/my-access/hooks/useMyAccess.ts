import { useQuery } from '@tanstack/react-query'
import { getGyms, getMyAccess, getPermissionCatalog } from '../api/my-access.api'

/**
 * The caller's own access profile (GET /api/users/{id} with their id).
 * Enabled only once the session context (me) has loaded a user id.
 */
export function useMyAccess(id: number) {
  return useQuery({
    queryKey: ['my-access', 'profile', id],
    queryFn: ({ signal }) => getMyAccess(id, signal),
    enabled: Number.isFinite(id) && id > 0,
  })
}

/** The permission catalog grouped by area (GET /api/permissions, team.view). */
export function usePermissionCatalog() {
  return useQuery({
    queryKey: ['my-access', 'catalog'],
    queryFn: ({ signal }) => getPermissionCatalog(signal),
    // The catalog needs team.view; the page falls back to the effective set on 403.
    retry: false,
  })
}

/** The gyms the signed-in user may switch between (GET /api/gyms). */
export function useGyms() {
  return useQuery({
    queryKey: ['my-access', 'gyms'],
    queryFn: ({ signal }) => getGyms(signal),
  })
}
