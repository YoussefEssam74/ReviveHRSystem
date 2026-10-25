using System.Globalization;
using System.Text.Json;
using AutoMapper;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.EvaluationModule;
using DomainLayer.Models.EvaluationModule.Enums;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.NotificationModule.Enums;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.PayrollModule.Enums;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
using Service.Specifications;
using Shared.DataTransferObject.Payroll;
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
                actorUserId, employeeId, activeGymId, cancellationToken);

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
                        EmployeeId = response.EmployeeId,
                        EmployeeName = response.Employee?.FullName ?? string.Empty,
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
    /// mean of the numeric answers, mirroring the read side. Authoring itself stays
    /// with the gym's reviewers — Branch Manager and the HR roles; Team Leaders hold
    /// evaluations.view only and read through the team surfaces.
    /// </summary>
    public class EvaluationManagementService(
        IUnitOfWork unitOfWork,
        IUserAccessRepository userAccess,
        IEmployeeAccessService employeeAccess) : IEvaluationManagementService
    {
        private static readonly string[] ReviewerRoleNames =
        [
            Shared.Authorization.RoleNames.BranchManager,
            Shared.Authorization.RoleNames.Hr,
            Shared.Authorization.RoleNames.HrManager,
            Shared.Authorization.RoleNames.SuperAdmin,
        ];

        private async Task EnsureReviewerRoleAsync(int actorUserId, int gymId, CancellationToken cancellationToken)
        {
            var roleNames = await userAccess.GetGymRoleNamesAsync(actorUserId, gymId, cancellationToken);
            if (!roleNames.Any(ReviewerRoleNames.Contains))
            {
                throw new NotFoundException("Evaluation not found.");
            }
        }

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

            await EnsureReviewerRoleAsync(actorUserId, gymId, cancellationToken);

            // The reader's scope guard: self, in-scope managers and gym staff only.
            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, employeeId, gymId, cancellationToken);

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

            await EnsureReviewerRoleAsync(actorUserId, gymId, cancellationToken);

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
                actorUserId, existing.Employee.Id, gymId, cancellationToken);

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
            // Leader-only: the team reviews list serves the caller's led teams; a
            // member (or anyone not leading the requested team) answers NotFound.
            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByUserIdSpec(actorUserId), cancellationToken)
                ?? throw new UnAuthorizedException("This account has no employee profile.");

            var teams = await unitOfWork.GetRepository<DomainLayer.Models.OrganizationModule.Team, int>()
                .GetAllAsync(new TeamsLedByUserSpec(employee.Id, gymId), cancellationToken);

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
                        EmployeeId = response.EmployeeId,
                        EmployeeName = response.Employee?.FullName ?? string.Empty,
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
                actorUserId, employeeId, activeGymId, cancellationToken);

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
    /// Own payroll (mock §8): periods of the employee's gym with the employee's entry.
    /// Entries of still-open periods are visible=false (not yet paid); bonuses and
    /// deductions are line items. Payslip content mirrors the HR preview card.
    /// </summary>
    public class PayrollSelfService(
        IUnitOfWork unitOfWork,
        IEmployeeAccessService employeeAccess,
        IMapper mapper,
        TimeZoneInfo attendanceTimeZone) : IPayrollSelfService
    {
        public async Task<IReadOnlyList<PayrollEntryDto>> GetPayrollAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default)
        {
            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, employeeId, activeGymId, cancellationToken);

            var employee = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            // Open periods ride along on purpose: the mapping marks their entry
            // visible=false so the UI can render the "Current Period" card
            // (Processing / payout pending) without exposing money yet.
            var periods = await unitOfWork.GetRepository<PayrollPeriod, int>()
                .GetAllAsync(new PayrollPeriodsByGymIncludingOpenSpec(employee.GymId), cancellationToken);

            var periodIds = periods.Select(p => p.Id).ToList();
            var entries = (await unitOfWork.GetRepository<PayrollEntry, int>()
                    .GetAllAsync(new PayrollEntriesByEmployeeSpec(employeeId, periodIds), cancellationToken))
                .OrderByDescending(e => e.PayrollPeriod.EndDate)
                .ToList();

            if (entries.Count == 0)
            {
                return [];
            }

            // Approved leave requests and attendance facts inside the loaded window —
            // they power the expanded breakdown's leave / late / absent stats (mock §8).
            var approvedLeaves = (await unitOfWork.GetRepository<EmployeeRequest, int>()
                    .GetAllAsync(new RequestsByEmployeeSpec(employeeId), cancellationToken))
                .Where(r => r.Status == RequestStatus.Approved)
                .ToList();

            var windowFrom = entries.Min(e => e.PayrollPeriod.StartDate);
            var windowTo = entries.Max(e => e.PayrollPeriod.EndDate);
            // Shift template joins each record so a late check-in can be dated against
            // its scheduled start; branch deductions supply the punishment trail.
            var attendance = (await unitOfWork.GetRepository<AttendanceRecord, int>()
                    .GetAllAsync(new AttendanceRecordsWithShiftByEmployeeIdsRangeSpec([employeeId], windowFrom, windowTo), cancellationToken))
                .ToList();

            var candidates = (await unitOfWork.GetRepository<DeductionCandidate, int>()
                    .GetAllAsync(new DeductionCandidatesByEmployeesSpec([employeeId]), cancellationToken))
                .ToList();

            // Mock §8 / features.md §10: while a period is still open, every late or
            // unapproved-absent day prices itself into a pending candidate (quarter
            // day / one day of base salary) so the branch can review it before HR
            // closes the sheet. Paid months keep whatever was actually applied.
            var openPeriods = periods.Where(p => p.Status == PayrollPeriodStatus.Open).ToList();
            if (openPeriods.Count > 0)
            {
                var issuerId = (await unitOfWork.GetRepository<DomainLayer.Models.UserModule.User, int>()
                        .GetAllAsync(new UserByEmailSpec("admin@revive.hr"), cancellationToken))
                    .Select(u => u.Id)
                    .Cast<int?>()
                    .FirstOrDefault();

                if (issuerId is not null)
                {
                    var createdAny = false;
                    foreach (var open in openPeriods)
                    {
                        var openEntry = entries.FirstOrDefault(e => e.PayrollPeriodId == open.Id);
                        if (openEntry is null)
                        {
                            continue;
                        }

                        foreach (var candidate in PayrollService.EnsureAttendanceCandidates(
                            employeeId, issuerId.Value, open, openEntry.BaseSalary, attendance, candidates))
                        {
                            await unitOfWork.GetRepository<DeductionCandidate, int>().AddAsync(candidate, cancellationToken);
                            candidates.Add(candidate);
                            createdAny = true;
                        }
                    }

                    if (createdAny)
                    {
                        await unitOfWork.SaveChangesAsync(cancellationToken);
                    }
                }
            }

            var absenceFollowUps = (await unitOfWork.GetRepository<TeamFollowUp, int>()
                    .GetAllAsync(new TeamFollowUpsDeductionForEmployeesSpec([employeeId]), cancellationToken))
                .Where(f => f.ActionType == FollowUpActionType.Deduction)
                .ToList();

            // The gym's annual-increase policy drives the mock's "Annual Increase (10%)" row.
            var annualIncreasePercent = employee.Gym?.AnnualIncreasePercent;

            return entries.Select(e =>
            {
                var dto = mapper.Map<PayrollEntryDto>(e);
                var start = e.PayrollPeriod.StartDate;
                var end = e.PayrollPeriod.EndDate;

                // Leave days taken inside this period, split by consumed leave type.
                var annual = 0;
                var sick = 0;
                var unpaid = 0;
                foreach (var request in approvedLeaves)
                {
                    var reqStart = request.TargetStartDate ?? request.RequestDate;
                    var reqEnd = request.TargetEndDate ?? reqStart;
                    if (reqEnd < start || reqStart > end)
                    {
                        continue;
                    }

                    var leaveType = RequestTypeCatalog.LeaveTypeFor(request.Type);
                    if (leaveType is null)
                    {
                        continue;
                    }

                    // Count only the overlap with the payroll period: a leave that
                    // spills across a month boundary must not charge its out-of-month
                    // days to both periods.
                    var overlapStart = reqStart > start ? reqStart : start;
                    var overlapEnd = reqEnd < end ? reqEnd : end;
                    var days = overlapEnd.DayNumber - overlapStart.DayNumber + 1;
                    if (request.Payment == "unpaid")
                    {
                        unpaid += days;
                    }
                    else if (leaveType == LeaveType.Annual)
                    {
                        annual += days;
                    }
                    else if (leaveType == LeaveType.Sick)
                    {
                        sick += days;
                    }
                }

                var records = attendance.Where(a => a.Date >= start && a.Date <= end).ToList();
                var late = records.Count(a => a.Status == AttendanceStatus.Late);
                var early = records.Count(a => a.Status == AttendanceStatus.EarlyCheckout);
                var absent = records.Count(a => a.Status == AttendanceStatus.Absent);

                var deductionDetails = BuildDeductionDetails(
                    start, end, records, candidates, absenceFollowUps, attendanceTimeZone);

                // Money facts derived from the sheet's own lines.
                var leaveDeduction = e.LineItems
                    .Where(li => li.Type.Equals("Deduction", StringComparison.OrdinalIgnoreCase)
                        && li.Label.Contains("leave", StringComparison.OrdinalIgnoreCase))
                    .Sum(li => Math.Abs(li.Amount));
                var advance = e.LineItems
                    .Where(li => li.Type.Equals("Deduction", StringComparison.OrdinalIgnoreCase)
                        && li.Label.Contains("advance", StringComparison.OrdinalIgnoreCase))
                    .Sum(li => Math.Abs(li.Amount));

                return dto with
                {
                    WorkingDays = Math.Max(dto.DaysWorked + absent + unpaid, dto.DaysWorked),
                    ScheduledWeeklyDays = PayrollService.WeeklyWorkDays,
                    AnnualIncreasePercent = annualIncreasePercent,
                    AnnualIncrease = annualIncreasePercent is > 0 && dto.BaseSalary > 0
                        ? Math.Round(dto.BaseSalary * annualIncreasePercent.Value / 100m, 2)
                        : 0m,
                    OvertimePay = PayrollService.OvertimePay(e),
                    PaidLeaveDays = annual + sick,
                    AnnualLeaveDays = annual,
                    SickLeaveDays = sick,
                    AbsentDays = absent,
                    LateCount = late,
                    EarlyLeaveCount = early,
                    UnpaidLeaveDays = unpaid,
                    LeaveDeduction = leaveDeduction,
                    SalaryAdvance = advance,
                    DeductionDetails = deductionDetails,
                    // Net = Earnings − Deductions, where Earnings is exactly the sheet's
                    // Earnings header (base + raise + bonuses + OT). Recomputed here so the
                    // net bar always reconciles with the two section headers above it.
                    NetSalary = dto.BaseSalary
                        + (annualIncreasePercent is > 0 && dto.BaseSalary > 0
                            ? Math.Round(dto.BaseSalary * annualIncreasePercent.Value / 100m, 2)
                            : 0m)
                        + dto.TotalBonuses
                        + PayrollService.OvertimePay(e)
                        - dto.TotalDeductions,
                };
            }).ToList();
        }

        /// <summary>
        /// One sheet's payslip card (mock §8): the owner reads it like the HR preview;
        /// scope-based readers (managers) use the HR portal's route instead.
        /// </summary>
        public async Task<PayslipResponse> GetPayslipAsync(
            int actorUserId, int employeeId, int entryId, CancellationToken cancellationToken = default)
        {
            await employeeAccess.EnsureCanAccessAsync(
                actorUserId, employeeId, null, cancellationToken);

            _ = await unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeByIdSpec(employeeId), cancellationToken)
                ?? throw new NotFoundException("Employee not found.");

            var entry = await unitOfWork.GetRepository<PayrollEntry, int>()
                .GetByIdAsync(new PayrollEntryByIdSpec(entryId), cancellationToken)
                ?? throw new NotFoundException("Payroll sheet not found.");

            if (entry.EmployeeId != employeeId)
            {
                throw new NotFoundException("Payroll sheet not found.");
            }

            return new PayslipResponse { Data = PayrollService.BuildPayslip(entry) };
        }

        /// <summary>
        /// Full deduction detail rows of one period (mock §8): every late check-in
        /// dated against its shift start, every absent day carrying the deduction
        /// attached to it, plus branch deductions that track no attendance day.
        /// Each late/absent day claims at most one deduction (AttendanceRecord link
        /// first, same-day fallback); leftovers surface as their own rows.
        /// </summary>
        private static IReadOnlyList<PayrollDeductionDetailDto> BuildDeductionDetails(
            DateOnly start,
            DateOnly end,
            List<AttendanceRecord> records,
            List<DeductionCandidate> candidates,
            List<TeamFollowUp> followUps,
            TimeZoneInfo timeZone)
        {
            var details = new List<PayrollDeductionDetailDto>();
            var consumedCandidates = new HashSet<DeductionCandidate>();
            var consumedFollowUps = new HashSet<TeamFollowUp>();

            // A candidate punishes the attendance day it links to (or the day it was
            // raised on); a follow-up carries its absence day in the note marker.
            var candidatesByDay = new Dictionary<DateOnly, List<DeductionCandidate>>();
            var followUpsByDay = new Dictionary<DateOnly, List<TeamFollowUp>>();
            foreach (var candidate in candidates.Where(c => !string.IsNullOrEmpty(c.Reason))
                         .OrderBy(c => c.IssuedAt))
            {
                var day = PayrollService.CandidateDayOf(candidate);
                if (day < start || day > end)
                {
                    continue;
                }

                if (!candidatesByDay.TryGetValue(day, out var dayList))
                {
                    dayList = [];
                    candidatesByDay[day] = dayList;
                }

                dayList.Add(candidate);
            }

            foreach (var followUp in followUps)
            {
                if (PayrollService.ParseAbsenceMarker(followUp.Note) is not { } day
                    || day < start || day > end)
                {
                    continue;
                }

                if (!followUpsByDay.TryGetValue(day, out var dayList))
                {
                    dayList = [];
                    followUpsByDay[day] = dayList;
                }

                dayList.Add(followUp);
            }

            foreach (var record in records.Where(r =>
                         r.Status is AttendanceStatus.Late or AttendanceStatus.Absent)
                     .OrderBy(r => r.Date))
            {
                var candidate = candidatesByDay.TryGetValue(record.Date, out var cands)
                    ? cands.FirstOrDefault(c => c.AttendanceRecordId == record.Id)
                        ?? cands.FirstOrDefault(c => c.AttendanceRecordId is null)
                    : null;
                if (candidate is not null)
                {
                    consumedCandidates.Add(candidate);
                    candidatesByDay[record.Date]?.Remove(candidate);
                }

                var followUp = followUpsByDay.TryGetValue(record.Date, out var fus) ? fus.FirstOrDefault() : null;
                if (followUp is not null)
                {
                    // The record row already folds the follow-up's trail in — always
                    // consume it, or an auto-priced day would emit a second, amount-less
                    // absence row for the same absence.
                    consumedFollowUps.Add(followUp);
                    followUpsByDay[record.Date]?.Remove(followUp);
                }

                if (record.Status == AttendanceStatus.Late)
                {
                    var (minutesLate, checkInAt) = LateFacts(record, timeZone);
                    details.Add(new PayrollDeductionDetailDto
                    {
                        Kind = "late",
                        Date = record.Date,
                        Label = "Late arrival",
                        MinutesLate = minutesLate,
                        CheckInAt = checkInAt,
                        Shift = ShiftLabel(record),
                        Amount = candidate?.Amount,
                        Reason = candidate?.Note ?? followUp?.Description,
                        IssuedBy = AutoPriced(candidate) ? null : candidate?.IssuedByUser?.UserName ?? followUp?.RaisedByUser?.UserName,
                        Status = candidate is not null ? StatusLabel(candidate.Status) : null,
                        AttendanceRecordId = record.Id,
                    });
                }
                else
                {
                    details.Add(new PayrollDeductionDetailDto
                    {
                        Kind = "absent",
                        Date = record.Date,
                        Label = "Unapproved day off",
                        Shift = ShiftLabel(record),
                        Amount = candidate?.Amount,
                        Reason = candidate?.Note ?? followUp?.Description,
                        IssuedBy = AutoPriced(candidate) ? null : candidate?.IssuedByUser?.UserName ?? followUp?.RaisedByUser?.UserName,
                        Status = candidate is not null ? StatusLabel(candidate.Status)
                            : followUp is not null
                                ? (followUp.IsResolved ? "Resolved" : "In review")
                                : null,
                        AttendanceRecordId = record.Id,
                    });
                }
            }

            // Branch deductions that track no attendance day of this period (equipment,
            // uniform deposit, hand-raised rows issued on a day without a record) keep
            // their own rows instead of being folded into a day.
            foreach (var candidate in candidates
                         .Where(c => !consumedCandidates.Contains(c))
                         .OrderBy(c => c.IssuedAt))
            {
                var day = candidate.AttendanceRecord?.Date
                    ?? DateOnly.FromDateTime(candidate.IssuedAt);
                if (day < start || day > end)
                {
                    continue;
                }

                details.Add(new PayrollDeductionDetailDto
                {
                    Kind = "candidate",
                    Date = day,
                    Label = candidate.Reason,
                    Amount = candidate.Amount,
                    Reason = candidate.Note,
                    IssuedBy = AutoPriced(candidate) ? null : candidate.IssuedByUser?.UserName,
                    Status = StatusLabel(candidate.Status),
                    AttendanceRecordId = candidate.AttendanceRecordId,
                });
            }

            // A follow-up punishes an absence without money attached; when its day has
            // no attendance record (data gap) it still earns an absence row.
            foreach (var followUp in followUps.Where(f => !consumedFollowUps.Contains(f)))
            {
                if (PayrollService.ParseAbsenceMarker(followUp.Note) is not { } day || day < start || day > end)
                {
                    continue;
                }

                details.Add(new PayrollDeductionDetailDto
                {
                    Kind = "absent",
                    Date = day,
                    Label = followUp.Description,
                    Amount = null,
                    Reason = followUp.LastAction,
                    IssuedBy = followUp.RaisedByUser?.UserName,
                    Status = followUp.IsResolved ? "Resolved" : "In review",
                });
            }

            return details.OrderBy(d => d.Date).ToList();
        }

        /// <summary>
        /// The day's scheduled shift as the payroll mock renders it —
        /// "Morning Shift 08:00–16:00"; null when the day has no linked template.
        /// </summary>
        private static string? ShiftLabel(AttendanceRecord record)
        {
            var template = record.ScheduledShiftTemplate;
            return template is null
                ? null
                : $"{template.Name} {template.StartTime:HH\\:mm}–{template.EndTime:HH\\:mm}";
        }

        /// <summary>
        /// Gym-local check-in clock facts for a late record: minutes after the
        /// scheduled shift start plus the dashboard's HH:mm rendering.
        /// </summary>
        private static (int? MinutesLate, string? CheckInAt) LateFacts(AttendanceRecord record, TimeZoneInfo timeZone)
        {
            if (record.CheckInTime is null)
            {
                return (null, null);
            }

            var localCheckIn = TimeOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(
                DateTime.SpecifyKind(record.CheckInTime.Value, DateTimeKind.Utc), timeZone));
            int? minutes = null;
            if (record.ScheduledShiftTemplate?.StartTime is { } shiftStart)
            {
                minutes = Math.Max(0, (int)Math.Round((localCheckIn - shiftStart).TotalMinutes));
            }

            return (minutes, localCheckIn.ToString("HH:mm", CultureInfo.InvariantCulture));
        }

        private static string StatusLabel(DeductionStatus status) => status switch
        {
            DeductionStatus.Pending => "In review",
            DeductionStatus.BranchApproved => "Branch approved",
            DeductionStatus.Approved => "Applied",
            _ => "Rejected",
        };

        /// <summary>Auto-priced rows explain themselves in the note — no issuer to name.</summary>
        private static bool AutoPriced(DeductionCandidate? candidate)
        {
            var note = PayrollService.StripAbsenceMarker(candidate?.Note);
            return note is not null
                && (note.StartsWith("Auto-priced", StringComparison.Ordinal)
                    || note.StartsWith("No salary on file", StringComparison.Ordinal));
        }
    }
}
