using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.NotificationModule.Enums;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.PayrollModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Services
{
    /// <summary>
    /// Branch Actions queue (mock §20). Deductions, warnings and bonus proposals are
    /// raised by in-gym management only (Team Leader within his team, Branch Manager
    /// gym-wise); the service validates that, the target lands inside that scope, and
    /// every issue is recorded at the active gym with status Pending.
    /// </summary>
    public class BranchActionsService(
        IUnitOfWork unitOfWork,
        ITeamScopeService teamScopeService,
        IAccessControlService accessControl,
        IUserAccessRepository userAccess,
        IAttendanceDeductionSweepService deductionSweep) : IBranchActionsService
    {
        private static readonly string[] DeductionReasons =
        {
            "Unapproved absence",
            "Late arrival (30+ min)",
            "Early checkout without approval",
            "Damaged equipment / property",
            "Policy violation",
            "Other (see note)"
        };

        private static readonly string[] WarningTypes =
        {
            "Attendance", "Conduct", "Performance", "Safety", "Policy violation"
        };

        private static readonly string[] BonusTypes =
        {
            "Performance Bonus", "Overtime Pay", "Attendance Reward", "Referral Bonus", "Other"
        };

        private static readonly string[] ReportTypes =
        {
            "Monthly branch summary", "Attendance exceptions", "Incident report", "Request escalations"
        };

        public async Task<DeductionCandidateDto> IssueDeductionAsync(
            int actorUserId, int? activeGymId, CreateDeductionCandidateDto request, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);

            await EnsureManagementScopeAsync(actorUserId, gymId, cancellationToken);

            if (request.Value is null && request.Amount <= 0)
            {
                throw new BadRequestException("The deduction amount must be greater than zero.");
            }

            if (request.Value is { } size && size <= 0)
            {
                throw new BadRequestException("The deduction size must be greater than zero.");
            }

            if (!DeductionReasons.Contains(request.Reason, StringComparer.OrdinalIgnoreCase))
            {
                throw new BadRequestException($"Unknown deduction reason '{request.Reason}'.");
            }

            await EnsureEmployeeInScopeAsync(actorUserId, gymId, request.EmployeeId, cancellationToken);

            var deductionDate = request.Date ?? DateOnly.FromDateTime(DateTime.UtcNow);
            var existing = await unitOfWork.GetRepository<DeductionCandidate, int>()
                .GetAllAsync(new DeductionCandidatesByEmployeesSpec([request.EmployeeId]), cancellationToken);
            if (existing.Any(c => PayrollService.CandidateDayOf(c) == deductionDate))
            {
                // One deduction per employee/day. A rejected day is final too — the
                // branch cannot re-issue what HR/management already waived.
                throw new BadRequestException("A deduction already exists for this employee on that date.");
            }

            var candidate = new DeductionCandidate
            {
                EmployeeId = request.EmployeeId,
                DeductionDate = deductionDate,
                IsSystemGenerated = false,
                Amount = request.Amount,
                DeductionUnit = ParseUnit(request.Unit),
                DeductionValue = request.Value ?? 0m,
                DeductionDays = request.Value is null ? 1m : 0m,
                Reason = request.Reason,
                Note = request.Note?.Trim(),
                IssuedBy = actorUserId,
                IssuedAt = DateTime.UtcNow,
                Status = DeductionStatus.Pending
            };

            // A sized deduction is priced from the month's rates; with no size the
            // manager's explicit amount stands as it was entered.
            candidate.Employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(candidate.EmployeeId), cancellationToken)
                ?? candidate.Employee;
            if (request.Value is { } value)
            {
                (candidate.Amount, candidate.DeductionDays) = await PriceAsync(
                    candidate, candidate.DeductionUnit, value, cancellationToken);
            }

            await unitOfWork.GetRepository<DeductionCandidate, int>().AddAsync(candidate, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return await LoadDeductionAsync(candidate.Id, cancellationToken);
        }

        /// <summary>
        /// The branch's own decision on one of its deductions before HR applies it to
        /// payroll (mock §20): approve (BranchApproved — goes to HR), reject (final) or
        /// re-price the amount. Restricted to the caller's management scope and only
        /// while no decision has closed the line.
        /// </summary>
        public async Task<DeductionCandidateDto> BranchReviewDeductionAsync(
            int actorUserId, int candidateId, BranchDeductionReviewRequest request, int? activeGymId, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            await EnsureManagementScopeAsync(actorUserId, gymId, cancellationToken);

            var candidate = await unitOfWork.GetRepository<DeductionCandidate, int>()
                .GetByIdAsync(new DeductionCandidateByIdSpec(candidateId), cancellationToken)
                ?? throw new NotFoundException("Deduction candidate not found.");

            await EnsureEmployeeInScopeAsync(actorUserId, gymId, candidate.EmployeeId, cancellationToken);

            // A rejected row is not same as an applied one: the branch can still
            // re-approve it or edit its days to undo a wrong rejection. Only a
            // row HR has applied (Approved) is truly frozen.
            if (candidate.Status is DeductionStatus.Approved)
            {
                throw new BadRequestException(
                    "This deduction is already finalized — an applied deduction can no longer change.");
            }

            var amount = request.Amount;
            if (amount is { } revised && revised <= 0)
            {
                throw new BadRequestException("The deduction amount must be greater than zero.");
            }

            if (request.Days is { } days && (days <= 0 || days > 30 || days != decimal.Truncate(days)))
            {
                throw new BadRequestException("Deduction days must be a whole number between 1 and 30.");
            }

            // The manager sizes the deduction in hours or days; the money follows the
            // month's rates. A size whose rate is not known yet (hourly before the roster
            // is complete) stays pending at 0 and fills in on its own later.
            var unit = ParseUnit(request.Unit);
            if (request.Value is { } chosen)
            {
                if (chosen <= 0)
                {
                    throw new BadRequestException("The deduction size must be greater than zero.");
                }

                var limit = unit == DeductionUnit.Hours ? 24m : 30m;
                if (chosen > limit)
                {
                    throw new BadRequestException(
                        unit == DeductionUnit.Hours
                            ? "Deduction hours must be at most 24."
                            : "Deduction days must be at most 30.");
                }

                candidate.DeductionUnit = unit;
                candidate.DeductionValue = chosen;
                (candidate.Amount, candidate.DeductionDays) = await PriceAsync(candidate, unit, chosen, cancellationToken);
            }

            switch (request.Decision?.Trim().ToLowerInvariant())
            {
                case "approve":
                    if (request.Days is { } approveDays)
                    {
                        candidate.DeductionUnit = DeductionUnit.Days;
                        candidate.DeductionValue = approveDays;
                        (candidate.Amount, candidate.DeductionDays) = await PriceAsync(candidate, DeductionUnit.Days, approveDays, cancellationToken);
                    }
                    else if (amount is not null)
                    {
                        candidate.Amount = amount.Value;
                    }
                    candidate.Status = DeductionStatus.BranchApproved;
                    break;

                case "reject":
                    candidate.Status = DeductionStatus.Rejected;
                    break;

                case "edit" when request.Days is { } editDays:
                    candidate.DeductionUnit = DeductionUnit.Days;
                    candidate.DeductionValue = editDays;
                    (candidate.Amount, candidate.DeductionDays) = await PriceAsync(candidate, DeductionUnit.Days, editDays, cancellationToken);
                    // Editing a rejected row's days re-opens it: without this
                    // the row would keep the Rejected status while its amount
                    // silently changed, which the UI would read as erased-but-
                    // still-excused.
                    if (candidate.Status is DeductionStatus.Rejected)
                    {
                        candidate.Status = DeductionStatus.Pending;
                    }
                    break;

                case "edit" when amount is not null:
                    candidate.Amount = amount.Value;
                    break;

                case "edit" when request.Value is not null:
                    // Re-priced through the size above; nothing else to change.
                    if (candidate.Status is DeductionStatus.Rejected)
                    {
                        candidate.Status = DeductionStatus.Pending;
                    }
                    break;

                case "edit":
                    throw new BadRequestException("Re-pricing a deduction requires hours, days or an amount.");

                default:
                    throw new BadRequestException("The decision must be 'approve', 'reject' or 'edit'.");
            }

            await unitOfWork.SaveChangesAsync(cancellationToken);
            return await LoadDeductionAsync(candidate.Id, cancellationToken);
        }

        public async Task<WarningNoticeDto> IssueWarningAsync(
            int actorUserId, int? activeGymId, CreateWarningNoticeDto request, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);

            await EnsureManagementScopeAsync(actorUserId, gymId, cancellationToken);

            if (!WarningTypes.Contains(request.Type, StringComparer.OrdinalIgnoreCase))
            {
                throw new BadRequestException($"Unknown warning category '{request.Type}'.");
            }

            if (string.IsNullOrWhiteSpace(request.Reason))
            {
                throw new BadRequestException("A reason is required.");
            }

            await EnsureEmployeeInScopeAsync(actorUserId, gymId, request.EmployeeId, cancellationToken);

            var notice = new WarningNotice
            {
                EmployeeId = request.EmployeeId,
                Type = request.Type,
                Reason = request.Reason.Trim(),
                Note = request.Note?.Trim(),
                IssuedBy = actorUserId,
                IssuedAt = DateTime.UtcNow,
                Status = ProposalStatus.Pending
            };

            await unitOfWork.GetRepository<WarningNotice, int>().AddAsync(notice, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return await LoadWarningAsync(notice.Id, cancellationToken);
        }

        public async Task<BonusProposalDto> ProposeBonusAsync(
            int actorUserId, int? activeGymId, CreateBonusProposalDto request, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);

            await EnsureManagementScopeAsync(actorUserId, gymId, cancellationToken);

            if (!BonusTypes.Contains(request.Type, StringComparer.OrdinalIgnoreCase))
            {
                throw new BadRequestException($"Unknown bonus type '{request.Type}'.");
            }

            if (request.Amount <= 0)
            {
                throw new BadRequestException("The bonus amount must be greater than zero.");
            }

            if (string.IsNullOrWhiteSpace(request.Reason))
            {
                throw new BadRequestException("A justification is required.");
            }

            await EnsureEmployeeInScopeAsync(actorUserId, gymId, request.EmployeeId, cancellationToken);

            var proposal = new BonusProposal
            {
                EmployeeId = request.EmployeeId,
                Type = request.Type,
                Amount = request.Amount,
                Reason = request.Reason.Trim(),
                Note = request.Note?.Trim(),
                IssuedBy = actorUserId,
                IssuedAt = DateTime.UtcNow,
                Status = ProposalStatus.Pending
            };

            await unitOfWork.GetRepository<BonusProposal, int>().AddAsync(proposal, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return await LoadBonusAsync(proposal.Id, cancellationToken);
        }

        public async Task<IReadOnlyList<BranchQueueItemDto>> GetPendingForHrAsync(
            int actorUserId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            await EnsureManagementScopeAsync(actorUserId, gymId, cancellationToken);
            var employeeIds = await ScopedEmployeeIdsAsync(actorUserId, gymId, cancellationToken);

            var items = new List<BranchQueueItemDto>();

            var deductions = await unitOfWork.GetRepository<DeductionCandidate, int>()
                .GetAllAsync(new DeductionCandidatesByEmployeesSpec(employeeIds), cancellationToken);
            items.AddRange(deductions
                .Where(d => d.Status is DeductionStatus.Pending or DeductionStatus.BranchApproved)
                .Select(d => new BranchQueueItemDto
                {
                    Id = d.Id,
                    Kind = "Deduction",
                    Employee = d.Employee?.FullName ?? string.Empty,
                    Detail = $"EGP {d.Amount} · {d.Reason}",
                    Date = d.IssuedAt,
                    Status = "Pending HR"
                }));

            var warnings = await unitOfWork.GetRepository<WarningNotice, int>()
                .GetAllAsync(new WarningNoticesByEmployeesSpec(employeeIds), cancellationToken);
            items.AddRange(warnings
                .Where(w => w.Status == ProposalStatus.Pending)
                .Select(w => new BranchQueueItemDto
                {
                    Id = w.Id,
                    Kind = "Warning",
                    Employee = w.Employee?.FullName ?? string.Empty,
                    Detail = $"{w.Type} · {w.Reason}",
                    Date = w.IssuedAt,
                    Status = "Pending HR"
                }));

            var bonuses = await unitOfWork.GetRepository<BonusProposal, int>()
                .GetAllAsync(new BonusProposalsByEmployeesSpec(employeeIds), cancellationToken);
            items.AddRange(bonuses
                .Where(b => b.Status == ProposalStatus.Pending)
                .Select(b => new BranchQueueItemDto
                {
                    Id = b.Id,
                    Kind = "Bonus",
                    Employee = b.Employee?.FullName ?? string.Empty,
                    Detail = $"EGP {b.Amount} · {b.Type}",
                    Date = b.IssuedAt,
                    Status = "Pending HR"
                }));

            return items.OrderByDescending(i => i.Date).ToList();
        }

        /// <summary>
        /// The branch/history reads only answer for an acting manager: a Team
        /// Leader sees his led team, a Branch Manager the whole gym; anyone else
        /// gets the same "not found" the raise endpoints answer with, so a plain
        /// employee cannot page through the branch's discipline data. HR rides
        /// along so it can re-price a deduction at month end through the same
        /// branch-review route the tab uses.
        /// </summary>
        private static readonly string[] ManagementRoleNames =
        [
            Shared.Authorization.RoleNames.TeamLeader,
            Shared.Authorization.RoleNames.BranchManager,
            Shared.Authorization.RoleNames.Hr,
            Shared.Authorization.RoleNames.HrManager,
            Shared.Authorization.RoleNames.SuperAdmin,
        ];

        private async Task EnsureManagementScopeAsync(int actorUserId, int gymId, CancellationToken cancellationToken)
        {
            var roleNames = await userAccess.GetGymRoleNamesAsync(actorUserId, gymId, cancellationToken);
            if (!roleNames.Any(ManagementRoleNames.Contains))
            {
                throw new NotFoundException("Employee not found.");
            }
        }

        public async Task<IReadOnlyList<DeductionCandidateDto>> GetDeductionsAsync(
            int actorUserId, int? employeeId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            await EnsureManagementScopeAsync(actorUserId, gymId, cancellationToken);
            var employeeIds = await ScopedEmployeeIdsAsync(actorUserId, gymId, cancellationToken);

            // This list is the branch's live view of attendance deductions: reconcile
            // the month first (idempotent), so an absence or late arrival that has
            // happened is already raised and priced by the time the tab renders. The
            // sweep clamps the window to the gym's local today itself.
            await deductionSweep.SweepAsync(
                employeeIds,
                new DateOnly(DateTime.Today.Year, DateTime.Today.Month, 1),
                DateOnly.MaxValue,
                cancellationToken);

            var candidates = await unitOfWork.GetRepository<DeductionCandidate, int>()
                .GetAllAsync(new DeductionCandidatesByEmployeesSpec(employeeIds), cancellationToken);

            var scoped = candidates
                .Where(d => employeeId is null || d.EmployeeId == employeeId)
                .ToList();
            var rates = await RatesForAsync(scoped, cancellationToken);

            return scoped
                .Select(d => ToDto(d, rates))
                .ToList();
        }

        /// <summary>
        /// Prices a deduction before it exists (the manager typing hours or days in a
        /// follow-up form): the same rates the saved row will use, so the preview can
        /// never disagree — and an hours-based size honestly reports "no amount yet"
        /// while the month's roster is incomplete.
        /// </summary>
        public async Task<DeductionPricingDto> PreviewDeductionAsync(
            int actorUserId,
            int employeeId,
            DateOnly? date,
            string? unit,
            decimal? value,
            int? activeGymId,
            CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            await EnsureManagementScopeAsync(actorUserId, gymId, cancellationToken);
            await EnsureEmployeeInScopeAsync(actorUserId, gymId, employeeId, cancellationToken);

            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            var day = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
            var chosenUnit = ParseUnit(unit);
            var chosenValue = value ?? 0m;

            var sheets = (await unitOfWork.GetRepository<PayrollEntry, int>()
                .GetAllAsync(new PayrollEntriesByEmployeeIdsSpec([employeeId]), cancellationToken)).ToList();
            var monthStart = new DateOnly(day.Year, day.Month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);
            var assignments = (await unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftAssignment, int>()
                .GetAllAsync(new ShiftAssignmentsByEmployeeIdsRangeSpec([employeeId], monthStart, monthEnd), cancellationToken))
                .ToList();

            var rates = DeductionPricing.Rates(employee, day, sheets, assignments);
            return new DeductionPricingDto
            {
                CandidateId = 0,
                DailyRate = rates.Daily,
                HourlyRate = rates.Hourly,
                HourlyRateReady = rates.HourlyKnown,
                AssignedHours = rates.AssignedHours,
                MonthDays = rates.MonthDays,
                DeductionUnit = chosenUnit.ToString(),
                DeductionValue = chosenValue,
                Amount = rates.AmountFor(chosenUnit, chosenValue),
                Days = rates.DaysFor(chosenUnit, chosenValue),
                PendingReason = chosenValue > 0 ? rates.PendingReason(chosenUnit) : null,
                Note = rates.Note(chosenUnit, chosenValue),
            };
        }

        /// <summary>
        /// The deductions waiting for the HR sign-off, for the HR Requests page: rows the
        /// branch has already sized (hours or days) and approved, each carrying both rates
        /// of its month so HR sees exactly how the money was reached.
        /// </summary>
        public async Task<IReadOnlyList<DeductionCandidateDto>> GetDeductionReviewQueueAsync(
            int actorUserId, string? status, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(unitOfWork, actorUserId, cancellationToken);
            if (actor.UserType != UserType.TopManagement)
            {
                var permissions = await userAccess.GetPermissionKeysAsync(actor.Id, cancellationToken);
                if (!permissions.Contains("payroll.view", StringComparer.Ordinal)
                    && !permissions.Contains("payroll.edit", StringComparer.Ordinal))
                {
                    throw new UnAuthorizedException("You do not have access to payroll deductions.");
                }
            }

            var gymIds = await HrPortalHelpers.ResolveGymScopeAsync(unitOfWork, userAccess, actor, null, cancellationToken);
            var employees = await unitOfWork.GetRepository<Employee, int>()
                .GetAllAsync(new EmployeesForRosterSpec(gymIds.Length == 0 && actor.UserType == UserType.TopManagement ? null : gymIds), cancellationToken);
            var employeeIds = employees.Select(e => e.Id).ToHashSet();
            if (employeeIds.Count == 0)
            {
                return [];
            }

            var statuses = ParseStatuses(status);
            var candidates = (await unitOfWork.GetRepository<DeductionCandidate, int>()
                    .GetAllAsync(new DeductionCandidatesByEmployeesSpec(employeeIds.ToArray()), cancellationToken))
                .Where(c => statuses.Contains(c.Status))
                .ToList();
            var rates = await RatesForAsync(candidates, cancellationToken);

            return candidates
                .OrderByDescending(c => c.IssuedAt)
                .Select(c => ToDto(c, rates))
                .ToList();
        }

        /// <summary>Status filter for the HR queue: default is "waiting for HR".</summary>
        private static DeductionStatus[] ParseStatuses(string? status)
        {
            var value = status?.Trim().ToLowerInvariant();
            return value switch
            {
                null or "" or "pending" or "branchapproved" or "review" => [DeductionStatus.BranchApproved],
                "approved" or "accepted" => [DeductionStatus.Approved],
                "rejected" or "waived" => [DeductionStatus.Rejected],
                "all" => [DeductionStatus.Pending, DeductionStatus.BranchApproved, DeductionStatus.Approved, DeductionStatus.Rejected],
                _ => throw new BadRequestException(
                    "status must be Pending, BranchApproved, Approved, Rejected or All."),
            };
        }

        /// <summary>One candidate with the rates of its punished month, so the branch sees what an
        /// hour or a day is worth before choosing the size.
        /// </summary>
        public async Task<DeductionPricingDto> GetDeductionPricingAsync(
            int actorUserId, int candidateId, string? unit, decimal? value, int? activeGymId, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            await EnsureManagementScopeAsync(actorUserId, gymId, cancellationToken);

            var candidate = await unitOfWork.GetRepository<DeductionCandidate, int>()
                .GetByIdAsync(new DeductionCandidateByIdSpec(candidateId), cancellationToken)
                ?? throw new NotFoundException("Deduction candidate not found.");
            await EnsureEmployeeInScopeAsync(actorUserId, gymId, candidate.EmployeeId, cancellationToken);

            var date = PayrollService.CandidateDayOf(candidate);
            var chosenUnit = unit is null ? candidate.DeductionUnit : ParseUnit(unit);
            var chosenValue = value ?? candidate.DeductionValue;
            var rates = await RatesForCandidateAsync(candidate, cancellationToken);

            return new DeductionPricingDto
            {
                CandidateId = candidate.Id,
                DailyRate = rates.Daily,
                HourlyRate = rates.Hourly,
                HourlyRateReady = rates.HourlyKnown,
                AssignedHours = rates.AssignedHours,
                MonthDays = rates.MonthDays,
                DeductionUnit = chosenUnit.ToString(),
                DeductionValue = chosenValue,
                Amount = rates.AmountFor(chosenUnit, chosenValue),
                Days = rates.DaysFor(chosenUnit, chosenValue),
                PendingReason = chosenValue > 0 ? rates.PendingReason(chosenUnit) : "Choose the deduction in hours or days.",
                Note = rates.Note(chosenUnit, chosenValue),
            };
        }

        /// <summary>
        /// The HR sign-off on a branch-sized deduction (the Requests page's Deductions
        /// tab). HR may re-size it (hours or days) or override the money, then approve
        /// (the payroll sheet picks it up as an accepted line) or waive it for good.
        /// </summary>
        public async Task<DeductionCandidateDto> ReviewDeductionCandidateAsync(
            int actorUserId, int candidateId, BranchDeductionReviewRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(unitOfWork, actorUserId, cancellationToken);
            if (actor.UserType != UserType.TopManagement)
            {
                var permissions = await userAccess.GetPermissionKeysAsync(actor.Id, cancellationToken);
                if (!permissions.Contains("payroll.edit", StringComparer.Ordinal)
                    && !permissions.Contains("payroll.view", StringComparer.Ordinal))
                {
                    throw new UnAuthorizedException("You do not have access to payroll deductions.");
                }
            }

            var candidate = await unitOfWork.GetRepository<DeductionCandidate, int>()
                .GetByIdAsync(new DeductionCandidateByIdSpec(candidateId), cancellationToken)
                ?? throw new NotFoundException("Deduction candidate not found.");

            var gymIds = await HrPortalHelpers.ResolveGymScopeAsync(unitOfWork, userAccess, actor, null, cancellationToken);
            if (gymIds.Length > 0 && candidate.Employee is not null && !gymIds.Contains(candidate.Employee.GymId))
            {
                throw new NotFoundException("Deduction candidate not found.");
            }

            if (candidate.Status is DeductionStatus.Approved)
            {
                throw new BadRequestException("This deduction is already finalized.");
            }

            // HR re-sizes through the same rates the branch used.
            if (request.Value is { } value)
            {
                if (value <= 0)
                {
                    throw new BadRequestException("The deduction size must be greater than zero.");
                }

                var unit = ParseUnit(request.Unit);
                candidate.DeductionUnit = unit;
                candidate.DeductionValue = value;
                (candidate.Amount, candidate.DeductionDays) = await PriceAsync(candidate, unit, value, cancellationToken);
            }

            switch (request.Decision?.Trim().ToLowerInvariant())
            {
                case "approve":
                    if (request.Amount is { } approvedAmount)
                    {
                        candidate.Amount = approvedAmount;
                    }

                    candidate.Status = DeductionStatus.Approved;
                    break;

                case "reject":
                case "waive":
                    candidate.Status = DeductionStatus.Rejected;
                    break;

                case "edit":
                    break;

                default:
                    throw new BadRequestException("The decision must be 'approve', 'reject' or 'edit'.");
            }

            candidate.ReviewedBy = actor.Id;
            candidate.ReviewedAt = DateTime.UtcNow;
            unitOfWork.GetRepository<DeductionCandidate, int>().Update(candidate);
            await unitOfWork.SaveChangesAsync(cancellationToken);
            return await LoadDeductionAsync(candidate.Id, cancellationToken);
        }

        /// <summary>Both rates of the month each candidate punishes, keyed by employee-month.</summary>
        private async Task<Dictionary<(int EmployeeId, int Year, int Month), DeductionRates>> RatesForAsync(
            IReadOnlyList<DeductionCandidate> candidates, CancellationToken cancellationToken)
        {
            var map = new Dictionary<(int, int, int), DeductionRates>();
            if (candidates.Count == 0)
            {
                return map;
            }

            var employeeIds = candidates.Select(c => c.EmployeeId).Distinct().ToArray();
            var dates = candidates.Select(PayrollService.CandidateDayOf).ToList();
            var from = dates.Min();
            var to = dates.Max();
            var rangeStart = new DateOnly(from.Year, from.Month, 1);
            var rangeEnd = new DateOnly(to.Year, to.Month, 1).AddMonths(1).AddDays(-1);

            var sheets = (await unitOfWork.GetRepository<PayrollEntry, int>()
                .GetAllAsync(new PayrollEntriesByEmployeeIdsSpec(employeeIds), cancellationToken)).ToList();
            var assignments = (await unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftAssignment, int>()
                .GetAllAsync(new ShiftAssignmentsByEmployeeIdsRangeSpec(employeeIds, rangeStart, rangeEnd), cancellationToken)).ToList();

            foreach (var candidate in candidates)
            {
                var date = PayrollService.CandidateDayOf(candidate);
                var key = (candidate.EmployeeId, date.Year, date.Month);
                if (map.ContainsKey(key) || candidate.Employee is null)
                {
                    continue;
                }

                map[key] = DeductionPricing.Rates(
                    candidate.Employee,
                    date,
                    sheets.Where(s => s.EmployeeId == candidate.EmployeeId).ToList(),
                    assignments);
            }

            return map;
        }

        private async Task<DeductionRates> RatesForCandidateAsync(
            DeductionCandidate candidate, CancellationToken cancellationToken)
        {
            var map = await RatesForAsync([candidate], cancellationToken);
            var date = PayrollService.CandidateDayOf(candidate);
            return map.TryGetValue((candidate.EmployeeId, date.Year, date.Month), out var rates)
                ? rates
                : default;
        }

        private static DeductionCandidateDto ToDto(
            DeductionCandidate candidate, IReadOnlyDictionary<(int, int, int), DeductionRates> rates)
        {
            var date = PayrollService.CandidateDayOf(candidate);
            rates.TryGetValue((candidate.EmployeeId, date.Year, date.Month), out var monthRates);

            return new DeductionCandidateDto
            {
                Id = candidate.Id,
                EmployeeId = candidate.EmployeeId,
                Employee = candidate.Employee?.FullName ?? string.Empty,
                Amount = candidate.Amount,
                DeductionDays = candidate.DeductionDays,
                DeductionValue = candidate.DeductionValue,
                DeductionUnit = candidate.DeductionUnit.ToString(),
                DailyRate = monthRates.Daily,
                HourlyRate = monthRates.Hourly,
                HourlyRateReady = monthRates.HourlyKnown,
                AssignedHours = monthRates.AssignedHours,
                MonthDays = monthRates.MonthDays,
                Reason = candidate.Reason,
                Note = candidate.Note,
                Status = candidate.Status.ToString(),
                Date = date,
                IssuedAt = candidate.IssuedAt,
                IssuedBy = candidate.IssuedByUser?.UserName ?? string.Empty,
            };
        }

        public async Task<IReadOnlyList<WarningNoticeDto>> GetWarningsAsync(
            int actorUserId, int? employeeId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            await EnsureManagementScopeAsync(actorUserId, gymId, cancellationToken);
            var employeeIds = await ScopedEmployeeIdsAsync(actorUserId, gymId, cancellationToken);

            var notices = await unitOfWork.GetRepository<WarningNotice, int>()
                .GetAllAsync(new WarningNoticesByEmployeesSpec(employeeIds), cancellationToken);

            return notices
                .Where(w => employeeId is null || w.EmployeeId == employeeId)
                .Select(w => new WarningNoticeDto
                {
                    Id = w.Id,
                    EmployeeId = w.EmployeeId,
                    Employee = w.Employee?.FullName ?? string.Empty,
                    Type = w.Type,
                    Reason = w.Reason,
                    Note = w.Note,
                    Status = w.Status.ToString(),
                    IssuedAt = w.IssuedAt,
                    IssuedBy = w.IssuedByUser?.UserName ?? string.Empty,
                })
                .ToList();
        }

        public async Task<IReadOnlyList<BonusProposalDto>> GetBonusesAsync(
            int actorUserId, int? employeeId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);
            await EnsureManagementScopeAsync(actorUserId, gymId, cancellationToken);
            var employeeIds = await ScopedEmployeeIdsAsync(actorUserId, gymId, cancellationToken);

            var proposals = await unitOfWork.GetRepository<BonusProposal, int>()
                .GetAllAsync(new BonusProposalsByEmployeesSpec(employeeIds), cancellationToken);

            return proposals
                .Where(b => employeeId is null || b.EmployeeId == employeeId)
                .Select(b => new BonusProposalDto
                {
                    Id = b.Id,
                    EmployeeId = b.EmployeeId,
                    Employee = b.Employee?.FullName ?? string.Empty,
                    Type = b.Type,
                    Amount = b.Amount,
                    Reason = b.Reason,
                    Note = b.Note,
                    Status = b.Status.ToString(),
                    IssuedAt = b.IssuedAt,
                    IssuedBy = b.IssuedByUser?.UserName ?? string.Empty,
                })
                .ToList();
        }

        public async Task SendReportAsync(int actorUserId, int? activeGymId, CreateBranchReportDto request, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);

            if (!ReportTypes.Contains(request.Type, StringComparer.OrdinalIgnoreCase))
            {
                throw new BadRequestException($"Unknown report type '{request.Type}'.");
            }

            if (string.IsNullOrWhiteSpace(request.Message))
            {
                throw new BadRequestException("A message is required.");
            }

            // The report lands in the HR action queue as a BranchReport event so it is
            // triaged next to the other hand-offs; it carries no pending-decision state.
            var report = new Event
            {
                GymId = gymId,
                Type = EventType.BranchReport,
                EntityType = "BranchReport",
                EntityId = 0,
                Title = string.IsNullOrWhiteSpace(request.Period)
                    ? request.Type
                    : $"{request.Type} · {request.Period}",
                Description = request.Message.Trim(),
                Status = EventStatus.Open
            };

            await unitOfWork.GetRepository<Event, int>().AddAsync(report, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        // ------------------------------------------------------------------
        // HR-side review (requests.view / requests.approve)
        // ------------------------------------------------------------------

        public async Task<ProposalListResponse<WarningNoticeDto>> GetWarningsAsync(
            int? actorUserId, ProposalListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(unitOfWork, actorUserId, cancellationToken);
            await accessControl.EnsurePermissionAsync(actor.Id, "requests.view", cancellationToken);
            var (scope, gymId, status, page, pageSize) = await ResolveProposalQueryAsync(actor, query, cancellationToken);

            var repository = unitOfWork.GetRepository<WarningNotice, int>();
            var total = await repository.CountAsync(new WarningNoticeListSpec(scope, gymId, status, 0, 0), cancellationToken);
            var rows = await repository.GetAllAsync(
                new WarningNoticeListSpec(scope, gymId, status, (page - 1) * pageSize, pageSize), cancellationToken);

            return new ProposalListResponse<WarningNoticeDto>
            {
                Items = rows.Select(MapWarning).ToList(),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = (int)Math.Ceiling(total / (double)pageSize),
            };
        }

        public async Task<ReviewProposalResponse<WarningNoticeDto>> ReviewWarningAsync(
            int? actorUserId, int noticeId, ReviewProposalRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(unitOfWork, actorUserId, cancellationToken);
            await accessControl.EnsurePermissionAsync(actor.Id, "requests.approve", cancellationToken);

            var notice = await unitOfWork.GetRepository<WarningNotice, int>()
                .GetByIdAsync(new WarningNoticeByIdSpec(noticeId), cancellationToken)
                ?? throw new NotFoundException("Warning notice not found.");
            await EnsureProposalInScopeAsync(actor, notice.Employee?.GymId, cancellationToken);

            EnsurePending(notice.Status);
            var (decision, note) = ResolveDecision(request);
            notice.Status = decision;
            notice.ReviewNote = note;
            notice.ReviewedBy = actor.Id;
            notice.ReviewedAt = DateTime.UtcNow;

            unitOfWork.GetRepository<WarningNotice, int>().Update(notice);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new ReviewProposalResponse<WarningNoticeDto> { Data = MapWarning(notice) };
        }

        public async Task<ProposalListResponse<BonusProposalDto>> GetBonusesAsync(
            int? actorUserId, ProposalListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(unitOfWork, actorUserId, cancellationToken);
            await accessControl.EnsurePermissionAsync(actor.Id, "requests.view", cancellationToken);
            var (scope, gymId, status, page, pageSize) = await ResolveProposalQueryAsync(actor, query, cancellationToken);

            var repository = unitOfWork.GetRepository<BonusProposal, int>();
            var total = await repository.CountAsync(new BonusProposalListSpec(scope, gymId, status, 0, 0), cancellationToken);
            var rows = await repository.GetAllAsync(
                new BonusProposalListSpec(scope, gymId, status, (page - 1) * pageSize, pageSize), cancellationToken);

            return new ProposalListResponse<BonusProposalDto>
            {
                Items = rows.Select(MapBonus).ToList(),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = (int)Math.Ceiling(total / (double)pageSize),
            };
        }

        public async Task<ReviewProposalResponse<BonusProposalDto>> ReviewBonusAsync(
            int? actorUserId, int proposalId, ReviewProposalRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(unitOfWork, actorUserId, cancellationToken);
            await accessControl.EnsurePermissionAsync(actor.Id, "requests.approve", cancellationToken);

            var proposal = await unitOfWork.GetRepository<BonusProposal, int>()
                .GetByIdAsync(new BonusProposalByIdSpec(proposalId), cancellationToken)
                ?? throw new NotFoundException("Bonus proposal not found.");
            await EnsureProposalInScopeAsync(actor, proposal.Employee?.GymId, cancellationToken);

            EnsurePending(proposal.Status);
            var (decision, note) = ResolveDecision(request);
            proposal.Status = decision;
            proposal.ReviewNote = note;
            proposal.ReviewedBy = actor.Id;
            proposal.ReviewedAt = DateTime.UtcNow;

            unitOfWork.GetRepository<BonusProposal, int>().Update(proposal);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new ReviewProposalResponse<BonusProposalDto> { Data = MapBonus(proposal) };
        }

        // ---------- helpers ----------

        /// <summary>Shared parsing for the HR proposal queues: gym scope, status, pager.</summary>
        private async Task<(int[]? Scope, int? GymId, ProposalStatus? Status, int Page, int PageSize)> ResolveProposalQueryAsync(
            User actor, ProposalListQuery query, CancellationToken cancellationToken)
        {
            var gymFilter = await HrPortalHelpers.ResolveGymFilterAsync(unitOfWork, query.Gym, cancellationToken);
            var scope = await HrPortalHelpers.ResolveGymScopeAsync(unitOfWork, userAccess, actor, gymFilter, cancellationToken);

            ProposalStatus? status = HrPortalHelpers.NullIfBlank(query.Status)?.ToLowerInvariant() switch
            {
                "pending" => ProposalStatus.Pending,
                "approved" => ProposalStatus.Approved,
                "rejected" => ProposalStatus.Rejected,
                null => null,
                var other => throw new BadRequestException($"Unknown status '{other}'."),
            };

            var page = Math.Max(query.Page, 1);
            var pageSize = HrPortalHelpers.NormalizePageSize(query.PageSize);
            return (scope, gymFilter, status, page, pageSize);
        }

        /// <summary>ADR-003: the acting HR user must be assigned to the proposal's gym (404 on mismatch).</summary>
        private async Task EnsureProposalInScopeAsync(User actor, int? employeeGymId, CancellationToken cancellationToken)
        {
            if (employeeGymId is null ||
                (actor.UserType != UserType.TopManagement &&
                 !await userAccess.HasGymAccessAsync(actor.Id, employeeGymId.Value, cancellationToken)))
            {
                // Out-of-scope items answer exactly like missing ones.
                throw new NotFoundException("Warning notice not found.");
            }
        }

        /// <summary>Pending → Approved/Rejected with the reviewer stamped; declines require a reason.</summary>
        private static (ProposalStatus Status, string? Note) ResolveDecision(ReviewProposalRequest request)
        {
            var decision = HrPortalHelpers.NullIfBlank(request.Decision)?.ToLowerInvariant();
            var note = HrPortalHelpers.NullIfBlank(request.Note);

            return decision switch
            {
                "approved" => (ProposalStatus.Approved, note),
                "rejected" when note is null =>
                    throw new BadRequestException("A reason is required to decline."),
                "rejected" => (ProposalStatus.Rejected, note),
                _ => throw new BadRequestException("Decision must be \"Approved\" or \"Rejected\"."),
            };
        }

        private static void EnsurePending(ProposalStatus current)
        {
            if (current != ProposalStatus.Pending)
            {
                throw new BadRequestException("This item has already been decided.");
            }
        }

        private static WarningNoticeDto MapWarning(WarningNotice notice) => new()
        {
            Id = notice.Id,
            EmployeeId = notice.EmployeeId,
            Employee = notice.Employee?.FullName ?? string.Empty,
            Type = notice.Type,
            Reason = notice.Reason,
            Note = notice.Note,
            Status = notice.Status.ToString(),
            IssuedAt = notice.IssuedAt,
            IssuedBy = notice.IssuedByUser?.UserName ?? string.Empty,
            ReviewedBy = notice.Reviewer?.UserName,
            ReviewedAt = notice.ReviewedAt,
            ReviewNote = notice.ReviewNote,
        };

        private static BonusProposalDto MapBonus(BonusProposal proposal) => new()
        {
            Id = proposal.Id,
            EmployeeId = proposal.EmployeeId,
            Employee = proposal.Employee?.FullName ?? string.Empty,
            Type = proposal.Type,
            Amount = proposal.Amount,
            Reason = proposal.Reason,
            Note = proposal.Note,
            Status = proposal.Status.ToString(),
            IssuedAt = proposal.IssuedAt,
            IssuedBy = proposal.IssuedByUser?.UserName ?? string.Empty,
            ReviewedBy = proposal.Reviewer?.UserName,
            ReviewedAt = proposal.ReviewedAt,
            ReviewNote = proposal.ReviewNote,
        };

        private async Task<DeductionCandidateDto> LoadDeductionAsync(int id, CancellationToken cancellationToken)
        {
            var candidate = await unitOfWork.GetRepository<DeductionCandidate, int>()
                .GetByIdAsync(new DeductionCandidateByIdSpec(id), cancellationToken)
                ?? throw new NotFoundException("Deduction candidate not found.");

            var date = PayrollService.CandidateDayOf(candidate);
            var rates = await RatesForCandidateAsync(candidate, cancellationToken);

            return ToDto(candidate, new Dictionary<(int, int, int), DeductionRates>
            {
                [(candidate.EmployeeId, date.Year, date.Month)] = rates,
            });
        }

        /// <summary>
        /// The money a manager-chosen size costs: hours are priced at the month's hourly
        /// rate (base ÷ assigned hours), days at its daily rate (base ÷ calendar days).
        /// Zero means the rate is not known yet — the caller keeps the row pending.
        /// </summary>
        private async Task<(decimal Amount, decimal Days)> PriceAsync(
            DeductionCandidate candidate,
            DeductionUnit unit,
            decimal value,
            CancellationToken cancellationToken)
        {
            var date = PayrollService.CandidateDayOf(candidate);
            var sheets = (await unitOfWork.GetRepository<PayrollEntry, int>()
                .GetAllAsync(new PayrollEntriesByEmployeeSpec(candidate.EmployeeId), cancellationToken)).ToList();
            var monthStart = new DateOnly(date.Year, date.Month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);
            var assignments = (await unitOfWork.GetRepository<DomainLayer.Models.SchedulingModule.ShiftAssignment, int>()
                .GetAllAsync(
                    new ShiftAssignmentsByEmployeeIdsRangeSpec([candidate.EmployeeId], monthStart, monthEnd),
                    cancellationToken)).ToList();

            var rates = DeductionPricing.Rates(candidate.Employee, date, sheets, assignments);

            // The note explains the money (or what is missing) exactly as the sweep writes it.
            var note = rates.Note(unit, value);
            candidate.Note = PayrollService.ParseAbsenceMarker(candidate.Note) == date
                ? $"{PayrollService.AbsenceMarker(date)} · {note}"
                : note;

            return (rates.AmountFor(unit, value), rates.DaysFor(unit, value));
        }

        private static DeductionUnit ParseUnit(string? unit) =>
            string.Equals(unit?.Trim(), "hours", StringComparison.OrdinalIgnoreCase)
                ? DeductionUnit.Hours
                : DeductionUnit.Days;

        private async Task<WarningNoticeDto> LoadWarningAsync(int id, CancellationToken cancellationToken)
        {
            var notice = await unitOfWork.GetRepository<WarningNotice, int>()
                .GetByIdAsync(new WarningNoticeByIdSpec(id), cancellationToken)
                ?? throw new NotFoundException("Warning notice not found.");

            return new WarningNoticeDto
            {
                Id = notice.Id,
                EmployeeId = notice.EmployeeId,
                Employee = notice.Employee?.FullName ?? string.Empty,
                Type = notice.Type,
                Reason = notice.Reason,
                Note = notice.Note,
                Status = notice.Status.ToString(),
                IssuedAt = notice.IssuedAt,
                IssuedBy = notice.IssuedByUser?.UserName ?? string.Empty
            };
        }

        private async Task<BonusProposalDto> LoadBonusAsync(int id, CancellationToken cancellationToken)
        {
            var proposal = await unitOfWork.GetRepository<BonusProposal, int>()
                .GetByIdAsync(new BonusProposalByIdSpec(id), cancellationToken)
                ?? throw new NotFoundException("Bonus proposal not found.");

            return new BonusProposalDto
            {
                Id = proposal.Id,
                EmployeeId = proposal.EmployeeId,
                Employee = proposal.Employee?.FullName ?? string.Empty,
                Type = proposal.Type,
                Amount = proposal.Amount,
                Reason = proposal.Reason,
                Note = proposal.Note,
                Status = proposal.Status.ToString(),
                IssuedAt = proposal.IssuedAt,
                IssuedBy = proposal.IssuedByUser?.UserName ?? string.Empty
            };
        }

        private async Task EnsureEmployeeInScopeAsync(
            int actorUserId, int gymId, int employeeId, CancellationToken cancellationToken)
        {
            var ids = await ScopedEmployeeIdsAsync(actorUserId, gymId, cancellationToken);
            if (!ids.Contains(employeeId))
            {
                // Out-of-scope targets answer exactly like a missing employee.
                throw new NotFoundException("Employee not found.");
            }
        }

        private async Task<List<int>> ScopedEmployeeIdsAsync(int actorUserId, int gymId, CancellationToken cancellationToken)
        {
            var ledTeamId = await teamScopeService.GetLedTeamIdAsync(actorUserId, gymId, cancellationToken);

            var employees = ledTeamId is not null
                ? await unitOfWork.GetRepository<Employee, int>().GetAllAsync(new EmployeesByTeamSpec(ledTeamId.Value), cancellationToken)
                : await unitOfWork.GetRepository<Employee, int>().GetAllAsync(new EmployeesByGymSpec(gymId), cancellationToken);

            // Resolve the actor's own employee row and exclude them: a BM or TL must
            // not be able to issue or view branch actions against themselves.
            var ownEmployee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByUserIdSpec(actorUserId), cancellationToken);

            return employees
                .Where(e => ownEmployee is null || e.Id != ownEmployee.Id)
                .Select(e => e.Id)
                .ToList();
        }

        private static int RequireGym(int? activeGymId) =>
            activeGymId ?? throw new UnAuthorizedException("This operation requires an active gym context.");
    }
}
