import { apiRequest } from '../../../lib/api-client'
import type { EvaluationCriterion } from './employee-file.api'

/**
 * Team Leader / Branch Manager portal (mock §13-§19 management pages):
 *  - teams        GET   /api/teams/my-teams                        → TeamSummary[]
 *  - team day     GET   /api/teams/{teamId}/today?date=            → TeamToday
 *  - unscheduled  GET   /api/teams/{teamId}/unscheduled-count      → { count }
 *  - follow-ups   GET   /api/teams/follow-ups?teamId=              → TeamFollowUp[]
 *                 POST  /api/teams/follow-ups                      → TeamFollowUp
 *                 PUT   /api/teams/follow-ups/{id}                 → TeamFollowUp
 *  - remind       POST  /api/teams/members/{employeeId}/reminders  → 204
 *  - message      POST  /api/employees/{employeeId}/messages       → 204
 *  - evaluations  GET   /api/teams/{teamId}/evaluations            → EvaluationDto[]
 *  - cycles       GET/POST /api/gyms/{gymId}/shift-cycles
 *  - cycle detail GET   /api/shift-cycles/{id}                     (legend + roster + conflicts)
 *  - cycle ops    POST  /api/shift-cycles/{id}/copy-previous | /publish
 *  - conflicts    GET   /api/shift-cycles/{id}/conflicts
 *  - assignments  PUT   /api/shift-cycles/{id}/assignments         (draft cycles only)
 *  - templates    GET   /api/gyms/{gymId}/shift-templates
 */

/* ==================== Teams (mock §13 My Team) ==================== */

/** GET /api/teams/my-teams — a team the caller leads or belongs to. */
export interface TeamSummary {
  id: number
  name: string
  gymId: number
  memberCount: number
}

export interface TeamStats {
  total: number
  present: number
  late: number
  absent: number
  pendingRequests: number
}

/** One member row of the team-day overview. checkIn is TimeOnly "HH:mm:ss" or null. */
export interface TeamMemberDay {
  employeeId: number
  name: string
  position: string
  status: string
  checkIn: string | null
  initials: string
  shiftName: string | null
  shiftStart: string | null
  shiftEnd: string | null
  isOff: boolean
}

export interface TeamToday {
  teamId: number
  teamName: string
  stats: TeamStats
  members: TeamMemberDay[]
}

/** GET /api/teams/{teamId}/unscheduled-count → { count }. */
export function getMyTeams(signal?: AbortSignal): Promise<TeamSummary[]> {
  return apiRequest<TeamSummary[]>('/api/teams/my-teams', { signal })
}

export function getTeamToday(teamId: number, date: string | null, signal?: AbortSignal): Promise<TeamToday> {
  const query = date ? `?date=${date}` : ''
  return apiRequest<TeamToday>(`/api/teams/${teamId}/today${query}`, { signal })
}

export function getUnscheduledCount(teamId: number, signal?: AbortSignal): Promise<number> {
  return apiRequest<{ count: number }>(`/api/teams/${teamId}/unscheduled-count`, { signal }).then(
    (body) => body.count,
  )
}

/* ==================== Team Actions (mock §19) ==================== */

/** Severity values: Low | Medium | High. */
export type FollowUpSeverity = 'Low' | 'Medium' | 'High'

/** GET /api/teams/follow-ups — one follow-up item of the caller's scope. */
export interface TeamFollowUp {
  id: number
  employeeId: number
  employee: string
  /** null when a Branch Manager raised it about an employee in no team yet. */
  teamId: number | null
  /** Deduction | Warning | EscalateToHR | Reminder | Resolution. */
  actionType: string
  description: string
  severity: string
  lastAction: string | null
  note: string | null
  isResolved: boolean
}

export interface CreateTeamFollowUpInput {
  employeeId: number
  action: string
  severity: string | null
  description: string
  note: string | null
  /** DateOnly "yyyy-MM-dd" — the day a Deduction punishes (defaults to today). */
  date?: string | null
  /** Quarter Day | Half Day | Day | 3 Days — prices the Deduction candidate. */
  deductionSize?: string | null
}

export interface UpdateTeamFollowUpInput {
  action: string
  note: string | null
}

export function getTeamFollowUps(teamId: number | null, signal?: AbortSignal): Promise<TeamFollowUp[]> {
  const query = teamId ? `?teamId=${teamId}` : ''
  return apiRequest<TeamFollowUp[]>(`/api/teams/follow-ups${query}`, { signal })
}

export function createTeamFollowUp(input: CreateTeamFollowUpInput): Promise<TeamFollowUp> {
  return apiRequest<TeamFollowUp>('/api/teams/follow-ups', { method: 'POST', body: input })
}

export function updateTeamFollowUp(id: number, input: UpdateTeamFollowUpInput): Promise<TeamFollowUp> {
  return apiRequest<TeamFollowUp>(`/api/teams/follow-ups/${id}`, { method: 'PUT', body: input })
}

/** POST /api/teams/members/{employeeId}/reminders → 204 No Content. */
export function sendReminder(employeeId: number): Promise<void> {
  return apiRequest<void>(`/api/teams/members/${employeeId}/reminders`, { method: 'POST' })
}

/** POST /api/employees/{employeeId}/messages { message } → 204 No Content. */
export function sendTeamMessage(employeeId: number, message: string): Promise<void> {
  return apiRequest<void>(`/api/employees/${employeeId}/messages`, {
    method: 'POST',
    body: { message },
  })
}

/* ==================== Team Performance (mock §18) ==================== */

/** One team evaluation row: the shared EvaluationDto plus the reviewed employee. */
export interface TeamEvaluation {
  id: number
  employeeId: number
  employeeName: string
  period: string
  score: number
  maxScore: number
  status: string
  date: string
  reviewer: string
  criteria: EvaluationCriterion[]
  overallComment: string | null
}

export function getTeamEvaluations(teamId: number, signal?: AbortSignal): Promise<TeamEvaluation[]> {
  return apiRequest<TeamEvaluation[]>(`/api/teams/${teamId}/evaluations`, { signal })
}

/* ==================== Team Schedule (mock §13.9 / §16) ==================== */

/** One cycle chip of the period strip. status: Draft | Published | Archived. */
export interface ShiftCycleItem {
  id: number
  label: string
  status: string
  /** Cycle start, yyyy-MM-dd. */
  startDate: string
  /** Cycle end (inclusive), yyyy-MM-dd. */
  endDate: string
}

/** One palette/legend entry — colors are server presentation hints. */
export interface ShiftTemplateItem {
  id: number
  name: string
  /** "HH:mm" ("00:00" when overnight). */
  start: string
  end: string
  color: string
  bgColor: string
  textColor: string
  isOff: boolean
}

/** Exact value of one date inside the cycle. assigned=false = no row written. */
export interface ShiftAssignmentDateCell {
  /** yyyy-MM-dd. */
  date: string
  /** Shift template id, or null for an explicit Off day. */
  shiftTemplateId: number | null
  assigned: boolean
}

/**
 * One roster row: days[0 = Monday … 6 = Sunday] hold template ids or null (Off).
 * assignedDays tells an explicit Off day (true + null) from a day that was never
 * assigned (false) — the grid renders the latter as "Not assigned".
 *
 * daysByDate carries the exact value of every date in the cycle. The weekday
 * pattern is what the editors write, but a cycle may hold a date-specific
 * override; the Branch Schedule renders daysByDate so it always shows the same
 * value an employee sees in their Shift tab for that date.
 */
export interface ShiftRosterRow {
  employeeId: number
  name: string
  position: string
  gym: string
  initials: string
  days: (number | null)[]
  assignedDays: boolean[]
  /** Present on current servers; optional so an older cached response still renders. */
  daysByDate?: ShiftAssignmentDateCell[]
}

export interface ShiftConflictItem {
  employeeId: number
  /** 0 = Monday … 6 = Sunday. */
  day: number
  message: string
}

/** GET /api/shift-cycles/{id} — legend, roster and current conflicts. */
export interface ShiftCycleDetail {
  id: number
  label: string
  status: string
  /** yyyy-MM-dd; anchors the weekly pattern. */
  startDate: string
  /** yyyy-MM-dd (inclusive). */
  endDate: string
  shiftTemplates: ShiftTemplateItem[]
  assignments: ShiftRosterRow[]
  conflicts: ShiftConflictItem[]
}

export interface ShiftCycleCreated {
  data: ShiftCycleItem
}

export interface SetAssignmentInput {
  employeeId: number
  day: number
  /** null = explicit Off day. Days never written stay "Not assigned". */
  shiftTemplateId: number | null
}

export function getShiftCycles(gymId: number, signal?: AbortSignal): Promise<ShiftCycleItem[]> {
  return apiRequest<ShiftCycleItem[]>(`/api/gyms/${gymId}/shift-cycles`, { signal })
}

export function createShiftCycle(
  gymId: number,
  input: { label: string | null; startDate: string; endDate: string },
): Promise<ShiftCycleItem> {
  return apiRequest<ShiftCycleCreated>(`/api/gyms/${gymId}/shift-cycles`, { method: 'POST', body: input }).then(
    (body) => body.data,
  )
}

export function getShiftCycle(cycleId: number, signal?: AbortSignal): Promise<ShiftCycleDetail> {
  return apiRequest<ShiftCycleDetail>(`/api/shift-cycles/${cycleId}`, { signal })
}

/** POST copy-previous — { sourceCycleId? }; omitted picks the latest earlier cycle. */
export function copyPreviousCycle(
  cycleId: number,
  sourceCycleId: number | null,
): Promise<{ message: string; copied: number }> {
  return apiRequest<{ message: string; copied: number }>(`/api/shift-cycles/${cycleId}/copy-previous`, {
    method: 'POST',
    body: sourceCycleId ? { sourceCycleId } : {},
  })
}

/** POST publish — notifies scheduled employees; warns in message about unresolved conflicts. */
export function publishShiftCycle(cycleId: number): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/shift-cycles/${cycleId}/publish`, { method: 'POST' })
}

export function getShiftCycleConflicts(
  cycleId: number,
  signal?: AbortSignal,
): Promise<{ conflicts: ShiftConflictItem[]; count: number }> {
  return apiRequest<{ conflicts: ShiftConflictItem[]; count: number }>(
    `/api/shift-cycles/${cycleId}/conflicts`,
    { signal },
  )
}

/** PUT /api/shift-cycles/{id}/assignments — draft cycles only; null id = Off. */
export function setShiftAssignments(cycleId: number, assignments: SetAssignmentInput[]): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/shift-cycles/${cycleId}/assignments`, {
    method: 'PUT',
    body: { assignments },
  })
}

export function getShiftTemplates(gymId: number, signal?: AbortSignal): Promise<ShiftTemplateItem[]> {
  return apiRequest<ShiftTemplateItem[]>(`/api/gyms/${gymId}/shift-templates`, { signal })
}

/** Raw template of the management surface (api/gyms/{gymId}/shift-templates). */
export interface ShiftTemplateDtoApi {
  id: number
  name: string
  /** "HH:mm:ss". */
  start: string
  end: string
  /** Base #rrggbb color chosen for the template. */
  color: string
}

/** POST /api/gyms/{gymId}/shift-templates — creates a template with its color. */
export function createShiftTemplate(
  gymId: number,
  input: { name: string; start: string; end: string; color: string },
): Promise<ShiftTemplateDtoApi> {
  return apiRequest<ShiftTemplateDtoApi>(`/api/gyms/${gymId}/shift-templates`, { method: 'POST', body: input })
}

/** PUT /api/gyms/{gymId}/shift-templates/{id} — renames / re-times / re-colors a template. */
export function updateShiftTemplate(
  gymId: number,
  templateId: number,
  input: { name: string; start: string; end: string; color: string },
): Promise<ShiftTemplateDtoApi> {
  return apiRequest<ShiftTemplateDtoApi>(`/api/gyms/${gymId}/shift-templates/${templateId}`, {
    method: 'PUT',
    body: input,
  })
}

/** DELETE /api/gyms/{gymId}/shift-templates/{id} — cells referencing it become Off. */
export function deleteShiftTemplate(gymId: number, templateId: number): Promise<void> {
  return apiRequest<void>(`/api/gyms/${gymId}/shift-templates/${templateId}`, { method: 'DELETE' })
}

/** DELETE /api/gyms/{gymId}/shift-cycles/{id} — removes the cycle and its assignments. */
export function deleteShiftCycle(gymId: number, cycleId: number): Promise<void> {
  return apiRequest<void>(`/api/gyms/${gymId}/shift-cycles/${cycleId}`, { method: 'DELETE' })
}
