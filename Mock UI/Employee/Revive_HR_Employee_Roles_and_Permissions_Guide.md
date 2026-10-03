## Revive HR System

## Employee-Level Roles, Permissions & Pages

A functional reference for the three Employee-level roles: Regular Employee, Team Leader, and Branch Manager.

Authorization model: User Type Role Permissions Access Scope Visible UI + Available Actions.

This document follows the current Employee Interface Specification. Permissions are user-level and can be granted according to the system's authorization model. Role names do not automatically mean every optional management capability is available.

## 1. Role Overview

| Role | User Type | Primary Scope | Main Purpose |
| --- | --- | --- | --- |
| Regular Employee | Employee | Own data | Self-service HR operations |
| Team Leader | Employee | Own data + assigned team | Team follow-up and team operations |
| Branch Manager | Employee | Own data + assigned gym | Branch-level management and operations |

## 2. Common Employee Pages

All three Employee roles use one Employee Portal. These pages form the common self-service layer; management pages are added dynamically according to role and granted permissions.

## Dashboard

The employee's starting page. It is role-based and action-oriented. It surfaces today's attendance and schedule, pending requests, notifications, required actions, payroll/evaluation information, and role-specific summaries.

## My Profile

Shows personal, contact, emergency-contact, employment, role and gym information. HR-controlled fields are read-only; only explicitly permitted fields can be edited.

## My Documents

Lists employee documents with category, upload date, expiry date, status and available actions such as view, preview, download or upload when permitted. Document categories are configurable.

## Employment History

Read-only timeline of employment events such as joining, gym transfers, position changes, level/role changes, status changes, compensation changes and contract changes.

## My Attendance

Shows attendance summaries and date/month records including shift, check-in, check-out and status. Attendance detail can show scheduled versus actual times, source and exceptions. Corrections, if supported, must follow a request workflow rather than direct editing.

## My Schedule

Shows the published schedule in the active gym context. Supports current, previous and next schedule cycles and mobile-friendly daily/calendar views. Shift names, times and cycle length are configurable.

## My Payroll


Shows payroll periods and permitted payroll details such as base salary, bonuses, deductions, attendance deductions, net salary and other configured line items. Payslips may be viewed/downloaded when allowed.

## My Evaluations

Shows the latest evaluation and historical evaluations, including period, configurable criteria, scores, overall result, comments, status and date. Primarily read-only.

## My Requests

Self-service request center. Employees can create, track and review requests. Request types and form fields are configurable; the exact final nine request types are not fixed by this document.

## Notifications

Shows system, required-action, request, attendance and management notifications, with read/unread state. Notifications can deep-link to the relevant page.

## Settings

Contains account/personal settings, password and notification preferences. Additional settings appear only when explicitly authorized.


## 3. Regular Employee

Role definition: User Type = Employee, Role = Regular Employee. The regular employee is focused on self-service and has no management authority over other employees unless an explicit permission is later granted.

## Core permissions/capabilities

- View and use own employee profile within permitted fields.

- View own documents and permitted document actions.

- View own employment history.

- View own attendance and schedule.

- View permitted payroll information and payslips.

- View own evaluations.

- Create and follow up on permitted employee requests.

- Receive and manage notifications.

- Use account and personal settings.

- No default access to another employee's HR data, attendance, requests, payroll or profile.

## Pages

- Dashboard

- My Profile

- My Documents

- Employment History

- My Attendance

- My Schedule

- My Payroll

- My Evaluations

- My Requests

- Notifications

- Settings


## 4. Team Leader

Role definition: User Type = Employee, Role = Team Leader. The Team Leader keeps the complete Regular Employee self-service experience and can receive additional team-level functionality. Team access is limited to the assigned team unless broader access is explicitly granted.

## What is different from Regular Employee?

- Can have access to team information and team operational follow-up.

- Can view team attendance when the corresponding permission is granted.

- Can view team schedules when the corresponding permission is granted.

- Can review/follow team requests when the corresponding permission is granted.

- Can access team performance/evaluation information when the corresponding permission is granted.

- Can perform other team-related updates only when explicitly permitted.

- Does not automatically receive Branch Manager branch-wide management capabilities.

## Team Leader Pages

## My Team

Lists the Team Leader's assigned team members. It is the main entry point for team-level actions and should not expose employees outside the authorized team.

## Team Attendance

Shows attendance information for assigned team members, such as present, absent, late and missing checkout, when the user has the relevant permission.

## Team Schedule

Shows the schedules of assigned team members and relevant shift/cycle information when permitted.

## Team Requests

Shows team-member requests that the Team Leader is authorized to review or follow up. Available actions such as comment, approve or reject depend on the granted permission and workflow.

## Team Performance

Shows permitted team performance/evaluation information and follow-up data.

## Team Updates

Supports permitted team-related updates or follow-up actions. The exact fields/actions remain permission-driven.

Important: Team Leader access is team-scoped. A Team Leader should not be treated as a Branch Manager and should not automatically see all employees in the gym.


## 5. Branch Manager

Role definition: User Type = Employee, Role = Branch Manager. The Branch Manager retains all normal Employee self-service pages and receives additional branch-management modules according to explicitly granted permissions. Scope is the assigned gym.

## Extra capabilities compared with Regular Employee

- Manage or view employees in the assigned gym when permitted.

- Manage/follow branch attendance operations when permitted.

- Review, approve, reject or comment on employee requests when permitted.

- Manage shifts or employee shift assignments when permitted.

- Request/follow recruitment activity when permitted.

- Initiate or follow employee-leaving workflows when permitted.

- Access payroll/deduction management only when explicitly permitted.

- Perform branch-level follow-up and action-required workflows based on permissions.

## Branch Manager Pages

## Employees

Branch employee directory and employee management. Depending on permissions, actions can include create employee, edit employee, view employee, assign position, assign shift and change/manage employee status.

## Attendance Management

Branch attendance operations. Shows team/branch attendance, late check-ins, missing check-outs and other follow-up items. Actions are permission-driven.

## Requests Management

Central branch request workflow. Lists employee requests, filters by status/type/date, opens request details and supports permitted review actions such as approve, reject or comment.

## Shift Management

Manages the branch's dynamic employee shifts/schedules when authorized. Supports the configured scheduling model without hard-coding shift names, times or cycle lengths.

## Recruitment

Branch recruitment functionality when permitted, including requesting a vacancy and following recruitment activity. The broader recruitment workflow is controlled by permissions and system configuration.

## Employee Leaving

Initiates or follows resignation/termination-related employee leaving workflows when permitted. The page should expose only the steps/actions authorized for the Branch Manager.

## 6. Branch Manager vs Team Leader

| Area | Team Leader | Branch Manager |
| --- | --- | --- |
| Self-service | Yes | Yes |
| Scope | Assigned team | Assigned gym |
| All branch employees | No by default | Yes, if permitted |
| Team attendance | If permitted | If permitted |


| Area | Team Leader | Branch Manager |
| --- | --- | --- |
| Team schedule | If permitted | If permitted |
| Requests | Team follow-up if permitted | Branch request management if permitted |
| Employee management | Not a default capability | Possible if permitted |
| Shift management | Not a default capability | Possible if permitted |
| Recruitment | Not a default capability | Possible if permitted |
| Employee leaving | Not a default capability | Possible if permitted |
| Payroll/deductions | Not a default capability | Only if explicitly permitted |


## 7. Permission & UI Rules

## Permission-driven UI

A page or action must only appear when the logged-in user has the relevant permission. Do not rely on role name alone for sensitive actions.

## Access scope

Regular Employee = own data. Team Leader = own data + assigned team. Branch Manager = own data + authorized assigned gym data.

## Gym context

An employee may be assigned to one or two gyms. If two gyms are assigned, gym selection occurs after login. The selected gym becomes the active context and controls the data shown.

## Published schedule principle

Employees should see published schedules only. Schedule management belongs to authorized management users.

## Read-only HR data

HR-controlled employment, compensation and status fields should not be directly editable by ordinary employees.

## Workflow actions

Attendance corrections, requests and other controlled changes should use workflow rather than direct record editing.

## History preservation

Employment and workflow history should be preserved rather than overwritten.

## Configurable structures

Request types, document categories, evaluation criteria, payroll line items, shift names and scheduling cycles must remain configurable.

## No cross-gym leakage

When an employee is operating in one gym context, data from another gym must not be shown unless the authorization model explicitly allows it.

## 8. Final Role Structure

Regular Employee: self-service only by default.

Team Leader: Regular Employee + permission-driven access to the assigned team.

Branch Manager: Regular Employee + permission-driven branch management within the assigned gym.

The three roles should be implemented as one Employee Portal with dynamic navigation and dynamic actions. The interface should expand or contract according to the user's permissions and access scope rather than creating three separate applications.
