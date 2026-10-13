using System.Text.Json;
using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EvaluationModule;
using DomainLayer.Models.EvaluationModule.Enums;
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
    /// Evaluation authoring (mock 14.6/14.7/18.1). Forms are gym-scoped or global;
    /// the employee must be in the caller's scope, which the API resolves per
    /// ADR-003 Amendment 1 (team for leaders, gym for Branch Managers). Score is the
    /// mean of the numeric answers, mirroring the read side.
    /// </summary>
    public class EvaluationManagementService(
        IUnitOfWork unitOfWork,
        IEmployeeAccessService employeeAccess) : IEvaluationManagementService
    {
        public async Task<IReadOnlyList<EvaluationFormDto>> GetFormsAsync(
            int actorUserId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            var gymId = activeGymId ?? throw new UnAuthorizedException("This operation requires an active gym context.");

            var forms = await unitOfWork.GetRepository<EvaluationForm, int>()
                .GetAllAsync(new ActiveEvaluationFormsByGymSpec(gymId), cancellationToken);

            return forms.Select(f => new EvaluationFormDto
            {
                Id = f.Id,
                Name = f.Name,
                Questions = f.Questions
                    .OrderBy(q => q.SortOrder)
                    .Select(q => new EvaluationQuestionDto
                    {
                        Id = q.Id,
                        Text = q.QuestionText,
                        Type = q.QuestionType.ToString()
                    })
                    .ToList()
            }).ToList();
        }

        public async Task<EvaluationDto> CreateAsync(
            int actorUserId, int employeeId, int? activeGymId, CreateEvaluationResponseDto request,
            CancellationToken cancellationToken = default)
        {
            var gymId = activeGymId ?? throw new UnAuthorizedException("This operation requires an active gym context.");

            // Same scope guard the self-service reads use, at Edit level.
            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, employeeId, Features.Evaluations, AccessLevel.Edit, gymId, cancellationToken);

            var form = await unitOfWork.GetRepository<EvaluationForm, int>()
                .GetByIdAsync(new EvaluationFormByIdSpec(request.EvaluationFormId), cancellationToken)
                ?? throw new NotFoundException("Evaluation form not found.");

            if (!form.IsActive || (form.GymId is not null && form.GymId != gymId))
            {
                throw new BadRequestException("The selected evaluation form is not available in this gym.");
            }

            if (request.Answers is null)
            {
                throw new BadRequestException("At least one answer is required.");
            }

            if (request.Answers.Count == 0)
            {
                throw new BadRequestException("At least one answer is required.");
            }

            var questionIds = form.Questions.Select(q => q.Id).ToHashSet();
            if (request.Answers.Any(a => !questionIds.Contains(a.QuestionId)))
            {
                throw new BadRequestException("Every answer must belong to the selected form.");
            }

            if (request.Answers.Count != questionIds.Count
                || request.Answers.Select(a => a.QuestionId).Distinct().Count() != request.Answers.Count)
            {
                throw new BadRequestException("Exactly one answer is required per form question.");
            }

            var response = new EvaluationResponse
            {
                EvaluationFormId = form.Id,
                EmployeeId = employeeId,
                EvaluatedBy = actorUserId,
                SubmittedAt = DateTime.UtcNow,
                OverallComment = OptionalComment(request.OverallComment)
            };

            var questionById = form.Questions.ToDictionary(q => q.Id);
            foreach (var answer in request.Answers)
            {
                response.Answers.Add(new EvaluationAnswer
                {
                    EvaluationQuestionId = answer.QuestionId,
                    AnswerValueJson = BuildAnswerValue(questionById[answer.QuestionId], answer)
                });
            }

            await unitOfWork.GetRepository<EvaluationResponse, int>().AddAsync(response, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return await MapAsync(response.Id, cancellationToken);
        }

        public async Task<EvaluationDto> UpdateAsync(
            int actorUserId, int employeeId, int evaluationId, int? activeGymId, UpdateEvaluationDto request, CancellationToken cancellationToken = default)
        {
            var gymId = activeGymId ?? throw new UnAuthorizedException("This operation requires an active gym context.");

            var existing = await unitOfWork.GetRepository<EvaluationResponse, int>()
                .GetByIdAsync(new EvaluationResponseByIdSpec(evaluationId), cancellationToken)
                ?? throw new NotFoundException("Evaluation not found.");

            // The token's active gym governs the whole operation: an evaluation whose
            // employee belongs to another gym is invisible while this session is scoped
            // here, even if the caller holds the permission in that other gym.
            if (existing.Employee is null || existing.Employee.GymId != gymId)
            {
                throw new NotFoundException("Evaluation not found.");
            }

            // The route's employee must be the evaluation's own employee, so one
            // employee's evaluation can never be addressed through another's URL.
            if (existing.Employee.Id != employeeId)
            {
                throw new NotFoundException("Evaluation not found.");
            }

            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, existing.Employee.Id, Features.Evaluations, AccessLevel.Edit, gymId, cancellationToken);

            if (request.Answers.Count == 0)
            {
                throw new BadRequestException("At least one answer is required.");
            }

            if (request.Answers.Select(a => a.QuestionId).Distinct().Count() != request.Answers.Count)
            {
                throw new BadRequestException("Each question may only have one answer.");
            }

            var answers = await unitOfWork.GetRepository<EvaluationAnswer, int>()
                .GetAllAsync(new EvaluationAnswersByResponseSpec(evaluationId), cancellationToken);

            var byQuestion = answers.ToLookup(a => a.EvaluationQuestionId);
            foreach (var answer in request.Answers)
            {
                var target = byQuestion[answer.QuestionId].FirstOrDefault();
                if (target is null)
                {
                    throw new BadRequestException("Every answer must belong to the evaluation's form.");
                }

                target.AnswerValueJson = BuildAnswerValue(target.EvaluationQuestion, answer);
                unitOfWork.GetRepository<EvaluationAnswer, int>().Update(target);
            }

            existing.OverallComment = OptionalComment(request.OverallComment);
            unitOfWork.GetRepository<EvaluationResponse, int>().Update(existing);

            await unitOfWork.SaveChangesAsync(cancellationToken);

            return await MapAsync(evaluationId, cancellationToken);
        }

        public async Task<IReadOnlyList<EvaluationDto>> GetTeamEvaluationsAsync(
            int actorUserId, int? activeGymId, int? teamId, CancellationToken cancellationToken = default)
        {
            var gymId = activeGymId ?? throw new UnAuthorizedException("This operation requires an active gym context.");

            var team = await unitOfWork.GetRepository<DomainLayer.Models.OrganizationModule.Team, int>()
                .GetByIdAsync(new TeamWithMembersSpec(teamId ?? 0), cancellationToken)
                ?? throw new NotFoundException("Team not found.");

            if (team.GymId != gymId)
            {
                throw new NotFoundException("Team not found.");
            }

            var myTeams = await MyTeamsAsync(actorUserId, gymId, cancellationToken);
            if (!myTeams.Any(t => t.Id == team.Id))
            {
                throw new NotFoundException("Team not found.");
            }

            var memberIds = team.Members.Select(m => m.Id).ToList();
            if (memberIds.Count == 0)
            {
                return Array.Empty<EvaluationDto>();
            }

            var answers = await unitOfWork.GetRepository<EvaluationAnswer, int>()
                .GetAllAsync(new EvaluationAnswersByEmployeesSpec(memberIds), cancellationToken);

            return GroupIntoDtos(answers);
        }

        // ---------- helpers ----------

        private async Task<List<DomainLayer.Models.OrganizationModule.Team>> MyTeamsAsync(
            int actorUserId, int gymId, CancellationToken cancellationToken)
        {
            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByUserIdSpec(actorUserId), cancellationToken)
                ?? throw new UnAuthorizedException("This account has no employee profile.");

            var teams = await unitOfWork.GetRepository<DomainLayer.Models.OrganizationModule.Team, int>()
                .GetAllAsync(new TeamsByMemberOrLeaderSpec(employee.Id, gymId), cancellationToken);

            return teams.ToList();
        }

        private async Task<EvaluationDto> MapAsync(int responseId, CancellationToken cancellationToken)
        {
            var answers = await unitOfWork.GetRepository<EvaluationAnswer, int>()
                .GetAllAsync(new EvaluationAnswersByResponseSpec(responseId), cancellationToken);

            return GroupIntoDtos(answers).FirstOrDefault()
                ?? throw new NotFoundException("Evaluation not found.");
        }

        /// <summary>
        /// Groups answers by their parent response and scores them the same way the
        /// self-service read does (mean of the numeric answers), so the write and read
        /// paths never disagree about a score.
        /// </summary>
        private IReadOnlyList<EvaluationDto> GroupIntoDtos(IEnumerable<EvaluationAnswer> answers) =>
            answers
                .GroupBy(a => a.EvaluationResponse)
                .OrderByDescending(g => g.Key.SubmittedAt)
                .Select(g =>
                {
                    var response = g.Key;
                    var criteria = g
                        .OrderBy(a => a.EvaluationQuestion.SortOrder)
                        .Select(a =>
                        {
                            var (score, comment) = ReadAnswer(a.AnswerValueJson);
                            return new EvaluationCriterionDto
                            {
                                Name = a.EvaluationQuestion.QuestionText,
                                Score = score,
                                Comment = comment
                            };
                        })
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
                        OverallComment = response.OverallComment
                    };
                })
                .ToList();

        private static (decimal Score, string? Comment) ReadAnswer(string json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return (0, null);
            }

            try
            {
                using var document = System.Text.Json.JsonDocument.Parse(json);
                var root = document.RootElement;

                var score = 0m;
                string? comment = null;

                if (root.ValueKind == System.Text.Json.JsonValueKind.Number)
                {
                    score = root.GetDecimal();
                }
                else if (root.ValueKind == System.Text.Json.JsonValueKind.Object)
                {
                    if (root.TryGetProperty("score", out var scoreElement)
                        && scoreElement.ValueKind == System.Text.Json.JsonValueKind.Number)
                    {
                        score = scoreElement.GetDecimal();
                    }

                    if (root.TryGetProperty("comment", out var commentElement)
                        && commentElement.ValueKind == System.Text.Json.JsonValueKind.String)
                    {
                        comment = commentElement.GetString();
                    }
                }

                return (score, comment);
            }
            catch (System.Text.Json.JsonException)
            {
                return (0, null);
            }
        }

        private static string PeriodLabel(DateTime submittedAt) =>
            $"Q{(submittedAt.Month - 1) / 3 + 1} {submittedAt.Year}";

        /// <summary>
        /// Scores are the mean of numeric answers against a MaxScore of 5, so anything
        /// outside 1-5 would poison the average and the history display alike.
        /// </summary>
        private static decimal ValidateScore(decimal score)
        {
            if (score < 1m || score > 5m)
            {
                throw new BadRequestException("An answer score must be between 1 and 5.");
            }

            return score;
        }

        /// <summary>
        /// Stores an answer as JSONB: rating questions keep their validated 1-5 score,
        /// choice questions keep their selections - every selected value checked against
        /// the question's own option list before anything is saved.
        /// </summary>
        private static string BuildAnswerValue(EvaluationQuestion question, EvaluationAnswerDto answer)
        {
            if (question.QuestionType is EvaluationQuestionType.MultipleChoice or EvaluationQuestionType.Checkbox)
            {
                var options = ParseOptions(question);
                if (options.Count == 0)
                {
                    throw new BadRequestException("This question has no selectable options.");
                }

                var selected = answer.SelectedValues ?? new List<string>();
                if (question.QuestionType == EvaluationQuestionType.MultipleChoice && selected.Count != 1)
                {
                    throw new BadRequestException("A multiple-choice question requires exactly one selected option.");
                }

                if (question.QuestionType == EvaluationQuestionType.Checkbox && selected.Count == 0)
                {
                    throw new BadRequestException("A checkbox question requires at least one selected option.");
                }

                if (selected.Any(value => string.IsNullOrWhiteSpace(value) || !options.Contains(value)))
                {
                    throw new BadRequestException("An answer selected a value that is not one of the question's options.");
                }

                return System.Text.Json.JsonSerializer.Serialize(new
                {
                    selectedValues = selected,
                    comment = OptionalComment(answer.Comment)
                });
            }

            return System.Text.Json.JsonSerializer.Serialize(new
            {
                score = ValidateScore(answer.Score),
                comment = OptionalComment(answer.Comment)
            });
        }

        /// <summary>Option list of a choice question; empty when unset or malformed.</summary>
        private static List<string> ParseOptions(EvaluationQuestion question)
        {
            if (string.IsNullOrWhiteSpace(question.OptionsJson))
            {
                return new List<string>();
            }

            try
            {
                return System.Text.Json.JsonSerializer.Deserialize<List<string>>(question.OptionsJson)
                    ?? new List<string>();
            }
            catch (System.Text.Json.JsonException)
            {
                return new List<string>();
            }
        }

        private static string? OptionalComment(string? comment)
        {
            var trimmed = (comment ?? string.Empty).Trim();
            if (trimmed.Length == 0)
            {
                return null;
            }

            if (trimmed.Length > 1000)
            {
                throw new BadRequestException("The comment may not exceed 1000 characters.");
            }

            return trimmed;
        }
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
