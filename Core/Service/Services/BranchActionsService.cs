using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.NotificationModule.Enums;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.PayrollModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.EmployeeProfile;

namespace Service.Services
{
    /// <summary>
    /// Branch Actions queue (mock §20). Deductions ride on the attendance feature,
    /// warnings and bonuses on the employees feature (enforced by the controller);
    /// here the service validates the target is in scope (team for Team Leaders, gym
    /// for Branch Managers) and always issues at the active gym with status Pending.
    /// </summary>
    public class BranchActionsService(
        IUnitOfWork unitOfWork,
        ITeamScopeService teamScopeService) : IBranchActionsService
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

        public async Task<WarningNoticeDto> IssueWarningAsync(
            int actorUserId, int? activeGymId, CreateWarningNoticeDto request, CancellationToken cancellationToken = default)
        {
            var gymId = RequireGym(activeGymId);

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

        // ---------- helpers ----------

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

            return employees.Select(e => e.Id).ToList();
        }

        private static int RequireGym(int? activeGymId) =>
            activeGymId ?? throw new UnAuthorizedException("This operation requires an active gym context.");
    }
}
