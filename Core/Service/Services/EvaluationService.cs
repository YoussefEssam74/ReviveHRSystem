using System.Globalization;
using System.Text.Json;
using DomainLayer.Contracts;
using DomainLayer.Exceptions;
using DomainLayer.Models.AuditModule;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.EvaluationModule;
using DomainLayer.Models.EvaluationModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.RecruitmentModule;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Service.Specifications;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.Evaluation;

namespace Service.Services
{
    /// <summary>
    /// Evaluations + form builder (api-spec-from-ui.md §5.3/§5.4). Forms come in two
    /// kinds — evaluation templates (question rows) and hiring forms (question JSON,
    /// published publicly by §5.2) — dispatch fans a running form out to every
    /// eligible evaluator as per (form, evaluator, subject) assignment rows, and the
    /// inbox/history endpoints read those rows back grouped per card. Statuses are
    /// the mock's display vocabulary throughout.
    /// </summary>
    public sealed class EvaluationService(
        IUnitOfWork _unitOfWork,
        IAccessControlService _accessControl,
        IUserAccessRepository _userAccess) : IEvaluationService
    {
        /// <summary>Keys that make a user an eligible evaluator / inbox holder.</summary>
        private static readonly string[] EvaluatorKeys =
            ["evaluations.manage", "evaluations.manage.team", "evaluations.view.team", "team.manage"];

        // ==================================================================
        // Form builder (§5.3) — evaluation forms
        // ==================================================================

        public async Task<EvaluationFormListResponse> GetFormsAsync(int? actorUserId, EvaluationFormListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "evaluations.view", cancellationToken);
            var scope = await HrPortalHelpers.ResolveGymScopeAsync(_unitOfWork, _userAccess, actor, query.Gym, cancellationToken);

            var page = Math.Max(query.Page, 1);
            var pageSize = HrPortalHelpers.NormalizePageSize(query.PageSize);

            var countSpec = new EvaluationFormListSpec(scope, query.Gym, query.Status, query.Position, 0, 0);
            var total = await _unitOfWork.GetRepository<EvaluationForm, int>().CountAsync(countSpec, cancellationToken);
            var rows = await _unitOfWork.GetRepository<EvaluationForm, int>()
                .GetAllAsync(new EvaluationFormListSpec(scope, query.Gym, query.Status, query.Position, (page - 1) * pageSize, pageSize), cancellationToken);

            return new EvaluationFormListResponse
            {
                Items = rows.Select(MapForm).ToList(),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(total / (double)pageSize) : 0,
            };
        }

        public async Task<EvaluationFormResponse> GetFormAsync(int? actorUserId, int formId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "evaluations.view", cancellationToken);

            var form = await _unitOfWork.GetRepository<EvaluationForm, int>()
                .GetByIdAsync(new EvaluationFormByIdSpec(formId), cancellationToken);
            if (form is null)
            {
                throw new NotFoundException("Evaluation form not found.");
            }

            return new EvaluationFormResponse { Data = MapForm(form) };
        }

        public async Task<EvaluationFormResponse> CreateFormAsync(int? actorUserId, UpsertEvaluationFormRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "evaluations.forms.manage", cancellationToken);

            var (name, status, target, gymId) = await ValidateFormAsync(actor, request, cancellationToken);
            var questions = NormalizeQuestionInputs(request.QuestionList);

            var form = new EvaluationForm
            {
                Name = name,
                Status = status,
                IsActive = status == "Active",
                Target = target,
                GymId = gymId,
                CreatedDate = DateTime.UtcNow,
            };
            foreach (var (type, text, options) in questions)
            {
                form.Questions.Add(new EvaluationQuestion
                {
                    QuestionText = text,
                    QuestionType = type,
                    OptionsJson = options.Count == 0 ? null : JsonSerializer.Serialize(options),
                    SortOrder = form.Questions.Count,
                });
            }

            await _unitOfWork.GetRepository<EvaluationForm, int>().AddAsync(form, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new EvaluationFormResponse { Data = MapForm(form) };
        }

        public async Task<EvaluationFormResponse> UpdateFormAsync(int? actorUserId, int formId, UpsertEvaluationFormRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "evaluations.forms.manage", cancellationToken);

            var form = await _unitOfWork.GetRepository<EvaluationForm, int>()
                .GetByIdAsync(new EvaluationFormByIdSpec(formId), cancellationToken);
            if (form is null)
            {
                throw new NotFoundException("Evaluation form not found.");
            }

            var (name, status, target, gymId) = await ValidateFormAsync(actor, request, cancellationToken);
            var questions = NormalizeQuestionInputs(request.QuestionList);

            // The editor replaces the whole question list on save.
            var oldQuestions = form.Questions.ToList();
            form.Questions.Clear();
            foreach (var old in oldQuestions)
            {
                _unitOfWork.GetRepository<EvaluationQuestion, int>().Remove(old);
            }

            form.Name = name;
            form.Status = status;
            form.IsActive = status == "Active";
            form.Target = target;
            form.GymId = gymId;
            foreach (var (type, text, options) in questions)
            {
                form.Questions.Add(new EvaluationQuestion
                {
                    QuestionText = text,
                    QuestionType = type,
                    OptionsJson = options.Count == 0 ? null : JsonSerializer.Serialize(options),
                    SortOrder = form.Questions.Count,
                });
            }

            _unitOfWork.GetRepository<EvaluationForm, int>().Update(form);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new EvaluationFormResponse { Data = MapForm(form) };
        }

        public async Task DeleteFormAsync(int? actorUserId, int formId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "evaluations.forms.manage", cancellationToken);

            var form = await _unitOfWork.GetRepository<EvaluationForm, int>()
                .GetByIdAsync(new EvaluationFormByIdSpec(formId), cancellationToken);
            if (form is null)
            {
                throw new NotFoundException("Evaluation form not found.");
            }

            if (form.Responses.Count > 0)
            {
                throw new BadRequestException("This form has submitted evaluations — set its status to Inactive instead.");
            }

            foreach (var assignment in form.Assignments.ToList())
            {
                _unitOfWork.GetRepository<EvaluationAssignment, int>().Remove(assignment);
            }

            foreach (var question in form.Questions.ToList())
            {
                _unitOfWork.GetRepository<EvaluationQuestion, int>().Remove(question);
            }

            form.Questions.Clear();
            form.Assignments.Clear();
            _unitOfWork.GetRepository<EvaluationForm, int>().Remove(form);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        // ==================================================================
        // Form builder (§5.3) — hiring forms
        // ==================================================================

        public async Task<HiringFormListResponse> GetHiringFormsAsync(int? actorUserId, HiringFormListQuery query, CancellationToken cancellationToken = default)
        {
            var page = Math.Max(query.Page, 1);
            var pageSize = HrPortalHelpers.NormalizePageSize(query.PageSize);

            var gymRaw = HrPortalHelpers.NullIfBlank(query.Gym);
            var position = HrPortalHelpers.NullIfBlank(query.Position);
            var status = HrPortalHelpers.NullIfBlank(query.Status);
            int[] scope;
            int? gymFilter = null;
            var unknownGym = false;

            if (actorUserId is null)
            {
                // Public careers view (§5.2): open forms only, no access scope, gym
                // matched by branch name or id.
                scope = [];
                status = "Open";
                if (gymRaw is not null)
                {
                    gymFilter = int.TryParse(gymRaw, out var publicGymId)
                        ? publicGymId
                        : await LookupGymIdByNameAsync(gymRaw, cancellationToken);
                    unknownGym = gymFilter is null;
                }
            }
            else
            {
                var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
                await _accessControl.EnsurePermissionAsync(actor.Id, "evaluations.view", cancellationToken);

                if (gymRaw is not null)
                {
                    if (int.TryParse(gymRaw, out var gymId))
                    {
                        gymFilter = gymId;
                    }
                    else
                    {
                        gymFilter = await LookupGymIdByNameAsync(gymRaw, cancellationToken);
                        unknownGym = gymFilter is null;
                    }
                }

                scope = await HrPortalHelpers.ResolveGymScopeAsync(_unitOfWork, _userAccess, actor, gymFilter, cancellationToken);
            }

            if (unknownGym)
            {
                return new HiringFormListResponse
                {
                    Items = [],
                    Page = page,
                    PageSize = pageSize,
                    Total = 0,
                    TotalPages = 0,
                };
            }

            var countSpec = new HiringFormListSpec(scope, gymFilter, status, position, 0, 0);
            var total = await _unitOfWork.GetRepository<HiringForm, int>().CountAsync(countSpec, cancellationToken);
            var rows = (await _unitOfWork.GetRepository<HiringForm, int>()
                .GetAllAsync(new HiringFormListSpec(scope, gymFilter, status, position, (page - 1) * pageSize, pageSize), cancellationToken))
                .ToList();

            var applicantsByForm = await CountApplicantsAsync(rows.Select(f => f.Id).ToArray(), cancellationToken);

            return new HiringFormListResponse
            {
                Items = rows.Select(f => MapHiringForm(f, applicantsByForm.GetValueOrDefault(f.Id))).ToList(),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(total / (double)pageSize) : 0,
            };
        }

        public async Task<HiringFormResponse> GetHiringFormAsync(int? actorUserId, int formId, CancellationToken cancellationToken = default)
        {
            var form = await _unitOfWork.GetRepository<HiringForm, int>()
                .GetByIdAsync(new HiringFormByIdSpec(formId), cancellationToken)
                ?? throw new NotFoundException("Hiring form not found.");

            if (actorUserId is int actorId)
            {
                var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorId, cancellationToken);
                await _accessControl.EnsurePermissionAsync(actor.Id, "evaluations.view", cancellationToken);
            }
            else if (!string.Equals(form.Status, "Open", StringComparison.OrdinalIgnoreCase))
            {
                // Anonymous visitors only ever see open forms.
                throw new NotFoundException("Hiring form not found.");
            }

            var applicants = await CountApplicantsAsync([formId], cancellationToken);
            return new HiringFormResponse { Data = MapHiringForm(form, applicants.GetValueOrDefault(formId)) };
        }

        /// <summary>Branch name → gym id without an access check (public filters + admin name filters).</summary>
        private async Task<int?> LookupGymIdByNameAsync(string name, CancellationToken cancellationToken)
        {
            var gyms = await _unitOfWork.GetRepository<Gym, int>().GetAllAsync(cancellationToken);
            return gyms
                .Where(g => string.Equals(g.Name.Trim(), name.Trim(), StringComparison.OrdinalIgnoreCase))
                .Select(g => (int?)g.Id)
                .FirstOrDefault();
        }

        public async Task<HiringFormResponse> CreateHiringFormAsync(int? actorUserId, UpsertHiringFormRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "evaluations.forms.manage", cancellationToken);

            var (name, status, position, gymId) = await ValidateHiringFormAsync(actor, request, cancellationToken);
            var questions = NormalizeQuestionInputs(request.QuestionList);

            var form = new HiringForm
            {
                Name = name,
                Status = status,
                Position = position,
                GymId = gymId,
                QuestionsJson = SerializeHiringQuestions(questions),
                CreatedBy = actor.Id,
                CreatedDate = DateTime.UtcNow,
            };

            await _unitOfWork.GetRepository<HiringForm, int>().AddAsync(form, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new HiringFormResponse { Data = MapHiringForm(form, 0) };
        }

        public async Task<HiringFormResponse> UpdateHiringFormAsync(int? actorUserId, int formId, UpsertHiringFormRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "evaluations.forms.manage", cancellationToken);

            var form = await _unitOfWork.GetRepository<HiringForm, int>()
                .GetByIdAsync(new HiringFormByIdSpec(formId), cancellationToken);
            if (form is null)
            {
                throw new NotFoundException("Hiring form not found.");
            }

            var (name, status, position, gymId) = await ValidateHiringFormAsync(actor, request, cancellationToken);
            var questions = NormalizeQuestionInputs(request.QuestionList);

            form.Name = name;
            form.Status = status;
            form.Position = position;
            form.GymId = gymId;
            form.QuestionsJson = SerializeHiringQuestions(questions);

            _unitOfWork.GetRepository<HiringForm, int>().Update(form);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var applicants = await CountApplicantsAsync([formId], cancellationToken);
            return new HiringFormResponse { Data = MapHiringForm(form, applicants.GetValueOrDefault(formId)) };
        }

        public async Task DeleteHiringFormAsync(int? actorUserId, int formId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "evaluations.forms.manage", cancellationToken);

            var form = await _unitOfWork.GetRepository<HiringForm, int>()
                .GetByIdAsync(new HiringFormByIdSpec(formId), cancellationToken);
            if (form is null)
            {
                throw new NotFoundException("Hiring form not found.");
            }

            var applications = await _unitOfWork.GetRepository<HiringFormApplication, int>()
                .CountAsync(new ApplicationsByFormsSpec([formId]), cancellationToken);
            if (applications > 0)
            {
                throw new BadRequestException("This form has received applications — close it instead of deleting it.");
            }

            _unitOfWork.GetRepository<HiringForm, int>().Remove(form);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        // ==================================================================
        // Dispatch + assignments (§5.4)
        // ==================================================================

        public async Task<DispatchResponse> DispatchAsync(int? actorUserId, int formId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "evaluations.manage", cancellationToken);

            var form = await _unitOfWork.GetRepository<EvaluationForm, int>()
                .GetByIdAsync(new EvaluationFormByIdSpec(formId), cancellationToken);
            if (form is null)
            {
                throw new NotFoundException("Evaluation form not found.");
            }

            if (form.Status != "Active")
            {
                throw new BadRequestException("Only Active forms can be dispatched.");
            }

            var employees = (await _unitOfWork.GetRepository<Employee, int>()
                .GetAllAsync(new ActiveEmployeesForFormSpec(), cancellationToken)).ToList();
            var names = employees.ToDictionary(e => e.Id, e => e.FullName);
            var activeUsers = (await _unitOfWork.GetRepository<User, int>()
                .GetAllAsync(new ActiveUsersSpec(), cancellationToken)).ToList();

            var existingRows = (await _unitOfWork.GetRepository<EvaluationAssignment, int>()
                .GetAllAsync(new AssignmentRowsSpec([formId], null, null, 0, 0), cancellationToken)).ToList();
            var knownPairs = existingRows.Select(r => (r.EvaluatorUserId, r.EmployeeId)).ToHashSet();

            var newRows = new List<EvaluationAssignment>();
            var touched = new List<(User Evaluator, List<EvaluationAssignment> Rows)>();

            foreach (var evaluator in activeUsers.Where(u => u.Id != actor.Id))
            {
                var eligible = evaluator.UserType == UserType.TopManagement;
                if (!eligible)
                {
                    var keys = (await _userAccess.GetPermissionKeysAsync(evaluator.Id, cancellationToken)).ToHashSet();
                    eligible = EvaluatorKeys.Any(keys.Contains);
                }

                if (!eligible)
                {
                    continue;
                }

                var evaluatorGyms = evaluator.UserType == UserType.TopManagement
                    ? Array.Empty<int>()
                    : (await _userAccess.GetGymAccessAsync(evaluator.Id, cancellationToken)).Select(g => g.GymId).ToArray();

                var subjects = employees.Where(e =>
                    e.UserId != evaluator.Id &&
                    (form.GymId is null || e.GymId == form.GymId) &&
                    (evaluator.UserType == UserType.TopManagement || evaluatorGyms.Contains(e.GymId)) &&
                    MatchesPosition(form, e)).ToList();
                if (subjects.Count == 0)
                {
                    continue;
                }

                var groupRows = existingRows.Where(r => r.EvaluatorUserId == evaluator.Id).ToList();
                var created = false;
                foreach (var subject in subjects)
                {
                    if (knownPairs.Contains((evaluator.Id, subject.Id)))
                    {
                        continue;
                    }

                    var row = new EvaluationAssignment
                    {
                        EvaluationFormId = formId,
                        EmployeeId = subject.Id,
                        EvaluatorUserId = evaluator.Id,
                        AssignedBy = actor.Id,
                        AssignedAt = DateTime.UtcNow,
                        Status = "Assigned",
                    };
                    await _unitOfWork.GetRepository<EvaluationAssignment, int>().AddAsync(row, cancellationToken);
                    newRows.Add(row);
                    groupRows.Add(row);
                    knownPairs.Add((evaluator.Id, subject.Id));
                    created = true;
                }

                if (created)
                {
                    touched.Add((evaluator, groupRows));
                }
            }

            if (newRows.Count > 0)
            {
                await _unitOfWork.GetRepository<AuditLog, int>().AddAsync(new AuditLog
                {
                    UserId = actor.Id,
                    Action = "Evaluation Dispatched",
                    EntityType = "EvaluationForm",
                    EntityId = formId,
                    GymId = form.GymId,
                    NewValues = JsonSerializer.Serialize(new
                    {
                        formName = form.Name,
                        routedEvaluators = touched.Count,
                        evaluationsAssigned = newRows.Count,
                    }),
                    Timestamp = DateTime.UtcNow,
                }, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }

            var dispatchedBy = HrPortalHelpers.DisplayName(actor);
            var items = touched
                .Select(t => BuildAssignmentGroup(t.Evaluator, form, t.Rows, names, dispatchedBy))
                .ToList();

            return new DispatchResponse
            {
                Data = new DispatchData
                {
                    FormId = formId,
                    CreatedAssignments = items,
                    RoutedEvaluators = items.Count,
                    EvaluationsAssigned = newRows.Count,
                },
            };
        }

        public async Task<AssignmentListResponse> GetAssignmentsAsync(int? actorUserId, AssignmentListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await EnsureAnyPermissionAsync(actor, EvaluatorKeys, cancellationToken);

            var rows = (await _unitOfWork.GetRepository<EvaluationAssignment, int>()
                .GetAllAsync(new AssignmentRowsSpec(
                    query.FormId is int formId ? [formId] : null, actor.Id, null, 0, 0), cancellationToken))
                .ToList();
            var names = rows.Where(r => r.Employee is not null)
                .GroupBy(r => r.EmployeeId)
                .ToDictionary(g => g.Key, g => g.First().Employee!.FullName);

            var byForm = rows
                .GroupBy(r => r.EvaluationFormId)
                .Select(g =>
                {
                    var ordered = g.OrderBy(r => r.Id).ToList();
                    var first = ordered[0];
                    return new AssignmentItem
                    {
                        Id = first.Id,
                        FormId = first.EvaluationFormId,
                        FormName = first.EvaluationForm.Name,
                        EvaluatorEmail = actor.Email,
                        EvaluatorName = HrPortalHelpers.DisplayName(actor),
                        Subjects = ordered.Select(r => names.GetValueOrDefault(r.EmployeeId, $"Employee {r.EmployeeId}")).ToList(),
                        CompletedSubjects = ordered.Where(r => r.Status == "Completed")
                            .Select(r => names.GetValueOrDefault(r.EmployeeId, $"Employee {r.EmployeeId}")).ToList(),
                        Status = ordered.All(r => r.Status == "Completed") ? "Completed" : "Assigned",
                        DispatchedDate = ordered.Min(r => r.AssignedAt),
                        DispatchedBy = HrPortalHelpers.DisplayName(first.AssignedByUser),
                    };
                })
                .Where(item => string.IsNullOrWhiteSpace(query.Status) ||
                    string.Equals(item.Status, query.Status.Trim(), StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(item => item.DispatchedDate)
                .ToList();

            var page = Math.Max(query.Page, 1);
            var pageSize = HrPortalHelpers.NormalizePageSize(query.PageSize);
            var pageItems = byForm.Skip((page - 1) * pageSize).Take(pageSize).ToList();

            return new AssignmentListResponse
            {
                Items = pageItems,
                Page = page,
                PageSize = pageSize,
                Total = byForm.Count,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(byForm.Count / (double)pageSize) : 0,
            };
        }

        // ==================================================================
        // Submit + launch cycle (§5.4)
        // ==================================================================

        public async Task<SubmitEvaluationResponse> SubmitResponseAsync(int? actorUserId, int formId, SubmitEvaluationRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);

            // The caller either holds evaluations.manage or is an assignment holder for this form.
            var assignmentRows = (await _unitOfWork.GetRepository<EvaluationAssignment, int>()
                .GetAllAsync(new AssignmentRowsSpec([formId], actor.Id, null, 0, 0), cancellationToken))
                .ToList();
            try
            {
                await _accessControl.EnsurePermissionAsync(actor.Id, "evaluations.manage", cancellationToken);
            }
            catch (UnAuthorizedException)
            {
                if (assignmentRows.Count == 0)
                {
                    throw;
                }
            }

            var form = await _unitOfWork.GetRepository<EvaluationForm, int>()
                .GetByIdAsync(new EvaluationFormByIdSpec(formId), cancellationToken);
            if (form is null)
            {
                throw new NotFoundException("Evaluation form not found.");
            }

            if (request.Score is < 0 or > 100)
            {
                throw new BadRequestException("score must be between 0 and 100.");
            }

            var subject = await ResolveSubjectAsync(actor, request, cancellationToken);

            var response = new EvaluationResponse
            {
                EvaluationFormId = formId,
                EmployeeId = subject.Id,
                EvaluatedBy = actor.Id,
                SubmittedAt = DateTime.UtcNow,
                Period = HrPortalHelpers.NullIfBlank(request.Period),
                Score = request.Score,
                Status = "Completed",
                Notes = HrPortalHelpers.NullIfBlank(request.Notes) ?? "Evaluation completed with standard scoring.",
            };
            await _unitOfWork.GetRepository<EvaluationResponse, int>().AddAsync(response, cancellationToken);

            var questionByText = form.Questions
                .GroupBy(q => q.QuestionText.Trim(), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
            foreach (var input in request.Answers ?? [])
            {
                var text = HrPortalHelpers.NullIfBlank(input.Question);
                if (text is null || !questionByText.TryGetValue(text.Trim(), out var question))
                {
                    continue;
                }

                await _unitOfWork.GetRepository<EvaluationAnswer, int>().AddAsync(new EvaluationAnswer
                {
                    EvaluationResponse = response,
                    EvaluationQuestionId = question.Id,
                    AnswerValueJson = JsonSerializer.Serialize(input.Answer ?? string.Empty),
                }, cancellationToken);
            }

            form.LastUsedAt = DateTime.UtcNow;
            _unitOfWork.GetRepository<EvaluationForm, int>().Update(form);

            AssignmentEcho? echo = null;
            if (request.AssignmentId is not null)
            {
                var subjectRow = assignmentRows.FirstOrDefault(r => r.EmployeeId == subject.Id);
                if (subjectRow is not null)
                {
                    subjectRow.Status = "Completed";
                    subjectRow.EvaluationResponse = response;
                    _unitOfWork.GetRepository<EvaluationAssignment, int>().Update(subjectRow);

                    echo = new AssignmentEcho
                    {
                        Id = assignmentRows.Min(r => r.Id),
                        CompletedSubjects = assignmentRows.Where(r => r.Status == "Completed")
                            .Select(r => r.Employee.FullName).ToList(),
                        Status = assignmentRows.All(r => r.Status == "Completed") ? "Completed" : "Assigned",
                    };
                }
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new SubmitEvaluationResponse
            {
                Data = new EvaluationResponseItem
                {
                    Id = response.Id,
                    Employee = subject.FullName,
                    Form = form.Name,
                    FormId = formId,
                    Period = response.Period,
                    Score = response.Score,
                    Status = response.Status,
                    Notes = response.Notes,
                    ReviewedBy = HrPortalHelpers.DisplayName(actor),
                    ReviewedDate = response.SubmittedAt,
                    Answers = (request.Answers ?? []).Select(a => new EvaluationAnswerItem
                    {
                        Question = a.Question ?? string.Empty,
                        Type = a.Type ?? "text",
                        Answer = a.Answer ?? string.Empty,
                    }).ToList(),
                    Gym = subject.Gym?.Name ?? "All",
                },
                Assignment = echo,
            };
        }

        public async Task<LaunchCycleResponse> LaunchCycleAsync(int? actorUserId, int formId, LaunchCycleRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "evaluations.manage", cancellationToken);

            var form = await _unitOfWork.GetRepository<EvaluationForm, int>()
                .GetByIdAsync(new EvaluationFormByIdSpec(formId), cancellationToken);
            if (form is null)
            {
                throw new NotFoundException("Evaluation form not found.");
            }

            if (form.Status != "Active")
            {
                throw new BadRequestException("Only Active forms can be launched.");
            }

            var period = HrPortalHelpers.NullIfBlank(request.Period)
                ?? throw new BadRequestException("Period is required.");

            var employees = (await _unitOfWork.GetRepository<Employee, int>()
                .GetAllAsync(new ActiveEmployeesForFormSpec(), cancellationToken)).ToList();
            var scope = await HrPortalHelpers.ResolveGymScopeAsync(_unitOfWork, _userAccess, actor, null, cancellationToken);

            var alreadyStarted = (await _unitOfWork.GetRepository<EvaluationResponse, int>()
                .GetAllAsync(new EvaluationResponsesSpec(null, null, null, formId, period, null, 0, 0), cancellationToken))
                .Where(r => r.Status is "In Progress" or "Completed")
                .Select(r => r.EmployeeId)
                .ToHashSet();

            var started = 0;
            foreach (var subject in employees.Where(e =>
                         (form.GymId is null || e.GymId == form.GymId) &&
                         (actor.UserType == UserType.TopManagement || scope.Contains(e.GymId)) &&
                         MatchesPosition(form, e) &&
                         !alreadyStarted.Contains(e.Id)))
            {
                await _unitOfWork.GetRepository<EvaluationResponse, int>().AddAsync(new EvaluationResponse
                {
                    EvaluationFormId = formId,
                    EmployeeId = subject.Id,
                    EvaluatedBy = actor.Id,
                    SubmittedAt = DateTime.UtcNow,
                    Period = period,
                    Score = null,
                    Status = "In Progress",
                    Notes = null,
                }, cancellationToken);
                started++;
            }

            // One cycle chip per label — relaunching an open label adds no duplicate chips.
            var cycles = (await _unitOfWork.GetRepository<PerformanceCycle, int>().GetAllAsync(cancellationToken)).ToList();
            var cycle = cycles.FirstOrDefault(c => string.Equals(c.Name, period, StringComparison.OrdinalIgnoreCase));
            if (cycle is null)
            {
                var today = DateOnly.FromDateTime(DateTime.UtcNow);
                cycle = new PerformanceCycle
                {
                    Name = period,
                    StartDate = today,
                    EndDate = today.AddMonths(3),
                    Status = "In Progress",
                };
                await _unitOfWork.GetRepository<PerformanceCycle, int>().AddAsync(cycle, cancellationToken);
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new LaunchCycleResponse
            {
                Data = new LaunchCycleData
                {
                    BatchId = cycle.Id,
                    StartedCount = started,
                    Status = "In Progress",
                },
            };
        }

        // ==================================================================
        // History reads (§5.4)
        // ==================================================================

        public async Task<EvaluationResponseListResponse> GetResponsesAsync(int? actorUserId, EvaluationResponseListQuery query, CancellationToken cancellationToken = default)
            => await QueryResponsesAsync(actorUserId, query, requireForm: null, cancellationToken);

        public async Task<EvaluationResponseListResponse> GetFormResponsesAsync(int? actorUserId, int formId, EvaluationResponseListQuery query, CancellationToken cancellationToken = default)
            => await QueryResponsesAsync(actorUserId, query, requireForm: formId, cancellationToken);

        private async Task<EvaluationResponseListResponse> QueryResponsesAsync(int? actorUserId, EvaluationResponseListQuery query, int? requireForm, CancellationToken cancellationToken)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "evaluations.view", cancellationToken);
            var scope = await HrPortalHelpers.ResolveGymScopeAsync(_unitOfWork, _userAccess, actor, query.Gym, cancellationToken);

            int? formFilter = query.FormId;
            if (requireForm is int requiredForm)
            {
                var form = await _unitOfWork.GetRepository<EvaluationForm, int>()
                    .GetByIdAsync(new EvaluationFormByIdSpec(requiredForm), cancellationToken);
                if (form is null)
                {
                    throw new NotFoundException("Evaluation form not found.");
                }

                formFilter = requiredForm;
            }

            var page = Math.Max(query.Page, 1);
            var pageSize = HrPortalHelpers.NormalizePageSize(query.PageSize);

            var countSpec = new EvaluationResponsesSpec(scope, query.Gym, query.EmployeeId, formFilter, query.Period, query.Status, 0, 0);
            var total = await _unitOfWork.GetRepository<EvaluationResponse, int>().CountAsync(countSpec, cancellationToken);
            var rows = (await _unitOfWork.GetRepository<EvaluationResponse, int>()
                .GetAllAsync(new EvaluationResponsesSpec(scope, query.Gym, query.EmployeeId, formFilter, query.Period, query.Status, (page - 1) * pageSize, pageSize), cancellationToken))
                .ToList();

            var answersByResponse = await LoadAnswersAsync(rows.Select(r => r.Id).ToArray(), cancellationToken);

            return new EvaluationResponseListResponse
            {
                Items = rows.Select(r => MapResponse(r, answersByResponse.GetValueOrDefault(r.Id, []))).ToList(),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(total / (double)pageSize) : 0,
            };
        }

        public async Task<EmployeeEvaluationResponse> GetEmployeeEvaluationsAsync(int? actorUserId, int employeeId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "evaluations.view", cancellationToken);

            var employee = await _unitOfWork.GetRepository<Employee, int>()
                .GetByIdAsync(new EmployeeProfileByIdSpec(employeeId), cancellationToken);
            if (employee is null)
            {
                throw new NotFoundException("Employee not found.");
            }

            await HrPortalHelpers.ResolveGymScopeAsync(_unitOfWork, _userAccess, actor, employee.GymId, cancellationToken);

            var rows = await _unitOfWork.GetRepository<EvaluationResponse, int>()
                .GetAllAsync(new EmployeeResponsesSpec(employeeId), cancellationToken);

            return new EmployeeEvaluationResponse
            {
                Items = rows.Select(r => new EmployeeEvaluationItem
                {
                    Id = r.Id,
                    Employee = r.Employee.FullName,
                    Position = employee.Position?.Title ?? string.Empty,
                    Period = r.Period,
                    Score = r.Score,
                    Result = DeriveResult(r.Score, r.Status),
                    Status = r.Status,
                    Gym = r.Employee.Gym?.Name ?? "All",
                    Form = r.EvaluationForm.Name,
                    FormId = r.EvaluationFormId,
                }).ToList(),
            };
        }

        public async Task<PerformanceCycleResponse> GetPerformanceCyclesAsync(int? actorUserId, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "evaluations.view", cancellationToken);

            var cycles = await _unitOfWork.GetRepository<PerformanceCycle, int>().GetAllAsync(cancellationToken);

            return new PerformanceCycleResponse
            {
                Items = cycles
                    .OrderByDescending(c => c.StartDate)
                    .Select(c => new PerformanceCycleItem
                    {
                        Id = c.Id,
                        Name = c.Name,
                        Start = c.StartDate,
                        End = c.EndDate,
                        Status = c.Status,
                    }).ToList(),
            };
        }

        // ==================================================================
        // Goals (§5.4)
        // ==================================================================

        public async Task<GoalListResponse> GetGoalsAsync(int? actorUserId, GoalListQuery query, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "evaluations.view", cancellationToken);

            var page = Math.Max(query.Page, 1);
            var pageSize = HrPortalHelpers.NormalizePageSize(query.PageSize);

            var total = await _unitOfWork.GetRepository<Goal, int>().CountAsync(new GoalsListSpec(0, 0), cancellationToken);
            var rows = await _unitOfWork.GetRepository<Goal, int>()
                .GetAllAsync(new GoalsListSpec((page - 1) * pageSize, pageSize), cancellationToken);

            return new GoalListResponse
            {
                Items = rows.Select(MapGoal).ToList(),
                Page = page,
                PageSize = pageSize,
                Total = total,
                TotalPages = pageSize > 0 ? (int)Math.Ceiling(total / (double)pageSize) : 0,
            };
        }

        public async Task<GoalResponse> CreateGoalAsync(int? actorUserId, CreateGoalRequest request, CancellationToken cancellationToken = default)
        {
            var actor = await HrPortalHelpers.ResolveActorAsync(_unitOfWork, actorUserId, cancellationToken);
            await _accessControl.EnsurePermissionAsync(actor.Id, "evaluations.manage", cancellationToken);

            var title = HrPortalHelpers.NullIfBlank(request.Title)
                ?? throw new BadRequestException("Goal title is required.");

            DateOnly? due = null;
            if (HrPortalHelpers.NullIfBlank(request.Due) is string rawDue)
            {
                if (!DateOnly.TryParse(rawDue, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDue))
                {
                    throw new BadRequestException("due must be a valid date (yyyy-MM-dd).");
                }

                due = parsedDue;
            }

            // The editor types a display name — resolve it when exactly one employee matches.
            var employeeName = HrPortalHelpers.NullIfBlank(request.Employee) ?? string.Empty;
            int? employeeId = null;
            if (employeeName.Length > 0)
            {
                var employees = await _unitOfWork.GetRepository<Employee, int>().GetAllAsync(cancellationToken);
                var matches = employees
                    .Where(e => string.Equals(e.FullName.Trim(), employeeName, StringComparison.OrdinalIgnoreCase))
                    .ToList();
                if (matches.Count == 1)
                {
                    employeeId = matches[0].Id;
                }
            }

            var goal = new Goal
            {
                EmployeeId = employeeId,
                EmployeeName = employeeName,
                Title = title,
                Status = "On Track",
                Progress = 0,
                DueDate = due,
                Owner = HrPortalHelpers.NullIfBlank(request.Owner) ?? HrPortalHelpers.DisplayName(actor),
            };

            await _unitOfWork.GetRepository<Goal, int>().AddAsync(goal, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return new GoalResponse { Data = MapGoal(goal) };
        }

        // ==================================================================
        // Helpers
        // ==================================================================

        private async Task<(string Name, string Status, string? Target, int? GymId)> ValidateFormAsync(
            User actor, UpsertEvaluationFormRequest request, CancellationToken cancellationToken)
        {
            var name = HrPortalHelpers.NullIfBlank(request.Name)
                ?? throw new BadRequestException("Form name is required.");
            var status = NormalizeStatus(request.Status, ["Active", "Completed", "Inactive"], "Active");

            var target = HrPortalHelpers.NullIfBlank(request.Target) ?? HrPortalHelpers.NullIfBlank(request.Position);
            if (target is not null && target.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                target = null;
            }

            var gymId = await ResolveOptionalGymAsync(actor, request.GymId, request.Gym, cancellationToken);
            return (name, status, target, gymId);
        }

        private async Task<(string Name, string Status, string? Position, int? GymId)> ValidateHiringFormAsync(
            User actor, UpsertHiringFormRequest request, CancellationToken cancellationToken)
        {
            var name = HrPortalHelpers.NullIfBlank(request.Name)
                ?? throw new BadRequestException("Form name is required.");
            var status = NormalizeStatus(request.Status, ["Open", "Closed"], "Open");

            var position = HrPortalHelpers.NullIfBlank(request.Position);
            if (position is not null && position.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                position = null;
            }

            var gymId = await ResolveOptionalGymAsync(actor, request.GymId, request.Gym, cancellationToken);
            return (name, status, position, gymId);
        }

        private async Task<int?> ResolveOptionalGymAsync(User actor, int? gymId, string? gymName, CancellationToken cancellationToken)
        {
            if (gymId.HasValue)
            {
                return (await HrPortalHelpers.ResolveGymAsync(_unitOfWork, _userAccess, actor, gymId, null, cancellationToken)).Id;
            }

            var name = HrPortalHelpers.NullIfBlank(gymName);
            if (name is null || name.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            return (await HrPortalHelpers.ResolveGymAsync(_unitOfWork, _userAccess, actor, null, name, cancellationToken)).Id;
        }

        /// <summary>Editor validation: ≥ 1 question, choice questions ≥ 2 options, known types.</summary>
        private static List<(EvaluationQuestionType Type, string Text, List<string> Options)> NormalizeQuestionInputs(List<FormQuestionInput>? inputs)
        {
            if (inputs is null || inputs.Count == 0)
            {
                throw new BadRequestException("Add at least one question.");
            }

            var normalized = new List<(EvaluationQuestionType, string, List<string>)>();
            foreach (var input in inputs)
            {
                var type = ParseUiQuestionType(input.Type);
                var text = HrPortalHelpers.NullIfBlank(input.Text)
                    ?? throw new BadRequestException("Each question needs its text.");
                var options = new List<string>();
                if (type != EvaluationQuestionType.Rating5)
                {
                    options = (input.Options ?? [])
                        .Select(o => (o ?? string.Empty).Trim())
                        .Where(o => o.Length > 0)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();
                    if (options.Count < 2)
                    {
                        throw new BadRequestException("Choice questions need at least two options.");
                    }
                }

                normalized.Add((type, text, options));
            }

            return normalized;
        }

        /// <summary>UI vocabulary → stored question type (text = rating, no options).</summary>
        private static EvaluationQuestionType ParseUiQuestionType(string? type) =>
            (type ?? "text").Trim().ToLowerInvariant() switch
            {
                "" or "text" => EvaluationQuestionType.Rating5,
                "choose" => EvaluationQuestionType.MultipleChoice,
                "checkbox" => EvaluationQuestionType.Checkbox,
                _ => throw new BadRequestException("Unknown question type — use text, choose, or checkbox."),
            };

        private static string ToUiQuestionType(EvaluationQuestionType type) => type switch
        {
            EvaluationQuestionType.MultipleChoice => "choose",
            EvaluationQuestionType.Checkbox => "checkbox",
            _ => "text",
        };

        private static string NormalizeStatus(string? status, string[] allowed, string fallback)
        {
            var clean = HrPortalHelpers.NullIfBlank(status) ?? fallback;
            return allowed.Contains(clean, StringComparer.OrdinalIgnoreCase)
                ? allowed.First(a => string.Equals(a, clean, StringComparison.OrdinalIgnoreCase))
                : throw new BadRequestException($"status must be one of: {string.Join(" | ", allowed)}.");
        }

        private static bool MatchesPosition(EvaluationForm form, Employee employee)
        {
            var wanted = HrPortalHelpers.NullIfBlank(form.Target) ?? form.Position?.Title;
            if (wanted is null)
            {
                return true;
            }

            return employee.Position is not null &&
                   string.Equals(employee.Position.Title.Trim(), wanted.Trim(), StringComparison.OrdinalIgnoreCase);
        }

        private async Task<Employee> ResolveSubjectAsync(User actor, SubmitEvaluationRequest request, CancellationToken cancellationToken)
        {
            Employee? subject;
            if (request.EmployeeId is int employeeId)
            {
                subject = await _unitOfWork.GetRepository<Employee, int>()
                    .GetByIdAsync(new EmployeeProfileByIdSpec(employeeId), cancellationToken);
                if (subject is null)
                {
                    throw new NotFoundException("Employee not found.");
                }

                if (subject.Status != EmployeeStatus.Active)
                {
                    throw new BadRequestException("Only active employees can be evaluated.");
                }
            }
            else
            {
                var name = HrPortalHelpers.NullIfBlank(request.Employee)
                    ?? throw new BadRequestException("Pick the employee being evaluated.");
                var active = await _unitOfWork.GetRepository<Employee, int>()
                    .GetAllAsync(new ActiveEmployeesForFormSpec(), cancellationToken);
                var matches = active
                    .Where(e => string.Equals(e.FullName.Trim(), name, StringComparison.OrdinalIgnoreCase))
                    .ToList();
                switch (matches.Count)
                {
                    case 0:
                        throw new BadRequestException($"No active employee named \"{name}\" was found.");
                    case > 1:
                        throw new BadRequestException($"Multiple employees are named \"{name}\" — send the employee id instead.");
                    default:
                        subject = matches[0];
                        break;
                }
            }

            var scope = await HrPortalHelpers.ResolveGymScopeAsync(_unitOfWork, _userAccess, actor, null, cancellationToken);
            if (actor.UserType != UserType.TopManagement && !scope.Contains(subject.GymId))
            {
                throw new UnAuthorizedException("You are not assigned to this gym.");
            }

            return subject;
        }

        private async Task<Dictionary<int, List<EvaluationAnswerItem>>> LoadAnswersAsync(int[] responseIds, CancellationToken cancellationToken)
        {
            var map = new Dictionary<int, List<EvaluationAnswerItem>>();
            if (responseIds.Length == 0)
            {
                return map;
            }

            var rows = await _unitOfWork.GetRepository<EvaluationAnswer, int>()
                .GetAllAsync(new AnswersByResponsesSpec(responseIds), cancellationToken);
            foreach (var group in rows.GroupBy(a => a.EvaluationResponseId))
            {
                map[group.Key] = group
                    .OrderBy(a => a.EvaluationQuestion.SortOrder)
                    .Select(a => new EvaluationAnswerItem
                    {
                        Question = a.EvaluationQuestion.QuestionText,
                        Type = ToUiQuestionType(a.EvaluationQuestion.QuestionType),
                        Answer = DecodeAnswer(a.AnswerValueJson),
                    }).ToList();
            }

            return map;
        }

        private async Task<Dictionary<int, int>> CountApplicantsAsync(int[] formIds, CancellationToken cancellationToken)
        {
            if (formIds.Length == 0)
            {
                return [];
            }

            var rows = await _unitOfWork.GetRepository<HiringFormApplication, int>()
                .GetAllAsync(new ApplicationsByFormsSpec(formIds), cancellationToken);
            return rows.GroupBy(a => a.HiringFormId).ToDictionary(g => g.Key, g => g.Count());
        }

        private static AssignmentItem BuildAssignmentGroup(
            User evaluator,
            EvaluationForm form,
            IReadOnlyList<EvaluationAssignment> rows,
            IReadOnlyDictionary<int, string> subjectNames,
            string dispatchedBy)
        {
            var ordered = rows.OrderBy(r => r.Id).ToList();
            var nameOf = (int employeeId) => subjectNames.GetValueOrDefault(employeeId, $"Employee {employeeId}");

            return new AssignmentItem
            {
                Id = ordered[0].Id,
                FormId = form.Id,
                FormName = form.Name,
                EvaluatorEmail = evaluator.Email,
                EvaluatorName = HrPortalHelpers.DisplayName(evaluator),
                Subjects = ordered.Select(r => nameOf(r.EmployeeId)).ToList(),
                CompletedSubjects = ordered.Where(r => r.Status == "Completed")
                    .Select(r => nameOf(r.EmployeeId)).ToList(),
                Status = ordered.All(r => r.Status == "Completed") ? "Completed" : "Assigned",
                DispatchedDate = ordered.Min(r => r.AssignedAt),
                DispatchedBy = dispatchedBy,
            };
        }

        private static EvaluationFormItem MapForm(EvaluationForm form) => new()
        {
            Id = form.Id,
            Name = form.Name,
            Position = HrPortalHelpers.NullIfBlank(form.Target) ?? form.Position?.Title ?? "All",
            Target = form.Target,
            Gym = form.Gym?.Name ?? "All",
            Status = form.Status,
            Questions = form.Questions?.Count ?? 0,
            QuestionList = (form.Questions ?? [])
                .OrderBy(q => q.SortOrder)
                .Select(q => new FormQuestionItem
                {
                    Type = ToUiQuestionType(q.QuestionType),
                    Text = q.QuestionText,
                    Options = ParseOptionsJson(q.OptionsJson),
                }).ToList(),
            CreatedDate = form.CreatedDate,
            LastUsed = form.LastUsedAt,
            Submissions = form.Responses?.Count ?? 0,
        };

        private static HiringFormItem MapHiringForm(HiringForm form, int applicants)
        {
            var questionList = ParseHiringQuestions(form.QuestionsJson);
            return new HiringFormItem
            {
                Id = form.Id,
                Name = form.Name,
                Position = form.Position,
                Gym = form.Gym?.Name ?? "All",
                Status = form.Status,
                Questions = questionList.Count,
                QuestionList = questionList,
                CreatedDate = form.CreatedDate,
                LastUsed = form.LastUsedAt,
                Applicants = applicants,
            };
        }

        private static EvaluationResponseItem MapResponse(EvaluationResponse row, IReadOnlyList<EvaluationAnswerItem> answers) => new()
        {
            Id = row.Id,
            Employee = row.Employee.FullName,
            Form = row.EvaluationForm.Name,
            FormId = row.EvaluationFormId,
            Period = row.Period,
            Score = row.Score,
            Status = row.Status,
            Notes = row.Notes,
            ReviewedBy = HrPortalHelpers.DisplayName(row.Evaluator),
            ReviewedDate = row.SubmittedAt,
            Answers = answers.ToList(),
            Gym = row.Employee.Gym?.Name ?? "All",
        };

        private static GoalItem MapGoal(Goal goal) => new()
        {
            Id = goal.Id,
            Employee = goal.Employee?.FullName ?? goal.EmployeeName,
            Title = goal.Title,
            Status = goal.Status,
            Progress = goal.Progress,
            Due = goal.DueDate,
            Owner = goal.Owner,
        };

        /// <summary>≥ 60 → Pass, below → Below Target, no score yet → Pending.</summary>
        private static string DeriveResult(decimal? score, string status) =>
            score is null
                ? (status == "Completed" ? "—" : "Pending")
                : score >= 60 ? "Pass" : "Below Target";

        private static string SerializeHiringQuestions(List<(EvaluationQuestionType Type, string Text, List<string> Options)> questions) =>
            JsonSerializer.Serialize(questions.Select(q => new
            {
                type = ToUiQuestionType(q.Type),
                text = q.Text,
                options = q.Options,
            }));

        private static List<string> ParseOptionsJson(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return [];
            }

            try
            {
                return JsonSerializer.Deserialize<List<string>>(json) ?? [];
            }
            catch (JsonException)
            {
                return [];
            }
        }

        private static List<FormQuestionItem> ParseHiringQuestions(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return [];
            }

            try
            {
                return JsonSerializer.Deserialize<List<FormQuestionItem>>(json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
            }
            catch (JsonException)
            {
                return [];
            }
        }

        /// <summary>Answers live in a jsonb column — quoted on write, unwrapped on read.</summary>
        private static string DecodeAnswer(string json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return string.Empty;
            }

            try
            {
                using var doc = JsonDocument.Parse(json);
                return doc.RootElement.ValueKind == JsonValueKind.String
                    ? doc.RootElement.GetString() ?? string.Empty
                    : json;
            }
            catch (JsonException)
            {
                return json;
            }
        }

        /// <summary>permission key A **or** B **or** … (the inbox allows any of the four).</summary>
        private async Task EnsureAnyPermissionAsync(User actor, string[] keys, CancellationToken cancellationToken)
        {
            foreach (var key in keys)
            {
                try
                {
                    await _accessControl.EnsurePermissionAsync(actor.Id, key, cancellationToken);
                    return;
                }
                catch (UnAuthorizedException)
                {
                    // try the next acceptable key
                }
            }

            throw new UnAuthorizedException("You do not have permission to perform this action.");
        }
    }
}
