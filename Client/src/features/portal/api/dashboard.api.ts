import { apiRequest } from '../../../lib/api-client'

/** GET /api/dashboard/employee — the bento aggregate (mock §1 renderDashboard). */

export interface DashboardUser {
  firstName: string
  position: string
  gymName: string
}

export interface DashboardShift {
  shiftName: string
  /** TimeOnly serializes as "HH:mm:ss". */
  start: string
  end: string
}

export interface DashboardAttendance {
  checkIn: string | null
  checkOut: string | null
  checkedIn: boolean
  status: string
  source: string
}

export interface AttendanceSummary {
  rate: number
  present: number
  late: number
  absent: number
  earlyCheckout: number
  missingCheckout: number
}

export interface ScheduleDay {
  date: string
  dayName: string
  shiftName: string | null
  start: string | null
  end: string | null
  isOff: boolean
  isToday: boolean
  /** Clock-in time of that day's attendance record ("HH:mm:ss"), null when none. */
  checkIn: string | null
  /** Clock-out time of that day's attendance record, null until checked out. */
  checkOut: string | null
}

export interface PayrollEntry {
  id: number
  period: string
  status: string
  paidDate: string | null
  visible: boolean
  baseSalary: number
  totalBonuses: number
  totalDeductions: number
  netSalary: number
  items: PayrollLineItem[]
}

export interface PayrollLineItem {
  label: string
  kind: string
  amount: number
}

export interface DashboardNotification {
  id: number
  category: string
  title: string
  description: string
  date: string
  read: boolean
  link: string | null
}

export interface DashboardAction {
  title: string
  detail: string
  urgent: boolean
}

/** Role strip: scope "Team" or "Branch". */
export interface DashboardOverview {
  scope: string
  memberCount: number
  presentToday: number
  pendingRequests: number
  absent: number
}

export interface EmployeeDashboard {
  greeting: string
  user: DashboardUser
  todayShift: DashboardShift | null
  todayAttendance: DashboardAttendance | null
  monthSummary: AttendanceSummary
  upcomingSchedule: ScheduleDay[]
  pendingRequestCount: number
  latestPayroll: PayrollEntry | null
  recentNotifications: DashboardNotification[]
  actionRequired: DashboardAction[]
  overview: DashboardOverview | null
}

export function getEmployeeDashboard(signal?: AbortSignal): Promise<EmployeeDashboard> {
  return apiRequest<EmployeeDashboard>('/api/dashboard/employee', { signal })
}
