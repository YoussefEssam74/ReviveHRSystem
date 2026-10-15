using System;
using System.Collections.Generic;
using System.Linq.Expressions;
using DomainLayer.Contracts;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;

namespace Service.Specifications
{
    // ------------------------------------------------------------------
    // Requests module (S3) specifications: the paged HR inbox with its
    // status/type/gym/date/quick filters, a by-id loader, and the
    // employee-file requests list.
    // ------------------------------------------------------------------

    /// <summary>
    /// Paged requests inbox (R1) with the UI's filter vocabulary:
    /// <list type="bullet">
    /// <item><c>status</c> — a single <see cref="RequestStatus"/>; <c>decidedOnly</c> widens
    /// it to Approved-or-Rejected (the "Decided" tab).</item>
    /// <item><c>type</c> — exact request type ("Day Off", "Sick Leave", ...).</item>
    /// <item><c>date</c> (A2) — the request's effective span (end falling back to the
    /// submitted date) covers that calendar day.</item>
    /// <item><c>quick</c> — KPI tile filters: "urgent" (same-day types still in HR review),
    /// "approved", "bmRejected" (branch-manager rejection awaiting review), "balance"
    /// (pending Day Off/Sick Leave whose matching balance for the current year is
    /// exhausted, mirroring the UI's left-while-leaving-0 check).</item>
    /// </list>
    /// <c>gymIds</c> null means unrestricted (TopManagement); an empty array matches
    /// nothing (a user with no gym assignments).
    /// </summary>
    public sealed class RequestDirectorySpec : BaseSpecification<EmployeeRequest, int>
    {
        public RequestDirectorySpec(
            int[]? gymIds,
            RequestStatus? status,
            bool decidedOnly,
            string? type,
            DateOnly? date,
            string? quick,
            int skip,
            int take,
            string sortBy,
            bool desc,
            int[]? ids = null)
        {
            Expression<Func<EmployeeRequest, bool>> predicate = _ => true;

            if (gymIds is not null)
            {
                var gyms = gymIds;
                predicate = And(predicate, r => gyms.Contains(r.Employee.GymId));
            }

            if (decidedOnly)
            {
                predicate = And(predicate, r =>
                    r.Status == RequestStatus.Approved || r.Status == RequestStatus.Rejected);
            }
            else if (status.HasValue)
            {
                var wanted = status.Value;
                predicate = And(predicate, r => r.Status == wanted);
            }

            if (!string.IsNullOrWhiteSpace(type))
            {
                var wantedType = type.Trim();
                predicate = And(predicate, r => r.Type == wantedType);
            }

            if (ids is { Length: > 0 })
            {
                var wantedIds = ids;
                predicate = And(predicate, r => wantedIds.Contains(r.Id));
            }

            if (date.HasValue)
            {
                var day = date.Value;
                predicate = And(predicate, r =>
                    (r.TargetStartDate ?? r.RequestDate) <= day &&
                    (r.TargetEndDate ?? r.RequestDate) >= day);
            }

            switch (quick?.Trim().ToLowerInvariant())
            {
                case "urgent":
                    predicate = And(predicate, r =>
                        r.Status == RequestStatus.PendingHRReview &&
                        (r.Type == "Late Arrival" || r.Type == "Leave Early" || r.Type == "Sick Leave"));
                    break;
                case "approved":
                    predicate = And(predicate, r => r.Status == RequestStatus.Approved);
                    break;
                case "bmrejected":
                    predicate = And(predicate, r =>
                        r.Decisions.Any(d =>
                            d.Stage == ApprovalStage.BranchManager &&
                            d.Decision == DecisionOutcome.Rejected));
                    break;
                case "balance":
                    var year = DateTime.UtcNow.Year;
                    predicate = And(predicate, r =>
                        r.Status == RequestStatus.PendingHRReview &&
                        (r.Type == "Day Off" || r.Type == "Sick Leave") &&
                        r.Employee.LeaveBalances.Any(lb =>
                            lb.Year == year &&
                            ((r.Type == "Day Off" && lb.LeaveType == LeaveType.Annual) ||
                             (r.Type == "Sick Leave" && lb.LeaveType == LeaveType.Sick)) &&
                            lb.TotalEntitlement - lb.UsedDays - lb.PendingDays <= 0));
                    break;
            }

            Criteria = predicate;

            // Inbox-first ordering: newest submission by default; the UI's table
            // columns sort by requested date, employee name, or status instead.
            switch (sortBy?.Trim().ToLowerInvariant())
            {
                case "requested":
                case "requesteddate":
                    if (desc) OrderByDescending = r => r.RequestDate;
                    else OrderBy = r => r.RequestDate;
                    break;
                case "employee":
                case "employeename":
                    if (desc) OrderByDescending = r => r.Employee.FullName;
                    else OrderBy = r => r.Employee.FullName;
                    break;
                case "status":
                    if (desc) OrderByDescending = r => r.Status;
                    else OrderBy = r => r.Status;
                    break;
                default: // "submitted" — the default "Submitted" column (newest first)
                    if (desc) OrderByDescending = r => r.CreatedAt;
                    else OrderBy = r => r.CreatedAt;
                    break;
            }

            AddInclude(r => r.Employee);
            AddInclude(r => r.Employee.Gym);
            AddInclude(r => r.Decisions);

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }

        /// <summary>ANDs two predicates over the same parameter without Invoke nodes.</summary>
        private static Expression<Func<T, bool>> And<T>(Expression<Func<T, bool>> left, Expression<Func<T, bool>> right)
        {
            var parameter = left.Parameters[0];
            var rightBody = new ParameterRewriter(right.Parameters[0], parameter).Visit(right.Body)!;
            return Expression.Lambda<Func<T, bool>>(Expression.AndAlso(left.Body, rightBody), parameter);
        }

        private sealed class ParameterRewriter(ParameterExpression from, ParameterExpression to) : ExpressionVisitor
        {
            protected override Expression VisitParameter(ParameterExpression node) =>
                node == from ? to : base.VisitParameter(node);
        }
    }

    /// <summary>One request with its employee, gym, and decision trail (R2 and every id-routed action).</summary>
    public sealed class RequestByIdSpec : BaseSpecification<EmployeeRequest, int>
    {
        public RequestByIdSpec(int id)
        {
            Criteria = r => r.Id == id;
            AddInclude(r => r.Employee);
            AddInclude(r => r.Employee.Gym);
            AddInclude(r => r.Decisions);
        }
    }

    /// <summary>Employee file → Requests tab (A8): the employee's own requests, newest first.</summary>
    public sealed class EmployeeRequestsSpec : BaseSpecification<EmployeeRequest, int>
    {
        public EmployeeRequestsSpec(int employeeId)
        {
            Criteria = r => r.EmployeeId == employeeId;
            AddInclude(r => r.Decisions);
            OrderByDescending = r => r.CreatedAt;
        }
    }

    /// <summary>
    /// Explicit-id bulk selection (R5): the listed requests, optionally narrowed to a
    /// gym scope so an out-of-scope id is simply not found.
    /// </summary>
    public sealed class RequestByIdsSpec : BaseSpecification<EmployeeRequest, int>
    {
        public RequestByIdsSpec(IReadOnlyCollection<int> ids, int[]? gymIds)
        {
            Expression<Func<EmployeeRequest, bool>> predicate = r => ids.Contains(r.Id);

            if (gymIds is not null)
            {
                var scopedGyms = gymIds;
                predicate = And(predicate, r => scopedGyms.Contains(r.Employee.GymId));
            }

            Criteria = predicate;
            AddInclude(r => r.Employee);
            AddInclude(r => r.Employee.Gym);
            AddInclude(r => r.Decisions);
        }

        private static Expression<Func<T, bool>> And<T>(Expression<Func<T, bool>> left, Expression<Func<T, bool>> right)
        {
            var parameter = left.Parameters[0];
            var rightBody = new ParameterRewriter(right.Parameters[0], parameter).Visit(right.Body)!;
            return Expression.Lambda<Func<T, bool>>(Expression.AndAlso(left.Body, rightBody), parameter);
        }

        private sealed class ParameterRewriter(ParameterExpression from, ParameterExpression to) : ExpressionVisitor
        {
            protected override Expression VisitParameter(ParameterExpression node) =>
                node == from ? to : base.VisitParameter(node);
        }
    }

    /// <summary>
    /// Employees whose full name matches (case-insensitive) within a gym scope —
    /// the on-behalf request form resolves its subject by name (R7).
    /// </summary>
    public sealed class EmployeeByFullNameSpec : BaseSpecification<Employee, int>
    {
        public EmployeeByFullNameSpec(string fullName, int[]? gymIds)
        {
            var term = fullName.Trim().ToLower();
            Expression<Func<Employee, bool>> predicate = e => e.FullName.ToLower() == term;

            if (gymIds is not null)
            {
                var ids = gymIds;
                predicate = And(predicate, e => ids.Contains(e.GymId));
            }

            Criteria = predicate;
            AddInclude(e => e.Gym);
        }

        private static Expression<Func<T, bool>> And<T>(Expression<Func<T, bool>> left, Expression<Func<T, bool>> right)
        {
            var parameter = left.Parameters[0];
            var rightBody = new ParameterRewriter(right.Parameters[0], parameter).Visit(right.Body)!;
            return Expression.Lambda<Func<T, bool>>(Expression.AndAlso(left.Body, rightBody), parameter);
        }

        private sealed class ParameterRewriter(ParameterExpression from, ParameterExpression to) : ExpressionVisitor
        {
            protected override Expression VisitParameter(ParameterExpression node) =>
                node == from ? to : base.VisitParameter(node);
        }
    }
}
