import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getEmployee,
  getEmployees,
  postCreateEmployee,
  postContractChange,
  postRoleChange,
  postStatusChange,
  type ContractChangeBody,
  type CreateEmployeeBody,
  type EmployeeListParams,
  type RoleChangeBody,
  type StatusChangeBody,
} from '../api/employees.api'

/** Paged employee directory. */
export function useEmployees(params: EmployeeListParams) {
  return useQuery({
    queryKey: ['employees', params],
    queryFn: ({ signal }) => getEmployees(params, signal),
  })
}

/** Single employee profile. */
export function useEmployee(id: number) {
  return useQuery({
    queryKey: ['employees', 'detail', id],
    queryFn: ({ signal }) => getEmployee(id, signal),
    enabled: Number.isFinite(id),
  })
}

/** Status change (Active / On Leave / Suspended / Terminated). */
export function useStatusChange(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: StatusChangeBody) => postStatusChange(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

/** Create employee (dashboard fast action + employees page). */
export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateEmployeeBody) => postCreateEmployee(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['gyms'] })
    },
  })
}

/** Contract change (level / salary / effective date). */
export function useContractChange(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ContractChangeBody) => postContractChange(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/** System-role change (None (Employee) / Team Leader / Branch Manager / …). */
export function useRoleChange(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: RoleChangeBody) => postRoleChange(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}
