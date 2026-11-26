import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  downloadEmployeeDocument,
  getEmployee,
  getEmployeeAttendance,
  getEmployeeDocuments,
  getEmployeeEvaluations,
  getEmployeeHistory,
  getEmployeeLeaveBalance,
  getEmployeePayroll,
  getEmployeeRequests,
  getEmployeeSchedule,
  getEmployees,
  postCompensation,
  postCreateEmployee,
  postContractChange,
  postPositionChange,
  postRoleChange,
  postStatusChange,
  postTransfer,
  uploadEmployeeDocument,
  type CompensationBody,
  type ContractChangeBody,
  type CreateEmployeeBody,
  type EmployeeDocumentUploadBody,
  type EmployeeListParams,
  type PositionChangeBody,
  type RoleChangeBody,
  type StatusChangeBody,
  type TransferBody,
} from '../api/employees.api'
import { ApiError } from '../../../lib/api-client'

/** A 403 is a verdict, not a hiccup — retrying it only burns requests. */
const retryUnlessForbidden = (failureCount: number, error: unknown) =>
  !(error instanceof ApiError && error.status === 403) && failureCount < 2

/** Paged employee directory. */
export function useEmployees(params: EmployeeListParams) {
  return useQuery({
    queryKey: ['employees', params],
    queryFn: ({ signal }) => getEmployees(params, signal),
    // Paging/filtering keeps the previous page on screen instead of flashing a
    // full-page loader between requests.
    placeholderData: (previous) => previous,
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
      // The payroll page ensures the open sheet on its next visit; refresh the
      // cached period lists so a freshly added sheet is not stale.
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
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

/** Gym transfer — also refreshes the gym switcher's roster counts. */
export function useTransfer(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: TransferBody) => postTransfer(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['gyms'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/** Position / level change in the current gym. */
export function usePositionChange(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: PositionChangeBody) => postPositionChange(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/** Compensation record (salary + effective date). */
export function useCompensationChange(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CompensationBody) => postCompensation(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Employee file tabs — every hook is keyed under ['employees', 'file', id, …]
// so a status/contract change can invalidate the whole file in one go.
// ---------------------------------------------------------------------------

/** Document vault (employees.documents.view). */
export function useEmployeeDocuments(id: number) {
  return useQuery({
    queryKey: ['employees', 'file', id, 'documents'],
    queryFn: ({ signal }) => getEmployeeDocuments(id, signal),
    enabled: Number.isFinite(id),
    retry: retryUnlessForbidden,
  })
}

/** Upload a document into the employee's vault (employees.documents.manage). */
export function useUploadEmployeeDocument(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: EmployeeDocumentUploadBody) => uploadEmployeeDocument(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', 'file', id, 'documents'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/** Downloads one stored document (no cache — a click, not a render). */
export function downloadDocumentFile(id: number, documentId: number, fileName: string) {
  return downloadEmployeeDocument(id, documentId, fileName)
}

/** Employment history timeline. */
export function useEmployeeHistory(id: number) {
  return useQuery({
    queryKey: ['employees', 'file', id, 'history'],
    queryFn: ({ signal }) => getEmployeeHistory(id, signal),
    enabled: Number.isFinite(id),
  })
}

/** Published schedule over an inclusive date range (schedule.view). */
export function useEmployeeSchedule(id: number, range: { from: string; to: string }) {
  return useQuery({
    queryKey: ['employees', 'file', id, 'schedule', range.from, range.to],
    queryFn: ({ signal }) => getEmployeeSchedule(id, range, signal),
    enabled: Number.isFinite(id),
    retry: retryUnlessForbidden,
  })
}

/** One month of attendance for the employee (attendance.view). */
export function useEmployeeAttendance(id: number, month: string) {
  return useQuery({
    queryKey: ['employees', 'file', id, 'attendance', month],
    queryFn: ({ signal }) => getEmployeeAttendance(id, month, signal),
    enabled: Number.isFinite(id),
    retry: retryUnlessForbidden,
  })
}

/** Current-year leave balances. */
export function useEmployeeLeaveBalance(id: number) {
  return useQuery({
    queryKey: ['employees', 'file', id, 'leave-balance'],
    queryFn: ({ signal }) => getEmployeeLeaveBalance(id, signal),
    enabled: Number.isFinite(id),
    retry: retryUnlessForbidden,
  })
}

/** The employee's own requests (requests.view). */
export function useEmployeeRequests(id: number) {
  return useQuery({
    queryKey: ['employees', 'file', id, 'requests'],
    queryFn: ({ signal }) => getEmployeeRequests(id, signal),
    enabled: Number.isFinite(id),
    retry: retryUnlessForbidden,
  })
}

/** Evaluations recorded against the employee (evaluations.view). */
export function useEmployeeEvaluations(id: number) {
  return useQuery({
    queryKey: ['employees', 'file', id, 'evaluations'],
    queryFn: ({ signal }) => getEmployeeEvaluations(id, signal),
    enabled: Number.isFinite(id),
    retry: retryUnlessForbidden,
  })
}

/** Payroll sheets the employee appears on (payroll.view). */
export function useEmployeePayroll(id: number) {
  return useQuery({
    queryKey: ['employees', 'file', id, 'payroll'],
    queryFn: ({ signal }) => getEmployeePayroll(id, signal),
    enabled: Number.isFinite(id),
    retry: retryUnlessForbidden,
  })
}
