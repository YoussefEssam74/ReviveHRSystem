using System.Globalization;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.RequestModule.Enums;
using DomainLayer.Models.SchedulingModule;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Attendance;

namespace Service.Services
{
    /// <summary>
    /// HR attendance management (S4, Section 4 A1/A3/A4/A5/A7).
    ///
    /// The directory grid and the employee history are composed, not stored: for
    /// every (employee, day) the service merges the stored AttendanceRecord with
    /// the shift assignments and approved Day Off requests, mirroring the mock
    /// UI's client-side generator (attGenerate) — Off for scheduled-off /
    /// approved-day-off / on-leave days, Scheduled for future days, and Absent
    /// for past workdays with no punch. The server stays deterministic (no
    /// mock rolls): a past workday without a record is simply Absent.
    ///
    /// Gym scoping and the attendance.view / attendance.manual_entry /
    /// attendance.edit keys are enforced per ADR-003, exactly like the other
    /// HR services. The kiosk punch flow stays in <see cref="AttendanceService"/>.
    /// </summary>
    public sealed class AttendanceManagementService : IAttendanceManagementService
    {
        private const int MaxPageSize = 200;
        private const int DefaultPageSize = 20;
        private const int MaxRangeDays = 62;

        private readonly IUnitOfWork _unitOfWork;
        private readonly IAccessControlService _accessControl;
        private readonly IUserAccessRepository _userAccess;
        private readonly TimeZoneInfo _attendanceTimeZone;

        public AttendanceManagementService(
            IUnitOfWork unitOfWork,
            IAccessControlService accessControl,
            IUserAccessRepository userAccess,
            TimeZoneInfo attendanceTimeZone)
        {
            _unitOfWork = unitOfWork;
            _accessControl = accessControl;
            _userAccess = userAccess;
            _attendanceTimeZone = attendanceTimeZone;
        }

        // ------------------------------------------------------------------
        // A1 — directory grid
        // ------------------------------------------------------------------

        public async Task<AttendanceListResponse> GetAttendanceAsync(
            int? actorUserId, AttendanceListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var requestedGym = query.Gym ?? query.GymId;
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "attendance.view", requestedGym, cancellationToken);
            var gymFilter = await ResolveGymFilterAsync(actor, requestedGym, cancellationToken);

            var (from, to) = ResolveRange(query.Date, query.From, query.To);
            var page = Math.Max(query.Page, 1);
            var pageSize = query.PageSize <= 0 ? DefaultPageSize : Math.Min(query.PageSize, MaxPageSize);

            var employeeRepo = _unitOfWork.GetRepository<Employee, int>();
            IReadOnlyList<Employee> employees;

            if (query.EmployeeId.HasValue)
            {
                var single = await employeeRepo.GetByIdAsync(new EmployeeForAttendanceSpec(query.EmployeeId.Value), cancellationToken)
                    ?? throw new NotFoundException("Employee not found.");
                EnsureGymInScope(gymFilter, single.GymId);
                employees = [single];
            }
            else
            {
                employees = (await employeeRepo.GetAllAsync(new EmployeesForRosterSpec(gymFilter), cancellationToken)).ToList();
            }

            var rows = await ComposeRowsAsync(employees, from, to, cancellationToken);

            var statusFilter = string.IsNullOrWhiteSpace(query.Status) ? null : query.Status.Trim();
            if (statusFilter is not null)
            {
                rows = rows
                    .Where(r => string.Equals(r.Status, statusFilter, StringComparison.OrdinalIgnoreCase))
                    .ToList();
            }

            var total = rows.Count;
            var items = rows
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            return new AttendanceListResponse
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = total == 0 ? 0 : (int)Math.Ceiling(total / (double)pageSize),
            };
        }

        // ------------------------------------------------------------------
        // A3/A5 — manual entry / quick marks
        // ------------------------------------------------------------------

        public async Task<HrAttendanceRecordResponse> RecordManualEntryAsync(
            int? actorUserId, HrManualAttendanceRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);

            if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length < 3)
            {
                throw new BadRequestException("A reason (at least 3 characters) is required for a manual entry.");
            }

            var date = ParseDate(request.Date, "date");
            var status = ParseWritableStatus(request.Status);
            var employee = await FindEmployeeAsync(request.EmployeeId, cancellationToken);
            if (employee.Status == EmployeeStatus.Terminated)
            {
                throw new BadRequestException("Attendance cannot be recorded for a terminated employee.");
            }

            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "attendance.manual_entry", employee.GymId, cancellationToken);

            var (checkIn, checkOut) = ParseDayPunches(request.CheckIn, request.CheckOut, status, date);

            var repo = _unitOfWork.GetRepository<AttendanceRecord, int>();
            var record = await repo.GetByIdAsync(new AttendanceRecordByEmployeeDateSpec(employee.Id, date), cancellationToken);
            var reason = request.Reason.Trim();

            if (record is null)
            {
                record = new AttendanceRecord
                {
                    EmployeeId = employee.Id,
                    GymId = employee.GymId,
                    Date = date,
                };
                await repo.AddAsync(record, cancellationToken);
            }

            record.CheckInTime = checkIn;
            record.CheckOutTime = checkOut;
            record.CheckInMethod = checkIn.HasValue ? AttendanceMethod.Manual : null;
            record.CheckOutMethod = checkOut.HasValue ? AttendanceMethod.Manual : null;
            record.Status = status;
            record.Notes = $"Manual entry: {reason}";
            record.ScheduledShiftTemplateId ??= await ResolveShiftTemplateIdAsync(employee.Id, date, cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            // Re-read so the response carries the loaded shift template; the
            // latest correction (if this day was corrected before) comes with it.
            record = await repo.GetByIdAsync(new AttendanceRecordByEmployeeDateSpec(employee.Id, date), cancellationToken)
                ?? record;
            var latest = await LoadLatestCorrectionAsync(record.Id, cancellationToken);

            return new HrAttendanceRecordResponse
            {
                Data = MapRow(record, employee, employee.Gym.Name, latest),
            };
        }

        // ------------------------------------------------------------------
        // A4 — correction with audit trail
        // ------------------------------------------------------------------

        public async Task<HrAttendanceRecordResponse> CorrectRecordAsync(
            int? actorUserId, int recordId, AttendanceCorrectionRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);

            if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length < 3)
            {
                throw new BadRequestException("A reason (at least 3 characters) is required to correct an attendance record.");
            }

            var repo = _unitOfWork.GetRepository<AttendanceRecord, int>();
            var record = await repo.GetByIdAsync(new AttendanceRecordByIdWithDetailsSpec(recordId), cancellationToken)
                ?? throw new NotFoundException("Attendance record not found.");

            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "attendance.edit", record.GymId, cancellationToken);

            var status = ParseWritableStatus(request.Status);
            var (checkIn, checkOut) = ParseDayPunches(request.CheckIn, request.CheckOut, status, record.Date);
            var reason = request.Reason.Trim();

            await _unitOfWork.GetRepository<AttendanceCorrection, int>().AddAsync(new AttendanceCorrection
            {
                AttendanceRecordId = record.Id,
                OriginalCheckIn = record.CheckInTime,
                OriginalCheckOut = record.CheckOutTime,
                OriginalStatus = record.Status,
                CorrectedCheckIn = checkIn,
                CorrectedCheckOut = checkOut,
                CorrectedStatus = status,
                Reason = reason,
                CorrectedBy = actor.Id,
                CorrectedAt = DateTime.UtcNow,
            }, cancellationToken);

            record.CheckInTime = checkIn;
            record.CheckOutTime = checkOut;
            record.CheckInMethod = checkIn.HasValue ? AttendanceMethod.Manual : null;
            record.CheckOutMethod = checkOut.HasValue ? AttendanceMethod.Manual : null;
            record.Status = status;
            record.Notes = $"Corrected: {reason}";

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            // Re-read so the response carries the just-written correction row.
            record = await repo.GetByIdAsync(new AttendanceRecordByIdWithDetailsSpec(recordId), cancellationToken)
                ?? record;
            var latest = await LoadLatestCorrectionAsync(recordId, cancellationToken);

            return new HrAttendanceRecordResponse
            {
                Data = MapRow(record, record.Employee, record.Employee.Gym.Name, latest),
            };
        }

        // ------------------------------------------------------------------
        // A7 — employee attendance history + month totals
        // ------------------------------------------------------------------

        public async Task<EmployeeAttendanceResponse> GetEmployeeAttendanceAsync(
            int? actorUserId, int employeeId, EmployeeAttendanceQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var employee = await _unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeForAttendanceSpec(employeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "attendance.view", employee.GymId, cancellationToken);

            var page = Math.Max(query.Page, 1);
            var pageSize = query.PageSize <= 0 ? 31 : Math.Min(query.PageSize, MaxPageSize);

            var (monthStart, monthEnd) = ResolveMonth(query.Month);
            var today = Today();
            // The mock UI only shows elapsed days (past + today); future days are
            // excluded entirely rather than shown as Scheduled.
            var to = monthEnd < today ? monthEnd : today;
            var rows = to < monthStart
                ? []
                : await ComposeRowsAsync([employee], monthStart, to, cancellationToken);

            var totals = BuildTotals(rows);

            var total = rows.Count;
            var items = rows
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(r => new EmployeeAttendanceItem
                {
                    Date = r.Date,
                    Shift = r.Shift,
                    CheckIn = r.CheckIn,
                    CheckOut = r.CheckOut,
                    Status = r.Status,
                    Notes = r.Notes,
                })
                .ToList();

            return new EmployeeAttendanceResponse
            {
                Items = items,
                Totals = totals,
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = total == 0 ? 0 : (int)Math.Ceiling(total / (double)pageSize),
            };
        }

        // ------------------------------------------------------------------
        // Composition — the mock UI's attGenerate, deterministic
        // ------------------------------------------------------------------

        /// <summary>
        /// One row per (employee, day): stored record wins; otherwise the day is
        /// derived from the shift assignment / approved Day Off / employment
        /// status / future-ness, exactly like the HR page's client generator.
        /// </summary>
        private async Task<List<AttendanceListItem>> ComposeRowsAsync(
            IReadOnlyList<Employee> employees, DateOnly from, DateOnly to, CancellationToken cancellationToken)
        {
            if (employees.Count == 0 || to < from)
            {
                return [];
            }

            if ((to.DayNumber - from.DayNumber) + 1 > MaxRangeDays)
            {
                throw new BadRequestException($"The requested range is too large (max {MaxRangeDays} days).");
            }

            var employeeIds = employees.Select(e => e.Id).ToArray();

            var records = (await _unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceRecordsByEmployeeIdsRangeSpec(employeeIds, from, to), cancellationToken))
                .ToList();
            var recordIndex = records.ToDictionary(r => (r.EmployeeId, r.Date));

            // The evaluator cannot walk collection-then-references, so the audit
            // corrections (with their editor) are loaded in one bulk query.
            var correctionsByRecordId = await LoadLatestCorrectionsAsync(records.Select(r => r.Id).ToArray(), cancellationToken);

            var assignments = await _unitOfWork.GetRepository<ShiftAssignment, int>()
                .GetAllAsync(new ShiftAssignmentsByEmployeeIdsRangeSpec(employeeIds, from, to), cancellationToken);
            var assignmentIndex = assignments.ToDictionary(a => (a.EmployeeId, a.Date));

            var dayOffDates = await LoadApprovedDayOffDatesAsync(employeeIds, from, to, cancellationToken);

            var today = Today();
            var rows = new List<AttendanceListItem>((to.DayNumber - from.DayNumber + 1) * employees.Count);

            foreach (var employee in employees)
            {
                for (var date = from; date <= to; date = date.AddDays(1))
                {
                    var shiftLabel = BuildShiftLabel(assignmentIndex.TryGetValue((employee.Id, date), out var assignment) ? assignment : null);

                    if (recordIndex.TryGetValue((employee.Id, date), out var record))
                    {
                        correctionsByRecordId.TryGetValue(record.Id, out var correction);
                        rows.Add(MapRow(record, employee, employee.Gym?.Name ?? string.Empty, correction, shiftLabel));
                        continue;
                    }

                    rows.Add(DeriveRow(employee, date, shiftLabel, dayOffDates, today));
                }
            }

            // The grid opens grouped per employee, then chronologically.
            return rows
                .OrderBy(r => r.Name, StringComparer.OrdinalIgnoreCase)
                .ThenBy(r => r.Date, StringComparer.Ordinal)
                .ToList();
        }

        /// <summary>A stored punch-less day: Off (scheduled off / approved day off / on leave), Scheduled (future), or Absent.</summary>
        private static AttendanceListItem DeriveRow(
            Employee employee, DateOnly date, string shiftLabel, Dictionary<int, HashSet<DateOnly>> dayOffDates, DateOnly today)
        {
            string status;
            string? notes;

            if (employee.Status == EmployeeStatus.Suspended)
            {
                status = "Absent";
                notes = "Suspended employee";
            }
            else if (date > today)
            {
                status = "Scheduled";
                notes = "Upcoming shift";
            }
            else if (shiftLabel == "Off")
            {
                status = "Off";
                notes = "Scheduled off";
            }
            else if (dayOffDates.TryGetValue(employee.Id, out var days) && days.Contains(date))
            {
                status = "Off";
                notes = "Day Off approved";
            }
            else if (employee.Status == EmployeeStatus.OnLeave)
            {
                status = "Off";
                notes = "On leave";
            }
            else
            {
                status = "Absent";
                notes = "No punch recorded";
            }

            return new AttendanceListItem
            {
                Id = null,
                EmployeeId = employee.Id,
                Name = employee.FullName,
                Gym = employee.Gym?.Name ?? string.Empty,
                Date = date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                Shift = shiftLabel,
                Status = status,
                Notes = notes,
            };
        }

        private async Task<Dictionary<int, HashSet<DateOnly>>> LoadApprovedDayOffDatesAsync(
            int[] employeeIds, DateOnly from, DateOnly to, CancellationToken cancellationToken)
        {
            var requests = await _unitOfWork.GetRepository<DomainLayer.Models.RequestModule.EmployeeRequest, int>()
                .GetAllAsync(new ApprovedDayOffRequestsByEmployeeIdsSpec(employeeIds, from, to), cancellationToken);

            var map = new Dictionary<int, HashSet<DateOnly>>();
            foreach (var request in requests)
            {
                var start = request.TargetStartDate ?? request.RequestDate;
                var end = request.TargetEndDate ?? request.RequestDate;
                if (!map.TryGetValue(request.EmployeeId, out var set))
                {
                    map[request.EmployeeId] = set = [];
                }

                for (var date = start; date <= end; date = date.AddDays(1))
                {
                    set.Add(date);
                }
            }

            return map;
        }

        private static EmployeeAttendanceTotals BuildTotals(List<AttendanceListItem> rows)
        {
            var totals = new EmployeeAttendanceTotalsCounter();
            foreach (var row in rows)
            {
                totals.Total++;
                switch (row.Status)
                {
                    case "On Time":
                    case "Late":
                    case "Early Checkout":
                    case "Missing Checkout":
                        totals.Present++;
                        break;
                    case "Absent":
                        totals.Absent++;
                        break;
                    case "Off":
                        totals.Off++;
                        break;
                }

                if (row.Status == "Late")
                {
                    totals.Late++;
                }

                totals.Hours += WorkedHours(row);
                totals.Expected += ExpectedHours(row.Shift);
            }

            return new EmployeeAttendanceTotals
            {
                Total = totals.Total,
                Present = totals.Present,
                Late = totals.Late,
                Absent = totals.Absent,
                Off = totals.Off,
                Hours = (decimal)Math.Round(totals.Hours, 2),
                Expected = (decimal)Math.Round(totals.Expected, 2),
            };
        }

        private sealed class EmployeeAttendanceTotalsCounter
        {
            public int Total;
            public int Present;
            public int Late;
            public int Absent;
            public int Off;
            public double Hours;
            public double Expected;
        }

        /// <summary>Worked hours from the punches; overnight spans roll past midnight.</summary>
        private static double WorkedHours(AttendanceListItem row)
        {
            if (row.CheckIn is null || row.CheckOut is null)
            {
                return 0;
            }

            var start = TimeOnly.Parse(row.CheckIn, CultureInfo.InvariantCulture);
            var end = TimeOnly.Parse(row.CheckOut, CultureInfo.InvariantCulture);
            var minutes = (ToMinutes(end) - ToMinutes(start) + 1440) % 1440;
            return minutes / 60d;
        }

        /// <summary>Scheduled shift duration ('08:00–16:00' labels; overnight rolls past midnight).</summary>
        private static double ExpectedHours(string shiftLabel)
        {
            if (string.IsNullOrEmpty(shiftLabel) || shiftLabel == "Off")
            {
                return 0;
            }

            var parts = shiftLabel.Split('–');
            if (parts.Length != 2
                || !TimeOnly.TryParse(parts[0], CultureInfo.InvariantCulture, out var start)
                || !TimeOnly.TryParse(parts[1], CultureInfo.InvariantCulture, out var end))
            {
                return 0;
            }

            var minutes = (ToMinutes(end) - ToMinutes(start) + 1440) % 1440;
            return minutes / 60d;
        }

        private static int ToMinutes(TimeOnly time) => time.Hour * 60 + time.Minute;

        // ------------------------------------------------------------------
        // Mapping helpers
        // ------------------------------------------------------------------

        private AttendanceListItem MapRow(
            AttendanceRecord record, Employee employee, string gymName, AttendanceCorrection? latestCorrection, string? shiftLabel = null)
        {
            var source = record.CheckInMethod.HasValue || record.CheckOutMethod.HasValue
                ? ((record.CheckInMethod ?? record.CheckOutMethod) == AttendanceMethod.Manual ? "Manual" : "Biometric")
                : string.Empty;

            return new AttendanceListItem
            {
                Id = record.Id,
                EmployeeId = employee.Id,
                Name = employee.FullName,
                Gym = gymName,
                Date = record.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                Shift = shiftLabel ?? BuildShiftLabelFromRecord(record),
                CheckIn = FormatPunch(record.CheckInTime),
                CheckOut = FormatPunch(record.CheckOutTime),
                Status = DisplayStatus(record.Status),
                Source = source,
                Notes = record.Notes,
                CorrectedBy = latestCorrection is null
                    ? null
                    : latestCorrection.CorrectedByUser?.EmployeeProfile?.FullName
                        ?? latestCorrection.CorrectedByUser?.UserName,
                CorrectedAt = latestCorrection is null
                    ? null
                    : latestCorrection.CorrectedAt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            };
        }

        /// <summary>Latest audit correction for one record (A3/A4 responses), with its editor.</summary>
        private async Task<AttendanceCorrection?> LoadLatestCorrectionAsync(int recordId, CancellationToken cancellationToken)
        {
            var corrections = await _unitOfWork.GetRepository<AttendanceCorrection, int>()
                .GetAllAsync(new AttendanceCorrectionsByRecordIdsSpec([recordId]), cancellationToken);
            return corrections.OrderByDescending(c => c.CorrectedAt).FirstOrDefault();
        }

        /// <summary>Latest audit correction per record id (the A1 grid's bulk compose).</summary>
        private async Task<Dictionary<int, AttendanceCorrection>> LoadLatestCorrectionsAsync(
            int[] recordIds, CancellationToken cancellationToken)
        {
            if (recordIds.Length == 0)
            {
                return new Dictionary<int, AttendanceCorrection>();
            }

            var corrections = await _unitOfWork.GetRepository<AttendanceCorrection, int>()
                .GetAllAsync(new AttendanceCorrectionsByRecordIdsSpec(recordIds), cancellationToken);

            return corrections
                .GroupBy(c => c.AttendanceRecordId)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(c => c.CorrectedAt).First());
        }

        /// <summary>Stored records prefer their pinned shift template, then today's assignment.</summary>
        private string BuildShiftLabelFromRecord(AttendanceRecord record)
        {
            if (record.ScheduledShiftTemplate is not null)
            {
                return FormatShift(record.ScheduledShiftTemplate.StartTime, record.ScheduledShiftTemplate.EndTime);
            }

            return "Off";
        }

        private static string BuildShiftLabel(ShiftAssignment? assignment) =>
            assignment?.ShiftTemplate is not null
                ? FormatShift(assignment.ShiftTemplate.StartTime, assignment.ShiftTemplate.EndTime)
                : "Off";

        private static string FormatShift(TimeOnly start, TimeOnly end) =>
            $"{start.ToString("HH:mm", CultureInfo.InvariantCulture)}–{end.ToString("HH:mm", CultureInfo.InvariantCulture)}";

        /// <summary>Stores UTC, displays gym-local clock time.</summary>
        private string? FormatPunch(DateTime? utcMoment)
        {
            if (utcMoment is null)
            {
                return null;
            }

            var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcMoment.Value, DateTimeKind.Utc), _attendanceTimeZone);
            return local.ToString("HH:mm", CultureInfo.InvariantCulture);
        }

        private DateOnly Today() =>
            DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _attendanceTimeZone));

        // ------------------------------------------------------------------
        // Parsing / validation
        // ------------------------------------------------------------------

        private (DateOnly From, DateOnly To) ResolveRange(string? date, string? from, string? to)
        {
            var today = Today();

            if (!string.IsNullOrWhiteSpace(date))
            {
                var single = ParseDate(date, "date");
                return (single, single);
            }

            var start = string.IsNullOrWhiteSpace(from)
                ? today
                : ParseDate(from, "from");
            var end = string.IsNullOrWhiteSpace(to)
                ? today
                : ParseDate(to, "to");

            if (end < start)
            {
                throw new BadRequestException("The 'to' date must not be before the 'from' date.");
            }

            return (start, end);
        }

        private (DateOnly Start, DateOnly End) ResolveMonth(string? month)
        {
            if (string.IsNullOrWhiteSpace(month))
            {
                var today = Today();
                return (new DateOnly(today.Year, today.Month, 1), new DateOnly(today.Year, today.Month, DateTime.DaysInMonth(today.Year, today.Month)));
            }

            if (!DateOnly.TryParseExact(month.Trim(), "yyyy-MM", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
            {
                throw new BadRequestException("The month must be formatted as yyyy-MM.");
            }

            return (parsed, new DateOnly(parsed.Year, parsed.Month, DateTime.DaysInMonth(parsed.Year, parsed.Month)));
        }

        private static DateOnly ParseDate(string? value, string field)
        {
            if (string.IsNullOrWhiteSpace(value)
                || !DateOnly.TryParseExact(value.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
            {
                throw new BadRequestException($"The {field} must be formatted as yyyy-MM-dd.");
            }

            return parsed;
        }

        /// <summary>Accepts the display values the UI sends; 'Scheduled' is derived-only and rejected for writes.</summary>
        private static AttendanceStatus ParseWritableStatus(string? status)
        {
            var normalized = (status ?? string.Empty).Trim();
            return normalized switch
            {
                "On Time" => AttendanceStatus.OnTime,
                "Late" => AttendanceStatus.Late,
                "Absent" => AttendanceStatus.Absent,
                "Early Checkout" => AttendanceStatus.EarlyCheckout,
                "Missing Checkout" => AttendanceStatus.MissingCheckout,
                "Off" => AttendanceStatus.Off,
                _ => throw new BadRequestException("Status must be one of: On Time, Late, Absent, Early Checkout, Missing Checkout, Off."),
            };
        }

        private static string DisplayStatus(AttendanceStatus status) => status switch
        {
            AttendanceStatus.OnTime => "On Time",
            AttendanceStatus.Late => "Late",
            AttendanceStatus.Absent => "Absent",
            AttendanceStatus.EarlyCheckout => "Early Checkout",
            AttendanceStatus.MissingCheckout => "Missing Checkout",
            AttendanceStatus.Off => "Off",
            _ => status.ToString(),
        };

        /// <summary>
        /// Parses the HH:mm punches; Absent/Off days clear them (matching the
        /// quick-mark behavior). Returns UTC instants on the given date.
        /// </summary>
        private (DateTime? CheckIn, DateTime? CheckOut) ParseDayPunches(
            string? checkIn, string? checkOut, AttendanceStatus status, DateOnly date)
        {
            if (status is AttendanceStatus.Absent or AttendanceStatus.Off)
            {
                return (null, null);
            }

            return (ParsePunch(checkIn, "checkIn", date), ParsePunch(checkOut, "checkOut", date));
        }

        private DateTime? ParsePunch(string? value, string field, DateOnly date)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            if (!TimeOnly.TryParseExact(value.Trim(), "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var time))
            {
                throw new BadRequestException($"The {field} must be formatted as HH:mm.");
            }

            var local = date.ToDateTime(time);
            return TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), _attendanceTimeZone);
        }

        private async Task<Employee> FindEmployeeAsync(string employeeReference, CancellationToken cancellationToken)
        {
            return await _unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeWithGymByReferenceSpec(employeeReference), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");
        }

        private async Task<int?> ResolveShiftTemplateIdAsync(int employeeId, DateOnly date, CancellationToken cancellationToken)
        {
            var assignment = await _unitOfWork.GetRepository<ShiftAssignment, int>()
                .GetByIdAsync(new ShiftAssignmentByEmployeeDateSpec(employeeId, date), cancellationToken);
            return assignment?.ShiftTemplateId;
        }

        private static void EnsureGymInScope(int[]? gymFilter, int gymId)
        {
            if (gymFilter is not null && !gymFilter.Contains(gymId))
            {
                throw new UnAuthorizedException("You are not assigned to this gym.");
            }
        }

        // ------------------------------------------------------------------
        // Shared plumbing (mirrors RequestService)
        // ------------------------------------------------------------------

        private async Task<User> ResolveActorAsync(int? actorUserId, CancellationToken cancellationToken)
        {
            if (actorUserId is null)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            var actor = await _unitOfWork.GetRepository<User, int>().GetByIdAsync(actorUserId.Value, cancellationToken);
            if (actor is null || !actor.IsActive)
            {
                throw new UnAuthorizedException("Your session is invalid. Please sign in again.");
            }

            return actor;
        }

        /// <summary>The caller's gym scope — TopManagement sees all; others their assigned gyms (empty matches nobody).</summary>
        private async Task<int[]?> ResolveGymFilterAsync(User actor, int? requestedGym, CancellationToken cancellationToken)
        {
            if (actor.UserType == UserType.TopManagement)
            {
                return requestedGym.HasValue ? [requestedGym.Value] : null;
            }

            var allowedIds = (await _userAccess.GetGymAccessAsync(actor.Id, cancellationToken))
                .Select(a => a.GymId)
                .ToHashSet();
            if (requestedGym.HasValue)
            {
                if (!allowedIds.Contains(requestedGym.Value))
                {
                    throw new UnAuthorizedException("You are not assigned to this gym.");
                }

                return [requestedGym.Value];
            }

            return allowedIds.Count == 0 ? [] : allowedIds.ToArray();
        }
    }
}
