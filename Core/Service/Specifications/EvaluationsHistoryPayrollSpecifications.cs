using DomainLayer.Contracts;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.EvaluationModule;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.NotificationModule.Enums;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.PayrollModule.Enums;
using DomainLayer.Models.RequestModule;

namespace Service.Specifications
{
    /// <summary>
    /// Evaluation answers of one employee, each with its question and parent response.
    /// Nested includes are not supported by the spec framework, so the caller groups
    /// the answers by response in memory.
    /// </summary>
    public class EvaluationAnswersByEmployeeSpec : BaseSpecification<EvaluationAnswer, int>
    {
        public EvaluationAnswersByEmployeeSpec(int employeeId)
        {
            Criteria = a => a.EvaluationResponse.EmployeeId == employeeId;
            AddInclude(a => a.EvaluationQuestion);
            AddInclude(a => a.EvaluationResponse);
            AddInclude(a => a.EvaluationResponse.Employee);
        }
    }

    /// <summary>Active evaluation forms available in a gym or globally.</summary>
    public class ActiveEvaluationFormsByGymSpec : BaseSpecification<EvaluationForm, int>
    {
        public ActiveEvaluationFormsByGymSpec(int? gymId)
        {
            Criteria = f => f.IsActive && (f.GymId == null || f.GymId == gymId);
            AddInclude(f => f.Questions);
            OrderBy = f => f.Name;
        }
    }

    /// <summary>Answers of one evaluation response, each with its question.</summary>
    public class EvaluationAnswersByResponseSpec : BaseSpecification<EvaluationAnswer, int>
    {
        public EvaluationAnswersByResponseSpec(int responseId)
        {
            Criteria = a => a.EvaluationResponseId == responseId;
            AddInclude(a => a.EvaluationQuestion);
            AddInclude(a => a.EvaluationResponse);
            AddInclude(a => a.EvaluationResponse.Employee);
            AddInclude(a => a.EvaluationResponse.Evaluator);
        }
    }

    /// <summary>Answers of a set of employees, each with its question and response.</summary>
    public class EvaluationAnswersByEmployeesSpec : BaseSpecification<EvaluationAnswer, int>
    {
        public EvaluationAnswersByEmployeesSpec(IReadOnlyCollection<int> employeeIds)
        {
            Criteria = a => employeeIds.Contains(a.EvaluationResponse.EmployeeId);
            AddInclude(a => a.EvaluationQuestion);
            AddInclude(a => a.EvaluationResponse);
            AddInclude(a => a.EvaluationResponse.Employee);
            AddInclude(a => a.EvaluationResponse.Evaluator);
        }
    }

    /// <summary>One evaluation response with its form and answers (edit path).</summary>
    public class EvaluationResponseByIdSpec : BaseSpecification<EvaluationResponse, int>
    {
        public EvaluationResponseByIdSpec(int responseId)
        {
            Criteria = r => r.Id == responseId;
            AddInclude(r => r.EvaluationForm);
            AddInclude(r => r.Employee);
        }
    }

    /// <summary>Employment history of one employee, newest first.</summary>
    public class EmploymentHistoryByEmployeeSpec : BaseSpecification<EmploymentHistory, int>
    {
        public EmploymentHistoryByEmployeeSpec(int employeeId)
        {
            Criteria = h => h.EmployeeId == employeeId;
            OrderByDescending = h => h.EffectiveDate;
        }
    }

    /// <summary>Open, employee-relevant events of a gym (document/contract deadlines).</summary>
    public class OpenGymEventsSpec : BaseSpecification<Event, int>
    {
        public OpenGymEventsSpec(int gymId)
        {
            Criteria = e => e.GymId == gymId && e.Status == EventStatus.Open
                && (e.Type == EventType.DocumentExpiry || e.Type == EventType.ContractExpiry);
            OrderByDescending = e => e.CreatedAt;
        }
    }

    /// <summary>
    /// Announcements already sent and targeted at the caller's gym, one of his
    /// departments/roles, or him directly (any target the caller matches).
    /// </summary>
    public class SentAnnouncementsSpec : BaseSpecification<Announcement, int>
    {
        public SentAnnouncementsSpec(int? gymId)
        {
            Criteria = a => a.Status == AnnouncementStatus.Sent
                && (gymId == null
                    || !a.Targets.Any()
                    || a.Targets.Any(t => t.GymId == gymId));
            AddInclude(a => a.Targets);
            OrderByDescending = a => a.SentAt;
        }
    }

    /// <summary>Payroll periods of a gym that produced entries (not raw Open).</summary>
    public class PayrollPeriodsByGymSpec : BaseSpecification<PayrollPeriod, int>
    {
        public PayrollPeriodsByGymSpec(int gymId)
        {
            Criteria = p => p.GymId == gymId && p.Status != PayrollPeriodStatus.Open;
            OrderByDescending = p => p.EndDate;
        }
    }

    /// <summary>
    /// Payroll periods of a gym including the still-Open one, for the employee's own
    /// payroll view (mock §8). <see cref="PayrollPeriodsByGymSpec"/> hides Open periods
    /// for reporting; the self view must surface them so the mapping can flag the entry
    /// visible=false ("Processing" / "Payout pending") instead of omitting the month.
    /// </summary>
    public class PayrollPeriodsByGymIncludingOpenSpec : BaseSpecification<PayrollPeriod, int>
    {
        public PayrollPeriodsByGymIncludingOpenSpec(int gymId)
        {
            Criteria = p => p.GymId == gymId;
            OrderByDescending = p => p.EndDate;
        }
    }

    /// <summary>Shift assignments of one employee inside an inclusive date range.</summary>
    public class AssignmentsByEmployeeRangeSpec : BaseSpecification<DomainLayer.Models.SchedulingModule.ShiftAssignment, int>
    {
        public AssignmentsByEmployeeRangeSpec(int employeeId, DateOnly from, DateOnly to)
        {
            Criteria = a => a.EmployeeId == employeeId && a.Date >= from && a.Date <= to;
            AddInclude(a => a.ShiftTemplate);
            OrderBy = a => a.Date;
        }
    }

    /// <summary>Active employees of one team (team scope).</summary>
    public class EmployeesByTeamSpec : BaseSpecification<Employee, int>
    {
        public EmployeesByTeamSpec(int teamId)
        {
            Criteria = e => e.TeamId == teamId && e.Status != EmployeeStatus.Terminated;
            AddInclude(e => e.Position);
            AddInclude(e => e.Gym);
            OrderBy = e => e.FullName;
        }
    }

    /// <summary>Employees of one gym (gym scope).</summary>
    public class EmployeesByGymSpec : BaseSpecification<Employee, int>
    {
        public EmployeesByGymSpec(int gymId)
        {
            Criteria = e => e.GymId == gymId;
            OrderBy = e => e.FullName;
        }
    }

    /// <summary>Attendance records of a set of employees on one date.</summary>
    public class AttendanceByEmployeesDateSpec : BaseSpecification<AttendanceRecord, int>
    {
        public AttendanceByEmployeesDateSpec(IReadOnlyCollection<int> employeeIds, DateOnly date)
        {
            Criteria = r => employeeIds.Contains(r.EmployeeId) && r.Date == date;
        }
    }

    /// <summary>Attendance records of a set of employees over an inclusive date range.</summary>
    public class AttendanceByEmployeesRangeSpec : BaseSpecification<AttendanceRecord, int>
    {
        public AttendanceByEmployeesRangeSpec(IReadOnlyCollection<int> employeeIds, DateOnly from, DateOnly to)
        {
            Criteria = r => employeeIds.Contains(r.EmployeeId) && r.Date >= from && r.Date <= to;
            AddInclude(r => r.ScheduledShiftTemplate!);
            OrderByDescending = r => r.Date;
        }
    }

    /// <summary>Requests of a set of employees (team/gym scope).</summary>
    public class RequestsByEmployeesSpec : BaseSpecification<DomainLayer.Models.RequestModule.EmployeeRequest, int>
    {
        public RequestsByEmployeesSpec(IReadOnlyCollection<int> employeeIds)
        {
            Criteria = r => employeeIds.Contains(r.EmployeeId);
            AddInclude(r => r.Employee);
            AddInclude(r => r.Decisions);
            AddInclude(r => r.SwapWithEmployee);
            OrderByDescending = r => r.SubmittedAt;
        }
    }

    /// <summary>One comment with its author (name lookup for the thread).</summary>
    public class RequestCommentByIdSpec : BaseSpecification<DomainLayer.Models.RequestModule.RequestComment, int>
    {
        public RequestCommentByIdSpec(int commentId)
        {
            Criteria = c => c.Id == commentId;
            AddInclude(c => c.AuthorUser);
        }
    }

    /// <summary>Shift assignments of a set of employees on one date, with their templates.</summary>
    public class AssignmentsByEmployeesDateSpec : BaseSpecification<DomainLayer.Models.SchedulingModule.ShiftAssignment, int>
    {
        public AssignmentsByEmployeesDateSpec(IReadOnlyCollection<int> employeeIds, DateOnly date)
        {
            Criteria = a => employeeIds.Contains(a.EmployeeId) && a.Date == date;
            AddInclude(a => a.ShiftTemplate);
        }
    }

    /// <summary>Shift assignments of a set of employees over an inclusive date range.</summary>
    public class AssignmentsByEmployeesRangeSpec : BaseSpecification<DomainLayer.Models.SchedulingModule.ShiftAssignment, int>
    {
        public AssignmentsByEmployeesRangeSpec(IReadOnlyCollection<int> employeeIds, DateOnly from, DateOnly to)
        {
            Criteria = a => employeeIds.Contains(a.EmployeeId) && a.Date >= from && a.Date <= to;
            AddInclude(a => a.ShiftTemplate);
        }
    }
}
