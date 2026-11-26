using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.BillingModule;
using DomainLayer.Models.BillingModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.PayrollModule;
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
    /// Gym company (tenant) administration for the Super Admin console.
    ///
    /// A company owns one or more branches (<see cref="Gym"/>) and carries the
    /// subscription, seat/branch limits and invoices. The console is reachable only by
    /// Top Management and HR Manager; every method re-checks the actor's permission key
    /// so a mis-issued token cannot slip past the controller.
    /// </summary>
    public sealed class CompanyService(
        IUnitOfWork _unitOfWork,
        IAccessControlService _accessControl,
        IUserAccessRepository _userAccess,
        IPlatformReadRepository _readModel) : ICompanyService
    {
        // ------------------------------------------------------------------
        // Companies
        // ------------------------------------------------------------------

        public async Task<CompanyListResponse> GetCompaniesAsync(int? actorUserId, CompanyListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.companies.view", cancellationToken);

            var page = Math.Max(1, query.PageNumber);
            var pageSize = Math.Clamp(query.PageSize, 1, 100);

            var repository = _unitOfWork.GetRepository<Company, int>();
            var companies = (await repository.GetAllAsync(
                new CompanyListSpec(query.Search, query.Status, query.PlanId), cancellationToken)).ToList();

            var branchCounts = await _readModel.GetBranchCountsAsync(cancellationToken);
            var userCounts = await _readModel.GetUserCountsByCompanyAsync(cancellationToken);
            var payrollByCompany = await LoadPayrollStatusAsync(companies.Select(c => c.Id).ToList(), cancellationToken);

            var rows = companies.Select(c => BuildListItem(c, branchCounts, userCounts, payrollByCompany)).ToList();
            rows = SortCompanies(rows, query.SortBy, query.SortDir).ToList();

            var total = rows.Count;
            var pageItems = rows.Skip((page - 1) * pageSize).Take(pageSize).ToList();

            return new CompanyListResponse
            {
                Items = pageItems,
                Page = page,
                PageSize = pageSize,
                TotalCount = total,
                TotalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize)),
            };
        }

        public async Task<CompanyDetailResponse> GetCompanyAsync(int? actorUserId, int companyId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.companies.view", cancellationToken);

            var company = await LoadCompanyAsync(companyId, cancellationToken);
            return await BuildDetailAsync(company, cancellationToken);
        }

        public async Task<CreateCompanyResponse> CreateCompanyAsync(int? actorUserId, CreateCompanyRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.companies.create", cancellationToken);

            var name = RequireText(request.Name, "Company name");
            var code = string.IsNullOrWhiteSpace(request.Code)
                ? await GenerateUniqueCodeAsync(name, cancellationToken)
                : RequireText(request.Code, "Company code").ToUpperInvariant();
            var email = RequireText(request.Contact.Email, "Billing contact email");
            var branchName = RequireText(request.PrimaryBranch.Name, "Primary branch name");

            if (request.HrStaffIds is { Count: > 0 } && request.AssignHrLater)
            {
                throw new BadRequestException("Assign HR staff now, or choose to decide later — not both.");
            }

            if (await _unitOfWork.GetRepository<Company, int>().GetByIdAsync(new CompanyByCodeSpec(code), cancellationToken) is not null)
            {
                throw new BadRequestException($"Company code '{code}' is already in use.");
            }

            var planRepository = _unitOfWork.GetRepository<SubscriptionPlan, int>();
            var plan = await planRepository.GetByIdAsync(new PlanDetailSpec(request.Subscription.PlanId), cancellationToken)
                       ?? throw new NotFoundException("Subscription plan not found.");

            if (plan.IsArchived)
            {
                throw new BadRequestException($"The plan '{plan.Name}' is archived and cannot be assigned.");
            }

            if (request.Subscription.StartTrial && plan.TrialMode == TrialMode.None)
            {
                throw new BadRequestException($"The plan '{plan.Name}' does not include a trial period.");
            }

            var hrUsers = await ResolveHrUsersAsync(request.HrStaffIds, cancellationToken);
            if (hrUsers.Count > 0)
            {
                await EnsureSeatAllowanceAsync(plan.SeatLimit, null, hrUsers.Count, cancellationToken);
            }

            Company? created = null;
            Gym? primaryBranch = null;
            CompanySubscription? subscription = null;

            await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                var now = DateTime.UtcNow;

                created = new Company
                {
                    Name = name,
                    Code = code,
                    City = Clean(request.City),
                    LogoUrl = Clean(request.LogoUrl),
                    Status = request.Subscription.StartTrial ? CompanyStatus.Trial : CompanyStatus.Active,
                    ContactName = Clean(request.Contact.Name),
                    ContactEmail = email,
                    ContactPhone = Clean(request.Contact.Phone),
                };
                await _unitOfWork.GetRepository<Company, int>().AddAsync(created, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);

                primaryBranch = new Gym
                {
                    CompanyId = created.Id,
                    Name = branchName,
                    Location = Clean(request.PrimaryBranch.Area) ?? Clean(request.City) ?? "Main",
                    ContactInfo = Clean(request.PrimaryBranch.Phone),
                    Status = GymStatus.Active,
                };
                await _unitOfWork.GetRepository<Gym, int>().AddAsync(primaryBranch, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);

                var periodStart = DateOnly.FromDateTime(now);
                var periodEnd = ComputePeriodEnd(periodStart, plan.CycleCount, plan.CycleUnit);

                subscription = new CompanySubscription
                {
                    CompanyId = created.Id,
                    PlanId = plan.Id,
                    Status = request.Subscription.StartTrial ? SubscriptionStatus.Trial : SubscriptionStatus.Active,
                    StartedOn = now,
                    CurrentPeriodStart = now,
                    CurrentPeriodEnd = DateTime.SpecifyKind(periodEnd.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc),
                    TrialEndsOn = request.Subscription.StartTrial && plan.TrialDays > 0 ? now.AddDays(plan.TrialDays) : null,
                    RenewsOn = request.Subscription.StartTrial && plan.TrialDays > 0
                        ? now.AddDays(plan.TrialDays)
                        : DateTime.SpecifyKind(periodEnd.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc),
                };
                await _unitOfWork.GetRepository<CompanySubscription, int>().AddAsync(subscription, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);

                foreach (var hrUser in hrUsers)
                {
                    await _userAccess.AddGymAccessAsync(hrUser.Id, primaryBranch.Id, cancellationToken);
                }
                await _unitOfWork.SaveChangesAsync(cancellationToken);

                await PlatformHelpers.WriteAuditAsync(
                    _unitOfWork, actor,
                    action: "Created company account",
                    category: "Gym",
                    severity: "info",
                    entityType: "Company",
                    entityId: created.Id,
                    companyId: created.Id,
                    gymId: primaryBranch.Id,
                    target: $"{created.Name} — {created.City}".TrimEnd(' ', '—'),
                    detail: $"Provisioned on {plan.Name}{(request.Subscription.StartTrial ? $" ({plan.TrialDays}-day trial)" : $"{PlatformHelpers.CycleLabel(plan.CycleCount, plan.CycleUnit)}")}. "
                            + $"Seat limit {plan.SeatLimit?.ToString() ?? "unlimited"}. {hrUsers.Count} HR staff assigned.",
                    values: new { request.Name, Code = code, PlanId = plan.Id, request.Subscription.StartTrial, HrStaff = hrUsers.Count },
                    cancellationToken);

                foreach (var hrUser in hrUsers)
                {
                    await PlatformHelpers.WriteAuditAsync(
                        _unitOfWork, actor,
                        action: "Assigned HR to company",
                        category: "User",
                        severity: "info",
                        entityType: "User",
                        entityId: hrUser.Id,
                        companyId: created.Id,
                        gymId: primaryBranch.Id,
                        target: $"{hrUser.UserName} · {created.Name}",
                        detail: "HR access granted during company provisioning.",
                        values: null,
                        cancellationToken);
                }

                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }, cancellationToken);

            var mrr = request.Subscription.StartTrial
                ? 0m
                : PlatformHelpers.MonthlyValue(plan.Price, plan.CycleCount, plan.CycleUnit);

            return new CreateCompanyResponse
            {
                Id = created!.Id,
                Code = created.Code,
                Name = created.Name,
                Status = PlatformHelpers.CompanyStatusLabel(created.Status),
                PrimaryBranchId = primaryBranch!.Id,
                AssignedHrStaffCount = hrUsers.Count,
                CreatedAt = created.CreatedAt,
                Subscription = new CompanySubscriptionSummaryDto
                {
                    PlanId = plan.Id,
                    PlanName = plan.Name,
                    Status = PlatformHelpers.SubscriptionStatusLabel(subscription!.Status),
                    TrialEndsOn = subscription.TrialEndsOn,
                    SeatLimit = plan.SeatLimit,
                    BranchLimit = plan.BranchLimit,
                    Mrr = mrr,
                },
            };
        }

        public async Task<CompanyDetailResponse> UpdateCompanyAsync(int? actorUserId, int companyId, UpdateCompanyRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.companies.edit", cancellationToken);

            var repository = _unitOfWork.GetRepository<Company, int>();
            var company = await repository.GetByIdAsync(companyId, cancellationToken)
                          ?? throw new NotFoundException("Company not found.");

            var name = RequireText(request.Name, "Company name");
            var email = RequireText(request.Contact.Email, "Billing contact email");

            var before = new { company.Name, company.City, company.ContactEmail };

            company.Name = name;
            company.City = Clean(request.City);
            company.LogoUrl = Clean(request.LogoUrl);
            company.ContactName = Clean(request.Contact.Name);
            company.ContactEmail = email;
            company.ContactPhone = Clean(request.Contact.Phone);
            repository.Update(company);

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Updated company profile",
                category: "Gym",
                severity: "info",
                entityType: "Company",
                entityId: company.Id,
                companyId: company.Id,
                gymId: null,
                target: company.Name,
                detail: "Company profile and billing contact updated.",
                values: new { Before = before, After = new { company.Name, company.City, company.ContactEmail } },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var reloaded = await LoadCompanyAsync(companyId, cancellationToken);
            return await BuildDetailAsync(reloaded, cancellationToken);
        }

        public async Task<CompanyStatusChangeResponse> ChangeStatusAsync(int? actorUserId, int companyId, UpdateCompanyStatusRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.companies.status", cancellationToken);

            var repository = _unitOfWork.GetRepository<Company, int>();
            var company = await repository.GetByIdAsync(companyId, cancellationToken)
                          ?? throw new NotFoundException("Company not found.");

            var target = ParseTargetStatus(request.Status);
            var previous = company.Status;

            if (previous == target)
            {
                throw new BadRequestException($"The company is already {PlatformHelpers.CompanyStatusLabel(target).ToLowerInvariant()}.");
            }

            if (previous == CompanyStatus.Closed)
            {
                throw new BadRequestException("A closed company account cannot be reopened.");
            }

            if (target == CompanyStatus.Suspended)
            {
                if (string.IsNullOrWhiteSpace(request.Reason))
                {
                    throw new BadRequestException("A reason is required when suspending a company.");
                }
            }
            else if (target == CompanyStatus.Active && !string.IsNullOrWhiteSpace(request.Reason))
            {
                throw new BadRequestException("A reason is only accepted when suspending a company.");
            }

            if (target == CompanyStatus.Closed)
            {
                if (!string.Equals(request.ConfirmCode?.Trim(), company.Code, StringComparison.OrdinalIgnoreCase))
                {
                    throw new BadRequestException("Type the company code exactly to confirm closing the account.");
                }

                var openInvoices = await _unitOfWork.GetRepository<Invoice, int>()
                    .GetAllAsync(new InvoicesByCompanySpec(companyId), cancellationToken);
                if (openInvoices.Any(i => i.Status is InvoiceStatus.Open or InvoiceStatus.Overdue))
                {
                    throw new BadRequestException("Settle or void the open invoices before closing the company.");
                }
            }

            company.Status = target;
            company.ClosedAt = target == CompanyStatus.Closed ? DateTime.UtcNow : null;
            repository.Update(company);

            var revoked = target is CompanyStatus.Suspended or CompanyStatus.Closed
                ? await RevokeCompanySessionsAsync(companyId, cancellationToken)
                : 0;

            var label = target switch
            {
                CompanyStatus.Suspended => "Suspended company account",
                CompanyStatus.Closed => "Closed company account",
                _ => "Restored company account",
            };

            var severity = target switch
            {
                CompanyStatus.Suspended => "warning",
                CompanyStatus.Closed => "critical",
                _ => "info",
            };

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: label,
                category: "Gym",
                severity: severity,
                entityType: "Company",
                entityId: company.Id,
                companyId: company.Id,
                gymId: null,
                target: company.Name,
                detail: Clean(request.Reason)
                        ?? (target == CompanyStatus.Active
                            ? "Account restored to Active."
                            : "Account closed from the Super Admin console."),
                values: new { Previous = previous.ToString(), Current = target.ToString(), SessionsRevoked = revoked },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var blocked = target is CompanyStatus.Suspended or CompanyStatus.Closed or CompanyStatus.PaymentOverdue;

            return new CompanyStatusChangeResponse
            {
                Id = company.Id,
                Status = PlatformHelpers.CompanyStatusLabel(target),
                PayrollBlocked = blocked,
                SignInBlocked = blocked,
                SessionsRevoked = revoked,
                ChangedAt = DateTime.UtcNow,
            };
        }

        // ------------------------------------------------------------------
        // Company tabs
        // ------------------------------------------------------------------

        public async Task<CompanyOverviewResponse> GetOverviewAsync(int? actorUserId, int companyId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.companies.view", cancellationToken);

            var company = await LoadCompanyAsync(companyId, cancellationToken);
            var subscription = ActiveSubscription(company);
            var plan = subscription?.Plan;

            var breakdown = await _readModel.GetCompanyRoleBreakdownAsync(companyId, cancellationToken);
            var trend = await _readModel.GetAttendanceTrendAsync(companyId, 14, cancellationToken);
            var payroll = await LoadLatestPayrollAsync(companyId, cancellationToken);

            return new CompanyOverviewResponse
            {
                RoleBreakdown = new CompanyRoleBreakdownDto
                {
                    Hr = breakdown.Hr,
                    BranchManager = breakdown.BranchManagers,
                    TeamLeader = breakdown.TeamLeaders,
                    Employee = breakdown.Employees,
                    Total = breakdown.Total,
                },
                AttendanceTrend14d = trend,
                AttendanceTotal14d = trend.Sum(),
                AccountFacts = new CompanyAccountFactsDto
                {
                    PlanName = plan?.Name ?? "—",
                    BillingCycle = plan is null ? null : PlatformHelpers.CycleLabel(plan.CycleCount, plan.CycleUnit),
                    SubscribedOn = subscription?.StartedOn,
                    RenewsOn = subscription?.RenewsOn,
                    MonthlyValue = subscription is null || subscription.Status == SubscriptionStatus.Trial
                        ? 0
                        : PlatformHelpers.MonthlyValue(subscription.PriceOverride ?? plan!.Price, plan!.CycleCount, plan.CycleUnit),
                    PayrollStatus = PlatformHelpers.PayrollStatusLabel(payroll, company.Status == CompanyStatus.PaymentOverdue),
                    LastActivityAt = await LoadLastActivityAsync(companyId, cancellationToken),
                },
            };
        }

        public async Task<CompanyEmployeesResponse> GetEmployeesAsync(int? actorUserId, int companyId, CompanyEmployeeQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.companies.view", cancellationToken);

            var company = await LoadCompanyAsync(companyId, cancellationToken);
            var users = (await _unitOfWork.GetRepository<User, int>()
                .GetAllAsync(new CompanyUsersSpec(companyId), cancellationToken)).ToList();

            // Role per user, resolved from the per-gym role in THIS company's branches,
            // falling back to the user type when no per-gym role is held.
            var branchIds = company.Branches.Select(b => b.Id).ToHashSet();
            var roleIdByUser = await _readModel.GetUserRoleIdsInCompanyAsync(companyId, cancellationToken);
            var roleNames = (await _unitOfWork.GetRepository<Role, int>().GetAllAsync(cancellationToken))
                .ToDictionary(r => r.Id, r => r.Name);
            var roleIdByName = roleNames.ToDictionary(pair => pair.Value, pair => pair.Key, StringComparer.Ordinal);

            var employeeIds = await LoadEmployeeIdsAsync(branchIds, cancellationToken);

            // Platform-wide role, used only when the user holds no role in this company.
            int? GlobalRoleId(User user)
            {
                var globalRoleName = user.UserRoles
                    .FirstOrDefault(ur => ur.GymId == null)?.RoleName;
                return globalRoleName is not null && roleIdByName.TryGetValue(globalRoleName, out var id) ? id : null;
            }

            var rowModels = users.Select(u =>
            {
                roleIdByUser.TryGetValue(u.Id, out var perGymRoleId);
                var roleName = perGymRoleId != 0 && roleNames.TryGetValue(perGymRoleId, out var name)
                    ? name
                    : PlatformHelpers.RoleLabel(u, null);

                var access = u.UserGymAccesses.FirstOrDefault(a => branchIds.Contains(a.GymId));
                var branch = access is null ? null : company.Branches.FirstOrDefault(b => b.Id == access.GymId);

                return new CompanyEmployeeItem
                {
                    UserId = u.Id,
                    EmployeeId = employeeIds.TryGetValue(u.Id, out var employeeId) ? employeeId : null,
                    Name = u.UserName,
                    Email = u.Email,
                    Initials = PlatformHelpers.InitialsOf(u.UserName),
                    Role = roleName,
                    RoleId = perGymRoleId != 0
                        ? perGymRoleId
                        : GlobalRoleId(u) is int globalRoleId ? globalRoleId : null,
                    BranchId = branch?.Id,
                    BranchName = branch?.Name,
                    BranchCode = branch is null ? null : $"BR-{branch.Id}",
                    Status = PlatformHelpers.UserStatusLabel(u, u.LastLoginAt is not null),
                    LastLoginAt = u.LastLoginAt,
                    JoinedOn = null,
                };
            }).ToList();

            var term = Clean(query.Search)?.ToLowerInvariant();
            if (term is not null)
            {
                rowModels = rowModels
                    .Where(r => r.Name.ToLowerInvariant().Contains(term) || r.Email.ToLowerInvariant().Contains(term))
                    .ToList();
            }

            if (Clean(query.Role) is { } roleFilter)
            {
                var expected = roleFilter switch
                {
                    "HR" => RoleNames.Hr,
                    "BranchManager" => RoleNames.BranchManager,
                    "TeamLeader" => RoleNames.TeamLeader,
                    "Employee" => RoleNames.Employee,
                    _ => roleFilter,
                };
                rowModels = rowModels.Where(r => r.Role == expected).ToList();
            }

            if (query.BranchId is int branchFilter)
            {
                rowModels = rowModels.Where(r => r.BranchId == branchFilter).ToList();
            }

            if (Clean(query.Status) is { } statusFilter)
            {
                rowModels = rowModels.Where(r => r.Status == statusFilter).ToList();
            }

            var page = Math.Max(1, query.PageNumber);
            var pageSize = Math.Clamp(query.PageSize, 1, 100);
            var total = rowModels.Count;

            return new CompanyEmployeesResponse
            {
                Items = rowModels.OrderBy(r => r.Name).Skip((page - 1) * pageSize).Take(pageSize).ToList(),
                Page = page,
                PageSize = pageSize,
                TotalCount = total,
                TotalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize)),
            };
        }

        public async Task<CompanyBillingResponse> GetBillingAsync(int? actorUserId, int companyId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.billing.view", cancellationToken);

            var company = await LoadCompanyAsync(companyId, cancellationToken);
            var subscription = ActiveSubscription(company);
            var plan = subscription?.Plan;

            if (plan is null || subscription is null)
            {
                throw new BadRequestException("This company has no active subscription yet.");
            }

            var detailed = await _unitOfWork.GetRepository<SubscriptionPlan, int>()
                .GetByIdAsync(new PlanDetailSpec(plan.Id), cancellationToken);

            var userCounts = await _readModel.GetUserCountsByCompanyAsync(cancellationToken);
            var used = userCounts.TryGetValue(companyId, out var n) ? n : 0;
            var seatLimit = subscription.SeatLimitOverride ?? plan.SeatLimit;

            var invoices = await _unitOfWork.GetRepository<Invoice, int>()
                .GetAllAsync(new InvoicesByCompanySpec(companyId), cancellationToken);

            return new CompanyBillingResponse
            {
                Plan = new CompanyPlanCardDto
                {
                    Id = plan.Id,
                    Name = plan.Name,
                    Price = subscription.PriceOverride ?? plan.Price,
                    CycleCount = plan.CycleCount,
                    CycleUnit = PlatformHelpers.CycleUnitLabel(plan.CycleUnit),
                    Features = (detailed?.Features ?? [])
                        .OrderBy(f => f.SortOrder)
                        .Select(f => f.Label)
                        .ToList(),
                },
                Seats = new CompanySeatUsageDto
                {
                    Used = used,
                    Limit = seatLimit,
                    Remaining = seatLimit is null ? null : Math.Max(0, seatLimit.Value - used),
                },
                Invoices = invoices
                    .OrderByDescending(i => i.IssuedOn)
                    .Select(i => new CompanyInvoiceRow
                    {
                        Id = i.Id,
                        InvoiceNumber = i.InvoiceNumber,
                        PeriodLabel = i.PeriodLabel,
                        Amount = i.Amount,
                        Status = PlatformHelpers.InvoiceStatusLabel(i.Status),
                        IssuedOn = i.IssuedOn,
                        PaidOn = i.PaidOn,
                    })
                    .ToList(),
            };
        }

        public async Task<PlatformAuditListResponse> GetAuditAsync(int? actorUserId, int companyId, PlatformAuditQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.audit.view", cancellationToken);

            var rows = await _unitOfWork.GetRepository<DomainLayer.Models.AuditModule.AuditLog, int>()
                .GetAllAsync(new AuditByCompanySpec(companyId), cancellationToken);

            var userNames = await LoadUserNamesAsync(cancellationToken);

            var filtered = PlatformAuditFilter.Apply(rows, query, userNames);
            var counts = PlatformAuditFilter.Counts(rows);

            var page = Math.Max(1, query.PageNumber);
            var pageSize = Math.Clamp(query.PageSize, 1, 100);
            var total = filtered.Count;

            return new PlatformAuditListResponse
            {
                Items = filtered.Skip((page - 1) * pageSize).Take(pageSize).ToList(),
                Counts = counts,
                Page = page,
                PageSize = pageSize,
                TotalCount = total,
                TotalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize)),
            };
        }

        // ------------------------------------------------------------------
        // Branches
        // ------------------------------------------------------------------

        public async Task<BranchListResponse> GetBranchesAsync(int? actorUserId, int companyId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.companies.view", cancellationToken);

            var company = await LoadCompanyAsync(companyId, cancellationToken);
            var limit = EffectiveBranchLimit(company);

            var breakdown = await _readModel.GetCompanyRoleBreakdownAsync(companyId, cancellationToken);
            var userCounts = await _readModel.GetUserCountsByCompanyAsync(cancellationToken);
            var totalStaff = userCounts.TryGetValue(companyId, out var n) ? n : 0;

            var items = company.Branches
                .OrderBy(b => b.Name)
                .Select(b => new BranchListItem
                {
                    Id = b.Id,
                    Code = $"BR-{b.Id}",
                    Name = b.Name,
                    Area = b.Location,
                    Address = b.ContactInfo,
                    Phone = b.ContactInfo,
                    ManagerName = null,
                    Status = PlatformHelpers.BranchStatusLabel(b.Status),
                    StaffCount = 0,
                    EmployeeCount = 0,
                    TeamLeaderCount = 0,
                    BranchManagerCount = 0,
                })
                .ToList();

            return new BranchListResponse
            {
                Items = items,
                BranchLimit = limit,
                BranchLimitReached = limit is not null && items.Count >= limit.Value,
            };
        }

        public async Task<BranchListItem> CreateBranchAsync(int? actorUserId, int companyId, BranchUpsertRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.branches.manage", cancellationToken);

            var company = await LoadCompanyAsync(companyId, cancellationToken);
            var name = RequireText(request.Name, "Branch name");

            if (company.Branches.Any(b => string.Equals(b.Name, name, StringComparison.OrdinalIgnoreCase)))
            {
                throw new BadRequestException($"The branch '{name}' already exists in this company.");
            }

            var limit = EffectiveBranchLimit(company);
            if (limit is not null && company.Branches.Count >= limit.Value)
            {
                throw new BadRequestException(
                    $"This company already uses all {limit} branches on its plan. Upgrade the plan before adding another branch.");
            }

            var branch = new Gym
            {
                CompanyId = companyId,
                Name = name,
                Location = Clean(request.Area) ?? Clean(request.Address) ?? "Main",
                ContactInfo = Clean(request.Phone),
                Status = GymStatus.Active,
            };

            await _unitOfWork.GetRepository<Gym, int>().AddAsync(branch, cancellationToken);

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Added branch",
                category: "Gym",
                severity: "info",
                entityType: "Gym",
                entityId: 0,
                companyId: companyId,
                gymId: null,
                target: $"{name} · {company.Name}",
                detail: $"Branch created. The account now runs {company.Branches.Count + 1} branches.",
                values: new { request.Name, request.Area, request.Address, request.Phone },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new BranchListItem
            {
                Id = branch.Id,
                Code = $"BR-{branch.Id}",
                Name = branch.Name,
                Area = branch.Location,
                Address = branch.ContactInfo,
                Phone = branch.ContactInfo,
                ManagerName = "Unassigned",
                Status = PlatformHelpers.BranchStatusLabel(branch.Status),
                StaffCount = 0,
                EmployeeCount = 0,
                TeamLeaderCount = 0,
                BranchManagerCount = 0,
            };
        }

        public async Task<BranchListItem> UpdateBranchAsync(int? actorUserId, int companyId, int branchId, BranchUpsertRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.branches.manage", cancellationToken);

            var repository = _unitOfWork.GetRepository<Gym, int>();
            var branch = await repository.GetByIdAsync(new BranchByIdTrackedSpec(branchId), cancellationToken)
                         ?? throw new NotFoundException("Branch not found.");

            if (branch.CompanyId != companyId)
            {
                throw new NotFoundException("Branch not found in this company.");
            }

            var name = RequireText(request.Name, "Branch name");
            branch.Name = name;
            branch.Location = Clean(request.Area) ?? Clean(request.Address) ?? branch.Location;
            branch.ContactInfo = Clean(request.Phone);
            repository.Update(branch);

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Updated branch",
                category: "Gym",
                severity: "info",
                entityType: "Gym",
                entityId: branch.Id,
                companyId: companyId,
                gymId: branch.Id,
                target: $"{name} · #{companyId}",
                detail: "Branch details updated.",
                values: new { request.Name, request.Area, request.Address, request.Phone },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new BranchListItem
            {
                Id = branch.Id,
                Code = $"BR-{branch.Id}",
                Name = branch.Name,
                Area = branch.Location,
                Address = branch.ContactInfo,
                Phone = branch.ContactInfo,
                ManagerName = null,
                Status = PlatformHelpers.BranchStatusLabel(branch.Status),
                StaffCount = 0,
                EmployeeCount = 0,
                TeamLeaderCount = 0,
                BranchManagerCount = 0,
            };
        }

        public async Task ArchiveBranchAsync(int? actorUserId, int companyId, int branchId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "platform.branches.manage", cancellationToken);

            var repository = _unitOfWork.GetRepository<Gym, int>();
            var branch = await repository.GetByIdAsync(new BranchByIdTrackedSpec(branchId), cancellationToken)
                         ?? throw new NotFoundException("Branch not found.");

            if (branch.CompanyId != companyId)
            {
                throw new NotFoundException("Branch not found in this company.");
            }

            // A branch with a roster cannot be archived — those employees would be
            // orphaned. The console surfaces this as a refusal the Super Admin must clear
            // by reassigning staff first.
            var rosterCount = await _unitOfWork.GetRepository<DomainLayer.Models.EmployeeModule.Employee, int>()
                .CountAsync(new EmployeesInBranchSpec(branchId), cancellationToken);

            if (rosterCount > 0)
            {
                throw new BadRequestException(
                    $"This branch still has {rosterCount} employee record(s). Reassign them before archiving it.");
            }

            branch.Status = GymStatus.Archived;
            repository.Update(branch);

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Archived branch",
                category: "Gym",
                severity: "warning",
                entityType: "Gym",
                entityId: branch.Id,
                companyId: companyId,
                gymId: branch.Id,
                target: $"{branch.Name} · #{companyId}",
                detail: "Branch archived. Records are preserved; the branch stops appearing in the roster.",
                values: new { branch.Name },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        // ------------------------------------------------------------------
        // HR staff assignment
        // ------------------------------------------------------------------

        public async Task<HrStaffListResponse> GetHrStaffAsync(int? actorUserId, int companyId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "gym.hr_staff.assign", cancellationToken);

            var companyNames = await _readModel.GetCompanyNamesAsync(cancellationToken);
            var companyMap = await _readModel.GetUserCompanyMapAsync(cancellationToken);

            var staff = await _unitOfWork.GetRepository<User, int>()
                .GetAllAsync(new CompanyHrStaffSpec(companyId), cancellationToken);

            return new HrStaffListResponse
            {
                Items = staff.Select(u =>
                {
                    var ids = companyMap.TryGetValue(u.Id, out var list) ? list : [];
                    return new HrStaffMember
                    {
                        UserId = u.Id,
                        Name = u.UserName,
                        Email = u.Email,
                        Initials = PlatformHelpers.InitialsOf(u.UserName),
                        AssignedCompanies = ids
                            .Where(companyNames.ContainsKey)
                            .Select(id => new HrStaffCompanyRef { Id = id, Name = companyNames[id] })
                            .ToList(),
                        AssignedCompanyCount = ids.Count,
                        PrimaryBranch = u.UserGymAccesses.FirstOrDefault()?.Gym.Name,
                        Status = PlatformHelpers.UserStatusLabel(u, u.LastLoginAt is not null),
                        LastLoginAt = u.LastLoginAt,
                    };
                }).ToList(),
            };
        }

        public async Task<AssignHrStaffResponse> AssignHrStaffAsync(int? actorUserId, int companyId, AssignHrStaffRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "gym.hr_staff.assign", cancellationToken);

            var company = await LoadCompanyAsync(companyId, cancellationToken);
            var hrUsers = await ResolveHrUsersAsync(request.UserIds, cancellationToken);

            if (hrUsers.Count != request.UserIds.Distinct().Count())
            {
                throw new BadRequestException("Every selected account must be an HR user.");
            }

            // Grants are branch-scoped (UserGymAccess is per branch). A company-level grant
            // without an explicit branch targets the company's first active branch.
            var branchId = request.BranchId
                           ?? company.Branches.FirstOrDefault(b => b.Status == GymStatus.Active)?.Id
                           ?? throw new BadRequestException("The company has no active branch to assign HR staff to.");

            if (!company.Branches.Any(b => b.Id == branchId))
            {
                throw new BadRequestException("The selected branch does not belong to this company.");
            }

            var added = new List<int>();
            var already = new List<int>();

            foreach (var hrUser in hrUsers)
            {
                if (await _userAccess.HasGymAccessAsync(hrUser.Id, branchId, cancellationToken))
                {
                    already.Add(hrUser.Id);
                    continue;
                }

                await _userAccess.AddGymAccessAsync(hrUser.Id, branchId, cancellationToken);
                added.Add(hrUser.Id);

                await PlatformHelpers.WriteAuditAsync(
                    _unitOfWork, actor,
                    action: "Assigned HR to company",
                    category: "User",
                    severity: "info",
                    entityType: "User",
                    entityId: hrUser.Id,
                    companyId: companyId,
                    gymId: branchId,
                    target: $"{hrUser.UserName} · {company.Name}",
                    detail: "HR access granted for this company.",
                    values: new { BranchId = branchId },
                    cancellationToken);
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var assignedTotal = await _unitOfWork.GetRepository<User, int>()
                .CountAsync(new CompanyHrStaffSpec(companyId), cancellationToken);

            return new AssignHrStaffResponse
            {
                CompanyId = companyId,
                Added = added,
                AlreadyAssigned = already,
                AssignedTotal = assignedTotal,
            };
        }

        public async Task<RevokeHrStaffResponse> RevokeHrStaffAsync(int? actorUserId, int companyId, int userId, CancellationToken cancellationToken = default)
        {
            var actor = await PlatformHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "gym.hr_staff.assign", cancellationToken);

            var company = await LoadCompanyAsync(companyId, cancellationToken);
            var branchIds = company.Branches.Select(b => b.Id).ToList();

            if (branchIds.Count == 0)
            {
                throw new NotFoundException("Company has no branches.");
            }

            var existing = (await _userAccess.GetGymAccessAsync(userId, cancellationToken))
                .Select(a => a.GymId)
                .Intersect(branchIds)
                .ToList();

            if (existing.Count == 0)
            {
                throw new NotFoundException("That user is not assigned to this company.");
            }

            foreach (var branchId in existing)
            {
                await _userAccess.RemoveGymAccessAsync(userId, branchId, cancellationToken);
            }

            var user = await _unitOfWork.GetRepository<User, int>().GetByIdAsync(userId, cancellationToken);

            await PlatformHelpers.WriteAuditAsync(
                _unitOfWork, actor,
                action: "Removed HR from company",
                category: "User",
                severity: "warning",
                entityType: "User",
                entityId: userId,
                companyId: companyId,
                gymId: null,
                target: $"{user?.UserName ?? $"#{userId}"} · {company.Name}",
                detail: "HR access revoked for this company only; other companies are untouched.",
                values: new { BranchIds = existing },
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var remaining = (await _userAccess.GetGymAccessAsync(userId, cancellationToken)).Count;

            return new RevokeHrStaffResponse
            {
                CompanyId = companyId,
                UserId = userId,
                RemainingCompanyCount = remaining,
            };
        }

        // ------------------------------------------------------------------
        // Internals
        // ------------------------------------------------------------------

        private async Task<Company> LoadCompanyAsync(int companyId, CancellationToken cancellationToken) =>
            await _unitOfWork.GetRepository<Company, int>()
                .GetByIdAsync(new CompanyByIdSpec(companyId), cancellationToken)
            ?? throw new NotFoundException("Company not found.");

        private static CompanySubscription? ActiveSubscription(Company company) =>
            company.Subscriptions
                .Where(s => s.Status != SubscriptionStatus.Cancelled)
                .OrderByDescending(s => s.StartedOn)
                .FirstOrDefault();

        private static CompanyListItem BuildListItem(
            Company company,
            IReadOnlyDictionary<int, int> branchCounts,
            IReadOnlyDictionary<int, int> userCounts,
            IReadOnlyDictionary<int, PayrollPeriod> payroll)
        {
            var subscription = ActiveSubscription(company);
            var plan = subscription?.Plan;
            var users = userCounts.TryGetValue(company.Id, out var n) ? n : 0;
            var seatLimit = subscription is null ? null : subscription.SeatLimitOverride ?? plan?.SeatLimit;

            payroll.TryGetValue(company.Id, out var period);

            return new CompanyListItem
            {
                Id = company.Id,
                Code = company.Code,
                Name = company.Name,
                City = company.City,
                LogoUrl = company.LogoUrl,
                Status = PlatformHelpers.CompanyStatusLabel(company.Status),
                Plan = new PlanRef { Id = plan?.Id ?? 0, Name = plan?.Name ?? "—" },
                BranchCount = branchCounts.TryGetValue(company.Id, out var branches) ? branches : 0,
                UserCount = users,
                SeatLimit = seatLimit,
                SeatUsagePercent = seatLimit is > 0 ? (int)Math.Round(users * 100.0 / seatLimit.Value) : null,
                Mrr = subscription is null || subscription.Status == SubscriptionStatus.Trial || plan is null
                    ? 0
                    : PlatformHelpers.MonthlyValue(subscription.PriceOverride ?? plan.Price, plan.CycleCount, plan.CycleUnit),
                BillingCycle = plan is null ? null : PlatformHelpers.CycleLabel(plan.CycleCount, plan.CycleUnit),
                SubscribedOn = subscription?.StartedOn,
                RenewsOn = subscription?.RenewsOn,
                RenewalDaysRemaining = subscription?.RenewsOn is null
                    ? null
                    : Math.Max(0, (subscription.RenewsOn.Value.Date - DateTime.UtcNow.Date).Days),
                PayrollStatus = PlatformHelpers.PayrollStatusLabel(period, company.Status == CompanyStatus.PaymentOverdue),
            };
        }

        private static IEnumerable<CompanyListItem> SortCompanies(IEnumerable<CompanyListItem> rows, string? sortBy, string? sortDir)
        {
            var descending = string.Equals(sortDir, "desc", StringComparison.OrdinalIgnoreCase);

            var ordered = (sortBy?.Trim().ToLowerInvariant()) switch
            {
                "plan" => descending ? rows.OrderByDescending(r => r.Plan.Name) : rows.OrderBy(r => r.Plan.Name),
                "branches" => descending ? rows.OrderByDescending(r => r.BranchCount) : rows.OrderBy(r => r.BranchCount),
                "users" => descending ? rows.OrderByDescending(r => r.UserCount) : rows.OrderBy(r => r.UserCount),
                "seats" => descending
                    ? rows.OrderByDescending(r => r.SeatUsagePercent ?? -1)
                    : rows.OrderBy(r => r.SeatUsagePercent ?? -1),
                "mrr" => descending ? rows.OrderByDescending(r => r.Mrr) : rows.OrderBy(r => r.Mrr),
                "renews" or "renewson" => descending
                    ? rows.OrderByDescending(r => r.RenewsOn ?? DateTime.MinValue)
                    : rows.OrderBy(r => r.RenewsOn ?? DateTime.MinValue),
                "status" => descending ? rows.OrderByDescending(r => r.Status) : rows.OrderBy(r => r.Status),
                _ => descending ? rows.OrderByDescending(r => r.Name) : rows.OrderBy(r => r.Name),
            };

            return ordered;
        }

        private async Task<CompanyDetailResponse> BuildDetailAsync(Company company, CancellationToken cancellationToken)
        {
            var subscription = ActiveSubscription(company);
            var plan = subscription?.Plan;

            var userCounts = await _readModel.GetUserCountsByCompanyAsync(cancellationToken);
            var users = userCounts.TryGetValue(company.Id, out var n) ? n : 0;

            var hrStaff = await _unitOfWork.GetRepository<User, int>()
                .CountAsync(new CompanyHrStaffSpec(company.Id), cancellationToken);

            var invoices = await _unitOfWork.GetRepository<Invoice, int>()
                .GetAllAsync(new InvoicesByCompanySpec(company.Id), cancellationToken);
            var invoiceList = invoices.ToList();

            var auditCount = await _unitOfWork.GetRepository<DomainLayer.Models.AuditModule.AuditLog, int>()
                .CountAsync(new AuditByCompanySpec(company.Id), cancellationToken);

            var payroll = await LoadLatestPayrollAsync(company.Id, cancellationToken);
            var overdue = invoiceList.Any(i => i.Status == InvoiceStatus.Overdue);

            var seatLimit = subscription is null ? null : subscription.SeatLimitOverride ?? plan?.SeatLimit;

            return new CompanyDetailResponse
            {
                Id = company.Id,
                Code = company.Code,
                Name = company.Name,
                City = company.City,
                LogoUrl = company.LogoUrl,
                Status = PlatformHelpers.CompanyStatusLabel(company.Status),
                Contact = new CompanyContactDto
                {
                    Name = company.ContactName,
                    Email = company.ContactEmail,
                    Phone = company.ContactPhone,
                },
                CreatedAt = company.CreatedAt,
                Subscription = subscription is null || plan is null ? null : new CompanySubscriptionDto
                {
                    Id = subscription.Id,
                    PlanId = plan.Id,
                    PlanName = plan.Name,
                    Status = PlatformHelpers.SubscriptionStatusLabel(subscription.Status),
                    Price = subscription.PriceOverride ?? plan.Price,
                    CycleCount = plan.CycleCount,
                    CycleUnit = PlatformHelpers.CycleUnitLabel(plan.CycleUnit),
                    SeatLimit = seatLimit,
                    BranchLimit = subscription.BranchLimitOverride ?? plan.BranchLimit,
                    StartedOn = subscription.StartedOn,
                    CurrentPeriodStart = subscription.CurrentPeriodStart,
                    CurrentPeriodEnd = subscription.CurrentPeriodEnd,
                    TrialEndsOn = subscription.TrialEndsOn,
                    RenewsOn = subscription.RenewsOn,
                },
                Counts = new CompanyCountsDto
                {
                    Branches = company.Branches.Count,
                    Users = users,
                    HrStaff = hrStaff,
                    Invoices = invoiceList.Count,
                    AuditEvents = auditCount,
                },
                Health = new CompanyHealthDto
                {
                    Score = ComputeHealth(company, overdue, seatLimit, users),
                    LastActivityAt = await LoadLastActivityAsync(company.Id, cancellationToken),
                    AttendanceRate30d = await ComputeAttendanceRateAsync(company.Id, cancellationToken),
                },
                PayrollStatus = PlatformHelpers.PayrollStatusLabel(payroll, company.Status == CompanyStatus.PaymentOverdue),
                Blocking = new CompanyBlockingDto
                {
                    PayrollBlocked = company.Status is CompanyStatus.PaymentOverdue or CompanyStatus.Suspended or CompanyStatus.Closed,
                    Reason = company.Status switch
                    {
                        CompanyStatus.PaymentOverdue => "An invoice is overdue. Settle it to restore payroll access.",
                        CompanyStatus.Suspended => "The account is suspended from the platform console.",
                        CompanyStatus.Closed => "The account is closed.",
                        _ => null,
                    },
                },
            };
        }

        /// <summary>
        /// 0–100 account health: starts at 100 and loses points for lifecycle degradation,
        /// overdue money and seat saturation. Deliberately simple and explainable — the
        /// console shows the number next to a one-line rationale.
        /// </summary>
        private static int ComputeHealth(Company company, bool hasOverdueInvoice, int? seatLimit, int users)
        {
            var score = 100;

            score -= company.Status switch
            {
                CompanyStatus.PaymentOverdue => 40,
                CompanyStatus.Suspended => 50,
                CompanyStatus.Closed => 60,
                CompanyStatus.Trial => 10,
                _ => 0,
            };

            if (hasOverdueInvoice)
            {
                score -= 25;
            }

            if (seatLimit is > 0)
            {
                var usage = users * 100.0 / seatLimit.Value;
                if (usage >= 95)
                {
                    score -= 15;
                }
                else if (usage >= 80)
                {
                    score -= 8;
                }
            }

            return Math.Clamp(score, 0, 100);
        }

        private async Task<int> ComputeAttendanceRateAsync(int companyId, CancellationToken cancellationToken)
        {
            var trend = await _readModel.GetAttendanceTrendAsync(companyId, 30, cancellationToken);
            var userCounts = await _readModel.GetUserCountsByCompanyAsync(cancellationToken);
            var users = userCounts.TryGetValue(companyId, out var n) ? n : 0;

            if (users == 0 || trend.Count == 0)
            {
                return 0;
            }

            var expected = users * trend.Count;
            var actual = trend.Sum();
            return expected == 0 ? 0 : (int)Math.Round(Math.Min(100, actual * 100.0 / expected));
        }

        private async Task<DateTime?> LoadLastActivityAsync(int companyId, CancellationToken cancellationToken)
        {
            var rows = await _unitOfWork.GetRepository<DomainLayer.Models.AuditModule.AuditLog, int>()
                .GetAllAsync(new AuditByCompanySpec(companyId), cancellationToken);

            return rows.FirstOrDefault()?.Timestamp;
        }

        private async Task<PayrollPeriod?> LoadLatestPayrollAsync(int companyId, CancellationToken cancellationToken) =>
            await _unitOfWork.GetRepository<PayrollPeriod, int>()
                .GetByIdAsync(new LatestPayrollPeriodForCompanySpec(companyId), cancellationToken);

        private async Task<Dictionary<int, PayrollPeriod>> LoadPayrollStatusAsync(
            IReadOnlyCollection<int> companyIds,
            CancellationToken cancellationToken)
        {
            var result = new Dictionary<int, PayrollPeriod>();
            foreach (var companyId in companyIds)
            {
                var period = await LoadLatestPayrollAsync(companyId, cancellationToken);
                if (period is not null)
                {
                    result[companyId] = period;
                }
            }

            return result;
        }

        private async Task<Dictionary<int, int>> LoadEmployeeIdsAsync(
            IReadOnlySet<int> branchIds,
            CancellationToken cancellationToken)
        {
            var employees = await _unitOfWork.GetRepository<DomainLayer.Models.EmployeeModule.Employee, int>()
                .GetAllAsync(cancellationToken);

            return employees
                .Where(e => branchIds.Contains(e.GymId))
                .GroupBy(e => e.UserId)
                .ToDictionary(g => g.Key, g => g.First().Id);
        }

        private async Task<Dictionary<int, string>> LoadUserNamesAsync(CancellationToken cancellationToken) =>
            (await _unitOfWork.GetRepository<User, int>().GetAllAsync(cancellationToken))
                .ToDictionary(u => u.Id, u => u.UserName);

        private async Task<List<User>> ResolveHrUsersAsync(List<int>? userIds, CancellationToken cancellationToken)
        {
            if (userIds is null || userIds.Count == 0)
            {
                return [];
            }

            var ids = userIds.Distinct().ToList();
            var users = (await _unitOfWork.GetRepository<User, int>().GetAllAsync(cancellationToken))
                .Where(u => ids.Contains(u.Id))
                .ToList();

            if (users.Count != ids.Count)
            {
                throw new NotFoundException("One or more of the selected users no longer exists.");
            }

            if (users.Any(u => u.UserType != UserType.HR))
            {
                throw new BadRequestException("Only HR accounts can be assigned to a gym company.");
            }

            return users;
        }

        private async Task EnsureSeatAllowanceAsync(int? seatLimit, int? existingUsers, int adding, CancellationToken cancellationToken)
        {
            if (seatLimit is null)
            {
                return;
            }

            var used = existingUsers ?? 0;
            if (used + adding > seatLimit.Value)
            {
                throw new BadRequestException(
                    $"Seat limit reached ({used}/{seatLimit.Value}). Upgrade the plan before adding users.");
            }
        }

        private async Task<int> RevokeCompanySessionsAsync(int companyId, CancellationToken cancellationToken)
        {
            // Refresh tokens are the only revocable session artefact at this layer; the
            // access token simply expires. Counting them keeps the audit row truthful.
            var branches = await _unitOfWork.GetRepository<Gym, int>()
                .GetAllAsync(new BranchesByCompanySpec(companyId), cancellationToken);
            var branchIds = branches.Select(b => b.Id).ToHashSet();

            if (branchIds.Count == 0)
            {
                return 0;
            }

            var tokenRepository = _unitOfWork.GetRepository<DomainLayer.Models.UserModule.RefreshToken, int>();
            var tokens = await tokenRepository.GetAllAsync(cancellationToken);

            var revoked = 0;
            foreach (var token in tokens.Where(t =>
                         t.RevokedAtUtc == null
                         && t.ScopedGymId is int gymId
                         && branchIds.Contains(gymId)))
            {
                token.RevokedAtUtc = DateTime.UtcNow;
                tokenRepository.Update(token);
                revoked++;
            }

            return revoked;
        }

        private static int? EffectiveBranchLimit(Company company)
        {
            var subscription = ActiveSubscription(company);
            return subscription is null ? null : subscription.BranchLimitOverride ?? subscription.Plan?.BranchLimit;
        }

        private static CompanyStatus ParseTargetStatus(string? status) =>
            status?.Trim().ToLowerInvariant() switch
            {
                "suspended" => CompanyStatus.Suspended,
                "active" or "restored" => CompanyStatus.Active,
                "closed" => CompanyStatus.Closed,
                _ => throw new BadRequestException("Status must be Suspended, Active or Closed."),
            };

        private static DateOnly ComputePeriodEnd(DateOnly start, int cycleCount, PlanCycleUnit unit)
        {
            var count = Math.Max(1, cycleCount);
            return unit == PlanCycleUnit.Years
                ? start.AddYears(count)
                : start.AddMonths(count);
        }

        /// <summary>
        /// "Revive North Coast" → "RNC". A taken base gets a numeric suffix, so the
        /// console never asks the operator for a code and two gyms can still share initials.
        /// </summary>
        private async Task<string> GenerateUniqueCodeAsync(string name, CancellationToken cancellationToken)
        {
            var letters = new string(name
                .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
                .Select(word => word[0])
                .Where(character => character is >= 'A' and <= 'Z' or >= 'a' and <= 'z')
                .Take(6)
                .ToArray());
            var basis = letters.Length >= 2 ? letters.ToUpperInvariant() : "GYM";

            var companies = _unitOfWork.GetRepository<Company, int>();
            for (var suffix = 0; suffix < 100; suffix++)
            {
                var candidate = suffix == 0 ? basis : $"{basis}{suffix}";
                if (await companies.GetByIdAsync(new CompanyByCodeSpec(candidate), cancellationToken) is null)
                {
                    return candidate;
                }
            }

            return $"{basis}{DateTime.UtcNow.Ticks % 1000:000}";
        }

        private static string RequireText(string? value, string label) =>
            string.IsNullOrWhiteSpace(value)
                ? throw new BadRequestException($"{label} is required.")
                : value.Trim();

        private static string? Clean(string? value) =>
            string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
