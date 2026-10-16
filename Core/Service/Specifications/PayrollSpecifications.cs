using DomainLayer.Contracts;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.PayrollModule;

namespace Service.Specifications
{
    /// <summary>
    /// Payroll specifications (api-spec-from-ui.md §5.5). Periods are per-gym rows;
    /// gym scoping follows the VacancyListSpec convention (null/empty scope = no filter).
    /// Includes are member-path only — entry sheets pull LineItems (+Employee) through
    /// their own specs because the evaluator cannot chain ThenInclude.
    /// </summary>
    public sealed class PayrollPeriodScopeSpec : BaseSpecification<PayrollPeriod, int>
    {
        public PayrollPeriodScopeSpec(int[]? gymIds, int? gym)
        {
            Criteria = p =>
                (gymIds == null || gymIds.Length == 0 || gymIds.Contains(p.GymId)) &&
                (gym == null || p.GymId == gym);

            AddInclude(p => p.Gym);
            OrderByDescending = p => p.StartDate;
        }
    }

    /// <summary>Entries of one period (detail view) — with employee profile navs for the table columns.</summary>
    public sealed class PayrollEntriesByPeriodSpec : BaseSpecification<PayrollEntry, int>
    {
        public PayrollEntriesByPeriodSpec(int periodId, bool withEmployee)
        {
            Criteria = e => e.PayrollPeriodId == periodId;
            AddInclude(e => e.LineItems);

            if (withEmployee)
            {
                AddInclude(e => e.Employee.Gym);
                AddInclude(e => e.Employee.Position!);
            }
        }
    }

    /// <summary>Entries across several periods (list totals) — LineItems only.</summary>
    public sealed class PayrollEntriesByPeriodsSpec : BaseSpecification<PayrollEntry, int>
    {
        public PayrollEntriesByPeriodsSpec(int[] periodIds)
        {
            var ids = periodIds;
            Criteria = e => ids.Contains(e.PayrollPeriodId);
            AddInclude(e => e.LineItems);
        }
    }

    /// <summary>One entry for its (period, employee) with everything the sheet needs.</summary>
    public sealed class PayrollEntryForEmployeeSpec : BaseSpecification<PayrollEntry, int>
    {
        public PayrollEntryForEmployeeSpec(int periodId, int employeeId)
        {
            Criteria = e => e.PayrollPeriodId == periodId && e.EmployeeId == employeeId;
            AddInclude(e => e.LineItems);
            AddInclude(e => e.Employee.Gym);
            AddInclude(e => e.Employee.Position!);
        }
    }

    /// <summary>An employee's sheets across periods (payroll history).</summary>
    public sealed class PayrollEntriesByEmployeeSpec : BaseSpecification<PayrollEntry, int>
    {
        public PayrollEntriesByEmployeeSpec(int employeeId)
        {
            Criteria = e => e.EmployeeId == employeeId;
            AddInclude(e => e.LineItems);
            AddInclude(e => e.PayrollPeriod.Gym);
            AddInclude(e => e.Employee.Position!);
        }

        public PayrollEntriesByEmployeeSpec(int employeeId, IReadOnlyCollection<int> periodIds)
        {
            Criteria = e => e.EmployeeId == employeeId && periodIds.Contains(e.PayrollPeriodId);
            AddInclude(e => e.PayrollPeriod);
            AddInclude(e => e.LineItems);
        }
    }

    /// <summary>One deduction line with its entry/period/employee for review + list rows.</summary>
    public sealed class DeductionLineByIdSpec : BaseSpecification<PayrollEntryLineItem, int>
    {
        public DeductionLineByIdSpec(int lineId)
        {
            Criteria = l => l.Id == lineId;
            AddInclude(l => l.PayrollEntry.PayrollPeriod.Gym);
            AddInclude(l => l.PayrollEntry.Employee);
        }
    }

    /// <summary>Deduction candidates listing (the pending-lines review queue).</summary>
    public sealed class DeductionLinesSpec : BaseSpecification<PayrollEntryLineItem, int>
    {
        public DeductionLinesSpec(int[]? gymIds, int? gym, int? periodId, string? status, int skip, int take)
        {
            Criteria = l =>
                (gymIds == null || gymIds.Length == 0 || gymIds.Contains(l.PayrollEntry.PayrollPeriod.GymId)) &&
                (gym == null || l.PayrollEntry.PayrollPeriod.GymId == gym) &&
                (periodId == null || l.PayrollEntry.PayrollPeriodId == periodId) &&
                (status == null || l.Status == status);

            AddInclude(l => l.PayrollEntry.PayrollPeriod.Gym);
            AddInclude(l => l.PayrollEntry.Employee);
            OrderByDescending = l => l.EffectiveDate;

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }
    }

    /// <summary>A stored punch record resolved from an "ATT-{id}" reference.</summary>
    public sealed class AttendanceRecordByIdSpec : BaseSpecification<AttendanceRecord, int>
    {
        public AttendanceRecordByIdSpec(int recordId)
        {
            Criteria = r => r.Id == recordId;
        }
    }
}
