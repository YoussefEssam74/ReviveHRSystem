using DomainLayer.Contracts;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.BillingModule;
using DomainLayer.Models.BillingModule.Enums;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.PlatformModule;
using DomainLayer.Models.PlatformModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Microsoft.EntityFrameworkCore;
using Presistence.Data;
using Shared.Authorization;

namespace Presistence.Repository
{
    /// <summary>
    /// EF implementation of the platform console's cross-entity read model.
    /// Every query is projection-shaped (no entity graph is materialized) and runs
    /// AsNoTracking; nothing here writes.
    /// </summary>
    public sealed class PlatformReadRepository(ReviveHrDbContext _db) : IPlatformReadRepository
    {
        private static DateTime MonthStart(DateTime value) => new(value.Year, value.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        // ------------------------------------------------------------------
        // Dashboard
        // ------------------------------------------------------------------

        public async Task<CompanyStatusTotals> GetCompanyStatusTotalsAsync(CancellationToken cancellationToken = default)
        {
            var byStatus = await _db.Companies
                .GroupBy(c => c.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToListAsync(cancellationToken);

            int CountOf(CompanyStatus status) => byStatus.FirstOrDefault(x => x.Status == status)?.Count ?? 0;

            return new CompanyStatusTotals
            {
                Total = byStatus.Sum(x => x.Count),
                Active = CountOf(CompanyStatus.Active),
                Trial = CountOf(CompanyStatus.Trial),
                PaymentOverdue = CountOf(CompanyStatus.PaymentOverdue),
                Suspended = CountOf(CompanyStatus.Suspended),
                Closed = CountOf(CompanyStatus.Closed),
            };
        }

        public async Task<PlatformUserTotals> GetUserTotalsAsync(CancellationToken cancellationToken = default)
        {
            var byType = await _db.Users
                .GroupBy(u => u.UserType)
                .Select(g => new { Type = g.Key, Count = g.Count() })
                .ToListAsync(cancellationToken);

            var gymMembers = await _db.Users
                .CountAsync(u => u.UserGymAccesses.Any(), cancellationToken);

            var activeCount = await _db.Users.CountAsync(u => u.IsActive, cancellationToken);

            var thisMonth = MonthStart(DateTime.UtcNow);
            var addedThisMonth = await _db.Users
                .CountAsync(u => EF.Property<DateTime>(u, "CreatedAt") >= thisMonth, cancellationToken);

            // Branch Manager / Team Leader are per-gym roles, so they are counted from
            // the gym-scoped rows of UserRoles rather than the user type.
            var perGymRoleCounts = await _db.UserRoles
                .Where(ur => ur.GymId != null
                    && (ur.RoleName == RoleNames.BranchManager || ur.RoleName == RoleNames.TeamLeader))
                .GroupBy(ur => ur.RoleName)
                .Select(g => new { Role = g.Key, Count = g.Select(x => x.UserId).Distinct().Count() })
                .ToListAsync(cancellationToken);

            int TypeCount(UserType type) => byType.FirstOrDefault(x => x.Type == type)?.Count ?? 0;
            int RoleCount(string name) => perGymRoleCounts.FirstOrDefault(x => x.Role == name)?.Count ?? 0;

            var total = byType.Sum(x => x.Count);

            return new PlatformUserTotals
            {
                Total = total,
                GymMembers = gymMembers,
                PlatformUsers = total - gymMembers,
                HrManagers = TypeCount(UserType.HRManager),
                Hr = TypeCount(UserType.HR),
                BranchManagers = RoleCount(RoleNames.BranchManager),
                TeamLeaders = RoleCount(RoleNames.TeamLeader),
                Employees = TypeCount(UserType.Employee),
                Active = activeCount,
                Suspended = total - activeCount,
                AddedThisMonth = addedThisMonth,
            };
        }

        public async Task<InvoicePeriodTotals> GetInvoiceTotalsAsync(DateTime monthStart, CancellationToken cancellationToken = default)
        {
            var from = MonthStart(monthStart);
            var to = from.AddMonths(1);

            var rows = await _db.Invoices
                .Where(i => i.PeriodStart >= from && i.PeriodStart < to && i.Status != InvoiceStatus.Void)
                .Select(i => new { i.Amount, i.AmountPaid, i.Status })
                .ToListAsync(cancellationToken);

            var billed = rows.Sum(r => r.Amount);
            var collected = rows.Sum(r => r.AmountPaid);

            return new InvoicePeriodTotals
            {
                Billed = billed,
                Collected = collected,
                Outstanding = billed - collected,
                Overdue = rows.Where(r => r.Status == InvoiceStatus.Overdue).Sum(r => r.Amount),
                InvoiceCount = rows.Count,
                PaidCount = rows.Count(r => r.Status == InvoiceStatus.Paid),
                OverdueCount = rows.Count(r => r.Status == InvoiceStatus.Overdue),
            };
        }

        public async Task<SeatUsageTotals> GetSeatUsageAsync(CancellationToken cancellationToken = default)
        {
            var capped = await _db.CompanySubscriptions
                .Where(s => s.Status != SubscriptionStatus.Cancelled)
                .Select(s => new
                {
                    s.CompanyId,
                    SeatLimit = s.SeatLimitOverride ?? s.Plan.SeatLimit,
                })
                .Where(x => x.SeatLimit != null)
                .ToListAsync(cancellationToken);

            if (capped.Count == 0)
            {
                return new SeatUsageTotals();
            }

            var companyIds = capped.Select(x => x.CompanyId).Distinct().ToList();
            var userCounts = await GetUserCountsByCompanyAsync(cancellationToken);

            return new SeatUsageTotals
            {
                Capacity = capped.Sum(x => x.SeatLimit!.Value),
                Used = companyIds.Sum(id => userCounts.TryGetValue(id, out var n) ? n : 0),
            };
        }

        public async Task<IReadOnlyList<UserGrowthBucket>> GetUserGrowthAsync(int months, CancellationToken cancellationToken = default)
        {
            var span = Math.Clamp(months, 1, 24);
            var from = MonthStart(DateTime.UtcNow).AddMonths(-(span - 1));

            var rows = await _db.Users
                .Where(u => EF.Property<DateTime>(u, "CreatedAt") >= from)
                .Select(u => EF.Property<DateTime>(u, "CreatedAt"))
                .ToListAsync(cancellationToken);

            var buckets = rows
                .GroupBy(d => new { d.Year, d.Month })
                .ToDictionary(g => (g.Key.Year, g.Key.Month), g => g.Count());

            var series = new List<UserGrowthBucket>(span);
            for (var i = 0; i < span; i++)
            {
                var month = from.AddMonths(i);
                buckets.TryGetValue((month.Year, month.Month), out var count);
                series.Add(new UserGrowthBucket { Year = month.Year, Month = month.Month, Users = count });
            }

            return series;
        }

        // ------------------------------------------------------------------
        // Companies
        // ------------------------------------------------------------------

        public async Task<IReadOnlyDictionary<int, int>> GetBranchCountsAsync(CancellationToken cancellationToken = default)
        {
            var rows = await _db.Gyms
                .GroupBy(g => g.CompanyId)
                .Select(g => new { CompanyId = g.Key, Count = g.Count() })
                .ToListAsync(cancellationToken);

            return rows.ToDictionary(r => r.CompanyId, r => r.Count);
        }

        public async Task<IReadOnlyDictionary<int, int>> GetUserCountsByCompanyAsync(CancellationToken cancellationToken = default)
        {
            // A user belongs to a company when at least one of their branches is in it.
            // Two sources: explicit grants (UserGymAccess) and employment (Employee.GymId).
            var granted = await _db.UserGymAccesses
                .Select(a => new { a.UserId, a.Gym.CompanyId })
                .Distinct()
                .ToListAsync(cancellationToken);

            var employed = await _db.Employees
                .Select(e => new { e.UserId, e.Gym.CompanyId })
                .Distinct()
                .ToListAsync(cancellationToken);

            return granted
                .Concat(employed)
                .GroupBy(x => x.CompanyId)
                .ToDictionary(g => g.Key, g => g.Select(x => x.UserId).Distinct().Count());
        }

        public async Task<IReadOnlyList<CompanySeatRow>> GetCompanySeatRowsAsync(CancellationToken cancellationToken = default)
        {
            var subs = await _db.CompanySubscriptions
                .Where(s => s.Status != SubscriptionStatus.Cancelled)
                .Select(s => new
                {
                    s.CompanyId,
                    SeatLimit = s.SeatLimitOverride ?? s.Plan.SeatLimit,
                })
                .ToListAsync(cancellationToken);

            var userCounts = await GetUserCountsByCompanyAsync(cancellationToken);

            return subs.Select(s => new CompanySeatRow
            {
                CompanyId = s.CompanyId,
                Users = userCounts.TryGetValue(s.CompanyId, out var n) ? n : 0,
                SeatLimit = s.SeatLimit,
            }).ToList();
        }

        public async Task<PlatformUserTotals> GetCompanyRoleBreakdownAsync(int companyId, CancellationToken cancellationToken = default)
        {
            var branchIds = await _db.Gyms
                .Where(g => g.CompanyId == companyId)
                .Select(g => g.Id)
                .ToListAsync(cancellationToken);

            if (branchIds.Count == 0)
            {
                return new PlatformUserTotals();
            }

            var hrUserIds = await _db.UserGymAccesses
                .Where(a => branchIds.Contains(a.GymId))
                .Select(a => a.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);

            var perGymRoles = await _db.UserRoles
                .Where(ur => ur.GymId != null && branchIds.Contains(ur.GymId.Value))
                .Select(ur => new { ur.UserId, ur.RoleName })
                .Distinct()
                .ToListAsync(cancellationToken);

            var employeeUserIds = await _db.Employees
                .Where(e => branchIds.Contains(e.GymId))
                .Select(e => e.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);

            // Desk roles come from the per-gym assignment, never from "has gym access":
            // every employee has access, so counting access holders as HR staff made the
            // breakdown report the whole gym as HR and zero employees.
            var hrStaffIds = perGymRoles
                .Where(r => r.RoleName == RoleNames.Hr || r.RoleName == RoleNames.HrManager)
                .Select(r => r.UserId)
                .ToHashSet();

            var superAdminIds = perGymRoles
                .Where(r => r.RoleName == RoleNames.SuperAdmin)
                .Select(r => r.UserId)
                .ToHashSet();

            var branchManagerIds = perGymRoles
                .Where(r => r.RoleName == RoleNames.BranchManager)
                .Select(r => r.UserId)
                .ToHashSet();

            var teamLeaderIds = perGymRoles
                .Where(r => r.RoleName == RoleNames.TeamLeader)
                .Select(r => r.UserId)
                .ToHashSet();

            var allUserIds = hrUserIds
                .Concat(employeeUserIds)
                .Concat(branchManagerIds)
                .Concat(teamLeaderIds)
                .ToHashSet();

            // An employee who also holds a desk role is counted once, under the desk role.
            var employees = allUserIds
                .Where(id => !branchManagerIds.Contains(id)
                             && !teamLeaderIds.Contains(id)
                             && !hrStaffIds.Contains(id)
                             && !superAdminIds.Contains(id))
                .Count();

            return new PlatformUserTotals
            {
                Total = allUserIds.Count,
                Hr = hrStaffIds.Count,
                BranchManagers = branchManagerIds.Count,
                TeamLeaders = teamLeaderIds.Count,
                Employees = employees,
            };
        }

        public async Task<IReadOnlyList<int>> GetAttendanceTrendAsync(int companyId, int days, CancellationToken cancellationToken = default)
        {
            var span = Math.Clamp(days, 1, 92);
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var from = today.AddDays(-(span - 1));

            var rows = await _db.AttendanceRecords
                .Where(r => r.Gym.CompanyId == companyId && r.Date >= from && r.Date <= today)
                .GroupBy(r => r.Date)
                .Select(g => new { Date = g.Key, Count = g.Count() })
                .ToListAsync(cancellationToken);

            var byDate = rows.ToDictionary(r => r.Date, r => r.Count);

            var trend = new List<int>(span);
            for (var i = 0; i < span; i++)
            {
                var date = from.AddDays(i);
                trend.Add(byDate.TryGetValue(date, out var count) ? count : 0);
            }

            return trend;
        }

        // ------------------------------------------------------------------
        // Attention queue
        // ------------------------------------------------------------------

        public async Task<IReadOnlyList<OverdueInvoiceRow>> GetOverdueInvoicesAsync(CancellationToken cancellationToken = default)
        {
            var today = DateTime.UtcNow.Date;

            var rows = await _db.Invoices
                .Where(i => i.Status == InvoiceStatus.Overdue)
                .Select(i => new
                {
                    i.Id,
                    i.InvoiceNumber,
                    i.CompanyId,
                    CompanyName = i.Company.Name,
                    i.Amount,
                    i.DueOn,
                })
                .ToListAsync(cancellationToken);

            return rows.Select(r => new OverdueInvoiceRow
            {
                InvoiceId = r.Id,
                InvoiceNumber = r.InvoiceNumber,
                CompanyId = r.CompanyId,
                CompanyName = r.CompanyName,
                Amount = r.Amount,
                DueOn = r.DueOn,
                DaysOverdue = Math.Max(0, (today - r.DueOn.Date).Days),
            })
            .OrderByDescending(r => r.DaysOverdue)
            .ToList();
        }

        public async Task<IReadOnlyList<TrialEndingRow>> GetTrialsEndingAsync(int withinDays, CancellationToken cancellationToken = default)
        {
            var today = DateTime.UtcNow.Date;
            var limit = today.AddDays(withinDays);

            var rows = await _db.CompanySubscriptions
                .Where(s => s.Status == SubscriptionStatus.Trial
                            && s.TrialEndsOn != null
                            && s.TrialEndsOn <= limit)
                .Select(s => new
                {
                    s.CompanyId,
                    CompanyName = s.Company.Name,
                    PlanName = s.Plan.Name,
                    TrialEndsOn = s.TrialEndsOn!.Value,
                    SeatLimit = s.SeatLimitOverride ?? s.Plan.SeatLimit,
                })
                .ToListAsync(cancellationToken);

            var userCounts = await GetUserCountsByCompanyAsync(cancellationToken);

            return rows.Select(r => new TrialEndingRow
            {
                CompanyId = r.CompanyId,
                CompanyName = r.CompanyName,
                PlanName = r.PlanName,
                TrialEndsOn = r.TrialEndsOn,
                DaysRemaining = Math.Max(0, (r.TrialEndsOn.Date - today).Days),
                Users = userCounts.TryGetValue(r.CompanyId, out var n) ? n : 0,
                SeatLimit = r.SeatLimit,
            })
            .OrderBy(r => r.DaysRemaining)
            .ToList();
        }

        public async Task<IReadOnlyList<SeatPressureRow>> GetSeatPressureAsync(int thresholdPercent, CancellationToken cancellationToken = default)
        {
            var seats = await GetCompanySeatRowsAsync(cancellationToken);
            var names = await GetCompanyNamesAsync(cancellationToken);

            return seats
                .Where(s => s.SeatLimit is > 0)
                .Select(s => new SeatPressureRow
                {
                    CompanyId = s.CompanyId,
                    CompanyName = names.TryGetValue(s.CompanyId, out var name) ? name : string.Empty,
                    Users = s.Users,
                    SeatLimit = s.SeatLimit!.Value,
                    UsagePercent = (int)Math.Round(s.Users * 100.0 / s.SeatLimit!.Value),
                })
                .Where(s => s.UsagePercent >= thresholdPercent)
                .OrderByDescending(s => s.UsagePercent)
                .ToList();
        }

        public async Task<IReadOnlyList<FailedSignInRow>> GetFailedSignInBurstsAsync(int minimumAttempts, int withinMinutes, CancellationToken cancellationToken = default)
        {
            var since = DateTime.UtcNow.AddMinutes(-Math.Clamp(withinMinutes, 1, 1440));

            var attempts = await _db.AuditLogs
                .Where(a => a.Timestamp >= since
                            && a.UserId != null
                            && a.EntityType == "User"
                            && a.Category == "Security")
                .Select(a => new { a.UserId, a.Timestamp, a.IpAddress })
                .ToListAsync(cancellationToken);

            if (attempts.Count == 0)
            {
                return [];
            }

            var grouped = attempts
                .GroupBy(a => a.UserId!.Value)
                .Select(g => new
                {
                    UserId = g.Key,
                    Attempts = g.Count(),
                    LastAttemptAt = g.Max(x => x.Timestamp),
                    IpAddress = g.OrderByDescending(x => x.Timestamp).First().IpAddress,
                })
                .Where(g => g.Attempts >= minimumAttempts)
                .ToList();

            if (grouped.Count == 0)
            {
                return [];
            }

            var userIds = grouped.Select(g => g.UserId).ToList();
            var emails = await _db.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.Email })
                .ToDictionaryAsync(u => u.Id, u => u.Email, cancellationToken);

            return grouped
                .Select(g => new FailedSignInRow
                {
                    UserId = g.UserId,
                    Email = emails.TryGetValue(g.UserId, out var email) ? email : $"#{g.UserId}",
                    Attempts = g.Attempts,
                    LastAttemptAt = g.LastAttemptAt,
                    IpAddress = g.IpAddress,
                })
                .OrderByDescending(g => g.LastAttemptAt)
                .ToList();
        }

        // ------------------------------------------------------------------
        // Lookups
        // ------------------------------------------------------------------

        public async Task<IReadOnlyDictionary<int, string>> GetCompanyNamesAsync(CancellationToken cancellationToken = default)
        {
            var rows = await _db.Companies
                .Select(c => new { c.Id, c.Name })
                .ToListAsync(cancellationToken);

            return rows.ToDictionary(r => r.Id, r => r.Name);
        }

        public async Task<IReadOnlyDictionary<int, IReadOnlyList<int>>> GetUserCompanyMapAsync(CancellationToken cancellationToken = default)
        {
            var allCompanyIds = await _db.Companies.Select(c => c.Id).ToListAsync(cancellationToken);

            var granted = await _db.UserGymAccesses
                .Select(a => new { a.UserId, a.Gym.CompanyId })
                .Distinct()
                .ToListAsync(cancellationToken);

            var employed = await _db.Employees
                .Select(e => new { e.UserId, e.Gym.CompanyId })
                .Distinct()
                .ToListAsync(cancellationToken);

            var byUser = granted
                .Concat(employed)
                .GroupBy(x => x.UserId)
                .ToDictionary(g => g.Key, g => (IReadOnlyList<int>)g.Select(x => x.CompanyId).Distinct().ToList());

            // Platform-wide roles reach every company without an explicit grant.
            var platformUserIds = await _db.Users
                .Where(u => u.UserType == UserType.TopManagement || u.UserType == UserType.HRManager)
                .Select(u => u.Id)
                .ToListAsync(cancellationToken);

            foreach (var userId in platformUserIds)
            {
                byUser[userId] = allCompanyIds;
            }

            return byUser;
        }

        public async Task<IReadOnlyDictionary<int, int>> GetUserPermissionCountsAsync(CancellationToken cancellationToken = default)
        {
            var direct = await _db.UserPermissions
                .Select(up => new { up.UserId, up.PermissionId })
                .Distinct()
                .ToListAsync(cancellationToken);

            var viaRoles = await (
                from ur in _db.UserRoles
                from rp in _db.RolePermissions
                where rp.Role.Name == ur.RoleName
                select new { ur.UserId, rp.PermissionId }
            ).Distinct().ToListAsync(cancellationToken);

            // The effective set is direct ∪ role grants, so the count is the size of that
            // union — not the larger of the two counts, which would double-count overlaps.
            return direct
                .Concat(viaRoles)
                .GroupBy(x => x.UserId)
                .ToDictionary(g => g.Key, g => g.Select(x => x.PermissionId).Distinct().Count());
        }

        public async Task<IReadOnlyDictionary<int, int>> GetRoleMemberCountsAsync(CancellationToken cancellationToken = default)
        {
            var roleIdsByName = await _db.Roles
                .ToDictionaryAsync(r => r.Name, r => r.Id, cancellationToken);

            // Member counts answer "how many people hold this role platform-wide", which is
            // what the Roles page shows next to a role and what guards archiving it.
            var rows = await _db.UserRoles
                .Where(ur => ur.GymId == null)
                .GroupBy(ur => ur.RoleName)
                .Select(g => new { RoleName = g.Key, Count = g.Select(x => x.UserId).Distinct().Count() })
                .ToListAsync(cancellationToken);

            return rows
                .Where(r => roleIdsByName.ContainsKey(r.RoleName))
                .ToDictionary(r => roleIdsByName[r.RoleName], r => r.Count);
        }

        public async Task<IReadOnlyDictionary<int, string>> GetUserRoleLabelsAsync(CancellationToken cancellationToken = default)
        {
            var users = await _db.Users
                .Select(u => new { u.Id, u.UserType })
                .ToListAsync(cancellationToken);

            var roleIdsByName = await _db.Roles
                .ToDictionaryAsync(r => r.Name, r => r.Id, cancellationToken);

            var assigned = await _db.UserRoles
                .Select(ur => new { ur.UserId, ur.RoleName, ur.GymId })
                .ToListAsync(cancellationToken);

            int Rank(string roleName) =>
                roleIdsByName.TryGetValue(roleName, out var id) ? id : int.MaxValue;

            // A per-gym role reads better in an audit row than a platform-wide one, and the
            // lowest role id wins when the user holds several (deterministic, and matches the
            // ordering the old per-gym join table produced).
            var roleByUser = assigned
                .GroupBy(r => r.UserId)
                .ToDictionary(
                    g => g.Key,
                    g => g
                        .OrderBy(r => r.GymId == null ? 1 : 0)
                        .ThenBy(r => Rank(r.RoleName))
                        .First()
                        .RoleName);

            return users.ToDictionary(
                u => u.Id,
                u => roleByUser.TryGetValue(u.Id, out var roleName)
                    ? roleName
                    : u.UserType switch
                    {
                        UserType.TopManagement => RoleNames.SuperAdmin,
                        UserType.HRManager => RoleNames.HrManager,
                        UserType.HR => RoleNames.Hr,
                        _ => RoleNames.Employee,
                    });
        }

        public async Task<IReadOnlyDictionary<int, int>> GetUserRoleIdsInCompanyAsync(int companyId, CancellationToken cancellationToken = default)
        {
            var roleIdsByName = await _db.Roles
                .ToDictionaryAsync(r => r.Name, r => r.Id, cancellationToken);

            var rows = await _db.UserRoles
                .Where(ur => ur.GymId != null && ur.Gym!.CompanyId == companyId)
                .Select(ur => new { ur.UserId, ur.RoleName })
                .Distinct()
                .ToListAsync(cancellationToken);

            // A user may hold different roles in different branches of the same company;
            // the console shows one badge, so the lowest role id wins deterministically.
            return rows
                .Where(r => roleIdsByName.ContainsKey(r.RoleName))
                .GroupBy(r => r.UserId)
                .ToDictionary(g => g.Key, g => g.Min(r => roleIdsByName[r.RoleName]));
        }

        // ------------------------------------------------------------------
        // Billing / revenue
        // ------------------------------------------------------------------

        public async Task<IReadOnlyList<InvoiceSnapshotRow>> GetInvoiceSnapshotAsync(CancellationToken cancellationToken = default)
        {
            var rows = await _db.Invoices
                .Where(i => i.Status != InvoiceStatus.Void)
                .Select(i => new
                {
                    i.Id,
                    i.InvoiceNumber,
                    i.CompanyId,
                    CompanyName = i.Company.Name,
                    CompanyCity = i.Company.City,
                    CompanyContactEmail = i.Company.ContactEmail,
                    PlanId = i.Subscription != null ? (int?)i.Subscription.PlanId : null,
                    PlanName = i.Subscription != null ? i.Subscription.Plan.Name : null,
                    i.Amount,
                    i.AmountPaid,
                    i.Status,
                    i.Currency,
                    i.PeriodLabel,
                    i.PeriodStart,
                    i.PeriodEnd,
                    i.IssuedOn,
                    i.DueOn,
                    i.PaidOn,
                    i.SubscriptionId,
                })
                .ToListAsync(cancellationToken);

            return rows.Select(r => new InvoiceSnapshotRow
            {
                Id = r.Id,
                InvoiceNumber = r.InvoiceNumber,
                CompanyId = r.CompanyId,
                CompanyName = r.CompanyName,
                CompanyCity = r.CompanyCity,
                CompanyContactEmail = r.CompanyContactEmail,
                PlanId = r.PlanId,
                PlanName = r.PlanName,
                Amount = r.Amount,
                AmountPaid = r.AmountPaid,
                Status = r.Status.ToString(),
                Currency = r.Currency,
                PeriodLabel = r.PeriodLabel,
                PeriodStart = r.PeriodStart,
                PeriodEnd = r.PeriodEnd,
                IssuedOn = r.IssuedOn,
                DueOn = r.DueOn,
                PaidOn = r.PaidOn,
                SubscriptionId = r.SubscriptionId,
            }).ToList();
        }

        public async Task<IReadOnlyList<string>> GetInvoicePeriodsAsync(CancellationToken cancellationToken = default)
        {
            var rows = await _db.Invoices
                .Where(i => i.Status != InvoiceStatus.Void)
                .Select(i => new { i.PeriodStart, i.PeriodLabel })
                .ToListAsync(cancellationToken);

            return rows
                .GroupBy(r => new { r.PeriodStart.Year, r.PeriodStart.Month })
                .OrderByDescending(g => g.Key.Year)
                .ThenByDescending(g => g.Key.Month)
                .Select(g => g.First().PeriodLabel)
                .ToList();
        }

        public async Task<IReadOnlyList<PlanFootprintRow>> GetPlanFootprintsAsync(CancellationToken cancellationToken = default)
        {
            var rows = await _db.CompanySubscriptions
                .Where(s => s.Status != SubscriptionStatus.Cancelled && s.Status != SubscriptionStatus.Trial)
                .Select(s => new
                {
                    s.PlanId,
                    Price = s.PriceOverride ?? s.Plan.Price,
                    s.Plan.CycleCount,
                    s.Plan.CycleUnit,
                })
                .ToListAsync(cancellationToken);

            return rows
                .GroupBy(r => r.PlanId)
                .Select(g => new PlanFootprintRow
                {
                    PlanId = g.Key,
                    Companies = g.Count(),
                    Mrr = g.Sum(r => ToMonthly(r.Price, r.CycleCount, r.CycleUnit)),
                })
                .ToList();
        }

        /// <summary>Normalises a price over its cadence to a monthly figure.</summary>
        private static decimal ToMonthly(decimal price, int cycleCount, PlanCycleUnit unit)
        {
            var count = Math.Max(1, cycleCount);
            var months = unit == PlanCycleUnit.Years ? count * 12 : count;
            return Math.Round(price / months, 2);
        }
    }
}
