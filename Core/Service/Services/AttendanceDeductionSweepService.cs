using System.Globalization;
using DomainLayer.Contracts;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.NotificationModule.Enums;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.PayrollModule.Enums;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.SchedulingModule;
using DomainLayer.Models.UserModule;
using Service.Specifications;
using ServiceAbstraction.Services;

namespace Service.Services
{
    /// <summary>
    /// The attendance → deduction bridge (features.md §10, mock §8/§20). For a window
    /// of days it reconciles, per employee:
    /// <list type="bullet">
    /// <item>an unexcused absence — a stored <c>Absent</c> record, or a derived
    /// scheduled-but-unpunched day (same rules as the attendance grid's DeriveRow:
    /// no approved leave, not On Leave / Suspended) — becomes a pending candidate
    /// priced at <see cref="PayrollService.AbsenceDayMultiplier"/> days of pay;</item>
    /// <item>a stored <c>Late</c> record becomes a pending candidate priced at a
    /// quarter day;</item>
    /// <item>a day that no longer justifies the deduction — corrected to On Time, an
    /// approved leave, a now-unscheduled day — drops the pending deduction the sweep
    /// itself raised. Manager-issued deductions are never touched.</item>
    /// </list>
    /// It runs off the dashboards and before the branch reads its deductions list, is
    /// idempotent per (employee, day) — enforced in-process, by a transaction advisory
    /// lock and by the unique <c>(EmployeeId, DeductionDate)</c> index — and prices
    /// from the payroll sheet covering the day, else the latest prior sheet, else the
    /// salary history, else nothing (0 → the branch prices it by hand).
    /// </summary>
    public class AttendanceDeductionSweepService(
        IUnitOfWork unitOfWork,
        TimeZoneInfo attendanceTimeZone) : IAttendanceDeductionSweepService
    {
        /// <summary>In-process gate for the dashboard + nav counter double-trigger.</summary>
        private static readonly SemaphoreSlim SweepGate = new(1, 1);

        /// <summary>PostgreSQL advisory lock key shared by every app instance.</summary>
        private const int AdvisoryLockKey = 0x48524444; // "HRDD"

        public async Task<int> SweepAsync(
            IReadOnlyCollection<int> employeeIds, DateOnly from, DateOnly to, CancellationToken cancellationToken = default)
        {
            if (employeeIds.Count == 0)
            {
                return 0;
            }

            // Never pre-judge a day that hasn't happened in the gym's local time.
            var localNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, attendanceTimeZone);
            var today = DateOnly.FromDateTime(localNow);
            if (to > today)
            {
                to = today;
            }

            if (from > to)
            {
                return 0;
            }

            await SweepGate.WaitAsync(cancellationToken);
            try
            {
                var created = 0;
                await unitOfWork.ExecuteInTransactionAsync(async () =>
                {
                    // Cross-process serialization: two app nodes sweeping the same
                    // roster wait for each other instead of racing the unique index.
                    await unitOfWork.AcquireTransactionLockAsync(AdvisoryLockKey, cancellationToken);
                    created = await SweepCoreAsync(employeeIds, from, to, today, localNow, cancellationToken);
                }, cancellationToken);

                return created;
            }
            finally
            {
                SweepGate.Release();
            }
        }

        private async Task<int> SweepCoreAsync(
            IReadOnlyCollection<int> employeeIds,
            DateOnly from,
            DateOnly to,
            DateOnly today,
            DateTime localNow,
            CancellationToken cancellationToken)
        {
            var ids = employeeIds.ToArray();
            var employees = (await unitOfWork.GetRepository<Employee, int>()
                .GetAllAsync(new EmployeesForDeductionSweepSpec(ids), cancellationToken)).ToList();
            if (employees.Count == 0)
            {
                return 0;
            }

            var records = (await unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceRecordsByEmployeeIdsRangeSpec(ids, from, to), cancellationToken)).ToList();

            // The rate is base ÷ the month's actual scheduled days; load the whole
            // month(s) so a mid-month sweep sees the full schedule, not just the
            // elapsed days (which would always look under-covered).
            var scheduleStart = new DateOnly(from.Year, from.Month, 1);
            var scheduleEnd = new DateOnly(to.Year, to.Month, 1).AddMonths(1).AddDays(-1);
            var assignments = (await unitOfWork.GetRepository<ShiftAssignment, int>()
                .GetAllAsync(new ShiftAssignmentsByEmployeeIdsRangeSpec(ids, scheduleStart, scheduleEnd), cancellationToken))
                .ToList();

            var leaveRequests = (await unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetAllAsync(new ApprovedLeaveByEmployeeIdsSpec(ids, from, to), cancellationToken)).ToList();
            var candidates = (await unitOfWork.GetRepository<DeductionCandidate, int>()
                .GetAllAsync(new DeductionCandidatesByEmployeesSpec(ids), cancellationToken)).ToList();
            var sheets = (await unitOfWork.GetRepository<PayrollEntry, int>()
                .GetAllAsync(new PayrollEntriesByEmployeeIdsSpec(ids), cancellationToken)).ToList();

            // IssuedBy is a real account (the same system user the old follow-up sweep
            // attributed its rows to); without one, reconcile but raise nothing.
            var systemUserId = await FindSystemUserIdAsync(cancellationToken);

            var created = 0;
            var changed = false;

            foreach (var employee in employees)
            {
                var dayRecords = records
                    .Where(r => r.EmployeeId == employee.Id)
                    .GroupBy(r => r.Date)
                    .ToDictionary(g => g.Key, g => g.First());
                var employeeAssignments = assignments.Where(a => a.EmployeeId == employee.Id).ToList();
                var scheduled = employeeAssignments
                    .Where(a => !IsOffAssignment(a))
                    .Select(a => a.Date)
                    .ToHashSet();
                var scheduledOff = employeeAssignments
                    .Where(IsOffAssignment)
                    .Select(a => a.Date)
                    .ToHashSet();
                var leaveDates = ApprovedLeaveDates(leaveRequests, employee.Id, from, to);

                var own = candidates.Where(c => c.EmployeeId == employee.Id).ToList();
                var sheetsOfEmployee = sheets.Where(s => s.EmployeeId == employee.Id).ToList();
                var exempt = employee.Status is EmployeeStatus.OnLeave or EmployeeStatus.Suspended;

                changed |= DedupeOwn(own);

                for (var date = from; date <= to; date = date.AddDays(1))
                {
                    // A day is only judged once its last shift has ended. This is what
                    // stops a 14:53 sweep from penalising a 16:00 shift as absent.
                    if (date == today
                        && !AllShiftsEnded(employeeAssignments, date, localNow))
                    {
                        continue;
                    }

                    dayRecords.TryGetValue(date, out var record);

                    // Approved leave (every leave type, including unpaid leave) and
                    // leave/suspension status exempt the day, even when a stale
                    // biometric record still says Late/Absent.
                    if (exempt || leaveDates.Contains(date))
                    {
                        changed |= Drop(own, date, record?.Id);
                        continue;
                    }

                    if (record is not null && scheduledOff.Contains(date) && record.CheckInTime is null && record.CheckOutTime is null)
                    {
                        changed |= Drop(own, date, record.Id);
                        continue;
                    }

                    if (record is not null && record.Status is not (AttendanceStatus.Late or AttendanceStatus.Absent))
                    {
                        // The day is proven clean (punched on time, corrected, off):
                        // whatever the sweep raised against it no longer stands.
                        changed |= Drop(own, date, record.Id);
                        continue;
                    }

                    if (record is not null)
                    {
                        var (raised, touched) = await EnsureForRecordAsync(
                            employee, record, date, sheetsOfEmployee, employeeAssignments,
                            systemUserId, own, cancellationToken);
                        created += raised;
                        changed |= touched;
                        continue;
                    }

                    if (scheduled.Contains(date))
                    {
                        var (raised, touched) = await EnsureDerivedAbsenceAsync(
                            employee, date, sheetsOfEmployee, employeeAssignments,
                            systemUserId, own, cancellationToken);
                        created += raised;
                        changed |= touched;
                    }
                    else
                    {
                        // No day to punish any more (unscheduled, off) — but a
                        // manager-issued deduction has no system marker, so only the
                        // sweep's own row is ever dropped here.
                        changed |= Drop(own, date, recordId: null);
                    }
                }
            }

            if (changed)
            {
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }

            return created;
        }

        /// <summary>
        /// A stored exception day: anchor the deduction to the record (the day is now a
        /// fact, not a derivation) and, when the day turns out to be a late arrival
        /// rather than an absence, re-price the still-pending row to a quarter day.
        /// </summary>
        private async Task<(int Created, bool Touched)> EnsureForRecordAsync(
            Employee employee,
            AttendanceRecord record,
            DateOnly date,
            IReadOnlyList<PayrollEntry> sheets,
            IReadOnlyList<ShiftAssignment> assignments,
            int? systemUserId,
            List<DeductionCandidate> own,
            CancellationToken cancellationToken)
        {
            var anchored = own.FirstOrDefault(c => c.AttendanceRecordId == record.Id)
                ?? own.FirstOrDefault(c => PayrollService.CandidateDayOf(c) == date);
            if (anchored is not null)
            {
                // A rejected day is final — never re-open, re-price or re-issue it.
                if (anchored.Status == DeductionStatus.Rejected)
                {
                    return (0, false);
                }

                // A manager-issued row owns the day; the sweep only links, never
                // overwrites the manager's amount or wording.
                if (!anchored.IsSystemGenerated)
                {
                    if (anchored.AttendanceRecordId is null)
                    {
                        anchored.AttendanceRecordId = record.Id;
                        unitOfWork.GetRepository<DeductionCandidate, int>().Update(anchored);
                        return (0, true);
                    }

                    return (0, false);
                }

                var isLate = record.Status == AttendanceStatus.Late;
                if (anchored.Status == DeductionStatus.Pending && anchored.Amount <= 0)
                {
                    return (0, TryRepriceUnpriced(anchored, employee, date, sheets, assignments));
                }

                // The day was derived as an absence and the punch now proves a late
                // arrival (or vice versa): keep a pending row honest. Any amount the
                // branch explicitly re-priced with the same reason stays untouched.
                if (anchored.Status == DeductionStatus.Pending
                    && anchored.Reason != (isLate ? "Late arrival" : "Unapproved absence"))
                {
                    var (repriced, repricedNote) = Price(employee, date, sheets, assignments, isLate);
                    anchored.AttendanceRecordId = record.Id;
                    anchored.Reason = isLate ? "Late arrival" : "Unapproved absence";
                    anchored.Amount = repriced;
                    anchored.Note = PayrollService.ParseAbsenceMarker(anchored.Note) == date
                        ? $"{PayrollService.AbsenceMarker(date)} · {repricedNote}"
                        : repricedNote;
                    unitOfWork.GetRepository<DeductionCandidate, int>().Update(anchored);
                    return (0, true);
                }

                if (anchored.AttendanceRecordId is null)
                {
                    anchored.AttendanceRecordId = record.Id;
                    unitOfWork.GetRepository<DeductionCandidate, int>().Update(anchored);
                    return (0, true);
                }

                return (0, false);
            }

            if (systemUserId is null)
            {
                return (0, false);
            }

            var late = record.Status == AttendanceStatus.Late;
            var (amount, pricedNote) = Price(employee, date, sheets, assignments, late);
            var candidate = new DeductionCandidate
            {
                EmployeeId = employee.Id,
                AttendanceRecordId = record.Id,
                DeductionDate = date,
                IsSystemGenerated = true,
                Amount = amount,
                DeductionDays = late ? 0.25m : PayrollService.AbsenceDayMultiplier,
                Reason = late ? "Late arrival" : "Unapproved absence",
                Note = pricedNote,
                IssuedBy = systemUserId.Value,
                IssuedAt = DateTime.UtcNow,
                Status = DeductionStatus.Pending,
            };

            await unitOfWork.GetRepository<DeductionCandidate, int>().AddAsync(candidate, cancellationToken);
            own.Add(candidate);
            await NotifyAsync(employee, date, late, amount, cancellationToken);
            return (1, true);
        }

        /// <summary>
        /// A derived absence (scheduled, no punch, no approved leave): raised with
        /// the day marker so it can be found, dropped or anchored later even though
        /// no attendance record backs it.
        /// </summary>
        private async Task<(int Created, bool Touched)> EnsureDerivedAbsenceAsync(
            Employee employee,
            DateOnly date,
            IReadOnlyList<PayrollEntry> sheets,
            IReadOnlyList<ShiftAssignment> assignments,
            int? systemUserId,
            List<DeductionCandidate> own,
            CancellationToken cancellationToken)
        {
            var existing = own.FirstOrDefault(c => PayrollService.CandidateDayOf(c) == date);
            if (existing is not null)
            {
                if (existing.Status == DeductionStatus.Rejected || !existing.IsSystemGenerated)
                {
                    // The day already has a final or manager-owned deduction.
                    return (0, false);
                }

                if (existing.Status != DeductionStatus.Pending)
                {
                    return (0, false);
                }

                return (0, TryRepriceUnpriced(existing, employee, date, sheets, assignments));
            }

            if (systemUserId is null)
            {
                return (0, false);
            }

            var (amount, note) = Price(employee, date, sheets, assignments, isLate: false);
            var candidate = new DeductionCandidate
            {
                EmployeeId = employee.Id,
                AttendanceRecordId = null,
                DeductionDate = date,
                IsSystemGenerated = true,
                Amount = amount,
                DeductionDays = PayrollService.AbsenceDayMultiplier,
                Reason = "Unapproved absence",
                Note = $"{PayrollService.AbsenceMarker(date)} · {note}",
                IssuedBy = systemUserId.Value,
                IssuedAt = DateTime.UtcNow,
                Status = DeductionStatus.Pending,
            };

            await unitOfWork.GetRepository<DeductionCandidate, int>().AddAsync(candidate, cancellationToken);
            own.Add(candidate);
            await NotifyAsync(employee, date, isLate: false, amount, cancellationToken);
            return (1, true);
        }

        /// <summary>
        /// Prices a pending auto row that was raised before any salary was on file:
        /// as soon as a salary source exists (a recorded salary, a sheet covering the
        /// day) the branch sees the real amount instead of a bare 0. Anything the
        /// branch has already priced or decided on is left exactly as it is.
        /// </summary>
        private bool TryRepriceUnpriced(
            DeductionCandidate candidate,
            Employee employee,
            DateOnly date,
            IReadOnlyList<PayrollEntry> sheets,
            IReadOnlyList<ShiftAssignment> assignments)
        {
            if (candidate.Status != DeductionStatus.Pending
                || candidate.Amount > 0
                || !candidate.IsSystemGenerated)
            {
                return false;
            }

            var (amount, note) = Price(
                employee, date, sheets, assignments, isLate: candidate.Reason == "Late arrival");
            if (amount <= 0)
            {
                return false;
            }

            candidate.Amount = amount;
            candidate.DeductionDate = date;
            // Keep the row shaped the way it was raised (marker for a derived day).
            candidate.Note = PayrollService.ParseAbsenceMarker(candidate.Note) == date
                ? $"{PayrollService.AbsenceMarker(date)} · {note}"
                : note;
            unitOfWork.GetRepository<DeductionCandidate, int>().Update(candidate);
            return true;
        }

        /// <summary>
        /// Defensive de-duplication for rows written before the unique index: keep the
        /// strongest row (rejected is final, then applied, then branch-approved), and
        /// drop only extra pending rows the sweep itself raised. Never drops a decision.
        /// </summary>
        private bool DedupeOwn(List<DeductionCandidate> own)
        {
            var changed = false;
            foreach (var group in own.GroupBy(PayrollService.CandidateDayOf).Where(g => g.Count() > 1).ToList())
            {
                var ordered = group
                    .OrderBy(c => c.Status switch
                    {
                        DeductionStatus.Rejected => 0,
                        DeductionStatus.Approved => 1,
                        DeductionStatus.BranchApproved => 2,
                        _ => 3,
                    })
                    .ThenBy(c => c.IsSystemGenerated)
                    .ThenBy(c => c.Id)
                    .ToList();

                foreach (var extra in ordered.Skip(1))
                {
                    if (extra.Status != DeductionStatus.Pending || !extra.IsSystemGenerated)
                    {
                        continue;
                    }

                    own.Remove(extra);
                    unitOfWork.GetRepository<DeductionCandidate, int>().Remove(extra);
                    changed = true;
                }
            }

            return changed;
        }

        /// <summary>
        /// Drops the pending deductions the sweep owns for one day: anything carrying
        /// the day's marker, plus anything anchored to that day's record (anchoring is
        /// only ever done by this sweep or by payroll close, which finalises at once).
        /// Manager-issued rows carry neither marker nor system flag and survive.
        /// </summary>
        private static bool IsOffAssignment(ShiftAssignment assignment) =>
            assignment.ShiftTemplateId is null
            || assignment.ShiftTemplate is null
            || assignment.ShiftTemplate.Name.Contains("off", StringComparison.OrdinalIgnoreCase);

        private bool Drop(List<DeductionCandidate> own, DateOnly date, int? recordId)
        {
            var doomed = own.Where(c => c.Status == DeductionStatus.Pending
                && c.IsSystemGenerated
                && (PayrollService.CandidateDayOf(c) == date
                    || (recordId is not null && c.AttendanceRecordId == recordId.Value))).ToList();
            if (doomed.Count == 0)
            {
                return false;
            }

            foreach (var candidate in doomed)
            {
                own.Remove(candidate);
                unitOfWork.GetRepository<DeductionCandidate, int>().Remove(candidate);
            }

            return true;
        }

        /// <summary>True once every shift scheduled for the day has ended in gym-local time.</summary>
        private static bool AllShiftsEnded(
            IReadOnlyList<ShiftAssignment> assignments, DateOnly date, DateTime localNow)
        {
            var shifts = assignments
                .Where(a => a.Date == date && !IsOffAssignment(a) && a.ShiftTemplate is not null)
                .ToList();
            if (shifts.Count == 0)
            {
                // No schedule means no basis to call the day absent yet.
                return false;
            }

            return shifts.All(s => ShiftEnded(s.ShiftTemplate!, date, localNow));
        }

        private static bool ShiftEnded(ShiftTemplate template, DateOnly date, DateTime localNow)
        {
            var end = template.EndTime <= template.StartTime
                ? date.AddDays(1).ToDateTime(template.EndTime)
                : date.ToDateTime(template.EndTime);
            return localNow >= end;
        }

        /// <summary>Every day covered by an approved leave-type request for one employee.</summary>
        private static HashSet<DateOnly> ApprovedLeaveDates(
            IReadOnlyList<EmployeeRequest> requests, int employeeId, DateOnly from, DateOnly to)
        {
            var dates = new HashSet<DateOnly>();
            foreach (var request in requests.Where(r => r.EmployeeId == employeeId && IsApprovedLeave(r)))
            {
                var start = request.TargetStartDate ?? request.RequestDate;
                var end = request.TargetEndDate ?? request.RequestDate;
                if (end > to)
                {
                    end = to;
                }

                for (var day = start; day <= end; day = day.AddDays(1))
                {
                    if (day >= from)
                    {
                        dates.Add(day);
                    }
                }
            }

            return dates;
        }

        /// <summary>
        /// All approved leave types exempt the day. The explicit "Day Off" type and
        /// unpaid leave are included even though they consume no paid balance.
        /// </summary>
        private static bool IsApprovedLeave(EmployeeRequest request) =>
            string.Equals(request.Payment, "unpaid", StringComparison.OrdinalIgnoreCase)
            || request.Type.Equals("Day Off", StringComparison.OrdinalIgnoreCase)
            || RequestTypeCatalog.LeaveTypeFor(request.Type) is not null;

        /// <summary>
        /// The money and the note one attendance exception costs: the sheet covering
        /// the day, else the latest prior sheet, else the salary history, else nothing.
        /// </summary>
        private static (decimal Amount, string Note) Price(
            Employee employee,
            DateOnly date,
            IReadOnlyList<PayrollEntry> sheets,
            IReadOnlyList<ShiftAssignment> assignments,
            bool isLate)
        {
            var (daily, divisor) = DeductionPricing.DailyRate(employee, date, sheets, assignments);
            var amount = isLate ? Math.Round(daily / 4m, 2) : Math.Round(daily * PayrollService.AbsenceDayMultiplier, 2);
            if (amount <= 0)
            {
                return (0m, "No salary on file — the branch must price this deduction manually.");
            }

            var basis = $"{divisor} calendar days";
            return (amount, isLate
                ? $"Auto-priced: quarter day (base ÷ {basis} ÷ 4)."
                : $"Auto-priced: {PayrollService.AbsenceDayMultiplier} days (base ÷ {basis} × {PayrollService.AbsenceDayMultiplier}).");
        }

        private async Task NotifyAsync(
            Employee employee, DateOnly date, bool isLate, decimal amount, CancellationToken cancellationToken)
        {
            if (employee.UserId <= 0)
            {
                return;
            }

            var money = amount > 0
                ? $"A deduction of {amount.ToString("0.00", CultureInfo.InvariantCulture)} was raised for review."
                : isLate
                    ? "A late deduction was raised for review — your manager still has to price it."
                    : "A deduction was raised for review — your manager still has to price it.";
            var size = isLate ? "a quarter day" : $"{PayrollService.AbsenceDayMultiplier} days";

            var body = isLate
                ? $"You arrived late on {date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)}. {money}"
                : $"You were marked absent without permission for {date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)}. " +
                  (amount > 0 ? $"{money} ({size} of pay)." : money);

            await unitOfWork.GetRepository<Notification, int>().AddAsync(new Notification
            {
                UserId = employee.UserId,
                Title = isLate ? "Late arrival" : "Absence recorded",
                Message = body,
                Type = NotificationType.SystemUpdate,
            }, cancellationToken);
        }

        private async Task<int?> FindSystemUserIdAsync(CancellationToken cancellationToken)
        {
            var admin = await unitOfWork.GetRepository<User, int>()
                .GetAllAsync(new UserByEmailSpec("admin@revive.hr"), cancellationToken);
            return admin.Select(u => u.Id).Cast<int?>().FirstOrDefault();
        }
    }
}
