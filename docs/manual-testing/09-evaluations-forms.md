# 09 — Evaluations & Form Builder (forms, dispatch, run view, inbox)

**Screens:** `evaluations` (evaluation cards, run view, MY EVALUATIONS inbox, cycles,
goals) and `form-builder` (evaluation templates + hiring forms — two separate resources,
no `kind=` union). All ids are plain integers (no `ef-`/`hf-` prefixes).
**Guards:** reads `evaluations.view` · form CRUD `evaluations.forms.manage` ·
dispatch/launch/free-run/goals `evaluations.manage` — gym-scoped (forms with no gym = "All",
visible under every scope). Inbox additionally opens to any holder of an evaluator key.
Actors: `hrm`, `hr`, `emp` (negatives).

Question vocabulary: `text` (Rating5, no options) · `choose` (MultipleChoice, ≥ 2 options) ·
`checkbox` (Checkbox, ≥ 2 options). Form status: `Active | Completed | Inactive`
(hiring forms: `Open | Closed`).

Happy-path order: 9.1 → 9.5 → 9.16 → 9.20 → 9.23 → 9.27.

---

## Evaluation forms (form builder tab)

### GET /api/evaluation-forms

Query: `?gym=&status=Active|Completed|Inactive&position=<target title>&page=1&pageSize=20`

| # | Actor | Input | Expected |
|---|---|---|---|
| 9.1 | hrm | `?page=1` | 200 `{ items, page, pageSize, total, totalPages }`; item `{ id, name, position, target?, gym, status, questions, questionList: [{ type, text, options[] }], createdDate, lastUsed?, submissions }`, newest first |
| 9.2 | hrm | `?status=Active` | 200 active forms only |
| 9.3 | hrm | `?gym=1` / `?position=trainer` | 200 scoped / case-insensitive target match |
| 9.4 | emp | `?page=1` | 401 (`evaluations.view`) · `anon` → 401 · `bad` → 401 |

---

### POST /api/evaluation-forms — create

```json
{
  "name": "Trainer QA — Q4 2026",
  "position": "Fitness Trainer",
  "gym": 1,
  "status": "Active",
  "questionList": [
    { "type": "text", "text": "How would you rate session quality?" },
    { "type": "choose", "text": "Punctuality?", "options": ["Always", "Usually", "Rarely"] },
    { "type": "checkbox", "text": "Strengths", "options": ["Coaching", "Sales", "Teamwork"] }
  ]
}
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 9.5 | hrm | happy body | **201** `{ data: <form card> }` with `questionList` echoed, `status: "Active"`, `questions: 3` |
| 9.6 | hrm | `"gym": "All"` | 201 — global form (`gym` null) visible under every scope |
| 9.7 | hrm | missing `name` | 400 |
| 9.8 | hrm | `questionList: []` | 400 (≥ 1 question) |
| 9.9 | hrm | question with `"text": ""` | 400 |
| 9.10 | hrm | `"type": "essay"` | 400 "Unknown question type — use text, choose, or checkbox." |
| 9.11 | hrm | `choose` with 1 option | 400 (≥ 2 options) |
| 9.12 | hrm | `"gym": 999` | 400 unknown gym |
| 9.13 | hrm | `"status": "Draft"` | 400 (unknown status) |
| 9.14 | hr | — | 201 (forms.manage in scope) |
| 9.15 | emp | — | 401 |

---

### GET /api/evaluation-forms/{id} · PUT /api/evaluation-forms/{id}

PUT body = create body (replaces the **whole** question list — old rows deleted).

| # | Actor | Input | Expected |
|---|---|---|---|
| 9.16 | hrm | GET happy id | 200 `{ data: <form with questionList> }` |
| 9.17 | hrm | PUT with a 2-question list | 200 `{ data }` — `questions: 2`; removed question gone (verify via GET) |
| 9.18 | hrm | PUT same name (own) | 200 (own name allowed); another form's name → 400 |
| 9.19 | hrm | GET unknown id | 404 · `hr` on out-of-scope gym form → 401 · `emp` → 401 |

---

### DELETE /api/evaluation-forms/{id}

| # | Actor | Input | Expected |
|---|---|---|---|
| 9.20 | hrm | form with **no** responses | 204 — form + questions + assignments gone |
| 9.21 | hrm | form that has responses (after 9.27) | **400** "set its status to Inactive instead" |
| 9.22 | hrm | set `status: "Inactive"` via PUT instead | 200 — the sanctioned path · `hr` out-of-scope → 401 · `emp` → 401 · unknown → 404 |

---

### POST /api/evaluation-forms/{id}/dispatch — route to evaluators

Empty body.

| # | Actor | Input | Expected |
|---|---|---|---|
| 9.23 | hrm | dispatch an **Active** form (gym1, target = a seeded position) | 200 `{ data: { formId, createdAssignments: [{ id, formId, formName, evaluatorEmail, evaluatorName, subjects[], completedSubjects[], status, dispatchedDate, dispatchedBy }], routedEvaluators, evaluationsAssigned } }` — evaluators = active users holding `evaluations.manage|manage.team|view.team|team.manage` (or TopManagement) |
| 9.24 | hrm | dispatch the same form again | 200 with `createdAssignments: []`, counters 0 (idempotent skip) |
| 9.25 | hrm | dispatch an `Inactive` form | 400 (only Active dispatches) |
| 9.26 | hr | form of gym2 | 404/401 · `emp` → 401 |

---

### GET /api/evaluation-assignments — MY EVALUATIONS inbox

Query: `?formId=&status=Assigned|Completed&page=1&pageSize=20`

| # | Actor | Input | Expected |
|---|---|---|---|
| 9.27 | hrm | `?page=1` | 200 one card per form (grouped, newest dispatch first): `{ id, formId, formName, evaluatorEmail, evaluatorName, subjects[], completedSubjects[], status, dispatchedDate, dispatchedBy }` |
| 9.28 | hrm | after completing a subject (9.29) | that name moves to `completedSubjects`; card `status: "Completed"` only when **all** rows complete |
| 9.29 | hr | — | 200 his own inbox only (`evaluatorEmail` = caller) |
| 9.30 | emp | — | 401 (no evaluator key) · `anon` → 401 |

---

### POST /api/evaluation-forms/{id}/responses — run view / free-run submit

```json
{
  "employee": "Karim Hassan",
  "period": "Q4 2026",
  "score": 78,
  "notes": "Strong month.",
  "assignmentId": 5,
  "answers": [
    { "question": "How would you rate session quality?", "type": "text", "answer": "4" },
    { "question": "Punctuality?", "type": "choose", "answer": "Always" }
  ]
}
```
Answers match the form's questions **by text** (unknown texts skipped); `score` 0–100.

| # | Actor | Input | Expected |
|---|---|---|---|
| 9.31 | hrm | happy body with `assignmentId` | **201** `{ data: { id, employee, form, formId, period, score, status: "Completed", notes, reviewedBy, reviewedDate, answers[], gym }, assignment: { id, completedSubjects[], status } }` |
| 9.32 | hrm | free-run (no `assignmentId`) | 201 — `assignment: null`; `notes` defaults to "Evaluation completed with standard scoring." when omitted |
| 9.33 | hrm | `"score": 150` | 400 (0–100) |
| 9.34 | hrm | `"employee": "Ghost"` | 400 unknown/inactive employee |
| 9.35 | hrm | subject outside actor's gym scope | 401 |
| 9.36 | hrm | wrong `formId` in body vs route | 400 (answers must belong to the route's form) |
| 9.37 | hr | employee in gym2 | 401/404 |
| 9.38 | emp | — | 401 unless he holds an assignment row for this form (assignment-holder path is the keyless exception — if `emp` was routed an assignment in 9.23, expect 201; record actual) |

---

### POST /api/evaluation-forms/{id}/launch-cycle

```json
{ "period": "Q4 2026" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 9.39 | hrm | happy body on an Active form | **201** `{ data: { batchId, startedCount, status: "In Progress" } }` — one `In Progress` response per eligible subject; `PerformanceCycle` chip "Q4 2026" found-or-created |
| 9.40 | hrm | same period again | 201 with `startedCount: 0` for already In Progress/Completed subjects (idempotent) |
| 9.41 | hrm | missing `period` | 400 |
| 9.42 | hrm | non-Active form | 400 |
| 9.43 | emp | — | 401 (`evaluations.manage`) |

---

## Responses & cycles

### GET /api/evaluation-responses · GET /api/evaluation-forms/{id}/responses

Query: `?gym=&employeeId=&formId=&period=&status=Completed|In Progress&page=1&pageSize=20`

| # | Actor | Input | Expected |
|---|---|---|---|
| 9.44 | hrm | `?page=1` | 200 items `{ id, employee, form, formId, period?, score?, status, notes?, reviewedBy, reviewedDate, answers: [{ question, type, answer }], gym }`, newest submission first |
| 9.45 | hrm | `?status=In Progress` | 200 the launch-cycle rows (no score) |
| 9.46 | hrm | `GET /api/evaluation-forms/{id}/responses` | 200 same shape with `formId` forced to the route id |
| 9.47 | hrm | unknown form id (route) | 404 |
| 9.48 | hr | `?gym=2` | 401 · `emp` → 401 · `anon` → 401 |

### GET /api/performance-cycles · GET /api/goals · POST /api/goals

```json
{ "title": "Raise NPS to 9.0", "employee": "Karim Hassan", "due": "2026-12-31", "owner": "HR Manager" }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 9.49 | hrm | `GET /api/performance-cycles` | 200 `{ items: [{ id, name, start, end, status }] }` — contains the cycle from 9.39 |
| 9.50 | hrm | `GET /api/goals?page=1` | 200 `{ items: [{ id, employee, title, status: "On Track", progress, due?, owner }] }` |
| 9.51 | hrm | POST happy body | **201** `{ data }` with `status: "On Track"`, `progress: 0`; unique `employee` name resolved to `employeeId` |
| 9.52 | hrm | missing `title` | 400 |
| 9.53 | hrm | `"due": "31-12-2026"` | 400 (yyyy-MM-dd) |
| 9.54 | emp | POST | 401 (`evaluations.manage`) · GET goals → 401 (`evaluations.view`) |

---

## Hiring forms (form builder — second resource)

### GET /api/hiring-forms · GET /api/hiring-forms/{id} — dual mode

Query: `?gym=<id or name>&status=Open|Closed&position=&page=&pageSize=`

| # | Actor | Input | Expected |
|---|---|---|---|
| 9.55 | hrm | `?page=1` | 200 items `{ id, name, position, gym, status, questions, questionList[], createdDate, lastUsed?, applicants }` |
| 9.56 | hrm | `?status=Closed` | 200 closed forms (admin mode sees both) |
| 9.57 | anon | `GET /api/hiring-forms?status=Closed` | **200 but forced to Open only** — `status=Closed` cannot opt in anonymously |
| 9.58 | anon | `GET /api/hiring-forms/{closedId}` | 404 (anonymous visitors only see Open) |
| 9.59 | anon | `GET /api/hiring-forms/{openId}` | 200 `{ data: <form> }` |
| 9.60 | anon | `?gym=NoSuchGym` | 200 empty list (unknown gym → empty, no error) |
| 9.61 | emp | `GET /api/hiring-forms` | 401 (no `evaluations.view`) |

### POST /api/hiring-forms · PUT /api/hiring-forms/{id} · DELETE /api/hiring-forms/{id}

```json
{
  "name": "Front Desk Application",
  "position": "Front Desk",
  "gym": 1,
  "status": "Open",
  "questionList": [ { "type": "text", "text": "Why do you want to join?" } ]
}
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 9.62 | hrm | POST happy body | **201** `{ data }` — form is publicly listable (9.57) and receives applications (§04 case 4.69) |
| 9.63 | hrm | PUT change `status: "Closed"` | 200 — public list drops it; pending links 404 |
| 9.64 | hrm | DELETE with **no** applications | 204 |
| 9.65 | hrm | DELETE with applications (recreate + submit first) | **400** "close it instead of deleting it" |
| 9.66 | hrm | POST missing `name` / empty `questionList` | 400 |
| 9.67 | hr | out-of-scope gym | 401 · `emp` POST → 401 · PUT/DELETE unknown → 404 |

---

## Employee-file evaluations (authoring surface)

`POST /api/employees/{employeeId}/evaluations` · `PUT /api/employees/{employeeId}/evaluations/{evaluationId}`
— feature `evaluations` **Edit**; runs against the employee file.

```json
{ "evaluationFormId": 1, "answers": [ { "questionId": 11, "score": 4, "comment": "Great spotting." } ], "overallComment": "Solid quarter." }
```

| # | Actor | Input | Expected |
|---|---|---|---|
| 9.68 | hrm | POST happy body | **201** created evaluation — `score` = mean of numeric answers (0–5 each) |
| 9.69 | hrm | `answers: []` | 400 (empty answer set) |
| 9.70 | hrm | `score: 9` (out of 0–5) | 400 |
| 9.71 | hrm | questionId belonging to another form | 400 |
| 9.72 | hrm | PUT with corrected answers | 200 re-scored; path `employeeId` must be the evaluation's own employee |
| 9.73 | hrm | PUT mismatched employeeId | 404 |
| 9.74 | hr | employee in gym2 | 401/404 · `emp` → 401 |
