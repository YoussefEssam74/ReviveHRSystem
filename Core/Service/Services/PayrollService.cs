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
        ITeamScopeService _teamScope) : IPayrollService
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

            var data = BuildPeriodDetail(period, entries);
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

        public async Task<CloseEntryResponse> CloseEntryAsync(int? actorUserId, int periodId, int employeeId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "payroll.edit", cancellationToken);
            var (_, entry) = await LoadEntryAsync(actor, periodId, employeeId, requireOpen: true, cancellationToken);

            var pending = entry.LineItems.Count(l => l.Status == "Pending");
            if (pending > 0)
            {
                throw new BadRequestException($"Settle the {pending} pending deduction line(s) before closing this sheet.");
            }

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
            line.ReviewedBy = actor.Id;
            line.ReviewedAt = DateTime.UtcNow;

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
                Data = BuildPayslip(entry),
            };
        }

        /// <summary>
        /// The mock §8 payslip card (period, money lines, deductions with statuses)
        /// shared by the HR preview and the portal's self-service payslip.
        /// </summary>
        internal static PayslipData BuildPayslip(PayrollEntry entry)
        {
            var gross = GrossOf(entry);
            var approved = ApprovedDeductionsOf(entry);

            return new PayslipData
            {
                Period = PeriodLabel(entry.PayrollPeriod),
                Gym = entry.PayrollPeriod.Gym.Name,
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
                Days = entry.DaysWorked,
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

            return new EmployeePayrollResponse
            {
                Items = rows.Select(e => MapEntry(e, PeriodLabel(e.PayrollPeriod))).ToList(),
            };
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

        private static PayrollPeriodDetailData BuildPeriodDetail(PayrollPeriod period, List<PayrollEntry> entries)
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
                Items = entries.Select(e => MapEntry(e)).ToList(),
            };
        }

        private static PayrollEntryItem MapEntry(PayrollEntry entry, string? periodLabel = null)
        {
            var gross = GrossOf(entry);
            var approved = ApprovedDeductionsOf(entry);
            return new PayrollEntryItem
            {
                EmployeeId = entry.EmployeeId,
                Name = entry.Employee.FullName,
                Initials = HrPortalHelpers.BuildInitials(entry.Employee.FullName),
                Gym = entry.Employee.Gym?.Name ?? string.Empty,
                Position = entry.Employee.Position?.Title ?? "None",
                EmploymentStatus = FriendlyEmployment(entry.Employee.Status),
                Days = entry.DaysWorked,
                Overtime = entry.OvertimeHours,
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
        private static decimal OvertimePay(PayrollEntry entry) =>
            entry.BaseSalary <= 0 || entry.OvertimeHours <= 0
                ? 0m
                : Math.Round(entry.BaseSalary / 176m * 1.5m * entry.OvertimeHours, 2);

        internal static decimal GrossOf(PayrollEntry entry) =>
            entry.BaseSalary + entry.TotalBonuses + OvertimePay(entry);

        private static decimal ApprovedDeductionsOf(PayrollEntry entry) =>
            entry.LineItems.Where(l => l.Status is "Accepted" or "Approved").Sum(l => l.Amount);

        private static int PendingCountOf(PayrollEntry entry) =>
            entry.LineItems.Count(l => l.Status == "Pending");

        internal static decimal NetOf(PayrollEntry entry) => GrossOf(entry) - ApprovedDeductionsOf(entry);

        /// <summary>Mirrors the recomputed money back onto the stored row for history/exports.</summary>
        private static void SyncTotals(PayrollEntry entry)
        {
            entry.TotalDeductions = ApprovedDeductionsOf(entry);
            entry.NetPay = NetOf(entry);
        }

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
