import { apiRequest } from '../../../lib/api-client'

/**
 * Branch Queue — deductions, warning notices and bonus proposals raised by a
 * Branch/Team Leader that are waiting on an HR decision (mock §20 / features.md
 * §9–§10). Approving lands the item on the employee's payroll or record;
 * declining returns it to the submitter with a reason.
 *
 * Reads ride `requests.view`; warning/bonus decisions ride `requests.approve`;
 * deduction decisions ride `payroll.edit`. The API enforces all three — the UI
 * only hides the buttons.
 */

/** The paged envelope every list endpoint returns. */
export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** Wrapped detail payload (`{ data: … }`). */
export interface Wrapped<T> {
  data: T
}

/** A warning notice awaiting HR filing (GET /api/warning-notices items). */
export interface WarningNotice {
  id: number
  employeeId: number
  employee: string
  /** Warning type label (e.g. Conduct, Attendance). */
  type: string
  reason: string
  note: string | null
  /** Pending | Approved | Rejected. */
  status: string
  issuedAt: string
  issuedBy: string
  reviewedBy: string | null
  reviewedAt: string | null
  /** HR's reason when declined. */
  reviewNote: string | null
}

/** A bonus proposal awaiting HR approval (GET /api/bonus-proposals items). */
export interface BonusProposal {
  id: number
  employeeId: number
  employee: string
  type: string
  amount: number
  reason: string
  note: string | null
  status: string
  issuedAt: string
  issuedBy: string
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNote: string | null
}

/** A pending deduction line (GET /api/deduction-candidates items). */
export interface DeductionCandidate {
  id: number
  employeeId: number
  employeeName: string
  gym: string
  period: string
  date: string
  label: string
  reason: string | null
  /** manager | biometric. */
  source: string
  amount: number
  /** Pending | Accepted | Approved | Rejected. */
  status: string
  attendanceRef: string | null
  requestId: number | null
}

export interface ProposalListParams {
  /** Pending | Approved | Rejected; omitted = all. */
  status?: string
  /** Gym id (blank = the actor's full scope). */
  gym?: number
  page?: number
  pageSize?: number
}

function proposalQuery(params: ProposalListParams): string {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.gym != null) query.set('gym', String(params.gym))
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const qs = query.toString()
  return qs ? '?' + qs : ''
}

/** GET /api/warning-notices — HR review queue, newest first. */
export function getWarnings(
  params: ProposalListParams = {},
  signal?: AbortSignal,
): Promise<Paged<WarningNotice>> {
  return apiRequest<Paged<WarningNotice>>(`/api/warning-notices${proposalQuery(params)}`, { signal })
}

/** GET /api/bonus-proposals — HR review queue, newest first. */
export function getBonuses(params: ProposalListParams = {}, signal?: AbortSignal): Promise<Paged<BonusProposal>> {
  return apiRequest<Paged<BonusProposal>>(`/api/bonus-proposals${proposalQuery(params)}`, { signal })
}

/** GET /api/deduction-candidates — pending deduction lines, newest first. */
export function getDeductions(
  params: ProposalListParams = {},
  signal?: AbortSignal,
): Promise<Paged<DeductionCandidate>> {
  return apiRequest<Paged<DeductionCandidate>>(`/api/deduction-candidates${proposalQuery(params)}`, { signal })
}

/** The decision body shared by the warning and bonus review endpoints. */
export interface ReviewProposalBody {
  /** Approved (file/approve) | Rejected (decline). */
  decision: 'Approved' | 'Rejected'
  /** Required when rejecting, optional when approving. */
  note?: string
}

/** POST /api/warning-notices/{id}/review — File (Approved) / Decline (Rejected). */
export function postWarningReview(
  id: number,
  body: ReviewProposalBody,
  signal?: AbortSignal,
): Promise<WarningNotice> {
  return apiRequest<Wrapped<WarningNotice>>(`/api/warning-notices/${id}/review`, {
    method: 'POST',
    body,
    signal,
  }).then((r) => r.data)
}

/** POST /api/bonus-proposals/{id}/review — Approve / Decline (reason required). */
export function postBonusReview(id: number, body: ReviewProposalBody, signal?: AbortSignal): Promise<BonusProposal> {
  return apiRequest<Wrapped<BonusProposal>>(`/api/bonus-proposals/${id}/review`, {
    method: 'POST',
    body,
    signal,
  }).then((r) => r.data)
}

/** POST /api/deduction-candidates/{id}/review — Accept (land in payroll) / Waive. */
export function postDeductionReview(
  id: number,
  decision: 'Accepted' | 'Rejected',
  signal?: AbortSignal,
): Promise<{ id: number; status: string }> {
  return apiRequest<Wrapped<{ id: number; status: string }>>(`/api/deduction-candidates/${id}/review`, {
    method: 'POST',
    body: { decision },
    signal,
  }).then((r) => r.data)
}
