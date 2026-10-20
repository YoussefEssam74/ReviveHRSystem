/**
 * Sidebar action-count badges (mock core.js computePendingActions): every nav
 * item that has something pending shows a number pill. All counts come from
 * the real API surfaces — small count queries (pageSize=1 with a `total`) and
 * shared query keys, so navigating to a section re-uses already-cached data.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePortalSession } from '../../contexts/PortalSessionContext'
import { getEmployeeDashboard } from '../../features/portal/api/dashboard.api'
import { getRequestInbox } from '../../features/portal/api/requests.api'
import { getShiftCycle, getShiftCycles, type ShiftCycleItem } from '../../features/portal/api/team.api'
import {
  getAttendanceGrid,
  getOffboardingCases,
  getVacancyRequests,
} from '../../features/portal/api/branch.api'
import type { PortalPageId } from '../../features/portal/portal-nav'

/** Number-only pill data (mock badgeHtml). count <= 0 removes the pill. */
export interface NavBadge {
  count: number
  label: string
}

/** Count queries are cheap; refetching more often than this just burns calls. */
const FRESH_MS = 45_000

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * The cycle the sidebar counts against: the earliest draft still in range
 * (the sheet being put together), else the cycle covering today, else the
 * nearest upcoming one.
 */
export function navRelevantCycle(cycles: ShiftCycleItem[], today: string): ShiftCycleItem | null {
  const drafts = cycles
    .filter((c) => c.status === 'Draft' && c.endDate >= today)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
  if (drafts.length > 0) return drafts[0]
  return (
    cycles.find((c) => c.startDate <= today && today <= c.endDate) ??
    cycles
      .filter((c) => c.startDate > today)
      .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0] ??
    null
  )
}

export function useNavCounters(): Partial<Record<PortalPageId, NavBadge>> {
  const portal = usePortalSession()
  const me = portal.me
  const gymId = me?.activeGym?.gymId ?? null
  const isTeamLeader = me != null && portal.isTeamLeader
  const isBranchManager = me != null && portal.isBranchManager
  const isManager = isTeamLeader || isBranchManager
  const today = todayIso()

  // Personal — dashboard aggregate (shares the dashboard page's cache key).
  const dashboard = useQuery({
    queryKey: ['portal', 'dashboard'],
    queryFn: ({ signal }) => getEmployeeDashboard(signal),
    enabled: me?.employeeId != null,
    staleTime: FRESH_MS,
  })

  // Requests Management (Branch re-home) / Team Requests — the stage-1 desk.
  const inbox = useQuery({
    queryKey: ['portal', 'requests', 'inbox', 'Pending', 1, 1],
    queryFn: ({ signal }) => getRequestInbox({ status: 'Pending', page: 1, pageSize: 1, signal }),
    enabled: isManager && portal.can('requests.view'),
    staleTime: FRESH_MS,
  })

  // Attendance Management (BM + TL share the page) — today's Late + Absent
  // rows to follow up.
  const lateToday = useQuery({
    queryKey: ['portal', 'grid', today, 'Late', 1],
    queryFn: ({ signal }) =>
      getAttendanceGrid({ date: today, status: 'Late', page: 1, pageSize: 1, signal }),
    enabled: isManager && portal.can('attendance.view'),
    staleTime: FRESH_MS,
  })
  const absentToday = useQuery({
    queryKey: ['portal', 'grid', today, 'Absent', 1],
    queryFn: ({ signal }) =>
      getAttendanceGrid({ date: today, status: 'Absent', page: 1, pageSize: 1, signal }),
    enabled: isManager && portal.can('attendance.view'),
    staleTime: FRESH_MS,
  })

  // Employees Performance (BM) — in-flight leaving cases (Draft + Notice Period).
  const leavingsDraft = useQuery({
    queryKey: ['portal', 'nav-counts', 'leaving', 'Draft', gymId],
    queryFn: ({ signal }) => getOffboardingCases({ status: 'Draft', page: 1, pageSize: 1, signal }),
    enabled: isBranchManager,
    staleTime: FRESH_MS,
  })
  const leavingsNotice = useQuery({
    queryKey: ['portal', 'nav-counts', 'leaving', 'Notice Period', gymId],
    queryFn: ({ signal }) =>
      getOffboardingCases({ status: 'Notice Period', page: 1, pageSize: 1, signal }),
    enabled: isBranchManager,
    staleTime: FRESH_MS,
  })

  // Recruitment (BM) — pending vacancy requests awaiting the decision.
  const vacancies = useQuery({
    queryKey: ['portal', 'nav-counts', 'vacancies', 'Pending', gymId],
    queryFn: ({ signal }) => getVacancyRequests({ status: 'Pending', page: 1, pageSize: 1, signal }),
    enabled: isBranchManager && portal.can('recruitment.vacancy_request.create'),
    staleTime: FRESH_MS,
  })

  // Branch Schedule — roster members not fully assigned in the relevant cycle.
  const cycles = useQuery({
    queryKey: ['portal', 'schedule', 'cycles', gymId],
    queryFn: ({ signal }) => getShiftCycles(gymId!, signal),
    enabled: isManager && portal.can('schedule.view') && gymId != null,
    staleTime: FRESH_MS,
  })
  const relevant = cycles.data ? navRelevantCycle(cycles.data, today) : null
  const cycleDetail = useQuery({
    queryKey: ['portal', 'schedule', 'cycle', relevant?.id],
    queryFn: ({ signal }) => getShiftCycle(relevant!.id, signal),
    enabled: relevant != null && isManager && gymId != null,
    staleTime: FRESH_MS,
  })
  const offTemplateIds = useMemo(
    () => new Set((cycleDetail.data?.shiftTemplates ?? []).filter((t) => t.isOff).map((t) => t.id)),
    [cycleDetail.data],
  )
  const unscheduled = useMemo(
    () =>
      (cycleDetail.data?.assignments ?? []).filter((row) =>
        row.days.some((day) => day == null || offTemplateIds.has(day)),
      ).length,
    [cycleDetail.data, offTemplateIds],
  )

  return useMemo(() => {
    const badges: Partial<Record<PortalPageId, NavBadge>> = {}
    const put = (id: PortalPageId, count: number, label: string) => {
      if (count > 0) badges[id] = { count, label }
    }

    put('requests', dashboard.data?.pendingRequestCount ?? 0, 'pending')
    const month = dashboard.data?.monthSummary
    if (month) {
      put(
        'attendance',
        month.late + month.absent + month.earlyCheckout + month.missingCheckout,
        'this month to review',
      )
    }
    put('team-requests', inbox.data?.totalCount ?? 0, 'awaiting your decision')
    if (isManager) {
      put('employees', dashboard.data?.overview?.absent ?? 0, 'absent today')
      put(
        'attendance-management',
        (lateToday.data?.total ?? 0) + (absentToday.data?.total ?? 0),
        'today to follow up',
      )
    }
    if (isBranchManager) {
      put(
        'employees-performance',
        (leavingsDraft.data?.totalCount ?? 0) + (leavingsNotice.data?.totalCount ?? 0),
        'leaving cases in progress',
      )
      put('recruitment', vacancies.data?.total ?? 0, 'pending vacancy requests')
    }
    put('team-schedule', unscheduled, 'not fully scheduled yet')
    return badges
  }, [
    dashboard.data,
    inbox.data,
    isManager,
    isBranchManager,
    lateToday.data,
    absentToday.data,
    leavingsDraft.data,
    leavingsNotice.data,
    vacancies.data,
    unscheduled,
  ])
}
