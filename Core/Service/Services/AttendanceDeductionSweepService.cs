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
    /// no approved day off, not On Leave / Suspended) — becomes a pending candidate
    /// priced at <see cref="PayrollService.AbsenceDayMultiplier"/> days of pay;</item>
    /// <item>a stored <c>Late</c> record becomes a pending candidate priced at a
    /// quarter day;</item>
    /// <item>a day that no longer justifies the deduction — corrected to On Time, an
    /// approved day off, a now-unscheduled day — drops the pending deduction the
    /// sweep itself raised. Manager-issued deductions are never touched.</item>
    /// </list>
    /// It runs off the dashboards and before the branch reads its deductions list, is
    /// idempotent per (employee, day), and prices from the payroll sheet covering the
    /// day, else the employee's salary history, else nothing (0 → the branch prices
    /// it by hand).
    /// </summary>
    public class AttendanceDeductionSweepService(
        IUnitOfWork unitOfWork,
        TimeZoneInfo attendanceTimeZone) : IAttendanceDeductionSweepService
    {
        public async Task<int> SweepAsync(
            IReadOnlyCollection<int> employeeIds, DateOnly from, DateOnly to, CancellationToken cancellationToken = default)
        {
            if (employeeIds.Count == 0)
            {
                return 0;
            }

            // Never pre-judge a day that hasn't happened in the gym's local time.
            var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, attendanceTimeZone));
            if (to > today)
            {
                to = today;
            }

            if (from > to)
            {
                return 0;
            }

            var ids = employeeIds.ToArray();
            var employees = (await unitOfWork.GetRepository<Employee, int>()
                .GetAllAsync(new EmployeesForDeductionSweepSpec(ids), cancellationToken)).ToList();
            if (employees.Count == 0)
            {
                return 0;
            }

            var records = (await unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceRecordsByEmployeeIdsRangeSpec(ids, from, to), cancellationToken)).ToList();
            var assignments = (await unitOfWork.GetRepository<ShiftAssignment, int>()
                .GetAllAsync(new ShiftAssignmentsByEmployeeIdsRangeSpec(ids, from, to), cancellationToken)).ToList();
            var dayOffs = (await unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetAllAsync(new ApprovedDayOffRequestsByEmployeeIdsSpec(ids, from, to), cancellationToken)).ToList();
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
                var scheduled = assignments
                    .Where(a => a.EmployeeId == employee.Id && a.ShiftTemplateId is not null)
                    .Select(a => a.Date)
                    .ToHashSet();
                var dayOffDates = new HashSet<DateOnly>();
                foreach (var request in dayOffs.Where(r => r.EmployeeId == employee.Id))
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
                            dayOffDates.Add(day);
                        }
                    }
                }

                var own = candidates.Where(c => c.EmployeeId == employee.Id).ToList();
                var sheetsOfEmployee = sheets.Where(s => s.EmployeeId == employee.Id).ToList();
                var exempt = employee.Status is EmployeeStatus.OnLeave or EmployeeStatus.Suspended;

                for (var date = from; date <= to; date = date.AddDays(1))
                {
                    dayRecords.TryGetValue(date, out var record);

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
                            employee, record, date, sheetsOfEmployee, systemUserId, own, cancellationToken);
                        created += raised;
                        changed |= touched;
                        continue;
                    }

                    if (!exempt && scheduled.Contains(date) && !dayOffDates.Contains(date))
                    {
                        var (raised, touched) = await EnsureDerivedAbsenceAsync(
                            employee, date, sheetsOfEmployee, systemUserId, own, cancellationToken);
                        created += raised;
                        changed |= touched;
                    }
                    else
                    {
                        // No day to punish any more (approved day off, unscheduled,
                        // on leave) — but a manager-issued deduction has no marker,
                        // so only the sweep's own row is ever dropped here.
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
            int? systemUserId,
            List<DeductionCandidate> own,
            CancellationToken cancellationToken)
        {
            var anchored = own.FirstOrDefault(c => c.AttendanceRecordId == record.Id);
            if (anchored is not null)
            {
                // The day already stands — unless it was raised before any salary was
                // on file, in which case the branch can see its real price now.
                return (0, TryRepriceUnpriced(anchored, employee, date, sheets));
            }

            // A derived-absent row for the same day gets anchored to the record now
            // that the day exists — unless the branch already decided on it.
            var derived = own.FirstOrDefault(c =>
                c.AttendanceRecordId is null && PayrollService.ParseAbsenceMarker(c.Note) == date);
            if (derived is not null)
            {
                if (derived.Status != DeductionStatus.Pending)
                {
                    return (0, false);
                }

                derived.AttendanceRecordId = record.Id;
                if (record.Status == AttendanceStatus.Late)
                {
                    var (lateAmount, lateNote) = Price(employee, date, sheets, isLate: true);
                    derived.Reason = "Late arrival";
                    derived.Amount = lateAmount;
                    derived.Note = lateNote;
                }
                else
                {
                    TryRepriceUnpriced(derived, employee, date, sheets);
                }

                unitOfWork.GetRepository<DeductionCandidate, int>().Update(derived);
                return (0, true);
            }

            // A same-day deduction already stands (manager-issued, or raised in an
            // earlier run before the record existed) — never double-charge the day.
            if (own.Any(c => c.AttendanceRecordId is null && PayrollService.CandidateDayOf(c) == date))
            {
                return (0, false);
            }

            if (systemUserId is null)
            {
                return (0, false);
            }

            var isLate = record.Status == AttendanceStatus.Late;
            var (amount, note) = Price(employee, date, sheets, isLate);
            var candidate = new DeductionCandidate
            {
                EmployeeId = employee.Id,
                AttendanceRecordId = record.Id,
                Amount = amount,
                Reason = isLate ? "Late arrival" : "Unapproved absence",
                Note = note,
                IssuedBy = systemUserId.Value,
                IssuedAt = DateTime.UtcNow,
                Status = DeductionStatus.Pending,
            };

            await unitOfWork.GetRepository<DeductionCandidate, int>().AddAsync(candidate, cancellationToken);
            own.Add(candidate);
            await NotifyAsync(employee, date, isLate, amount, cancellationToken);
            return (1, true);
        }

        /// <summary>
        /// A derived absence (scheduled, no punch, no approved day off): raised with
        /// the day marker so it can be found, dropped or anchored later even though
        /// no attendance record backs it.
        /// </summary>
        private async Task<(int Created, bool Touched)> EnsureDerivedAbsenceAsync(
            Employee employee,
            DateOnly date,
            IReadOnlyList<PayrollEntry> sheets,
            int? systemUserId,
            List<DeductionCandidate> own,
            CancellationToken cancellationToken)
        {
            var existing = own.FirstOrDefault(c =>
                c.AttendanceRecordId is null && PayrollService.CandidateDayOf(c) == date);
            if (existing is not null)
            {
                // The day already stands — unless it was raised before any salary was
                // on file, in which case the branch can see its real price now.
                return (0, TryRepriceUnpriced(existing, employee, date, sheets));
            }

            if (systemUserId is null)
            {
                return (0, false);
            }

            var (amount, note) = Price(employee, date, sheets, isLate: false);
            var candidate = new DeductionCandidate
            {
                EmployeeId = employee.Id,
                AttendanceRecordId = null,
                Amount = amount,
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
            DeductionCandidate candidate, Employee employee, DateOnly date, IReadOnlyList<PayrollEntry> sheets)
        {
            if (candidate.Status != DeductionStatus.Pending
                || candidate.Amount != 0
                || candidate.Note is null
                || !candidate.Note.Contains("No salary on file", StringComparison.Ordinal))
            {
                return false;
            }

            var (amount, note) = Price(employee, date, sheets, isLate: candidate.Reason == "Late arrival");
            if (amount <= 0)
            {
                return false;
            }

            candidate.Amount = amount;
            // Keep the row shaped the way it was raised (marker for a derived day).
            candidate.Note = PayrollService.ParseAbsenceMarker(candidate.Note) == date
                ? $"{PayrollService.AbsenceMarker(date)} · {note}"
                : note;
            unitOfWork.GetRepository<DeductionCandidate, int>().Update(candidate);
            return true;
        }

        /// <summary>
        /// Drops the pending deductions the sweep owns for one day: anything carrying
        /// the day's marker, plus anything anchored to that day's record (anchoring is
        /// only ever done by this sweep or by payroll close, which finalises at once).
        /// Manager-issued rows carry neither and survive.
        /// </summary>
        private bool Drop(List<DeductionCandidate> own, DateOnly date, int? recordId)
        {
            var doomed = own.Where(c => c.Status == DeductionStatus.Pending
                && (PayrollService.ParseAbsenceMarker(c.Note) == date
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

        /// <summary>
        /// The money and the note one attendance exception costs: the sheet covering
        /// the day, else the salary history, else nothing to charge yet.
        /// </summary>
        private static (decimal Amount, string Note) Price(
            Employee employee, DateOnly date, IReadOnlyList<PayrollEntry> sheets, bool isLate)
        {
            var (baseSalary, start, end) = SalaryFor(employee, date, sheets);
            var (scheduled, _, late, absent) = PayrollService.AttendanceRates(baseSalary, start, end);
            var amount = isLate ? late : absent;
            if (amount <= 0)
            {
                return (0m, "No salary on file — the branch must price this deduction manually.");
            }

            return (amount, isLate
                ? $"Auto-priced: quarter day (base ÷ {scheduled} scheduled workdays ÷ 4)."
                : $"Auto-priced: {PayrollService.AbsenceDayMultiplier} days (base ÷ {scheduled} scheduled workdays × {PayrollService.AbsenceDayMultiplier}).");
        }

        private static (decimal BaseSalary, DateOnly Start, DateOnly End) SalaryFor(
            Employee employee, DateOnly date, IReadOnlyList<PayrollEntry> sheets)
        {
            var monthStart = new DateOnly(date.Year, date.Month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);

            var sheet = sheets.FirstOrDefault(s =>
                s.BaseSalary > 0 && s.PayrollPeriod is not null
                && s.PayrollPeriod.StartDate <= date && date <= s.PayrollPeriod.EndDate);
            if (sheet is not null)
            {
                return (sheet.BaseSalary, sheet.PayrollPeriod!.StartDate, sheet.PayrollPeriod.EndDate);
            }

            var compensation = employee.Compensations
                .Where(c => c.Amount > 0 && c.EffectiveDate <= date)
                .OrderByDescending(c => c.EffectiveDate)
                .FirstOrDefault();

            return compensation is null ? (0m, monthStart, monthEnd) : (compensation.Amount, monthStart, monthEnd);
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
