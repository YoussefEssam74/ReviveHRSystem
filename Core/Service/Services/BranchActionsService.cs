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

            if (request.Amount <= 0)
            {
                throw new BadRequestException("The deduction amount must be greater than zero.");
            }

            if (!DeductionReasons.Contains(request.Reason, StringComparer.OrdinalIgnoreCase))
            {
                throw new BadRequestException($"Unknown deduction reason '{request.Reason}'.");
            }

            await EnsureEmployeeInScopeAsync(actorUserId, gymId, request.EmployeeId, cancellationToken);

            var candidate = new DeductionCandidate
            {
                EmployeeId = request.EmployeeId,
                Amount = request.Amount,
                Reason = request.Reason,
                Note = request.Note?.Trim(),
                IssuedBy = actorUserId,
                IssuedAt = DateTime.UtcNow,
                Status = DeductionStatus.Pending
            };

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

            if (candidate.Status is DeductionStatus.Rejected or DeductionStatus.Approved)
            {
                throw new BadRequestException(
                    "This deduction is already finalized — rejected and applied deductions can no longer change.");
            }

            var amount = request.Amount;
            if (amount is { } revised && revised <= 0)
            {
                throw new BadRequestException("The deduction amount must be greater than zero.");
            }

            switch (request.Decision?.Trim().ToLowerInvariant())
            {
                case "approve":
                    if (amount is not null)
                    {
                        candidate.Amount = amount.Value;
                    }
                    candidate.Status = DeductionStatus.BranchApproved;
                    break;

                case "reject":
                    candidate.Status = DeductionStatus.Rejected;
                    break;

                case "edit" when amount is not null:
                    candidate.Amount = amount.Value;
                    break;

                case "edit":
                    throw new BadRequestException("Re-pricing a deduction requires the new amount.");

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
                .Where(d => d.Status == DeductionStatus.Pending)
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

            return candidates
                .Where(d => employeeId is null || d.EmployeeId == employeeId)
                .Select(d => new DeductionCandidateDto
                {
                    Id = d.Id,
                    EmployeeId = d.EmployeeId,
                    Employee = d.Employee?.FullName ?? string.Empty,
                    Amount = d.Amount,
                    Reason = d.Reason,
                    Note = d.Note,
                    Status = d.Status.ToString(),
                    Date = PayrollService.CandidateDayOf(d),
                    IssuedAt = d.IssuedAt,
                    IssuedBy = d.IssuedByUser?.UserName ?? string.Empty,
                })
                .ToList();
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

            return new DeductionCandidateDto
            {
                Id = candidate.Id,
                EmployeeId = candidate.EmployeeId,
                Employee = candidate.Employee?.FullName ?? string.Empty,
                Amount = candidate.Amount,
                Reason = candidate.Reason,
                Note = candidate.Note,
                Status = candidate.Status.ToString(),
                Date = PayrollService.CandidateDayOf(candidate),
                IssuedAt = candidate.IssuedAt,
                IssuedBy = candidate.IssuedByUser?.UserName ?? string.Empty
            };
        }

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
