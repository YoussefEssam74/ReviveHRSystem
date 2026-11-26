# 15 — Subscriptions, plans & automated access control

**Screen:** `/console/subscriptions`.
- `admin` (Revive Admin / Top Management) sees every gym, the plan catalog and the request queue.
- `omar` (Branch Manager at gym1, Team Leader at gym2) sees the gym-side self-service view **only when signed in to gym1**; selecting gym2 denies it.
- `hrm`/`hr`/`emp` and anonymous callers are rejected (401).

The seeded gyms start on the Starter/Growth plans with the current month already paid, so all demo accounts can sign in. Use a test gym for overdue scenarios.

---

## Overview & detail

### GET /api/subscriptions

| # | Actor | Input | Expected |
|---|---|---|---|
| 15.1 | admin | — | 200 `{ settings, summary, items[], unconfiguredGyms[] }` — one row per configured gym with `status`, `amount`, `nextDueDate`, `gracePeriodDays`, `outstandingAmount` |
| 15.2 | hrm / hr / emp | — | 401 (`Only Revive Admin…`) · `anon` → 401 |

### GET /api/subscriptions/{gymId}

| # | Actor | Input | Expected |
|---|---|---|---|
| 15.3 | admin | configured gym id | 200 `{ subscription, settings, invoices[], payments[] }` |
| 15.4 | admin | unknown id | 404 |

---

## Terms (amount, cycle, grace, reminders)

### PUT /api/subscriptions/{gymId}

```json
{
  "amount": 4500,
  "billingCycleMonths": 1,
  "gracePeriodDays": 7,
  "reminderLeadDays": 3,
  "autoSuspensionEnabled": true,
  "billingStartDate": "2026-11-01"
}
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 15.5 | admin | new gym + happy body | 200 — agreement created, current invoice raised, status `Active` |
| 15.6 | admin | grace `0`, start date two months ago | 200 — effective status becomes `Suspended` (past grace) |
| 15.7 | admin | `amount: 0` / cycle `0` / grace `120` | 400 validation |
| 15.8 | hrm | — | 401 |

Changing the grace window of an unpaid invoice updates its grace end date, so the
access gate immediately reflects the new terms.

---

## Recording payments (automatic reactivation)

### POST /api/subscriptions/{gymId}/payments

```json
{ "amount": 4500, "method": "BankTransfer", "reference": "TRX-1", "notes": "November subscription" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 15.9 | admin | amount = outstanding | 200 — oldest invoice(s) settle; message says access was restored if the gym was auto-suspended |
| 15.10 | admin | partial amount | 200 — invoice balance reduces; gym stays in grace/suspended until cleared |
| 15.11 | admin | amount > outstanding | 400 (`payment exceeds the outstanding balance`) |
| 15.12 | admin | gym with no unpaid invoice | 400 (`no outstanding subscription balance`) |
| 15.13 | hrm | — | 401 |

After a full payment, signing in as a gym user succeeds immediately.

---

## Manual suspension / reactivation

### POST /api/subscriptions/{gymId}/suspend

```json
{ "reason": "Payment dispute" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 15.14 | admin | configured gym | 200 — `status: "Suspended"`, reason shown in the detail |
| 15.15 | gym user | `POST /api/auth/login` | 401 with the suspension message: *“Your HR system access has been temporarily suspended…”*; existing tokens also 401 |
| 15.16 | admin | `POST /api/auth/login` | 200 (Top Management bypass) |

### POST /api/subscriptions/{gymId}/reactivate

```json
{ "overrideDays": 7 }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 15.17 | admin | suspended gym | 200 — access restored; `accessOverrideUntil` set (blank/omitted uses the gym's grace window; `0` grants no override) |
| 15.18 | gym user | login | 200 while the override is active |
| 15.19 | admin | cancelled subscription | 400 |

A manual suspension is not cleared by recording a payment; use reactivate (or the
sweep once the override expires).

---

## Platform settings & the cycle

### PUT /api/subscriptions/settings

```json
{
  "defaultBillingCycleMonths": 1,
  "defaultGracePeriodDays": 7,
  "reminderLeadDays": 3,
  "autoSuspensionEnabled": true,
  "currency": "EGP"
}
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 15.20 | admin | happy body | 200 — echoed settings; new invoices use the new defaults |
| 15.21 | admin | grace `120` / cycle `0` | 400 |
| 15.22 | hrm | — | 401 |

### POST /api/subscriptions/run-cycle

| # | Actor | Input | Expected |
|---|---|---|---|
| 15.23 | admin | — | 200 `{ gymsProcessed, invoicesCreated, remindersSent, overdueNoticesSent, gymsSuspended, gymsReactivated }` |
| 15.24 | admin | run twice with no state change | 200 — idempotent: no duplicate invoices/notifications |
| 15.25 | hrm | — | 401 |

The same cycle runs automatically every `Subscriptions:SweepIntervalHours` (default 6)
via the hosted background service. It is disabled in the Testing environment.

---

## Plan catalog

### GET /api/subscription-plans · POST · PUT /{planId} · DELETE /{planId}

```json
{ "name": "Growth", "description": "Growing gyms.", "pricePerCycle": 6500, "billingCycleMonths": 1, "gracePeriodDays": 7, "reminderLeadDays": 3, "isActive": true, "sortOrder": 2 }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 15.26 | admin | GET | 200 every plan with `gymCount` (Starter=1, Growth=1, Enterprise=0) |
| 15.27 | admin | POST unique name | 200 `{ id, name, pricePerCycle, gymCount: 0 }` |
| 15.28 | admin | POST duplicate name | 400 |
| 15.29 | admin | PUT `{ pricePerCycle, isActive:false }` | 200; archived plans remain on existing gyms |
| 15.30 | admin | DELETE `{planId}` | 204; plan disappears from the gym-side active catalog |
| 15.31 | omar (gym1) | GET | 200 active plans only |
| 15.32 | emp / hrm / anon | GET | 401 |

---

## Gym self-service (Branch Manager / Super Admin)

### GET /api/subscriptions/mine

| # | Actor | Input | Expected |
|---|---|---|---|
| 15.33 | omar (selected gym1) | — | 200 `{ subscription, availablePlans[], pendingRequests[] }` — Starter, Active, next due, invoices, payments |
| 15.34 | omar (selected gym2 — Team Leader only) | — | 401 |
| 15.35 | hrm / emp | — | 401 |

### POST /api/subscriptions/mine/requests

```json
{ "type": "PlanChange", "requestedPlanId": 2, "note": "We are expanding." }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 15.36 | omar (gym1) | `PlanChange` to Growth | 200 `{ id, type:"PlanChange", status:"Pending", currentPlanName:"Starter", requestedPlanName:"Growth" }` |
| 15.37 | omar (gym1) | second request while one is pending | 400 |
| 15.38 | omar (gym1) | `PlanChange` to the current plan | 400 |
| 15.39 | omar (gym1) | `{ "type": "Renewal" }` | 200; renewal request with the current plan |
| 15.40 | emp / hrm | — | 401 |

The gym-side page shows the pending banner, current plan/status/due date, available upgrade plans, invoices and payment history.

### Request review (Revive Admin)

| # | Actor | Input | Expected |
|---|---|---|---|
| 15.41 | admin | `GET /api/subscriptions/requests?status=Pending` | 200 the submitted requests |
| 15.42 | admin | `POST /api/subscriptions/requests/{id}/approve` | 200 — plan applied (Growth/6500); gym notified; request leaves Pending |
| 15.43 | admin | approve the same request again | 400 (already reviewed) |
| 15.44 | admin | `POST /api/subscriptions/requests/{id}/reject` `{ note }` | 200 — request Rejected, gym notified with the note |
| 15.45 | omar | approve/reject | 401 |

---

## Explicit due-date control

`PUT /api/subscriptions/{gymId}` now accepts `nextDueDate` (and `planId`):

```json
{ "amount": 4500, "billingCycleMonths": 1, "gracePeriodDays": 7, "reminderLeadDays": 3, "autoSuspensionEnabled": true, "planId": 1, "nextDueDate": "2026-12-15" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 15.46 | admin | `nextDueDate` future | 200; detail `nextDueDate` equals it; the reminder uses the new date |
| 15.47 | admin | `nextDueDate` past, inside grace | 200; effective status `GracePeriod`; the sweep sends **Subscription grace period started** |
| 15.48 | admin | `nextDueDate` past grace | 200; effective status `Suspended`; gym login returns the suspension message |
| 15.49 | admin | `planId` of another active plan | 200; amount/cycle follow the plan (amount remains overridable) |
| 15.50 | admin | archived `planId` on a new assignment | 400 |

---

## Lifecycle verification (end-to-end)

1. Create a test gym + employee (or use `POST /api/employees` and assign gym access).
2. `PUT /api/subscriptions/{gymId}` with `billingStartDate` in the past and
   `gracePeriodDays: 0`.
3. Login as the employee → **401 suspension message** (enforced immediately from
   the invoice due date, before the sweep).
4. `POST /api/subscriptions/run-cycle` → `gymsSuspended >= 1`; the gym receives
   in-app notifications; the overview/detail shows `Suspended`.
5. `POST /api/subscriptions/{gymId}/payments` with the outstanding amount →
   `message` mentions access restored, status `Active`.
6. Login as the employee → **200** with an access token.
