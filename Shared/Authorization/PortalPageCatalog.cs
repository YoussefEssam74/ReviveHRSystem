namespace Shared.Authorization;

/// <summary>One portal page and the permission keys that page is built from.</summary>
public sealed record PortalPageDefinition(string Portal, string Page, string Label, string[] Permissions);

/// <summary>
/// The permission matrix grouped the way the product is actually navigated: by
/// portal page rather than by storage area. A key may serve more than one page
/// (payroll.view backs both Deductions and Bonus), which is why this is a mapping
/// and not a rename of <em>Permission.Area</em>.
///
/// Enforcement never reads this catalog — it only drives the assignment UI, so an
/// unmapped key stays grantable through the flat item list.
/// </summary>
public static class PortalPageCatalog
{
    public const string EmployeePortal = "Employee portal";
    public const string HrPortal = "HR portal";
    public const string PlatformPortal = "Super Admin portal";

    public static readonly IReadOnlyList<PortalPageDefinition> Pages =
    [
        // ---------------- employee side: Employee / Branch Manager / Team Leader ----------------
        new(EmployeePortal, "my-requests", "My requests", ["requests.view"]),
        new(EmployeePortal, "my-attendance", "My attendance", ["attendance.view"]),
        new(EmployeePortal, "my-payroll", "My payroll", ["payroll.view"]),
        new(EmployeePortal, "my-evaluations", "My evaluations", ["evaluations.view"]),
        new(EmployeePortal, "my-documents", "My documents", ["employees.documents.view"]),

        new(EmployeePortal, "branch-employees", "Employees", ["employees.view"]),
        new(EmployeePortal, "branch-schedules", "Schedules", ["schedule.view", "schedule.manage", "schedule.view.team"]),
        new(EmployeePortal, "branch-attendance", "Attendance", ["attendance.view", "attendance.edit", "attendance.manual_entry", "attendance.view.team"]),
        new(EmployeePortal, "branch-deductions", "Deductions", ["payroll.view", "payroll.edit"]),
        new(EmployeePortal, "branch-bonus", "Bonus", ["payroll.view", "payroll.edit"]),
        new(EmployeePortal, "branch-vacancies", "Vacancy requests", ["recruitment.view", "recruitment.vacancy_request.create"]),
        new(EmployeePortal, "branch-request-management", "Request management", ["requests.view", "requests.approve.branch", "requests.view.team", "requests.approve.team"]),
        new(EmployeePortal, "branch-team", "Team", ["team.view", "team.manage"]),
        new(EmployeePortal, "branch-performance", "Team performance", ["evaluations.view", "evaluations.manage", "evaluations.view.team", "evaluations.manage.team"]),
        new(EmployeePortal, "branch-leaving", "Leaving", ["employees.offboard"]),

        // ---------------- HR side: HR Manager / HR / HR Recruiter ----------------
        new(HrPortal, "employees", "Employees", [
            "employees.view", "employees.create", "employees.edit", "employees.transfer",
            "employees.position.change", "employees.role.assign", "employees.status.change",
            "employees.compensation.manage", "employees.contract.manage", "employees.bulk_import",
            "employees.leave_balance.manage",
        ]),
        new(HrPortal, "documents", "Documents", ["employees.documents.view", "employees.documents.manage"]),
        new(HrPortal, "attendance", "Attendance", ["attendance.view", "attendance.edit", "attendance.manual_entry"]),
        new(HrPortal, "schedule", "Scheduling", ["schedule.view", "schedule.manage"]),
        new(HrPortal, "requests", "Requests", ["requests.view", "requests.approve", "requests.approve.branch"]),
        new(HrPortal, "payroll", "Payroll", ["payroll.view", "payroll.edit", "payroll.approve", "payroll.export"]),
        new(HrPortal, "evaluations", "Evaluations", ["evaluations.view", "evaluations.manage", "evaluations.forms.manage"]),
        new(HrPortal, "recruitment", "Recruitment", [
            "recruitment.view", "recruitment.vacancies.manage", "recruitment.candidates.manage",
            "recruitment.hire.approve", "recruitment.vacancy_request.create", "recruitment.vacancy_request.approve",
        ]),
        new(HrPortal, "terminations", "Terminations", ["employees.offboard"]),
        new(HrPortal, "reports", "Reports", ["reports.view"]),
        new(HrPortal, "announcements", "Announcements", ["announcements.view", "announcements.manage"]),
        new(HrPortal, "events", "Events", ["events.view"]),
        new(HrPortal, "positions", "Positions", ["positions.view", "positions.manage"]),
        new(HrPortal, "audit", "Audit log", ["audit.view"]),
        new(HrPortal, "hr-team", "HR team & roles", ["team.view", "team.manage"]),

        // ---------------- platform side: Super Admin ----------------
        new(PlatformPortal, "dashboard", "Dashboard", ["platform.companies.view", "platform.revenue.view"]),
        new(PlatformPortal, "companies", "Gym accounts", [
            "platform.companies.view", "platform.companies.create", "platform.companies.edit",
            "platform.companies.status", "platform.branches.manage",
        ]),
        new(PlatformPortal, "users", "Users", [
            "platform.users.view", "platform.users.manage", "platform.users.reset_password",
        ]),
        new(PlatformPortal, "hr-managers", "HR managers", ["platform.hr_manager.manage", "gym.hr_staff.assign"]),
        new(PlatformPortal, "billing", "Billing & quotas", [
            "platform.billing.view", "platform.billing.manage", "platform.plans.view", "platform.plans.manage",
        ]),
        new(PlatformPortal, "revenue", "Revenue analytics", ["platform.revenue.view"]),
        new(PlatformPortal, "roles", "Roles & permissions", ["team.view", "team.manage"]),
        new(PlatformPortal, "settings", "Settings", ["platform.settings.manage", "platform.feature_flags.manage"]),
        new(PlatformPortal, "audit", "Audit", [
            "platform.audit.view", "platform.audit.review", "platform.audit.export",
        ]),
        new(PlatformPortal, "impersonation", "Enter workspace", ["platform.impersonate"]),
    ];
}
