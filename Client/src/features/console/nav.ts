import {
  LayoutDashboard,
  Users,
  UserMinus,
  UserPlus,
  CalendarCheck,
  FileText,
  Inbox,
  Wallet,
  ClipboardCheck,
  BarChart3,
  Building2,
  CalendarDays,
  Bell,
  ScrollText,
  Sparkles,
  ShieldCheck,
  KeyRound,
  Smartphone,
  type LucideIcon,
} from 'lucide-react'
import type { FeatureCode } from '../../lib/permissions'

export interface NavItem {
  /** Route path under the console layout (always /console-prefixed). */
  to: string
  label: string
  icon: LucideIcon
  /** Feature required at View level; omitted = always visible (e.g. My Access). */
  feature?: FeatureCode
}

/** Primary work-queue navigation (mirrors the mock's main nav). */
export const MAIN_NAV: NavItem[] = [
  { to: '/console/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/console/employees', label: 'Employees', icon: Users, feature: 'employees' },
  { to: '/console/terminations', label: 'Terminations', icon: UserMinus, feature: 'offboarding' },
  { to: '/console/recruitment', label: 'Recruitment & Hiring', icon: UserPlus, feature: 'recruitment' },
  { to: '/console/attendance', label: 'Attendance', icon: CalendarCheck, feature: 'attendance' },
  { to: '/console/requests', label: 'Requests', icon: FileText, feature: 'requests' },
  { to: '/console/branch-queue', label: 'Branch Queue', icon: Inbox, feature: 'requests' },
  { to: '/console/payroll', label: 'Payroll', icon: Wallet, feature: 'payroll' },
  { to: '/console/evaluations', label: 'Evaluations', icon: ClipboardCheck, feature: 'evaluations' },
]

/** Administration navigation (mirrors the mock's secondary nav). */
export const ADMIN_NAV: NavItem[] = [
  { to: '/console/reports', label: 'Reports & Analytics', icon: BarChart3, feature: 'reports' },
  { to: '/console/positions', label: 'Positions & Levels', icon: Building2 },
  { to: '/console/schedule', label: 'Schedule', icon: CalendarDays, feature: 'schedule' },
  { to: '/console/station-code', label: 'Station Code', icon: Smartphone },
  { to: '/console/events', label: 'Events', icon: Sparkles, feature: 'announcements' },
  { to: '/console/notifications', label: 'Notifications', icon: Bell },
  { to: '/console/audit', label: 'Audit Log', icon: ScrollText, feature: 'audit' },
  { to: '/console/hr-team', label: 'HR Team Management', icon: ShieldCheck },
  { to: '/console/my-access', label: 'My Access', icon: KeyRound },
]
