namespace Shared.Authorization;

/// <summary>
/// Maps tracked permission keys onto the HR console's feature codes at the three
/// ADR-003 Amendment 1 levels: 0 = None, 1 = View, 2 = Edit. This is the single
/// source of truth behind the <c>featureLevels</c> map on GET /api/me — the SPA
/// gates console navigation and write controls on it.
///
/// Only console-scoped keys are mapped. The <c>*.view.team</c> / <c>*.manage.team</c> /
/// <c>*.approve.team</c> keys are deliberately excluded: they scope a Team Leader's
/// own-team access and must never unlock HR-console features.
/// </summary>
public static class FeatureLevelCatalog
{
    public const int None = 0;
    public const int View = 1;
    public const int Edit = 2;

    /// <summary>
    /// Feature code → the keys that grant it. A feature is reported at Edit when any
    /// edit key is held, otherwise at View when a view key is held, otherwise None.
    /// A key may legitimately appear under two features (e.g. <c>employees.offboard</c>
    /// drives both the employee record and the Terminations screen).
    /// </summary>
    private static readonly (string Feature, string[] ViewKeys, string[] EditKeys)[] Catalog =
    [
        (
            "employees",
            ["employees.view"],
            [
                "employees.create", "employees.edit", "employees.transfer",
                "employees.position.change", "employees.role.assign", "employees.status.change",
                "employees.compensation.manage", "employees.contract.manage",
                "employees.bulk_import", "employees.leave_balance.manage",
            ]
        ),
        (
            "attendance",
            ["attendance.view"],
            ["attendance.edit", "attendance.manual_entry"]
        ),
        (
            "schedule",
            ["schedule.view"],
            ["schedule.manage"]
        ),
        (
            "requests",
            ["requests.view"],
            ["requests.approve.branch", "requests.approve"]
        ),
        (
            // payroll.export is a privileged read, but the settlement sheet renders its
            // Export control behind Edit — without it an export-only user could never
            // export from the UI. The API still enforces the exact key.
            "payroll",
            ["payroll.view"],
            ["payroll.edit", "payroll.approve", "payroll.export"]
        ),
        (
            "evaluations",
            ["evaluations.view"],
            ["evaluations.manage", "evaluations.forms.manage"]
        ),
        (
            "recruitment",
            ["recruitment.view"],
            [
                "recruitment.vacancies.manage", "recruitment.candidates.manage",
                "recruitment.hire.approve", "recruitment.vacancy_request.create",
                "recruitment.vacancy_request.approve",
            ]
        ),
        (
            // There is no offboarding.view key: the Terminations screen is an HR-only
            // write surface, so holding employees.offboard is both view and manage.
            "offboarding",
            [],
            ["employees.offboard"]
        ),
        (
            "documents",
            ["employees.documents.view"],
            ["employees.documents.manage"]
        ),
        (
            // Read-only features: no write key exists, so they top out at View.
            "reports",
            ["reports.view"],
            []
        ),
        (
            "announcements",
            ["announcements.view"],
            ["announcements.manage"]
        ),
        (
            "audit",
            ["audit.view"],
            []
        ),
    ];

    /// <summary>Every feature code the catalog knows about.</summary>
    public static IReadOnlyList<string> Features => Catalog.Select(entry => entry.Feature).ToArray();

    /// <summary>
    /// Resolves the effective level of every feature from the caller's permission
    /// keys. All features are always present in the result (None when unheld) so
    /// the SPA can render a complete access matrix without null checks.
    /// </summary>
    public static Dictionary<string, int> Resolve(IEnumerable<string>? permissionKeys)
    {
        var granted = permissionKeys is null
            ? new HashSet<string>(StringComparer.Ordinal)
            : new HashSet<string>(permissionKeys, StringComparer.Ordinal);

        var levels = new Dictionary<string, int>(Catalog.Length, StringComparer.Ordinal);
        foreach (var (feature, viewKeys, editKeys) in Catalog)
        {
            levels[feature] = editKeys.Any(granted.Contains)
                ? Edit
                : viewKeys.Any(granted.Contains) ? View : None;
        }

        return levels;
    }

    /// <summary>
    /// Every feature at Edit — the effective access of Top Management, which
    /// bypasses permission checks entirely (ADR-003).
    /// </summary>
    public static Dictionary<string, int> AllAtEdit()
    {
        var levels = new Dictionary<string, int>(Catalog.Length, StringComparer.Ordinal);
        foreach (var (feature, _, _) in Catalog)
        {
            levels[feature] = Edit;
        }

        return levels;
    }
}
