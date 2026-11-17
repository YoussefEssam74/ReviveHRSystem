# 04 — Recruitment & Hiring (7 tabs + pipeline sub-tabs)

**Screen:** `recruitment` — tabs: Vacancies, Vacancy Requests, Candidates (pipeline),
Applications (applicant pane), Interviews, Follow-ups & Waiting List, New Comers.
**Guards:** reads `recruitment.view`; writes split over `recruitment.vacancies.manage`,
`recruitment.candidates.manage`, `recruitment.vacancy_request.create` (BM submit),
`recruitment.vacancy_request.approve`, `recruitment.hire.approve` — all gym-scoped.
Envelope deviation: lists use `{ items, page, pageSize, total, totalPages }`.

Workflow order for the happy path: **create vacancy → vacancy request (bm) → decide (hrm)
→ candidate card → stage moves → interview → hire → new-comer checklist**.

---

## Vacancies tab

### GET /api/vacancies

Query: `?gym=&status=Open|Draft|Closed&searchTerm=&page=&pageSize=20&sortBy=createdDate|position|headcount&sortOrder=asc|desc`

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.1 | hrm | `?page=1` | 200 `{ items, page, pageSize, total, totalPages }`; item `{ id, positionId, position, gymId, gym, headcount, urgency, status, createdDate, candidates, requestedBy, salary, shift, source, description, requirements }` |
| 4.2 | hrm | `?status=Open` | 200 open only; `candidates` counts non-rejected applications |
| 4.3 | hrm | `?searchTerm=Trainer` | 200 title/position/gym substring matches |
| 4.4 | hrm | `?sortBy=headcount&sortOrder=desc` | 200 ordering applied |
| 4.5 | hr | `?gym=2` | 401 (outside assignment) |
| 4.6 | emp | `?page=1` | 401 (`recruitment.view`) |
| 4.7 | anon / bad | — | 401 |

### GET /api/vacancies/{id} — detail modal

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.8 | hrm | happy id | 200 `{ data: <vacancy>, funnel: [{ stage, count }], employeesUnderPosition: [...], candidates: [...] }` |
| 4.9 | hr | gym2 vacancy | 401 |
| 4.10 | hrm | 999999 | 404 |

### POST /api/vacancies

```json
{
  "position": "Front Desk",
  "gym": 1,
  "headcountNeeded": 2,
  "urgency": "High",
  "source": "Referral",
  "jobDescription": "Reception and member onboarding.",
  "requirements": "Excel, English.",
  "salary": 8000,
  "shift": "Morning",
  "status": "Open"
}
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.11 | hrm | happy body | 201 `{ data: <vacancy> }` with a fresh public-link token; unknown position **created at level 1** in the gym catalog |
| 4.12 | hrm | `"status": "Open"` only (minimal `{ position, gymId }`) | 201 defaults apply (`headcountNeeded` 1, `urgency` medium) |
| 4.13 | hrm | missing `position` | 400 |
| 4.14 | hrm | `"urgency": "Urgent"` | 400 (only Low/Medium/High) |
| 4.15 | hrm | `"gym": 999` | 400 unknown gym |
| 4.16 | hr | `"gym": 2` | 401 |
| 4.17 | emp | — | 401 (`recruitment.vacancies.manage`) |

### PUT /api/vacancies/{id} — partial update

```json
{ "headcountNeeded": 3, "urgency": "Medium", "status": "Draft" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.18 | hrm | happy body | 200 `{ data }` — only supplied fields change |
| 4.19 | hrm | `{}` | 200 no-op |
| 4.20 | hrm | `"status": "Paused"` | 400 |
| 4.21 | hr | gym2 vacancy | 401 |
| 4.22 | hrm | unknown id | 404 |

---

## Vacancy Requests tab

### GET /api/vacancy-requests

Query: `?status=Pending|Approved|Rejected&gym=&page=&pageSize=` (newest first)

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.23 | hrm | `?page=1` | 200 list `{ id, positionId, position, gymId, gym, urgency, status, submittedBy, submittedDate, reason, salary, shift, headcount, decidedBy, vacancyId }` |
| 4.24 | hrm | `?status=Pending` | 200 pending only |
| 4.25 | emp | — | 401 (`recruitment.view`) |

### POST /api/vacancy-requests — Branch-Manager submit

```json
{ "position": "Trainer", "gym": 1, "urgency": "High", "reason": "Peak season coverage.", "salary": 9000, "shift": "Evening", "headcount": 2 }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.26 | bm | happy body (gym1) | 201 `{ data: <request> }` with `status: "Pending"` |
| 4.27 | hrm | happy body | 201 (HR may submit too) |
| 4.28 | bm | missing `reason` | 400 |
| 4.29 | bm | `"gym": 2` (he has gym2 as Team Leader — try both) | 201 if in his access, else 401 — records actual |
| 4.30 | emp | — | 401 (`recruitment.vacancy_request.create` missing) |

### PUT /api/vacancy-requests/{id}/decide

```json
{ "decision": "Approved", "comment": "Approved for Q4.", "headcountNeeded": 2, "urgency": "High" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.31 | hrm | approve a Pending request | 200 `{ data: <request with status Approved + decidedBy + vacancyId> }` — a public Vacancy is created (`source: "Vacancy Request"`) |
| 4.32 | hrm | the same id again | 400 already decided |
| 4.33 | hrm | `{"decision":"Rejected","comment":"Budget."}` | 200 status Rejected, **no** vacancy created |
| 4.34 | hrm | `{"decision":"Maybe"}` | 400 invalid decision |
| 4.35 | bm | — | 401 (`recruitment.vacancy_request.approve`) |
| 4.36 | hr | gym2 request | 401 |

### PUT /api/vacancy-requests/{id}/reopen

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.37 | hrm | reopen an approved request whose vacancy has **no** applicants | 200 `{ id, status: "Pending", decidedBy: null, vacancyWithdrawn: true }` |
| 4.38 | hrm | reopen when the vacancy **has** applicants | 200 `vacancyWithdrawn: false` (vacancy kept) |
| 4.39 | hrm | reopen a Pending request | 400 already pending |
| 4.40 | bm | — | 401 |

---

## Candidates (pipeline kanban + candidate sub-tabs)

### GET /api/candidates

Query: `?searchTerm=&stage=Applied|Screening|First Interview|Second Interview|Accepted|Rejected|Hired&position=&view=active|rejected&blocked=true|false&page=&pageSize=&sortBy=applied|name&sortOrder=`

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.41 | hrm | `?page=1` | 200 card list `{ id, applicationId, name, initials, position, stage, appliedDate, phone, rating, blocked, form: {…}, screen, iv1, iv2, decision }` |
| 4.42 | hrm | `?stage=Screening` | 200 one column of the kanban |
| 4.43 | hrm | `?view=active` vs `?view=rejected` | disjoint sets; `?blocked=true` shows blocked cards with `blockReason` |
| 4.44 | hrm | `?searchTerm=smail` | name/email/phone/position substring |
| 4.45 | hr | `?gym`-scoped implicitly | gym2 candidates absent (scope intersection) |
| 4.46 | emp | — | 401 |

### GET /api/candidates/{id} — candidate detail

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.47 | hrm | happy id | 200 `{ data: <card> }` incl. `form`, `screen`, `iv1`, `iv2`, `decision` |
| 4.48 | hr | gym2 candidate | 401 |
| 4.49 | hrm | unknown / candidate with no applications | 404 |

### PUT /api/candidates/{id}/block

```json
{ "blocked": true, "blockReason": "Policy breach in previous application." }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.50 | hrm | block | 200 `{ id, blocked: true, blockReason }` — card leaves the active pipeline (`?view=active`) |
| 4.51 | hrm | `{ "blocked": false }` | 200 unblocked, `blockReason` cleared/stale per implementation |
| 4.52 | hrm | `{ "blocked": true }` no reason | 200 (reason optional) — record actual |
| 4.53 | hr | gym2 candidate | 401 (`recruitment.candidates.manage`) |
| 4.54 | hrm | unknown id | 404 |

### POST /api/candidates — "Add to Pipeline" conversion

```json
{ "applicationId": 17 }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.55 | hrm | a `New`/`In Review` applicant id | 201 `{ data: <candidate card stage Applied>, applicationStatus: "Moved to Pipeline" }` — vacancy-less Application (`VacancyId: null`) |
| 4.56 | hrm | same application again | 400 already converted |
| 4.57 | hrm | `{}` | 400 missing applicationId |
| 4.58 | hrm | unknown id | 404 |
| 4.59 | emp | — | 401 |

---

## Applications pane

### GET /api/applications

Query: `?formId=&status=New|In Review|Shortlisted|Rejected|Moved to Pipeline&searchTerm=&page=&pageSize=20`

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.60 | hrm | `?page=1` | 200 items `{ id, name, email, phone, gym, formId, formName, position, appliedDate, status, rejectComment, answers: [{ question, type, answer }] }`, newest first |
| 4.61 | hrm | `?status=Bogus` | 200 with **empty** list (unknown value = no match, no error) |
| 4.62 | hrm | `?searchTerm=@` | 200 substring matches |
| 4.63 | emp | — | 401 (`recruitment.candidates.manage`) |

### GET /api/applications/{id} · PUT /api/applications/{id}/reject

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.64 | hrm | GET happy id | 200 `{ data }` full answers + reject comment + position/branch/status |
| 4.65 | hrm | PUT `{"comment":"Not a fit."}` | 200 `{ data: { id, status: "Rejected" } }`; idempotent repeat OK |
| 4.66 | hrm | reject a **converted** (Moved to Pipeline) row | 400 "already in the pipeline" |
| 4.67 | hrm | unknown id | 404 |
| 4.68 | hr | gym2-preferred applicant | 401 |

### POST /api/applications — public hiring form (anonymous)

```json
{
  "formId": 1,
  "name": "Public Applicant",
  "email": "public.applicant@example.com",
  "phone": "01234567890",
  "gymPref": "Nasr City",
  "position": "Trainer",
  "answers": [ { "question": "Why do you want to join?", "type": "text", "answer": "Love fitness." } ],
  "skills": ["Weight training"],
  "languages": ["Arabic", "English"]
}
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.69 | anon | happy body (form must be **Open**) | 201 `{ message: "Application submitted." }` — applicant row `Status: "New"` |
| 4.70 | anon | missing `formId`/`name`/`email` | 400 |
| 4.71 | anon | `"email": "not-an-email"` | 400 (must contain "@") |
| 4.72 | anon | closed form id | 400; unknown form id → 404 |
| 4.73 | anon | blocked candidate's email (4.50) | 400 (§5.1.3 gate) |
| 4.74 | anon | 35 rapid submissions from one IP | 429 (`public-forms` policy, default 30/min) |
| 4.75 | anon | — | Then `GET /api/applications?searchTerm=public.applicant` as hrm shows the row with `status: "New"` |

### PUT /api/applications/{id}/stage — kanban drag

```json
{ "stage": "Screening" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.76 | hrm | `{"stage":"Screening"}` | 200 `{ id, stage, iv2 }` — PipelineStage row recorded, follow-up clock reset |
| 4.77 | hrm | backward `{"stage":"Applied"}` | 200 (moves allowed both directions) |
| 4.78 | hrm | `{"stage":"Second Interview"}` with none | 200 — auto-schedules a Panel round returned as `iv2` |
| 4.79 | hrm | `{"stage":"Rejected"}` | 200 — `rejectedAt/by` stamped |
| 4.80 | hrm | `{"stage":"Accepted"}` | 200 — decision stamped |
| 4.81 | hrm | `{"stage":"Hired"}` | **400** — Hired only through the hire wizard |
| 4.82 | hrm | `{"stage":"Bogus"}` | 400 |
| 4.83 | hr | gym2 application | 401 |

### POST /api/applications/{id}/hire — hire wizard (Hired transition)

```json
{
  "gym": 1,
  "offerLetterNote": "Welcome aboard!",
  "salary": 10000,
  "annualIncrease": 5,
  "leaveDays": 21,
  "startDate": "2026-11-01",
  "contractType": "FullTime",
  "level": "Senior",
  "email": "hired.candidate@revive.hr",
  "role": "Employee"
}
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.84 | hrm | happy body on an Accepted candidate | 201 `{ data: { employeeId, name, position, level, gym, status, startDate, email, salary, leaveDays, role, newComerId, hiredDate, vacancyHeadcountRemaining } }` — account + EMP-#### + checklist + history + audit row created atomically |
| 4.85 | hrm | hire from a **vacancy-backed** application | `vacancyHeadcountRemaining` decrements; vacancy closes at 0 |
| 4.86 | hrm | same application twice | 400 already hired |
| 4.87 | hrm | `"email"` of an existing user | 400 duplicate email |
| 4.88 | hrm | `"role": "No Such Role"` | 400 unknown system role (create it via 14.5 first, then 4.84 with a real name → 201) |
| 4.89 | hrm | blocked candidate (4.50) | 400 blocked |
| 4.90 | hr | gym2 vacancy's application | 401 (`recruitment.hire.approve` scoped) |
| 4.91 | emp | — | 401 |

---

## Follow-ups & Waiting List tab

### GET /api/recruitment/follow-ups

| # | Actor | Input |Expected |
|---|---|---|---|
| 4.92 | hrm | `?page=1` | 200 candidate cards with **no stage movement > 5 days** in non-terminal stages, oldest first |
| 4.93 | hrm | — | A candidate just moved (4.76) disappears from the list |
| 4.94 | emp | — | 401 |

### GET /api/recruitment/waiting-list · POST {id}/assign · DELETE {id}

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.95 | hrm | `GET ?page=1` | 200 items `{ id, candidateId, name, position, skills, note, since, source, matchingVacancies: [{ id, position, gym, headcount, urgency, candidates }] }` |
| 4.96 | hrm | `POST /api/recruitment/waiting-list/{id}/assign` `{"vacancyId": <open vacancy>}` | 201 `{ data: { employeeId, name, position, level, gym, startDate, waitingListRemoved: true, newComerId } }` — entry leaves the list |
| 4.97 | hrm | assign with `{ "position": "Trainer", "gym": 1, "email": "wl.hire@revive.hr" }` (no vacancy) | 201 same hire transition |
| 4.98 | hrm | assign an id not on the waiting list | 400 |
| 4.99 | hrm | duplicate email | 400 |
| 4.100 | hrm | `DELETE /api/recruitment/waiting-list/{id}` | 204 (soft removal); repeat → 400 (not waiting) |
| 4.101 | emp | assign/delete | 401 |

---

## Interviews tab

### GET /api/interviews — calendar/list

Query: `?month=yyyy-MM | date=yyyy-MM-dd&status=all|pending|completed|cancelled&candidateId=&page=&pageSize=50&sortBy=scheduledDate&sortOrder=`

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.102 | hrm | `?month=2026-10` | 200 chronological items `{ id, candidateId, candidate, position, gym, date, time, scheduledDate, type, interviewer, status, room, verdict, evaluation }` |
| 4.103 | hrm | `?status=pending` | 200 scheduled only |
| 4.104 | hrm | `?date=2026-10-21` | 200 that day |
| 4.105 | hr | gym2 interviews | hidden by scope (empty) |
| 4.106 | emp | — | 401 |

### GET /api/interviews/{id} · POST /api/interviews

```json
{ "candidateId": 5, "date": "2026-10-25", "time": "11:30", "type": "On-site", "interviewer": "hrmanager@revive.hr", "room": "Room 2" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.107 | hrm | GET happy id | 200 `{ data: <interview>` |
| 4.108 | hrm | POST happy body | 201 `{ data }` status `Scheduled`; round auto = First (or Second when a first exists) |
| 4.109 | hrm | `{"candidateId": 999999}` | 400 unknown candidate |
| 4.110 | hrm | omit `date`/`time` | 201 defaults (today / 10:00) |
| 4.111 | hrm | `"type": "Telepathy"` | 400 (On-site/Video/Trial/Panel) |
| 4.112 | hr | candidate in gym2 | 401 |
| 4.113 | emp | — | 401 |

### PUT /api/interviews/{id}/complete · POST /api/interviews/{id}/reminder

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.114 | hrm | PUT complete | 200 `{ data }` status `Completed`, `completedAt` stamped once, follow-up clock refreshed |
| 4.115 | hrm | PUT complete again | 200 idempotent (completedAt not restamped) |
| 4.116 | hrm | POST reminder | 200 `{ message: "Reminder sent." }` — interviewer receives a RecruitmentFollowUp notification (check 12) |
| 4.117 | hrm | reminder on unknown id | 404 |
| 4.118 | emp | — | 401 |

---

## New Comers tab

### GET /api/employees/new-comers · PUT /api/employees/{id}/onboarding-checklist

```json
{ "item": "Uniform issued", "done": true }
```
batch form: `{ "checklist": [["ID & contract signed", true], ["System access created", true]] }`

| # | Actor | Input | Expected |
|---|---|---|---|
| 4.119 | hrm | GET | 200 items `{ id, name, initials, position, startDate, progress, checklist: [[label,done]…] }` — hired ≤ 30 days or incomplete checklist; five seeded items |
| 4.120 | hrm | PUT single toggle | 200 `{ data: { id, progress, checklist } }` — progress recalculated |
| 4.121 | hrm | PUT batch form | 200 — unknown labels appended, known ones updated |
| 4.122 | hrm | `{"item":"Polish the floor"}` | 400 unknown label |
| 4.123 | hrm | hire an employee (4.84) then GET | new-comer appears with `progress: 0` |
| 4.124 | hr | gym2 new-comer PUT | 401 (`recruitment.hire.approve` scoped) |
| 4.125 | emp | — | 401 |
