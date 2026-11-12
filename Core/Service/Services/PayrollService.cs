using System.Globalization;
using System.Text;
using System.Text.Json;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.AuditModule;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.PayrollModule.Enums;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.SchedulingModule;
using DomainLayer.Models.UserModule;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Payroll;

namespace Service.Services
{
    /// <summary>
    /// Payroll (api-spec-from-ui.md §5.5). Periods are per-gym rows; the UI status
    /// vocabulary (Open | Partially Published | Published | Paid) derives from the
    /// entity lifecycle (Open → Locked on publish, PaidDate → Paid), and money is
    /// always recomputed from BaseSalary + TotalBonuses + OT pay − approved lines so
    /// every mutation echoes consistent totals.
    /// </summary>
    public sealed class PayrollService(
        IUnitOfWork _unitOfWork,
        IAccessControlService _accessControl,
        IUserAccessRepository _userAccess,
        ITeamScopeService _teamScope,
        IAttendanceDeductionSweepService _deductionSweep,
        TimeZoneInfo? attendanceTimeZone = null) : IPayrollService
    {
        // Interpret the shift template's wall-clock window in the organization timezone.
        private readonly TimeZoneInfo _attendanceTimeZone = attendanceTimeZone ?? TimeZoneInfo.Local;
        // ==================================================================
        // Period directory + detail
        // ==================================================================

        public async Task<PayrollPeriodListResponse> GetPeriodsAsync(int? actorUserId, PayrollPeriodListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "payroll.view", cancellationToken);
            var scope = await HrPortalHelpers.ResolveGymScopeAsync(_unitOfWork, _userAccess, actor, query.Gym, cancellationToken);

            var all = (await _unitOfWork.GetRepository<PayrollPeriod, int>()
                .GetAllAsync(new PayrollPeriodScopeSpec(scope, query.Gym), cancellationToken)).ToList();

            var statusFilter = HrPortalHelpers.NullIfBlank(query.Status)?.ToLowerInvariant();
            var filtered = statusFilter is null
                ? all
                : all.Where(p => DisplayStatus(p).ToLowerInvariant() == statusFilter).ToList();

            var page = Math.Max(query.Page, 1);
            var pageSize = HrPortalHelpers.NormalizePageSize(query.PageSize);
            var pageRows = filtered.Skip((page - 1) * pageSize).Take(pageSize).ToList();

            var entries = pageRows.Count == 0
                ? []
                : (await _unitOfWork.GetRepository<PayrollEntry, int>()
                    .GetAllAsync(new PayrollEntriesByPeriodsSpec(pageRows.Select(p => p.Id).ToArray()), cancellationToken)).ToList();
            var grouped = entries.ToLookup(e => e.PayrollPeriodId);

            return new PayrollPeriodListResponse
            {
                Items = pageRows.Select(p =>
                {
                    var item = BuildPeriodItem(p, grouped[p.Id].ToList());
                    return item;
                }).ToList(),
                Page = page,
                PageSize = pageSize,
                Total = filtered.Count,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(filtered.Count / (double)pageSize) : 0,
            };
        }

        public async Task<PayrollPeriodDetailResponse> GetPeriodAsync(int? actorUserId, int periodId, int? gym, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "payroll.view", cancellationToken);

            var period = await _unitOfWork.GetRepository<PayrollPeriod, int>().GetByIdAsync(periodId, cancellationToken)
                ?? throw new NotFoundException("Payroll period not found.");
            if (gym is int gymFilter && gymFilter != period.GymId)
            {
                throw new NotFoundException("Payroll period not found.");
            }

            await HrPortalHelpers.ResolveGymAsync(_unitOfWork, _userAccess, actor, period.GymId, null, cancellationToken);

            var entries = (await _unitOfWork.GetRepository<PayrollEntry, int>()
                    .GetAllAsync(new PayrollEntriesByPeriodSpec(period.Id, withEmployee: true), cancellationToken))
                .OrderBy(e => e.Employee.FullName, StringComparer.OrdinalIgnoreCase)
                .ToList();

            // The settlement sheet's evidence column (work-days ledger + punch proof)
            // rides with the detail so the page renders from a single call; the cover
            // summary (unscheduled-attendance days) rides along for the same reason.
            var evidence = await LoadAttendanceEvidenceAsync(period, entries, cancellationToken);

            // The day log is the authority on which days may be charged, so the pending
            // deduction lines are reconciled against it before the sheet is rendered.
            var candidateDays = await SyncPendingDeductionLinesAsync(period, entries, evidence, cancellationToken);

            var summaries = await LoadAttendanceSummariesAsync(
                _unitOfWork, period, entries.Select(e => e.EmployeeId).ToList(), cancellationToken);
            var data = BuildPeriodDetail(period, entries, evidence, summaries, candidateDays);
            return new PayrollPeriodDetailResponse { Data = data };
        }

        // ==================================================================
        // Current-period provisioning
        // ==================================================================

        public async Task<PayrollEnsureResponse> EnsureCurrentPeriodAsync(
            int? actorUserId, int gymId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "payroll.edit", gymId, cancellationToken);
            await HrPortalHelpers.ResolveGymAsync(_unitOfWork, _userAccess, actor, gymId, null, cancellationToken);

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var start = new DateOnly(today.Year, today.Month, 1);
            var end = start.AddMonths(1).AddDays(-1);

            // Every status: the run this call may have opened is Open, and the
            // per-gym spec used elsewhere deliberately hides those.
            var periods = await _unitOfWork.GetRepository<PayrollPeriod, int>()
                .GetAllAsync(new PayrollPeriodScopeSpec([gymId], gymId), cancellationToken);
            var period = periods.FirstOrDefault(p => p.StartDate == start);

            var created = false;
            if (period is null)
            {
                period = new PayrollPeriod
                {
                    GymId = gymId,
                    StartDate = start,
                    EndDate = end,
                    Status = PayrollPeriodStatus.Open,
                };
                await _unitOfWork.GetRepository<PayrollPeriod, int>().AddAsync(period, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
                created = true;
            }

            var response = new PayrollEnsureResponse
            {
                PeriodId = period.Id,
                Period = PeriodLabel(period),
                Created = created,
                Open = period.Status == PayrollPeriodStatus.Open && period.PaidDate is null,
            };

            // Published/paid runs are historical records — new staff must not alter them.
            if (!response.Open)
            {
                return response;
            }

            var entrants = await _unitOfWork.GetRepository<PayrollEntry, int>()
                .GetAllAsync(new PayrollEntriesByPeriodSpec(period.Id, withEmployee: false), cancellationToken);
            var covered = entrants.Select(e => e.EmployeeId).ToHashSet();

            var employees = (await _unitOfWork.GetRepository<Employee, int>()
                    .GetAllAsync(new EmployeesByGymSpec(gymId), cancellationToken))
                .Where(e => e.Status == EmployeeStatus.Active && !covered.Contains(e.Id))
                .ToList();

            if (employees.Count == 0)
            {
                return response;
            }

            var attendance = await _unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceByEmployeesRangeSpec(employees.Select(e => e.Id).ToArray(), start, end), cancellationToken);
            var daysByEmployee = attendance
                .Where(r => r.CheckInTime is not null)
                .GroupBy(r => r.EmployeeId)
                .ToDictionary(g => g.Key, g => g.Count());

            var added = 0;
            // The policy lives on the gym; the period may be brand new and carry no navigation.
            var gym = await _unitOfWork.GetRepository<Gym, int>().GetByIdAsync(gymId, cancellationToken);
            foreach (var employee in employees)
            {
                var compensation = await _unitOfWork.GetRepository<Compensation, int>()
                    .GetByIdAsync(new LatestCompensationSpec(employee.Id), cancellationToken);

                var entry = new PayrollEntry
                {
                    PayrollPeriodId = period.Id,
                    EmployeeId = employee.Id,
                    BaseSalary = BaseWithRaises(
                        compensation?.Amount ?? 0m,
                        employee.HireDate,
                        period.EndDate,
                        gym?.AnnualIncreasePercent),
                    DaysWorked = daysByEmployee.GetValueOrDefault(employee.Id),
                    OvertimeHours = 0m,
                    TotalBonuses = 0m,
                    Status = "Draft",
                };
                SyncTotals(entry);
                await _unitOfWork.GetRepository<PayrollEntry, int>().AddAsync(entry, cancellationToken);
                added++;
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            response.EntriesAdded = added;
            return response;
        }

        // ==================================================================
        // Settlement actions
        // ==================================================================

        public async Task<EntryTotalsResponse> UpdateBonusAsync(int? actorUserId, int periodId, int employeeId, UpdateBonusRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "payroll.edit", cancellationToken);
            var (_, entry) = await LoadEntryAsync(actor, periodId, employeeId, requireOpen: true, cancellationToken);

            var bonus = request.Bonus ?? throw new BadRequestException("Bonus is required.");
            if (bonus < 0)
            {
                throw new BadRequestException("Bonus cannot be negative.");
            }

            entry.TotalBonuses = bonus;
            SyncTotals(entry);
            _unitOfWork.GetRepository<PayrollEntry, int>().Update(entry);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new EntryTotalsResponse
            {
                Data = new EntryTotalsData
                {
                    EmployeeId = entry.EmployeeId,
                    Bonus = entry.TotalBonuses,
                    Gross = GrossOf(entry),
                    Deductions = ApprovedDeductionsOf(entry),
                    Net = NetOf(entry),
                },
            };
        }

        public async Task<EntryTotalsResponse> UpdateAttendanceAsync(
            int? actorUserId, int periodId, int employeeId, UpdatePayrollAttendanceRequest request,
            CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "payroll.edit", cancellationToken);
            var (_, entry) = await LoadEntryAsync(actor, periodId, employeeId, requireOpen: true, cancellationToken);

            if (request.DaysAttended < 0 || request.WeeklyOffs < 0 || request.ApprovedLeaves < 0 ||
                request.LateArrivals < 0 || request.UnexcusedAbsences < 0 || request.OvertimeHours < 0)
            {
                throw new BadRequestException("Attendance values cannot be negative.");
            }

            entry.DaysWorked = request.DaysAttended;
            entry.OvertimeHours = Math.Round(request.OvertimeHours, 2);
            entry.WeeklyOffsOverride = request.WeeklyOffs;
            entry.ApprovedLeavesOverride = request.ApprovedLeaves;
            entry.LateArrivalsOverride = request.LateArrivals;
            entry.UnexcusedAbsencesOverride = request.UnexcusedAbsences;
            entry.AttendanceAdjustedAt = DateTime.UtcNow;
            entry.AttendanceAdjustedBy = actor.Id;

            // Overtime feeds the gross, so the money has to follow the correction.
            SyncTotals(entry);
            _unitOfWork.GetRepository<PayrollEntry, int>().Update(entry);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new EntryTotalsResponse
            {
                Data = new EntryTotalsData
                {
                    EmployeeId = entry.EmployeeId,
                    Bonus = entry.TotalBonuses,
                    Gross = GrossOf(entry),
                    Deductions = ApprovedDeductionsOf(entry),
                    Net = NetOf(entry),
                },
            };
        }

        public async Task<CreateDeductionResponse> AddDeductionAsync(int? actorUserId, int periodId, int employeeId, CreateDeductionRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "payroll.edit", cancellationToken);
            var (_, entry) = await LoadEntryAsync(actor, periodId, employeeId, requireOpen: true, cancellationToken);

            var reason = HrPortalHelpers.NullIfBlank(request.Reason)
                ?? throw new BadRequestException("Reason is required.");
            if (request.Amount is not decimal amount || amount <= 0)
            {
                throw new BadRequestException("Amount must be greater than zero.");
            }

            var source = HrPortalHelpers.NullIfBlank(request.Source)?.ToLowerInvariant();
            if (source is not ("manager" or "biometric"))
            {
                throw new BadRequestException("Source must be \"manager\" or \"biometric\".");
            }

            var line = new PayrollEntryLineItem
            {
                PayrollEntryId = entry.Id,
                Type = "Deduction",
                Label = reason,
                EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow),
                Amount = amount,
                Reason = reason,
                Source = source,
                Status = "Pending",
            };
            await _unitOfWork.GetRepository<PayrollEntryLineItem, int>().AddAsync(line, cancellationToken);

            SyncTotals(entry);
            _unitOfWork.GetRepository<PayrollEntry, int>().Update(entry);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var mapped = MapLine(line);
            return new CreateDeductionResponse
            {
                Data = new CreateDeductionData
                {
                    Id = mapped.Id,
                    Date = mapped.Date,
                    Label = mapped.Label,
                    Reason = mapped.Reason,
                    Source = mapped.Source,
                    Amount = mapped.Amount,
                    Status = mapped.Status,
                    AttendanceRef = mapped.AttendanceRef,
                    RequestId = mapped.RequestId,
                    Entry = BuildEntrySummary(entry),
                },
            };
        }

        public async Task<RemoveDeductionResponse> RemoveDeductionAsync(int? actorUserId, int periodId, int employeeId, int lineId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "payroll.edit", cancellationToken);
            var (_, entry) = await LoadEntryAsync(actor, periodId, employeeId, requireOpen: true, cancellationToken);

            var line = entry.LineItems.FirstOrDefault(l => l.Id == lineId)
                ?? throw new BadRequestException("Deduction line not found on this sheet.");

            // A line raised from an attendance candidate takes the candidate with it: a
            // removed row must not be re-materialized on the next sheet load.
            if (line.DeductionCandidateId is int candidateId)
            {
                var candidate = await _unitOfWork.GetRepository<DeductionCandidate, int>()
                    .GetByIdAsync(new DeductionCandidateByIdSpec(candidateId), cancellationToken);
                if (candidate is not null)
                {
                    candidate.Status = DeductionStatus.Rejected;
                    candidate.ReviewedBy = actor.Id;
                    candidate.ReviewedAt = DateTime.UtcNow;
                    _unitOfWork.GetRepository<DeductionCandidate, int>().Update(candidate);
                }
            }

            _unitOfWork.GetRepository<PayrollEntryLineItem, int>().Remove(line);
            entry.LineItems.Remove(line);
            SyncTotals(entry);
            _unitOfWork.GetRepository<PayrollEntry, int>().Update(entry);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new RemoveDeductionResponse
            {
                Data = new RemoveDeductionData
                {
                    Id = lineId,
                    Entry = BuildEntrySummary(entry),
                },
            };
        }

        /// <summary>
        /// Raises every open absence/late of the period as a Pending deduction line, so the
        /// sheet prices the month as soon as it opens instead of only on close. Idempotent:
        /// applied candidates and days that already carry a line are skipped, and an
        /// untouched Pending line is dropped once its day stops being chargeable.
        /// </summary>
        private async Task<Dictionary<int, decimal>> SyncPendingDeductionLinesAsync(
            PayrollPeriod period,
            IReadOnlyList<PayrollEntry> entries,
            IReadOnlyDictionary<int, PayrollAttendanceItem> evidence,
            CancellationToken cancellationToken)
        {
            var daysByCandidate = new Dictionary<int, decimal>();

            // A locked run is finalized for payment: its lines are frozen with the sheet.
            if (period.Status is PayrollPeriodStatus.Locked)
            {
                return daysByCandidate;
            }

            var openEntries = entries
                .Where(e => !string.Equals(e.Status, "Locked", StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (openEntries.Count == 0)
            {
                return daysByCandidate;
            }

            await _deductionSweep.SweepAsync(
                openEntries.Select(e => e.EmployeeId).ToList(), period.StartDate, period.EndDate, cancellationToken);

            var changed = false;
            foreach (var entry in openEntries)
            {
                // Only an absence or a late arrival may be charged for that employee.
                var deductible = evidence.TryGetValue(entry.EmployeeId, out var attendance)
                    ? attendance.Days
                        .Where(d => d.Kind is "Absent" or "Late")
                        .Select(d => d.Date)
                        .ToHashSet()
                    : null;

                var (entryChanged, entryDays) = await MaterializeCandidatesAsync(entry, period, deductible, cancellationToken);
                changed |= entryChanged;
                foreach (var pair in entryDays)
                {
                    daysByCandidate[pair.Key] = pair.Value;
                }
            }

            if (changed)
            {
                foreach (var entry in openEntries)
                {
                    SyncTotals(entry);
                    _unitOfWork.GetRepository<PayrollEntry, int>().Update(entry);
                }

                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }

            return daysByCandidate;
        }

        /// <summary>
        /// Copies the employee's still-open candidates into Pending lines. Rejected
        /// candidates are final and never re-materialized; a day that already carries a
        /// line is never charged twice.
        /// </summary>
        private async Task<(bool Changed, Dictionary<int, decimal> DaysByCandidate)> MaterializeCandidatesAsync(
            PayrollEntry entry,
            PayrollPeriod period,
            IReadOnlySet<DateOnly>? deductibleDays,
            CancellationToken cancellationToken)
        {
            var candidates = (await _unitOfWork.GetRepository<DeductionCandidate, int>()
                    .GetAllAsync(new DeductionCandidatesByEmployeesSpec([entry.EmployeeId]), cancellationToken))
                .Where(c => CandidateDayOf(c) >= period.StartDate && CandidateDayOf(c) <= period.EndDate)
                .ToList();
            var daysByCandidate = candidates.ToDictionary(c => c.Id, c => c.DeductionDays);
            if (candidates.Count == 0)
            {
                return (false, daysByCandidate);
            }

            var lines = entry.LineItems
                .Where(l => l.Type.Equals("Deduction", StringComparison.OrdinalIgnoreCase))
                .ToList();
            var appliedCandidateIds = lines
                .Where(l => l.DeductionCandidateId is not null)
                .Select(l => l.DeductionCandidateId!.Value)
                .ToHashSet();
            var linesByCandidate = lines
                .Where(l => l.DeductionCandidateId is not null)
                .ToDictionary(l => l.DeductionCandidateId!.Value);
            var takenDays = lines.Select(l => l.EffectiveDate).ToHashSet();

            var changed = false;

            // A day that stopped being an absence (the punch was corrected, the day turned
            // into a weekly off) has no candidate left: its untouched Pending line must go
            // with it, or the sheet would charge a day the employee did not miss.
            var liveCandidateIds = candidates
                .Where(c => c.Status != DeductionStatus.Rejected)
                .Select(c => c.Id)
                .ToHashSet();
            foreach (var orphan in lines
                .Where(l => l.DeductionCandidateId is int candidateId
                    && !liveCandidateIds.Contains(candidateId)
                    && string.Equals(l.Status, "Pending", StringComparison.OrdinalIgnoreCase))
                .ToList())
            {
                _unitOfWork.GetRepository<PayrollEntryLineItem, int>().Remove(orphan);
                entry.LineItems.Remove(orphan);
                appliedCandidateIds.Remove(orphan.DeductionCandidateId!.Value);
                takenDays.Remove(orphan.EffectiveDate);
                changed = true;
            }

            // Same for a pending line whose day the attendance log no longer charges
            // (e.g. it turned out to be a weekly off): the employee never owed it.
            if (deductibleDays is not null)
            {
                foreach (var stale in lines
                    .Where(l => l.DeductionCandidateId is not null
                        && !deductibleDays.Contains(l.EffectiveDate)
                        && string.Equals(l.Status, "Pending", StringComparison.OrdinalIgnoreCase))
                    .ToList())
                {
                    _unitOfWork.GetRepository<PayrollEntryLineItem, int>().Remove(stale);
                    entry.LineItems.Remove(stale);
                    appliedCandidateIds.Remove(stale.DeductionCandidateId!.Value);
                    takenDays.Remove(stale.EffectiveDate);
                    changed = true;
                }
            }

            foreach (var candidate in candidates)
            {
                if (candidate.Status == DeductionStatus.Rejected)
                {
                    continue;
                }

                if (appliedCandidateIds.Contains(candidate.Id))
                {
                    // The price list may have moved under a line that is still waiting
                    // for HR: follow the candidate so the two never disagree.
                    if (linesByCandidate.TryGetValue(candidate.Id, out var existing)
                        && string.Equals(existing.Status, "Pending", StringComparison.OrdinalIgnoreCase)
                        && existing.Amount != candidate.Amount)
                    {
                        existing.Amount = candidate.Amount;
                        existing.Reason = StripAbsenceMarker(candidate.Note) ?? candidate.Reason;
                        _unitOfWork.GetRepository<PayrollEntryLineItem, int>().Update(existing);
                        changed = true;
                    }

                    continue;
                }

                var day = CandidateDayOf(candidate);
                if (takenDays.Contains(day))
                {
                    continue;
                }

                // The attendance log decides what is chargeable: a candidate for a day the
                // log no longer calls an absence or a late arrival is never turned into a line.
                if (deductibleDays is not null && !deductibleDays.Contains(day))
                {
                    continue;
                }

                var line = new PayrollEntryLineItem
                {
                    PayrollEntryId = entry.Id,
                    Type = "Deduction",
                    Label = candidate.Reason,
                    EffectiveDate = day,
                    // Deduction lines carry a positive amount (see AddDeductionAsync) —
                    // the totals subtract them.
                    Amount = candidate.Amount,
                    // The sweep's dedupe marker is bookkeeping — never payslip text.
                    Reason = StripAbsenceMarker(candidate.Note) ?? candidate.Reason,
                    Source = candidate.IsSystemGenerated ? "biometric" : "manager",
                    AttendanceRecordId = candidate.AttendanceRecordId,
                    DeductionCandidateId = candidate.Id,
                    Status = "Pending",
                };

                await _unitOfWork.GetRepository<PayrollEntryLineItem, int>().AddAsync(line, cancellationToken);
                // EF's fix-up may already have pushed the row into the tracked entry's
                // collection — adding it again would list every day twice.
                if (!entry.LineItems.Contains(line))
                {
                    entry.LineItems.Add(line);
                }

                appliedCandidateIds.Add(candidate.Id);
                takenDays.Add(day);
                changed = true;
            }

            return (changed, daysByCandidate);
        }

        public async Task<CloseEntryResponse> CloseEntryAsync(int? actorUserId, int periodId, int employeeId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "payroll.edit", cancellationToken);
            var (_, entry) = await LoadEntryAsync(actor, periodId, employeeId, requireOpen: true, cancellationToken);
            var period = await _unitOfWork.GetRepository<PayrollPeriod, int>().GetByIdAsync(periodId, cancellationToken)
                ?? throw new NotFoundException("Payroll period not found.");

            // Reconcile first through the one attendance → deduction path: the same
            // sweep the branch tab and dashboards run, so a month closed without
            // opening the deductions tab still carries every late/absence of the
            // period (idempotent per employee/day).
            await _deductionSweep.SweepAsync([entry.EmployeeId], period.StartDate, period.EndDate, cancellationToken);

            // Charge only what the attendance log itself calls an absence or a late arrival.
            var closingEvidence = await LoadAttendanceEvidenceAsync(period, [entry], cancellationToken);
            var closingDeductible = closingEvidence.TryGetValue(entry.EmployeeId, out var closingAttendance)
                ? closingAttendance.Days.Where(d => d.Kind is "Absent" or "Late").Select(d => d.Date).ToHashSet()
                : null;
            await MaterializeCandidatesAsync(entry, period, closingDeductible, cancellationToken);

            // Closing settles the branch sheet; the pending deduction lines stay in
            // HR's review queue and publishing waits for their decision.
            entry.Status = "Reviewed";
            entry.ReviewedAt = DateTime.UtcNow;
            SyncTotals(entry);
            _unitOfWork.GetRepository<PayrollEntry, int>().Update(entry);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new CloseEntryResponse
            {
                Data = new CloseEntryData
                {
                    EmployeeId = entry.EmployeeId,
                    Status = entry.Status,
                    Reviewed = true,
                    ReviewedAt = entry.ReviewedAt,
                    Gross = GrossOf(entry),
                    Deductions = ApprovedDeductionsOf(entry),
                    Net = NetOf(entry),
                },
            };
        }

        public async Task<ReopenEntryResponse> ReopenEntryAsync(int? actorUserId, int periodId, int employeeId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "payroll.edit", cancellationToken);
            var (_, entry) = await LoadEntryAsync(actor, periodId, employeeId, requireOpen: true, cancellationToken);

            entry.Status = "Draft";
            entry.ReviewedAt = null;
            SyncTotals(entry);
            _unitOfWork.GetRepository<PayrollEntry, int>().Update(entry);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new ReopenEntryResponse
            {
                Data = new ReopenEntryData
                {
                    EmployeeId = entry.EmployeeId,
                    Status = entry.Status,
                    Reviewed = false,
                },
            };
        }

        // ==================================================================
        // Publish & lock
        // ==================================================================

        public async Task<ApprovePeriodResponse> ApprovePeriodAsync(int? actorUserId, int periodId, ApprovePeriodRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "payroll.approve", cancellationToken);

            var period = await _unitOfWork.GetRepository<PayrollPeriod, int>().GetByIdAsync(periodId, cancellationToken)
                ?? throw new NotFoundException("Payroll period not found.");

            var gym = await HrPortalHelpers.ResolveGymAsync(_unitOfWork, _userAccess, actor, request.GymId, request.Gym, cancellationToken);
            if (gym.Id != period.GymId)
            {
                throw new BadRequestException("This period belongs to a different branch.");
            }

            if (IsLocked(period))
            {
                throw new BadRequestException("This period is already published.");
            }

            var entries = (await _unitOfWork.GetRepository<PayrollEntry, int>()
                .GetAllAsync(new PayrollEntriesByPeriodSpec(period.Id, withEmployee: false), cancellationToken)).ToList();
            if (entries.Count == 0)
            {
                throw new BadRequestException("There are no payroll entries to publish.");
            }

            var unsettled = entries.Count(e => e.Status != "Reviewed");
            if (unsettled > 0)
            {
                throw new BadRequestException($"All accounts must be settled before publishing ({unsettled} still open).");
            }

            // Closing a sheet hands its deductions to HR as Pending lines; publishing
            // must wait until HR has made the final call on every one of them.
            var pendingDeductions = entries
                .SelectMany(e => e.LineItems)
                .Count(l => l.Type.Equals("Deduction", StringComparison.OrdinalIgnoreCase) && l.Status == "Pending");
            if (pendingDeductions > 0)
            {
                throw new BadRequestException(
                    $"HR must review {pendingDeductions} pending deduction line(s) before publishing.");
            }

            period.Status = PayrollPeriodStatus.Locked;
            period.ApprovedBy = actor.Id;
            period.ApprovedAt = DateTime.UtcNow;
            _unitOfWork.GetRepository<PayrollPeriod, int>().Update(period);

            foreach (var entry in entries)
            {
                entry.Status = "Locked";
                _unitOfWork.GetRepository<PayrollEntry, int>().Update(entry);
            }

            await _unitOfWork.GetRepository<AuditLog, int>().AddAsync(new AuditLog
            {
                UserId = actor.Id,
                Action = "Payroll Published",
                EntityType = "PayrollPeriod",
                EntityId = period.Id,
                GymId = period.GymId,
                NewValues = JsonSerializer.Serialize(new
                {
                    period = PeriodLabel(period),
                    gym = gym.Name,
                    employees = entries.Count,
                    net = entries.Sum(NetOf).ToString("0.##", CultureInfo.InvariantCulture),
                }),
            }, cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new ApprovePeriodResponse
            {
                Data = new ApprovePeriodData
                {
                    Id = period.Id,
                    Status = DisplayStatus(period),
                    Locked = true,
                    PublishedGyms = [gym.Name],
                    Message = "Branch published & locked.",
                },
            };
        }

        // ==================================================================
        // Deduction candidates
        // ==================================================================

        public async Task<DeductionCandidateListResponse> GetDeductionCandidatesAsync(int? actorUserId, DeductionCandidateListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await EnsureAnyPermissionAsync(actor, ["payroll.view", "payroll.edit"], cancellationToken);
            var scope = await HrPortalHelpers.ResolveGymScopeAsync(_unitOfWork, _userAccess, actor, query.Gym, cancellationToken);

            int? periodId = null;
            if (HrPortalHelpers.NullIfBlank(query.Period) is string periodFilter)
            {
                if (int.TryParse(periodFilter, out var parsedId))
                {
                    periodId = parsedId;
                }
                else
                {
                    var periods = await _unitOfWork.GetRepository<PayrollPeriod, int>()
                        .GetAllAsync(new PayrollPeriodScopeSpec(scope, query.Gym), cancellationToken);
                    var match = periods.FirstOrDefault(p =>
                        string.Equals(PeriodLabel(p), periodFilter, StringComparison.OrdinalIgnoreCase));
                    if (match is null)
                    {
                        return EmptyCandidates(query);
                    }

                    periodId = match.Id;
                }
            }

            var status = NormalizeLineStatus(query.Status);
            var page = Math.Max(query.Page, 1);
            var pageSize = HrPortalHelpers.NormalizePageSize(query.PageSize);
            var skip = (page - 1) * pageSize;

            var total = await _unitOfWork.GetRepository<PayrollEntryLineItem, int>()
                .CountAsync(new DeductionLinesSpec(scope, query.Gym, periodId, status, 0, 0), cancellationToken);
            var rows = (await _unitOfWork.GetRepository<PayrollEntryLineItem, int>()
                .GetAllAsync(new DeductionLinesSpec(scope, query.Gym, periodId, status, skip, pageSize), cancellationToken)).ToList();

            return new DeductionCandidateListResponse
            {
                Items = rows.Select(MapCandidate).ToList(),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(total / (double)pageSize) : 0,
            };
        }

        public async Task<ReviewDeductionResponse> ReviewDeductionAsync(int? actorUserId, int lineId, ReviewDeductionRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "payroll.edit", cancellationToken);

            var line = await _unitOfWork.GetRepository<PayrollEntryLineItem, int>()
                .GetByIdAsync(new DeductionLineByIdSpec(lineId), cancellationToken)
                ?? throw new NotFoundException("Deduction line not found.");

            var period = line.PayrollEntry.PayrollPeriod;
            await HrPortalHelpers.ResolveGymAsync(_unitOfWork, _userAccess, actor, period.GymId, null, cancellationToken);
            if (IsLocked(period))
            {
                throw new BadRequestException("This payroll period is locked.");
            }

            var decision = HrPortalHelpers.NullIfBlank(request.Decision)?.ToLowerInvariant();
            if (decision is not null and not ("accepted" or "rejected"))
            {
                throw new BadRequestException("Decision must be \"Accepted\" or \"Rejected\".");
            }

            if (decision is null && request.Days is null && request.Amount is null)
            {
                throw new BadRequestException("A decision, a day count or an amount is required.");
            }

            // A decision-less call only re-prices the line (the branch may still be
            // waiting on its approval): the status it already carries stays.
            if (decision is not null)
            {
                line.Status = decision == "accepted" ? "Accepted" : "Rejected";
            }

            var source = await FindCandidateForLineAsync(line, cancellationToken);

            // HR thinks in days — an absence is 3, a late arrival a quarter, half or one
            // hour — so a day edit is converted with the price the line already carries.
            if (request.Days is { } newDays)
            {
                if (newDays <= 0)
                {
                    throw new BadRequestException("The deduction days must be greater than zero.");
                }

                var previousDays = source?.DeductionDays;
                if (previousDays is null or <= 0)
                {
                    throw new BadRequestException("This line has no day basis — set the amount instead.");
                }

                line.Amount = Math.Round(line.Amount / previousDays.Value * newDays, 2);
                source!.DeductionDays = newDays;
            }

            // HR's end-of-month re-price: the review may carry the amount the sheet
            // should actually charge, in which case the line and the candidate it
            // materialized from both move to it before the totals recompute.
            if (request.Amount is { } revised)
            {
                if (revised <= 0)
                {
                    throw new BadRequestException("The deduction amount must be greater than zero.");
                }

                line.Amount = revised;
            }

            line.ReviewedBy = actor.Id;
            line.ReviewedAt = DateTime.UtcNow;

            // The candidate is the employee-facing truth: only an Approved candidate
            // is shown as an applied deduction, and a Rejected one is final (its day
            // can never be re-issued).
            if (source is not null)
            {
                source.Amount = line.Amount;
                if (decision is not null)
                {
                    source.Status = line.Status == "Accepted" ? DeductionStatus.Approved : DeductionStatus.Rejected;
                }
                // A reviewed row is priced by the branch: the attendance sweep must not
                // put its own day count back over this one.
                source.ReviewedBy = actor.Id;
                source.ReviewedAt = line.ReviewedAt;
                _unitOfWork.GetRepository<DeductionCandidate, int>().Update(source);
            }

            SyncTotals(line.PayrollEntry);
            _unitOfWork.GetRepository<PayrollEntry, int>().Update(line.PayrollEntry);
            _unitOfWork.GetRepository<PayrollEntryLineItem, int>().Update(line);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var entry = line.PayrollEntry;
            return new ReviewDeductionResponse
            {
                Data = new ReviewDeductionData
                {
                    Id = line.Id,
                    Status = line.Status,
                    Amount = line.Amount,
                    Entry = new ReviewEntrySummary
                    {
                        EmployeeId = entry.EmployeeId,
                        Gross = GrossOf(entry),
                        Deductions = ApprovedDeductionsOf(entry),
                        Net = NetOf(entry),
                        PendingCount = PendingCountOf(entry),
                    },
                },
            };
        }

        /// <summary>
        /// Resolves the candidate a line materialized from: the explicit link first
        /// (new rows), then the old day+amount+record match so legacy sheets keep
        /// their employee-facing trail in sync.
        /// </summary>
        private async Task<DeductionCandidate?> FindCandidateForLineAsync(
            PayrollEntryLineItem line, CancellationToken cancellationToken)
        {
            if (line.DeductionCandidateId is int candidateId)
            {
                return await _unitOfWork.GetRepository<DeductionCandidate, int>()
                    .GetByIdAsync(new DeductionCandidateByIdSpec(candidateId), cancellationToken);
            }

            var candidates = await _unitOfWork.GetRepository<DeductionCandidate, int>()
                .GetAllAsync(new DeductionCandidatesByEmployeesSpec([line.PayrollEntry.EmployeeId]), cancellationToken);

            return candidates.FirstOrDefault(c => CandidateDayOf(c) == line.EffectiveDate
                    && c.Amount == line.Amount
                    && (line.AttendanceRecordId is null || c.AttendanceRecordId == line.AttendanceRecordId))
                ?? candidates.FirstOrDefault(c => CandidateDayOf(c) == line.EffectiveDate
                    && c.Status is not (DeductionStatus.Rejected or DeductionStatus.Approved)
                    && (line.AttendanceRecordId is null || c.AttendanceRecordId == line.AttendanceRecordId));
        }

        // ==================================================================
        // Payslip, export, history, punch audit
        // ==================================================================

        public async Task<PayslipResponse> GetPayslipAsync(int? actorUserId, int periodId, int employeeId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            // The slip's owner reads his own payslip; anyone else needs payroll.view
            // (the HR payroll runs use the same endpoint).
            if (!await IsOwnEmployeeAsync(actor.Id, employeeId, cancellationToken))
            {
                await _accessControl.EnsurePermissionAsync(actor.Id, "payroll.view", cancellationToken);
            }

            var period = await _unitOfWork.GetRepository<PayrollPeriod, int>().GetByIdAsync(periodId, cancellationToken)
                ?? throw new NotFoundException("Payroll period not found.");
            await HrPortalHelpers.ResolveGymAsync(_unitOfWork, _userAccess, actor, period.GymId, null, cancellationToken);

            var entry = await _unitOfWork.GetRepository<PayrollEntry, int>()
                .GetByIdAsync(new PayrollEntryForEmployeeSpec(period.Id, employeeId), cancellationToken)
                ?? throw new NotFoundException("Payroll entry not found.");

            return new PayslipResponse
            {
                Data = BuildPayslip(
                    entry,
                    summary: (await LoadAttendanceSummariesAsync(_unitOfWork, period, [employeeId], cancellationToken))
                        .GetValueOrDefault(employeeId)),
            };
        }

        /// <summary>
        /// The mock §8 payslip card (period, money lines, deductions with statuses)
        /// shared by the HR preview and the portal's self-service payslip.
        /// </summary>
        internal static PayslipData BuildPayslip(
            PayrollEntry entry, bool onlyApproved = false, PayrollAttendanceSummary? summary = null)
        {
            var gross = GrossOf(entry);
            var approved = ApprovedDeductionsOf(entry);
            var coverDays = summary?.CoverDays ?? 0;
            // Mock §8's "Annual Increase (10%)" card — the gym policy's raise slice
            // displayed alongside base salary (display info; net stays gross − lines).
            var annualPercent = entry.PayrollPeriod.Gym.AnnualIncreasePercent;

            return new PayslipData
            {
                Period = PeriodLabel(entry.PayrollPeriod),
                Gym = entry.PayrollPeriod.Gym.Name,
                AnnualIncreasePercent = annualPercent,
                AnnualIncrease = annualPercent is > 0 && entry.BaseSalary > 0
                    ? Math.Round(entry.BaseSalary * annualPercent.Value / 100m, 2)
                    : 0m,
                Employee = new PayslipEmployeeData
                {
                    EmployeeId = entry.EmployeeId,
                    Name = entry.Employee.FullName,
                    Position = entry.Employee.Position?.Title ?? "None",
                },
                BaseSalary = entry.BaseSalary,
                Overtime = entry.OvertimeHours,
                OvertimePay = OvertimePay(entry),
                Bonus = entry.TotalBonuses,
                Gross = gross,
                Deductions = entry.LineItems
                    .Where(l => l.Type.Equals("Deduction", StringComparison.OrdinalIgnoreCase)
                        && (!onlyApproved || l.Status is "Accepted" or "Approved"))
                    .OrderBy(l => l.EffectiveDate)
                    .ThenBy(l => l.Id)
                    .Select(l => new PayslipDeductionLine
                    {
                        Label = l.Label,
                        Reason = l.Reason,
                        Source = UiSource(l.Source),
                        Amount = l.Amount,
                        Status = l.Status,
                    })
                    .ToList(),
                Net = gross - approved,
                Days = summary is { DaysWorked: > 0 } ? summary.DaysWorked : entry.DaysWorked,
                CoverDays = coverDays,
                ExtraShiftDays = summary?.ExtraShiftDays ?? 0,
                CoverPay = CoverPay(entry, coverDays),
                Status = entry.Status,
            };
        }

        public async Task<(string FileName, byte[] Content)> ExportPeriodAsync(int? actorUserId, int periodId, int? gym, string? format, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "payroll.export", cancellationToken);

            var period = await _unitOfWork.GetRepository<PayrollPeriod, int>().GetByIdAsync(periodId, cancellationToken)
                ?? throw new NotFoundException("Payroll period not found.");

            if (gym is int gymFilter)
            {
                var requested = await HrPortalHelpers.ResolveGymAsync(_unitOfWork, _userAccess, actor, gymFilter, null, cancellationToken);
                if (requested.Id != period.GymId)
                {
                    throw new BadRequestException("This period belongs to a different branch.");
                }
            }
            else
            {
                await HrPortalHelpers.ResolveGymAsync(_unitOfWork, _userAccess, actor, period.GymId, null, cancellationToken);
            }

            var normalizedFormat = HrPortalHelpers.NullIfBlank(format)?.ToLowerInvariant() ?? "csv";
            if (normalizedFormat == "pdf")
            {
                throw new BadRequestException("PDF export is not supported — use format=csv.");
            }

            if (normalizedFormat != "csv")
            {
                throw new BadRequestException($"Unknown export format \"{format}\".");
            }

            var entries = (await _unitOfWork.GetRepository<PayrollEntry, int>()
                    .GetAllAsync(new PayrollEntriesByPeriodSpec(period.Id, withEmployee: true), cancellationToken))
                .OrderBy(e => e.Employee.FullName, StringComparer.OrdinalIgnoreCase)
                .ToList();

            var sb = new StringBuilder();
            sb.AppendLine("Employee,Employee ID,Position,Base Salary,OT Hours,OT Pay,Bonus,Gross,Deductions,Net,Status");
            foreach (var entry in entries)
            {
                sb.Append(Csv(entry.Employee.FullName)).Append(',')
                  .Append(Csv(entry.Employee.EmployeeNumber)).Append(',')
                  .Append(Csv(entry.Employee.Position?.Title ?? "None")).Append(',')
                  .Append(Csv(entry.BaseSalary.ToString("0.##", CultureInfo.InvariantCulture))).Append(',')
                  .Append(Csv(entry.OvertimeHours.ToString("0.##", CultureInfo.InvariantCulture))).Append(',')
                  .Append(Csv(OvertimePay(entry).ToString("0.##", CultureInfo.InvariantCulture))).Append(',')
                  .Append(Csv(entry.TotalBonuses.ToString("0.##", CultureInfo.InvariantCulture))).Append(',')
                  .Append(Csv(GrossOf(entry).ToString("0.##", CultureInfo.InvariantCulture))).Append(',')
                  .Append(Csv(ApprovedDeductionsOf(entry).ToString("0.##", CultureInfo.InvariantCulture))).Append(',')
                  .Append(Csv(NetOf(entry).ToString("0.##", CultureInfo.InvariantCulture))).Append(',')
                  .Append(Csv(entry.Status))
                  .AppendLine();
            }

            var fileName = $"payroll-{Slug(PeriodLabel(period))}-{Slug(period.Gym.Name)}.csv";
            return (fileName, Encoding.UTF8.GetBytes(sb.ToString()));
        }

        public async Task<EmployeePayrollResponse> GetEmployeePayrollAsync(int? actorUserId, int employeeId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);

            var employee = await _unitOfWork.GetRepository<Employee, int>().GetByIdAsync(employeeId, cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            // Payroll visibility model (matrix rows 13/34): the owner reads his own
            // salary history; a Team Leader sees his team members; the Branch Manager
            // of the employee's gym sees them too; everyone else needs payroll.view
            // (HR/HRM hold it; Top Management bypasses). Out-of-scope targets stay
            // concealed behind the generic not-found.
            if (!await IsOwnEmployeeAsync(actor.Id, employeeId, cancellationToken))
            {
                await EnsurePayrollViewerAsync(actor, employee, cancellationToken);
            }

            var scope = await HrPortalHelpers.ResolveGymScopeAsync(_unitOfWork, _userAccess, actor, null, cancellationToken);
            var rows = (await _unitOfWork.GetRepository<PayrollEntry, int>()
                    .GetAllAsync(new PayrollEntriesByEmployeeSpec(employeeId), cancellationToken))
                .Where(e => scope.Length == 0 || scope.Contains(e.PayrollPeriod.GymId))
                .OrderByDescending(e => e.PayrollPeriod.StartDate)
                .ToList();

            var summariesByPeriod = new Dictionary<int, Dictionary<int, PayrollAttendanceSummary>>();
            foreach (var entryPeriod in rows.Select(e => e.PayrollPeriod).DistinctBy(p => p.Id))
            {
                summariesByPeriod[entryPeriod.Id] = await LoadAttendanceSummariesAsync(
                    _unitOfWork, entryPeriod, [employeeId], cancellationToken);
            }

            return new EmployeePayrollResponse
            {
                Items = rows
                    .Select(e => MapEntry(
                        e,
                        PeriodLabel(e.PayrollPeriod),
                        summary: summariesByPeriod[e.PayrollPeriod.Id].GetValueOrDefault(e.EmployeeId)))
                    .ToList(),
            };
        }

        /// <summary>Attendance facts for one employee over a payroll period.</summary>
        internal sealed record PayrollAttendanceSummary(int DaysWorked, int ExtraShiftDays, int CoverDays);

        /// <summary>Cover pay at the daily rate (base ÷ 30) for the approved cover days.</summary>
        private static decimal CoverPay(PayrollEntry entry, int coverDays) =>
            coverDays > 0 && entry.BaseSalary > 0
                ? Math.Round(entry.BaseSalary / DeductionPricing.StandardDays * coverDays, 2)
                : 0m;

        /// <summary>
        /// Days worked, days worked outside the schedule (cover / extra shifts), and
        /// approved cover-day credits for the period — the month-end facts HR reads
        /// before closing a payroll account. One query set for the whole period.
        /// </summary>
        internal static async Task<Dictionary<int, PayrollAttendanceSummary>> LoadAttendanceSummariesAsync(
            IUnitOfWork unitOfWork,
            PayrollPeriod period,
            IReadOnlyCollection<int> employeeIds,
            CancellationToken cancellationToken = default)
        {
            var ids = employeeIds.Distinct().ToArray();
            if (ids.Length == 0)
            {
                return [];
            }

            var records = await unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceRecordsByEmployeeIdsRangeSpec(ids, period.StartDate, period.EndDate), cancellationToken);

            var worked = records
                .Where(r => r.CheckInTime is not null)
                .GroupBy(r => r.EmployeeId)
                .ToDictionary(g => g.Key, g => g.Count());
            // The record pins the shift it was punched against; a null template means
            // the punch happened on a day with no scheduled shift.
            var extra = records
                .Where(r => r.CheckInTime is not null && r.ScheduledShiftTemplateId is null)
                .GroupBy(r => r.EmployeeId)
                .ToDictionary(g => g.Key, g => g.Count());

            var coverRequests = await unitOfWork.GetRepository<EmployeeRequest, int>()
                .GetAllAsync(new ApprovedUnscheduledAttendanceByEmployeeIdsSpec(ids, period.StartDate, period.EndDate), cancellationToken);
            var cover = coverRequests
                .GroupBy(r => r.EmployeeId)
                .ToDictionary(
                    g => g.Key,
                    g => g.Sum(r => r.OvertimeHoursRequested is > 0 ? (int)r.OvertimeHoursRequested.Value : 1));

            return ids.ToDictionary(
                id => id,
                id => new PayrollAttendanceSummary(
                    worked.GetValueOrDefault(id),
                    extra.GetValueOrDefault(id),
                    cover.GetValueOrDefault(id)));
        }

        /// <summary>True when the employee row belongs to the caller's own login.</summary>
        private async Task<bool> IsOwnEmployeeAsync(int actorUserId, int employeeId, CancellationToken cancellationToken)
        {
            var own = await _unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByUserIdSpec(actorUserId), cancellationToken);
            return own is not null && own.Id == employeeId;
        }

        /// <summary>
        /// Non-owner payroll viewers (matrix rows 13/34: TL=team, BM/HR/HRM=gym,
        /// TopManagement unscoped, and payroll.view key holders). Out-of-scope
        /// callers learn nothing (generic not-found, never a 403).
        /// </summary>
        private async Task EnsurePayrollViewerAsync(User actor, Employee employee, CancellationToken cancellationToken)
        {
            if (actor.UserType == DomainLayer.Models.UserModule.Enums.UserType.TopManagement)
            {
                return;
            }

            var roleNames = await _userAccess.GetGymRoleNamesAsync(actor.Id, employee.GymId, cancellationToken);

            // Team Leader: the team he leads in the employee's gym, members only.
            if (roleNames.Contains(Shared.Authorization.RoleNames.TeamLeader, StringComparer.Ordinal))
            {
                var ledTeamId = await _teamScope.GetLedTeamIdAsync(actor.Id, employee.GymId, cancellationToken);
                if (ledTeamId is null || employee.TeamId != ledTeamId.Value)
                {
                    throw new NotFoundException("Employee not found.");
                }

                return;
            }

            // Branch Manager / HR / HR Manager: the whole employee's gym.
            if (roleNames.Any(name => name is Shared.Authorization.RoleNames.BranchManager
                or Shared.Authorization.RoleNames.Hr
                or Shared.Authorization.RoleNames.HrManager))
            {
                return;
            }

            // Any remaining payroll.view holder (e.g. direct grants on HRM/Hr users
            // modeled without per-gym roles).
            var keys = await _userAccess.GetPermissionKeysForGymAsync(actor.Id, employee.GymId, cancellationToken);
            if (!keys.Contains("payroll.view", StringComparer.Ordinal))
            {
                throw new NotFoundException("Employee not found.");
            }
        }

        public async Task<AttendanceRefResponse> GetAttendanceRefAsync(int? actorUserId, string id, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await EnsureAnyPermissionAsync(actor, ["payroll.view", "attendance.view"], cancellationToken);

            var clean = HrPortalHelpers.NullIfBlank(id)
                ?? throw new BadRequestException("Attendance reference is required.");
            var numeric = clean.StartsWith("ATT-", StringComparison.OrdinalIgnoreCase) ? clean[4..] : clean;
            if (!int.TryParse(numeric, out var recordId))
            {
                throw new NotFoundException("Attendance record not found.");
            }

            var record = await _unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetByIdAsync(new AttendanceRecordByIdSpec(recordId), cancellationToken)
                ?? throw new NotFoundException("Attendance record not found.");

            await HrPortalHelpers.ResolveGymScopeAsync(_unitOfWork, _userAccess, actor, record.GymId, cancellationToken);

            return new AttendanceRefResponse
            {
                Data = new AttendanceRefData
                {
                    Id = $"ATT-{record.Id}",
                    Date = record.Date,
                    FirstIn = record.CheckInTime,
                    LastOut = record.CheckOutTime,
                    Device = record.CheckInMethod?.ToString() ?? record.CheckOutMethod?.ToString() ?? "Unknown",
                    Exception = FriendlyAttendance(record.Status),
                    Detail = record.Notes ?? string.Empty,
                },
            };
        }

        // ==================================================================
        // Helpers
        // ==================================================================

        /// <summary>Loads (period, entry) with gym access + open-period enforcement for the settlement writes.</summary>
        private async Task<(PayrollPeriod Period, PayrollEntry Entry)> LoadEntryAsync(
            User actor, int periodId, int employeeId, bool requireOpen, CancellationToken cancellationToken)
        {
            var period = await _unitOfWork.GetRepository<PayrollPeriod, int>().GetByIdAsync(periodId, cancellationToken)
                ?? throw new NotFoundException("Payroll period not found.");

            await HrPortalHelpers.ResolveGymAsync(_unitOfWork, _userAccess, actor, period.GymId, null, cancellationToken);

            if (requireOpen && IsLocked(period))
            {
                throw new BadRequestException("This payroll period is locked.");
            }

            var entry = await _unitOfWork.GetRepository<PayrollEntry, int>()
                .GetByIdAsync(new PayrollEntryForEmployeeSpec(periodId, employeeId), cancellationToken)
                ?? throw new NotFoundException("Payroll entry not found.");

            return (period, entry);
        }

        /// <summary>permission key A **or** key B (spec allows either on two read endpoints).</summary>
        private async Task EnsureAnyPermissionAsync(User actor, string[] keys, CancellationToken cancellationToken)
        {
            foreach (var key in keys)
            {
                try
                {
                    await _accessControl.EnsurePermissionAsync(actor.Id, key, cancellationToken);
                    return;
                }
                catch (UnAuthorizedException)
                {
                    // try the next acceptable key
                }
            }

            throw new UnAuthorizedException("You do not have permission to perform this action.");
        }

        private static bool IsLocked(PayrollPeriod period) =>
            period.Status != PayrollPeriodStatus.Open || period.PaidDate is not null;

        /// <summary>UI status: PaidDate → Paid; Open → Open; Approved/Locked → Published ("Partially Published" only when some-but-not-all sheets are locked).</summary>
        private static string DisplayStatus(PayrollPeriod period, IReadOnlyCollection<PayrollEntry>? entries = null)
        {
            if (period.PaidDate is not null)
            {
                return "Paid";
            }

            if (period.Status == PayrollPeriodStatus.Open)
            {
                return "Open";
            }

            if (entries is { Count: > 0 })
            {
                var lockedCount = entries.Count(e => e.Status == "Locked");
                return lockedCount > 0 && lockedCount < entries.Count ? "Partially Published" : "Published";
            }

            return "Published";
        }

        /// <summary>
        /// Builds the settlement sheet's right-hand evidence column for every entry in
        /// one batch: the six attendance counters the mock prints plus the punch
        /// records behind them (deduction-linked punches first, then the newest ones).
        /// </summary>
        private async Task<Dictionary<int, PayrollAttendanceItem>> LoadAttendanceEvidenceAsync(
            PayrollPeriod period,
            IReadOnlyCollection<PayrollEntry> entries,
            CancellationToken cancellationToken)
        {
            var employeeIds = entries.Select(e => e.EmployeeId).Distinct().ToArray();
            if (employeeIds.Length == 0)
            {
                return [];
            }

            var records = (await _unitOfWork.GetRepository<AttendanceRecord, int>()
                .GetAllAsync(new AttendanceByEmployeesRangeSpec(employeeIds, period.StartDate, period.EndDate), cancellationToken))
                .ToList();

            var approvedLeaves = (await _unitOfWork.GetRepository<DomainLayer.Models.RequestModule.EmployeeRequest, int>()
                    .GetAllAsync(
                        new RequestsByEmployeesSpec(
                            employeeIds,
                            DomainLayer.Models.RequestModule.Enums.RequestStatus.Approved,
                            null,
                            period.StartDate,
                            period.EndDate),
                        cancellationToken))
                // Annual Leave / Sick Leave consume the balance; "Day Off" is the legacy label.
                .Where(r => r.Type is "Annual Leave" or "Day Off" or "Sick Leave")
                .ToList();

            // Cover / extra requests of every outcome: an approved one makes the day a
            // credited cover day, a rejected one is reported to HR as unapproved cover.
            var coverRequests = (await _unitOfWork.GetRepository<DomainLayer.Models.RequestModule.EmployeeRequest, int>()
                    .GetAllAsync(
                        new UnscheduledAttendanceByEmployeeIdsSpec(employeeIds, period.StartDate, period.EndDate),
                        cancellationToken))
                .ToList();

            // Early Leave requests of every outcome: a pending/approved one excuses the
            // departure it asked for; a rejected one (or leaving before the requested
            // time) stays the warning BM and HR were notified about.
            var earlyLeaveRequests = (await _unitOfWork.GetRepository<DomainLayer.Models.RequestModule.EmployeeRequest, int>()
                    .GetAllAsync(
                        new RequestsByEmployeesSpec(employeeIds, null, "Early Leave", period.StartDate, period.EndDate),
                        cancellationToken))
                .ToList();

            var recordsByEmployee = records
                .GroupBy(r => r.EmployeeId)
                .ToDictionary(g => g.Key, g => g.ToList());

            // The schedule is what decides a weekly off: a day with no shift (or an
            // off-template one) is off whether or not he was punched in that day.
            var assignmentsByEmployee = (await _unitOfWork.GetRepository<ShiftAssignment, int>()
                    .GetAllAsync(new ShiftAssignmentsByEmployeeIdsRangeSpec(employeeIds, period.StartDate, period.EndDate), cancellationToken))
                .GroupBy(a => a.EmployeeId)
                .ToDictionary(g => g.Key, g => g.ToDictionary(a => a.Date));

            return entries.ToDictionary(
                e => e.EmployeeId,
                e =>
                {
                    var rows = recordsByEmployee.GetValueOrDefault(e.EmployeeId) ?? [];
                    var leaves = approvedLeaves.Where(l => l.EmployeeId == e.EmployeeId).ToList();
                    var schedule = assignmentsByEmployee.GetValueOrDefault(e.EmployeeId) ?? [];

                    // day → true when a cover request covering it was approved, false when it
                    // was rejected / still pending. Missing means no request was ever filed.
                    var coverOutcome = new Dictionary<DateOnly, bool>();
                    foreach (var request in coverRequests.Where(r => r.EmployeeId == e.EmployeeId))
                    {
                        var approved = request.Status == DomainLayer.Models.RequestModule.Enums.RequestStatus.Approved;
                        var from = request.TargetStartDate ?? request.RequestDate;
                        var to = request.TargetEndDate ?? request.RequestDate;
                        for (var day = from < period.StartDate ? period.StartDate : from;
                             day <= (to > period.EndDate ? period.EndDate : to);
                             day = day.AddDays(1))
                        {
                            // A later approval always wins over an earlier rejection.
                            coverOutcome[day] = coverOutcome.TryGetValue(day, out var already) ? already || approved : approved;
                        }
                    }

                    // A day with no published shift (or an off-template one) is the weekly
                    // off. Without a real published schedule the gym's standard week applies:
                    // Friday is the weekly off. "Real" means at least one working assignment —
                    // a month of pure off rows is a missing schedule, not a month off.
                    var hasSchedule = schedule.Values.Any(a => a.ShiftTemplateId is not null);
                    bool ScheduledOff(DateOnly date) =>
                        !hasSchedule
                            ? date.DayOfWeek == DayOfWeek.Friday
                            : !schedule.TryGetValue(date, out var assignment)
                                || assignment.ShiftTemplateId is null
                                || assignment.ShiftTemplate is null
                                || assignment.ShiftTemplate.Name.Contains("off", StringComparison.OrdinalIgnoreCase);

                    // The published shift of the day, from the schedule rather than from the
                    // punch: an absent or future day still shows the shift he was given.
                    string? ScheduledShift(DateOnly date) =>
                        schedule.TryGetValue(date, out var planned)
                            && planned.ShiftTemplate is { } template
                            && planned.ShiftTemplateId is not null
                            && !template.Name.Contains("off", StringComparison.OrdinalIgnoreCase)
                                ? $"{template.StartTime.ToString("HH:mm", CultureInfo.InvariantCulture)}–{template.EndTime.ToString("HH:mm", CultureInfo.InvariantCulture)}"
                                : null;

                    // The day log is the month's single source of truth: every counter below
                    // is counted from it, so the drill-down always adds up to the cards.
                    var today = DateOnly.FromDateTime(DateTime.UtcNow);
                    var days = BuildAttendanceDays(
                        rows, leaves, period.StartDate, period.EndDate, ScheduledOff, ScheduledShift, hasSchedule, today,
                        coverOutcome, earlyLeaveRequests, _attendanceTimeZone);

                    int CountOf(params string[] kinds) => days.Count(d => kinds.Contains(d.Kind));

                    // Without a manual correction the counters are derived from the
                    // records; a seeded or stale DaysWorked must not outlive its evidence.
                    var adjusted = e.AttendanceAdjustedAt is not null;
                    var annualLeaves = CountOf("AnnualLeave");
                    var sickLeaves = CountOf("SickLeave");

                    return new PayrollAttendanceItem
                    {
                        AdjustedAt = e.AttendanceAdjustedAt,
                        // Only days worked on a real shift: cover work has its own counters.
                        DaysAttended = adjusted
                            ? e.DaysWorked
                            : CountOf("Attended", "Late", "EarlyCheckout", "EarlyLeave", "MissingCheckout"),
                        // A hand correction wins over the derived count; the day log and
                        // punch proof below stay untouched as the raw evidence.
                        WeeklyOffs = e.WeeklyOffsOverride ?? CountOf("WeeklyOff"),
                        AnnualLeaves = annualLeaves,
                        SickLeaves = sickLeaves,
                        ApprovedLeaves = e.ApprovedLeavesOverride ?? (annualLeaves + sickLeaves),
                        CoverDays = CountOf("Cover"),
                        UnapprovedCoverDays = CountOf("CoverRejected"),
                        OvertimeHours = e.OvertimeHours,
                        LateArrivals = e.LateArrivalsOverride ?? CountOf("Late"),
                        UnexcusedAbsences = e.UnexcusedAbsencesOverride ?? CountOf("Absent"),
                        Punches = rows
                            .Where(r => r.CheckInTime is not null)
                            .OrderByDescending(r => r.Status is AttendanceStatus.Late or AttendanceStatus.EarlyCheckout)
                            .ThenByDescending(r => r.Date)
                            .Take(5)
                            .Select(ToPunch)
                            .ToList(),
                        // The per-day log behind the counters (click-through).
                        Days = days,
                    };
                });
        }

        private static PayrollPunchItem ToPunch(AttendanceRecord record) => new()
        {
            AttendanceRef = $"ATT-{record.Id}",
            Date = record.Date,
            FirstIn = record.CheckInTime?.ToString("HH:mm", CultureInfo.InvariantCulture),
            LastOut = record.CheckOutTime?.ToString("HH:mm", CultureInfo.InvariantCulture),
            Device = record.CheckInMethod?.ToString() ?? record.CheckOutMethod?.ToString() ?? "Manual",
            Exception = FriendlyAttendance(record.Status),
            Detail = string.IsNullOrWhiteSpace(record.Notes) ? PunchDetail(record.Status) : record.Notes,
            OnTime = record.Status == AttendanceStatus.OnTime,
        };

        /// <summary>
        /// The day-by-day log behind the six counters: every attendance record of the
        /// period plus the approved leave days that carry no record, oldest first.
        /// </summary>
        private static List<PayrollAttendanceDay> BuildAttendanceDays(
            IReadOnlyCollection<AttendanceRecord> records,
            IReadOnlyCollection<DomainLayer.Models.RequestModule.EmployeeRequest> leaves,
            DateOnly start,
            DateOnly end,
            Func<DateOnly, bool> scheduledOff,
            Func<DateOnly, string?> scheduledShift,
            bool hasSchedule,
            DateOnly today,
            IReadOnlyDictionary<DateOnly, bool>? coverOutcome = null,
            IReadOnlyCollection<DomainLayer.Models.RequestModule.EmployeeRequest>? earlyLeaveRequests = null,
            TimeZoneInfo? attendanceTimeZone = null)
        {
            var days = new List<PayrollAttendanceDay>();
            var covered = new HashSet<DateOnly>(records.Select(r => r.Date));

            foreach (var record in records)
            {
                var shift = record.ScheduledShiftTemplate;

                decimal worked = 0;
                if (record.CheckInTime is { } checkIn && record.CheckOutTime is { } checkOut)
                {
                    var minutes = (checkOut - checkIn).TotalMinutes;
                    if (minutes > 0)
                    {
                        worked = Math.Round((decimal)minutes / 60m, 2);
                    }
                }

                decimal overtime = 0;
                if (shift is not null && worked > 0)
                {
                    var shiftHours = (decimal)(shift.EndTime - shift.StartTime).TotalHours;
                    if (shiftHours > 0 && worked > shiftHours)
                    {
                        overtime = Math.Round(worked - shiftHours, 2);
                    }
                }

                // How the day counts is decided by its cover/extra request first: an
                // approved one is a credited cover day, a rejected (or missing) one is
                // reported to HR as unapproved cover. Otherwise the punch is an ordinary
                // attendance until the schedule says the day was a rest day.
                var punched = record.CheckInTime is not null;
                bool? coverApproved = coverOutcome is not null && coverOutcome.TryGetValue(record.Date, out var approval)
                    ? approval
                    : null;
                var offDuty = scheduledOff(record.Date)
                    || (shift is not null && shift.Name.Contains("off", StringComparison.OrdinalIgnoreCase));

                var kind = coverApproved switch
                {
                    true when punched => "Cover",
                    false when punched => "CoverRejected",
                    null when punched && offDuty => "CoverRejected",
                    _ => AttendanceKind(record.Status),
                };

                var status = FriendlyAttendance(record.Status);
                string? note = record.Notes;
                var earlyLeaveMinutes = 0;

                if (record.Status == AttendanceStatus.EarlyCheckout && earlyLeaveRequests is not null)
                {
                    var early = AssessEarlyLeave(
                        record, earlyLeaveRequests, attendanceTimeZone ?? TimeZoneInfo.Local);
                    if (early is { } earlyLeave)
                    {
                        earlyLeaveMinutes = earlyLeave.MinutesEarly;
                        var requestRef = earlyLeave.LatestRequest is { } latest
                            ? $" Early leave request #{latest.Id} {RequestStatusLabel(latest.Status)}."
                            : " No early leave request was filed.";

                        var derived = earlyLeave.Covered
                            ? $"Left at {earlyLeave.CheckOutLocal:HH:mm} instead of the shift end "
                                + $"{earlyLeave.ShiftEndLocal:HH:mm}.{requestRef}"
                            : $"Left {earlyLeave.MinutesEarly} min before shift end.{requestRef}"
                                + (earlyLeave.LeftBeforeRequested && earlyLeave.RequestedTime is { } requested
                                    ? $" Requested time was {requested:HH:mm}."
                                    : string.Empty);

                        if (earlyLeave.Covered)
                        {
                            kind = "EarlyLeave";
                            status = "Early Leave";
                        }
                        else
                        {
                            status = "Early Leaving";
                        }

                        note = string.IsNullOrWhiteSpace(record.Notes) ? derived : $"{derived} {record.Notes}";
                    }
                }

                days.Add(new PayrollAttendanceDay
                {
                    Date = record.Date,
                    Kind = kind,
                    Status = status,
                    // The punch's own shift wins; otherwise the day still shows what the
                    // published schedule planned for it.
                    Shift = shift is not null
                        ? $"{shift.StartTime.ToString("HH:mm", CultureInfo.InvariantCulture)}–{shift.EndTime.ToString("HH:mm", CultureInfo.InvariantCulture)}"
                        : scheduledShift(record.Date),
                    CheckIn = record.CheckInTime?.ToString("HH:mm", CultureInfo.InvariantCulture),
                    CheckOut = record.CheckOutTime?.ToString("HH:mm", CultureInfo.InvariantCulture),
                    WorkedHours = worked,
                    OvertimeHours = overtime,
                    EarlyLeaveMinutes = earlyLeaveMinutes,
                    Note = note,
                    AttendanceRef = record.CheckInTime is not null ? $"ATT-{record.Id}" : null,
                });
            }

            foreach (var leave in leaves)
            {
                var from = leave.TargetStartDate ?? leave.RequestDate;
                var to = leave.TargetEndDate ?? leave.RequestDate;
                if (to < start || from > end)
                {
                    continue;
                }

                if (from < start) from = start;
                if (to > end) to = end;

                for (var day = from; day <= to; day = day.AddDays(1))
                {
                    if (!covered.Add(day))
                    {
                        continue;
                    }

                    days.Add(new PayrollAttendanceDay
                    {
                        Date = day,
                        Kind = leave.Type == "Sick Leave" ? "SickLeave" : "AnnualLeave",
                        Status = leave.Type,
                        Shift = scheduledShift(day),
                        Note = string.IsNullOrWhiteSpace(leave.Details) ? null : leave.Details,
                    });
                }
            }

            // Days the schedule leaves empty are the weekly offs behind that counter —
            // they carry no attendance record, so they are derived here too.
            for (var day = start; day <= end; day = day.AddDays(1))
            {
                if (scheduledOff(day) && covered.Add(day))
                {
                    days.Add(new PayrollAttendanceDay
                    {
                        Date = day,
                        Kind = "WeeklyOff",
                        Status = "Off",
                        Note = "Weekly off — no shift scheduled.",
                    });
                }
            }

            // Whatever is still unclaimed is the rest of the month: a scheduled working day
            // with no punch is an absence, and a day with no published schedule at all is
            // reported as unscheduled rather than invented as an absence.
            for (var day = start; day <= end; day = day.AddDays(1))
            {
                if (!covered.Add(day))
                {
                    continue;
                }

                days.Add(day > today
                    ? new PayrollAttendanceDay
                    {
                        Date = day,
                        Kind = "Scheduled",
                        Status = "Scheduled",
                        Shift = scheduledShift(day),
                        Note = "Upcoming shift — not due yet.",
                    }
                    : hasSchedule
                        ? new PayrollAttendanceDay
                        {
                            Date = day,
                            Kind = "Absent",
                            Status = "Absent",
                            Shift = scheduledShift(day),
                            Note = "No punch recorded for this scheduled shift.",
                        }
                        : new PayrollAttendanceDay
                        {
                            Date = day,
                            Kind = "Unscheduled",
                            Status = "No schedule",
                            Note = "No published schedule covers this day.",
                        });
            }

            return days.OrderBy(day => day.Date).ToList();
        }

        /// <summary>The counter bucket a record belongs to (see <see cref="PayrollAttendanceDay.Kind"/>).</summary>
        private static string AttendanceKind(AttendanceStatus status) => status switch
        {
            AttendanceStatus.Off => "WeeklyOff",
            AttendanceStatus.Late => "Late",
            AttendanceStatus.Absent => "Absent",
            AttendanceStatus.EarlyCheckout => "EarlyCheckout",
            AttendanceStatus.MissingCheckout => "MissingCheckout",
            _ => "Attended",
        };

        private static string PunchDetail(AttendanceStatus status) => status switch
        {
            AttendanceStatus.Late => "Check-in was logged after the shift start.",
            AttendanceStatus.EarlyCheckout => "Check-out was logged before the shift end.",
            AttendanceStatus.MissingCheckout => "No check-out punch was recorded.",
            AttendanceStatus.Absent => "No punch was recorded for this shift.",
            AttendanceStatus.Off => "Weekly off — no shift was scheduled.",
            _ => "Regular punch.",
        };

        /// <summary>Calendar days an approved leave covers (at least one).</summary>
        private static int RequestSpanDays(DomainLayer.Models.RequestModule.EmployeeRequest request)
        {
            var start = request.TargetStartDate ?? request.RequestDate;
            var end = request.TargetEndDate ?? request.RequestDate;
            return Math.Max(1, end.DayNumber - start.DayNumber + 1);
        }

        private static PayrollPeriodItem BuildPeriodItem(PayrollPeriod period, List<PayrollEntry> entries)
        {
            var published = period.Status != PayrollPeriodStatus.Open || period.PaidDate is not null;
            return new PayrollPeriodItem
            {
                Id = period.Id,
                GymId = period.GymId,
                Gym = period.Gym?.Name ?? string.Empty,
                Period = PeriodLabel(period),
                Status = DisplayStatus(period, entries),
                Locked = period.Status != PayrollPeriodStatus.Open,
                PaidDate = period.PaidDate,
                PublishedGyms = published ? [period.Gym.Name] : [],
                TotalEmployees = entries.Count,
                TotalGross = entries.Sum(GrossOf),
                TotalDeductions = entries.Sum(ApprovedDeductionsOf),
                TotalNet = entries.Sum(NetOf),
            };
        }

        private static PayrollPeriodDetailData BuildPeriodDetail(
            PayrollPeriod period,
            List<PayrollEntry> entries,
            IReadOnlyDictionary<int, PayrollAttendanceItem>? evidence = null,
            IReadOnlyDictionary<int, PayrollAttendanceSummary>? summaries = null,
            IReadOnlyDictionary<int, decimal>? candidateDays = null)
        {
            var item = BuildPeriodItem(period, entries);
            return new PayrollPeriodDetailData
            {
                Id = item.Id,
                GymId = item.GymId,
                Gym = item.Gym,
                Period = item.Period,
                Status = item.Status,
                Locked = item.Locked,
                PaidDate = item.PaidDate,
                PublishedGyms = item.PublishedGyms,
                TotalEmployees = item.TotalEmployees,
                TotalGross = item.TotalGross,
                TotalDeductions = item.TotalDeductions,
                TotalNet = item.TotalNet,
                Items = entries
                    .Select(e => MapEntry(
                        e,
                        attendance: evidence?.GetValueOrDefault(e.EmployeeId),
                        summary: summaries?.GetValueOrDefault(e.EmployeeId),
                        candidateDays: candidateDays))
                    .ToList(),
            };
        }

        private static PayrollEntryItem MapEntry(
            PayrollEntry entry,
            string? periodLabel = null,
            PayrollAttendanceItem? attendance = null,
            PayrollAttendanceSummary? summary = null,
            IReadOnlyDictionary<int, decimal>? candidateDays = null)
        {
            var gross = GrossOf(entry);
            var approved = ApprovedDeductionsOf(entry);
            var coverDays = summary?.CoverDays ?? 0;
            return new PayrollEntryItem
            {
                EmployeeId = entry.EmployeeId,
                Name = entry.Employee.FullName,
                EmployeeNumber = entry.Employee.EmployeeNumber,
                Initials = HrPortalHelpers.BuildInitials(entry.Employee.FullName),
                Gym = entry.Employee.Gym?.Name ?? string.Empty,
                Position = entry.Employee.Position?.Title ?? "None",
                EmploymentStatus = FriendlyEmployment(entry.Employee.Status),
                // The ledger's Days column mirrors the evidence: a manual correction wins,
                // then the punch-derived count, then the cover summary, then the stored value.
                Days = attendance?.DaysAttended
                    ?? (summary is { DaysWorked: > 0 } ? summary.DaysWorked : entry.DaysWorked),
                Overtime = entry.OvertimeHours,
                CoverDays = coverDays,
                ExtraShiftDays = summary?.ExtraShiftDays ?? 0,
                CoverPay = CoverPay(entry, coverDays),
                BaseSalary = entry.BaseSalary,
                Bonus = entry.TotalBonuses,
                Gross = gross,
                Deductions = approved,
                Net = gross - approved,
                Status = entry.Status,
                Reviewed = entry.ReviewedAt is not null,
                RelatedRequestIds = entry.LineItems
                    .Where(l => l.EmployeeRequestId.HasValue)
                    .Select(l => l.EmployeeRequestId!.Value)
                    .Distinct()
                    .OrderBy(id => id)
                    .ToList(),
                DeductionLines = entry.LineItems
                    .Where(l => l.Type.Equals("Deduction", StringComparison.OrdinalIgnoreCase))
                    .OrderBy(l => l.EffectiveDate)
                    .ThenBy(l => l.Id)
                    .Select(line => MapLine(line, candidateDays))
                    .ToList(),
                Attendance = attendance,
                Period = periodLabel,
            };
        }

        private static DeductionLineItem MapLine(
            PayrollEntryLineItem line, IReadOnlyDictionary<int, decimal>? candidateDays = null)
        {
            var source = UiSource(line.Source);
            return new DeductionLineItem
            {
                Id = line.Id,
                Date = line.EffectiveDate,
                Label = line.Label,
                Reason = line.Reason,
                Source = source,
                Amount = line.Amount,
                // How many days the line charges, carried from the attendance candidate so
                // HR edits days (not a hand-made amount) when re-pricing.
                Days = line.DeductionCandidateId is int candidateId
                    && candidateDays is not null
                    && candidateDays.TryGetValue(candidateId, out var days)
                        ? days
                        : null,
                Status = line.Status,
                AttendanceRef = line.AttendanceRecordId is int recordId
                    ? $"ATT-{recordId}"
                    : string.Equals(source, "biometric", StringComparison.OrdinalIgnoreCase) ? "ATT-MANUAL" : string.Empty,
                RequestId = line.EmployeeRequestId,
            };
        }

        private static DeductionCandidateItem MapCandidate(PayrollEntryLineItem line)
        {
            var mapped = MapLine(line);
            var entry = line.PayrollEntry;
            return new DeductionCandidateItem
            {
                Id = line.Id,
                EmployeeId = entry.EmployeeId,
                EmployeeName = entry.Employee.FullName,
                Gym = entry.PayrollPeriod.Gym.Name,
                Period = PeriodLabel(entry.PayrollPeriod),
                Date = mapped.Date,
                Label = mapped.Label,
                Reason = mapped.Reason,
                Source = mapped.Source,
                Amount = mapped.Amount,
                Status = mapped.Status,
                AttendanceRef = mapped.AttendanceRef,
                RequestId = mapped.RequestId,
            };
        }

        private static DeductionEntrySummary BuildEntrySummary(PayrollEntry entry) => new()
        {
            Gross = GrossOf(entry),
            Deductions = ApprovedDeductionsOf(entry),
            Net = NetOf(entry),
            PendingCount = PendingCountOf(entry),
        };

        /// <summary>OT pay = (base/176)×1.5×hours — the UI's derivation.</summary>
        internal static decimal OvertimePay(PayrollEntry entry) =>
            entry.BaseSalary <= 0 || entry.OvertimeHours <= 0
                ? 0m
                : Math.Round(entry.BaseSalary / 176m * 1.5m * entry.OvertimeHours, 2);

        /// <summary>
        /// Gross = base + bonuses + overtime. The annual raise is NOT added here: it is a
        /// once-a-year step that folds into the base salary (see <see cref="BaseWithRaises"/>),
        /// so a month never shows a raise slice of its own.
        /// </summary>
        internal static decimal GrossOf(PayrollEntry entry) =>
            entry.BaseSalary + entry.TotalBonuses + OvertimePay(entry);

        /// <summary>
        /// The base salary in force for a period: the compensation amount grown by one
        /// policy raise per completed year of service, compounding on itself.
        /// </summary>
        internal static decimal BaseWithRaises(decimal compensation, DateOnly? hireDate, DateOnly periodEnd, decimal? percent)
        {
            if (compensation <= 0 || hireDate is not { } hire || percent is not > 0 || hire <= DateOnly.MinValue)
            {
                return compensation;
            }

            var years = 0;
            for (var anniversary = hire.AddYears(1); anniversary <= periodEnd; anniversary = anniversary.AddYears(1))
            {
                years++;
            }

            return years == 0
                ? compensation
                : Math.Round(compensation * (decimal)Math.Pow((double)(1 + percent.Value / 100m), years), 2);
        }

        private static decimal ApprovedDeductionsOf(PayrollEntry entry) =>
            entry.LineItems
                .Where(l => l.Type.Equals("Deduction", StringComparison.OrdinalIgnoreCase)
                    && l.Status is "Accepted" or "Approved")
                .Sum(l => l.Amount);

        private static int PendingCountOf(PayrollEntry entry) =>
            entry.LineItems.Count(l => l.Type.Equals("Deduction", StringComparison.OrdinalIgnoreCase)
                && l.Status == "Pending");

        internal static decimal NetOf(PayrollEntry entry) => GrossOf(entry) - ApprovedDeductionsOf(entry);

        /// <summary>Mirrors the recomputed money back onto the stored row for history/exports.</summary>
        internal static void SyncTotals(PayrollEntry entry)
        {
            entry.TotalDeductions = ApprovedDeductionsOf(entry);
            entry.NetPay = NetOf(entry);
        }

        /// <summary>Weekly days the schedule assumes (one off-day a week → ~26 a month).</summary>
        internal const int WeeklyWorkDays = 6;

        /// <summary>
        /// Attendance-exception pricing (mock §8 + the gym's review flow): scheduled
        /// workdays = period days × weekly days ÷ 7 (26 for a 31-day, 6-day month), a
        /// late arrival costs a quarter of a day and an unapproved absence
        /// <see cref="AbsenceDayMultiplier"/> days of the base salary.
        /// </summary>
        internal static (int ScheduledDays, decimal Daily, decimal Late, decimal Absent) AttendanceRates(
            decimal baseSalary, PayrollPeriod period)
            => AttendanceRates(baseSalary, period.StartDate, period.EndDate);

        /// <summary>
        /// Same pricing without a period row — the absence sweep prices a day from
        /// the payroll sheet covering it, else from the calendar month of the day.
        /// </summary>
        internal static (int ScheduledDays, decimal Daily, decimal Late, decimal Absent) AttendanceRates(
            decimal baseSalary, DateOnly start, DateOnly end)
        {
            var days = end.DayNumber - start.DayNumber + 1;
            var scheduled = Math.Max(1, (int)Math.Floor(days * WeeklyWorkDays / 7.0));
            var daily = baseSalary > 0 ? Math.Round(baseSalary / scheduled, 2) : 0m;
            return (scheduled, daily,
                daily > 0 ? Math.Round(daily / 4m, 2) : 0m,
                daily > 0 ? Math.Round(daily * AbsenceDayMultiplier, 2) : 0m);
        }

        /// <summary>Workdays an unapproved absence levies — one absent day costs three days of pay.</summary>
        internal const int AbsenceDayMultiplier = 3;

        /// <summary>
        /// Days of pay a late arrival costs, by how late it was: up to a quarter of an
        /// hour is an hour of pay, up to half an hour a quarter day, beyond that half a day.
        /// </summary>
        internal static (decimal Days, string Label) LatePenalty(int? lateMinutes) => lateMinutes switch
        {
            null => (0.25m, "quarter day"),
            <= 15 => (0.125m, "one hour"),
            <= 30 => (0.25m, "quarter day"),
            _ => (0.5m, "half day"),
        };

        /// <summary>The marker the absence sweep stamps into a candidate's note so a derived-absent day stays identifiable.</summary>
        internal const string AbsenceMarkerPrefix = "auto-absence:";

        internal static string AbsenceMarker(DateOnly date) =>
            $"{AbsenceMarkerPrefix}{date.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture)}";

        /// <summary>The absence day a marker note carries (<c>auto-absence:yyyy-MM-dd</c>), else null.</summary>
        internal static DateOnly? ParseAbsenceMarker(string? note)
        {
            if (string.IsNullOrEmpty(note))
            {
                return null;
            }

            var start = note.IndexOf(AbsenceMarkerPrefix, StringComparison.Ordinal);
            if (start < 0)
            {
                return null;
            }

            var value = note[(start + AbsenceMarkerPrefix.Length)..];
            if (value.Length < 10)
            {
                return null;
            }

            return DateOnly.TryParseExact(
                value[..10], "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out var date)
                ? date
                : null;
        }

        /// <summary>The note as payroll shows it — the internal dedupe marker stripped out.</summary>
        internal static string? StripAbsenceMarker(string? note)
        {
            if (string.IsNullOrEmpty(note))
            {
                return note;
            }

            var start = note.IndexOf(AbsenceMarkerPrefix, StringComparison.Ordinal);
            if (start < 0)
            {
                return note;
            }

            var end = start + AbsenceMarkerPrefix.Length + 10;
            var stripped = (note[..start] + note[Math.Min(end, note.Length)..]).Trim().Trim('·', ' ').Trim();
            return stripped.Length == 0 ? null : stripped;
        }

        /// <summary>
        /// The day a candidate punishes. DeductionDate is authoritative for rows
        /// written after the one-deduction-per-day change; legacy rows fall back to
        /// the linked attendance day, the sweep's note marker, then the issue day.
        /// </summary>
        internal static DateOnly CandidateDayOf(DeductionCandidate candidate) =>
            candidate.DeductionDate != default
                ? candidate.DeductionDate
                : candidate.AttendanceRecord?.Date
                    ?? ParseAbsenceMarker(candidate.Note)
                    ?? DateOnly.FromDateTime(candidate.IssuedAt);

        internal static string PeriodLabel(PayrollPeriod period) =>
            period.StartDate.ToString("MMMM yyyy", CultureInfo.InvariantCulture);

        private static string UiSource(string source) =>
            string.Equals(source.Trim(), "biometric", StringComparison.OrdinalIgnoreCase) ? "biometric" : "manager";

        private static string FriendlyEmployment(EmployeeStatus status) => status switch
        {
            EmployeeStatus.OnLeave => "On Leave",
            EmployeeStatus.NoticePeriod => "Notice Period",
            _ => status.ToString(),
        };

        private static string FriendlyAttendance(AttendanceStatus status) => status switch
        {
            AttendanceStatus.OnTime => "On Time",
            AttendanceStatus.EarlyCheckout => "Early Leaving",
            AttendanceStatus.MissingCheckout => "Missing Checkout",
            _ => status.ToString(),
        };

        /// <summary>Request status shown next to the early-leave evidence.</summary>
        private static string RequestStatusLabel(DomainLayer.Models.RequestModule.Enums.RequestStatus status) => status switch
        {
            DomainLayer.Models.RequestModule.Enums.RequestStatus.Approved => "approved",
            DomainLayer.Models.RequestModule.Enums.RequestStatus.Rejected => "rejected",
            DomainLayer.Models.RequestModule.Enums.RequestStatus.Pending or
                DomainLayer.Models.RequestModule.Enums.RequestStatus.PendingHRReview => "pending",
            _ => "closed",
        };

        /// <summary>
        /// Compares one early check-out with the shift window and the day's Early Leave
        /// requests. A pending/approved request covers the departure only when it does
        /// not run before the time the employee asked for — the same rule the station
        /// applies when it raises the warning.
        /// </summary>
        private static EarlyLeaveEvidence? AssessEarlyLeave(
            AttendanceRecord record,
            IReadOnlyCollection<DomainLayer.Models.RequestModule.EmployeeRequest> requests,
            TimeZoneInfo attendanceTimeZone)
        {
            if (record.CheckOutTime is not { } checkOutUtc || record.ScheduledShiftTemplate is not { } template)
            {
                return null;
            }

            var checkOutLocal = TimeZoneInfo.ConvertTimeFromUtc(checkOutUtc, attendanceTimeZone);
            var shiftEndsAt = ShiftWindowEndsAt(record.Date, template);
            var minutesEarly = (int)Math.Ceiling((shiftEndsAt - checkOutLocal).TotalMinutes);
            if (minutesEarly <= 0)
            {
                return null;
            }

            var dayRequests = requests
                .Where(r => r.RequestDate == record.Date)
                .OrderByDescending(r => r.CreatedAt)
                .ToList();
            var active = dayRequests.FirstOrDefault(r =>
                r.Status is DomainLayer.Models.RequestModule.Enums.RequestStatus.Pending
                    or DomainLayer.Models.RequestModule.Enums.RequestStatus.PendingHRReview
                    or DomainLayer.Models.RequestModule.Enums.RequestStatus.Approved);
            var leftBeforeRequested = active?.TargetTime is { } requested
                && checkOutLocal < ResolveRequestedDeparture(record.Date, template, requested);

            return new EarlyLeaveEvidence(
                minutesEarly,
                TimeOnly.FromDateTime(checkOutLocal),
                TimeOnly.FromDateTime(shiftEndsAt),
                dayRequests.FirstOrDefault(),
                active is not null && !leftBeforeRequested,
                leftBeforeRequested,
                active?.TargetTime);
        }

        /// <summary>Wall-clock shift end; overnight templates end on the following day.</summary>
        private static DateTime ShiftWindowEndsAt(DateOnly date, ShiftTemplate template) =>
            template.EndTime > template.StartTime
                ? date.ToDateTime(template.EndTime)
                : date.AddDays(1).ToDateTime(template.EndTime);

        /// <summary>
        /// Anchors a requested departure time to the shift window: on an overnight
        /// shift a time before the start belongs to the following morning.
        /// </summary>
        private static DateTime ResolveRequestedDeparture(DateOnly shiftDate, ShiftTemplate template, TimeOnly requested)
        {
            var at = shiftDate.ToDateTime(requested);
            return template.EndTime <= template.StartTime && requested < template.StartTime
                ? at.AddDays(1)
                : at;
        }

        private readonly record struct EarlyLeaveEvidence(
            int MinutesEarly,
            TimeOnly CheckOutLocal,
            TimeOnly ShiftEndLocal,
            DomainLayer.Models.RequestModule.EmployeeRequest? LatestRequest,
            bool Covered,
            bool LeftBeforeRequested,
            TimeOnly? RequestedTime);

        private static string? NormalizeLineStatus(string? status) => status?.Trim().ToLowerInvariant() switch
        {
            "pending" => "Pending",
            "accepted" => "Accepted",
            "approved" => "Approved",
            "rejected" => "Rejected",
            _ => null,
        };

        private static DeductionCandidateListResponse EmptyCandidates(DeductionCandidateListQuery query)
        {
            var page = Math.Max(query.Page, 1);
            var pageSize = HrPortalHelpers.NormalizePageSize(query.PageSize);
            return new DeductionCandidateListResponse
            {
                Items = [],
                Page = page,
                PageSize = pageSize,
                Total = 0,
                TotalPages = 0,
            };
        }

        private static string Slug(string value)
        {
            var chars = value.ToLowerInvariant()
                .Select(c => char.IsLetterOrDigit(c) ? c : '-')
                .ToArray();
            return new string(chars).Trim('-');
        }

        private static string Csv(object value) =>
            $"\"{Convert.ToString(value, CultureInfo.InvariantCulture)?.Replace("\"", "\"\"") ?? string.Empty}\"";
    }
}
