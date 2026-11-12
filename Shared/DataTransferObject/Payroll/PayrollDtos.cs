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
        /// <summary>The branch this run belongs to (periods are per-gym rows).</summary>
        public int GymId { get; set; }
        /// <summary>Branch name ("Nasr City") — the sheet header and publish target.</summary>
        public string Gym { get; set; } = string.Empty;
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

    /// <summary>
    /// POST /api/payroll-periods/ensure — idempotent provisioning of the current month:
    /// creates the gym's period when missing and adds a Draft sheet for every active
    /// employee who has none. Locked/paid periods are never touched.
    /// </summary>
    public class PayrollEnsureResponse
    {
        public int PeriodId { get; set; }
        /// <summary>Month label ("November 2026").</summary>
        public string Period { get; set; } = string.Empty;
        /// <summary>True when the period row itself was created by this call.</summary>
        public bool Created { get; set; }
        /// <summary>Employee sheets added to an already-open period.</summary>
        public int EntriesAdded { get; set; }
        /// <summary>False when the period is already published/locked (nothing changed).</summary>
        public bool Open { get; set; }
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
        /// <summary>Days the line charges (absence = 3, late = 0.125 / 0.25 / 0.5); null for manual rows.</summary>
        public decimal? Days { get; set; }
        /// <summary>Pending | Accepted | Approved | Rejected.</summary>
        public string Status { get; set; } = "Pending";
        /// <summary>ATT-{recordId}, "ATT-MANUAL" for biometric ad-hoc lines, or "".</summary>
        public string AttendanceRef { get; set; } = string.Empty;
        public int? RequestId { get; set; }
    }

    /// <summary>One punch the settlement sheet's evidence column renders.</summary>
    public class PayrollPunchItem
    {
        /// <summary>"ATT-{recordId}" — feeds GET /api/attendance/{id}.</summary>
        public string AttendanceRef { get; set; } = string.Empty;
        public DateOnly Date { get; set; }
        /// <summary>Gym-local "08:41".</summary>
        public string? FirstIn { get; set; }
        public string? LastOut { get; set; }
        /// <summary>Biometric | Manual | Unknown.</summary>
        public string Device { get; set; } = string.Empty;
        /// <summary>On Time | Late | Absent | Early Checkout | Missing Checkout | Off.</summary>
        public string Exception { get; set; } = string.Empty;
        public string Detail { get; set; } = string.Empty;
        public bool OnTime { get; set; }
    }

    /// <summary>
    /// One day behind the settlement sheet's counters (the click-through log):
    /// its category, the shift it belonged to, the punches and any overtime.
    /// </summary>
    public class PayrollAttendanceDay
    {
        public DateOnly Date { get; set; }

        /// <summary>
        /// Attended | WeeklyOff | ApprovedLeave | Late | Absent | EarlyCheckout | EarlyLeave |
        /// MissingCheckout — the bucket the counter row sums up. EarlyCheckout is the
        /// Early Leaving warning; EarlyLeave is an early departure an Early Leave request covers.
        /// </summary>
        public string Kind { get; set; } = "Attended";

        /// <summary>Friendly status ("On Time", "Late", "Off", …).</summary>
        public string Status { get; set; } = string.Empty;

        /// <summary>Shift window ("08:00–16:00") when a shift was scheduled.</summary>
        public string? Shift { get; set; }

        /// <summary>Gym-local "08:41".</summary>
        public string? CheckIn { get; set; }
        public string? CheckOut { get; set; }

        /// <summary>Punch-to-punch hours (0 when the day has no complete punch).</summary>
        public decimal WorkedHours { get; set; }

        /// <summary>Hours worked past the scheduled shift end (0 when none).</summary>
        public decimal OvertimeHours { get; set; }

        /// <summary>Minutes the check-out ran before the shift end (0 when not early).</summary>
        public int EarlyLeaveMinutes { get; set; }

        /// <summary>Leave reason / manual-entry note, when there is one.</summary>
        public string? Note { get; set; }

        /// <summary>"ATT-{recordId}" when the day has a punch — feeds GET /api/attendance/{id}.</summary>
        public string? AttendanceRef { get; set; }
    }

    /// <summary>
    /// PUT /api/payroll-periods/{id}/entries/{employeeId}/attendance — HR's correction of
    /// the sheet's attendance numbers (payroll.edit). All six are required so the sheet
    /// always carries a complete, deliberate set.
    /// </summary>
    public class UpdatePayrollAttendanceRequest
    {
        public int DaysAttended { get; set; }
        public int WeeklyOffs { get; set; }
        public int ApprovedLeaves { get; set; }
        public decimal OvertimeHours { get; set; }
        public int LateArrivals { get; set; }
        public int UnexcusedAbsences { get; set; }
    }

    /// <summary>
    /// Attendance evidence for one settlement sheet (the right-hand column): the six
    /// counters the mock prints, the per-day log behind them, and the punch records
    /// behind any deduction.
    /// </summary>
    public class PayrollAttendanceItem
    {
        /// <summary>Set when HR corrected the counters by hand (the raw log stays visible).</summary>
        public DateTime? AdjustedAt { get; set; }

        public int DaysAttended { get; set; }
        public int WeeklyOffs { get; set; }
        /// <summary>Approved annual-leave days in the period (the legacy "Day Off" label included).</summary>
        public int AnnualLeaves { get; set; }
        /// <summary>Approved sick-leave days in the period.</summary>
        public int SickLeaves { get; set; }
        /// <summary>Approved leave days in the period; the manual correction may override this total.</summary>
        public int ApprovedLeaves { get; set; }
        /// <summary>Days worked on a scheduled weekly off — i.e. extra / cover shifts.</summary>
        public int CoverDays { get; set; }
        /// <summary>
        /// Days worked outside the schedule whose cover/extra request was rejected (or never
        /// filed): the employee showed up, but the day is not credited as an approved cover day.
        /// </summary>
        public int UnapprovedCoverDays { get; set; }
        public decimal OvertimeHours { get; set; }
        public int LateArrivals { get; set; }
        public int UnexcusedAbsences { get; set; }
        public List<PayrollPunchItem> Punches { get; set; } = [];

        /// <summary>Every day of the period, oldest first — the drill-down source.</summary>
        public List<PayrollAttendanceDay> Days { get; set; } = [];
    }

    /// <summary>One payroll sheet row in the overview table / settlement sheet.</summary>
    public class PayrollEntryItem
    {
        public int EmployeeId { get; set; }
        public string Name { get; set; } = string.Empty;
        /// <summary>"RV-00124" — printed under the name.</summary>
        public string EmployeeNumber { get; set; } = string.Empty;
        public string Initials { get; set; } = string.Empty;
        public string Gym { get; set; } = string.Empty;
        public string Position { get; set; } = string.Empty;
        public string EmploymentStatus { get; set; } = string.Empty;
        public int Days { get; set; }
        public decimal Overtime { get; set; }
        /// <summary>Approved cover/extra day credits in the period (1 or 2 per approved request).</summary>
        public int CoverDays { get; set; }
        /// <summary>Days actually worked outside the schedule (cover / extra shifts).</summary>
        public int ExtraShiftDays { get; set; }
        /// <summary>Cover pay: base salary ÷ 30 × approved cover days.</summary>
        public decimal CoverPay { get; set; }
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
        /// <summary>
        /// Work-days ledger + punch proof. Populated by the period detail (the
        /// settlement sheet); null on the per-employee history list.
        /// </summary>
        public PayrollAttendanceItem? Attendance { get; set; }
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

    /// <summary>DELETE …/entries/{employeeId}/deductions/{lineId} → removed line id + the recomputed entry.</summary>
    public class RemoveDeductionData
    {
        /// <summary>The removed line's id.</summary>
        public int Id { get; set; }
        public DeductionEntrySummary Entry { get; set; } = null!;
    }

    public class RemoveDeductionResponse
    {
        public RemoveDeductionData Data { get; set; } = null!;
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

    /// <summary>POST /api/deduction-candidates/{id}/review body (Approve / Waive, optionally re-priced).</summary>
    public class ReviewDeductionRequest
    {
        /// <summary>Accepted (Approve) | Rejected (Waive).</summary>
        public string? Decision { get; set; }

        /// <summary>HR's end-of-month amount override — the line and its source candidate both move to it.</summary>
        public decimal? Amount { get; set; }

        /// <summary>
        /// HR's day count for the line (absence = 3, late = 0.125 / 0.25 / 0.5). The amount is
        /// re-derived from the line's own price per day, and the sweep stops re-pricing it.
        /// </summary>
        public decimal? Days { get; set; }
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
        /// <summary>The gym's annual-increase policy percent (mock's "ANNUAL INCREASE (10%)").</summary>
        public decimal? AnnualIncreasePercent { get; set; }
        /// <summary>This period's raise slice: base salary × the gym's annual-increase percent.</summary>
        public decimal AnnualIncrease { get; set; }
        /// <summary>Overtime hours.</summary>
        public decimal Overtime { get; set; }
        public decimal OvertimePay { get; set; }
        public decimal Bonus { get; set; }
        public decimal Gross { get; set; }
        /// <summary>All lines with their statuses (net only counts Accepted|Approved).</summary>
        public List<PayslipDeductionLine> Deductions { get; set; } = [];
        public decimal Net { get; set; }
        public int Days { get; set; }
        /// <summary>Approved cover/extra day credits in the period (1 or 2 per approved request).</summary>
        public int CoverDays { get; set; }
        /// <summary>Days actually worked outside the schedule (cover / extra shifts).</summary>
        public int ExtraShiftDays { get; set; }
        /// <summary>Cover pay: base salary ÷ 30 × approved cover days.</summary>
        public decimal CoverPay { get; set; }
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
