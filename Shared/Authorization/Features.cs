namespace Shared.Authorization;

/// <summary>
/// Feature codes of the authorization catalog (ADR-003 Amendment 1). A feature is a
/// UI area; access is granted per gym at one of three levels (None/View/Edit).
/// These codes are the <c>Permission.Key</c> values seeded into the catalog and the
/// names the <c>[HasFeatureAccess]</c> attribute and <c>/api/me</c> payload use.
/// </summary>
public static class Features
{
    public const string Employees = "employees";
    public const string Attendance = "attendance";
    public const string Schedule = "schedule";
    public const string Requests = "requests";
    public const string Payroll = "payroll";
    public const string Evaluations = "evaluations";
    public const string Recruitment = "recruitment";
    public const string Offboarding = "offboarding";
    public const string Documents = "documents";
    public const string Reports = "reports";
    public const string Announcements = "announcements";
    public const string Audit = "audit";

    /// <summary>System wildcard key: grants every feature at Edit level (Super Admin).</summary>
    public const string Wildcard = "*";

    public static readonly IReadOnlyList<string> All = new[]
    {
        Employees, Attendance, Schedule, Requests, Payroll, Evaluations,
        Recruitment, Offboarding, Documents, Reports, Announcements, Audit
    };
}
