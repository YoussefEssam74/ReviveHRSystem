namespace Shared.DataTransferObject.Payroll
{
    // ------------------------------------------------------------------
    // Payroll page (api-spec-from-ui.md §5.5)
    // ------------------------------------------------------------------

    /// <summary>GET /api/payroll-periods query.</summary>
    public class PayrollPeriodListQuery
    {
        /// <summary>Gym id filter (blank = every gym in scope).</summary>
        public int? Gym { get; set; }
        /// <summary>Open | Partially Published | Published | Paid (blank = all).</summary>
        public string? Status { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    /// <summary>One period row: `{ id, period, status, locked, paidDate, publishedGyms[], totalEmployees, totalGross, totalDeductions, totalNet }`.</summary>
    public class PayrollPeriodItem
    {
        public int Id { get; set; }
        /// <summary>Month label ("August 2026") derived from the period start.</summary>
        public string Period { get; set; } = string.Empty;
        /// <summary>Open | Partially Published | Published | Paid.</summary>
        public string Status { get; set; } = "Open";
        public bool Locked { get; set; }
        public DateOnly? PaidDate { get; set; }
        /// <summary>Gyms already published &amp; locked (the branch itself once approved).</summary>
        public List<string> PublishedGyms { get; set; } = [];
        public int TotalEmployees { get; set; }
        public decimal TotalGross { get; set; }
        public decimal TotalDeductions { get; set; }
        public decimal TotalNet { get; set; }
    }

    public class PayrollPeriodListResponse
    {
        public List<PayrollPeriodItem> Items { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
        public int TotalPages { get; set; }
    }

    /// <summary>One deduction line: `{ id, date, label, reason, source, amount, status, attendanceRef, requestId }`.</summary>
    public class DeductionLineItem
    {
        public int Id { get; set; }
        public DateOnly Date { get; set; }
        public string Label { get; set; } = string.Empty;
        public string? Reason { get; set; }
        /// <summary>biometric | manager (legacy "Manual" rows map to manager).</summary>
        public string Source { get; set; } = "manager";
        public decimal Amount { get; set; }
        /// <summary>Pending | Accepted | Approved | Rejected.</summary>
        public string Status { get; set; } = "Pending";
        /// <summary>ATT-{recordId}, "ATT-MANUAL" for biometric ad-hoc lines, or "".</summary>
        public string AttendanceRef { get; set; } = string.Empty;
        public int? RequestId { get; set; }
    }

    /// <summary>One payroll sheet row in the overview table / settlement sheet.</summary>
    public class PayrollEntryItem
    {
        public int EmployeeId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Initials { get; set; } = string.Empty;
        public string Gym { get; set; } = string.Empty;
        public string Position { get; set; } = string.Empty;
        public string EmploymentStatus { get; set; } = string.Empty;
        public int Days { get; set; }
        public decimal Overtime { get; set; }
        public decimal BaseSalary { get; set; }
        public decimal Bonus { get; set; }
        /// <summary>base + bonus + OT pay ((base/176)×1.5×overtime).</summary>
        public decimal Gross { get; set; }
        /// <summary>Sum of Accepted|Approved lines (Pending excluded).</summary>
        public decimal Deductions { get; set; }
        /// <summary>gross − deductions.</summary>
        public decimal Net { get; set; }
        /// <summary>Draft | Reviewed | Locked.</summary>
        public string Status { get; set; } = "Draft";
        public bool Reviewed { get; set; }
        public List<int> RelatedRequestIds { get; set; } = [];
        public List<DeductionLineItem> DeductionLines { get; set; } = [];
        /// <summary>Month label — populated by the per-employee history endpoint only.</summary>
        public string? Period { get; set; }
    }

    /// <summary>GET /api/payroll-periods/{id} → `{ data: { …period, items[] } }`.</summary>
    public class PayrollPeriodDetailData : PayrollPeriodItem
    {
        public List<PayrollEntryItem> Items { get; set; } = [];
    }

    public class PayrollPeriodDetailResponse
    {
        public PayrollPeriodDetailData Data { get; set; } = null!;
    }

    /// <summary>PUT /api/payroll-periods/{periodId}/entries/{employeeId} body (the only editable field).</summary>
    public class UpdateBonusRequest
    {
        public decimal? Bonus { get; set; }
    }

    /// <summary>Bonus update → `{ data: { employeeId, bonus, gross, deductions, net } }`.</summary>
    public class EntryTotalsData
    {
        public int EmployeeId { get; set; }
        public decimal Bonus { get; set; }
        public decimal Gross { get; set; }
        public decimal Deductions { get; set; }
        public decimal Net { get; set; }
    }

    public class EntryTotalsResponse
    {
        public EntryTotalsData Data { get; set; } = null!;
    }

    /// <summary>POST …/entries/{employeeId}/deductions body (the inline Add-Line form).</summary>
    public class CreateDeductionRequest
    {
        /// <summary>manager | biometric.</summary>
        public string? Source { get; set; }
        public string? Reason { get; set; }
        public decimal? Amount { get; set; }
    }

    /// <summary>Recomputed totals every entry mutation echoes back.</summary>
    public class DeductionEntrySummary
    {
        public decimal Gross { get; set; }
        public decimal Deductions { get; set; }
        public decimal Net { get; set; }
        public int PendingCount { get; set; }
    }

    /// <summary>Created line + the recomputed entry: `{ …line, entry: { gross, deductions, net, pendingCount } }`.</summary>
    public class CreateDeductionData : DeductionLineItem
    {
        public DeductionEntrySummary Entry { get; set; } = null!;
    }

    public class CreateDeductionResponse
    {
        public CreateDeductionData Data { get; set; } = null!;
    }

    /// <summary>POST …/entries/{employeeId}/close → `{ data: { employeeId, status, reviewed, reviewedAt, gross, deductions, net } }`.</summary>
    public class CloseEntryData
    {
        public int EmployeeId { get; set; }
        public string Status { get; set; } = "Reviewed";
        public bool Reviewed { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public decimal Gross { get; set; }
        public decimal Deductions { get; set; }
        public decimal Net { get; set; }
    }

    public class CloseEntryResponse
    {
        public CloseEntryData Data { get; set; } = null!;
    }

    /// <summary>POST …/entries/{employeeId}/reopen → `{ data: { employeeId, status, reviewed } }`.</summary>
    public class ReopenEntryData
    {
        public int EmployeeId { get; set; }
        public string Status { get; set; } = "Draft";
        public bool Reviewed { get; set; }
    }

    public class ReopenEntryResponse
    {
        public ReopenEntryData Data { get; set; } = null!;
    }

    /// <summary>POST /api/payroll-periods/{id}/approve body — publish &amp; lock this branch.</summary>
    public class ApprovePeriodRequest
    {
        /// <summary>Branch name (or send <c>gymId</c>); must be the period's gym.</summary>
        public string? Gym { get; set; }
        public int? GymId { get; set; }
    }

    /// <summary>Approve → `{ data: { id, status, locked, publishedGyms[], message } }`.</summary>
    public class ApprovePeriodData
    {
        public int Id { get; set; }
        public string Status { get; set; } = "Published";
        public bool Locked { get; set; }
        public List<string> PublishedGyms { get; set; } = [];
        public string Message { get; set; } = string.Empty;
    }

    public class ApprovePeriodResponse
    {
        public ApprovePeriodData Data { get; set; } = null!;
    }

    // ------------------------------------------------------------------
    // Deduction candidates (pending lines)
    // ------------------------------------------------------------------

    /// <summary>GET /api/deduction-candidates query.</summary>
    public class DeductionCandidateListQuery
    {
        public int? Gym { get; set; }
        /// <summary>Period id or month label ("August 2026").</summary>
        public string? Period { get; set; }
        /// <summary>Line status (Pending | Accepted | Approved | Rejected; blank = all).</summary>
        public string? Status { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    /// <summary>One reviewable line: `{ id, employeeId, employeeName, gym, period, date, label, reason, source, amount, status, attendanceRef, requestId }`.</summary>
    public class DeductionCandidateItem
    {
        public int Id { get; set; }
        public int EmployeeId { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public string Gym { get; set; } = string.Empty;
        public string Period { get; set; } = string.Empty;
        public DateOnly Date { get; set; }
        public string Label { get; set; } = string.Empty;
        public string? Reason { get; set; }
        public string Source { get; set; } = "manager";
        public decimal Amount { get; set; }
        public string Status { get; set; } = "Pending";
        public string AttendanceRef { get; set; } = string.Empty;
        public int? RequestId { get; set; }
    }

    public class DeductionCandidateListResponse
    {
        public List<DeductionCandidateItem> Items { get; set; } = [];
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
        public int TotalPages { get; set; }
    }

    /// <summary>POST /api/deduction-candidates/{id}/review body (Approve / Waive).</summary>
    public class ReviewDeductionRequest
    {
        /// <summary>Accepted (Approve) | Rejected (Waive).</summary>
        public string? Decision { get; set; }
    }

    /// <summary>Recomputed totals with the acting employee, as echoed by review.</summary>
    public class ReviewEntrySummary : DeductionEntrySummary
    {
        public int EmployeeId { get; set; }
    }

    /// <summary>Review → `{ data: { id, status, amount, entry: { employeeId, gross, deductions, net, pendingCount } } }`.</summary>
    public class ReviewDeductionData
    {
        public int Id { get; set; }
        public string Status { get; set; } = "Pending";
        public decimal Amount { get; set; }
        public ReviewEntrySummary Entry { get; set; } = null!;
    }

    public class ReviewDeductionResponse
    {
        public ReviewDeductionData Data { get; set; } = null!;
    }

    // ------------------------------------------------------------------
    // Payslip + export + per-employee history
    // ------------------------------------------------------------------

    /// <summary>GET /api/payroll-periods/{id}/payslips/{employeeId} → `{ data: … }`.</summary>
    public class PayslipData
    {
        public string Period { get; set; } = string.Empty;
        public string Gym { get; set; } = string.Empty;
        public PayslipEmployeeData Employee { get; set; } = null!;
        public decimal BaseSalary { get; set; }
        /// <summary>Overtime hours.</summary>
        public decimal Overtime { get; set; }
        public decimal OvertimePay { get; set; }
        public decimal Bonus { get; set; }
        public decimal Gross { get; set; }
        /// <summary>All lines with their statuses (net only counts Accepted|Approved).</summary>
        public List<PayslipDeductionLine> Deductions { get; set; } = [];
        public decimal Net { get; set; }
        public int Days { get; set; }
        public string Status { get; set; } = "Draft";
    }

    public class PayslipEmployeeData
    {
        public int EmployeeId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Position { get; set; } = string.Empty;
    }

    public class PayslipDeductionLine
    {
        public string Label { get; set; } = string.Empty;
        public string? Reason { get; set; }
        public string Source { get; set; } = "manager";
        public decimal Amount { get; set; }
        public string Status { get; set; } = "Pending";
    }

    public class PayslipResponse
    {
        public PayslipData Data { get; set; } = null!;
    }

    /// <summary>GET /api/employees/{id}/payroll — per-period history (entry shape + `period`).</summary>
    public class EmployeePayrollResponse
    {
        public List<PayrollEntryItem> Items { get; set; } = [];
    }

    // ------------------------------------------------------------------
    // GET /api/attendance/{id} — punch audit for a referenced record
    // ------------------------------------------------------------------

    /// <summary>Biometric punch audit: `{ data: { id, date, firstIn, lastOut, device, exception, detail } }`.</summary>
    public class AttendanceRefData
    {
        /// <summary>The normalized ref ("ATT-123") the UI passed in.</summary>
        public string Id { get; set; } = string.Empty;
        public DateOnly Date { get; set; }
        public DateTime? FirstIn { get; set; }
        public DateTime? LastOut { get; set; }
        /// <summary>Terminal source (Biometric | Manual).</summary>
        public string Device { get; set; } = string.Empty;
        /// <summary>System exception (On Time | Late | Absent | …).</summary>
        public string Exception { get; set; } = string.Empty;
        public string Detail { get; set; } = string.Empty;
    }

    public class AttendanceRefResponse
    {
        public AttendanceRefData Data { get; set; } = null!;
    }
}
