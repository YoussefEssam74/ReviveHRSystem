# 00 — Auth & Session (login, gym context, profile, password)

**Screens:** boot/login flow backing every other screen. **Guard:** public or plain JWT.
Actors: `hrm`, `hr`, `admin`, `bm`, `emp`, `anon`, `bad`.

---

### POST /api/auth/login

Canonical body (Swagger pre-fills this — swap the email):

```json
{ "email": "hrmanager@revive.hr", "password": "Revive!2026" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 0.1 | anon | `hrmanager@revive.hr` / `Revive!2026` | 200 **completed session directly** — `requiresGymSelection: false`, `user.gymAccess` lists both gyms, **no** tempSessionToken (verified live: HR-type users skip gym selection; `activeGym` stays null until a gym is chosen via 0.25) |
| 0.2 | anon | `hr@revive.hr` / `Revive!2026` | 200 `{ accessToken, expiresInSeconds, requiresGymSelection: false, user: {...} }` (single gym → full session immediately) |
| 0.3 | anon | `karim@revive.hr` / `Revive!2026` | 200 completed session (employee login works — needed for self-service negatives) |
| 0.3b | anon | `omar@revive.hr` / `Revive!2026` | 200 `{ accessToken, expiresInSeconds, requiresGymSelection: true, gyms: [...], tempSessionToken }` — **omar is the only seed account that hits the gym-selection flow** (non-HR, two gyms); use his tempSessionToken in 0.8–0.12 |
| 0.4 | anon | `hrmanager@revive.hr` / `wrong-password` | 401 `{ errorMessage: "Invalid email or password." }` |
| 0.5 | anon | `nobody@revive.hr` / `Revive!2026` | 401 same message (unknown ≠ disabled leak) |
| 0.6 | anon | `{}` (both fields missing) | 400 validation (`errors.email` / `errors.password`) |
| 0.7 | anon | 12 rapid wrong logins from one IP | 429 (login rate limit) |

---

### POST /api/auth/login/select-gym

```json
{ "gymId": 1, "tempSessionToken": "<tempSessionToken from 0.3b>" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 0.8 | anon | valid temp token + `gymId: 1` | 200 completed-session shape (`accessToken`, `requiresGymSelection: false`, `user`) |
| 0.9 | anon | valid temp token + `gymId: 999` | 401 "You do not have access to the selected gym." |
| 0.10 | anon | `tempSessionToken: "forged"` + `gymId: 1` | 401 |
| 0.11 | anon | missing `tempSessionToken` | 400/401 (validation) |
| 0.12 | anon | reuse the token from 0.8 | 401 (temp token consumed) |

---

### GET /api/me

| # | Actor | Input | Expected |
|---|---|---|---|
| 0.13 | hrm | — (before any switch-gym) | 200 `{ userId, email, userName, userType, activeGym: null, gyms: [2 gyms], roleInActiveGym: null, ledTeamId: null, featureLevels: {} }` — verified live: **activeGym and featureLevels are empty until a gym is chosen** (HR tokens carry no default gym) |
| 0.13b | hrm | after `switch-gym` (0.25) | `activeGym: { gymId: 1, gymName: "Revive Main Gym" }`, `roleInActiveGym: "HR Manager"`, `featureLevels` populated (56 features) |
| 0.14 | hr | — | 200 `activeGym` = gym1, `gyms` length 1, `featureLevels` shows portal features at level ≥ 1 |
| 0.15 | admin | — | 200 all features at level 2 (Edit), `activeGym: null` acceptable for unscoped Super Admin |
| 0.16 | anon | — | 401 |
| 0.17 | bad | — | 401 |

---

### GET /api/auth/me

| # | Actor | Input | Expected |
|---|---|---|---|
| 0.18 | hrm | — | 200 portal profile `{ id, fullName, email, role, permissions[], gyms: [...], selectedGym, status }` — `permissions` contains the seeded portal keys |
| 0.19 | admin | — | 200 with `permissions: []` — legitimately empty (TopManagement bypasses, ADR-003) |
| 0.20 | emp | — | 200 (employee profile, `selectedGym: 1`) |
| 0.21 | anon | — | 401 |

---

### GET /api/gyms

| # | Actor | Input | Expected |
|---|---|---|---|
| 0.22 | hrm | — | 200 `[{ id, name, branch, employees }]` = both assigned gyms (not narrowed by selected gym) |
| 0.23 | hr | — | 200 only gym1 (assignment-scoped) |
| 0.24 | anon | — | 401 |

---

### POST /api/auth/switch-gym

```json
{ "gymId": 2 }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 0.25 | hrm | `{"gymId": 2}` (currently scoped to gym1) | 200 `{ accessToken, expiresInSeconds, me }` — `me.activeGym.gymId == 2`; use the new token for subsequent gym2 cases |
| 0.26 | hrm | `{"gymId": 1}` | 200 back to gym1 |
| 0.27 | hr | `{"gymId": 2}` | 401 "You do not have access to the selected gym." (hr is gym1-only) |
| 0.28 | hrm | `{"gymId": 999}` | 401 unknown gym |
| 0.29 | hrm | `{}` | 400 validation |
| 0.30 | emp | `{"gymId": 2}` | 401 (not assigned) |

---

### POST /api/auth/logout

| # | Actor | Input | Expected |
|---|---|---|---|
| 0.31 | hrm | — | 204, writes an `AuditLog` row `{ action: "Logout", entityType: "User" }` |
| 0.32 | hrm | call again with same token | 204 again (idempotent — server has no session to revoke, ADR-002: token still valid until expiry; client discards it) |
| 0.33 | anon | — | 401 (framework, before the handler) |

---

### POST /api/auth/change-password

```json
{ "currentPassword": "Revive!2026", "newPassword": "NewPass!2026" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 0.34 | hrm | correct current + 8+ char new | 204; then login (0.1) with `NewPass!2026` succeeds |
| 0.35 | hrm | wrong `currentPassword` | 401 |
| 0.36 | hrm | new password shorter than 8 chars | 400 |
| 0.37 | hrm | same as current password | 400 (policy) |
| 0.38 | anon | — | 401 |

> Restore `hrm` back to `Revive!2026` after case 0.34 so the rest of the suite logs in consistently.

---

### GET /api/me/settings · PUT /api/me/settings

```json
{ "requests": true, "attendance": true, "recruitment": false, "management": true, "announcements": true }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 0.39 | hrm | GET | 200 all five prefs default `true` for a fresh user |
| 0.40 | hrm | PUT with `recruitment: false` then GET | 200 persists; GET echoes `recruitment: false` |
| 0.41 | hrm | PUT partial `{ "requests": false }` | 200 — unspecified keys keep their values |
| 0.42 | anon | GET | 401 |
