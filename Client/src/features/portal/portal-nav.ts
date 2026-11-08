/**
 * Employee-portal navigation model (Mock UI/Employee core.js navItems /
 * teamItems / branchItems + navPools re-homing), expressed against the real
 * authorization model:
 *  - Personal: self-service, always.
 *  - Team: only when the session actually leads a team in the active gym
 *    (/api/me ledTeamId) — pages are team-scope endpoints.
 *  - Branch: when the active gym's role is Branch Manager. Key-gated items use
 *    the /api/auth/me permission keys; the re-homed shared pages stay for both
 *    managers because the request desk and schedule are scope-gated.
 */
import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  Bell,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Gauge,
  LayoutDashboard,
  Megaphone,
  Settings,
  UserPlus,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react'

export type PortalPageId =
  | 'dashboard'
  | 'requests'
  | 'attendance'
  | 'payroll'
  | 'schedule'
  | 'documents'
  | 'team'
  | 'team-schedule'
  | 'team-requests'
  | 'team-performance'
  | 'team-updates'
  | 'employees'
  | 'employees-performance'
  | 'attendance-management'
  | 'recruitment'
  | 'leaving'
  | 'profile'
  | 'history'
  | 'evaluations'
  | 'notifications'
  | 'settings'
  | 'branch-actions'

export interface PortalNavItem {
  id: PortalPageId
  path: string
  label: string
  icon: LucideIcon
  /** Permission key required on top of the section gate; '' means none. */
  permission?: string
}

/** Mock page ids appear in NotificationItem.link — map them to routes. */
export const PAGE_PATHS: Record<PortalPageId, string> = {
  dashboard: '/employee/dashboard',
  requests: '/employee/requests',
  attendance: '/employee/attendance',
  payroll: '/employee/payroll',
  schedule: '/employee/schedule',
  documents: '/employee/documents',
  team: '/employee/team',
  'team-schedule': '/employee/team/schedule',
  'team-requests': '/employee/team/requests',
  'team-performance': '/employee/team/performance',
  'team-updates': '/employee/team/actions',
  employees: '/employee/branch/employees',
  'employees-performance': '/employee/branch/performance',
  'attendance-management': '/employee/branch/attendance',
  recruitment: '/employee/branch/recruitment',
  leaving: '/employee/branch/leaving',
  profile: '/employee/profile',
  history: '/employee/history',
  evaluations: '/employee/evaluations',
  notifications: '/employee/notifications',
  settings: '/employee/settings',
  'branch-actions': '/employee/branch/actions',
}

export const PERSONAL_ITEMS: PortalNavItem[] = [
  { id: 'dashboard', path: PAGE_PATHS.dashboard, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'requests', path: PAGE_PATHS.requests, label: 'My Requests', icon: ClipboardList },
  { id: 'attendance', path: PAGE_PATHS.attendance, label: 'My Attendance', icon: ClipboardCheck },
  { id: 'payroll', path: PAGE_PATHS.payroll, label: 'My Payroll', icon: Wallet },
]

/** Re-homing mirrors the mock: these two live under Branch for manager roles. */
export const REHOME_IDS: PortalPageId[] = ['team-requests', 'team-schedule']

export const TEAM_ITEMS: PortalNavItem[] = [
  { id: 'team', path: PAGE_PATHS.team, label: 'My Team', icon: Users },
  { id: 'team-schedule', path: PAGE_PATHS['team-schedule'], label: 'Team Schedule', icon: CalendarDays },
  { id: 'team-requests', path: PAGE_PATHS['team-requests'], label: 'Team Requests', icon: ClipboardList },
  { id: 'team-performance', path: PAGE_PATHS['team-performance'], label: 'Team Performance', icon: BadgeCheck },
  { id: 'team-updates', path: PAGE_PATHS['team-updates'], label: 'Team Actions', icon: Megaphone },
]

export const BRANCH_ITEMS: PortalNavItem[] = [
  { id: 'employees', path: PAGE_PATHS.employees, label: 'Employees', icon: UserRound, permission: 'employees.view' },
  { id: 'employees-performance', path: PAGE_PATHS['employees-performance'], label: 'Employees Performance', icon: Gauge, permission: 'employees.view' },
  { id: 'attendance-management', path: PAGE_PATHS['attendance-management'], label: 'Attendance Management', icon: ClipboardCheck, permission: 'attendance.view' },
  { id: 'recruitment', path: PAGE_PATHS.recruitment, label: 'Recruitment', icon: UserPlus, permission: 'recruitment.vacancy_request.create' },
]

/** Re-homed labels for manager roles (mock navPools). */
export const REHOMED_LABELS: Partial<Record<PortalPageId, string>> = {
  'team-schedule': 'Branch Schedule',
  'team-requests': 'Requests Management',
}

/** Pages reachable from the avatar dropdown (mock extraPages) + mobile paths. */
export const DROPDOWN_ITEMS: PortalNavItem[] = [
  { id: 'profile', path: PAGE_PATHS.profile, label: 'My Profile', icon: UserRound },
  { id: 'history', path: PAGE_PATHS.history, label: 'Employment History', icon: Briefcase },
  { id: 'evaluations', path: PAGE_PATHS.evaluations, label: 'My Evaluations', icon: BadgeCheck },
  { id: 'schedule', path: PAGE_PATHS.schedule, label: 'My Schedule', icon: CalendarDays },
  { id: 'documents', path: PAGE_PATHS.documents, label: 'My Documents', icon: FileText },
  { id: 'settings', path: PAGE_PATHS.settings, label: 'Settings', icon: Settings },
]

export const MOBILE_ITEMS: PortalNavItem[] = [
  { id: 'dashboard', path: PAGE_PATHS.dashboard, label: 'Home', icon: LayoutDashboard },
  { id: 'schedule', path: PAGE_PATHS.schedule, label: 'Schedule', icon: CalendarDays },
  { id: 'requests', path: PAGE_PATHS.requests, label: 'Requests', icon: ClipboardList },
  { id: 'notifications', path: PAGE_PATHS.notifications, label: 'Alerts', icon: Bell },
]

/** Page titles for the header + drawer, keyed by route pathname. */
export const TITLE_BY_PATH: Array<[string, string]> = [
  [PAGE_PATHS.dashboard, 'Dashboard'],
  [PAGE_PATHS.requests, 'My Requests'],
  [PAGE_PATHS.attendance, 'My Attendance'],
  [PAGE_PATHS.payroll, 'My Payroll'],
  [PAGE_PATHS.schedule, 'My Schedule'],
  [PAGE_PATHS.documents, 'My Documents'],
  [PAGE_PATHS.team, 'My Team'],
  [PAGE_PATHS['team-schedule'], 'Schedule Management'],
  [PAGE_PATHS['team-requests'], 'Requests Management'],
  [PAGE_PATHS['team-performance'], 'Team Performance'],
  [PAGE_PATHS['team-updates'], 'Team Actions'],
  [PAGE_PATHS.employees, 'Employees'],
  [PAGE_PATHS['employees-performance'], 'Employees Performance'],
  [PAGE_PATHS['attendance-management'], 'Attendance Management'],
  [PAGE_PATHS.recruitment, 'Recruitment'],
  [PAGE_PATHS.leaving, 'Employee Leaving'],
  [PAGE_PATHS.profile, 'My Profile'],
  [PAGE_PATHS.history, 'Employment History'],
  [PAGE_PATHS.evaluations, 'My Evaluations'],
  [PAGE_PATHS.notifications, 'Notifications'],
  [PAGE_PATHS.settings, 'Settings'],
  [PAGE_PATHS['branch-actions'], 'Branch Actions'],
]

export function titleForPath(pathname: string): string {
  // Match the route exactly: a bare startsWith() turns every '/employee/team/*'
  // sub-page into 'My Team' and swallows the 'Employee Profile' drill-in.
  const normalized = pathname.replace(/\/+$/, '')
  const exact = TITLE_BY_PATH.find(([path]) => normalized === path)
  if (exact) return exact[1]
  if (normalized.startsWith(PAGE_PATHS.employees + '/')) return 'Employee Profile'
  return 'Dashboard'
}
