# Frontend Architecture — React SPA

## Technology Stack
- **React 18+** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **shadcn/ui** for component library
- **TanStack Query** for server state management
- **React Router** for routing
- **React Hook Form + Zod** for forms and validation
- **i18next** for internationalization (English + Arabic RTL)

## Project Structure

```
src/
│
├── app/
│   ├── App.tsx                    ← Root component
│   ├── router.tsx                 ← Route definitions
│   ├── providers.tsx              ← Global providers (Query, Auth, i18n, Theme)
│   └── layouts/
│       ├── DashboardLayout.tsx    ← Sidebar + top bar (for authenticated users)
│       ├── PublicLayout.tsx       ← For login, public application page
│       └── Sidebar.tsx            ← Permission-driven navigation
│
├── features/
│   ├── auth/
│   │   ├── api/                   ← API functions (login, refresh, logout)
│   │   ├── hooks/                 ← useAuth, useLogin, useLogout
│   │   ├── components/            ← LoginForm, etc.
│   │   └── pages/                 ← LoginPage
│   │
│   ├── dashboard/
│   │   ├── components/            ← KPI cards, alert feeds
│   │   └── pages/                 ← SuperAdminDashboard, HRDashboard, EmployeeDashboard
│   │
│   ├── gyms/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── components/            ← GymForm, GymCard, GymConfigPanel
│   │   └── pages/                 ← GymListPage, GymDetailPage
│   │
│   ├── users/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── components/            ← UserForm, RoleAssignment, PermissionMatrix
│   │   └── pages/                 ← UserListPage, UserDetailPage
│   │
│   ├── roles/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── components/            ← RoleForm, PermissionSelector
│   │   └── pages/                 ← RoleListPage, RoleDetailPage
│   │
│   ├── recruitment/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── components/            ← VacancyForm, CandidateCard, PipelineKanban
│   │   └── pages/                 ← RecruitmentPage, CandidateDetailPage
│   │
│   ├── employees/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── components/            ← EmployeeProfile, LifecycleActions, BulkImport
│   │   └── pages/                 ← EmployeeListPage, EmployeeDetailPage
│   │
│   ├── scheduling/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── components/            ← ScheduleGrid, ShiftCell, CycleHeader
│   │   └── pages/                 ← SchedulePage
│   │
│   ├── attendance/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── components/            ← AttendanceTable, CorrectionModal
│   │   └── pages/                 ← AttendancePage
│   │
│   ├── requests/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── components/            ← RequestForm, RequestInbox, RequestDetail
│   │   └── pages/                 ← RequestsPage (HR inbox), MyRequestsPage (Employee)
│   │
│   ├── payroll/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── components/            ← PayrollTable, DeductionReview, PayslipPreview
│   │   └── pages/                 ← PayrollPage
│   │
│   ├── evaluations/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── components/
│   │   └── pages/
│   │
│   ├── reports/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── components/            ← ReportChart, ReportFilter
│   │   └── pages/                 ← ReportsPage
│   │
│   ├── notifications/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── components/            ← NotificationBell, NotificationList
│   │   └── pages/                 ← NotificationsPage
│   │
│   └── public-application/
│       ├── api/
│       ├── components/            ← ApplicationForm
│       └── pages/                 ← PublicApplicationPage
│
├── components/
│   ├── ui/                        ← shadcn/ui components
│   └── shared/
│       ├── GymSelector.tsx        ← Gym context switcher (appears on many pages)
│       ├── PermissionGate.tsx     ← Conditional render based on permission
│       ├── DataTable.tsx          ← Reusable table with pagination
│       ├── StatusBadge.tsx        ← Pill badges for statuses
│       ├── AuditTrail.tsx         ← "Last changed by" display
│       └── EmptyState.tsx
│
├── lib/
│   ├── api-client.ts              ← Axios instance with JWT interceptor
│   ├── query-client.ts            ← TanStack Query client config
│   ├── auth.ts                    ← Token management, refresh logic
│   ├── permissions.ts             ← Permission checking utilities
│   └── i18n.ts                    ← i18next configuration
│
├── types/
│   └── api/
│       └── generated.ts           ← Types generated from OpenAPI spec
│
├── hooks/
│   ├── useCurrentUser.ts          ← Current user + permissions + gym access
│   ├── usePermission.ts           ← Check if current user has a specific permission
│   ├── useGymContext.ts           ← Currently selected gym
│   └── useDirection.ts            ← RTL/LTR direction based on language
│
└── locales/
    ├── en/
    │   └── translation.json
    └── ar/
        └── translation.json
```

## Key Patterns

### Feature Ownership
Each feature directory owns:
- **API functions**: fetch/mutate functions that call the backend
- **Query/Mutation hooks**: TanStack Query wrappers
- **Components**: feature-specific UI components
- **Pages**: route-level page components

### Permission-Driven UI
```tsx
// PermissionGate component
<PermissionGate permission="employees.create">
  <Button>Add Employee</Button>
</PermissionGate>

// usePermission hook
const canCreateEmployee = usePermission('employees.create');

// Sidebar items filtered by permissions
const navItems = allNavItems.filter(item =>
  !item.permission || hasPermission(item.permission)
);
```

### Gym Context
```tsx
// GymSelector at the top of gym-scoped pages
<GymSelector
  mode="single"        // or "multi" or "all"
  value={selectedGym}
  onChange={setSelectedGym}
/>

// All queries include the selected gym
useEmployees({ gymId: selectedGym });
```

### RTL Support
- `dir` attribute on `<html>` toggles based on language
- Tailwind's `rtl:` variant for directional styles
- All layouts use logical properties (start/end instead of left/right)

## Design System

See [Hr-System-Material/DESIGN.md](../../Hr-System-Material/DESIGN.md) for the full design token specification.

Key values:
- **Primary color**: #16A34A (green)
- **Font**: Inter
- **Spacing**: 8px base grid
- **Border radius**: 4px (small), 8px (components), 12px (containers)
- **Shadows**: Very soft, ambient (premium clean look)
