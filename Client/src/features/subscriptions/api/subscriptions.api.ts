import { apiRequest } from '../../../lib/api-client'

/** Mirrors ApplicationLayer SubscriptionStatus. */
export type SubscriptionStatus = 'Active' | 'GracePeriod' | 'Suspended' | 'Cancelled'
export type SubscriptionInvoiceStatus = 'Pending' | 'Paid' | 'Overdue' | 'Void'

export interface SubscriptionSettings {
  defaultBillingCycleMonths: number
  defaultGracePeriodDays: number
  reminderLeadDays: number
  autoSuspensionEnabled: boolean
  currency: string
}

export interface SubscriptionSummary {
  totalGyms: number
  activeCount: number
  gracePeriodCount: number
  suspendedCount: number
  overdueInvoiceCount: number
  outstandingTotal: number
  collectedTotal: number
}

export interface GymSubscription {
  gymId: number
  gymName: string
  branch: string | null
  status: SubscriptionStatus
  planId: number | null
  planName: string | null
  amount: number
  currency: string
  billingCycleMonths: number
  gracePeriodDays: number
  reminderLeadDays: number
  gracePeriodDaysOverride: number | null
  reminderLeadDaysOverride: number | null
  autoSuspensionEnabled: boolean
  billingStartDate: string
  nextDueDate: string | null
  daysUntilDue: number | null
  daysOverdue: number
  inGracePeriod: boolean
  outstandingAmount: number
  unpaidInvoiceCount: number
  lastPaymentAtUtc: string | null
  suspendedAtUtc: string | null
  suspensionReason: string | null
  isSuspensionManual: boolean
  cancelledAtUtc: string | null
  accessOverrideUntil: string | null
}

export interface GymSubscriptionCandidate {
  gymId: number
  gymName: string
  branch: string | null
}

export interface SubscriptionInvoice {
  id: number
  invoiceNumber: string
  periodStart: string
  periodEnd: string
  dueDate: string
  graceEndsOn: string
  amount: number
  amountPaid: number
  balance: number
  status: SubscriptionInvoiceStatus
  issuedAtUtc: string
  paidAtUtc: string | null
  reminderSent: boolean
  overdueNoticeSent: boolean
  triggeredSuspension: boolean
}

export interface SubscriptionPayment {
  id: number
  invoiceId: number
  invoiceNumber: string
  amount: number
  paidAtUtc: string
  method: string
  reference: string | null
  notes: string | null
  recordedByUserId: number | null
}

export interface SubscriptionOverview {
  settings: SubscriptionSettings
  summary: SubscriptionSummary
  items: GymSubscription[]
  unconfiguredGyms: GymSubscriptionCandidate[]
}

export interface GymSubscriptionDetail {
  subscription: GymSubscription
  settings: SubscriptionSettings
  invoices: SubscriptionInvoice[]
  payments: SubscriptionPayment[]
}

export interface SubscriptionActionResponse {
  message: string
  subscription: GymSubscriptionDetail
}

export interface RunSubscriptionCycleResponse {
  message: string
  gymsProcessed: number
  invoicesCreated: number
  remindersSent: number
  overdueNoticesSent: number
  gymsSuspended: number
  gymsReactivated: number
}

export interface SubscriptionPlan {
  id: number
  name: string
  description: string | null
  pricePerCycle: number
  billingCycleMonths: number
  gracePeriodDays: number | null
  reminderLeadDays: number | null
  isActive: boolean
  sortOrder: number
  gymCount: number
}

export interface SaveSubscriptionPlanBody {
  name: string
  description?: string | null
  pricePerCycle: number
  billingCycleMonths: number
  gracePeriodDays?: number | null
  reminderLeadDays?: number | null
  isActive: boolean
  sortOrder: number
}

export interface SubscriptionRequest {
  id: number
  gymId: number
  gymName: string
  type: 'Renewal' | 'PlanChange' | string
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | string
  currentPlanName: string | null
  requestedPlanName: string | null
  requestedByUserName: string
  note: string | null
  createdAtUtc: string
  reviewedAtUtc: string | null
  reviewNote: string | null
}

export interface CreateSubscriptionRequestBody {
  type: 'Renewal' | 'PlanChange'
  requestedPlanId?: number | null
  note?: string | null
}

export interface MySubscriptionResponse {
  subscription: GymSubscriptionDetail
  availablePlans: SubscriptionPlan[]
  pendingRequests: SubscriptionRequest[]
}

export interface SaveSubscriptionBody {
  amount: number
  billingCycleMonths: number
  gracePeriodDays?: number | null
  reminderLeadDays?: number | null
  autoSuspensionEnabled: boolean
  billingStartDate?: string | null
  planId?: number | null
  nextDueDate?: string | null
}

export interface RecordSubscriptionPaymentBody {
  amount: number
  method: string
  reference?: string | null
  notes?: string | null
  paidAtUtc?: string | null
}

export function getSubscriptions(signal?: AbortSignal): Promise<SubscriptionOverview> {
  return apiRequest<SubscriptionOverview>('/api/subscriptions', { signal })
}

export function getSubscription(gymId: number, signal?: AbortSignal): Promise<GymSubscriptionDetail> {
  return apiRequest<GymSubscriptionDetail>(`/api/subscriptions/${gymId}`, { signal })
}

export function putSubscription(gymId: number, body: SaveSubscriptionBody): Promise<SubscriptionActionResponse> {
  return apiRequest<SubscriptionActionResponse>(`/api/subscriptions/${gymId}`, { method: 'PUT', body })
}

export function postSubscriptionPayment(
  gymId: number,
  body: RecordSubscriptionPaymentBody,
): Promise<SubscriptionActionResponse> {
  return apiRequest<SubscriptionActionResponse>(`/api/subscriptions/${gymId}/payments`, { method: 'POST', body })
}

export function postSuspendSubscription(gymId: number, reason: string): Promise<SubscriptionActionResponse> {
  return apiRequest<SubscriptionActionResponse>(`/api/subscriptions/${gymId}/suspend`, {
    method: 'POST',
    body: { reason },
  })
}

export function postReactivateSubscription(
  gymId: number,
  overrideDays: number | null,
): Promise<SubscriptionActionResponse> {
  return apiRequest<SubscriptionActionResponse>(`/api/subscriptions/${gymId}/reactivate`, {
    method: 'POST',
    body: { overrideDays },
  })
}

export function putSubscriptionSettings(body: SubscriptionSettings): Promise<SubscriptionSettings> {
  return apiRequest<SubscriptionSettings>('/api/subscriptions/settings', { method: 'PUT', body })
}

export function postRunSubscriptionCycle(): Promise<RunSubscriptionCycleResponse> {
  return apiRequest<RunSubscriptionCycleResponse>('/api/subscriptions/run-cycle', { method: 'POST' })
}

// ---------------------------------------------------------------------------
// Plan catalog
// ---------------------------------------------------------------------------

export function getSubscriptionPlans(signal?: AbortSignal): Promise<SubscriptionPlan[]> {
  return apiRequest<SubscriptionPlan[]>('/api/subscription-plans', { signal })
}

export function postSubscriptionPlan(body: SaveSubscriptionPlanBody): Promise<SubscriptionPlan> {
  return apiRequest<SubscriptionPlan>('/api/subscription-plans', { method: 'POST', body })
}

export function putSubscriptionPlan(planId: number, body: SaveSubscriptionPlanBody): Promise<SubscriptionPlan> {
  return apiRequest<SubscriptionPlan>(`/api/subscription-plans/${planId}`, { method: 'PUT', body })
}

export function deleteSubscriptionPlan(planId: number): Promise<void> {
  return apiRequest<void>(`/api/subscription-plans/${planId}`, { method: 'DELETE' })
}

// ---------------------------------------------------------------------------
// Gym-side self-service + request review
// ---------------------------------------------------------------------------

export function getMySubscription(signal?: AbortSignal): Promise<MySubscriptionResponse> {
  return apiRequest<MySubscriptionResponse>('/api/subscriptions/mine', { signal })
}

export function postMySubscriptionRequest(body: CreateSubscriptionRequestBody): Promise<SubscriptionRequest> {
  return apiRequest<SubscriptionRequest>('/api/subscriptions/mine/requests', { method: 'POST', body })
}

export function getSubscriptionRequests(status = 'Pending', signal?: AbortSignal): Promise<SubscriptionRequest[]> {
  return apiRequest<SubscriptionRequest[]>(
    `/api/subscriptions/requests?status=${encodeURIComponent(status)}`,
    { signal },
  )
}

export function postApproveSubscriptionRequest(
  requestId: number,
  note?: string | null,
): Promise<SubscriptionActionResponse> {
  return apiRequest<SubscriptionActionResponse>(`/api/subscriptions/requests/${requestId}/approve`, {
    method: 'POST',
    body: { note: note ?? null },
  })
}

export function postRejectSubscriptionRequest(
  requestId: number,
  note?: string | null,
): Promise<SubscriptionActionResponse> {
  return apiRequest<SubscriptionActionResponse>(`/api/subscriptions/requests/${requestId}/reject`, {
    method: 'POST',
    body: { note: note ?? null },
  })
}
