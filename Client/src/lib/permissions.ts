/**
 * Feature-level access helpers backed by GET /api/me `featureLevels`.
 *
 * Access is per feature code (Features.cs) at one of three levels:
 * 0 = None, 1 = View, 2 = Edit (ADR-003 Amendment 1). These are UX-only gates —
 * the API always enforces the real check server-side.
 */

export const VIEW = 1
export const EDIT = 2

/** Feature codes surfaced in the HR console nav (subset of Features.cs). */
export type FeatureCode =
  | 'employees'
  | 'attendance'
  | 'schedule'
  | 'requests'
  | 'payroll'
  | 'evaluations'
  | 'recruitment'
  | 'offboarding'
  | 'documents'
  | 'reports'
  | 'announcements'
  | 'audit'

export type FeatureLevels = Record<string, number>

/**
 * True when the feature is granted at or above `minLevel` (default View).
 * TopManagement holds no explicit grants (it bypasses checks per ADR-003), so
 * it is treated as full access.
 */
export function can(levels: FeatureLevels | null | undefined, feature: FeatureCode, minLevel: number = VIEW, userType?: string): boolean {
  if (userType === 'TopManagement') return true
  const level = levels?.[feature] ?? 0
  return level >= minLevel
}

/** The level (0/1/2) for a feature, defaulting to None. */
export function levelOf(levels: FeatureLevels | null | undefined, feature: FeatureCode): number {
  return levels?.[feature] ?? 0
}
