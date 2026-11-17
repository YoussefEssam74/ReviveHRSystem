using System.Linq.Expressions;
using DomainLayer.Contracts;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.OrganizationModule;

namespace Service.Specifications
{
    /// <summary>Finds the employee profile that belongs to a user account (1:1).</summary>
    public class EmployeeByUserIdSpec : BaseSpecification<Employee, int>
    {
        public EmployeeByUserIdSpec(int userId)
        {
            Criteria = e => e.UserId == userId;
            // Self-service profile/contact updates and document uploads mutate the
            // fetched employee before SaveChanges — keep tracked.
            ApplyTracking();
        }
    }

    /// <summary>
    /// One employee by id with the navigations every consumer needs: gym, position,
    /// login account (with its gym access rows) and the compensation history.
    /// Consumers that only need the gym ignore the rest.
    /// </summary>
    public class EmployeeByIdSpec : BaseSpecification<Employee, int>
    {
        public EmployeeByIdSpec(int employeeId)
        {
            Criteria = e => e.Id == employeeId;
            AddInclude(e => e.Position!);
            AddInclude(e => e.Gym!);
            AddInclude(e => e.User!);
            AddInclude(e => e.User!.UserGymAccesses);
            AddInclude(e => e.Compensations);
            // HR write flows (status/transfer/position/contract) mutate the fetched
            // employee and ride its navs into Update() — keep tracked so the graph
            // merges with the identity map instead of re-attaching detached rows.
            ApplyTracking();
        }
    }

    /// <summary>
    /// Profile-shaped load of one employee: gym, position, login account and the
    /// compensation history (current salary = latest effective record).
    /// </summary>
    public class EmployeeProfileByIdSpec : BaseSpecification<Employee, int>
    {
        public EmployeeProfileByIdSpec(int employeeId)
        {
            Criteria = e => e.Id == employeeId;
            AddInclude(e => e.Gym);
            AddInclude(e => e.Position);
            AddInclude(e => e.User);
            AddInclude(e => e.Compensations);
            // Profile / HR update flows mutate the fetched employee (contact info,
            // status, notice-period flips) before SaveChanges without Update() —
            // keeps those flows tracked.
            ApplyTracking();
        }
    }

    /// <summary>
    /// A fixed set of employees for the absence/late deduction sweep: the salary
    /// history prices the deduction, the status decides whether the day is exempt
    /// (On Leave / Suspended), and UserId carries the notification.
    /// </summary>
    public class EmployeesForDeductionSweepSpec : BaseSpecification<Employee, int>
    {
        public EmployeesForDeductionSweepSpec(int[] ids)
        {
            Criteria = e => ids.Contains(e.Id);
            AddInclude(e => e.Compensations);
        }
    }

    /// <summary>
    /// The employee directory query: optional gym scope (the caller's assigned gyms,
    /// or a single requested gym), optional name search and status filter, sorting,
    /// and paging. Includes the display dependencies (position, gym, compensations).
    /// A take of 0 means "no paging" — used for the companion count query.
    /// </summary>
    public sealed class EmployeeDirectorySpec : BaseSpecification<Employee, int>
    {
        public EmployeeDirectorySpec(
            int[]? gymIds,
            int? teamId,
            string? search,
            EmployeeStatus? status,
            int skip,
            int take,
            string sortBy,
            bool sortDescending,
            int? excludeEmployeeId = null)
        {
            Expression<Func<Employee, bool>> predicate = _ => true;
            if (gymIds is not null)
            {
                var scopedGyms = gymIds;
                predicate = And(predicate, e => scopedGyms.Contains(e.GymId));
            }

            if (teamId.HasValue)
            {
                var scopedTeam = teamId.Value;
                predicate = And(predicate, e => e.TeamId == scopedTeam);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                predicate = And(predicate, e => e.FullName.ToLower().Contains(term));
            }

            if (status.HasValue)
            {
                var standing = status.Value;
                predicate = And(predicate, e => e.Status == standing);
            }

            // A manager must never see or act on their own employee row in the
            // directory; exclude the actor's employee record when provided.
            if (excludeEmployeeId.HasValue)
            {
                var excludedId = excludeEmployeeId.Value;
                predicate = And(predicate, e => e.Id != excludedId);
            }

            Criteria = predicate;

            switch (sortBy)
            {
                case "hiredate":
                    OrderBy = e => e.HireDate;
                    break;
                case "status":
                    OrderBy = e => e.Status;
                    break;
                default:
                    OrderBy = e => e.FullName;
                    break;
            }

            if (sortDescending)
            {
                (OrderBy, OrderByDescending) = (null, OrderBy);
            }

            AddInclude(e => e.Position!);
            AddInclude(e => e.Gym!);
            AddInclude(e => e.Compensations);

            if (take > 0)
            {
                ApplyPaging(Math.Max(skip, 0), take);
            }
        }

        public EmployeeDirectorySpec(
            int[]? gymIds,
            string? search,
            EmployeeStatus? status,
            int skip,
            int take,
            string sortBy,
            bool sortDescending,
            int? excludeEmployeeId = null)
            : this(gymIds, null, search, status, skip, take, sortBy, sortDescending, excludeEmployeeId)
        {
        }

        /// <summary>ANDs two predicates over the same parameter without Invoke nodes.</summary>
        private static Expression<Func<Employee, bool>> And(
            Expression<Func<Employee, bool>> left,
            Expression<Func<Employee, bool>> right)
        {
            var parameter = left.Parameters[0];
            var rightBody = new ParameterRewriter(right.Parameters[0], parameter).Visit(right.Body)!;
            return Expression.Lambda<Func<Employee, bool>>(Expression.AndAlso(left.Body, rightBody), parameter);
        }

        private sealed class ParameterRewriter(ParameterExpression from, ParameterExpression to) : ExpressionVisitor
        {
            protected override Expression VisitParameter(ParameterExpression node) =>
                node == from ? to : base.VisitParameter(node);
        }
    }

    /// <summary>Dashboard-shaped load of the actor's own employee: gym + position.</summary>
    public class EmployeeSummaryByUserIdSpec : BaseSpecification<Employee, int>
    {
        public EmployeeSummaryByUserIdSpec(int userId)
        {
            Criteria = e => e.UserId == userId;
            AddInclude(e => e.Gym);
            AddInclude(e => e.Position);
        }
    }

    /// <summary>
    /// All documents of one employee, newest first. Supplying a source
    /// narrows the list to that owner's uploads (the employee vault vs the official
    /// company documents HR published).
    /// </summary>
    public class DocumentsByEmployeeSpec : BaseSpecification<EmployeeDocument, int>
    {
        public DocumentsByEmployeeSpec(int employeeId)
            : this(employeeId, null)
        {
        }

        public DocumentsByEmployeeSpec(int employeeId, DocumentSource? source)
        {
            Criteria = d => d.EmployeeId == employeeId && (source == null || d.Source == source);
            OrderByDescending = d => d.UploadedAt;
        }
    }

    /// <summary>One document by id, for the download path (owner and scope checked in the service).</summary>
    public class DocumentByIdSpec : BaseSpecification<EmployeeDocument, int>
    {
        public DocumentByIdSpec(int documentId)
        {
            Criteria = d => d.Id == documentId;
        }
    }

    /// <summary>Leave balances of one employee for a given year.</summary>
    public class LeaveBalancesByEmployeeSpec : BaseSpecification<DomainLayer.Models.EmployeeModule.LeaveBalance, int>
    {
        public LeaveBalancesByEmployeeSpec(int employeeId, int year)
        {
            Criteria = lb => lb.EmployeeId == employeeId && lb.Year == year;
            // Reservation bookkeeping (submit/cancel/decide) mutates these rows; tracking
            // keeps one instance per key, so a graph already loaded through the request
            // (employee → leave balances) is reused instead of attached twice.
            ApplyTracking();
        }
    }

    /// <summary>
    /// All employees ordered by Id descending for sequence numbering: the high-water
    /// mark must span every stored number, including seeded or imported rows that can
    /// sit below the newest Ids.
    /// </summary>
    public class LatestEmployeesSpec : BaseSpecification<Employee, int>
    {
        public LatestEmployeesSpec()
        {
            OrderByDescending = e => e.Id;
        }
    }

    /// <summary>A gym's position catalog (titles and levels for resolve-or-create).</summary>
    public sealed class GymPositionsSpec : BaseSpecification<Position, int>
    {
        public GymPositionsSpec(int gymId)
        {
            Criteria = p => p.GymId == gymId;
        }
    }

    /// <summary>The employee's most recent compensation record, if any.</summary>
    public sealed class LatestCompensationSpec : BaseSpecification<Compensation, int>
    {
        public LatestCompensationSpec(int employeeId)
        {
            Criteria = c => c.EmployeeId == employeeId;
            OrderByDescending = c => c.EffectiveDate;
            ApplyPaging(0, 1);
        }
    }

    /// <summary>An employee's leave balances for a calendar year.</summary>
    public sealed class LeaveBalancesForYearSpec : BaseSpecification<LeaveBalance, int>
    {
        public LeaveBalancesForYearSpec(int employeeId, int year)
        {
            Criteria = b => b.EmployeeId == employeeId && b.Year == year;
            // Approve/undo/cancel and entitlement updates mutate the fetched balances
            // before SaveChanges without Update() — keep tracked.
            ApplyTracking();
        }
    }

    /// <summary>An employee's employment history, most recent change first.</summary>
    public sealed class HistoryByEmployeeSpec : BaseSpecification<EmploymentHistory, int>
    {
        public HistoryByEmployeeSpec(int employeeId)
        {
            Criteria = h => h.EmployeeId == employeeId;
            OrderByDescending = h => h.EffectiveDate;
        }
    }

    /// <summary>A single gym by id, for existence/status validation.</summary>
    public sealed class GymByIdSpec : BaseSpecification<Gym, int>
    {
        public GymByIdSpec(int id)
        {
            Criteria = g => g.Id == id;
        }
    }
}
