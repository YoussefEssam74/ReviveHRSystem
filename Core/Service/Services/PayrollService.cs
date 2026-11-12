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
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.PayrollModule.Enums;
using DomainLayer.Models.RequestModule;
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
        IAttendanceDeductionSweepService _deductionSweep) : IPayrollService
    {
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

            var data = BuildPeriodDetail(period, entries, await LoadAttendanceSummariesAsync(
                _unitOfWork, period, entries.Select(e => e.EmployeeId).ToList(), cancellationToken));
            return new PayrollPeriodDetailResponse { Data = data };
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

            var candidates = (await _unitOfWork.GetRepository<DeductionCandidate, int>()
                    .GetAllAsync(new DeductionCandidatesByEmployeesSpec([entry.EmployeeId]), cancellationToken))
                .Where(c => CandidateDayOf(c) >= period.StartDate && CandidateDayOf(c) <= period.EndDate)
                .ToList();

            // Every candidate still alive becomes a deduction line in Pending state:
            // the branch has had its triage, HR makes the final call on the review
            // queue. Rejected candidates are final and never re-materialized.
            var lines = entry.LineItems
                .Where(l => l.Type.Equals("Deduction", StringComparison.OrdinalIgnoreCase))
                .ToList();
            var appliedCandidateIds = lines
                .Where(l => l.DeductionCandidateId is not null)
                .Select(l => l.DeductionCandidateId!.Value)
                .ToHashSet();
            var takenDays = lines.Select(l => l.EffectiveDate).ToHashSet();

            foreach (var candidate in candidates)
            {
                if (candidate.Status == DeductionStatus.Rejected
                    || appliedCandidateIds.Contains(candidate.Id))
                {
                    continue;
                }

                // An older line already punishes this day (manual line, or an earlier
                // close): never charge the same day twice.
                var day = CandidateDayOf(candidate);
                if (takenDays.Contains(day))
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
                entry.LineItems.Add(line);
                takenDays.Add(day);
            }

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
            line.Status = decision switch
            {
                "accepted" => "Accepted",
                "rejected" => "Rejected",
                _ => throw new BadRequestException("Decision must be \"Accepted\" or \"Rejected\"."),
            };

            // HR's end-of-month re-price: the review may carry the amount the sheet
            // should actually charge, in which case the line and the candidate it
            // materialized from both move to it before the totals recompute.
            var source = await FindCandidateForLineAsync(line, cancellationToken);
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
                source.Status = line.Status == "Accepted" ? DeductionStatus.Approved : DeductionStatus.Rejected;
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
                        summariesByPeriod[e.PayrollPeriod.Id].GetValueOrDefault(e.EmployeeId)))
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

        private static PayrollPeriodItem BuildPeriodItem(PayrollPeriod period, List<PayrollEntry> entries)
        {
            var published = period.Status != PayrollPeriodStatus.Open || period.PaidDate is not null;
            return new PayrollPeriodItem
            {
                Id = period.Id,
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
            IReadOnlyDictionary<int, PayrollAttendanceSummary>? summaries = null)
        {
            var item = BuildPeriodItem(period, entries);
            return new PayrollPeriodDetailData
            {
                Id = item.Id,
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
                    .Select(e => MapEntry(e, summary: summaries?.GetValueOrDefault(e.EmployeeId)))
                    .ToList(),
            };
        }

        private static PayrollEntryItem MapEntry(
            PayrollEntry entry,
            string? periodLabel = null,
            PayrollAttendanceSummary? summary = null)
        {
            var gross = GrossOf(entry);
            var approved = ApprovedDeductionsOf(entry);
            var coverDays = summary?.CoverDays ?? 0;
            return new PayrollEntryItem
            {
                EmployeeId = entry.EmployeeId,
                Name = entry.Employee.FullName,
                Initials = HrPortalHelpers.BuildInitials(entry.Employee.FullName),
                Gym = entry.Employee.Gym?.Name ?? string.Empty,
                Position = entry.Employee.Position?.Title ?? "None",
                EmploymentStatus = FriendlyEmployment(entry.Employee.Status),
                // A period with attendance on record reports the real count; a
                // historical sheet with no attendance rows keeps its stored value.
                Days = summary is { DaysWorked: > 0 } ? summary.DaysWorked : entry.DaysWorked,
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
                    .Select(MapLine)
                    .ToList(),
                Period = periodLabel,
            };
        }

        private static DeductionLineItem MapLine(PayrollEntryLineItem line)
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
        /// Gross = base + the annual-increase raise slice + bonuses + overtime. Folding
        /// the raise into gross keeps Net = Gross − deductions, so the sheet's net bar
        /// always reconciles with its Earnings header minus its Deductions header.
        /// </summary>
        internal static decimal GrossOf(PayrollEntry entry) =>
            entry.BaseSalary + AnnualIncreaseOf(entry) + entry.TotalBonuses + OvertimePay(entry);

        /// <summary>This period's raise slice from the gym's annual-increase policy.</summary>
        private static decimal AnnualIncreaseOf(PayrollEntry entry)
        {
            var percent = entry.PayrollPeriod?.Gym?.AnnualIncreasePercent;
            return percent is > 0 && entry.BaseSalary > 0
                ? Math.Round(entry.BaseSalary * percent.Value / 100m, 2)
                : 0m;
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

        /// <summary>Workdays an unapproved absence levies (the sweep, payroll close and the manager's view all price it the same).</summary>
        internal const int AbsenceDayMultiplier = 1;

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
            AttendanceStatus.EarlyCheckout => "Early Checkout",
            AttendanceStatus.MissingCheckout => "Missing Checkout",
            _ => status.ToString(),
        };

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
