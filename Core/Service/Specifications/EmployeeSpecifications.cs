using DomainLayer.Contracts;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.OrganizationModule;
using System.Linq.Expressions;

namespace Service.Specifications
{
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
            string? search,
            EmployeeStatus? status,
            int skip,
            int take,
            string sortBy,
            bool sortDescending)
        {
            Expression<Func<Employee, bool>> predicate = _ => true;
            if (gymIds is not null)
            {
                var scopedGyms = gymIds;
                predicate = And(predicate, e => scopedGyms.Contains(e.GymId));
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

    /// <summary>One employee with the navigations the profile endpoints need.</summary>
    public sealed class EmployeeByIdSpec : BaseSpecification<Employee, int>
    {
        public EmployeeByIdSpec(int id)
        {
            Criteria = e => e.Id == id;
            AddInclude(e => e.Position!);
            AddInclude(e => e.Gym!);
            AddInclude(e => e.User!);
            AddInclude(e => e.User!.UserGymAccesses);
            AddInclude(e => e.Compensations);
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
        }
    }

    /// <summary>An employee's uploaded documents, newest first.</summary>
    public sealed class DocumentsByEmployeeSpec : BaseSpecification<EmployeeDocument, int>
    {
        public DocumentsByEmployeeSpec(int employeeId)
        {
            Criteria = d => d.EmployeeId == employeeId;
            OrderByDescending = d => d.Id;
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
