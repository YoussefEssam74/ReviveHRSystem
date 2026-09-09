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
│   ├── teams/
│   │   ├── api/
│   │   ├── hooks/                 ← useMyTeams, useTeamMembers
│   │   ├── components/            ← TeamForm, TeamRoster, TeamLeaderAssignment
│   │   └── pages/                 ← TeamsAdminPage (HR/Branch Manager), MyTeamPage (Team Leader)
│   │
│   ├── events/
│   │   ├── api/
│   │   ├── hooks/                 ← useEvents
│   │   ├── components/            ← EventRow, EventFilterBar
│   │   └── pages/                 ← EventsPage (HR action queue)
│   │
│   ├── evaluations-builder/
│   │   ├── api/
│   │   ├── hooks/                 ← useEvaluationForms
│   │   ├── components/            ← FormBuilder, QuestionEditor, RatingInput, ChoiceInput
│   │   └── pages/                 ← EvaluationFormsPage, RunEvaluationPage
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
│   ├── useTeamContext.ts          ← Resolves teams the user leads (if any) + union of teamMemberIds, for Team Leader-scoped queries
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

### Team-Scoped Queries (Team Leader)
```tsx
// useTeamContext resolves the union of every team the current user leads
const { teamMemberIds } = useTeamContext();

// Team-scoped queries filter to teamMemberIds instead of the full gym
useAttendance({ gymId: selectedGym, employeeIds: teamMemberIds });

// "My Team" nav item only renders if team.view is granted
<PermissionGate permission="team.view">
  <SidebarLink to="/my-team">My Team</SidebarLink>
</PermissionGate>
```

### Events Sidebar Item (HR)
```tsx
// Events queue — not separately permission-gated as a page; row
// visibility is filtered server-side by the permission of each event's
// underlying entity (e.g. a VacancyRequestPending event requires
// recruitment.vacancy_request.approve). The sidebar link itself is
// always visible to HR-type users.
<SidebarLink to="/events">Events</SidebarLink>
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

### Top Bar — Notifications & Settings
- **Notifications bell** — redesigned visually in this MVP round, stays a dropdown (not a full page); permission/role-aware; shows System Notifications, Required Actions, Request Updates, Attendance Alerts, and (for Branch Manager/Team Leader) Management Notifications relevant to their scope. Purely informational — see the **Events** sidebar page (below) for items that need HR to actually act.
- **Administrative Settings (⚙️)** — the icon is always present in the shell, but its *contents* are entirely permission-driven, never role-driven:
  - Regular Employee: Personal Settings, Password, Notification Preferences, Language
  - Team Leader: above + Team-related settings, only if a team-scoped `.manage` permission is granted
  - Branch Manager: above + Employee Management Settings, Shift Settings, Branch-related Settings, Attendance Settings — each shown only if the corresponding permission is held
  - **Rule:** never show an admin settings section purely because of a role label (e.g. "Branch Manager") — gate every section by its actual permission, same as page/button visibility elsewhere

### Profile Menu
Clicking the profile picture (next to Settings) shows:
- Employee Name, Position, Role, Gym (read-only header)
- My Profile
- Account Settings
- Logout
- (optional, future) Help & Support, Change Password shortcut

## Design System

See [Hr-System-Material/DESIGN.md](../../Hr-System-Material/DESIGN.md) for the full design token specification.

Key values:
- **Primary color**: #16A34A (green)
- **Font**: Inter
- **Spacing**: 8px base grid
- **Border radius**: 4px (small), 8px (components), 12px (containers)
- **Shadows**: Very soft, ambient (premium clean look)

### Action-Oriented Dashboards (applies to every dashboard)
No dashboard (Super Admin, HR, or any Employee-based dashboard: Regular
Employee, Team Leader, Branch Manager) is a pure reporting screen.
Anything requiring the viewer to act must render as an explicit **"Action
Required"** flag or badge rather than a plain number — e.g. "3 requests
pending" alone is not enough; it should read/flag as something the user
is expected to act on. See features.md §13 for the per-role dashboard
content this applies to.

### Dashboard & HR Gym-Login UX (this MVP round)
- HR and every Employee-based dashboard get a visual/UX redesign pass —
  clearer hierarchy, faster access to action items. No new backend
  logic or AI/ML; existing dashboard data (features.md §13) and the
  Action-Oriented principle above are unchanged.
- HR users with 2+ gyms see a **gym picker as their initial landing
  view** right after login (see user-flows.md Flow 1b) — the existing
  in-app Gym Context Switcher (above) still works afterward with no
  re-login. This is a UX addition only, not a session-scope change.
