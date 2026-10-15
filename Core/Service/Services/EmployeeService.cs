using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Employee;
using System.Globalization;
using System.Text.Json;

namespace Service.Services
{
    /// <summary>
    /// Employee directory and lifecycle operations (S1).
    ///
    /// Model notes the service encodes:
    /// - Employee IS the profile row: FullName/Phone live on it (User.EmployeeProfile).
    /// - There is no salary column: the salary is the latest Compensation.Amount.
    /// - Position is a per-gym catalog entry (title + level); resolving a position
    ///   finds an exact (title, level) row or creates one.
    /// - Transfers move GymId and the user's gym-access row so gym isolation holds.
    /// - Status changes are recorded in EmploymentHistory and do NOT touch
    ///   User.IsActive (login deactivation belongs to offboarding, a later section).
    /// </summary>
    public class EmployeeService(
        IUnitOfWork _unitOfWork,
        IAccessControlService _accessControl,
        IUserAccessRepository _userAccess,
        IPasswordHasher _passwordHasher) : IEmployeeService
    {
        // Mirrors ReviveHRSystem.Web.DataSeed.DevelopmentDataSeeder.EmployeePassword.
        // The seeder constant lives in the Web host, which Core cannot reference,
        // so the shared value is duplicated here and documented in api.md.
        private const string DefaultNewAccountPassword = "Revive!2026";
        private const int DefaultPageSize = 20;
        private const int MaxPageSize = 100;

        public async Task<EmployeeListResponse> GetEmployeesAsync(int? actorUserId, EmployeeListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "employees.view", query.Gym, cancellationToken);

            int[]? gymFilter;
            if (actor.UserType == UserType.TopManagement)
            {
                gymFilter = query.Gym.HasValue ? [query.Gym.Value] : null;
            }
            else
            {
                var allowedIds = (await _userAccess.GetGymAccessAsync(actor.Id, cancellationToken))
                    .Select(a => a.GymId)
                    .ToHashSet();
                if (query.Gym.HasValue)
                {
                    if (!allowedIds.Contains(query.Gym.Value))
                    {
                        throw new UnAuthorizedException("You are not assigned to this gym.");
                    }

                    gymFilter = [query.Gym.Value];
                }
                else
                {
                    // An empty (but non-null) scope matches nobody — the caller has
                    // no gyms, so their directory page is empty, never global.
                    gymFilter = allowedIds.Count == 0 ? [] : allowedIds.ToArray();
                }
            }

            var statusFilter = ParseStatusOrNull(query.Status);
            var sortBy = (query.SortBy ?? "name").Trim().ToLowerInvariant();
            var sortDescending = string.Equals(query.SortOrder, "desc", StringComparison.OrdinalIgnoreCase);
            var page = Math.Max(query.Page, 1);
            var pageSize = query.PageSize <= 0 ? DefaultPageSize : Math.Min(query.PageSize, MaxPageSize);

            var countSpec = new EmployeeDirectorySpec(gymFilter, query.Search, statusFilter, 0, 0, "name", false);
            var total = await _unitOfWork.GetRepository<Employee, int>().CountAsync(countSpec, cancellationToken);

            var pageSpec = new EmployeeDirectorySpec(
                gymFilter, query.Search, statusFilter, (page - 1) * pageSize, pageSize, sortBy, sortDescending);
            var employees = await _unitOfWork.GetRepository<Employee, int>().GetAllAsync(pageSpec, cancellationToken);

            return new EmployeeListResponse
            {
                Items = employees.Select(BuildListItem).ToList(),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(total / (double)pageSize) : 0,
            };
        }

        public async Task<EmployeeDataResponse> CreateEmployeeAsync(int? actorUserId, CreateEmployeeRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var employee = await CreateEmployeeCoreAsync(
                actor,
                request.FirstName,
                request.LastName,
                request.Email,
                request.Phone,
                request.Position,
                request.Level,
                request.Gym,
                request.Salary,
                request.StartDate,
                cancellationToken);

            var detail = await BuildDetailAsync(employee, cancellationToken);
            return new EmployeeDataResponse { Data = detail };
        }

        public async Task<BulkImportResultResponse> BulkImportAsync(int? actorUserId, string csvContent, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "employees.bulk_import", cancellationToken);

            var activeGyms = (await _unitOfWork.GetRepository<Gym, int>().GetAllAsync(cancellationToken))
                .Where(g => g.Status == GymStatus.Active)
                .ToList();

            var added = 0;
            var skipped = 0;
            var firstRow = true;
            foreach (var rawLine in csvContent.Split('\n', StringSplitOptions.RemoveEmptyEntries))
            {
                var line = rawLine.Trim().TrimEnd('\r');
                if (line.Length == 0)
                {
                    continue;
                }

                var cells = line.Split(',');
                if (cells.Length < 6)
                {
                    skipped++;
                    continue;
                }

                var name = cells[0].Trim().Trim('"');
                var email = cells[1].Trim().Trim('"').ToLowerInvariant();
                var position = cells[2].Trim().Trim('"');
                var level = cells[3].Trim().Trim('"');
                var gymName = cells[4].Trim().Trim('"');
                var salaryText = cells[5].Trim().Trim('"');

                // The first row is a header when its email cell is not an email.
                if (firstRow)
                {
                    firstRow = false;
                    if (!email.Contains('@'))
                    {
                        continue;
                    }
                }

                if (string.IsNullOrWhiteSpace(name) || !email.Contains('@') || string.IsNullOrWhiteSpace(gymName))
                {
                    skipped++;
                    continue;
                }

                try
                {
                    var gym = activeGyms
                        .FirstOrDefault(g => string.Equals(g.Name.Trim(), gymName, StringComparison.OrdinalIgnoreCase));
                    if (gym is null)
                    {
                        skipped++;
                        continue;
                    }

                    // Same check the guard performs, kept boolean so one bad row
                    // skips instead of aborting the whole import.
                    if (actor.UserType != UserType.TopManagement &&
                        !await _userAccess.HasGymAccessAsync(actor.Id, gym.Id, cancellationToken))
                    {
                        skipped++;
                        continue;
                    }

                    var existing = await _unitOfWork.GetRepository<User, int>()
                        .GetByIdAsync(new UserByEmailSpec(email), cancellationToken);
                    if (existing is not null)
                    {
                        skipped++;
                        continue;
                    }

                    decimal? salary = null;
                    if (!string.IsNullOrWhiteSpace(salaryText))
                    {
                        if (decimal.TryParse(salaryText, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsedInvariant))
                        {
                            salary = parsedInvariant;
                        }
                        else if (decimal.TryParse(salaryText, NumberStyles.Number, CultureInfo.CurrentCulture, out var parsedLocal))
                        {
                            salary = parsedLocal;
                        }
                        else
                        {
                            skipped++;
                            continue;
                        }
                    }

                    var nameParts = name.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
                    await CreateEmployeeCoreAsync(
                        actor,
                        nameParts[0],
                        nameParts.Length > 1 ? nameParts[1] : string.Empty,
                        email,
                        phone: null,
                        position,
                        level,
                        gym.Id,
                        salary,
                        startDate: DateOnly.FromDateTime(DateTime.UtcNow),
                        cancellationToken);
                    added++;
                }
                catch (Exception)
                {
                    skipped++;
                }
            }

            return new BulkImportResultResponse
            {
                Message = $"{added} employee(s) added, {skipped} skipped.",
                Added = added,
                Skipped = skipped,
            };
        }

        public async Task<EmployeeDataResponse> GetEmployeeAsync(int? actorUserId, int employeeId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "employees.view", await GymOfAsync(employeeId, cancellationToken), cancellationToken);

            var employee = await _unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            var detail = await BuildDetailAsync(employee, cancellationToken);
            return new EmployeeDataResponse { Data = detail };
        }

        public async Task<EmployeeDetailResponse> UpdateEmployeeAsync(int? actorUserId, int employeeId, UpdateEmployeeRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var employee = await EnsureEmployeeAccessAsync(actor.Id, employeeId, "employees.edit", cancellationToken);
            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            var history = new List<EmploymentHistory>();
            var changed = false;

            if (!string.IsNullOrWhiteSpace(request.Name))
            {
                var fullName = request.Name.Trim();
                if (fullName != employee.FullName)
                {
                    // Name edits are profile maintenance, not a career event — no
                    // history row (the history tab renders lifecycle changes).
                    employee.FullName = fullName;
                    changed = true;
                }
            }

            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                var standing = ParseStatusOrNull(request.Status)!.Value;
                if (standing != employee.Status)
                {
                    history.Add(NewHistory(employee.Id, today, EmploymentChangeType.StatusChange,
                        StatusDisplay(employee.Status), StatusDisplay(standing), "Status change", actor.Id));
                    employee.Status = standing;
                    changed = true;
                }
            }

            if (!string.IsNullOrWhiteSpace(request.Position))
            {
                var position = await ResolvePositionAsync(
                    employee.GymId, request.Position, employee.Position?.Level ?? "1", cancellationToken);
                if (position.Id != employee.PositionId)
                {
                    history.Add(NewHistory(employee.Id, today, EmploymentChangeType.PositionChange,
                        employee.Position is null ? "None" : $"{employee.Position.Title} (Level {employee.Position.Level})",
                        $"{position.Title} (Level {position.Level})", "Position change", actor.Id));
                    employee.PositionId = position.Id;
                    changed = true;
                }
            }

            if (changed)
            {
                _unitOfWork.GetRepository<Employee, int>().Update(employee);
                foreach (var entry in history)
                {
                    await _unitOfWork.GetRepository<EmploymentHistory, int>().AddAsync(entry, cancellationToken);
                }

                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }

            var updated = await _unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employee.Id), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");
            return await BuildDetailAsync(updated, cancellationToken);
        }

        public async Task<EmployeeDetailResponse> ChangeStatusAsync(int? actorUserId, int employeeId, ChangeEmployeeStatusRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var employee = await EnsureEmployeeAccessAsync(actor.Id, employeeId, "employees.status.change", cancellationToken);
            var standing = ParseStatusOrNull(request.Status)!.Value;

            if (standing == employee.Status)
            {
                throw new BadRequestException($"Employee is already {StatusDisplay(standing)}.");
            }

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var entry = NewHistory(employee.Id, today, EmploymentChangeType.StatusChange,
                StatusDisplay(employee.Status), StatusDisplay(standing),
                string.IsNullOrWhiteSpace(request.Note) ? "Status change" : request.Note.Trim(),
                actor.Id);

            // Deliberately does NOT touch User.IsActive: who may still log in is an
            // offboarding concern (separations flow), not the HR directory standing.
            employee.Status = standing;
            _unitOfWork.GetRepository<Employee, int>().Update(employee);
            await _unitOfWork.GetRepository<EmploymentHistory, int>().AddAsync(entry, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var updated = await _unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employee.Id), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");
            return await BuildDetailAsync(updated, cancellationToken);
        }

        public async Task<IReadOnlyList<EmployeeHistoryItem>> GetHistoryAsync(int? actorUserId, int employeeId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await EnsureEmployeeAccessAsync(actor.Id, employeeId, "employees.view", cancellationToken);

            var entries = await _unitOfWork.GetRepository<EmploymentHistory, int>()
                .GetAllAsync(new HistoryByEmployeeSpec(employeeId), cancellationToken);

            return entries.Select(h => new EmployeeHistoryItem
            {
                Type = ChangeTypeDisplay(h.ChangeType),
                From = UnwrapHistoryValue(h.OldValueJson),
                To = UnwrapHistoryValue(h.NewValueJson),
                Date = h.EffectiveDate,
                Detail = string.IsNullOrEmpty(h.Reason) ? null : h.Reason,
            }).ToList();
        }

        public async Task<IReadOnlyList<EmployeeDocumentItem>> GetDocumentsAsync(int? actorUserId, int employeeId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await EnsureEmployeeAccessAsync(actor.Id, employeeId, "employees.documents.view", cancellationToken);

            var documents = await _unitOfWork.GetRepository<EmployeeDocument, int>()
                .GetAllAsync(new DocumentsByEmployeeSpec(employeeId), cancellationToken);

            return documents.Select(d => new EmployeeDocumentItem
            {
                Name = d.FileName,
                Category = DocumentCategoryDisplay(d.Type),
                Status = DocumentStatusDisplay(d.ExpiryDate),
            }).ToList();
        }

        public async Task<EmployeeDocumentItem> AddDocumentAsync(int? actorUserId, int employeeId, EmployeeDocumentUpload upload, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await EnsureEmployeeAccessAsync(actor.Id, employeeId, "employees.documents.manage", cancellationToken);

            var category = ParseDocumentCategory(upload.Category);
            var document = new EmployeeDocument
            {
                EmployeeId = employeeId,
                FileName = upload.FileName,
                FilePath = upload.RelativeFilePath,
                Type = category,
                ExpiryDate = upload.ExpiryDate,
            };

            await _unitOfWork.GetRepository<EmployeeDocument, int>().AddAsync(document, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new EmployeeDocumentItem
            {
                Name = document.FileName,
                Category = DocumentCategoryDisplay(document.Type),
                Status = DocumentStatusDisplay(document.ExpiryDate),
            };
        }

        public async Task<LeaveBalanceResponse> GetLeaveBalanceAsync(int? actorUserId, int employeeId, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await EnsureEmployeeAccessAsync(actor.Id, employeeId, "employees.view", cancellationToken);

            var year = DateTime.UtcNow.Year;
            var rows = await _unitOfWork.GetRepository<LeaveBalance, int>()
                .GetAllAsync(new LeaveBalancesForYearSpec(employeeId, year), cancellationToken);

            LeaveBalanceBucket Bucket(LeaveType type)
            {
                var row = rows.FirstOrDefault(b => b.LeaveType == type);
                return new LeaveBalanceBucket { Used = row?.UsedDays ?? 0, Total = row?.TotalEntitlement ?? 0 };
            }

            return new LeaveBalanceResponse
            {
                EmployeeId = employeeId,
                DayOff = Bucket(LeaveType.Annual),
                Sick = Bucket(LeaveType.Sick),
                Unpaid = Bucket(LeaveType.Unpaid),
            };
        }

        public async Task<MessageResponse> UpdateLeaveBalanceAsync(int? actorUserId, int employeeId, UpdateLeaveBalanceRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            await EnsureEmployeeAccessAsync(actor.Id, employeeId, "employees.leave_balance.manage", cancellationToken);

            var year = DateTime.UtcNow.Year;
            var rows = (await _unitOfWork.GetRepository<LeaveBalance, int>()
                .GetAllAsync(new LeaveBalancesForYearSpec(employeeId, year), cancellationToken))
                .ToList();

            async Task UpsertAsync(LeaveType type, decimal used, decimal total)
            {
                var row = rows.FirstOrDefault(b => b.LeaveType == type);
                if (row is null)
                {
                    row = new LeaveBalance
                    {
                        EmployeeId = employeeId,
                        Year = year,
                        LeaveType = type,
                    };
                    await _unitOfWork.GetRepository<LeaveBalance, int>().AddAsync(row, cancellationToken);
                }
                else
                {
                    _unitOfWork.GetRepository<LeaveBalance, int>().Update(row);
                }

                // PendingDays (awaiting approval) is preserved: only the granted
                // totals and used days are managed here.
                row.UsedDays = used;
                row.TotalEntitlement = total;
                row.UpdatedBy = actor.Id;
            }

            await UpsertAsync(LeaveType.Annual, request.DayOff.Used, request.DayOff.Total);
            await UpsertAsync(LeaveType.Sick, request.Sick.Used, request.Sick.Total);
            await UpsertAsync(LeaveType.Unpaid, request.Unpaid.Used, request.Unpaid.Total);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new MessageResponse { Message = "Leave balance updated." };
        }

        public async Task<MessageResponse> TransferAsync(int? actorUserId, int employeeId, TransferEmployeeRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var employee = await EnsureEmployeeAccessAsync(actor.Id, employeeId, "employees.transfer", cancellationToken);
            var targetGym = await EnsureGymAsync(request.ToGym, cancellationToken);

            if (targetGym.Id == employee.GymId)
            {
                throw new BadRequestException("Employee is already assigned to this gym.");
            }

            if (actor.UserType != UserType.TopManagement &&
                !await _userAccess.HasGymAccessAsync(actor.Id, targetGym.Id, cancellationToken))
            {
                throw new UnAuthorizedException("You are not assigned to the target gym.");
            }

            var previousGymId = employee.GymId;
            var previousGymName = employee.Gym?.Name ?? "Unknown";
            var entry = NewHistory(employee.Id, request.EffectiveDate, EmploymentChangeType.Transfer,
                previousGymName, targetGym.Name, request.Reason.Trim(), actor.Id);

            employee.GymId = targetGym.Id;
            _unitOfWork.GetRepository<Employee, int>().Update(employee);
            await _unitOfWork.GetRepository<EmploymentHistory, int>().AddAsync(entry, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            // Move the login's gym-access row so the employee's data leaves the
            // previous manager's scope (gym isolation, ADR-004).
            await _userAccess.AddGymAccessAsync(employee.UserId, targetGym.Id, cancellationToken);
            await _userAccess.RemoveGymAccessAsync(employee.UserId, previousGymId, cancellationToken);

            return new MessageResponse { Message = "Employee transferred." };
        }

        public async Task<MessageResponse> ChangePositionAsync(int? actorUserId, int employeeId, PositionChangeRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var employee = await EnsureEmployeeAccessAsync(actor.Id, employeeId, "employees.position.change", cancellationToken);

            var newTitle = string.IsNullOrWhiteSpace(request.Position)
                ? employee.Position?.Title
                : request.Position.Trim();
            if (string.IsNullOrWhiteSpace(newTitle))
            {
                throw new BadRequestException("Position is required.");
            }

            var newLevel = string.IsNullOrWhiteSpace(request.Level) ? employee.Position?.Level ?? "1" : request.Level.Trim();
            var position = await ResolvePositionAsync(employee.GymId, newTitle, newLevel, cancellationToken);
            if (position.Id == employee.PositionId)
            {
                throw new BadRequestException("Employee is already on this position and level.");
            }

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var entry = NewHistory(employee.Id, today, EmploymentChangeType.PositionChange,
                employee.Position is null ? "None" : $"{employee.Position.Title} (Level {employee.Position.Level})",
                $"{position.Title} (Level {position.Level})",
                "Position change", actor.Id);

            employee.PositionId = position.Id;
            _unitOfWork.GetRepository<Employee, int>().Update(employee);
            await _unitOfWork.GetRepository<EmploymentHistory, int>().AddAsync(entry, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new MessageResponse { Message = "Position updated." };
        }

        public async Task<MessageResponse> AddCompensationAsync(int? actorUserId, int employeeId, CompensationRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var employee = await EnsureEmployeeAccessAsync(actor.Id, employeeId, "employees.compensation.manage", cancellationToken);

            var latest = (await _unitOfWork.GetRepository<Compensation, int>()
                    .GetAllAsync(new LatestCompensationSpec(employeeId), cancellationToken))
                .FirstOrDefault();
            var previous = latest is null ? "None" : latest.Amount.ToString("0.##", CultureInfo.InvariantCulture);

            var compensation = new Compensation
            {
                EmployeeId = employeeId,
                Amount = request.Salary,
                EffectiveDate = request.EffectiveDate,
                ChangedBy = actor.Id,
                Reason = "Compensation update",
            };
            var entry = NewHistory(employee.Id, request.EffectiveDate, EmploymentChangeType.CompensationChange,
                previous, request.Salary.ToString("0.##", CultureInfo.InvariantCulture),
                "Compensation update", actor.Id);

            await _unitOfWork.GetRepository<Compensation, int>().AddAsync(compensation, cancellationToken);
            await _unitOfWork.GetRepository<EmploymentHistory, int>().AddAsync(entry, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new MessageResponse { Message = "Compensation updated." };
        }

        public async Task<MessageResponse> ChangeContractAsync(int? actorUserId, int employeeId, ContractChangeRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var employee = await EnsureEmployeeAccessAsync(actor.Id, employeeId, "employees.contract.manage", cancellationToken);

            if (request.Level is null && request.Salary is null && request.EffectiveDate is null)
            {
                throw new BadRequestException("Provide at least one of level, salary, or effective date.");
            }

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var previousLevel = employee.Position?.Level ?? "1";
            var previousSalary = (await _unitOfWork.GetRepository<Compensation, int>()
                    .GetAllAsync(new LatestCompensationSpec(employeeId), cancellationToken))
                .FirstOrDefault()?.Amount;

            var newLevel = string.IsNullOrWhiteSpace(request.Level) ? previousLevel : request.Level.Trim();
            var changes = new List<string>();

            if (!string.IsNullOrWhiteSpace(request.Level) && newLevel != previousLevel)
            {
                var position = await ResolvePositionAsync(
                    employee.GymId, employee.Position?.Title ?? string.Empty, newLevel, cancellationToken);
                employee.PositionId = position.Id;
                changes.Add($"level {previousLevel} → {newLevel}");
            }

            if (request.Salary.HasValue)
            {
                var compensation = new Compensation
                {
                    EmployeeId = employeeId,
                    Amount = request.Salary.Value,
                    EffectiveDate = request.EffectiveDate ?? today,
                    ChangedBy = actor.Id,
                    Reason = "Contract change",
                };
                await _unitOfWork.GetRepository<Compensation, int>().AddAsync(compensation, cancellationToken);
                changes.Add($"salary {previousSalary?.ToString("0.##", CultureInfo.InvariantCulture) ?? "None"} → {request.Salary.Value.ToString("0.##", CultureInfo.InvariantCulture)}");
            }

            if (request.EffectiveDate.HasValue)
            {
                employee.ContractStartDate = request.EffectiveDate.Value;
                changes.Add($"start date → {request.EffectiveDate.Value:yyyy-MM-dd}");
            }

            if (changes.Count == 0)
            {
                throw new BadRequestException("Contract change matches the current contract.");
            }

            var entry = NewHistory(employee.Id, request.EffectiveDate ?? today, EmploymentChangeType.ContractChange,
                $"Level {previousLevel}, salary {previousSalary?.ToString("0.##", CultureInfo.InvariantCulture) ?? "None"}",
                string.Join(", ", changes),
                "Contract change", actor.Id);

            _unitOfWork.GetRepository<Employee, int>().Update(employee);
            await _unitOfWork.GetRepository<EmploymentHistory, int>().AddAsync(entry, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new MessageResponse { Message = "Contract updated." };
        }

        public async Task<MessageResponse> ChangeEmployeeRoleAsync(int? actorUserId, int employeeId, RoleChangeRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(actorUserId, cancellationToken);
            var employee = await EnsureEmployeeAccessAsync(actor.Id, employeeId, "employees.role.assign", cancellationToken);
            var userId = (employee.User ?? throw new NotFoundException("Employee has no linked user account.")).Id;

            var currentRoleIds = await _userAccess.GetUserRoleIdsAsync(userId, cancellationToken);
            var currentNames = new List<string>();
            foreach (var currentRoleId in currentRoleIds)
            {
                var currentRole = await _unitOfWork.GetRepository<Role, int>().GetByIdAsync(currentRoleId, cancellationToken);
                if (currentRole is not null)
                {
                    currentNames.Add(currentRole.Name);
                }
            }

            // systemRole: null/blank/"None (Employee)" clears; any other value must
            // resolve to an existing role by name (Branch Manager, Team Leader, …).
            var systemRole = request.SystemRole?.Trim();
            Role? targetRole = null;
            if (!string.IsNullOrWhiteSpace(systemRole)
                && !string.Equals(systemRole, "None (Employee)", StringComparison.OrdinalIgnoreCase))
            {
                targetRole = (await _unitOfWork.GetRepository<Role, int>()
                        .GetAllAsync(new RoleByNameSpec(systemRole), cancellationToken))
                    .FirstOrDefault()
                    ?? throw new BadRequestException(
                        $"Unknown system role '{systemRole}'. Create it under Roles & Permissions first.");
            }

            await _userAccess.ReplaceUserRolesAsync(
                userId, targetRole is null ? [] : [targetRole.Id], cancellationToken);

            // permissions: null leaves direct overrides untouched; a list replaces
            // them wholesale (the modal submits its complete toggle state).
            if (request.Permissions is not null)
            {
                var permissionIds = await ResolvePermissionIdsAsync(request.Permissions, cancellationToken);
                await _userAccess.ReplaceUserPermissionsAsync(userId, permissionIds, cancellationToken);
            }

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var from = currentNames.Count > 0
                ? string.Join(", ", currentNames.OrderBy(n => n, StringComparer.Ordinal))
                : "None (Employee)";
            var to = targetRole?.Name ?? "None (Employee)";
            var entry = NewHistory(employee.Id, today, EmploymentChangeType.RoleChange,
                from, to, "Role change", actor.Id);

            await _unitOfWork.GetRepository<EmploymentHistory, int>().AddAsync(entry, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new MessageResponse { Message = "Role changed." };
        }

        /// <summary>Validates keys against the permission catalog; unknown keys are a 400 listing them.</summary>
        private async Task<IReadOnlyList<int>> ResolvePermissionIdsAsync(IReadOnlyCollection<string?> keys, CancellationToken cancellationToken)
        {
            var requested = keys
                .Where(key => !string.IsNullOrWhiteSpace(key))
                .Select(key => key!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var catalog = await _unitOfWork.GetRepository<Permission, int>()
                .GetAllAsync(new PermissionCatalogSpec(), cancellationToken);
            var idByKey = catalog
                .GroupBy(p => p.Key, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First().Id, StringComparer.OrdinalIgnoreCase);

            var unknown = requested.Where(key => !idByKey.ContainsKey(key)).ToList();
            if (unknown.Count > 0)
            {
                throw new BadRequestException($"Unknown permission key(s): {string.Join(", ", unknown)}.");
            }

            return requested.Select(key => idByKey[key]).Distinct().ToList();
        }

        private async Task<Employee> CreateEmployeeCoreAsync(
            User actor,
            string firstName,
            string lastName,
            string email,
            string? phone,
            string positionTitle,
            string? level,
            int gymId,
            decimal? salary,
            DateOnly startDate,
            CancellationToken cancellationToken)
        {
            var gym = await EnsureGymAsync(gymId, cancellationToken);
            await _accessControl.EnsurePermissionForGymAsync(actor.Id, "employees.create", gym.Id, cancellationToken);

            var normalizedEmail = email.Trim().ToLowerInvariant();
            var existing = await _unitOfWork.GetRepository<User, int>()
                .GetByIdAsync(new UserByEmailSpec(normalizedEmail), cancellationToken);
            if (existing is not null)
            {
                throw new BadRequestException($"Email '{normalizedEmail}' is already in use.");
            }

            var position = await ResolvePositionAsync(gym.Id, positionTitle, level, cancellationToken);
            var fullName = $"{firstName.Trim()} {lastName.Trim()}".Trim();

            var user = new User
            {
                UserName = normalizedEmail,
                Email = normalizedEmail,
                PasswordHash = _passwordHasher.Hash(DefaultNewAccountPassword),
                UserType = UserType.Employee,
                IsActive = true,
            };
            await _unitOfWork.GetRepository<User, int>().AddAsync(user, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var hireDate = DateOnly.FromDateTime(DateTime.UtcNow);
            var employee = new Employee
            {
                UserId = user.Id,
                GymId = gym.Id,
                PositionId = position.Id,
                FullName = fullName,
                Phone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim(),
                Status = EmployeeStatus.Active,
                ContractType = "FullTime",
                ContractStartDate = startDate,
                HireDate = hireDate,
                EmployeeNumber = await GenerateEmployeeNumberAsync(cancellationToken),
            };
            await _unitOfWork.GetRepository<Employee, int>().AddAsync(employee, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            await _unitOfWork.GetRepository<EmploymentHistory, int>().AddAsync(NewHistory(
                employee.Id, hireDate, EmploymentChangeType.Hire,
                null, $"Joined {gym.Name} as {position.Title} (Level {position.Level})",
                "New hire", actor.Id), cancellationToken);

            if (salary.HasValue)
            {
                await _unitOfWork.GetRepository<Compensation, int>().AddAsync(new Compensation
                {
                    EmployeeId = employee.Id,
                    Amount = salary.Value,
                    EffectiveDate = startDate,
                    ChangedBy = actor.Id,
                    Reason = "Hire",
                }, cancellationToken);
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await _userAccess.AddGymAccessAsync(user.Id, gym.Id, cancellationToken);

            return await _unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employee.Id), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");
        }

        /// <summary>EMP-#### from the highest existing numeric suffix, floored at 1001.</summary>
        private async Task<string> GenerateEmployeeNumberAsync(CancellationToken cancellationToken)
        {
            var employees = await _unitOfWork.GetRepository<Employee, int>().GetAllAsync(cancellationToken);
            var max = employees
                .Where(e => e.EmployeeNumber.StartsWith("EMP-", StringComparison.Ordinal))
                .Select(e => int.TryParse(e.EmployeeNumber["EMP-".Length..], out var n) ? n : 0)
                .DefaultIfEmpty(1000)
                .Max();
            return $"EMP-{Math.Max(max + 1, 1001)}";
        }

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

        /// <summary>The gym an employee belongs to (for guard checks).</summary>
        private async Task<int> GymOfAsync(int employeeId, CancellationToken cancellationToken)
        {
            var employee = await _unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");
            return employee.GymId;
        }

        /// <summary>Loads an employee and enforces the guard on the employee's gym.</summary>
        private async Task<Employee> EnsureEmployeeAccessAsync(int actorUserId, int employeeId, string permissionKey, CancellationToken cancellationToken)
        {
            var employee = await _unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            await _accessControl.EnsurePermissionForGymAsync(actorUserId, permissionKey, employee.GymId, cancellationToken);
            return employee;
        }

        private async Task<Gym> EnsureGymAsync(int gymId, CancellationToken cancellationToken)
        {
            var gym = await _unitOfWork.GetRepository<Gym, int>()
                .GetByIdAsync(new GymByIdSpec(gymId), cancellationToken)
                ?? throw new NotFoundException("Gym not found.");

            if (gym.Status != GymStatus.Active)
            {
                throw new BadRequestException($"Gym '{gym.Name}' is suspended. Reactivate it before assigning employees.");
            }

            return gym;
        }

        /// <summary>Exact (title, level) match in the gym's catalog, else creates one.</summary>
        private async Task<Position> ResolvePositionAsync(int gymId, string title, string? level, CancellationToken cancellationToken)
        {
            var cleanTitle = title.Trim();
            var cleanLevel = string.IsNullOrWhiteSpace(level) ? "1" : level.Trim();

            var catalog = await _unitOfWork.GetRepository<Position, int>()
                .GetAllAsync(new GymPositionsSpec(gymId), cancellationToken);
            var match = catalog.FirstOrDefault(p =>
                string.Equals(p.Title.Trim(), cleanTitle, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(p.Level.Trim(), cleanLevel, StringComparison.OrdinalIgnoreCase));
            if (match is not null)
            {
                return match;
            }

            var position = new Position
            {
                GymId = gymId,
                Title = cleanTitle,
                Level = cleanLevel,
            };
            await _unitOfWork.GetRepository<Position, int>().AddAsync(position, cancellationToken);
            // Persist immediately so position.Id is real: callers assign
            // Employee.PositionId by value, and an unsaved 0 would break the FK.
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return position;
        }

        /// <summary>
        /// Old/New values are stored in Postgres json columns, so the readable text
        /// is serialized as a JSON string literal (quoted) rather than raw text.
        /// </summary>
        internal static EmploymentHistory NewHistory(
            int employeeId,
            DateOnly effectiveDate,
            EmploymentChangeType type,
            string? from,
            string to,
            string reason,
            int actorUserId) => new()
            {
                EmployeeId = employeeId,
                EffectiveDate = effectiveDate,
                ChangeType = type,
                OldValueJson = JsonSerializer.Serialize(from ?? string.Empty),
                NewValueJson = JsonSerializer.Serialize(to),
                Reason = reason,
                ChangedBy = actorUserId,
            };

        /// <summary>
        /// History values are stored as JSON string literals; unwrap them for display
        /// and tolerate legacy plain-text rows.
        /// </summary>
        private static string? UnwrapHistoryValue(string? value)
        {
            if (string.IsNullOrEmpty(value))
            {
                return null;
            }

            try
            {
                return JsonSerializer.Deserialize<string>(value) ?? value;
            }
            catch (JsonException)
            {
                return value;
            }
        }

        private async Task<EmployeeDetailResponse> BuildDetailAsync(Employee employee, CancellationToken cancellationToken)
        {
            var branchIds = employee.User?.UserGymAccesses?
                .Select(a => a.GymId)
                .Distinct()
                .ToArray() ?? [];

            IReadOnlyList<Gym> branches = [];
            if (branchIds.Length > 0)
            {
                branches = (await _unitOfWork.GetRepository<Gym, int>()
                    .GetAllAsync(new GymsByIdsSpec(branchIds), cancellationToken)).ToList();
            }

            var latestSalary = employee.Compensations?
                .OrderByDescending(c => c.EffectiveDate)
                .ThenByDescending(c => c.Id)
                .FirstOrDefault()?.Amount;

            return new EmployeeDetailResponse
            {
                Id = employee.Id,
                EmployeeNumber = employee.EmployeeNumber,
                Name = employee.FullName,
                Position = employee.Position?.Title,
                Level = employee.Position?.Level,
                GymId = employee.GymId,
                Gym = employee.Gym?.Name,
                Status = StatusDisplay(employee.Status),
                Initials = BuildInitials(employee.FullName),
                HireDate = employee.HireDate,
                Email = employee.User?.Email ?? string.Empty,
                Phone = employee.Phone,
                Salary = latestSalary,
                SystemRole = null, // populated when roles ship (S2)
                Branches = branches.Select(b => new Shared.DataTransferObject.Gym.GymSummary
                {
                    Id = b.Id,
                    Name = b.Name,
                    Branch = b.Location,
                }).ToList(),
            };
        }

        private static EmployeeListItem BuildListItem(Employee employee) => new()
        {
            Id = employee.Id,
            EmployeeNumber = employee.EmployeeNumber,
            Name = employee.FullName,
            Position = employee.Position?.Title,
            Level = employee.Position?.Level,
            GymId = employee.GymId,
            Gym = employee.Gym?.Name,
            Status = StatusDisplay(employee.Status),
            Initials = BuildInitials(employee.FullName),
            HireDate = employee.HireDate,
            Salary = employee.Compensations?
                .OrderByDescending(c => c.EffectiveDate)
                .ThenByDescending(c => c.Id)
                .FirstOrDefault()?.Amount,
            Phone = employee.Phone,
            Email = employee.User?.Email,
        };

        private static string BuildInitials(string fullName)
        {
            var parts = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (parts.Length >= 2)
            {
                return $"{parts[0][0]}{parts[^1][0]}".ToUpperInvariant();
            }

            return parts.Length == 1 ? parts[0][0].ToString().ToUpperInvariant() : string.Empty;
        }

        internal static string StatusDisplay(EmployeeStatus status) => status switch
        {
            EmployeeStatus.OnLeave => "On Leave",
            EmployeeStatus.NoticePeriod => "Notice Period",
            _ => status.ToString(),
        };

        private static EmployeeStatus? ParseStatusOrNull(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            var normalized = value.Replace(" ", string.Empty, StringComparison.Ordinal);
            if (!Enum.TryParse<EmployeeStatus>(normalized, ignoreCase: true, out var parsed))
            {
                throw new BadRequestException("Status must be Active, On Leave, Notice Period, Suspended, or Terminated.");
            }

            return parsed;
        }

        private static string ChangeTypeDisplay(EmploymentChangeType type) => type switch
        {
            EmploymentChangeType.Transfer => "Gym Transfer",
            EmploymentChangeType.PositionChange => "Position Changed",
            EmploymentChangeType.RoleChange => "Role Changed",
            EmploymentChangeType.StatusChange => "Status Changed",
            EmploymentChangeType.CompensationChange => "Salary Changed",
            EmploymentChangeType.ContractChange => "Contract Updated",
            EmploymentChangeType.Hire => "Joined Revive",
            EmploymentChangeType.Offboard => "Offboarded",
            _ => type.ToString(),
        };

        private static string DocumentCategoryDisplay(DocumentType type) => type switch
        {
            DocumentType.Contract => "Employment Contract",
            DocumentType.NationalId => "Identification",
            _ => type.ToString(),
        };

        private static DocumentType ParseDocumentCategory(string category)
        {
            var normalized = category.Trim().ToLowerInvariant()
                .Replace(" ", string.Empty, StringComparison.Ordinal)
                .Replace("-", string.Empty, StringComparison.Ordinal);
            return normalized switch
            {
                "employmentcontract" or "contract" => DocumentType.Contract,
                "identification" or "nationalid" => DocumentType.NationalId,
                "certification" or "firstaid" or "medicalfitness" or "degreecertificate" => DocumentType.Certification,
                "personalphoto" or "photo" or "other" => DocumentType.Other,
                _ => throw new BadRequestException(
                    "Category must be Employment Contract, Identification, Personal Photo, First Aid, Medical Fitness, Degree Certificate, or Other."),
            };
        }

        /// <summary>No expiry, or expiring more than 30 days out, is "Valid".</summary>
        private static string DocumentStatusDisplay(DateOnly? expiryDate)
        {
            if (expiryDate is null)
            {
                return "Valid";
            }

            var threshold = DateOnly.FromDateTime(DateTime.Today).AddDays(30);
            return expiryDate <= threshold ? "Expiring Soon" : "Valid";
        }
    }
}
