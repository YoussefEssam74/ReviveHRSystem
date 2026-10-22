using DomainLayer.Contracts;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.PayrollModule.Enums;
using DomainLayer.Models.RecruitmentModule;
using DomainLayer.Models.RecruitmentModule.Enums;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;

namespace Service.Specifications
{
    // =====================================================================
    // Events, separations & escalations (api-spec-from-ui.md §5.6)
    //
    // Two families: DERIVATION specs pull the org-wide pending/expiring sets
    // the queue is computed from (sync-on-read materializes them into Events
    // rows), and BY-IDS / list specs load the payloads behind a page slice.
    // Includes are member-path only (ThenInclude is unavailable here).
    // =====================================================================

    /// <summary>Documents expiring on/before the window — excludes terminated employees.</summary>
    public sealed class ExpiringEmployeeDocumentsSpec : BaseSpecification<EmployeeDocument, int>
    {
        public ExpiringEmployeeDocumentsSpec(DateOnly until)
        {
            Criteria = d => d.ExpiryDate != null && d.ExpiryDate <= until &&
                            d.Employee.Status != EmployeeStatus.Terminated;
            AddInclude(d => d.Employee.Gym);
            OrderBy = d => d.ExpiryDate!;
        }
    }

    /// <summary>Employment contracts expiring on/before the window.</summary>
    public sealed class ExpiringContractsSpec : BaseSpecification<Employee, int>
    {
        public ExpiringContractsSpec(DateOnly until)
        {
            Criteria = e => e.ContractEndDate != null && e.ContractEndDate <= until &&
                            e.Status != EmployeeStatus.Terminated;
            AddInclude(e => e.Gym);
            OrderBy = e => e.ContractEndDate!;
        }
    }

    /// <summary>Requests waiting for the HR half of the two-stage workflow.</summary>
    public sealed class PendingHrReviewRequestsSpec : BaseSpecification<EmployeeRequest, int>
    {
        public PendingHrReviewRequestsSpec()
        {
            Criteria = r => r.Status == RequestStatus.PendingHRReview;
            AddInclude(r => r.Employee.Gym);
            AddInclude(r => r.Decisions);
        }
    }

    /// <summary>Ongoing separations (the Leaving tab) — not yet Completed or Cancelled.</summary>
    public sealed class ActiveSeparationsSpec : BaseSpecification<OffboardingCase, int>
    {
        public ActiveSeparationsSpec()
        {
            Criteria = c => c.Status != "Completed" && c.Status != "Cancelled";
            AddInclude(c => c.Employee.Gym);
            AddInclude(c => c.Employee.Position!);
            AddInclude(c => c.InitiatedByUser);
            AddInclude(c => c.ChecklistItems);
            OrderBy = c => c.LastWorkingDate;
        }
    }

    /// <summary>Pending transfer action requests — also surface on the Events Transfers tab.</summary>
    public sealed class PendingTransferActionRequestsSpec : BaseSpecification<ActionRequest, int>
    {
        public PendingTransferActionRequestsSpec()
        {
            Criteria = a => a.ActionType == "Transfer" && a.Status == "Pending";
            AddInclude(a => a.Gym);
            AddInclude(a => a.Employee);
            AddInclude(a => a.RequestedBy);
        }
    }

    /// <summary>Vacancy requisitions awaiting HR approval.</summary>
    public sealed class PendingVacancyRequestsSpec : BaseSpecification<VacancyRequest, int>
    {
        public PendingVacancyRequestsSpec()
        {
            Criteria = v => v.Status == VacancyRequestStatus.Pending;
            AddInclude(v => v.Gym);
            AddInclude(v => v.Position!);
            AddInclude(v => v.Requester);
            OrderBy = v => v.SubmittedDate;
        }
    }

    /// <summary>Payroll periods not yet approved/locked (the Payroll tab).</summary>
    public sealed class UnlockedPayrollPeriodsSpec : BaseSpecification<PayrollPeriod, int>
    {
        public UnlockedPayrollPeriodsSpec()
        {
            Criteria = p => p.Status != PayrollPeriodStatus.Locked;
            AddInclude(p => p.Gym);
            OrderByDescending = p => p.EndDate;
        }
    }

    // ---------------------------------------------------------------------
    // Payload-by-ids specs (one per page slice)
    // ---------------------------------------------------------------------

    public sealed class EmployeeDocumentsByIdsSpec : BaseSpecification<EmployeeDocument, int>
    {
        public EmployeeDocumentsByIdsSpec(int[] ids)
        {
            var documentIds = ids;
            Criteria = d => documentIds.Contains(d.Id);
            AddInclude(d => d.Employee.Gym);
        }
    }

    public sealed class ContractEmployeesByIdsSpec : BaseSpecification<Employee, int>
    {
        public ContractEmployeesByIdsSpec(int[] ids)
        {
            var employeeIds = ids;
            Criteria = e => employeeIds.Contains(e.Id);
            AddInclude(e => e.Gym);
        }
    }

    public sealed class HrRequestsByIdsSpec : BaseSpecification<EmployeeRequest, int>
    {
        public HrRequestsByIdsSpec(int[] ids)
        {
            var requestIds = ids;
            Criteria = r => requestIds.Contains(r.Id);
            AddInclude(r => r.Employee.Gym);
            AddInclude(r => r.Decisions);
        }
    }

    public sealed class SeparationsByIdsSpec : BaseSpecification<OffboardingCase, int>
    {
        public SeparationsByIdsSpec(int[] ids)
        {
            var caseIds = ids;
            Criteria = c => caseIds.Contains(c.Id);
            AddInclude(c => c.Employee.Gym);
            AddInclude(c => c.Employee.Position!);
            AddInclude(c => c.InitiatedByUser);
            AddInclude(c => c.ChecklistItems);
        }
    }

    public sealed class ActionRequestsByIdsSpec : BaseSpecification<ActionRequest, int>
    {
        public ActionRequestsByIdsSpec(int[] ids)
        {
            var requestIds = ids;
            Criteria = a => requestIds.Contains(a.Id);
            AddInclude(a => a.Gym);
            AddInclude(a => a.Employee.Position!);
            AddInclude(a => a.Employee.Gym);
            AddInclude(a => a.RequestedBy);
            AddInclude(a => a.ReviewedBy);
        }
    }

    public sealed class VacancyRequestsByIdsSpec : BaseSpecification<VacancyRequest, int>
    {
        public VacancyRequestsByIdsSpec(int[] ids)
        {
            var requestIds = ids;
            Criteria = v => requestIds.Contains(v.Id);
            AddInclude(v => v.Gym);
            AddInclude(v => v.Position!);
            AddInclude(v => v.Requester);
        }
    }

    public sealed class PayrollPeriodsByIdsSpec : BaseSpecification<PayrollPeriod, int>
    {
        public PayrollPeriodsByIdsSpec(int[] ids)
        {
            var periodIds = ids;
            Criteria = p => periodIds.Contains(p.Id);
            AddInclude(p => p.Gym);
        }
    }

    // ---------------------------------------------------------------------
    // Event queue rows (sync-on-read storage)
    // ---------------------------------------------------------------------

    /// <summary>Every stored queue row with its resolver + gym for the list pass.</summary>
    public sealed class EventQueueLoadSpec : BaseSpecification<Event, int>
    {
        public EventQueueLoadSpec()
        {
            AddInclude(e => e.Gym);
            AddInclude(e => e.Resolver);
        }
    }

    /// <summary>One queue row for resolve/reopen/renewal/decide.</summary>
    public sealed class EventByIdSpec : BaseSpecification<Event, int>
    {
        public EventByIdSpec(int id)
        {
            Criteria = e => e.Id == id;
            AddInclude(e => e.Gym);
            AddInclude(e => e.Resolver);
        }
    }

    // ---------------------------------------------------------------------
    // Separations list / detail (T1)
    // ---------------------------------------------------------------------

    public sealed class SeparationListSpec : BaseSpecification<OffboardingCase, int>
    {
        public SeparationListSpec(int[]? gymIds, string? status, string? separationType, int skip, int take)
        {
            Criteria = c =>
                (gymIds == null || gymIds.Length == 0 || gymIds.Contains(c.Employee.GymId)) &&
                (status == null || c.Status.ToLower() == status) &&
                (separationType == null || c.SeparationType.ToLower() == separationType);

            AddInclude(c => c.Employee.Gym);
            AddInclude(c => c.Employee.Position!);
            AddInclude(c => c.InitiatedByUser);
            AddInclude(c => c.ChecklistItems);
            OrderByDescending = c => c.InitiatedAt;

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }
    }

    public sealed class SeparationByIdSpec : BaseSpecification<OffboardingCase, int>
    {
        public SeparationByIdSpec(int id)
        {
            Criteria = c => c.Id == id;
            AddInclude(c => c.Employee.Gym);
            AddInclude(c => c.Employee.Position!);
            AddInclude(c => c.InitiatedByUser);
            AddInclude(c => c.ChecklistItems);
        }
    }

    /// <summary>One ongoing separation for an employee (duplicate-exit guard).</summary>
    public sealed class EmployeeActiveSeparationsSpec : BaseSpecification<OffboardingCase, int>
    {
        public EmployeeActiveSeparationsSpec(int employeeId)
        {
            Criteria = c => c.EmployeeId == employeeId && c.Status != "Completed" && c.Status != "Cancelled";
        }
    }

    /// <summary>Current-year leave balances for a page of employees (T1 leaveTaken).</summary>
    public sealed class LeaveBalancesForEmployeesSpec : BaseSpecification<LeaveBalance, int>
    {
        public LeaveBalancesForEmployeesSpec(int[] employeeIds, int year)
        {
            var ids = employeeIds;
            Criteria = lb => ids.Contains(lb.EmployeeId) && lb.Year == year;
        }
    }

    // ---------------------------------------------------------------------
    // Escalated action requests (§9.4)
    // ---------------------------------------------------------------------

    public sealed class ActionRequestListSpec : BaseSpecification<ActionRequest, int>
    {
        public ActionRequestListSpec(int[]? gymIds, string? status, string? actionType, string[]? allowedActionTypes, int skip, int take)
        {
            Criteria = a =>
                (gymIds == null || gymIds.Length == 0 || gymIds.Contains(a.GymId)) &&
                (status == null || a.Status.ToLower() == status) &&
                (actionType == null || a.ActionType.ToLower() == actionType) &&
                (allowedActionTypes == null || allowedActionTypes.Contains(a.ActionType.ToLower()));

            AddInclude(a => a.Gym);
            AddInclude(a => a.Employee.Position!);
            AddInclude(a => a.RequestedBy);
            AddInclude(a => a.ReviewedBy);
            OrderByDescending = a => a.SubmittedDate;

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }
    }

    public sealed class ActionRequestByIdSpec : BaseSpecification<ActionRequest, int>
    {
        public ActionRequestByIdSpec(int id)
        {
            Criteria = a => a.Id == id;
            AddInclude(a => a.Gym);
            AddInclude(a => a.Employee.Position!);
            AddInclude(a => a.RequestedBy);
            AddInclude(a => a.ReviewedBy);
        }
    }
}
