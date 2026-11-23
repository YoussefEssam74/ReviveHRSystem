import { apiDownload, apiRequest } from '../../../lib/api-client'

/**
 * Super Admin console API surface (`/api/platform/**`).
 *
 * Every call is bearer-authenticated through `apiRequest`, which already handles
 * expiry + silent refresh. The API enforces all permission checks — everything
 * here is a thin typed wrapper.
 */

// ------------------------------------------------------------------
// Shared envelopes
// ------------------------------------------------------------------

export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface CompanyRef {
  id: number
  name: string
  city?: string | null
  code?: string
}

// ------------------------------------------------------------------
// Dashboard
// ------------------------------------------------------------------

export interface PlatformDashboard {
  companies: { total: number; active: number; trial: number; paymentOverdue: number; suspended: number }
  users: { total: number; gymMembers: number; platformUsers: number; hrManagers: number; addedThisMonth: number }
  revenue: { mrr: number; arr: number; overdue: number; billedThisMonth: number; collectedThisMonth: number }
  seats: { used: number; capacity: number; utilisationPercent: number }
  attention: { critical: number; warnings: number; total: number }
}

export interface PlatformAlert {
  id: string
  severity: string
  type: string
  title: string
  detail: string
  companyId: number | null
  companyName: string | null
  /** Set when the alert is about one account (failed sign-in bursts). */
  userId: number | null
  actionLabel: string
  actionTarget: string
  raisedAt: string | null
}

export function getDashboard(signal?: AbortSignal): Promise<PlatformDashboard> {
  return apiRequest<PlatformDashboard>('/api/platform/dashboard', { signal })
}

export function getAlerts(
  params: { severity?: string } = {},
  signal?: AbortSignal,
): Promise<{ items: PlatformAlert[]; counts: { total: number } }> {
  const query = new URLSearchParams()
  if (params.severity) query.set('severity', params.severity)
  const suffix = query.toString()
  return apiRequest(`/api/platform/dashboard/alerts${suffix ? '?' + suffix : ''}`, { signal })
}

// ------------------------------------------------------------------
// Companies
// ------------------------------------------------------------------

export interface CompanyListItem {
  id: number
  code: string
  name: string
  city: string | null
  logoUrl: string | null
  status: string
  plan: { id: number; name: string }
  branchCount: number
  userCount: number
  seatLimit: number | null
  seatUsagePercent: number | null
  mrr: number
  billingCycle: string | null
  subscribedOn: string | null
  renewsOn: string | null
  renewalDaysRemaining: number | null
  payrollStatus: string | null
}

export interface CompanyListParams {
  search?: string
  status?: string
  planId?: number
  sortBy?: string
  sortDir?: string
  pageNumber?: number
  pageSize?: number
}

export function getCompanies(params: CompanyListParams = {}, signal?: AbortSignal): Promise<Paged<CompanyListItem>> {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  if (params.planId) query.set('planId', String(params.planId))
  if (params.sortBy) query.set('sortBy', params.sortBy)
  if (params.sortDir) query.set('sortDir', params.sortDir)
  query.set('pageNumber', String(params.pageNumber ?? 1))
  query.set('pageSize', String(params.pageSize ?? 25))

  return apiRequest(`/api/platform/companies?${query}`, { signal })
}

export interface CompanySubscription {
  id: number
  planId: number
  planName: string
  status: string
  price: number
  cycleCount: number
  cycleUnit: string
  seatLimit: number | null
  branchLimit: number | null
  startedOn: string
  currentPeriodStart: string
  currentPeriodEnd: string
  trialEndsOn: string | null
  renewsOn: string | null
}

export interface CompanyDetail {
  id: number
  code: string
  name: string
  city: string | null
  logoUrl: string | null
  status: string
  contact: { name: string | null; email: string | null; phone: string | null }
  createdAt: string
  subscription: CompanySubscription | null
  counts: { branches: number; users: number; hrStaff: number; invoices: number; auditEvents: number }
  health: { score: number; lastActivityAt: string | null; attendanceRate30d: number | null }
  payrollStatus: string | null
  blocking: { payrollBlocked: boolean; reason: string | null }
}

export function getCompany(id: number, signal?: AbortSignal): Promise<CompanyDetail> {
  return apiRequest<CompanyDetail>(`/api/platform/companies/${id}`, { signal })
}

export interface UpdateCompanyBody {
  name: string
  city?: string | null
  logoUrl?: string | null
  contact: { name?: string | null; email?: string | null; phone?: string | null }
}

/** Profile and billing contact. The account code is immutable and is not part of the body. */
export function putCompany(id: number, body: UpdateCompanyBody): Promise<CompanyDetail> {
  return apiRequest<CompanyDetail>(`/api/platform/companies/${id}`, { method: 'PUT', body })
}

export interface CompanyOverview {
  roleBreakdown: { hr: number; branchManager: number; teamLeader: number; employee: number; total: number }
  attendanceTrend14d: number[]
  attendanceTotal14d: number
  accountFacts: {
    planName: string
    billingCycle: string | null
    subscribedOn: string | null
    renewsOn: string | null
    monthlyValue: number
    payrollStatus: string | null
    lastActivityAt: string | null
  }
}

export function getCompanyOverview(id: number, signal?: AbortSignal): Promise<CompanyOverview> {
  return apiRequest<CompanyOverview>(`/api/platform/companies/${id}/overview`, { signal })
}

export interface CompanyEmployee {
  userId: number
  employeeId: number | null
  name: string
  email: string
  initials: string
  role: string
  roleId: number | null
  branchId: number | null
  branchName: string | null
  branchCode: string | null
  status: string
  lastLoginAt: string | null
  joinedOn: string | null
}

export function getCompanyEmployees(
  id: number,
  params: {
    search?: string
    role?: string
    branchId?: number
    status?: string
    pageNumber?: number
    pageSize?: number
  } = {},
  signal?: AbortSignal,
): Promise<Paged<CompanyEmployee>> {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.role) query.set('role', params.role)
  if (params.branchId) query.set('branchId', String(params.branchId))
  if (params.status) query.set('status', params.status)
  query.set('pageNumber', String(params.pageNumber ?? 1))
  query.set('pageSize', String(params.pageSize ?? 25))

  return apiRequest(`/api/platform/companies/${id}/employees?${query}`, { signal })
}

export interface CompanyBranch {
  id: number
  code: string
  name: string
  area: string | null
  address: string | null
  phone: string | null
  managerName: string | null
  status: string
  staffCount: number
  employeeCount: number
  teamLeaderCount: number
  branchManagerCount: number
}

export function getCompanyBranches(
  id: number,
  signal?: AbortSignal,
): Promise<{ items: CompanyBranch[]; branchLimit: number | null; branchLimitReached: boolean }> {
  return apiRequest(`/api/platform/companies/${id}/branches`, { signal })
}

export interface CompanyHrMember {
  userId: number
  name: string
  email: string
  initials: string
  assignedCompanies: CompanyRef[]
  assignedCompanyCount: number
  primaryBranch: string | null
  status: string
  lastLoginAt: string | null
}

export function getCompanyHrStaff(id: number, signal?: AbortSignal): Promise<{ items: CompanyHrMember[] }> {
  return apiRequest(`/api/platform/companies/${id}/hr-staff`, { signal })
}

export interface CompanyBilling {
  plan: { id: number; name: string; price: number; cycleCount: number; cycleUnit: string; features: string[] }
  seats: { used: number; limit: number | null; remaining: number | null }
  invoices: {
    id: number
    invoiceNumber: string
    periodLabel: string
    amount: number
    status: string
    issuedOn: string
    paidOn: string | null
  }[]
}

export function getCompanyBilling(id: number, signal?: AbortSignal): Promise<CompanyBilling> {
  return apiRequest<CompanyBilling>(`/api/platform/companies/${id}/billing`, { signal })
}

export interface CompanyStatusChange {
  id: number
  status: string
  payrollBlocked: boolean
  signInBlocked: boolean
  sessionsRevoked: number
  changedAt: string
}

export function changeCompanyStatus(
  id: number,
  body: { status: string; reason?: string | null; confirmCode?: string | null },
): Promise<CompanyStatusChange> {
  return apiRequest<CompanyStatusChange>(`/api/platform/companies/${id}/status`, { method: 'PUT', body })
}

export interface CompanyAuditEntry {
  id: number
  occurredAt: string
  actor: { id: number; name: string; userType: string }
  category: string | null
  severity: string | null
  action: string
  target: string | null
  ipAddress: string | null
  reviewed: boolean
}

/** The gym's own slice of the audit trail (newest first). */
export function getCompanyAudit(
  companyId: number,
  pageSize = 6,
  signal?: AbortSignal,
): Promise<{ items: CompanyAuditEntry[]; counts: { total: number; critical: number; warning: number } }> {
  return apiRequest(`/api/platform/companies/${companyId}/audit?pageSize=${pageSize}`, { signal })
}

export interface CreateCompanyBody {
  name: string
  /** Omitted → the API derives a unique code from the name. */
  code?: string | null
  city?: string | null
  logoUrl?: string | null
  primaryBranch: { name: string; area?: string | null; address?: string | null; phone?: string | null }
  contact: { name?: string | null; email?: string | null; phone?: string | null }
  subscription: { planId: number; startTrial: boolean }
  /** No HR picker in the console flow — staff are granted from the gym record. */
  assignHrLater?: boolean
}

export interface CreateCompanyResult {
  id: number
  code: string
  name: string
  status: string
  primaryBranchId: number
  subscription: { planId: number; planName: string; status: string; mrr: number }
  createdAt: string
}

/** One transaction on the server: company + primary branch + subscription. */
export function postCompany(body: CreateCompanyBody): Promise<CreateCompanyResult> {
  return apiRequest<CreateCompanyResult>('/api/platform/companies', { method: 'POST', body })
}

export interface CreateBranchBody {
  name: string
  area?: string | null
  address?: string | null
  phone?: string | null
  managerEmployeeId?: number | null
}

/** Branch codes are generated server-side from the company code. */
export function postBranch(companyId: number, body: CreateBranchBody): Promise<{ id: number; code: string; name: string }> {
  return apiRequest(`/api/platform/companies/${companyId}/branches`, { method: 'POST', body })
}

/** Edits a branch name/area/address/phone/manager; the code never changes. */
export function putBranch(
  companyId: number,
  branchId: number,
  body: CreateBranchBody,
): Promise<{ id: number; code: string; name: string }> {
  return apiRequest(`/api/platform/companies/${companyId}/branches/${branchId}`, { method: 'PUT', body })
}

/** Archives a branch: it stays on the ledger but stops accepting new work. */
export function deleteBranch(companyId: number, branchId: number): Promise<void> {
  return apiRequest(`/api/platform/companies/${companyId}/branches/${branchId}`, { method: 'DELETE' })
}

// ------------------------------------------------------------------
// Platform users
// ------------------------------------------------------------------

export interface PlatformUser {
  id: number
  name: string
  email: string
  initials: string
  photoUrl: string | null
  userType: string
  role: string
  roleId: number | null
  scope: string
  companies: CompanyRef[]
  branch: string | null
  branchCode: string | null
  status: string
  lastLoginAt: string | null
  createdOn: string | null
  createdBy: string | null
  /** Preset role label ("Standard HR Manager"), null for custom roles. */
  preset?: string | null
  permissionCount: number
}

export interface PlatformUserCounts {
  total: number
  hrManagers: number
  hr: number
  branchManagers: number
  teamLeaders: number
  employees: number
  active: number
  suspended: number
}

export interface PlatformUserListParams {
  search?: string
  companyId?: string
  role?: string
  status?: string
  pageNumber?: number
  pageSize?: number
}

export function getPlatformUsers(
  params: PlatformUserListParams = {},
  signal?: AbortSignal,
): Promise<Paged<PlatformUser> & { counts: PlatformUserCounts }> {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.companyId) query.set('companyId', params.companyId)
  if (params.role) query.set('role', params.role)
  if (params.status) query.set('status', params.status)
  query.set('pageNumber', String(params.pageNumber ?? 1))
  query.set('pageSize', String(params.pageSize ?? 25))

  return apiRequest(`/api/platform/users?${query}`, { signal })
}

export interface PlatformUserDetail {
  id: number
  name: string
  email: string
  phone: string | null
  initials: string
  photoUrl: string | null
  dateOfBirth: string | null
  gender: string | null
  nationalId: string | null
  hireDate: string | null
  userType: string
  role: string
  roleId: number | null
  roleType: string | null
  roleScope: string | null
  status: string
  company: CompanyRef | null
  branch: { id: number; name: string; code: string } | null
  companies: CompanyRef[]
  preset: string | null
  joinedOn: string | null
  createdBy: string | null
  lastLoginAt: string | null
  permissions: { total: number; groups: Record<string, number> }
  recentAudit: { id: number; action: string; target: string | null; severity: string | null; occurredAt: string }[]
}

export function getPlatformUser(id: number, signal?: AbortSignal): Promise<PlatformUserDetail> {
  return apiRequest<PlatformUserDetail>(`/api/platform/users/${id}`, { signal })
}

export interface CreateUserBody {
  fullName: string
  email: string
  phone?: string | null
  userType: 'HR' | 'Employee'
  companyIds?: number[] | null
  roleId?: number | null
  sendInvite?: boolean
}

export function postCreateUser(body: CreateUserBody): Promise<PlatformUserDetail> {
  return apiRequest<PlatformUserDetail>('/api/platform/users', { method: 'POST', body })
}

export function postCreateHrManager(body: {
  fullName: string
  email: string
  phone?: string | null
  presetRoleId?: number | null
  /** Initial sign-in password; omitted keeps the platform's temporary password. */
  password?: string | null
  dateOfBirth?: string | null
  gender?: string | null
  nationalId?: string | null
  hireDate?: string | null
  /** Downscaled avatar as a data URL. */
  photoUrl?: string | null
  sendInvite?: boolean
}) {
  return apiRequest<{
    id: number
    fullName: string
    email: string
    userType: string
    status: string
    scope: string
    inviteSent: boolean
  }>('/api/platform/users/hr-managers', { method: 'POST', body })
}

export function putPlatformUserStatus(id: number, body: { status: string; reason?: string | null }) {
  return apiRequest<{ id: number; status: string; sessionsRevoked: number; changedAt: string }>(
    `/api/platform/users/${id}/status`,
    { method: 'PUT', body },
  )
}

export function postResetPassword(
  id: number,
): Promise<{ userId: number; email: string; resetLinkSent: boolean; sessionsRevoked: number }> {
  return apiRequest(`/api/platform/users/${id}/reset-password`, {
    method: 'POST',
    body: { revokeSessions: true },
  })
}

export function postRevokeSessions(id: number): Promise<{ userId: number; sessionsRevoked: number }> {
  return apiRequest(`/api/platform/users/${id}/revoke-sessions`, {
    method: 'POST',
    body: { reason: 'Revoked from the Super Admin console' },
  })
}

// ------------------------------------------------------------------
// Plans
// ------------------------------------------------------------------

export interface SubscriptionPlan {
  id: number
  name: string
  slug: string
  tagline: string | null
  price: number
  currency: string
  cycleCount: number
  cycleUnit: string
  cycleLabel: string
  trialMode: string
  trialDays: number
  seatLimit: number | null
  branchLimit: number | null
  isHighlighted: boolean
  isArchived: boolean
  sortOrder: number
  features: string[]
  addOns: { name: string; quantity: number; price: number }[]
  companiesOnPlan: number
  mrr: number
  mrrSharePercent: number
}

export function getPlans(signal?: AbortSignal): Promise<{ items: SubscriptionPlan[] }> {
  return apiRequest('/api/platform/plans', { signal })
}

/** Create/update body. Edits apply to new sign-ups; existing companies keep their snapshot. */
export interface PlanUpsertBody {
  name: string
  tagline?: string | null
  price: number
  cycleCount: number
  /** Months | Years */
  cycleUnit: string
  /** None | Days | TrialPlan */
  trialMode: string
  trialDays: number
  seatLimit: number | null
  branchLimit: number | null
  isHighlighted: boolean
  features: string[]
  addOns?: { name: string; quantity: number; price: number }[]
}

export function postPlan(body: PlanUpsertBody): Promise<SubscriptionPlan> {
  return apiRequest('/api/platform/plans', { method: 'POST', body })
}

export function putPlan(id: number, body: PlanUpsertBody): Promise<SubscriptionPlan> {
  return apiRequest(`/api/platform/plans/${id}`, { method: 'PUT', body })
}

// ------------------------------------------------------------------
// Invoices
// ------------------------------------------------------------------

export interface InvoiceListItem {
  id: number
  invoiceNumber: string
  company: CompanyRef
  periodLabel: string
  plan: { id: number; name: string; cycleLabel: string } | null
  amount: number
  currency: string
  status: string
  issuedOn: string
  dueOn: string
  paidOn: string | null
  daysOverdue: number
  periodStart: string
  periodEnd: string
  subscriptionStart: string | null
  subscriptionEnd: string | null
}

export interface InvoiceSummary {
  billed: number
  collected: number
  outstanding: number
  openInvoices: number
  overdueInvoices: number
}

export interface InvoiceListParams {
  status?: string
  companyId?: number
  period?: string
  search?: string
  pageNumber?: number
  pageSize?: number
}

function invoiceQuery(params: InvoiceListParams): URLSearchParams {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.companyId) query.set('companyId', String(params.companyId))
  if (params.period) query.set('period', params.period)
  if (params.search) query.set('search', params.search)
  query.set('pageNumber', String(params.pageNumber ?? 1))
  query.set('pageSize', String(params.pageSize ?? 25))
  return query
}

export function getInvoices(
  params: InvoiceListParams = {},
  signal?: AbortSignal,
): Promise<Paged<InvoiceListItem> & { summary: InvoiceSummary }> {
  return apiRequest(`/api/platform/invoices?${invoiceQuery(params)}`, { signal })
}

export interface InvoiceDetail {
  id: number
  invoiceNumber: string
  status: string
  company: CompanyRef & { contactEmail: string | null }
  periodLabel: string
  periodStart: string
  periodEnd: string
  amount: number
  amountPaid: number
  currency: string
  issuedOn: string
  dueOn: string
  paidOn: string | null
  daysOverdue: number
  lineItems: { description: string; quantity: number; unitPrice: number; amount: number }[]
  payments: { id: number; amount: number; paidOn: string; method: string; reference: string | null }[]
  notes: string | null
}

export function getInvoice(id: number, signal?: AbortSignal): Promise<InvoiceDetail> {
  return apiRequest<InvoiceDetail>(`/api/platform/invoices/${id}`, { signal })
}

export function postRecordPayment(
  id: number,
  body: { amount: number; paidOn?: string | null; method?: string; reference?: string | null },
): Promise<{
  invoiceId: number
  status: string
  paidOn: string | null
  amountPaid: number
  amountRemaining: number
  companyStatus: string
  payrollBlocked: boolean
}> {
  return apiRequest(`/api/platform/invoices/${id}/payments`, { method: 'POST', body })
}

export function postSendReminder(
  id: number,
): Promise<{ invoiceId: number; sentTo: string | null; sentAt: string; mailConfigured: boolean }> {
  return apiRequest(`/api/platform/invoices/${id}/reminders`, { method: 'POST', body: { channel: 'Email' } })
}

export function postVoidInvoice(id: number, reason: string): Promise<{ id: number; status: string; voidedAt: string }> {
  return apiRequest(`/api/platform/invoices/${id}/void`, { method: 'POST', body: { reason } })
}

export function downloadInvoicePdf(id: number, invoiceNumber: string): Promise<{ blob: Blob; fileName: string | null }> {
  return apiDownload(`/api/platform/invoices/${id}/pdf`).then((result) => ({
    ...result,
    fileName: result.fileName ?? `${invoiceNumber}.pdf`,
  }))
}

export function downloadInvoiceCsv(params: InvoiceListParams = {}): Promise<{ blob: Blob; fileName: string | null }> {
  return apiDownload(`/api/platform/invoices/export?${invoiceQuery(params)}`)
}

// ------------------------------------------------------------------
// Revenue
// ------------------------------------------------------------------

export interface RevenueSummary {
  period: string
  previousPeriod: string | null
  mrr: {
    value: number
    changePercent: number
    payingCompanies: number
    totalCompanies: number
    averagePerCompany: number
    arr: number
  }
  gross: { value: number; changePercent: number; invoiceCount: number; averageInvoice: number }
  collected: { value: number; changePercent: number; collectionRatePercent: number; invoicesPaid: number }
  outstanding: { value: number; changePercent: number; shareOfBilledPercent: number; oldestDaysLate: number }
}

export function getRevenuePeriods(signal?: AbortSignal): Promise<{ periods: string[]; current: string | null }> {
  return apiRequest('/api/platform/revenue/periods', { signal })
}

export function getRevenueSummary(period?: string, signal?: AbortSignal): Promise<RevenueSummary> {
  const suffix = period ? `?period=${encodeURIComponent(period)}` : ''
  return apiRequest(`/api/platform/revenue/summary${suffix}`, { signal })
}

export interface RevenueTrendPoint {
  label: string
  period: string
  mrr: number
}

export function getRevenueTrend(
  months = 12,
  signal?: AbortSignal,
): Promise<{ series: RevenueTrendPoint[]; changePercent: number }> {
  return apiRequest(`/api/platform/revenue/trend?months=${months}`, { signal })
}

export interface RevenuePerCompanyRow {
  companyId: number
  companyName: string
  city: string | null
  code: string
  planName: string
  cycleLabel: string
  mrr: number
  mrrSharePercent: number
  billed: number
  collected: number
  outstanding: number
  renewsOn: string | null
  billingCycle: string | null
  settlementStatus: string
}

export function getRevenuePerCompany(
  period?: string,
  signal?: AbortSignal,
): Promise<{ period: string; items: RevenuePerCompanyRow[] }> {
  const suffix = period ? `?period=${encodeURIComponent(period)}` : ''
  return apiRequest(`/api/platform/revenue/per-company${suffix}`, { signal })
}

export interface RevenueOutstanding {
  period: string
  outstanding: number
  shareOfBilledPercent: number
  oldestDaysLate: number
  buckets: { key: string; label: string; count: number; amount: number }[]
  items: {
    invoiceId: number
    invoiceNumber: string
    companyId: number
    companyName: string
    planName: string
    amount: number
    issuedOn: string
    dueOn: string
    daysLate: number
  }[]
}

export function getRevenueOutstanding(period?: string, signal?: AbortSignal): Promise<RevenueOutstanding> {
  const suffix = period ? `?period=${encodeURIComponent(period)}` : ''
  return apiRequest(`/api/platform/revenue/outstanding${suffix}`, { signal })
}

export function downloadRevenueCsv(metric: string, period?: string): Promise<{ blob: Blob; fileName: string | null }> {
  const query = new URLSearchParams({ metric })
  if (period) query.set('period', period)
  return apiDownload(`/api/platform/revenue/export?${query}`)
}

// ------------------------------------------------------------------
// Attendance stations
// ------------------------------------------------------------------

export interface StationCodeSummary {
  gymId: number
  gymName: string
  code: string
  generatedAt: string
  expiresAtUtc: string | null
  generatedBy: number | null
}

export interface StationSessionSummary {
  id: number
  createdAtUtc: string
  expiresAtUtc: string
  ipAddress: string | null
  deviceInfo: string | null
  latitude: number | null
  longitude: number | null
  locationAccuracyMeters: number | null
}

export interface StationGymSummary {
  gymId: number
  gymName: string
  companyId: number
  companyName: string
  city: string | null
  lastConnectedAt: string | null
  sessions: StationSessionSummary[]
}

/** Every gym with the sessions that are live right now (codes never travel here). */
export function getStationOverview(signal?: AbortSignal): Promise<{ items: StationGymSummary[] }> {
  return apiRequest('/api/platform/stations', { signal })
}

/** Rotates the gym's 6-digit enrollment code; the previous code stops working immediately. */
export function rotateGymStationCode(gymId: number): Promise<StationCodeSummary> {
  return apiRequest(`/api/gyms/${gymId}/station-codes`, { method: 'POST' })
}

/** Disconnects every kiosk enrolled at the gym; they must redeem a fresh code. */
export function revokeGymStationSessions(gymId: number): Promise<{ revokedCount: number }> {
  return apiRequest(`/api/gyms/${gymId}/station-sessions`, { method: 'DELETE' })
}

// ------------------------------------------------------------------
// Settings & feature flags
// ------------------------------------------------------------------

export interface PlatformSettings {
  security: {
    passwordRotationDays: number
    sessionLifetimeMinutes: number
    maxFailedSignIns: number
    lockoutMinutes: number
    requireMfa: boolean
  }
  localization: { defaultLanguage: string; supportedLanguages: string[]; defaultTimeZone: string }
  branding: { platformName: string; primaryColor: string; supportEmail: string }
  billing: { currency: string; invoiceDueDays: number; legalName: string; taxRegistration: string | null; billingEmail: string }
  audit: { platformEventsYears: number; companyEventsYears: number; exportRetentionDays: number }
}

export function getSettings(signal?: AbortSignal): Promise<PlatformSettings> {
  return apiRequest<PlatformSettings>('/api/platform/settings', { signal })
}

export function putSettings(body: Record<string, unknown>): Promise<PlatformSettings> {
  return apiRequest<PlatformSettings>('/api/platform/settings', { method: 'PUT', body })
}

export interface FeatureFlag {
  id: number
  key: string
  name: string
  description: string | null
  isEnabled: boolean
  scope: string
  targets: { planId: number | null; companyId: number | null }[]
  updatedAt: string | null
}

export function getFeatureFlags(signal?: AbortSignal): Promise<{ items: FeatureFlag[] }> {
  return apiRequest('/api/platform/feature-flags', { signal })
}

export function putFeatureFlag(
  id: number,
  body: { key: string; name: string; description?: string | null; isEnabled: boolean; scope?: string; targets?: unknown[] },
): Promise<FeatureFlag> {
  return apiRequest<FeatureFlag>(`/api/platform/feature-flags/${id}`, { method: 'PUT', body })
}

export function postFeatureFlag(body: {
  key: string
  name: string
  description?: string | null
  isEnabled: boolean
  scope?: string
  targets?: unknown[]
}): Promise<FeatureFlag> {
  return apiRequest<FeatureFlag>('/api/platform/feature-flags', { method: 'POST', body })
}

// ------------------------------------------------------------------
// Impersonation
// ------------------------------------------------------------------

export interface StartWorkspaceResponse {
  sessionId: number
  accessToken: string
  expiresInSeconds: number
  company: CompanyRef
  branch: { id: number; name: string } | null
  effectiveRole: { id: number; name: string } | null
  actor: { userId: number; name: string; userType: string }
  startedAt: string
  expiresAt: string
}

export function getLauncherRoles(
  signal?: AbortSignal,
): Promise<{ items: { roleId: number; name: string; type: string; scope: string }[] }> {
  return apiRequest('/api/platform/impersonation/roles', { signal })
}

export function postStartWorkspace(body: {
  companyId: number
  branchId?: number | null
  effectiveRoleId?: number | null
  reason: string
}) {
  return apiRequest<StartWorkspaceResponse>('/api/platform/impersonation/start', { method: 'POST', body })
}

export function postEndWorkspace(sessionId: number) {
  return apiRequest<{ sessionId: number; endedAt: string; durationMinutes: number }>('/api/platform/impersonation/end', {
    method: 'POST',
    body: { sessionId },
  })
}

export interface CurrentWorkspace {
  active: boolean
  sessionId: number | null
  companyId: number | null
  companyName: string | null
  branchId: number | null
  branchName: string | null
  effectiveRole: string | null
  actorName: string | null
  startedAt: string | null
  expiresAt: string | null
}

export function getCurrentWorkspace(signal?: AbortSignal): Promise<CurrentWorkspace> {
  return apiRequest<CurrentWorkspace>('/api/platform/impersonation/current', { signal })
}
