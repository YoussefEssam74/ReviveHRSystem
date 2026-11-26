import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteSubscriptionPlan,
  getMySubscription,
  getSubscriptionPlans,
  getSubscriptionRequests,
  getSubscription,
  getSubscriptions,
  postApproveSubscriptionRequest,
  postMySubscriptionRequest,
  postReactivateSubscription,
  postRejectSubscriptionRequest,
  postRunSubscriptionCycle,
  postSubscriptionPayment,
  postSubscriptionPlan,
  postSuspendSubscription,
  putSubscription,
  putSubscriptionPlan,
  putSubscriptionSettings,
  type CreateSubscriptionRequestBody,
  type RecordSubscriptionPaymentBody,
  type SaveSubscriptionBody,
  type SaveSubscriptionPlanBody,
  type SubscriptionSettings,
} from '../api/subscriptions.api'

const ROOT_KEY = ['subscriptions'] as const
const PLANS_KEY = ['subscription-plans'] as const
const REQUESTS_KEY = ['subscription-requests'] as const
const MY_KEY = [...ROOT_KEY, 'mine'] as const

/** Platform-wide subscription overview (Revive Admin only). */
export function useSubscriptions(enabled: boolean = true) {
  return useQuery({
    queryKey: ROOT_KEY,
    queryFn: ({ signal }) => getSubscriptions(signal),
    enabled,
  })
}

/** One gym's invoices + payment ledger; disabled until a gym is selected. */
export function useSubscription(gymId: number | null) {
  return useQuery({
    queryKey: [...ROOT_KEY, gymId],
    queryFn: ({ signal }) => getSubscription(gymId!, signal),
    enabled: Number.isFinite(gymId) && (gymId ?? 0) > 0,
  })
}

function useInvalidateSubscriptions() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ROOT_KEY })
}

export function useSaveSubscription() {
  const invalidate = useInvalidateSubscriptions()
  return useMutation({
    mutationFn: ({ gymId, body }: { gymId: number; body: SaveSubscriptionBody }) => putSubscription(gymId, body),
    onSuccess: invalidate,
  })
}

export function useRecordSubscriptionPayment() {
  const invalidate = useInvalidateSubscriptions()
  return useMutation({
    mutationFn: ({ gymId, body }: { gymId: number; body: RecordSubscriptionPaymentBody }) =>
      postSubscriptionPayment(gymId, body),
    onSuccess: invalidate,
  })
}

export function useSuspendSubscription() {
  const invalidate = useInvalidateSubscriptions()
  return useMutation({
    mutationFn: ({ gymId, reason }: { gymId: number; reason: string }) => postSuspendSubscription(gymId, reason),
    onSuccess: invalidate,
  })
}

export function useReactivateSubscription() {
  const invalidate = useInvalidateSubscriptions()
  return useMutation({
    mutationFn: ({ gymId, overrideDays }: { gymId: number; overrideDays: number | null }) =>
      postReactivateSubscription(gymId, overrideDays),
    onSuccess: invalidate,
  })
}

export function useUpdateSubscriptionSettings() {
  const invalidate = useInvalidateSubscriptions()
  return useMutation({
    mutationFn: (body: SubscriptionSettings) => putSubscriptionSettings(body),
    onSuccess: invalidate,
  })
}

export function useRunSubscriptionCycle() {
  const invalidate = useInvalidateSubscriptions()
  return useMutation({
    mutationFn: postRunSubscriptionCycle,
    onSuccess: invalidate,
  })
}

// ---------------------------------------------------------------------------
// Plan catalog
// ---------------------------------------------------------------------------

export function useSubscriptionPlans(enabled: boolean = true) {
  return useQuery({
    queryKey: PLANS_KEY,
    queryFn: ({ signal }) => getSubscriptionPlans(signal),
    enabled,
  })
}

export function useCreateSubscriptionPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: SaveSubscriptionPlanBody) => postSubscriptionPlan(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PLANS_KEY })
      void queryClient.invalidateQueries({ queryKey: ROOT_KEY })
    },
  })
}

export function useUpdateSubscriptionPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ planId, body }: { planId: number; body: SaveSubscriptionPlanBody }) =>
      putSubscriptionPlan(planId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PLANS_KEY })
      void queryClient.invalidateQueries({ queryKey: ROOT_KEY })
    },
  })
}

export function useArchiveSubscriptionPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (planId: number) => deleteSubscriptionPlan(planId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PLANS_KEY })
      void queryClient.invalidateQueries({ queryKey: ROOT_KEY })
    },
  })
}

// ---------------------------------------------------------------------------
// Gym-side self-service + request review
// ---------------------------------------------------------------------------

export function useMySubscription(enabled: boolean = true) {
  return useQuery({
    queryKey: MY_KEY,
    queryFn: ({ signal }) => getMySubscription(signal),
    enabled,
  })
}

export function useCreateMySubscriptionRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateSubscriptionRequestBody) => postMySubscriptionRequest(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MY_KEY })
      void queryClient.invalidateQueries({ queryKey: REQUESTS_KEY })
    },
  })
}

export function useSubscriptionRequests(status: string = 'Pending', enabled: boolean = true) {
  return useQuery({
    queryKey: [...REQUESTS_KEY, status],
    queryFn: ({ signal }) => getSubscriptionRequests(status, signal),
    enabled,
  })
}

export function useApproveSubscriptionRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ requestId, note }: { requestId: number; note?: string | null }) =>
      postApproveSubscriptionRequest(requestId, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: REQUESTS_KEY })
      void queryClient.invalidateQueries({ queryKey: ROOT_KEY })
    },
  })
}

export function useRejectSubscriptionRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ requestId, note }: { requestId: number; note?: string | null }) =>
      postRejectSubscriptionRequest(requestId, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: REQUESTS_KEY })
      void queryClient.invalidateQueries({ queryKey: ROOT_KEY })
    },
  })
}
