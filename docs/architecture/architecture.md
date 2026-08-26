# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                     │
│                                                                      │
│  React SPA (Vite + TypeScript + Tailwind + shadcn/ui)               │
│  ├── Super Admin Portal                                              │
│  ├── HR Portal                                                       │
│  ├── Branch Manager Portal  (same app, role-based routing)          │
│  ├── Employee Self-Service Portal                                    │
│  └── Public Application Page (recruitment)                           │
│                                                                      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTPS / JWT
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     ASP.NET Core 8 Web API                           │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Presentation Layer (Controllers)                              │    │
│  │  └── Thin controllers → delegate to services                 │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                              │                                       │
│  ┌──────────────────────────▼──────────────────────────────────┐    │
│  │ Service Layer (Business Logic)                                │    │
│  │  ├── ServiceAbstraction (Interfaces)                         │    │
│  │  └── Service (Implementations)                                │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                              │                                       │
│  ┌──────────────────────────▼──────────────────────────────────┐    │
│  │ Domain Layer (Entities, Value Objects, Business Rules)         │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                              │                                       │
│  ┌──────────────────────────▼──────────────────────────────────┐    │
│  │ Infrastructure                                                │    │
│  │  ├── Persistence (EF Core + PostgreSQL)                      │    │
│  │  ├── Presentation (API configuration, middleware)            │    │
│  │  └── Integration Boundary (Biometric, future services)       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Shared (Cross-cutting: DTOs, Result types, Pagination, etc.)  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        PostgreSQL                                    │
│                                                                      │
│  Single database, gym-scoped data isolation via application logic    │
│  (NOT separate databases per gym)                                    │
└─────────────────────────────────────────────────────────────────────┘
                           │
                           │ Integration Boundary
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  External Systems                                    │
│                                                                      │
│  ├── Face ID Biometric Device (vendor TBD)                          │
│  ├── Google Forms (future, optional)                                 │
│  └── Email/SMS (future)                                              │
└─────────────────────────────────────────────────────────────────────┘
```

## Solution Structure (Backend)

```
ReviveHRSystem.Web.sln
│
├── Core/
│   ├── DomainLayer/          → Entities, Value Objects, Enums, Business Rules
│   │                           No dependencies on other layers
│   │
│   ├── ServiceAbstraction/   → Service interfaces (contracts)
│   │                           Depends on: DomainLayer
│   │
│   └── Service/              → Service implementations (business logic)
│                               Depends on: DomainLayer, ServiceAbstraction
│
├── Infrastructure/
│   ├── Persistence/          → EF Core DbContext, Repositories, Migrations
│   │                           Depends on: DomainLayer, ServiceAbstraction
│   │
│   └── Presentation/        → API configuration, filters, middleware
│                               Depends on: ServiceAbstraction
│
├── Shared/                   → Cross-cutting concerns (DTOs, Result types,
│                               Pagination envelope, Constants)
│                               No domain dependencies
│
└── ReviveHRSystem.Web/       → Entry point (Program.cs), DI registration,
                                Controllers
                                Depends on: All layers (composition root)
```

## Dependency Flow

```
ReviveHRSystem.Web (Composition Root)
    ├── references → Presentation
    ├── references → Service
    ├── references → Persistence
    └── references → Shared

Presentation
    └── references → ServiceAbstraction

Service
    ├── references → ServiceAbstraction
    └── references → DomainLayer

Persistence
    ├── references → DomainLayer
    └── references → ServiceAbstraction

ServiceAbstraction
    └── references → DomainLayer

DomainLayer
    └── no dependencies (pure domain)

Shared
    └── no dependencies (cross-cutting utilities)
```

## Key Architectural Decisions

1. **Single database, application-level gym isolation** — NOT separate databases per gym. Every gym-scoped query includes a gym filter.

2. **Permission checks at the Service layer** — Controllers are thin and delegate authorization to services. The service layer validates both permissions and gym scope before executing any operation.

3. **Biometric integration behind a boundary** — The attendance domain does not depend on a specific hardware vendor. An integration adapter translates device events into domain attendance events.

4. **Single SPA with role-based routing** — One React application serves all user types. The navigation, pages, and actions rendered depend on the authenticated user's permissions.

5. **Audit trail as a cross-cutting concern** — Every state-changing operation that affects employees, attendance, payroll, or permissions logs who did what, when, and why.

See also:
- [backend.md](backend.md) — ASP.NET Core architecture details
- [frontend.md](frontend.md) — React SPA architecture details
- [database.md](database.md) — Database schema and conventions
- [api.md](api.md) — API contract and conventions
