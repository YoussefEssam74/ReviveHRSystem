namespace Shared.DataTransferObject.Reporting
{
    // ------------------------------------------------------------------
    // GET /api/reports/overview?period=30d|90d|ytd — the Reports & Analytics
    // page's metric cards and bar lists, aggregated server-side within the
    // actor's gym scope (mock §5.8/§9).
    // ------------------------------------------------------------------

    public sealed class ReportsOverviewQuery
    {
        /// <summary>30d (default) | 90d | ytd — the window for period-bound metrics.</summary>
        public string? Period { get; init; }
        /// <summary>Gym id or branch name; blank = the actor's full scope.</summary>
        public string? Gym { get; init; }
    }

    /// <summary>A named count for the bar lists (by-status, by-type, by-stage...).</summary>
    public sealed class ReportBucketDto
    {
        public required string Label { get; init; }
        public int Value { get; init; }
    }

    /// <summary>Headcount card + status breakdown + tenure distribution.</summary>
    public sealed class ReportWorkforceDto
    {
        public int TotalEmployees { get; init; }
        public int Active { get; init; }
        public int OnLeave { get; init; }
        public int NoticePeriod { get; init; }
        public int Suspended { get; init; }
        public int Terminated { get; init; }
        public int NewHiresInPeriod { get; init; }
        public required IReadOnlyList<ReportBucketDto> ByStatus { get; init; }
        /// <summary>Tenure buckets: &lt;6 mo, 6–12 mo, 1–2 yr, 2 yr+.</summary>
        public required IReadOnlyList<ReportBucketDto> ByTenure { get; init; }
        /// <summary>Average tenure, rounded months.</summary>
        public int AvgTenureMonths { get; init; }
    }

    /// <summary>Attendance card: rates + status counts in the period.</summary>
    public sealed class ReportAttendanceDto
    {
        public int RecordsInPeriod { get; init; }
        public int OnTime { get; init; }
        public int Late { get; init; }
        public int Absent { get; init; }
        public int MissingCheckout { get; init; }
        /// <summary>Worked days on-time percentage.</summary>
        public int OnTimeRate { get; init; }
    }

    /// <summary>Requests card: counts by status and by type in the period.</summary>
    public sealed class ReportRequestsDto
    {
        public int RequestsInPeriod { get; init; }
        public int Approved { get; init; }
        public int Rejected { get; init; }
        public int Pending { get; init; }
        public int ApprovalRate { get; init; }
        public required IReadOnlyList<ReportBucketDto> ByType { get; init; }
    }

    /// <summary>Recruiting card: pipeline funnel + open vacancies.</summary>
    public sealed class ReportRecruitingDto
    {
        public int ApplicationsInPipeline { get; init; }
        public int HiredInPeriod { get; init; }
        public int OpenVacancies { get; init; }
        public int OpenSlots { get; init; }
    }

    /// <summary>Payroll card: totals across the scoped entries.</summary>
    public sealed class ReportPayrollDto
    {
        public int Entries { get; init; }
        public decimal TotalNetPay { get; init; }
    }

    /// <summary>Offboarding card: separations in the period.</summary>
    public sealed class ReportOffboardingDto
    {
        public int SeparationsInPeriod { get; init; }
        public int OpenChecklists { get; init; }
    }

    /// <summary>Full reports payload: { period, workforce, attendance, requests, recruiting, payroll, offboarding }.</summary>
    public sealed class ReportsOverviewDto
    {
        /// <summary>Resolved period label ("Last 30 days").</summary>
        public required string Period { get; init; }
        public required ReportWorkforceDto Workforce { get; init; }
        public required ReportAttendanceDto Attendance { get; init; }
        public required ReportRequestsDto Requests { get; init; }
        public required ReportRecruitingDto Recruiting { get; init; }
        public required ReportPayrollDto Payroll { get; init; }
        public required ReportOffboardingDto Offboarding { get; init; }
    }
}
