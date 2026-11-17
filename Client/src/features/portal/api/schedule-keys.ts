import type { QueryClient } from '@tanstack/react-query'

/**
 * Single source of truth for the caches that carry shift data.
 *
 * The Branch Schedule, the member profile Shift tab and the employee's own
 * schedule page used to key the same cycle/schedule under different prefixes
 * (`portal/schedule`, `portal/shift-cycle`, `portal/member/schedule`), so an
 * edit saved on one screen left the others showing the previous answer for the
 * 30-second stale window. Keep the keys here and invalidate through
 * `invalidateScheduleQueries`.
 */
export const scheduleKeys = {
  /** Prefix covering every branch-schedule and own-schedule cache. */
  all: ['portal', 'schedule'] as const,
  cycles: (gymId: number) => ['portal', 'schedule', 'cycles', gymId] as const,
  cycle: (cycleId: number) => ['portal', 'schedule', 'cycle', cycleId] as const,
  templates: (gymId: number) => ['portal', 'schedule', 'templates', gymId] as const,
  /** Employee schedule for the member profile's "upcoming shifts" (month window). */
  member: (memberId: number) => ['portal', 'member', 'schedule', memberId] as const,
  /** Member profile Shift tab — the current Mon–Sun window, shared by every tab. */
  memberWeek: (memberId: number, from: string, to: string) =>
    ['portal', 'member', 'schedule', memberId, 'week', from, to] as const,
}

/**
 * Invalidate everything that renders shift data after a schedule mutation.
 * A saved cell or a publish must reach the Branch Schedule, the member profile
 * Shift tab, the employee's My Schedule page, and the shift widgets on the
 * dashboards in the same render cycle.
 */
export async function invalidateScheduleQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: scheduleKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['portal', 'member', 'schedule'] }),
    queryClient.invalidateQueries({ queryKey: ['portal', 'dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['portal', 'team', 'today'] }),
  ])
}
