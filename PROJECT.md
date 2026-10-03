# Revive HR System

## Product

Revive HR System is a **SaaS-style HR Management Platform** operated by **Revive Solutions Fitness**. It replaces fragmented Google Sheets and manual HR processes with a centralized, multi-gym platform. All gyms share one system and URL — the authenticated user's identity determines the views, actions, and data they can access.

## Problem

Revive Solutions Fitness manages a growing network of gyms (targeting 20–50+). HR operations — recruitment, attendance, scheduling, payroll, employee requests — are currently handled through disconnected spreadsheets and manual processes. This creates data inconsistency, zero audit trail, no permission control, and makes scaling operationally impossible.

## Target Users

| User Type | Scope | Summary |
|-----------|-------|---------|
| **Top Management (Super Admin)** | All gyms / central platform | System governance, user/gym/role/permission management |
| **HR Manager** | Assigned gyms | HR management with configurable permissions |
| **HR** | Assigned gyms | HR operations with configurable permissions |
| **Branch Manager** | Own gym (Employee + role) | Team management through granted permissions only |
| **Team Leader** | Own team(s), within own gym (Employee + role) | Sub-gym team oversight through granted permissions only; may lead multiple teams |
| **Employee** | Own data / own gym (or a chosen one of two assigned gyms at login) | Self-service portal for personal HR information |

## MVP Goal

The MVP must allow a real end-to-end hiring and employee scenario:

1. Top Management creates a gym and assigns HR users with permissions
2. HR opens a vacancy and manages the recruitment pipeline
3. Candidates apply via public link, move through stages with follow-up enforcement
4. Hired candidate converts to an Employee with linked recruitment history
5. Employee receives a dynamic shift schedule (configurable cycle per gym)
6. Attendance is captured via Face ID biometric device (with manual fallback)
7. Attendance is evaluated against the employee's effective schedule
8. Employees use self-service: profile, schedule, attendance, requests, notifications
9. The authorization system enforces permission + gym-scope isolation at every level

## Technology

### Frontend
- React 18+
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query

### Backend
- ASP.NET Core 8
- Entity Framework Core
- **PostgreSQL** (see docs/decisions/ADR-001-database.md)
- JWT Authentication
- Clean Architecture (DomainLayer → ServiceAbstraction → Service → Persistence → Presentation)

### Deployment
- On-premises / self-hosted server
- Docker containers (recommended)
- Linux host (recommended)

### Localization
- Bilingual: English + Arabic (RTL support required)

## Architecture

See:
- [docs/architecture/architecture.md](docs/architecture/architecture.md)
- [docs/architecture/backend.md](docs/architecture/backend.md)
- [docs/architecture/frontend.md](docs/architecture/frontend.md)
- [docs/architecture/api.md](docs/architecture/api.md)
- [docs/architecture/database.md](docs/architecture/database.md)

## Product Documentation

See:
- [docs/product/mvp.md](docs/product/mvp.md)
- [docs/product/features.md](docs/product/features.md)
- [docs/product/user-flows.md](docs/product/user-flows.md)
- [docs/product/out-of-scope.md](docs/product/out-of-scope.md)

## Decisions

See:
- [docs/decisions/ADR-001-database.md](docs/decisions/ADR-001-database.md)
- [docs/decisions/ADR-002-authentication.md](docs/decisions/ADR-002-authentication.md)
- [docs/decisions/ADR-003-authorization.md](docs/decisions/ADR-003-authorization.md)
- [docs/decisions/ADR-004-biometric-integration.md](docs/decisions/ADR-004-biometric-integration.md)

## Development Status

See:
- [docs/progress.md](docs/progress.md)

## Engineering Skills

Required skills for agents working on this project:
- `aspnet-clean-architecture` — Clean Architecture layering rules
- `efcore-persistence` — EF Core data access patterns
- `aspnet-security-review` — OWASP security audit
- `feature-development-workflow` — End-to-end feature implementation
- `api-testing-workflow` — API test organization
- `react-frontend-architecture` — React SPA structure
- `react-api-integration` — TanStack Query patterns
- `react-security-review` — Frontend security
- `ui-ux-design-review` — UI quality gate
- `stitch-design-to-react` — Mockup-to-component conversion

## Design System

See: [Hr-System-Material/DESIGN.md](Hr-System-Material/DESIGN.md)

Brand: Modern Corporate Minimalism with green (#16A34A) primary palette, Inter font, 8px spacing grid.

## Critical Rules

1. **If it isn't in the MVP specification, don't build it unless needed for mvp.**
2. **Never bypass the authorization model** — every action is gated by permission + gym scope.
3. **Preserve audit trails** — every edit/approval must record who, when, and why.
4. **Gym isolation is absolute** — a user must never see data from a gym they don't have access to.
5. **Branch Manager is NOT a User Type** — it is a Role applied to an Employee. **Team Leader** is the same pattern, scoped to a sub-gym team rather than the whole gym.
6. **Candidate ≠ Employee** — a Candidate becomes an Employee only at the Hired transition.
7. **Schedules are dynamic** — never model an employee as having one permanent fixed shift.
8. **RTL support** — all UI must work in both LTR (English) and RTL (Arabic).
