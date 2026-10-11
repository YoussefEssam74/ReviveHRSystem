using System.Text.Json;
using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EvaluationModule;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.NotificationModule.Enums;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.PayrollModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.Authorization;
using Shared.DataTransferObject.EmployeeProfile;
using DomainLayer.Models.UserModule.Enums;

namespace Service.Services
{
    /// <summary>
    /// Own evaluations (mock Â§9): score = mean of the numeric answers of the response,
    /// criteria = the evaluated form's questions, reviewer = the evaluating user.
    /// </summary>
    public class EvaluationSelfService(
        IUnitOfWork unitOfWork,
        IEmployeeAccessService employeeAccess,
        IMapper mapper) : IEvaluationSelfService
    {
        public async Task<IReadOnlyList<EvaluationDto>> GetEvaluationsAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, employeeId, Features.Employees, AccessLevel.View, activeGymId, cancellationToken);

            var answers = await unitOfWork.GetRepository<EvaluationAnswer, int>()
                .GetAllAsync(new EvaluationAnswersByEmployeeSpec(employeeId), cancellationToken);

            return answers
                .GroupBy(a => a.EvaluationResponse)
                .OrderByDescending(g => g.Key.SubmittedAt)
                .Select(g =>
                {
                    var response = g.Key;
                    var criteria = g
                        .OrderBy(a => a.EvaluationQuestion.SortOrder)
                        .Select(a => mapper.Map<EvaluationCriterionDto>(a))
                        .ToList();

                    var scores = criteria.Select(c => c.Score).Where(s => s > 0).ToList();

                    return new EvaluationDto
                    {
                        Id = response.Id,
                        Period = PeriodLabel(response.SubmittedAt),
                        Score = scores.Count == 0 ? 0 : Math.Round(scores.Average(), 1),
                        MaxScore = 5,
                        Status = "Completed",
                        Date = DateOnly.FromDateTime(response.SubmittedAt),
                        Reviewer = response.Evaluator?.UserName ?? string.Empty,
                        Criteria = criteria,
                        OverallComment = null
                    };
                })
                .ToList();
        }

        private static string PeriodLabel(DateTime submittedAt) =>
            $"Q{(submittedAt.Month - 1) / 3 + 1} {submittedAt.Year}";
    }

    /// <summary>
    /// Employment history (mock Â§5): change timeline grouped by the effective month.
    /// Old/new values are JSON payloads recorded by HR systems; displayed as-is.
    /// </summary>
    public class EmploymentHistoryService(
        IUnitOfWork unitOfWork,
        IEmployeeAccessService employeeAccess,
        IMapper mapper) : IEmploymentHistoryService
    {
        public async Task<IReadOnlyList<EmploymentHistoryMonthDto>> GetHistoryAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, employeeId, Features.Employees, AccessLevel.View, activeGymId, cancellationToken);

            var entries = await unitOfWork.GetRepository<EmploymentHistory, int>()
                .GetAllAsync(new EmploymentHistoryByEmployeeSpec(employeeId), cancellationToken);

            return entries
                .GroupBy(e => new { e.EffectiveDate.Year, e.EffectiveDate.Month })
                .OrderByDescending(g => g.Key.Year).ThenByDescending(g => g.Key.Month)
                .Select(g => new EmploymentHistoryMonthDto
                {
                    Month = new DateTime(g.Key.Year, g.Key.Month, 1).ToString("MMMM yyyy"),
                    Events = g.OrderByDescending(e => e.EffectiveDate)
                        .Select(e => mapper.Map<EmploymentHistoryEventDto>(e))
                        .ToList()
                })
                .ToList();
        }
    }

    /// <summary>
    /// Employee-facing feed (mock Â§4): open, employee-relevant Events of the active gym
    /// (document/contract expiry deadlines) plus sent announcements targeted at the gym
    /// or globally. Urgency mirrors the Event status (Open = needs action).
    /// </summary>
    public class EmployeeEventService(
        IUnitOfWork unitOfWork,
        IMapper mapper) : IEmployeeEventService
    {
        public async Task<IReadOnlyList<EmployeeEventDto>> GetEventsAsync(
            int userId, int? activeGymId, int? employeeId, CancellationToken cancellationToken = default)
        {
            var events = new List<EmployeeEventDto>();

            if (activeGymId.HasValue)
            {
                var gymEvents = await unitOfWork.GetRepository<Event, int>()
                    .GetAllAsync(new OpenGymEventsSpec(activeGymId.Value), cancellationToken);

                events.AddRange(gymEvents.Select(e => mapper.Map<EmployeeEventDto>(e)));
            }

            var announcements = await unitOfWork.GetRepository<Announcement, int>()
                .GetAllAsync(new SentAnnouncementsSpec(activeGymId), cancellationToken);

            events.AddRange(announcements.Select(a => mapper.Map<EmployeeEventDto>(a)));

            return events.OrderByDescending(e => e.Date).ToList();
        }
    }

    /// <summary>
    /// Own payroll (mock Â§8): periods of the employee's gym with the employee's entry.
    /// Entries of still-open periods are visible=false (not yet paid); bonuses and
    /// deductions are line items. Payslip PDF streaming is deferred to file storage.
    /// </summary>
    public class PayrollSelfService(
        IUnitOfWork unitOfWork,
        IEmployeeAccessService employeeAccess,
        IMapper mapper) : IPayrollSelfService
    {
        public async Task<IReadOnlyList<PayrollEntryDto>> GetPayrollAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, employeeId, Features.Employees, AccessLevel.View, activeGymId, cancellationToken);

            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            var periods = await unitOfWork.GetRepository<PayrollPeriod, int>()
                .GetAllAsync(new PayrollPeriodsByGymSpec(employee.GymId), cancellationToken);

            var periodIds = periods.Select(p => p.Id).ToList();
            var entries = await unitOfWork.GetRepository<PayrollEntry, int>()
                .GetAllAsync(new PayrollEntriesByEmployeeSpec(employeeId, periodIds), cancellationToken);

            return entries
                .OrderByDescending(e => e.PayrollPeriod.EndDate)
                .Select(e => mapper.Map<PayrollEntryDto>(e))
                .ToList();
        }
    }
}
