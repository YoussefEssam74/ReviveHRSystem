import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  changeCompanyStatus,
  getAlerts,
  getCompanies,
  getCompany,
  getCompanyAudit,
  getCompanyBilling,
  getCompanyBranches,
  getCompanyEmployees,
  getCompanyHrStaff,
  getCompanyOverview,
  getCurrentWorkspace,
  getDashboard,
  getFeatureFlags,
  getInvoice,
  getInvoices,
  getLauncherRoles,
  getPlans,
  getPlatformUser,
  getPlatformUsers,
  getRevenueOutstanding,
  getRevenuePerCompany,
  getRevenuePeriods,
  getRevenueSummary,
  getRevenueTrend,
  getSettings,
  deleteBranch,
  postBranch,
  postCompany,
  postCreateHrManager,
  postCreateUser,
  postEndWorkspace,
  postFeatureFlag,
  postPlan,
  postRecordPayment,
  postResetPassword,
  postRevokeSessions,
  postSendReminder,
  postStartWorkspace,
  postVoidInvoice,
  putBranch,
  putFeatureFlag,
  putPlan,
  putPlatformUserStatus,
  putSettings,
  type CompanyListParams,
  type CreateBranchBody,
  type InvoiceListParams,
  type PlatformUserListParams,
} from '../api/platform.api'

/**
 * React Query bindings for the Super Admin console.
 *
 * Query keys are namespaced under `platform` so the console's cache can be
 * invalidated wholesale after a mutation without disturbing the HR portal.
 */

const KEYS = {
  dashboard: ['platform', 'dashboard'] as const,
  alerts: (severity?: string) => ['platform', 'alerts', severity ?? 'all'] as const,
  companies: (params: CompanyListParams) => ['platform', 'companies', params] as const,
  company: (id: number) => ['platform', 'company', id] as const,
  companyOverview: (id: number) => ['platform', 'company', id, 'overview'] as const,
  companyEmployees: (id: number, params: object) => ['platform', 'company', id, 'employees', params] as const,
  companyBranches: (id: number) => ['platform', 'company', id, 'branches'] as const,
  companyHrStaff: (id: number) => ['platform', 'company', id, 'hr-staff'] as const,
  companyBilling: (id: number) => ['platform', 'company', id, 'billing'] as const,
  users: (params: PlatformUserListParams) => ['platform', 'users', params] as const,
  user: (id: number) => ['platform', 'user', id] as const,
  plans: ['platform', 'plans'] as const,
  invoices: (params: InvoiceListParams) => ['platform', 'invoices', params] as const,
  invoice: (id: number) => ['platform', 'invoice', id] as const,
  revenuePeriods: ['platform', 'revenue', 'periods'] as const,
  revenueSummary: (period?: string) => ['platform', 'revenue', 'summary', period ?? 'current'] as const,
  revenueTrend: (months: number) => ['platform', 'revenue', 'trend', months] as const,
  revenuePerCompany: (period?: string) => ['platform', 'revenue', 'per-company', period ?? 'current'] as const,
  revenueOutstanding: (period?: string) => ['platform', 'revenue', 'outstanding', period ?? 'current'] as const,
  settings: ['platform', 'settings'] as const,
  flags: ['platform', 'feature-flags'] as const,
  workspace: ['platform', 'workspace'] as const,
  launcherRoles: ['platform', 'launcher-roles'] as const,
}

// ----- reads -----

export const usePlatformDashboard = (enabled = true) =>
  useQuery({ queryKey: KEYS.dashboard, queryFn: ({ signal }) => getDashboard(signal), enabled })

export const usePlatformAlerts = (severity?: string, enabled = true) =>
  useQuery({ queryKey: KEYS.alerts(severity), queryFn: ({ signal }) => getAlerts({ severity }, signal), enabled })

export const useCompanies = (params: CompanyListParams, enabled = true) =>
  useQuery({ queryKey: KEYS.companies(params), queryFn: ({ signal }) => getCompanies(params, signal), enabled })

export const useCompany = (id: number) =>
  useQuery({
    queryKey: KEYS.company(id),
    queryFn: ({ signal }) => getCompany(id, signal),
    enabled: Number.isFinite(id) && id > 0,
  })

export const useCompanyOverview = (id: number, enabled = true) =>
  useQuery({
    queryKey: KEYS.companyOverview(id),
    queryFn: ({ signal }) => getCompanyOverview(id, signal),
    enabled: enabled && id > 0,
  })

export const useCompanyEmployees = (id: number, params: object, enabled = true) =>
  useQuery({
    queryKey: KEYS.companyEmployees(id, params),
    queryFn: ({ signal }) => getCompanyEmployees(id, params, signal),
    enabled: enabled && id > 0,
  })

export const useCompanyBranches = (id: number, enabled = true) =>
  useQuery({
    queryKey: KEYS.companyBranches(id),
    queryFn: ({ signal }) => getCompanyBranches(id, signal),
    enabled: enabled && id > 0,
  })

export const useCompanyHrStaff = (id: number, enabled = true) =>
  useQuery({
    queryKey: KEYS.companyHrStaff(id),
    queryFn: ({ signal }) => getCompanyHrStaff(id, signal),
    enabled: enabled && id > 0,
  })

export const useCompanyBilling = (id: number, enabled = true) =>
  useQuery({
    queryKey: KEYS.companyBilling(id),
    queryFn: ({ signal }) => getCompanyBilling(id, signal),
    enabled: enabled && id > 0,
  })

export const usePlatformUsers = (params: PlatformUserListParams) =>
  useQuery({ queryKey: KEYS.users(params), queryFn: ({ signal }) => getPlatformUsers(params, signal) })

export const usePlatformUser = (id: number) =>
  useQuery({
    queryKey: KEYS.user(id),
    queryFn: ({ signal }) => getPlatformUser(id, signal),
    enabled: Number.isFinite(id) && id > 0,
  })

export const usePlans = (enabled = true) =>
  useQuery({ queryKey: KEYS.plans, queryFn: ({ signal }) => getPlans(signal), enabled })

export const useInvoices = (params: InvoiceListParams) =>
  useQuery({ queryKey: KEYS.invoices(params), queryFn: ({ signal }) => getInvoices(params, signal) })

export const useInvoice = (id: number) =>
  useQuery({
    queryKey: KEYS.invoice(id),
    queryFn: ({ signal }) => getInvoice(id, signal),
    enabled: id > 0,
  })

export const useRevenuePeriods = (enabled = true) =>
  useQuery({ queryKey: KEYS.revenuePeriods, queryFn: ({ signal }) => getRevenuePeriods(signal), enabled })

export const useRevenueSummary = (period?: string, enabled = true) =>
  useQuery({
    queryKey: KEYS.revenueSummary(period),
    queryFn: ({ signal }) => getRevenueSummary(period, signal),
    enabled,
  })

export const useRevenueTrend = (months = 12, enabled = true) =>
  useQuery({
    queryKey: KEYS.revenueTrend(months),
    queryFn: ({ signal }) => getRevenueTrend(months, signal),
    enabled,
  })

export const useRevenuePerCompany = (period?: string, enabled = true) =>
  useQuery({
    queryKey: KEYS.revenuePerCompany(period),
    queryFn: ({ signal }) => getRevenuePerCompany(period, signal),
    enabled,
  })

export const useRevenueOutstanding = (period?: string, enabled = true) =>
  useQuery({
    queryKey: KEYS.revenueOutstanding(period),
    queryFn: ({ signal }) => getRevenueOutstanding(period, signal),
    enabled,
  })

export const usePlatformSettings = (enabled = true) =>
  useQuery({ queryKey: KEYS.settings, queryFn: ({ signal }) => getSettings(signal), enabled })

export const useFeatureFlags = (enabled = true) =>
  useQuery({ queryKey: KEYS.flags, queryFn: ({ signal }) => getFeatureFlags(signal), enabled })

export const useLauncherRoles = (enabled = true) =>
  useQuery({ queryKey: KEYS.launcherRoles, queryFn: ({ signal }) => getLauncherRoles(signal), enabled })

/** Polls the caller's act-as session; disabled for ordinary console tokens. */
export const useCurrentWorkspace = (enabled = false) =>
  useQuery({
    queryKey: KEYS.workspace,
    queryFn: ({ signal }) => getCurrentWorkspace(signal),
    enabled,
    // The banner should notice an expiry without the user having to act.
    refetchInterval: enabled ? 60_000 : false,
  })

// ----- mutations -----

/** Invalidates the console cache after a write so every affected view refetches. */
function useInvalidatePlatform() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['platform'] })
}

export const useCompanyAudit = (id: number, pageSize = 6) =>
  useQuery({
    queryKey: ['platform', 'company', id, 'audit', pageSize] as const,
    queryFn: ({ signal }) => getCompanyAudit(id, pageSize, signal),
    enabled: Number.isFinite(id) && id > 0,
  })

export function useChangeCompanyStatus() {
  const invalidate = useInvalidatePlatform()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: { status: string; reason?: string | null; confirmCode?: string | null } }) =>
      changeCompanyStatus(id, body),
    onSuccess: invalidate,
  })
}

export function useCreateCompany() {
  const invalidate = useInvalidatePlatform()
  return useMutation({ mutationFn: postCompany, onSuccess: invalidate })
}

export function useCreateBranch() {
  const invalidate = useInvalidatePlatform()
  return useMutation({
    mutationFn: ({ companyId, body }: { companyId: number; body: CreateBranchBody }) => postBranch(companyId, body),
    onSuccess: invalidate,
  })
}

export function useUpdateBranch() {
  const invalidate = useInvalidatePlatform()
  return useMutation({
    mutationFn: ({ companyId, branchId, body }: { companyId: number; branchId: number; body: CreateBranchBody }) =>
      putBranch(companyId, branchId, body),
    onSuccess: invalidate,
  })
}

export function useArchiveBranch() {
  const invalidate = useInvalidatePlatform()
  return useMutation({
    mutationFn: ({ companyId, branchId }: { companyId: number; branchId: number }) =>
      deleteBranch(companyId, branchId),
    onSuccess: invalidate,
  })
}

export function useCreateUser() {
  const invalidate = useInvalidatePlatform()
  return useMutation({ mutationFn: postCreateUser, onSuccess: invalidate })
}

export function useCreateHrManager() {
  const invalidate = useInvalidatePlatform()
  return useMutation({ mutationFn: postCreateHrManager, onSuccess: invalidate })
}

export function useChangeUserStatus() {
  const invalidate = useInvalidatePlatform()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: { status: string; reason?: string | null } }) =>
      putPlatformUserStatus(id, body),
    onSuccess: invalidate,
  })
}

export function useResetPassword() {
  return useMutation({ mutationFn: postResetPassword })
}

export function useRevokeSessions() {
  const invalidate = useInvalidatePlatform()
  return useMutation({ mutationFn: postRevokeSessions, onSuccess: invalidate })
}

export function useRecordPayment() {
  const invalidate = useInvalidatePlatform()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number
      body: { amount: number; paidOn?: string | null; method?: string; reference?: string | null }
    }) => postRecordPayment(id, body),
    onSuccess: invalidate,
  })
}

export function useSendReminder() {
  return useMutation({ mutationFn: postSendReminder })
}

export function useVoidInvoice() {
  const invalidate = useInvalidatePlatform()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => postVoidInvoice(id, reason),
    onSuccess: invalidate,
  })
}


export function useSaveSettings() {
  const invalidate = useInvalidatePlatform()
  return useMutation({ mutationFn: putSettings, onSuccess: invalidate })
}

/** Creates a plan and refreshes the catalogue. */
export function useCreatePlan() {
  const invalidate = useInvalidatePlatform()
  return useMutation({ mutationFn: postPlan, onSuccess: invalidate })
}

/** Edits a plan; existing companies keep the terms they were sold. */
export function useSavePlan() {
  const invalidate = useInvalidatePlatform()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof putPlan>[1] }) => putPlan(id, body),
    onSuccess: invalidate,
  })
}

export function useCreateFeatureFlag() {
  const invalidate = useInvalidatePlatform()
  return useMutation({ mutationFn: postFeatureFlag, onSuccess: invalidate })
}

export function useToggleFeatureFlag() {
  const invalidate = useInvalidatePlatform()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof putFeatureFlag>[1] }) => putFeatureFlag(id, body),
    onSuccess: invalidate,
  })
}

export function useStartWorkspace() {
  const invalidate = useInvalidatePlatform()
  return useMutation({ mutationFn: postStartWorkspace, onSuccess: invalidate })
}

export function useEndWorkspace() {
  const invalidate = useInvalidatePlatform()
  return useMutation({ mutationFn: postEndWorkspace, onSuccess: invalidate })
}
