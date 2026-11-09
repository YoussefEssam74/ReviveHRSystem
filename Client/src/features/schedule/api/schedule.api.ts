import { apiRequest } from '../../../lib/api-client'

/** One cycle selector chip (GET /api/gyms/{gymId}/shift-cycles). */
export interface ShiftCycle {
  id: number
  label: string
  /** 'Draft' | 'Published' | 'Archived'. */
  status: string
}

/** One reusable shift template (GET /api/gyms/{gymId}/shift-templates). */
export interface ShiftTemplate {
  id: number
  name: string
  /** Start time, HH:mm. */
  start: string
  /** End time, HH:mm (00:00 for overnight shifts). */
  end: string
  color: string
  bgColor: string
  textColor: string
  isOff: boolean
}

/** One employee's weekly pattern row — days[0 = Monday … 6 = Sunday], null = Off. */
export interface ShiftAssignmentRow {
  employeeId: number
  name: string
  position: string
  gym: string
  initials: string
  days: (number | null)[]
}

/** One conflict flag (approved Day Off overlap, cross-gym, out-of-range…). */
export interface ShiftConflict {
  employeeId: number
  /** 0 = Monday … 6 = Sunday. */
  day: number
  message: string
}

/** Cycle detail: legend, roster rows and current conflicts (GET /api/shift-cycles/{id}). */
export interface ShiftCycleDetail {
  id: number
  label: string
  status: string
  shiftTemplates: ShiftTemplate[]
  assignments: ShiftAssignmentRow[]
  conflicts: ShiftConflict[]
}

/** GET /api/gyms/{gymId}/shift-cycles — all cycles of the gym, newest first. */
export function getShiftCycles(gymId: number, signal?: AbortSignal): Promise<ShiftCycle[]> {
  return apiRequest<ShiftCycle[]>(`/api/gyms/${gymId}/shift-cycles`, { signal })
}

/** GET /api/shift-cycles/{id} — the weekly assignment matrix. */
export function getShiftCycle(id: number, signal?: AbortSignal): Promise<ShiftCycleDetail> {
  return apiRequest<ShiftCycleDetail>(`/api/shift-cycles/${id}`, { signal })
}

/** GET /api/gyms/{gymId}/shift-templates — the gym's legend entries. */
export function getShiftTemplates(gymId: number, signal?: AbortSignal): Promise<ShiftTemplate[]> {
  return apiRequest<ShiftTemplate[]>(`/api/gyms/${gymId}/shift-templates`, { signal })
}

export interface CreateShiftCycleBody {
  /** Optional; the server derives "Sep 13 – Sep 22" from the dates when omitted. */
  label?: string
  /** Cycle start, yyyy-MM-dd. */
  startDate: string
  /** Cycle end (inclusive), yyyy-MM-dd. */
  endDate: string
}

/** POST /api/gyms/{gymId}/shift-cycles — creates a Draft cycle (201 { data }). */
export function postShiftCycle(gymId: number, body: CreateShiftCycleBody): Promise<ShiftCycle> {
  return apiRequest<{ data: ShiftCycle }>(`/api/gyms/${gymId}/shift-cycles`, { method: 'POST', body }).then(
    (r) => r.data,
  )
}

/** POST /api/shift-cycles/{id}/publish — publishes a Draft and notifies employees. */
export function postPublishShiftCycle(id: number): Promise<void> {
  return apiRequest<{ message: string }>(`/api/shift-cycles/${id}/publish`, { method: 'POST' }).then(() => undefined)
}

/** Body of a shift-template create/update ({ name, start, end }, times as HH:mm). */
export interface ShiftTemplateBody {
  name: string
  start: string
  end: string
}

/** What POST/PUT /api/gyms/{gymId}/shift-templates return (colors are added on list reads). */
export interface ShiftTemplateRecord {
  id: number
  name: string
  start: string
  end: string
}

export function postShiftTemplate(gymId: number, body: ShiftTemplateBody): Promise<ShiftTemplateRecord> {
  return apiRequest<ShiftTemplateRecord>(`/api/gyms/${gymId}/shift-templates`, { method: 'POST', body })
}

export function putShiftTemplate(gymId: number, templateId: number, body: ShiftTemplateBody): Promise<ShiftTemplateRecord> {
  return apiRequest<ShiftTemplateRecord>(`/api/gyms/${gymId}/shift-templates/${templateId}`, { method: 'PUT', body })
}

/** DELETE /api/gyms/{gymId}/shift-templates/{id} — assigned cells become Off days. */
export function deleteShiftTemplate(gymId: number, templateId: number): Promise<void> {
  return apiRequest<void>(`/api/gyms/${gymId}/shift-templates/${templateId}`, { method: 'DELETE' })
}
