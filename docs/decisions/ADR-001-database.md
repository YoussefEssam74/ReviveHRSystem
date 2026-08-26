# ADR-001: Database Selection

## Status
**Accepted**

## Context
Revive HR System needs a relational database for a multi-gym HR platform deployed on-premises. Requirements:
- On-premises deployment (zero licensing cost)
- Scale: 20–50+ gyms, 500–2000+ employees
- Complex authorization model (User Type → Role → Permission → Gym Access)
- Extensive audit logging (JSONB is ideal)
- Employee history tracking, attendance records, scheduling data
- Bilingual support (English + Arabic, full UTF-8)

## Decision
**PostgreSQL** (latest stable, currently 16+)

Using **Npgsql** as the EF Core provider.

## Why PostgreSQL

### Zero Licensing Cost
- SQL Server requires paid licensing for on-premises production use
- SQL Server Express has a 10GB database limit — too restrictive for 20-50+ gyms with full audit logging
- PostgreSQL is completely free under the PostgreSQL License (MIT-like)

### JSONB for Audit Logs
- Audit logs need to store before/after snapshots of different entity types
- PostgreSQL JSONB columns are natively indexed and queryable
- Perfect for `OldValues` / `NewValues` columns in the AuditLogs table
- Also useful for flexible candidate data (education, experience, skills)

### EF Core Support
- Npgsql provides excellent EF Core support
- Full migration support, Fluent API, LINQ translation
- Native support for PostgreSQL-specific types (timestamptz, jsonb, arrays)

### Performance at Scale
- Handles 500-2000+ employees with complex joins, aggregations, and audit queries comfortably
- Connection pooling via Npgsql is mature
- Supports partial indexes, covering indexes, and expression indexes

### Docker & On-Premises
- Official PostgreSQL Docker image is production-ready
- Easy backup/restore with pg_dump/pg_restore
- Runs on Linux or Windows

## Alternatives Considered

### SQL Server
- Best .NET ecosystem integration
- **Rejected because**: Licensing cost for on-premises is significant. Express edition has 10GB limit. The JSONB advantage of PostgreSQL is meaningful for this audit-heavy system.

### MySQL / MariaDB
- Free, widely used
- **Rejected because**: EF Core support (Pomelo) is less mature than Npgsql. No native JSONB with indexing. Missing row-level security features.

### SQLite
- Zero configuration
- **Rejected because**: Not suitable for multi-user production workloads at this scale.

## Consequences
- Development team must be comfortable with PostgreSQL
- Use `timestamptz` for all date/time columns (timezone-aware)
- Use `jsonb` for audit logs, candidate metadata, and employment history values
- Connection string and backup strategy must be configured for on-premises server
- Migrations managed via EF Core (`dotnet ef migrations`)
