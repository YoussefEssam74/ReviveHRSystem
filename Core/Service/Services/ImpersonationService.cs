using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.PlatformModule;
using DomainLayer.Models.PlatformModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Shared.DataTransferObject.Platform;

namespace Service.Services
{
    /// <summary>
    /// Act-as sessions ("Enter gym workspace").
    ///
    /// The issued token keeps <c>userType</c> = TopManagement and carries
    /// <c>act</c>/<c>actSessionId</c>/<c>actCompanyId</c>/<c>actRoleId</c>. A Super Admin working
    /// inside a company is therefore never mistaken for a real HR Manager, and every write made
    /// during the session stays attributable to them.
    ///
    /// The "an act-as token may never call <c>platform.*</c>" rule is enforced centrally in
    /// middleware, not here: a per-controller check is the kind of thing a future endpoint
    /// silently forgets.
    /// </summary>
    public sealed class ImpersonationService(
        IUnitOfWork _unitOfWork,
        IAccessControlService _accessControl,
        ITokenService _tokenService) : IImpersonationService
    {
        /// <summary>Hard ceiling on a session, per the specification's security requirements.</summary>
        private const int MaxSessionMinutes = 60;

        private const int MinimumReasonLength = 5;

        public async Task<StartImpersonationResponse> StartAsync(
            int? actorUserId,
            StartImpersonationRequest request,
            string? ipAddress,
            CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.impersonate", cancellationToken);

            // Impersonation is the Super Admin's own capability. An HR Manager holding it would
            // let the HR lead act as a branch role and widen its own reach.
            if (actor.UserType != UserType.TopManagement)
            {
                throw new BadRequestException("Only a Super Admin can enter a gym workspace.");
            }

            var reason = request.Reason?.Trim();
            if (string.IsNullOrWhiteSpace(reason) || reason.Length < MinimumReasonLength)
            {
                throw new BadRequestException($"A reason of at least {MinimumReasonLength} characters is required.");
            }

            var company = await _unitOfWork.GetRepository<Company, int>()
                .GetByIdAsync(new CompanyByIdSpec(request.CompanyId), cancellationToken)
                ?? throw new NotFoundException("Company not found.");

            if (company.Status is CompanyStatus.Suspended or CompanyStatus.Closed)
            {
                throw new BadRequestException(
                    "This company is suspended or closed, so its workspace cannot be entered.");
            }

            var branches = await _unitOfWork.GetRepository<Gym, int>()
                .GetAllAsync(new BranchesByCompanySpec(company.Id), cancellationToken);

            var activeBranches = branches.Where(b => b.Status == GymStatus.Active).ToList();

            int? branchId = null;
            if (request.BranchId is int requestedBranch)
            {
                var branch = activeBranches.FirstOrDefault(b => b.Id == requestedBranch)
                    ?? throw new BadRequestException("The selected branch does not belong to this company or is not active.");
                branchId = branch.Id;
            }
            else
            {
                // A workspace needs a branch binding: the gym-scoped endpoints resolve scope from
                // the token's gymId. The company's first active branch is the natural default.
                branchId = activeBranches.OrderBy(b => b.Id).FirstOrDefault()?.Id;
            }

            var role = await ResolveEffectiveRoleAsync(request.EffectiveRoleId, cancellationToken);

            var now = DateTime.UtcNow;
            var expiresAt = now.AddMinutes(MaxSessionMinutes);

            // Starting a new session ends the actor's previous one, so a Super Admin can never
            // leave two workspaces open (and two tokens in flight) by accident.
            await EndOpenSessionsAsync(actor.Id, now, cancellationToken);

            var session = new ImpersonationSession
            {
                ActorUserId = actor.Id,
                CompanyId = company.Id,
                BranchId = branchId,
                EffectiveRoleId = role?.Id,
                StartedAt = now,
                ExpiresAt = expiresAt,
                IpAddress = ipAddress,
                Reason = reason,
            };

            await _unitOfWork.GetRepository<ImpersonationSession, int>().AddAsync(session, cancellationToken);

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Entered gym workspace",
                category: "Access",
                severity: "info",
                entityType: "ImpersonationSession",
                entityId: 0,
                companyId: company.Id,
                gymId: branchId,
                target: $"{company.Name}{DescribeBranch(activeBranches, branchId)}",
                detail: $"Acting as {role?.Name ?? "the company's own scope"}. Reason: {reason}. "
                        + $"Session ends at {expiresAt:HH:mm} UTC.",
                values: new { request.CompanyId, branchId, EffectiveRoleId = role?.Id, reason },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var accessToken = _tokenService.CreateImpersonationToken(
                actor, branchId, session.Id, company.Id, role?.Id, expiresAt);

            var branchRef = branchId is int id
                ? activeBranches.Where(b => b.Id == id)
                    .Select(b => new ImpersonationBranchRef { Id = b.Id, Name = b.Name })
                    .FirstOrDefault()
                : null;

            return new StartImpersonationResponse
            {
                SessionId = session.Id,
                AccessToken = accessToken,
                ExpiresInSeconds = (int)(expiresAt - now).TotalSeconds,
                Company = new ImpersonationCompanyRef { Id = company.Id, Name = company.Name, City = company.City },
                Branch = branchRef,
                EffectiveRole = role is null
                    ? null
                    : new ImpersonationRoleRef { Id = role.Id, Name = role.Name },
                Actor = new ImpersonationActorRef
                {
                    UserId = actor.Id,
                    Name = actor.UserName,
                    UserType = actor.UserType.ToString(),
                },
                StartedAt = now,
                ExpiresAt = expiresAt,
            };
        }

        public async Task<EndImpersonationResponse> EndAsync(int? actorUserId, int sessionId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);

            var repository = _unitOfWork.GetRepository<ImpersonationSession, int>();
            var session = await repository.GetByIdAsync(new ImpersonationSessionByIdSpec(sessionId), cancellationToken)
                          ?? throw new NotFoundException("Session not found.");

            // Only the actor who opened it may close it — an act-as token belongs to them alone.
            if (session.ActorUserId != actor.Id)
            {
                throw new UnAuthorizedException("This workspace session belongs to another account.");
            }

            if (session.EndedAt is not null)
            {
                throw new BadRequestException("This workspace session has already ended.");
            }

            var endedAt = DateTime.UtcNow;
            session.EndedAt = endedAt;
            repository.Update(session);

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Left gym workspace",
                category: "Access",
                severity: "info",
                entityType: "ImpersonationSession",
                entityId: session.Id,
                companyId: session.CompanyId,
                gymId: session.BranchId,
                target: session.Company?.Name ?? $"Company #{session.CompanyId}",
                detail: $"Session closed after {Math.Max(0, (int)Math.Round((endedAt - session.StartedAt).TotalMinutes))} minute(s).",
                values: new { session.Id },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new EndImpersonationResponse
            {
                SessionId = session.Id,
                EndedAt = endedAt,
                DurationMinutes = Math.Max(0, (int)Math.Round((endedAt - session.StartedAt).TotalMinutes)),
            };
        }

        public async Task<CurrentImpersonationResponse> GetCurrentAsync(
            int? actorUserId,
            int? sessionId,
            CancellationToken cancellationToken = default)
        {
            if (actorUserId is null or <= 0 || sessionId is null or <= 0)
            {
                return new CurrentImpersonationResponse { Active = false };
            }

            var session = await _unitOfWork.GetRepository<ImpersonationSession, int>()
                .GetByIdAsync(new ImpersonationSessionByIdSpec(sessionId.Value), cancellationToken);

            // An expired or closed session reports inactive: the caller's token is still
            // cryptographically valid, but it no longer represents a usable workspace.
            if (session is null
                || session.ActorUserId != actorUserId.Value
                || session.EndedAt is not null
                || session.ExpiresAt <= DateTime.UtcNow)
            {
                return new CurrentImpersonationResponse { Active = false };
            }

            var branchName = session.BranchId is int branchId
                ? (await _unitOfWork.GetRepository<Gym, int>().GetByIdAsync(branchId, cancellationToken))?.Name
                : null;

            return new CurrentImpersonationResponse
            {
                Active = true,
                SessionId = session.Id,
                CompanyId = session.CompanyId,
                CompanyName = session.Company?.Name,
                BranchId = session.BranchId,
                BranchName = branchName,
                EffectiveRole = session.EffectiveRole?.Name,
                ActorName = session.ActorUser?.UserName,
                StartedAt = session.StartedAt,
                ExpiresAt = session.ExpiresAt,
            };
        }

        public async Task<LauncherRoleOptionsResponse> GetLauncherRolesAsync(int? actorUserId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.impersonate", cancellationToken);

            var roles = await _unitOfWork.GetRepository<Role, int>().GetAllAsync(cancellationToken);

            // Only the gym-facing presets are sensible to act as. Platform and Super Admin scopes
            // are excluded: assuming them would widen the session beyond the workspace.
            var allowed = new[] { RoleNames.HrManager, RoleNames.Hr, RoleNames.BranchManager, RoleNames.TeamLeader };

            return new LauncherRoleOptionsResponse
            {
                Items = roles
                    .Where(r => r.IsPreset && allowed.Contains(r.Name))
                    .OrderBy(r => Array.IndexOf(allowed, r.Name))
                    .Select(r => new LauncherRoleOption
                    {
                        RoleId = r.Id,
                        Name = r.Name,
                        Type = r.IsPreset ? "System" : "Custom",
                        Scope = r.Name switch
                        {
                            RoleNames.HrManager => "AllCompanies",
                            RoleNames.Hr => "AssignedCompanies",
                            RoleNames.BranchManager => "OneBranch",
                            RoleNames.TeamLeader => "OneTeam",
                            _ => "OwnProfile",
                        },
                    })
                    .ToList(),
            };
        }

        // ------------------------------------------------------------------
        // Internals
        // ------------------------------------------------------------------

        private async Task EndOpenSessionsAsync(int actorUserId, DateTime endedAt, CancellationToken cancellationToken)
        {
            var repository = _unitOfWork.GetRepository<ImpersonationSession, int>();
            var open = await repository.GetAllAsync(
                new OpenImpersonationSessionsForActorSpec(actorUserId), cancellationToken);

            foreach (var session in open)
            {
                session.EndedAt = endedAt;
                repository.Update(session);
            }
        }

        /// <summary>
        /// Resolves the role to act as. Defaults to the HR Manager preset — the capability set the
        /// specification says a Super Admin inherits inside a workspace.
        /// </summary>
        private async Task<Role?> ResolveEffectiveRoleAsync(int? effectiveRoleId, CancellationToken cancellationToken)
        {
            var repository = _unitOfWork.GetRepository<Role, int>();

            if (effectiveRoleId is int roleId)
            {
                var role = await repository.GetByIdAsync(roleId, cancellationToken)
                    ?? throw new NotFoundException("Role not found.");

                if (role.Name == RoleNames.SuperAdmin)
                {
                    throw new BadRequestException("A workspace session cannot assume the Super Admin role.");
                }

                return role;
            }

            return await repository.GetByIdAsync(new RoleByNameSpec(RoleNames.HrManager), cancellationToken);
        }

        private static string DescribeBranch(IReadOnlyList<Gym> branches, int? branchId) =>
            branchId is int id && branches.FirstOrDefault(b => b.Id == id) is { } branch
                ? $" — {branch.Name}"
                : string.Empty;
    }
}
