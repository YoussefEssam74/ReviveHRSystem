import {
  Building2,
  CreditCard,
  LayoutDashboard,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  UserCog,
  type LucideIcon,
} from 'lucide-react'

export interface PlatformNavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Only Top Management sees governance items; HR Manager stops at the account surface. */
  superAdminOnly?: boolean
}

/**
 * Console navigation, grouped the way the mock's sidebar is: the daily work
 * surface first, then the commercial views, then governance.
 *
 * The plan catalogue is not a destination of its own — it is the side rail of
 * Billing & quotas, exactly as in the mock.
 */
export const PLATFORM_NAV: { title?: string; items: PlatformNavItem[] }[] = [
  {
    items: [
      { to: '/platform/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/platform/companies', label: 'Gym accounts', icon: Building2 },
      { to: '/platform/users', label: 'Users', icon: Users },
      { to: '/platform/hr-managers', label: 'HR managers', icon: UserCog },
    ],
  },
  {
    title: 'Revenue',
    items: [
      { to: '/platform/billing', label: 'Billing & quotas', icon: CreditCard, superAdminOnly: true },
      { to: '/platform/revenue', label: 'Revenue Analytics', icon: TrendingUp, superAdminOnly: true },
    ],
  },
  {
    title: 'Governance',
    items: [
      { to: '/platform/roles', label: 'Roles & permissions', icon: ShieldAlert },
      // The mock has no standalone audit page; the security defaults that used to
      // live beside it are the only part of the settings surface with real teeth.
      { to: '/platform/settings', label: 'Settings', icon: ShieldCheck, superAdminOnly: true },
    ],
  },
]
