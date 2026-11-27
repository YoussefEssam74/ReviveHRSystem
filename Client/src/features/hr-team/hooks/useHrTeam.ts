import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getGyms,
  getPermissionCatalog,
  getRoleMember,
  getRoles,
  getTeamMembers,
  getUserAccessProfile,
  postCreateRole,
  postCreateUser,
  postResetPassword,
  putUserAutoApproval,
  putUserGymAccess,
  putUserPermissions,
  putRolePermissions,
  putUserStatus,
  type ChangeUserStatusBody,
  type CreateRoleBody,
  type CreateUserBody,
  type RoleListParams,
  type TeamListParams,
} from '../api/hr-team.api'

/** Paged HR Team member list (team.view, UX-gated by the page). */
export function useTeamMembers(params: TeamListParams, enabled: boolean = true) {
  return useQuery({
    queryKey: ['team-members', params],
    queryFn: ({ signal }) => getTeamMembers(params, signal),
    enabled,
  })
}

/** Access profile for a single user — used for My Access and the team.view/team.manage UX gate. */
export function useUserAccessProfile(id: number, enabled: boolean = true) {
  return useQuery({
    queryKey: ['team-user-access', id],
    queryFn: ({ signal }) => getUserAccessProfile(id, signal),
    enabled: enabled && Number.isFinite(id) && id > 0,
  })
}

export function useSaveUserPermissions(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (permissions: string[]) => putUserPermissions(id, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-user-access', id] })
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
  })
}

/** One person's access through a single role — role-scoped gyms + auto-approval. */
export function useRoleMember(roleId: number, userId: number) {
  return useQuery({
    queryKey: ['team-role-member', roleId, userId],
    queryFn: ({ signal }) => getRoleMember(roleId, userId, signal),
    enabled: Number.isFinite(roleId) && roleId > 0 && Number.isFinite(userId) && userId > 0,
  })
}

/** HR's per-person, per-type final-approval grant for one desk account. */
export function useSaveUserAutoApproval(userId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (requestTypes: Record<string, boolean>) => putUserAutoApproval(userId, requestTypes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-role-member'] })
      queryClient.invalidateQueries({ queryKey: ['team-user-access', userId] })
    },
  })
}

export function useSaveUserGymAccess(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (gymIds: number[]) => putUserGymAccess(id, gymIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-user-access', id] })
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
  })
}

/** Paged roles list (team.view). */
export function useRoles(params: RoleListParams, enabled: boolean = true) {
  return useQuery({
    queryKey: ['team-roles', params],
    queryFn: ({ signal }) => getRoles(params, signal),
    enabled,
  })
}

/** The flat + area-grouped permission catalog (team.view). */
export function usePermissionCatalog(enabled: boolean = true) {
  return useQuery({
    queryKey: ['team-permission-catalog'],
    queryFn: ({ signal }) => getPermissionCatalog(signal),
    enabled,
  })
}

/** Gyms visible to the caller — the create-user gym-access picker. */
export function useTeamGyms(enabled: boolean = true) {
  return useQuery({
    queryKey: ['team-gyms'],
    queryFn: ({ signal }) => getGyms(signal),
    enabled,
  })
}

/** POST /api/users — creates an HR account (team.manage). */
export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateUserBody) => postCreateUser(body),
    onSuccess: () => {
      // Member rows and the role's user count both change.
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
      queryClient.invalidateQueries({ queryKey: ['team-roles'] })
    },
  })
}

/** PUT /api/users/{id}/status — suspend / reactivate (team.manage). */
export function useChangeUserStatus(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ChangeUserStatusBody) => putUserStatus(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
      queryClient.invalidateQueries({ queryKey: ['team-user-access'] })
    },
  })
}

/** POST /api/users/{id}/reset-password — admin sets a known password (team.manage). */
export function useResetUserPassword(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (newPassword: string) => postResetPassword(id, newPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
  })
}

/** PUT /api/roles/{id}/permissions — replaces the role's permission set (team.manage). */
export function useSetRolePermissions(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (permissions: string[]) => putRolePermissions(id, permissions),
    onSuccess: () => {
      // Permission counters show up on both the roles list and the member rows.
      queryClient.invalidateQueries({ queryKey: ['team-roles'] })
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
  })
}

/** POST /api/roles — creates a custom role and its initial permissions. */
export function useCreateRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateRoleBody) => postCreateRole(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-roles'] })
      queryClient.invalidateQueries({ queryKey: ['platform', 'roles'] })
    },
  })
}
