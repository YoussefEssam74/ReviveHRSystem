using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.RecruitmentModule;
using DomainLayer.Models.RecruitmentModule.Enums;
using DomainLayer.Models.SchedulingModule;
using DomainLayer.Models.SchedulingModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Presistence.Data;
using ServiceAbstraction.Services;

namespace ReviveHRSystem.IntegrationTests.Support
{
    public sealed record TestGym(int GymId, string StationCode, string Name);

    public sealed record TestEmployee(int EmployeeId, string EmployeeNumber, int UserId, string Email, string Password, string FullName = "");

    /// <summary>A login-capable user account with no employee profile (HR, TopManagement, …).</summary>
    public sealed record TestUser(int UserId, string Email, string Password);

    /// <summary>
    /// Per-test data factory. Every test that mutates state creates its own gym /
    /// station code / employees so tests never depend on each other (test isolation).
    /// </summary>
    public sealed class TestDataBuilder
    {
        private readonly ReviveHrDbContext _db;
        private readonly IPasswordHasher _hasher;
        private readonly TimeZoneInfo _attendanceTimeZone;
        private readonly Random _random = new();

        public TestDataBuilder(IServiceProvider services)
        {
            _db = services.GetRequiredService<ReviveHrDbContext>();
            _hasher = services.GetRequiredService<IPasswordHasher>();
            _attendanceTimeZone = services.GetRequiredService<TimeZoneInfo>();
        }

        /// <summary>
        /// Today's date in the app's configured attendance timezone. Shift assignments must
        /// use the same date the service derives from event timestamps, otherwise events
        /// would resolve to "no shift scheduled" around midnight.
        /// </summary>
        public DateOnly AttendanceToday =>
            DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _attendanceTimeZone));

        public async Task<TestGym> CreateGymWithStationAsync()
        {
            var suffix = UniqueSuffix();
            var gym = new Gym
            {
                Name = $"IT Gym {suffix}",
                Location = "Test",
                ShiftCycleLengthDays = 10,
                Status = GymStatus.Active
            };
            _db.Gyms.Add(gym);
            await _db.SaveChangesAsync();

            var code = await CreateUniqueStationCodeAsync(gym.Id);
            return new TestGym(gym.Id, code, gym.Name);
        }

        /// <summary>
        /// Creates a user + employee. <paramref name="accessGyms"/> controls UserGymAccess rows;
        /// when <paramref name="shiftAtGym"/> is set, a published cycle covering today and a shift
        /// assignment for today are created at that gym.
        /// </summary>
        public async Task<TestEmployee> CreateEmployeeAsync(
            TestGym homeGym,
            IReadOnlyList<TestGym>? accessGyms = null,
            TestGym? shiftAtGym = null,
            string? password = null)
        {
            var suffix = UniqueSuffix();
            var email = $"itest-{suffix}@test.local".ToLowerInvariant();
            var plainPassword = password ?? DevelopmentDataSeederEmployeePassword;

            var user = new User
            {
                Email = email,
                UserName = $"itest-{suffix}".ToLowerInvariant(),
                PasswordHash = _hasher.Hash(DevelopmentDataSeederEmployeePassword),
                UserType = UserType.Employee,
                IsActive = true
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();
            var position = await _db.Positions.FirstOrDefaultAsync(p => p.GymId == homeGym.GymId && p.Title == "IT Tester")
                ?? new Position { GymId = homeGym.GymId, Title = "IT Tester", Level = "1", IsActive = true };
            if (position.Id == 0)
            {
                _db.Positions.Add(position);
                await _db.SaveChangesAsync();
            }

            var hireDate = DateOnly.FromDateTime(DateTime.Now.AddDays(-7));
            var employeeNumber = $"IT-{suffix}";
            var employee = new Employee
            {
                UserId = user.Id,
                GymId = homeGym.GymId,
                PositionId = position.Id,
                FullName = $"IT Employee {suffix}",
                EmployeeNumber = employeeNumber,
                HireDate = hireDate,
                ContractType = "FullTime",
                ContractStartDate = hireDate,
                Status = EmployeeStatus.Active
            };
            _db.Employees.Add(employee);
            await _db.SaveChangesAsync();

            foreach (var gym in accessGyms ?? new[] { homeGym })
            {
                if (!await _db.UserGymAccesses.AnyAsync(a => a.UserId == user.Id && a.GymId == gym.GymId))
                {
                    _db.UserGymAccesses.Add(new UserGymAccess { UserId = user.Id, GymId = gym.GymId });
                }
            }

            await _db.SaveChangesAsync();

            if (shiftAtGym is not null)
            {
                await AssignShiftTodayAsync(employee.Id, shiftAtGym.GymId);
            }

            return new TestEmployee(employee.Id, employeeNumber, user.Id, email, plainPassword, employee.FullName);
        }

        /// <summary>Sets an employee's current-year leave balance row (used by the requests payment tests).</summary>
        public async Task SetLeaveBalanceAsync(int employeeId, decimal total, decimal used = 0, LeaveType leaveType = LeaveType.Annual)
        {
            var year = DateTime.UtcNow.Year;
            var row = await _db.LeaveBalances
                .FirstOrDefaultAsync(b => b.EmployeeId == employeeId && b.Year == year && b.LeaveType == leaveType);
            if (row is null)
            {
                row = new LeaveBalance
                {
                    EmployeeId = employeeId,
                    LeaveType = leaveType,
                    Year = year,
                    TotalEntitlement = total,
                    UsedDays = used,
                    PendingDays = 0
                };
                _db.LeaveBalances.Add(row);
            }
            else
            {
                row.TotalEntitlement = total;
                row.UsedDays = used;
            }

            await _db.SaveChangesAsync();
        }

        /// <summary>
        /// Creates a login-capable user account with no employee profile, plus the given
        /// UserGymAccess rows — used to authenticate as HR (or any other) principal.
        /// </summary>
        public async Task<TestUser> CreateUserAsync(UserType userType, IReadOnlyList<TestGym> accessGyms, string? password = null)
        {
            var suffix = UniqueSuffix();
            var email = $"ittest-{suffix}@test.local".ToLowerInvariant();
            var plainPassword = password ?? DevelopmentDataSeederEmployeePassword;

            var user = new User
            {
                Email = email,
                UserName = $"ittest-{suffix}".ToLowerInvariant(),
                PasswordHash = _hasher.Hash(plainPassword),
                UserType = userType,
                IsActive = true
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            foreach (var gym in accessGyms)
            {
                if (!await _db.UserGymAccesses.AnyAsync(a => a.UserId == user.Id && a.GymId == gym.GymId))
                {
                    _db.UserGymAccesses.Add(new UserGymAccess { UserId = user.Id, GymId = gym.GymId });
                }
            }

            await _db.SaveChangesAsync();

            return new TestUser(user.Id, email, plainPassword);
        }

        /// <summary>
        /// Attaches an employee profile to an ALREADY-CREATED user (HR/HRM staff have
        /// profiles of their own — the matrix's actor-based row-22 contact writes
        /// depend on it, as does every "own record" self-service surface).
        /// </summary>
        public async Task<TestEmployee> AttachEmployeeProfileAsync(
            TestUser user,
            TestGym homeGym,
            string? fullName = null)
        {
            var suffix = UniqueSuffix();
            var position = await _db.Positions.FirstOrDefaultAsync(p => p.GymId == homeGym.GymId && p.Title == "IT Tester")
                ?? new Position { GymId = homeGym.GymId, Title = "IT Tester", Level = "1", IsActive = true };
            if (position.Id == 0)
            {
                _db.Positions.Add(position);
                await _db.SaveChangesAsync();
            }

            var hireDate = DateOnly.FromDateTime(DateTime.Now.AddDays(-7));
            var employeeNumber = $"IT-{suffix}";
            var employee = new Employee
            {
                UserId = user.UserId,
                GymId = homeGym.GymId,
                PositionId = position.Id,
                FullName = fullName ?? $"IT Employee {suffix}",
                EmployeeNumber = employeeNumber,
                HireDate = hireDate,
                ContractType = "FullTime",
                ContractStartDate = hireDate,
                Status = EmployeeStatus.Active
            };
            _db.Employees.Add(employee);
            await _db.SaveChangesAsync();

            return new TestEmployee(employee.Id, employeeNumber, user.UserId, user.Email, user.Password, employee.FullName);
        }

        public Task AssignShiftTodayAsync(int employeeId, int gymId) =>
            AssignShiftAsync(employeeId, gymId, AttendanceToday, "IT Morning", new TimeOnly(8, 0), new TimeOnly(16, 0));

        /// <summary>
        /// Publishes a cycle covering <paramref name="date"/> (reusing one when it fits) and
        /// assigns the named template to the employee for that date. Overnight shifts are
        /// supported: pass an EndTime before the StartTime (e.g. 22:00 → 05:00).
        /// </summary>
        public async Task AssignShiftAsync(
            int employeeId,
            int gymId,
            DateOnly date,
            string templateName,
            TimeOnly startTime,
            TimeOnly endTime)
        {
            var template = await _db.ShiftTemplates.FirstOrDefaultAsync(t => t.GymId == gymId && t.Name == templateName)
                ?? new ShiftTemplate
                {
                    GymId = gymId,
                    Name = templateName,
                    StartTime = startTime,
                    EndTime = endTime,
                    IsActive = true
                };
            if (template.Id == 0)
            {
                _db.ShiftTemplates.Add(template);
                await _db.SaveChangesAsync();
            }

            var cycle = await _db.ShiftCycles.FirstOrDefaultAsync(c =>
                c.GymId == gymId && c.StartDate <= date && c.EndDate >= date);
            if (cycle is null)
            {
                cycle = new ShiftCycle
                {
                    GymId = gymId,
                    StartDate = date,
                    EndDate = date.AddDays(9),
                    Status = ShiftCycleStatus.Published,
                    PublishedAt = DateTime.UtcNow
                };
                _db.ShiftCycles.Add(cycle);
                await _db.SaveChangesAsync();
            }

            _db.ShiftAssignments.Add(new ShiftAssignment
            {
                ShiftCycleId = cycle.Id,
                EmployeeId = employeeId,
                Date = date,
                ShiftTemplateId = template.Id
            });
            await _db.SaveChangesAsync();
        }

        /// <summary>Grants a permission key directly to the user (creates the Permission row when missing).</summary>
        public async Task GrantPermissionAsync(int userId, string permissionKey, string area = "test")
        {
            var permission = await _db.Permissions.FirstOrDefaultAsync(p => p.Key == permissionKey);
            if (permission is null)
            {
                permission = new Permission
                {
                    Key = permissionKey,
                    Area = area,
                    Description = $"Granted by {nameof(GrantPermissionAsync)}",
                    IsSystem = false
                };
                _db.Permissions.Add(permission);
                await _db.SaveChangesAsync();
            }

            if (!await _db.UserPermissions.AnyAsync(up => up.UserId == userId && up.PermissionId == permission.Id))
            {
                _db.UserPermissions.Add(new UserPermission { UserId = userId, PermissionId = permission.Id });
                await _db.SaveChangesAsync();
            }
        }

        /// <summary>Deactivates (or reactivates) a user account to exercise inactive-session rejections.</summary>
        public async Task SetUserActiveAsync(int userId, bool isActive)
        {
            var user = await _db.Users.FirstAsync(u => u.Id == userId);
            user.IsActive = isActive;
            await _db.SaveChangesAsync();
        }

        /// <summary>
        /// Inserts a stored attendance record for a (employee, day) pair — the A1/A4 tests
        /// assert against real rows rather than only derived grid days. Times are UTC.
        /// </summary>
        public async Task<int> CreateAttendanceRecordAsync(
            int employeeId,
            int gymId,
            DateOnly date,
            DateTime? checkInUtc = null,
            DateTime? checkOutUtc = null,
            AttendanceStatus status = AttendanceStatus.OnTime)
        {
            var record = new AttendanceRecord
            {
                EmployeeId = employeeId,
                GymId = gymId,
                Date = date,
                CheckInTime = checkInUtc,
                CheckOutTime = checkOutUtc,
                CheckInMethod = checkInUtc.HasValue ? AttendanceMethod.Biometric : null,
                CheckOutMethod = checkOutUtc.HasValue ? AttendanceMethod.Biometric : null,
                Status = status
            };
            _db.AttendanceRecords.Add(record);
            await _db.SaveChangesAsync();
            return record.Id;
        }

        /// <summary>Inserts an approved Day Off request covering [start, end] (inclusive).</summary>
        public async Task<int> CreateApprovedDayOffAsync(int employeeId, DateOnly start, DateOnly end)
        {
            var request = new DomainLayer.Models.RequestModule.EmployeeRequest
            {
                EmployeeId = employeeId,
                Type = "Day Off",
                RequestDate = start,
                TargetStartDate = start,
                TargetEndDate = end,
                Details = "Integration-test day off",
                Status = DomainLayer.Models.RequestModule.Enums.RequestStatus.Approved
            };
            _db.EmployeeRequests.Add(request);
            await _db.SaveChangesAsync();
            return request.Id;
        }

        /// <summary>Inserts a shift template at the gym (template CRUD is org-settings scope, no HR API).</summary>
        public async Task<int> CreateShiftTemplateAsync(TestGym gym, string name, TimeOnly start, TimeOnly end, bool isActive = true)
        {
            var template = new ShiftTemplate
            {
                GymId = gym.GymId,
                Name = name,
                StartTime = start,
                EndTime = end,
                IsActive = isActive
            };
            _db.ShiftTemplates.Add(template);
            await _db.SaveChangesAsync();
            return template.Id;
        }

        /// <summary>Adds a raw assignment row to an existing cycle (null templateId = explicit Off).</summary>
        public async Task AddShiftAssignmentAsync(int cycleId, int employeeId, DateOnly date, int? templateId)
        {
            _db.ShiftAssignments.Add(new ShiftAssignment
            {
                ShiftCycleId = cycleId,
                EmployeeId = employeeId,
                Date = date,
                ShiftTemplateId = templateId
            });
            await _db.SaveChangesAsync();
        }

        // ------------------------------------------------------------------
        // Recruitment (api-spec-from-ui.md §5.1)
        // ------------------------------------------------------------------

        public sealed record TestVacancy(int VacancyId, string Title);

        public sealed record TestApplication(int ApplicationId, int CandidateId, string CandidateName);

        /// <summary>Creates a vacancy at the gym (resolving/creating the position row).</summary>
        public async Task<TestVacancy> CreateVacancyAsync(
            TestGym gym,
            string title = "IT Trainer",
            VacancyStatus status = VacancyStatus.Open,
            int headcount = 1,
            string? urgency = "Medium")
        {
            var position = await _db.Positions.FirstOrDefaultAsync(p => p.GymId == gym.GymId && p.Title == title)
                ?? new Position { GymId = gym.GymId, Title = title, Level = "1", IsActive = true };
            if (position.Id == 0)
            {
                _db.Positions.Add(position);
                await _db.SaveChangesAsync();
            }

            var vacancy = new Vacancy
            {
                GymId = gym.GymId,
                PositionId = position.Id,
                Title = title,
                Description = "Integration-test vacancy",
                Requirements = "None",
                HeadcountNeeded = headcount,
                PublicLinkToken = $"vac-it-{UniqueSuffix()}",
                Status = status,
                Urgency = urgency,
            };
            _db.Vacancies.Add(vacancy);
            await _db.SaveChangesAsync();
            return new TestVacancy(vacancy.Id, title);
        }

        /// <summary>
        /// Creates a candidate + application pipeline entry at the vacancy's gym.
        /// <paramref name="stage"/>/<paramref name="status"/> seed the pipeline state.
        /// </summary>
        public async Task<TestApplication> CreateApplicationAsync(
            TestVacancy vacancy,
            int? gymId = null,
            string? candidateName = null,
            PipelineStageType stage = PipelineStageType.Applied,
            ApplicationStatus status = ApplicationStatus.InProgress,
            string? positionTitle = null)
        {
            var suffix = UniqueSuffix();
            var name = candidateName ?? $"IT Candidate {suffix}";
            var candidate = new Candidate
            {
                FullName = name,
                Email = $"itcand-{suffix}@test.local".ToLowerInvariant(),
                Phone = $"+20100{_random.Next(1000000, 9999999)}",
                DateOfBirth = new DateOnly(1995, 1, 1),
                NationalId = $"IT-NAT-{suffix}",
                SkillsJson = """["Face ID","Sales"]""",
            };
            _db.Candidates.Add(candidate);
            await _db.SaveChangesAsync();

            var application = new Application
            {
                VacancyId = vacancy.VacancyId,
                CandidateId = candidate.Id,
                AppliedDate = DateTime.UtcNow,
                CurrentStage = stage,
                Status = status,
                Source = "Job board",
                LanguagesJson = """["Arabic","English"]""",
                LastActivityAt = DateTime.UtcNow,
            };
            _db.Applications.Add(application);
            await _db.SaveChangesAsync();

            _ = gymId;
            _ = positionTitle;
            return new TestApplication(application.Id, candidate.Id, name);
        }

        /// <summary>Parks an application on the waiting list (WaitingList status).</summary>
        public async Task<TestApplication> CreateWaitingApplicationAsync(TestVacancy vacancy, string? note = null)
        {
            var application = await CreateApplicationAsync(vacancy, status: ApplicationStatus.WaitingList);
            if (note is not null)
            {
                var entity = await _db.Applications.FirstAsync(a => a.Id == application.ApplicationId);
                entity.Notes = note;
                await _db.SaveChangesAsync();
            }

            return application;
        }

        /// <summary>Backdates an application's last-activity clock (follow-up staleness tests).</summary>
        public async Task MakeApplicationStaleAsync(int applicationId, int days = 10)
        {
            var application = await _db.Applications.FirstAsync(a => a.Id == applicationId);
            application.LastActivityAt = DateTime.UtcNow.AddDays(-days);
            await _db.SaveChangesAsync();
        }

        // ------------------------------------------------------------------
        // Reports & audit (api-spec-from-ui.md §5.9)
        // ------------------------------------------------------------------

        /// <summary>Inserts an audit row directly (audit-log list/filter tests).</summary>
        public async Task<int> CreateAuditLogAsync(
            int? userId,
            string action,
            string entityType,
            int entityId,
            int? gymId = null,
            string? newValues = null,
            DateTime? timestamp = null)
        {
            var row = new DomainLayer.Models.AuditModule.AuditLog
            {
                UserId = userId,
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                NewValues = newValues,
                GymId = gymId,
                Timestamp = timestamp ?? DateTime.UtcNow,
            };
            _db.AuditLogs.Add(row);
            await _db.SaveChangesAsync();
            return row.Id;
        }

        // ------------------------------------------------------------------
        // Payroll (api-spec-from-ui.md §5.5)
        // ------------------------------------------------------------------

        /// <summary>Creates a payroll period row for a gym (Open by default).</summary>
        public async Task<int> CreatePayrollPeriodAsync(
            int gymId,
            DateOnly startDate,
            DateOnly endDate,
            DomainLayer.Models.PayrollModule.Enums.PayrollPeriodStatus status =
                DomainLayer.Models.PayrollModule.Enums.PayrollPeriodStatus.Open,
            DateOnly? paidDate = null)
        {
            var period = new DomainLayer.Models.PayrollModule.PayrollPeriod
            {
                GymId = gymId,
                StartDate = startDate,
                EndDate = endDate,
                Status = status,
                PaidDate = paidDate,
            };
            _db.PayrollPeriods.Add(period);
            await _db.SaveChangesAsync();
            return period.Id;
        }

        /// <summary>Creates a payroll entry (sheet) for an employee in a period.</summary>
        public async Task<int> CreatePayrollEntryAsync(
            int periodId,
            int employeeId,
            decimal baseSalary,
            decimal bonus = 0,
            decimal overtimeHours = 0,
            int daysWorked = 26,
            string status = "Draft")
        {
            var entry = new DomainLayer.Models.PayrollModule.PayrollEntry
            {
                PayrollPeriodId = periodId,
                EmployeeId = employeeId,
                BaseSalary = baseSalary,
                TotalBonuses = bonus,
                OvertimeHours = overtimeHours,
                DaysWorked = daysWorked,
                Status = status,
            };
            _db.PayrollEntries.Add(entry);
            await _db.SaveChangesAsync();
            return entry.Id;
        }

        /// <summary>Adds an earning/deduction line to a payroll entry.</summary>
        public async Task<int> AddPayrollLineAsync(
            int entryId,
            decimal amount,
            string status = "Approved",
            string source = "manager",
            string? reason = null,
            int? attendanceRecordId = null,
            int? requestRef = null)
        {
            var line = new DomainLayer.Models.PayrollModule.PayrollEntryLineItem
            {
                PayrollEntryId = entryId,
                Type = "Deduction",
                Label = reason ?? "Seeded deduction",
                Reason = reason,
                Source = source,
                Amount = amount,
                Status = status,
                EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow),
                AttendanceRecordId = attendanceRecordId,
                EmployeeRequestId = requestRef,
            };
            _db.PayrollEntryLineItems.Add(line);
            await _db.SaveChangesAsync();
            return line.Id;
        }

        // ------------------------------------------------------------------
        // Evaluations & form builder (api-spec-from-ui.md §5.3/§5.4)
        // ------------------------------------------------------------------

        /// <summary>Inserts an evaluator assignment row directly (keyless holder tests).</summary>
        public async Task<int> CreateEvaluationAssignmentAsync(
            int formId, int employeeId, int evaluatorUserId, int assignedBy, string status = "Assigned")
        {
            var row = new DomainLayer.Models.EvaluationModule.EvaluationAssignment
            {
                EvaluationFormId = formId,
                EmployeeId = employeeId,
                EvaluatorUserId = evaluatorUserId,
                AssignedBy = assignedBy,
                AssignedAt = DateTime.UtcNow,
                Status = status,
            };
            _db.EvaluationAssignments.Add(row);
            await _db.SaveChangesAsync();
            return row.Id;
        }

        /// <summary>Inserts an anonymous hiring-form submission (delete-block tests).</summary>
        public async Task<int> CreateHiringFormApplicationAsync(int hiringFormId, string? name = null)
        {
            var suffix = UniqueSuffix();
            var application = new DomainLayer.Models.RecruitmentModule.HiringFormApplication
            {
                HiringFormId = hiringFormId,
                Name = name ?? $"Applicant {suffix}",
                Email = $"applicant-{suffix}@test.local".ToLowerInvariant(),
                Phone = "+10000000000",
                AnswersJson = "[]",
            };
            _db.HiringFormApplications.Add(application);
            await _db.SaveChangesAsync();
            return application.Id;
        }

        /// <summary>
        /// Sets an employee's contract end date — no service ever writes ContractEndDate,
        /// so the events Contract Expiry tests set it directly.
        /// </summary>
        public async Task SetContractEndDateAsync(int employeeId, DateOnly endDate)
        {
            var employee = await _db.Employees.SingleAsync(e => e.Id == employeeId);
            employee.ContractEndDate = endDate;
            await _db.SaveChangesAsync();
        }

        /// <summary>Uploads an employee document row (events Document Expiry derivation).</summary>
        public async Task<int> AddEmployeeDocumentAsync(
            int employeeId,
            DocumentType type,
            string fileName,
            DateOnly? expiryDate,
            bool employeeEditable = false)
        {
            var document = new EmployeeDocument
            {
                EmployeeId = employeeId,
                Type = type,
                FileName = fileName,
                FilePath = $"/uploads/{fileName}",
                ExpiryDate = expiryDate,
                EmployeeEditable = employeeEditable,
            };
            _db.EmployeeDocuments.Add(document);
            await _db.SaveChangesAsync();
            return document.Id;
        }

        /// <summary>
        /// Seeds a pending employee action escalation (§9.4) — the out-of-scope E20
        /// create endpoint does not exist yet, so tests insert rows directly.
        /// </summary>
        public async Task<int> CreateActionRequestAsync(
            int gymId,
            int employeeId,
            string actionType,
            object proposedDetails,
            int requestedById,
            string justification = "Escalated by the branch",
            string status = "Pending")
        {
            var request = new ActionRequest
            {
                GymId = gymId,
                EmployeeId = employeeId,
                ActionType = actionType,
                ProposedDetailsJson = System.Text.Json.JsonSerializer.Serialize(
                    proposedDetails, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web)),
                Justification = justification,
                RequestedById = requestedById,
                Status = status,
                SubmittedDate = DateTime.UtcNow,
            };
            _db.ActionRequests.Add(request);
            await _db.SaveChangesAsync();
            return request.Id;
        }

        /// <summary>Clears/replaces an employee's contract end date to null (event-prune tests).</summary>
        public async Task ClearContractEndDateAsync(int employeeId)
        {
            var employee = await _db.Employees.SingleAsync(e => e.Id == employeeId);
            employee.ContractEndDate = null;
            await _db.SaveChangesAsync();
        }

        /// <summary>Seeds a pending vacancy requisition (events Vacancies tab derivation).</summary>
        public async Task<int> CreateVacancyRequestAsync(
            int gymId,
            int requestedBy,
            string? urgency = "High",
            string justification = "Headcount needed for the season",
            int headcount = 1)
        {
            var position = await _db.Positions.FirstOrDefaultAsync(p => p.GymId == gymId && p.Title == "IT Tester")
                ?? new Position { GymId = gymId, Title = "IT Tester", Level = "1", IsActive = true };
            if (position.Id == 0)
            {
                _db.Positions.Add(position);
                await _db.SaveChangesAsync();
            }

            var request = new VacancyRequest
            {
                GymId = gymId,
                PositionId = position.Id,
                RequestedBy = requestedBy,
                Justification = justification,
                Status = VacancyRequestStatus.Pending,
                Urgency = urgency,
                Headcount = headcount,
                SubmittedDate = DateTime.UtcNow,
            };
            _db.VacancyRequests.Add(request);
            await _db.SaveChangesAsync();
            return request.Id;
        }

        private async Task<string> CreateUniqueStationCodeAsync(int gymId)
        {
            for (var attempt = 0; attempt < 20; attempt++)
            {
                var candidate = _random.Next(0, 1_000_000).ToString("D6");
                if (!await _db.StationCodes.AnyAsync(sc => sc.Code == candidate))
                {
                    _db.StationCodes.Add(new StationCode
                    {
                        GymId = gymId,
                        Code = candidate,
                        IsActive = true,
                        GeneratedAt = DateTime.UtcNow
                    });
                    await _db.SaveChangesAsync();
                    return candidate;
                }
            }

            throw new InvalidOperationException("Could not generate a unique station code for the test.");
        }

        private static string UniqueSuffix() =>
            Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();

        // Reuses the seeded dev password so login helpers keep working for test users.
        private static string DevelopmentDataSeederEmployeePassword =>
            ReviveHRSystem.Web.DataSeed.DevelopmentDataSeeder.EmployeePassword;
    }
}
