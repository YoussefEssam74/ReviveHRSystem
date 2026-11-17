namespace Shared.DataTransferObject.Reporting
{
    // ------------------------------------------------------------------
    // Positions catalog, audit log & report export (api-spec-from-ui.md §5.9)
    // ------------------------------------------------------------------

    /// <summary>GET /api/positions query (org-wide catalog).</summary>
    public class PositionCatalogQuery
    {
        /// <summary>Gym id filter (blank = every gym the actor can see).</summary>
        public int? Gym { get; set; }
        public string? SearchTerm { get; set; }
        /// <summary>true = only active rows.</summary>
        public bool? Active { get; set; }
    }

    /// <summary>
    /// One catalog row: `{ id, title, levels[], department, gym, headcount, active }`
    /// with the derived `open` (= headcount − filled) and `fill` (percent filled).
    /// </summary>
    public class PositionCatalogItem
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        /// <summary>Position level chips (stored per row; a catalog row carries one level).</summary>
        public List<string> Levels { get; set; } = [];
        public string? Department { get; set; }
        public string Gym { get; set; } = string.Empty;
        public int Headcount { get; set; }
        /// <summary>Employees currently holding this position (the UI's "active" number).</summary>
        public int Active { get; set; }
        /// <summary>max(headcount − active, 0).</summary>
        public int Open { get; set; }
        /// <summary>Percent of headcount filled (0–100).</summary>
        public int Fill { get; set; }
    }

    public class PositionCatalogResponse
    {
        public List<PositionCatalogItem> Items { get; set; } = [];
        public int Total { get; set; }
    }

    /// <summary>POST /api/positions &amp; PUT /api/positions/{id} body.</summary>
    public class UpsertPositionRequest
    {
        public string? Title { get; set; }
        /// <summary>Level chips ("Junior" | "Mid" | "Senior" | …).</summary>
        public List<string>? Levels { get; set; }
        public string? Department { get; set; }
        /// <summary>Gym name (or send <c>gymId</c>).</summary>
        public string? Gym { get; set; }
        public int? GymId { get; set; }
        public int? Headcount { get; set; }
        public bool? Active { get; set; }
    }

    public class PositionDataResponse
    {
        public PositionCatalogItem Data { get; set; } = null!;
    }

    // ------------------------------------------------------------------
    // GET /api/audit-log
    // ------------------------------------------------------------------

    /// <summary>GET /api/audit-log query.</summary>
    public class AuditLogListQuery
    {
        /// <summary>All Actions | Employee | Payroll | Recruitment | Bulk Import (blank = all).</summary>
        public string? Action { get; set; }
        /// <summary>Gym id filter (blank = all in scope).</summary>
        public int? Gym { get; set; }
        /// <summary>User id filter (blank = all).</summary>
        public int? User { get; set; }
        public DateTime? From { get; set; }
        public DateTime? To { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    /// <summary>One audit row: `{ id, action, user, target, detail, timestamp, gym }`.</summary>
    public class AuditLogItem
    {
        public int Id { get; set; }
        /// <summary>"Employee Updated" style label (Action + entity label).</summary>
        public string Action { get; set; } = string.Empty;
        /// <summary>Actor display name ("By: {user}").</summary>
        public string User { get; set; } = string.Empty;
        /// <summary>Entity label ("Candidate #12").</summary>
        public string Target { get; set; } = string.Empty;
        /// <summary>Short change summary from the new-values snapshot.</summary>
        public string Detail { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
        /// <summary>Gym name or "All Gyms".</summary>
        public string Gym { get; set; } = string.Empty;
    }

    public class AuditLogListResponse
    {
        public List<AuditLogItem> Items { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
        public int TotalPages { get; set; }
    }

    // ------------------------------------------------------------------
    // GET /api/reports/export
    // ------------------------------------------------------------------

    /// <summary>GET /api/reports/export query — `period` (30d | 90d | ytd) + `format=csv`.</summary>
    public class ReportExportQuery
    {
        /// <summary>30d | 90d | ytd (default 30d).</summary>
        public string? Period { get; set; }
        /// <summary>csv (default).</summary>
        public string? Format { get; set; }
    }
}
