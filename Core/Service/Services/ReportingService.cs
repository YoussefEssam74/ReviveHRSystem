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
using DomainLayer.Models.RecruitmentModule;
using DomainLayer.Models.RecruitmentModule.Enums;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
using DomainLayer.Models.UserModule;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Reporting;

namespace Service.Services
{
    /// <summary>
    /// Reports &amp; catalog reads (api-spec-from-ui.md §5.9): the org-wide positions
    /// catalog (one row per Position with headcount/fill derivation), the read-only
    /// audit log with its category/user/date filters, and the overview CSV export.
    /// All three are read-only — no writes beyond the position rows themselves.
    /// </summary>
    public sealed class ReportingService(
        IUnitOfWork _unitOfWork,
        IAccessControlService _accessControl,
        IUserAccessRepository _userAccess) : IReportingService
    {
        // ==================================================================
        // Positions catalog (§9.2)
        // ==================================================================

        public async Task<PositionCatalogResponse> GetPositionsAsync(int? actorUserId, PositionCatalogQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "positions.view", cancellationToken);
            var scope = await HrPortalHelpers.ResolveGymScopeAsync(_unitOfWork, _userAccess, actor, query.Gym, cancellationToken);

            var rows = (await _unitOfWork.GetRepository<Position, int>()
                .GetAllAsync(new PositionCatalogSpec(scope, query.Gym, HrPortalHelpers.NullIfBlank(query.SearchTerm), query.Active), cancellationToken))
                .ToList();

            var filled = await CountFilledAsync(cancellationToken);

            var items = rows.Select(p => BuildPositionItem(p, filled)).ToList();
            return new PositionCatalogResponse { Items = items, Total = items.Count };
        }

        public async Task<PositionDataResponse> CreatePositionAsync(int? actorUserId, UpsertPositionRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "positions.manage", cancellationToken);

            var title = HrPortalHelpers.NullIfBlank(request.Title)
                ?? throw new BadRequestException("Title is required.");
            var levels = (request.Levels ?? [])
                .Where(level => !string.IsNullOrWhiteSpace(level))
                .Select(level => level.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (levels.Count == 0)
            {
                levels.Add("Junior");
            }

            var gym = await HrPortalHelpers.ResolveGymAsync(_unitOfWork, _userAccess, actor, request.GymId, request.Gym, cancellationToken);
            var department = await ResolveDepartmentAsync(gym.Id, HrPortalHelpers.NullIfBlank(request.Department), cancellationToken);

            var position = new Position
            {
                GymId = gym.Id,
                DepartmentId = department?.Id,
                Title = title,
                Level = string.Join(", ", levels),
                Headcount = Math.Max(request.Headcount ?? 0, 0),
                IsActive = request.Active ?? true,
            };
            await _unitOfWork.GetRepository<Position, int>().AddAsync(position, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var filled = await CountFilledAsync(cancellationToken);
            return new PositionDataResponse { Data = BuildPositionItem(position, filled) };
        }

        public async Task<PositionDataResponse> UpdatePositionAsync(int? actorUserId, int positionId, UpsertPositionRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "positions.manage", cancellationToken);

            var position = await _unitOfWork.GetRepository<Position, int>().GetByIdAsync(positionId, cancellationToken)
                ?? throw new NotFoundException("Position not found.");

            var title = HrPortalHelpers.NullIfBlank(request.Title);
            if (title is not null)
            {
                position.Title = title;
            }

            var levels = (request.Levels ?? [])
                .Where(level => !string.IsNullOrWhiteSpace(level))
                .Select(level => level.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (levels.Count > 0)
            {
                position.Level = string.Join(", ", levels);
            }

            if (request.GymId is not null || HrPortalHelpers.NullIfBlank(request.Gym) is not null)
            {
                var gym = await HrPortalHelpers.ResolveGymAsync(_unitOfWork, _userAccess, actor, request.GymId, request.Gym, cancellationToken);
                position.GymId = gym.Id;
            }

            if (HrPortalHelpers.NullIfBlank(request.Department) is string departmentName)
            {
                var department = await ResolveDepartmentAsync(position.GymId, departmentName, cancellationToken);
                position.DepartmentId = department?.Id;
            }

            if (request.Headcount is int headcount)
            {
                position.Headcount = Math.Max(headcount, 0);
            }

            if (request.Active is bool active)
            {
                position.IsActive = active;
            }

            _unitOfWork.GetRepository<Position, int>().Update(position);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var filled = await CountFilledAsync(cancellationToken);
            return new PositionDataResponse { Data = BuildPositionItem(position, filled) };
        }

        // ==================================================================
        // Audit log (§9.3)
        // ==================================================================

        public async Task<AuditLogListResponse> GetAuditLogAsync(int? actorUserId, AuditLogListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "audit.view", cancellationToken);
            var scope = await HrPortalHelpers.ResolveGymScopeAsync(_unitOfWork, _userAccess, actor, query.Gym, cancellationToken);

            var page = Math.Max(query.Page, 1);
            var pageSize = HrPortalHelpers.NormalizePageSize(query.PageSize);
            var skip = (page - 1) * pageSize;

            var filter = new AuditLogListSpec(scope, query.Gym, query.User, query.Action, query.From, query.To, skip, pageSize);
            var countFilter = new AuditLogListSpec(scope, query.Gym, query.User, query.Action, query.From, query.To, 0, 0);

            var total = await _unitOfWork.GetRepository<AuditLog, int>().CountAsync(countFilter, cancellationToken);
            var rows = (await _unitOfWork.GetRepository<AuditLog, int>().GetAllAsync(filter, cancellationToken)).ToList();

            var userNames = await HrPortalHelpers.LoadUserDisplayNamesAsync(
                _unitOfWork, rows.Select(r => r.UserId).ToList(), cancellationToken);
            var gymNames = await LoadGymNamesAsync(rows.Select(r => r.GymId).ToList(), cancellationToken);

            return new AuditLogListResponse
            {
                Items = rows.Select(row => new AuditLogItem
                {
                    Id = row.Id,
                    Action = row.Action,
                    User = row.UserId is int userId && userNames.TryGetValue(userId, out var name) ? name : "System",
                    Target = $"{row.EntityType} #{row.EntityId}",
                    Detail = SummarizeChanges(row.NewValues ?? row.OldValues),
                    Timestamp = row.Timestamp,
                    Gym = row.GymId is int gymId && gymNames.TryGetValue(gymId, out var gymName) ? gymName : "All Gyms",
                }).ToList(),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(total / (double)pageSize) : 0,
            };
        }

        // ==================================================================
        // Overview CSV export (§9.1)
        // ==================================================================

        public async Task<(string FileName, byte[] Content)> ExportReportAsync(int? actorUserId, ReportExportQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "reports.view", cancellationToken);
            var scope = await HrPortalHelpers.ResolveGymScopeAsync(_unitOfWork, _userAccess, actor, null, cancellationToken);

            var (periodLabel, from) = ResolvePeriod(query.Period);
            Func<int, bool> inScope = scope.Length == 0 ? _ => true : id => scope.Contains(id);

            var sb = new StringBuilder();
            sb.AppendLine("Section,Metric,Value");

            // ---- Workforce ----
            var employees = (await _unitOfWork.GetRepository<Employee, int>().GetAllAsync(cancellationToken))
                .Where(e => inScope(e.GymId))
                .ToList();
            var activeEmployees = employees.Count(e => e.Status == EmployeeStatus.Active);
            Append(sb, "Workforce", "Total employees", employees.Count);
            Append(sb, "Workforce", "Active employees", activeEmployees);
            Append(sb, "Workforce", "On leave", employees.Count(e => e.Status == EmployeeStatus.OnLeave));
            Append(sb, "Workforce", "In notice period", employees.Count(e => e.Status == EmployeeStatus.NoticePeriod));
            Append(sb, "Workforce", "Suspended", employees.Count(e => e.Status == EmployeeStatus.Suspended));
            Append(sb, "Workforce", "Terminated", employees.Count(e => e.Status == EmployeeStatus.Terminated));
            Append(sb, "Workforce", "New hires in period", employees.Count(e => e.HireDate >= DateOnly.FromDateTime(from)));

            foreach (var byGym in employees
                .Where(e => e.Status == EmployeeStatus.Active)
                .GroupBy(e => e.GymId)
                .OrderBy(g => g.Key))
            {
                var gym = await _unitOfWork.GetRepository<Gym, int>().GetByIdAsync(byGym.Key, cancellationToken);
                Append(sb, "Workforce", $"Active headcount — {gym?.Name ?? $"Gym {byGym.Key}"}", byGym.Count());
            }

            // ---- Attendance ----
            var attendance = (await _unitOfWork.GetRepository<AttendanceRecord, int>().GetAllAsync(cancellationToken))
                .Where(r => inScope(r.GymId) && r.Date >= DateOnly.FromDateTime(from))
                .ToList();
            var worked = attendance
                .Where(r => r.Status is AttendanceStatus.OnTime
                    or AttendanceStatus.Late
                    or AttendanceStatus.EarlyCheckout)
                .ToList();
            Append(sb, "Attendance", "Records in period", attendance.Count);
            Append(sb, "Attendance", "On time", attendance.Count(r => r.Status == AttendanceStatus.OnTime));
            Append(sb, "Attendance", "Late", attendance.Count(r => r.Status == AttendanceStatus.Late));
            Append(sb, "Attendance", "Absent", attendance.Count(r => r.Status == AttendanceStatus.Absent));
            Append(sb, "Attendance", "Missing checkout", attendance.Count(r => r.Status == AttendanceStatus.MissingCheckout));
            var onTime = worked.Count(r => r.Status == AttendanceStatus.OnTime);
            Append(sb, "Attendance", "On-time rate %", worked.Count == 0 ? 0 : (int)Math.Round(onTime * 100d / worked.Count));

            // ---- Requests ----
            var requests = (await _unitOfWork.GetRepository<EmployeeRequest, int>().GetAllAsync(cancellationToken))
                .Where(r => r.Employee != null && inScope(r.Employee.GymId) && r.RequestDate >= DateOnly.FromDateTime(from))
                .ToList();
            Append(sb, "Requests", "Requests in period", requests.Count);
            Append(sb, "Requests", "Approved", requests.Count(r => r.Status == RequestStatus.Approved));
            Append(sb, "Requests", "Rejected", requests.Count(r => r.Status == RequestStatus.Rejected));
            Append(sb, "Requests", "Pending", requests.Count(r => r.Status is RequestStatus.Pending or RequestStatus.PendingHRReview));

            // ---- Hiring ----
            var vacancies = (await _unitOfWork.GetRepository<Vacancy, int>().GetAllAsync(cancellationToken))
                .Where(v => inScope(v.GymId))
                .ToList();
            Append(sb, "Hiring", "Open vacancies", vacancies.Count(v => v.Status == VacancyStatus.Open));
            Append(sb, "Hiring", "Open slots", vacancies.Where(v => v.Status == VacancyStatus.Open).Sum(v => v.HeadcountNeeded));
            var applications = (await _unitOfWork.GetRepository<Application, int>().GetAllAsync(cancellationToken))
                .Where(a => a.Vacancy is null ? scope.Length == 0 : inScope(a.Vacancy.GymId))
                .ToList();
            Append(sb, "Hiring", "Applications in pipeline", applications.Count(a => a.Status == ApplicationStatus.InProgress));
            Append(sb, "Hiring", "Hired in period", applications.Count(a =>
                a.Status == ApplicationStatus.Hired && a.LastActivityAt >= from));

            // ---- Positions ----
            var positions = (await _unitOfWork.GetRepository<Position, int>().GetAllAsync(cancellationToken))
                .Where(p => inScope(p.GymId))
                .ToList();
            Append(sb, "Positions", "Position rows", positions.Count);
            Append(sb, "Positions", "Planned headcount", positions.Sum(p => p.Headcount));
            Append(sb, "Positions", "Active positions", positions.Count(p => p.IsActive));

            // ---- Payroll ----
            var entries = (await _unitOfWork.GetRepository<PayrollEntry, int>().GetAllAsync(cancellationToken))
                .Where(en => en.PayrollPeriod != null && inScope(en.PayrollPeriod.GymId))
                .ToList();
            Append(sb, "Payroll", "Payroll entries", entries.Count);
            Append(sb, "Payroll", "Total net pay", entries.Sum(en => en.NetPay).ToString("0.##", CultureInfo.InvariantCulture));

            // ---- Separations ----
            var separations = (await _unitOfWork.GetRepository<OffboardingCase, int>().GetAllAsync(cancellationToken))
                .Where(c => c.Employee != null && inScope(c.Employee.GymId) && c.InitiatedAt >= from)
                .ToList();
            Append(sb, "Separations", "Separations in period", separations.Count);
            Append(sb, "Separations", "Open checklists", separations.Count(c => c.Status == "Open"));

            var stamp = DateTime.UtcNow.ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture);
            return ($"revive-reports-{periodLabel}-{stamp}.csv", Encoding.UTF8.GetBytes(sb.ToString()));
        }

        // ==================================================================
        // Helpers
        // ==================================================================

        private static void Append(StringBuilder sb, string section, string metric, object value) =>
            sb.Append(Csv(section)).Append(',').Append(Csv(metric)).Append(',').Append(Csv(value)).AppendLine();

        private static string Csv(object value) =>
            $"\"{Convert.ToString(value, CultureInfo.InvariantCulture)?.Replace("\"", "\"\"") ?? string.Empty}\"";

        /// <summary>30d | 90d | ytd (unknown → 30d). Returns the label and window start.</summary>
        private static (string Label, DateTime From) ResolvePeriod(string? period)
        {
            var now = DateTime.UtcNow;
            return period?.Trim().ToLowerInvariant() switch
            {
                "90d" => ("90d", now.AddDays(-90)),
                "ytd" => ("ytd", new DateTime(now.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc)),
                _ => ("30d", now.AddDays(-30)),
            };
        }

        /// <summary>Position row → catalog card: levels split from the stored string, filled/open/fill derived.</summary>
        private static PositionCatalogItem BuildPositionItem(Position position, IReadOnlyDictionary<int, int> filledCounts)
        {
            var filled = position.Id != 0 && filledCounts.TryGetValue(position.Id, out var count) ? count : 0;
            var headcount = position.Headcount;
            var open = Math.Max(headcount - filled, 0);
            return new PositionCatalogItem
            {
                Id = position.Id,
                Title = position.Title,
                Levels = position.Level
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .ToList(),
                Department = position.Department?.Name,
                Gym = position.Gym?.Name ?? string.Empty,
                Headcount = headcount,
                Active = filled,
                Open = open,
                Fill = (int)Math.Round(filled * 100d / Math.Max(headcount, 1)),
            };
        }

        /// <summary>PositionId → number of active employees currently holding it.</summary>
        private async Task<Dictionary<int, int>> CountFilledAsync(CancellationToken cancellationToken)
        {
            var employees = await _unitOfWork.GetRepository<Employee, int>().GetAllAsync(cancellationToken);
            return employees
                .Where(e => e.Status == EmployeeStatus.Active)
                .GroupBy(e => e.PositionId)
                .ToDictionary(g => g.Key, g => g.Count());
        }

        /// <summary>Resolves (or creates) the gym-scoped department by name; blank name → null.</summary>
        private async Task<Department?> ResolveDepartmentAsync(int gymId, string? name, CancellationToken cancellationToken)
        {
            if (name is null)
            {
                return null;
            }

            var departments = await _unitOfWork.GetRepository<Department, int>().GetAllAsync(cancellationToken);
            var match = departments.FirstOrDefault(d =>
                d.GymId == gymId && string.Equals(d.Name.Trim(), name, StringComparison.OrdinalIgnoreCase));
            if (match is not null)
            {
                return match;
            }

            match = new Department { GymId = gymId, Name = name };
            await _unitOfWork.GetRepository<Department, int>().AddAsync(match, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return match;
        }

        private async Task<Dictionary<int, string>> LoadGymNamesAsync(IEnumerable<int?> gymIds, CancellationToken cancellationToken)
        {
            var ids = gymIds.Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
            var names = new Dictionary<int, string>();
            foreach (var id in ids)
            {
                var gym = await _unitOfWork.GetRepository<Gym, int>().GetByIdAsync(id, cancellationToken);
                if (gym is not null)
                {
                    names[id] = gym.Name;
                }
            }

            return names;
        }

        /// <summary>"{ key: value, … }" digest of a change snapshot (truncated for the row).</summary>
        private static string SummarizeChanges(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return string.Empty;
            }

            try
            {
                using var document = JsonDocument.Parse(json);
                if (document.RootElement.ValueKind != JsonValueKind.Object)
                {
                    return Truncate(json.Trim(), 120);
                }

                var pairs = new List<string>();
                foreach (var property in document.RootElement.EnumerateObject())
                {
                    var value = property.Value.ValueKind == JsonValueKind.String
                        ? property.Value.GetString() ?? string.Empty
                        : property.Value.ToString();
                    pairs.Add($"{property.Name}: {value}");
                    if (pairs.Count >= 4)
                    {
                        break;
                    }
                }

                return Truncate(string.Join(", ", pairs), 160);
            }
            catch (JsonException)
            {
                return Truncate(json.Trim(), 120);
            }
        }

        private static string Truncate(string value, int maxLength) =>
            value.Length <= maxLength ? value : value[..(maxLength - 1)] + "…";
    }
}
