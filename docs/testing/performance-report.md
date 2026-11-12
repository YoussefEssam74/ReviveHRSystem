# ReviveHR performance: load, stress and soak

- **Question**: load (is it fast enough at expected peak), then stress (where does it break), then soak (does it degrade)
- **Build**: `ReviveHRSystem.Web`, Debug, commit at time of run
- **Run date**: 2026-11-09
- **Tool**: k6 v2.3.0, single load generator
- **Suite**: [Tests/Performance](../../Tests/Performance/README.md)

## Verdict

At the modelled peak — 460 concurrent users, ~57 rps — the API is comfortable:
every endpoint met its latency target, p95 never exceeded 65 ms, and the error
rate was 0.0075%. CPU sat at 4–6%, so the system has a large amount of headroom
at expected load.

Under stress it does not degrade gracefully. Throughput stops rising at roughly
**200 rps**, and from there latency climbs to **10.4 s p95** while the error rate
stays near zero — the system queues instead of failing. The collapse is not
global: **one endpoint, `GET /api/dashboard/employee`, is responsible for
essentially all of it**, reaching 2.05 s p50 while every other endpoint stayed
under 46 ms p95 at the same moment. That endpoint issues 18 sequential database
round trips per request, and at high concurrency it exhausts the database
connection ceiling (`max_connections = 100`, Npgsql pool default 100).

The soak found no drift or leak — latency and memory were flat for 19 minutes —
but it did surface a **correctness bug**: concurrent logins for the same account
return HTTP 500, because `User` uses `xmin` as an optimistic concurrency token
and the login path writes advisory columns that two logins can race on. That
affected 4.12% of logins in the soak.

The immediate actions are to fix the login race, reduce the query count on the
employee dashboard, and raise the connection ceiling. None is a rewrite.

## 1. Workload

Full derivation in [Tests/Performance/README.md](../../Tests/Performance/README.md).

- **Endpoint mix**: assumed. The system is pre-launch and has no access logs.
- **Concurrency**: 460 VUs, derived as 2.6 sessions/s × 180 s session, from a
  modelled 2,000 employees (ADR-001's documented ceiling) plus ~60 HR staff.
- **Think time**: 2–15 s depending on view, uniform random, never constant.
- **Data**: hot/cold employee split at 60/40, discovered from the API at setup.
- **Journeys**: employee self-service 65%, HR console 30%, session start 5%.
- **Read/write ratio**: roughly 20:1.

**Model source**: assumed, because no production traffic exists. Every number
above is an assumption anchored to the documented scale target, not a
measurement.

## 2. Environment

| Dimension | Production | Test | Material |
| --- | --- | --- | --- |
| App instances | 1 (on-premises) | 1 | no |
| Employees in database | up to 2,000 | **17** | **yes** — query plans and cache behaviour differ at scale |
| Attendance rows | ~500k at 2,000 employees | **835** | **yes** |
| Database size | GB scale | **14 MB** | **yes** — the whole database fits in shared buffers |
| Load generator | separate host | **same machine as the API** | **yes** — shares CPU with the system under test |
| Auth-login rate limit | 10/min per IP | raised to 100000 | **yes** — see below |
| Response compression | n/a | none configured | no for latency, yes for bandwidth |
| TLS | yes | no | minor |
| Postgres `max_connections` | 100 | 100 | no |
| Npgsql `Maximum Pool Size` | 100 (default) | 100 (default) | no |

The auth-login limit was raised because several hundred VUs starting at once
would otherwise be throttled by a brute-force control that is not the subject of
the test. In production it stays where it is.

The load generator ran on the same host as the API. This bounds the absolute
throughput number: k6 and the API competed for the same cores, so the achieved
rps is a floor, not a ceiling.

## 3. Results

### Load test — 460 VUs, 3 min warmup, 8 min steady state

Warmup excluded from all percentiles. 53,346 requests, **57.4 rps achieved**,
**0.0075% failed**, 100% of checks passed.

| Endpoint | Requests | p50 | p95 | p99 | max | Errors | Target p95 | Pass |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /api/dashboard/employee` | 7,080 | 32.0 ms | **65.0 ms** | 78.5 ms | 344 ms | 0.00% | 400 | yes |
| `POST /api/auth/login` | 436 | 28.4 ms | 54.0 ms | 63.7 ms | 82 ms | 0.00% | 600 | yes |
| `GET /api/dashboard/hr` | 2,337 | 25.3 ms | 53.6 ms | 62.5 ms | 142 ms | 0.00% | 500 | yes |
| `GET /api/reports/overview` | 692 | 15.1 ms | 36.6 ms | 43.6 ms | 155 ms | 0.00% | 400 | yes |
| `GET /api/employees/{id}` | 2,337 | 16.1 ms | 34.6 ms | 40.3 ms | 55 ms | 0.00% | 300 | yes |
| `GET /api/attendance` | 2,337 | 14.5 ms | 32.5 ms | 38.0 ms | 61 ms | 0.00% | 400 | yes |
| `GET /api/employees` | 2,337 | 12.8 ms | 29.1 ms | 32.5 ms | 39 ms | 0.00% | 300 | yes |
| `GET /api/candidates` | 541 | 13.6 ms | 28.7 ms | 35.4 ms | 274 ms | 0.00% | 300 | yes |
| `GET /api/interviews` | 277 | 12.4 ms | 27.7 ms | 31.9 ms | 35 ms | 0.00% | 300 | yes |
| `GET /api/me` | 7,080 | 10.7 ms | 23.5 ms | 27.3 ms | 162 ms | 0.00% | 150 | yes |
| `GET /api/requests` | 4,835 | 5.0 ms | 21.8 ms | 25.8 ms | 157 ms | 0.00% | 300 | yes |
| `GET /api/vacancies` | 1,114 | 9.7 ms | 21.1 ms | 24.7 ms | 46 ms | 0.00% | 300 | yes |
| `GET /api/notifications` | 7,080 | 4.4 ms | 9.7 ms | 11.6 ms | 161 ms | 0.00% | 250 | yes |
| `PUT /api/notifications/{id}/read` | 7,080 | 3.7 ms | 8.0 ms | 9.5 ms | 115 ms | 0.00% | 400 | yes |
| `GET /api/notifications/unread-count` | 7,080 | 3.6 ms | 7.9 ms | 9.6 ms | 62 ms | 0.00% | 150 | yes |

Business outcomes: 9,492 journeys completed (both journey counters non-zero),
`hr_console_success_rate` and `employee_success_rate` both 100%.

Server side, sampled every 5 s: CPU **4–6%**, working set **430 → 776 → 440 MB**
(a sawtooth — GC, not growth), thread count steady at ~73.

The max column is worth reading: eight of fifteen endpoints show a max between
115 ms and 344 ms against a p99 of 9–79 ms. Those are not one-off outliers, they
are periodic, and they line up with the working-set sawtooth — **GC pauses appear
in the tail**, not in the median.

### Stress test — arrival rate 20 → 640 rps

101,993 requests. **33,007 iterations dropped** — the generator could not get a
VU fast enough to honour the target rate, which is itself the signal that the
system had stopped absorbing load. `vus_max` reached its ceiling of 600.

| Minute | Requests | p50 | p95 | p99 | Target rate |
| --- | --- | --- | --- | --- | --- |
| 0–2 | 1,456 / 1,227 | 18.5 / 14.4 ms | 51.4 / 52.1 ms | 64.1 / 62.9 ms | 20 rps |
| 3–5 | 2,101 / 2,996 / 4,194 | 12.4 / 10.9 / 11.3 ms | 47.0 / 39.9 / 47.3 ms | 59.5 / 54.9 / 99.5 ms | 40 → 80 rps |
| 6–7 | 5,988 / 8,390 | 8.6 / 9.6 ms | 30.2 / 34.7 ms | 41.3 / 44.7 ms | 80 → 160 rps |
| **8** | 11,723 | 12.1 ms | 87.7 ms | **3,222.8 ms** | 160 → 320 rps |
| **9** | 16,788 | 14.2 ms | **2,050.4 ms** | 4,882.0 ms | 320 rps |
| **10** | 16,290 | 15.3 ms | **10,907.1 ms** | 11,511.8 ms | 320 → 640 rps |
| 11–12 | 16,221 / 13,114 | 14.4 / 14.5 ms | ~10,500 ms | ~10,650 ms | 640 → 0 |

The knee is at **minute 8**, between 160 and 320 rps target. Throughput plateaus
around **200–270 rps** while p95 goes from 35 ms to 10.4 s.

Per-endpoint over the whole run — this is the important table:

| Endpoint | Requests | p50 | p95 | p99 |
| --- | --- | --- | --- | --- |
| **`GET /api/dashboard/employee`** | 21,812 | **2,052.3 ms** | **10,839.9 ms** | **11,437.1 ms** |
| `GET /api/dashboard/hr` | 10,021 | 33.5 ms | 46.0 ms | 75.1 ms |
| `GET /api/reports/overview` | 3,023 | 17.8 ms | 29.7 ms | 63.1 ms |
| `GET /api/attendance` | 6,982 | 16.9 ms | 25.1 ms | 40.1 ms |
| `GET /api/employees` | 8,008 | 14.9 ms | 22.3 ms | 34.0 ms |
| `GET /api/requests` | 5,168 | 12.2 ms | 17.9 ms | 27.2 ms |
| `GET /api/me` | 10,118 | 11.9 ms | 17.8 ms | 28.6 ms |
| `GET /api/vacancies` | 3,054 | 10.6 ms | 16.7 ms | 31.1 ms |
| `GET /api/notifications` | 12,710 | 4.7 ms | 7.9 ms | 15.4 ms |
| `PUT /api/notifications/{id}/read` | 8,019 | 3.8 ms | 6.4 ms | 12.7 ms |
| `GET /api/notifications/unread-count` | 11,871 | 3.7 ms | 6.2 ms | 10.0 ms |

Every endpoint except one stayed within its load-test budget while
`dashboard-employee` was **200× slower than the next slowest endpoint**. That is
not a capacity ceiling. That is one broken path.

Server side during the same run: CPU peaked at **32.6%**, working set peaked at
**974 MB**. CPU never came close to saturation while latency was 10 seconds —
the work was waiting, not computing.

### Soak test — 120 VUs, 2 min warmup, 20 min steady state

28,674 requests, **21.2 rps**, 0.073% failed, **0 dropped iterations**. Run at
~35% of modelled peak so the system sits well inside its capacity and any
degradation is attributable to time rather than load.

| Endpoint | Requests | p50 | p95 | p99 | max | Errors |
| --- | --- | --- | --- | --- | --- | --- |
| `POST /api/auth/login` | 510 | 41.6 ms | 527.7 ms | 1,095.9 ms | 1,196 ms | **4.12%** |
| `GET /api/dashboard/employee` | 3,514 | 39.1 ms | 66.7 ms | **1,537.4 ms** | 1,806 ms | 0.00% |
| `GET /api/dashboard/hr` | 1,524 | 31.5 ms | 59.6 ms | 393.7 ms | 754 ms | 0.00% |
| `GET /api/reports/overview` | 457 | 20.1 ms | 35.2 ms | 40.4 ms | 48 ms | 0.00% |
| `GET /api/employees/{id}` | 1,524 | 22.0 ms | 34.6 ms | 39.3 ms | 141 ms | 0.00% |
| `GET /api/attendance` | 1,524 | 20.3 ms | 33.0 ms | 37.9 ms | 78 ms | 0.00% |
| `GET /api/candidates` | 360 | 19.2 ms | 32.6 ms | 45.4 ms | 55 ms | 0.00% |
| `GET /api/employees` | 1,525 | 18.8 ms | 29.2 ms | 33.2 ms | 105 ms | 0.00% |
| `GET /api/interviews` | 183 | 19.4 ms | 28.2 ms | 56.9 ms | 80 ms | 0.00% |
| `GET /api/me` | 3,514 | 15.3 ms | 23.8 ms | 26.0 ms | 53 ms | 0.00% |
| `GET /api/requests` | 2,734 | 7.6 ms | 23.0 ms | 25.2 ms | 878 ms | 0.00% |
| `GET /api/vacancies` | 763 | 13.7 ms | 21.6 ms | 28.3 ms | 42 ms | 0.00% |
| `GET /api/notifications` | 3,514 | 6.8 ms | 10.1 ms | 11.3 ms | 18 ms | 0.00% |
| `PUT /api/notifications/{id}/read` | 3,514 | 5.4 ms | 8.2 ms | 9.3 ms | 20 ms | 0.00% |
| `GET /api/notifications/unread-count` | 3,514 | 5.5 ms | 8.2 ms | 9.5 ms | 191 ms | 0.00% |

**Two thresholds failed:**

1. `http_req_failed{name:login}` — 4.12% against a 1% budget.
2. `http_req_duration{name:dashboard-employee}` p(99) — 1,537 ms against 1,000 ms.

**Drift: none.** Minutes 3–21 held p95 between 42 ms and 49 ms, and the working
set was flat at **472 MB** from minute 9 to the end of the run (472.1–472.9 MB
across 15 samples a minute). CPU stayed at 1.5–2.8%. This is a system that is
stable over time at this load; it is not leaking.

The one spike is minute 2 — p95 1,085 ms, max 1,806 ms. That is the instant all
120 VUs start, each performing its first lazy login and first dashboard load
simultaneously. It is a startup burst, not drift, and it is the same signature
that produced the login failures.

## 4. Capacity

- **SLO breach point** (p95 > 500 ms): approximately **200 rps**, dominated
  entirely by `dashboard-employee`.
- **Failure point**: the system does not fail — it queues. At 640 rps target it
  held ~270 rps and served the excess at 10.4 s p95 with near-zero errors.
- **Modelled peak production load**: ~43 rps.
- **Headroom**: roughly **4.7×** to the SLO breach point.
- **Scaled to production sizing**: **not transferable.** This environment has 17
  employees against a 2,000-employee target and a 14 MB database against a
  GB-scale one. Per-endpoint shape transfers; absolute capacity does not.

## 5. Shapes observed

| Shape | Looks like | Usual cause | Seen here |
| --- | --- | --- | --- |
| **Knee** | Throughput plateaus while latency climbs | Capacity limit: CPU, pool, or a lock | **Yes** — at ~200 rps, on one endpoint |
| **Sawtooth** | Regular latency spikes on a fixed period | GC pauses, cache expiry, a cron job | **Yes** — working set 430→776→440 MB, and the max column shows it |
| **Drift** | Latency or memory climbing steadily | Leak, unbounded cache, connection accumulation | **No** — p95 flat at 42–49 ms for 19 min, working set flat at 472 MB |
| **Cliff** | Sudden failure past a point | Connection pool, file descriptors, hard limit | **No** — latency degrades, errors do not rise |
| **Bimodal** | Two clusters in the distribution | Cache hit vs miss, two code paths | Not observed on this dataset |

## 6. Bottleneck

> **`GET /api/dashboard/employee` collapses under concurrency: p50 2.05 s and
> p95 10.8 s, while every other endpoint held p95 ≤ 46 ms in the same run.**
>
> Evidence:
>
> 1. **Isolation.** In the stress run every endpoint except this one met its
>    load-test budget. The global p95 of 10.4 s is entirely this endpoint.
> 2. **Not CPU.** The API process peaked at 32.6% CPU while latency was 10 s.
>    Thread count stayed at ~83. The work was blocked, not computed.
> 3. **Query count.** `DashboardService.GetDashboardAsync` issues
>    **18 `GetAllAsync` calls plus 2 `GetByIdAsync` calls** — 20 sequential
>    database round trips per request, all awaited one after another.
> 4. **Connection ceiling.** The connection string sets no pool options, so
>    Npgsql uses its default `Maximum Pool Size = 100`, and PostgreSQL's
>    `max_connections` is also 100. Each of those 20 round trips acquires and
>    releases a pooled connection. At the knee there were roughly 60 requests/s
>    of this endpoint in flight, each wanting a connection 20 times in sequence.
> 5. **The shape matches a pool wait, not a query.** p50 stays low while p95 and
>    max pin at 10–11.5 s — a queue that drains just before a timeout, not a slow
>    query. A genuinely slow query would move p50 too.

**Not yet confirmed**: which of the 20 queries is the marginal one, and whether
raising the pool alone moves the bottleneck to Postgres CPU or to thread-pool
saturation. That needs a re-run with `pg_stat_activity` sampled during the knee,
which this run did not capture.

### A correctness bug the soak surfaced: concurrent logins return 500

**`POST /api/auth/login` returned HTTP 500 for 4.12% of attempts** in the soak
(21 requests) and for 6 requests in the stress run. This is not throttling and
not a timeout — the API log shows the exact exception:

```
Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException:
  The database operation was expected to affect 1 row(s), but actually affected 0 row(s)
  at NpgsqlModificationCommandBatch.ThrowAggregateUpdateConcurrencyExceptionAsync
```

Cause:

1. `User` is configured with `UseXminAsConcurrencyToken()`
   (`UserModuleConfigurations.cs:182`).
2. `AuthService.LoginAsync` sets `FailedLoginAttempts = 0` and `LockoutEnd = null`
   on the tracked entity, and `IssueTokensAsync` then writes `LastLoginAt` and
   saves.
3. Two logins for the **same account** running concurrently both read the same
   `xmin`, and both issue an `UPDATE ... WHERE xmin = ?`. The second affects 0
   rows, EF raises `DbUpdateConcurrencyException`, and the exception middleware
   turns it into a 500.

**Why it showed up so strongly here**: the suite drives two seeded accounts
(`hr@revive.hr`, `karim@revive.hr`) from every VU, so same-account collisions are
constant. Real traffic spreads across thousands of accounts and would hit this
far less often. But the failure mode is real and user-facing: two tabs signing in
at once, a client retry after a timeout, or a shared kiosk account will all
produce a 500 instead of a login.

A login should not fail because it raced another login for the same account.
`LastLoginAt` and the lockout counters are advisory state; a lost update there is
harmless, so the write should not be treated as a hard concurrency conflict.

### Secondary findings

These did not cause the collapse but are the reasons the system is slower than it
needs to be.

1. **The HR dashboard issues `19 + 2 × (gym count)` queries.** It loads **all**
   gyms and **all** employees with `GetAllAsync(cancellationToken)` — the
   parameterless overload, which is a full table load **with change tracking**
   (the spec-based path correctly defaults to `AsNoTracking`, this one does not).
   It then loops over every gym for vacancies and payroll periods, and runs five
   permission checks that each cost two more queries. At the stated 50-gym
   target that is ~119 queries per dashboard load. It measures 53 ms today only
   because there is one gym and 17 employees.
2. **Every authenticated request costs an extra database query.** The JWT
   `OnTokenValidated` handler calls `IsSessionAllowedAsync`, which loads the user
   row on every request. This is a deliberate security decision (revocation takes
   effect on the next call rather than in 15 minutes) and should stay — but it
   should be cached with a short TTL, not removed.
3. **No response compression.** 7 KB JSON for `dashboard/hr` and 3 KB for
   `dashboard/employee`, uncompressed, at ~57 rps.
4. **No caching layer of any kind.** No `AddMemoryCache`, no output caching, no
   `AddDbContextPool`. Every dashboard request recomputes the full aggregate from
   scratch.
5. **`AddDbContext` rather than `AddDbContextPool`.** A new `DbContext` and its
   change tracker are allocated per request.

## 7. What this does not tell you

- **The database is 0.7% of production's expected size.** 835 attendance rows and
  a 14 MB database fit entirely in `shared_buffers` (128 MB). Query plans that
  are index scans here become sequential scans above roughly a million rows. The
  HR dashboard's full-table employee load is invisible at 17 rows and would not
  be at 2,000.
- **The load generator shared the CPU with the API.** Achieved throughput is a
  floor. The 200 rps knee may be partly the generator.
- **Biometric endpoints were not exercised.** `POST /api/attendance/face-scan`
  and `/events` are the hottest path in the real system and are absent here.
- **Kiosk polling was modelled but not driven.** ~7 rps of `station-summary` is
  in the workload model and in no scenario.
- **Only one write path was measured.** Hiring, payroll approval and bulk import
  are unmeasured; write contention is unobserved.
- **The suite drives two accounts.** All VUs authenticate as `hr@revive.hr` or
  `karim@revive.hr`, which inflates same-account collisions. The 4.12% login
  error rate is therefore an upper bound for this bug, not a production
  prediction — but the bug itself is real.
- **The soak is 20 minutes, not hours.** Long enough to catch a fast leak, too
  short to distinguish a slow one from noise. A real soak is 4–24 hours.
- **No database-side metrics during the stress knee.** `pg_stat_activity` was not
  sampled at the moment of collapse, so pool exhaustion is inferred from the
  shape and the configuration, not observed directly.
- **Single instance, no autoscaling.** Nothing here describes horizontal scaling.

## 8. Recommendations

| # | Action | Owner | Expected effect | Blocks release |
| --- | --- | --- | --- | --- |
| 1 | Make the login write tolerant of a lost update — update `LastLoginAt` / lockout counters with a targeted `ExecuteUpdate`, or catch `DbUpdateConcurrencyException` and continue, since the state is advisory | Backend | Removes the 4% HTTP 500 rate on concurrent logins for one account | **Yes** |
| 2 | Reduce the 20 sequential round trips in `GetDashboardAsync` — combine the month's records, assignments, day-offs and cover-days into fewer queries, and run independent ones concurrently | Backend | Removes the pool pressure that causes the collapse; expected p95 at 200 rps from 10.8 s to under 200 ms | **Yes** |
| 3 | Set an explicit `Maximum Pool Size` in the connection string and raise PostgreSQL `max_connections` to match | Backend / DBA | Removes the hard 100-connection ceiling; must be sized against Postgres `max_connections` so the app cannot starve other clients | **Yes** |
| 4 | Replace `GetAllAsync(cancellationToken)` on Gym and Employee in `GetHrDashboardAsync` with scoped, `AsNoTracking` queries, and collapse the two per-gym loops into single `IN` queries | Backend | Turns ~119 queries into ~12 at 50 gyms | **Yes** |
| 5 | Cache the session-validity check with a short TTL (30–60 s) | Backend | Removes one database round trip from every authenticated request; revocation stays bounded | No |
| 6 | Enable `AddResponseCompression` for JSON | Backend | ~70–80% reduction on the 3–7 KB dashboard payloads | No |
| 7 | Switch to `AddDbContextPool` | Backend | Lower per-request allocation; fewer GC pauses in the tail | No |
| 8 | Re-run the stress test with `pg_stat_activity` sampled during the knee | QA | Confirms pool exhaustion directly instead of inferring it | No |
| 9 | Spread the load test across many seeded accounts, not two | QA | The login error rate is inflated by same-account collisions; a wider pool separates the bug from the test's own shape | No |
| 10 | Run an 8-hour soak before go-live | QA | The 20-minute run cannot detect slow drift | No |
| 11 | Add `smoke.js` to CI | QA | Catches route and contract regressions in seconds | No |
| 12 | Load-test the biometric endpoints with a station session | QA | The hottest real-world path is currently unmeasured | No |

## 9. Comparison with the previous run

None. This is the first performance run on this codebase, so there is no
baseline to compare against. Subsequent runs should be compared on the same
hardware, with the same seed volume and the same scenario shapes — one variable
at a time, or the comparison attributes nothing.
