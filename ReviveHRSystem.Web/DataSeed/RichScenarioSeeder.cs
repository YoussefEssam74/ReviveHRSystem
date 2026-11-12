using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.AttendanceModule.Enums;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EmployeeModule.Enums;
using DomainLayer.Models.EvaluationModule;
using DomainLayer.Models.EvaluationModule.Enums;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.NotificationModule.Enums;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.OrganizationModule.Enums;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.PayrollModule.Enums;
using DomainLayer.Models.RecruitmentModule;
using DomainLayer.Models.RecruitmentModule.Enums;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.RequestModule.Enums;
using DomainLayer.Models.SchedulingModule;
using DomainLayer.Models.SchedulingModule.Enums;
using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Microsoft.EntityFrameworkCore;
using Presistence.Data;
using ServiceAbstraction.Services;
using Shared.Authorization;

namespace ReviveHRSystem.Web.DataSeed
{
    /// <summary>
    /// Rich, deterministic Development-only scenario layered on top of the base
    /// DevelopmentDataSeeder so every HR-console module has realistic data to test
    /// against: a full staff roster across both branches (12 extra employees with
    /// profiles, departments, positions and teams), ~7 weeks of attendance history,
    /// three closed payroll months plus the open current one with pending lines and
    /// branch-raised candidates, the leave/overtime/swap request pipeline, two
    /// offboarding cases, a recruitment pipeline (vacancies, candidates, stages,
    /// interviews), evaluation forms with responses, announcements with fan-out
    /// notifications and the events inbox.
    ///
    /// Money/attendance values are deterministic (index-based patterns), never
    /// random, so re-seeding a wiped dev database always produces the same world.
    /// Idempotent: every section carries its own marker, the run-completeness
    /// check looks at the last artifacts (events + November cycle), and an
    /// interrupted run resumes and finishes on the next startup.
    /// </summary>
    public static class RichScenarioSeeder
    {
        /// <summary>
        /// Completion marker: the last artifacts the seeder writes. Checking these
        /// (instead of an early artifact) lets a partially-seeded run — e.g. one
        /// interrupted mid-way — resume and finish on the next startup; every
        /// section below is individually idempotent. (Events are not a valid
        /// marker: the app derives its own event queue from live data and prunes
        /// anything it did not derive, so seeded events never persist.)
        /// The attendance-through-Oct-31 marker forces one resume on databases
        /// seeded before the window was pinned to the scenario dates.
        /// </summary>
        private static async Task<bool> IsCompleteAsync(ReviveHrDbContext db) =>
            await db.ShiftCycles.AnyAsync(c => c.Label == "November 2026") &&
            await db.EvaluationResponses.AnyAsync() &&
            await db.VacancyRequests.AnyAsync(v => v.Justification == "Peak-season floor coverage") &&
            await db.ActionRequests.AnyAsync(a => a.Justification == "Requested by branch manager") &&
            await db.AttendanceRecords.AnyAsync(a => a.Date == new DateOnly(2026, 10, 31));

        /// <summary>Npgsql requires UTC for timestamptz; DateOnly.ToDateTime gives Unspecified.</summary>
        private static DateTime UtcAt(DateOnly date, TimeOnly time) =>
            DateTime.SpecifyKind(date.ToDateTime(time), DateTimeKind.Utc);

        /// <summary>
        /// Fills the current month's attendance up to yesterday for the seeded roster.
        /// Runs on every startup even when the scenario is complete, so the open payroll
        /// month always carries real day-level records (the settlement sheet derives its
        /// counters from them). Idempotent: days that already have a record are skipped.
        /// </summary>
        private static async Task TopUpCurrentMonthAttendanceAsync(ReviveHrDbContext db, ILogger logger)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var yesterday = today.AddDays(-1);
            var monthStart = new DateOnly(yesterday.Year, yesterday.Month, 1);
            if (yesterday < monthStart)
            {
                return;
            }

            var roster = await db.Employees
                .Where(e => e.Status != EmployeeStatus.Terminated)
                .OrderBy(e => e.Id)
                .ToListAsync();
            if (roster.Count == 0)
            {
                return;
            }

            var rosterIndex = roster.Select((e, i) => (e.Id, i))
                .ToDictionary(x => x.Id, x => x.i);
            var morningByGym = roster
                .Select(e => e.GymId)
                .Distinct()
                .ToDictionary(
                    gymId => gymId,
                    gymId => db.ShiftTemplates
                        .First(t => t.GymId == gymId && t.Name == "Morning Shift"));

            var added = await SeedAttendanceAsync(db, roster, rosterIndex, morningByGym, monthStart, yesterday);
            logger.LogInformation(
                "Attendance topped up for {Start:yyyy-MM-dd}..{End:yyyy-MM-dd} ({Staff} staff).",
                monthStart, yesterday, roster.Count);        }

        private sealed record StaffSeed(
            string Email, string UserName, string FullName, string Number,
            int Gym, string PositionTitle, DateOnly HireDate, EmployeeStatus Status,
            DateOnly? ContractEnd, string? Team, bool Female);

        private sealed record CandidateSeed(
            string FullName, string Email, string Phone, DateOnly Dob,
            string NationalId, decimal? Rating, bool Blocked = false, string? BlockReason = null);

        /// <summary>Base salary by position title (EGP) — also used for payroll history.</summary>
        private static readonly Dictionary<string, decimal> SalaryByPosition = new()
        {
            ["Branch Manager"] = 18000m,
            ["Fitness Trainer"] = 9000m,
            ["Trainer"] = 9000m,
            ["Personal Trainer"] = 9500m,
            ["Nutrition Coach"] = 11000m,
            ["Group Instructor"] = 8500m,
            ["Receptionist"] = 6500m,
            ["Sales Consultant"] = 8000m,
            ["Cleaner"] = 4500m,
        };

        public static async Task SeedAsync(ReviveHrDbContext db, IPasswordHasher hasher, ILogger logger)
        {
            if (await IsCompleteAsync(db))
            {
                // The demo world keeps moving: top the current month's attendance up so
                // the open payroll sheet always has day-level evidence behind its
                // counters (a seeded "21 days" with no records reads as a phantom).
                await TopUpCurrentMonthAttendanceAsync(db, logger);
                return;
            }

            var admin = await db.Users.FirstAsync(u => u.Email == DevelopmentDataSeeder.AdminEmail);
            var hr = await db.Users.FirstAsync(u => u.Email == DevelopmentDataSeeder.HrEmail);
            var hrManager = await db.Users.FirstAsync(u => u.Email == DevelopmentDataSeeder.HrManagerEmail);
            var omar = await db.Users.FirstAsync(u => u.Email == "omar@revive.hr");
            var karimUser = await db.Users.FirstAsync(u => u.Email == "karim@revive.hr");

            var gym1 = await db.Gyms.FirstAsync(g => g.Name == DevelopmentDataSeeder.Gym1Name);
            var gym2 = await db.Gyms.FirstAsync(g => g.Name == DevelopmentDataSeeder.Gym2Name);

            // ---- Organization structure ---------------------------------
            var departments = new Dictionary<(int GymId, string Name), Department>();
            foreach (var (gymId, name) in new[]
            {
                (gym1.Id, "Fitness"), (gym1.Id, "Front Desk"), (gym1.Id, "Sales"),
                (gym1.Id, "Management"), (gym1.Id, "Maintenance"),
                (gym2.Id, "Fitness"), (gym2.Id, "Front Desk"), (gym2.Id, "Maintenance"),
            })
            {
                departments[(gymId, name)] = await EnsureDepartmentAsync(db, gymId, name);
            }

            var positions = new Dictionary<(int GymId, string Title), Position>();
            foreach (var (gymId, title, level, dept, headcount) in new (int, string, string, string, int)[]
            {
                (gym1.Id, "Branch Manager", "Senior", "Management", 2),
                (gym1.Id, "Fitness Trainer", "Mid", "Fitness", 8),
                (gym1.Id, "Personal Trainer", "Mid", "Fitness", 6),
                (gym1.Id, "Nutrition Coach", "Mid", "Fitness", 2),
                (gym1.Id, "Group Instructor", "Mid", "Fitness", 3),
                (gym1.Id, "Receptionist", "Junior", "Front Desk", 4),
                (gym1.Id, "Sales Consultant", "Mid", "Sales", 3),
                (gym1.Id, "Cleaner", "Junior", "Maintenance", 2),
                (gym2.Id, "Fitness Trainer", "Mid", "Fitness", 5),
                (gym2.Id, "Nutrition Coach", "Mid", "Fitness", 1),
                (gym2.Id, "Receptionist", "Junior", "Front Desk", 2),
                (gym2.Id, "Cleaner", "Junior", "Maintenance", 2),
            })
            {
                positions[(gymId, title)] = await EnsurePositionAsync(
                    db, gymId, title, level, departments[(gymId, dept)].Id, headcount);
            }

            // ---- Shift templates (both gyms) ----------------------------
            var templates = new Dictionary<(int GymId, string Name), ShiftTemplate>();
            foreach (var (gymId, name, start, end) in new (int, string, int, int)[]
            {
                (gym1.Id, "Morning Shift", 8, 16), (gym1.Id, "Evening Shift", 16, 24), (gym1.Id, "Night Shift", 0, 8),
                (gym2.Id, "Morning Shift", 8, 16), (gym2.Id, "Evening Shift", 16, 24), (gym2.Id, "Night Shift", 0, 8),
            })
            {
                templates[(gymId, name)] = await EnsureShiftTemplateAsync(
                    db, gymId, name, new TimeOnly(start == 24 ? 0 : start, 0), new TimeOnly(end == 24 ? 0 : end, 0));
            }

            // ---- Staff roster -------------------------------------------
            var staffSeeds = new[]
            {
                new StaffSeed("nour@revive.hr", "nour", "Nour Khaled Salem", "EMP-2001",
                    gym1.Id, "Receptionist", new DateOnly(2025, 3, 1), EmployeeStatus.Active,
                    new DateOnly(2026, 11, 15), "Morning Floor Team", Female: true),
                new StaffSeed("youssef@revive.hr", "youssef", "Youssef Hany Gad", "EMP-2002",
                    gym1.Id, "Nutrition Coach", new DateOnly(2024, 11, 15), EmployeeStatus.Active,
                    null, "Evening Floor Team", Female: false),
                new StaffSeed("mahmoud@revive.hr", "mahmoud", "Mahmoud Zaki Fouda", "EMP-2003",
                    gym1.Id, "Group Instructor", new DateOnly(2026, 1, 10), EmployeeStatus.Active,
                    null, "Morning Floor Team", Female: false),
                new StaffSeed("rania@revive.hr", "rania", "Rania Mostafa Atef", "EMP-2004",
                    gym1.Id, "Fitness Trainer", new DateOnly(2026, 10, 1), EmployeeStatus.Active,
                    null, "Evening Floor Team", Female: true),
                new StaffSeed("dina@revive.hr", "dina", "Dina Fathy Abdelrahman", "EMP-2005",
                    gym1.Id, "Fitness Trainer", new DateOnly(2025, 6, 20), EmployeeStatus.Active,
                    null, "Evening Floor Team", Female: true),
                new StaffSeed("hossam@revive.hr", "hossam", "Hossam Eldin Sabry", "EMP-2006",
                    gym1.Id, "Sales Consultant", new DateOnly(2025, 1, 5), EmployeeStatus.Active,
                    null, null, Female: false),
                new StaffSeed("laila@revive.hr", "laila", "Laila Sobhy Marei", "EMP-2007",
                    gym1.Id, "Fitness Trainer", new DateOnly(2023, 8, 1), EmployeeStatus.NoticePeriod,
                    new DateOnly(2026, 11, 30), "Evening Floor Team", Female: true),
                new StaffSeed("aya@revive.hr", "aya", "Aya Sherif Hegazy", "EMP-2008",
                    gym2.Id, "Receptionist", new DateOnly(2025, 9, 1), EmployeeStatus.Active,
                    null, "Floor Team", Female: true),
                new StaffSeed("khaled@revive.hr", "khaled", "Khaled Osman Rashed", "EMP-2009",
                    gym2.Id, "Fitness Trainer", new DateOnly(2024, 2, 15), EmployeeStatus.Active,
                    null, "Floor Team", Female: false),
                new StaffSeed("mariam@revive.hr", "mariam", "Mariam Adel Fahmy", "EMP-2010",
                    gym2.Id, "Nutrition Coach", new DateOnly(2026, 4, 1), EmployeeStatus.Active,
                    null, "Floor Team", Female: true),
                new StaffSeed("mostafa@revive.hr", "mostafa", "Mostafa Rida Qenawy", "EMP-2011",
                    gym2.Id, "Fitness Trainer", new DateOnly(2022, 5, 10), EmployeeStatus.Terminated,
                    null, null, Female: false),
                new StaffSeed("salma@revive.hr", "salma", "Salma Ibrahim Latif", "EMP-2012",
                    gym2.Id, "Fitness Trainer", new DateOnly(2026, 9, 15), EmployeeStatus.Active,
                    null, "Floor Team", Female: true),
            };

            var staffByNumber = new Dictionary<string, Employee>();
            foreach (var seed in staffSeeds)
            {
                var position = positions[(seed.Gym, seed.PositionTitle)];
                var employee = await EnsureStaffAsync(db, hasher, seed, position.Id);
                staffByNumber[seed.Number] = employee;

                await EnsureGymAccessAsync(db, employee.UserId, seed.Gym);
                await DevelopmentDataSeeder.EnsureUserGymRoleAsync(db, employee.UserId, seed.Gym, RoleNames.Employee);
            }

            // Rania was hired through the recruitment pipeline below.
            var rania = staffByNumber["EMP-2004"];

            // ---- Teams + leaders ----------------------------------------
            var morningTeam = await EnsureTeamAsync(db, gym1.Id, "Morning Floor Team");
            var eveningTeam = await EnsureTeamAsync(db, gym1.Id, "Evening Floor Team");
            var floorTeam2 = await EnsureTeamAsync(db, gym2.Id, "Floor Team");

            var karim = await db.Employees.FirstAsync(e => e.UserId == karimUser.Id);
            await EnsureTeamMembershipAsync(db, karim, morningTeam, leader: karim);
            await EnsureTeamMembershipAsync(db, staffByNumber["EMP-2009"], floorTeam2, leader: staffByNumber["EMP-2009"]);
            await EnsureTeamMembershipAsync(db, rania, eveningTeam, leader: rania);

            foreach (var number in new[] { "EMP-2001", "EMP-2003" })
            {
                await EnsureTeamMembershipAsync(db, staffByNumber[number], morningTeam);
            }

            foreach (var number in new[] { "EMP-2002", "EMP-2005", "EMP-2007" })
            {
                await EnsureTeamMembershipAsync(db, staffByNumber[number], eveningTeam);
            }

            foreach (var number in new[] { "EMP-2008", "EMP-2010", "EMP-2012" })
            {
                await EnsureTeamMembershipAsync(db, staffByNumber[number], floorTeam2);
            }

            // ---- Attendance history (~7 weeks) --------------------------
            var roster = await db.Employees
                .Where(e => e.Status != EmployeeStatus.Terminated)
                .OrderBy(e => e.Id)
                .ToListAsync();
            var rosterIndex = roster.Select((e, i) => (e.Id, i))
                .ToDictionary(x => x.Id, x => x.i);

            var morningByGym = new Dictionary<int, ShiftTemplate>
            {
                [gym1.Id] = templates[(gym1.Id, "Morning Shift")],
                [gym2.Id] = templates[(gym2.Id, "Morning Shift")],
            };
            var absentSamples = await SeedAttendanceAsync(db, roster, rosterIndex, morningByGym);

            // ---- Leave balances -----------------------------------------
            await SeedLeaveBalancesAsync(db, roster, rosterIndex, hr.Id);

            // ---- Payroll: 3 closed months + the open October period -----
            var octoberEntries = await SeedPayrollHistoryAsync(
                db, roster, rosterIndex, SalaryByPosition, hrManager.Id, hr.Id,
                gym1.Id, gym2.Id);

            // Pending deduction lines on the open period (Payroll pending tab).
            await EnsurePendingLineAsync(db, octoberEntries, staffByNumber["EMP-2001"],
                "Late arrival penalty — Oct 14", 250m, new DateOnly(2026, 10, 14));
            await EnsurePendingLineAsync(db, octoberEntries, staffByNumber["EMP-2009"],
                "Unapproved absence — Oct 8", 400m, new DateOnly(2026, 10, 8));

            // ---- Branch action queues (Branch Queue module) -------------
            await SeedBranchActionsAsync(db, staffByNumber, absentSamples, omar.Id, hr.Id, karim.Id);

            // ---- Employee requests pipeline (Requests module) ------------
            await SeedRequestsAsync(db, staffByNumber, karim.Id, omar.Id, hr.Id);

            // ---- Offboarding (Terminations module) -----------------------
            var lailaCase = await SeedOffboardingAsync(db, staffByNumber, omar.Id, hrManager.Id, hr.Id);

            // ---- Recruitment (Recruitment module) ------------------------
            await SeedRecruitmentAsync(db, positions, rania, hr.Id, hrManager.Id);

            // ---- Escalation queues (VacancyRequest + ActionRequest) ------
            await SeedEscalationQueuesAsync(db, positions, staffByNumber, omar.Id, hr.Id, hrManager.Id);

            // ---- Evaluations (Evaluations module) ------------------------
            await SeedEvaluationsAsync(db, gym1.Id, positions, staffByNumber, karimUser.Id, hr.Id, hrManager.Id);

            // ---- Announcements + inbox notifications --------------------
            await SeedAnnouncementsAndNotificationsAsync(
                db, gym1.Id, gym2.Id, hr.Id, hrManager.Id, omar.Id);

            // ---- Events are derived by EventsService from live data on first read,
            //      so nothing is seeded here: seeded rows collide with the derived
            //      queue's unique key and get pruned on the next sync.

            // ---- November shift cycles (published) -----------------------
            await SeedNovemberCyclesAsync(db, roster, rosterIndex, templates, gym1.Id, gym2.Id, admin.Id);

            logger.LogWarning(
                "Rich scenario seeded: +{Count} employees (EMP-2001..EMP-2012), ~7 weeks of attendance, payroll Jul-Sep closed + October open, requests/recruitment/evaluations/offboarding pipelines, branch queues and announcements. Logins: nour@revive.hr, youssef@revive.hr, mahmoud@revive.hr, rania@revive.hr, dina@revive.hr, hossam@revive.hr, laila@revive.hr (gym1), aya@revive.hr, khaled@revive.hr, mariam@revive.hr, mostafa@revive.hr, salma@revive.hr (gym2) — password {Password}",
                staffSeeds.Length, DevelopmentDataSeeder.EmployeePassword);
        }

        // ==================================================================
        // Organization
        // ==================================================================

        private static async Task<Department> EnsureDepartmentAsync(ReviveHrDbContext db, int gymId, string name)
        {
            var department = await db.Departments.FirstOrDefaultAsync(d => d.GymId == gymId && d.Name == name);
            if (department is not null)
            {
                return department;
            }

            department = new Department { GymId = gymId, Name = name };
            db.Departments.Add(department);
            await db.SaveChangesAsync();
            return department;
        }

        private static async Task<Position> EnsurePositionAsync(
            ReviveHrDbContext db, int gymId, string title, string level, int departmentId, int headcount)
        {
            // The base seeder already created "Fitness Trainer" (Level "1") — reuse it.
            var position = await db.Positions.FirstOrDefaultAsync(p => p.GymId == gymId && p.Title == title);
            if (position is not null)
            {
                return position;
            }

            position = new Position
            {
                GymId = gymId,
                Title = title,
                Level = level,
                IsActive = true,
                Headcount = headcount,
                DepartmentId = departmentId,
            };
            db.Positions.Add(position);
            await db.SaveChangesAsync();
            return position;
        }

        private static async Task<ShiftTemplate> EnsureShiftTemplateAsync(
            ReviveHrDbContext db, int gymId, string name, TimeOnly start, TimeOnly end)
        {
            var template = await db.ShiftTemplates.FirstOrDefaultAsync(t => t.GymId == gymId && t.Name == name);
            if (template is not null)
            {
                return template;
            }

            template = new ShiftTemplate
            {
                GymId = gymId,
                Name = name,
                StartTime = start,
                EndTime = end,
                IsActive = true,
            };
            db.ShiftTemplates.Add(template);
            await db.SaveChangesAsync();
            return template;
        }

        private static async Task<Team> EnsureTeamAsync(ReviveHrDbContext db, int gymId, string name)
        {
            var team = await db.Teams.FirstOrDefaultAsync(t => t.GymId == gymId && t.Name == name);
            if (team is not null)
            {
                return team;
            }

            team = new Team { GymId = gymId, Name = name, IsActive = true };
            db.Teams.Add(team);
            await db.SaveChangesAsync();
            return team;
        }

        private static async Task EnsureTeamMembershipAsync(
            ReviveHrDbContext db, Employee employee, Team team, Employee? leader = null)
        {
            if (employee.TeamId != team.Id)
            {
                employee.TeamId = team.Id;
            }

            if (leader is not null && !await db.TeamLeaders.AnyAsync(tl => tl.EmployeeId == leader.Id))
            {
                db.TeamLeaders.Add(new TeamLeader { TeamId = team.Id, EmployeeId = leader.Id });
            }

            await db.SaveChangesAsync();
        }

        private static async Task<Employee> EnsureStaffAsync(
            ReviveHrDbContext db, IPasswordHasher hasher, StaffSeed seed, int positionId)
        {
            var existing = await db.Employees.FirstOrDefaultAsync(e => e.EmployeeNumber == seed.Number);
            if (existing is not null)
            {
                return existing;
            }

            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == seed.Email);
            if (user is null)
            {
                user = new User
                {
                    Email = seed.Email,
                    UserName = seed.UserName,
                    PasswordHash = hasher.Hash(DevelopmentDataSeeder.EmployeePassword),
                    UserType = UserType.Employee,
                    IsActive = true,
                };
                db.Users.Add(user);
                await db.SaveChangesAsync();
            }

            var parts = seed.FullName.Split(' ');
            var emergencyNames = new[] { "Amal", "Sami", "Hala", "Nabil", "Mona", "Tarek" };

            // Deterministic profile values derived from the employee number (never
            // GetHashCode — string hashing is randomized per process).
            var n = int.Parse(seed.Number[^4..]);
            var employee = new Employee
            {
                UserId = user.Id,
                GymId = seed.Gym,
                PositionId = positionId,
                FullName = seed.FullName,
                EmployeeNumber = seed.Number,
                HireDate = seed.HireDate,
                Status = seed.Status,
                ContractType = "FullTime",
                ContractStartDate = seed.HireDate,
                ContractEndDate = seed.ContractEnd,
                Phone = $"010{12000000 + n * 7919:D8}",
                Gender = seed.Female ? "Female" : "Male",
                DateOfBirth = new DateOnly(1988 + (n % 12), (n % 12) + 1, ((n * 3) % 27) + 1),
                NationalId = $"2810{n % 100:D2}987654{(n * 7) % 100:D2}",
                Address = seed.Gym == 1 ? "Nasr City, Cairo" : "Smouha, Alexandria",
                EmergencyContactName = $"{emergencyNames[n % emergencyNames.Length]} {parts[^1]}",
                EmergencyContactRelationship = "Family",
                EmergencyContactPhone = $"011{22000000 + n * 3571:D8}",
            };
            db.Employees.Add(employee);
            await db.SaveChangesAsync();
            return employee;
        }

        private static async Task EnsureGymAccessAsync(ReviveHrDbContext db, int userId, int gymId)
        {
            if (await db.UserGymAccesses.AnyAsync(a => a.UserId == userId && a.GymId == gymId))
            {
                return;
            }

            db.UserGymAccesses.Add(new UserGymAccess { UserId = userId, GymId = gymId });
            await db.SaveChangesAsync();
        }

        // ==================================================================
        // Attendance (~7 weeks of history, deterministic status mix)
        // ==================================================================

        /// <summary>
        /// One record per employee per working day (Fridays off, weekends worked —
        /// Egyptian week). Status mix by (staffIndex, dayNumber) modulo pattern:
        /// mostly OnTime with Late / Absent / EarlyCheckout / MissingCheckout /
        /// manual-entry rows for the exception screens and reports. Returns the
        /// first Absent record per employee for deduction-candidate linkage.
        /// </summary>
        private static async Task<Dictionary<int, (int RecordId, DateOnly Date)>> SeedAttendanceAsync(
            ReviveHrDbContext db,
            IReadOnlyList<Employee> roster,
            IReadOnlyDictionary<int, int> rosterIndex,
            IReadOnlyDictionary<int, ShiftTemplate> morningByGym,
            DateOnly? windowStart = null,
            DateOnly? windowEnd = null)
        {
            // Pinned scenario window (was: rolling 53 days ending yesterday, which
            // drifted with the clock and left October incomplete). Deterministic:
            // every run seeds Sep 1 -> Oct 31 2026, Fridays skipped as days off.
            // The window is overridable so the current-month top-up can reuse the
            // exact same status pattern for the days the seed itself did not cover.
            var start = windowStart ?? new DateOnly(2026, 9, 1);
            var end = windowEnd ?? new DateOnly(2026, 10, 31);

            var existing = (await db.AttendanceRecords
                    .Where(a => a.Date >= start && a.Date <= end)
                    .Select(a => new { a.EmployeeId, a.Date, a.Id, a.Status })
                    .ToListAsync())
                .ToDictionary(a => (a.EmployeeId, a.Date), a => a);

            var absentSamples = new Dictionary<int, (int RecordId, DateOnly Date)>();
            var added = new List<AttendanceRecord>();

            foreach (var employee in roster)
            {
                var i = rosterIndex[employee.Id];
                var template = morningByGym[employee.GymId];

                for (var date = start; date <= end; date = date.AddDays(1))
                {
                    if (date.DayOfWeek == DayOfWeek.Friday)
                    {
                        continue; // weekly day off — no record, UI derives Off
                    }

                    if (existing.ContainsKey((employee.Id, date)))
                    {
                        var already = existing[(employee.Id, date)];
                        if (already.Status == AttendanceStatus.Absent && !absentSamples.ContainsKey(employee.Id))
                        {
                            absentSamples[employee.Id] = (already.Id, date);
                        }

                        continue;
                    }

                    var dayNumber = date.DayNumber;
                    var slot = (i * 7 + dayNumber) % 24;
                    var record = new AttendanceRecord
                    {
                        EmployeeId = employee.Id,
                        GymId = employee.GymId,
                        Date = date,
                        ScheduledShiftTemplateId = template.Id,
                        CheckInMethod = AttendanceMethod.Biometric,
                        CheckOutMethod = AttendanceMethod.Biometric,
                    };

                    switch (slot)
                    {
                        case < 16: // on time
                            record.Status = AttendanceStatus.OnTime;
                            record.CheckInTime = UtcAt(date, template.StartTime.AddMinutes((i + dayNumber) % 7));
                            record.CheckOutTime = UtcAt(date, template.EndTime);
                            break;
                        case < 19: // late
                            record.Status = AttendanceStatus.Late;
                            record.CheckInTime = UtcAt(date, template.StartTime.AddMinutes(12 + (slot * 5) % 24));
                            record.CheckOutTime = UtcAt(date, template.EndTime);
                            break;
                        case < 21: // absent (no times)
                            record.Status = AttendanceStatus.Absent;
                            record.CheckInMethod = null;
                            record.CheckOutMethod = null;
                            record.Notes = "No check-in recorded — flagged for review.";
                            if (!absentSamples.ContainsKey(employee.Id))
                            {
                                absentSamples[employee.Id] = (-1, date); // id filled after save
                            }

                            break;
                        case 21: // early checkout
                            record.Status = AttendanceStatus.EarlyCheckout;
                            record.CheckInTime = UtcAt(date, template.StartTime);
                            record.CheckOutTime = UtcAt(date, template.StartTime.AddHours(4));
                            break;
                        case 22: // forgot to clock out
                            record.Status = AttendanceStatus.MissingCheckout;
                            record.CheckInTime = UtcAt(date, template.StartTime);
                            record.CheckOutTime = null;
                            break;
                        default: // manual entry (face scan failed)
                            record.Status = AttendanceStatus.OnTime;
                            record.CheckInMethod = AttendanceMethod.Manual;
                            record.CheckInTime = UtcAt(date, template.StartTime);
                            record.CheckOutTime = UtcAt(date, template.EndTime);
                            record.Notes = "Manual entry: face scan failed — verified by HR.";
                            break;
                    }

                    added.Add(record);
                }
            }

            db.AttendanceRecords.AddRange(added);
            await db.SaveChangesAsync();

            // Resolve ids of the deferred absent samples.
            foreach (var (employeeId, sample) in absentSamples.Where(s => s.Value.RecordId == -1).ToList())
            {
                var record = await db.AttendanceRecords.FirstOrDefaultAsync(a =>
                    a.EmployeeId == employeeId && a.Date == sample.Date && a.Status == AttendanceStatus.Absent);
                if (record is not null)
                {
                    absentSamples[employeeId] = (record.Id, sample.Date);
                }
            }

            return absentSamples;
        }

        private static async Task SeedLeaveBalancesAsync(
            ReviveHrDbContext db, IReadOnlyList<Employee> roster, IReadOnlyDictionary<int, int> rosterIndex, int hrId)
        {
            foreach (var employee in roster)
            {
                var i = rosterIndex[employee.Id];
                if (await db.LeaveBalances.AnyAsync(lb =>
                        lb.EmployeeId == employee.Id && lb.LeaveType == LeaveType.Annual && lb.Year == 2026))
                {
                    continue;
                }

                db.LeaveBalances.Add(new LeaveBalance
                {
                    EmployeeId = employee.Id,
                    LeaveType = LeaveType.Annual,
                    Year = 2026,
                    TotalEntitlement = 21,
                    UsedDays = i % 6,
                    PendingDays = i % 3 == 0 ? 3 : 0,
                    UpdatedBy = hrId,
                });
            }

            await db.SaveChangesAsync();
        }

        // ==================================================================
        // Payroll
        // ==================================================================

        /// <summary>
        /// Jul/Aug/Sep 2026 Locked+Paid periods per gym with full entries and
        /// approved deduction lines, then Draft entries for the open October
        /// period for anyone the base seeder missed. Returns the October
        /// period entries keyed by employee id.
        /// </summary>
        private static async Task<Dictionary<int, PayrollEntry>> SeedPayrollHistoryAsync(
            ReviveHrDbContext db,
            IReadOnlyList<Employee> roster,
            IReadOnlyDictionary<int, int> rosterIndex,
            IReadOnlyDictionary<string, decimal> salaryByPosition,
            int approverId, int reviewerId,
            int gym1Id, int gym2Id)
        {
            var positionTitles = await db.Positions
                .ToDictionaryAsync(p => p.Id, p => p.Title);
            // Tolerate any position title (legacy rows like "Trainer" exist too).
            var salaryOf = (Employee e) =>
            {
                var title = positionTitles.GetValueOrDefault(e.PositionId, "Fitness Trainer");
                return salaryByPosition.TryGetValue(title, out var salary) ? salary : 9000m;
            };

            // ---- Closed history months ----------------------------------
            foreach (var gymId in new[] { gym1Id, gym2Id })
            {
                foreach (var month in new[] { 7, 8, 9 })
                {
                    var start = new DateOnly(2026, month, 1);
                    var end = new DateOnly(2026, month, DateTime.DaysInMonth(2026, month));

                    var period = await db.PayrollPeriods.FirstOrDefaultAsync(p =>
                        p.GymId == gymId && p.StartDate == start);
                    if (period is null)
                    {
                        period = new PayrollPeriod
                        {
                            GymId = gymId,
                            StartDate = start,
                            EndDate = end,
                            Status = PayrollPeriodStatus.Locked,
                            ApprovedBy = approverId,
                            ApprovedAt = new DateTime(2026, month, 27, 15, 0, 0, DateTimeKind.Utc),
                            PaidDate = end.AddDays(5),
                        };
                        db.PayrollPeriods.Add(period);
                        await db.SaveChangesAsync();
                    }

                    var employees = roster.Where(e => e.GymId == gymId).ToList();
                    var existingIds = await db.PayrollEntries
                        .Where(en => en.PayrollPeriodId == period.Id)
                        .Select(en => en.EmployeeId)
                        .ToListAsync();

                    foreach (var employee in employees.Where(e => !existingIds.Contains(e.Id)))
                    {
                        var i = rosterIndex[employee.Id];
                        var baseSalary = salaryOf(employee);
                        var otHours = (i % 3) * 4m;
                        var otPay = Math.Round(baseSalary / 176m * 1.5m * otHours, 2);
                        var bonus = (i % 4) switch { 0 => 1000m, 1 => 500m, 2 => 750m, _ => 0m };

                        var entry = new PayrollEntry
                        {
                            PayrollPeriodId = period.Id,
                            EmployeeId = employee.Id,
                            BaseSalary = baseSalary,
                            TotalBonuses = bonus,
                            OvertimeHours = otHours,
                            DaysWorked = 24 + (i % 3),
                            Status = "Locked",
                            ReviewedAt = period.ApprovedAt,
                        };

                        var deductions = 0m;
                        if ((i + month) % 2 == 0)
                        {
                            deductions += 250m;
                            entry.LineItems.Add(new PayrollEntryLineItem
                            {
                                Type = "Deduction",
                                Label = $"Late arrival penalty — {month}/2026",
                                EffectiveDate = new DateOnly(2026, month, 12),
                                Amount = 250m,
                                Reason = "Repeated late arrivals",
                                Source = "Attendance",
                                Status = "Approved",
                                ReviewedBy = reviewerId,
                                ReviewedAt = new DateTime(2026, month, 25, 12, 0, 0, DateTimeKind.Utc),
                            });
                        }

                        if ((i + month) % 5 == 0)
                        {
                            deductions += 400m;
                            entry.LineItems.Add(new PayrollEntryLineItem
                            {
                                Type = "Deduction",
                                Label = $"Unexcused absence — {month}/2026",
                                EffectiveDate = new DateOnly(2026, month, 20),
                                Amount = 400m,
                                Reason = "Absence without approved leave",
                                Source = "Attendance",
                                Status = "Approved",
                                ReviewedBy = reviewerId,
                                ReviewedAt = new DateTime(2026, month, 25, 12, 0, 0, DateTimeKind.Utc),
                            });
                        }

                        entry.TotalDeductions = deductions;
                        entry.NetPay = baseSalary + otPay + bonus - deductions;
                        db.PayrollEntries.Add(entry);
                    }

                    await db.SaveChangesAsync();
                }
            }

            // ---- Open October period: Draft entries for everyone ---------
            var octoberEntries = new Dictionary<int, PayrollEntry>();
            foreach (var gymId in new[] { gym1Id, gym2Id })
            {
                var october = await db.PayrollPeriods.FirstAsync(p =>
                    p.GymId == gymId && p.StartDate == new DateOnly(2026, 10, 1));

                var employees = roster.Where(e => e.GymId == gymId).ToList();
                var existing = await db.PayrollEntries
                    .Where(en => en.PayrollPeriodId == october.Id)
                    .ToListAsync();

                foreach (var employee in employees)
                {
                    var entry = existing.FirstOrDefault(en => en.EmployeeId == employee.Id);
                    if (entry is null)
                    {
                        entry = new PayrollEntry
                        {
                            PayrollPeriodId = october.Id,
                            EmployeeId = employee.Id,
                            BaseSalary = salaryOf(employee),
                            TotalBonuses = 0m,
                            OvertimeHours = 0m,
                            DaysWorked = 18,
                            Status = "Draft",
                        };
                        db.PayrollEntries.Add(entry);
                    }

                    octoberEntries[employee.Id] = entry;
                }
            }

            // Sync Draft October DaysWorked with the real attendance month so the
            // payroll sheet agrees with the attendance module (money is recomputed
            // server-side; DaysWorked is display-only). Locked/approved entries and
            // anything the user touched are left alone — only untouched Draft rows.
            var octoberWorkedDays = await db.AttendanceRecords
                .Where(a => a.Date >= new DateOnly(2026, 10, 1) && a.Date <= new DateOnly(2026, 10, 31)
                            && a.Status != AttendanceStatus.Absent && a.Status != AttendanceStatus.Off)
                .GroupBy(a => a.EmployeeId)
                .Select(g => new { EmployeeId = g.Key, Days = g.Count() })
                .ToDictionaryAsync(x => x.EmployeeId, x => x.Days);

            foreach (var entry in octoberEntries.Values)
            {
                if (entry.Status == "Draft"
                    && octoberWorkedDays.TryGetValue(entry.EmployeeId, out var days)
                    && entry.DaysWorked != days)
                {
                    entry.DaysWorked = days;
                }
            }

            await db.SaveChangesAsync();
            return octoberEntries;
        }

        private static async Task EnsurePendingLineAsync(
            ReviveHrDbContext db,
            IReadOnlyDictionary<int, PayrollEntry> octoberEntries,
            Employee employee,
            string label, decimal amount, DateOnly effectiveDate)
        {
            if (!octoberEntries.TryGetValue(employee.Id, out var entry))
            {
                return;
            }

            if (await db.PayrollEntryLineItems.AnyAsync(l => l.PayrollEntryId == entry.Id && l.Label == label))
            {
                return;
            }

            db.PayrollEntryLineItems.Add(new PayrollEntryLineItem
            {
                PayrollEntryId = entry.Id,
                Type = "Deduction",
                Label = label,
                EffectiveDate = effectiveDate,
                Amount = amount,
                Reason = "Flagged by branch manager — awaiting HR review",
                Source = "Manual",
                Status = "Pending",
            });
            await db.SaveChangesAsync();
        }

        // ==================================================================
        // Branch action queues (warnings, bonuses, deduction candidates)
        // ==================================================================

        private static async Task SeedBranchActionsAsync(
            ReviveHrDbContext db,
            IReadOnlyDictionary<string, Employee> staff,
            IReadOnlyDictionary<int, (int RecordId, DateOnly Date)> absentSamples,
            int omarId, int hrId, int karimId)
        {
            var laila = staff["EMP-2007"];
            var hossam = staff["EMP-2006"];
            var mahmoud = staff["EMP-2003"];
            var rania = staff["EMP-2004"];
            var dina = staff["EMP-2005"];
            var aya = staff["EMP-2008"];

            // ---- Warnings ------------------------------------------------
            if (!await db.WarningNotices.AnyAsync(w => w.Reason == "Repeated late arrivals during October"))
            {
                db.WarningNotices.AddRange(
                    new WarningNotice
                    {
                        EmployeeId = laila.Id,
                        Type = "Attendance",
                        Reason = "Repeated late arrivals during October",
                        Note = "Spoke with the employee on Oct 12; re-explained the punctuality policy.",
                        IssuedBy = omarId,
                        IssuedAt = new DateTime(2026, 10, 12, 10, 0, 0, DateTimeKind.Utc),
                        Status = ProposalStatus.Pending,
                    },
                    new WarningNotice
                    {
                        EmployeeId = hossam.Id,
                        Type = "Conduct",
                        Reason = "Unprofessional interaction with a member at the front desk",
                        Note = "Witnessed by reception staff on Oct 17.",
                        IssuedBy = omarId,
                        IssuedAt = new DateTime(2026, 10, 18, 9, 30, 0, DateTimeKind.Utc),
                        Status = ProposalStatus.Pending,
                    },
                    new WarningNotice
                    {
                        EmployeeId = mahmoud.Id,
                        Type = "Safety",
                        Reason = "Left free-weights area unsecured after closing",
                        Note = "First occurrence — discussed verbally.",
                        IssuedBy = omarId,
                        IssuedAt = new DateTime(2026, 9, 18, 22, 0, 0, DateTimeKind.Utc),
                        Status = ProposalStatus.Rejected,
                        ReviewedBy = hrId,
                        ReviewedAt = new DateTime(2026, 9, 20, 11, 0, 0, DateTimeKind.Utc),
                        ReviewNote = "First occurrence — handled with verbal coaching instead.",
                    });
                await db.SaveChangesAsync();
            }

            // ---- Bonus proposals ----------------------------------------
            if (!await db.BonusProposals.AnyAsync(b => b.Reason == "Highest member retention among trainers in September"))
            {
                db.BonusProposals.AddRange(
                    new BonusProposal
                    {
                        EmployeeId = rania.Id,
                        Type = "Performance Bonus",
                        Amount = 1500m,
                        Reason = "Highest member retention among trainers in September",
                        Note = "Retention 94%; 12 new PT package sales.",
                        IssuedBy = omarId,
                        IssuedAt = new DateTime(2026, 10, 8, 12, 0, 0, DateTimeKind.Utc),
                        Status = ProposalStatus.Pending,
                    },
                    new BonusProposal
                    {
                        EmployeeId = karimId,
                        Type = "Attendance Reward",
                        Amount = 750m,
                        Reason = "Perfect attendance in August",
                        Note = "Zero absences, zero late arrivals.",
                        IssuedBy = omarId,
                        IssuedAt = new DateTime(2026, 9, 1, 9, 0, 0, DateTimeKind.Utc),
                        Status = ProposalStatus.Approved,
                        ReviewedBy = hrId,
                        ReviewedAt = new DateTime(2026, 9, 3, 14, 0, 0, DateTimeKind.Utc),
                    },
                    new BonusProposal
                    {
                        EmployeeId = hossam.Id,
                        Type = "Other",
                        Amount = 3000m,
                        Reason = "Requested company car allowance",
                        Note = "Sales route covers New Cairo.",
                        IssuedBy = omarId,
                        IssuedAt = new DateTime(2026, 9, 22, 10, 0, 0, DateTimeKind.Utc),
                        Status = ProposalStatus.Rejected,
                        ReviewedBy = hrId,
                        ReviewedAt = new DateTime(2026, 9, 25, 16, 0, 0, DateTimeKind.Utc),
                        ReviewNote = "Outside the bonus policy — redirect to a compensation-change request.",
                    });
                await db.SaveChangesAsync();
            }

            // ---- Deduction candidates (branch-raised) ---------------------
            if (!await db.DeductionCandidates.AnyAsync(c => c.Reason == "Unapproved absence"))
            {
                DeductionCandidate Sample(int employeeId, decimal amount, string reason, string? note,
                    ProposalStatusLike status)
                {
                    absentSamples.TryGetValue(employeeId, out var sample);
                    var day = sample.Date == default ? 13 : Math.Clamp(sample.Date.Day, 2, 27);
                    return new DeductionCandidate
                    {
                        EmployeeId = employeeId,
                        AttendanceRecordId = sample.RecordId > 0 ? sample.RecordId : null,
                        Amount = amount,
                        Reason = reason,
                        Note = note,
                        IssuedBy = omarId,
                        IssuedAt = new DateTime(2026, 10, day, 11, 0, 0, DateTimeKind.Utc),
                        Status = status switch
                        {
                            ProposalStatusLike.Pending => DeductionStatus.Pending,
                            ProposalStatusLike.Approved => DeductionStatus.Approved,
                            _ => DeductionStatus.Rejected,
                        },
                        ReviewedBy = status == ProposalStatusLike.Pending ? null : hrId,
                        ReviewedAt = status == ProposalStatusLike.Pending
                            ? null
                            : new DateTime(2026, 10, 5, 13, 0, 0, DateTimeKind.Utc),
                    };
                }

                db.DeductionCandidates.AddRange(
                    Sample(dina.Id, 400m, "Unapproved absence", "Missed shift without notice — see attendance log.", ProposalStatusLike.Pending),
                    Sample(aya.Id, 250m, "Late arrivals (3×)", "Three late arrivals within one week at Second Gym.", ProposalStatusLike.Pending),
                    Sample(karimId, 150m, "Late arrivals", "Two late arrivals in September.", ProposalStatusLike.Approved),
                    Sample(mahmoud.Id, 200m, "Dress-code violation", "Waived after discussion.", ProposalStatusLike.Rejected));
                await db.SaveChangesAsync();
            }
        }

        private enum ProposalStatusLike { Pending, Approved, Rejected }

        // ==================================================================
        // Requests
        // ==================================================================

        private static async Task SeedRequestsAsync(
            ReviveHrDbContext db, IReadOnlyDictionary<string, Employee> staff,
            int karimId, int omarId, int hrId)
        {
            if (await db.EmployeeRequests.AnyAsync(r => r.Type == "Resignation" && r.TargetEndDate == new DateOnly(2026, 11, 30)))
            {
                return;
            }

            var nour = staff["EMP-2001"];
            var youssef = staff["EMP-2002"];
            var mahmoud = staff["EMP-2003"];
            var rania = staff["EMP-2004"];
            var dina = staff["EMP-2005"];
            var hossam = staff["EMP-2006"];
            var laila = staff["EMP-2007"];
            var aya = staff["EMP-2008"];
            var khaled = staff["EMP-2009"];

            void AddDecision(EmployeeRequest request, ApprovalStage stage, DecisionOutcome outcome,
                int decidedBy, DateTime decidedAt, string? comment = null)
            {
                request.Decisions.Add(new RequestDecision
                {
                    Stage = stage,
                    Decision = outcome,
                    DecidedBy = decidedBy,
                    DecidedAt = decidedAt,
                    Comment = comment,
                });
            }

            // 1. Pending annual leave (Nour)
            db.EmployeeRequests.Add(new EmployeeRequest
            {
                EmployeeId = nour.Id,
                Type = "Leave",
                SubmittedAt = new DateTime(2026, 10, 19, 9, 12, 0, DateTimeKind.Utc),
                CreatedAt = new DateTime(2026, 10, 19, 9, 12, 0, DateTimeKind.Utc),
                RequestDate = new DateOnly(2026, 10, 19),
                TargetStartDate = new DateOnly(2026, 10, 28),
                TargetEndDate = new DateOnly(2026, 10, 30),
                Details = "Family travel to Alexandria — 3 days annual leave.",
                Status = RequestStatus.Pending,
            });

            // 2. Sick leave awaiting HR (Youssef) — stage 1 approved by Omar
            var sick = new EmployeeRequest
            {
                EmployeeId = youssef.Id,
                Type = "SickLeave",
                SubmittedAt = new DateTime(2026, 10, 19, 7, 40, 0, DateTimeKind.Utc),
                CreatedAt = new DateOnly(2026, 10, 19).ToDateTime(new TimeOnly(7, 40)),
                RequestDate = new DateOnly(2026, 10, 19),
                TargetStartDate = new DateOnly(2026, 10, 19),
                TargetEndDate = new DateOnly(2026, 10, 19),
                Details = "Food poisoning — doctor's note attached.",
                Status = RequestStatus.PendingHRReview,
            };
            AddDecision(sick, ApprovalStage.BranchManager, DecisionOutcome.Approved, omarId,
                new DateTime(2026, 10, 19, 8, 30, 0, DateTimeKind.Utc), "Get well soon — approved.");
            db.EmployeeRequests.Add(sick);

            // 3. Overtime (Rania)
            db.EmployeeRequests.Add(new EmployeeRequest
            {
                EmployeeId = rania.Id,
                Type = "Overtime",
                SubmittedAt = new DateTime(2026, 10, 20, 18, 5, 0, DateTimeKind.Utc),
                CreatedAt = new DateOnly(2026, 10, 20).ToDateTime(new TimeOnly(18, 5)),
                RequestDate = new DateOnly(2026, 10, 12),
                OvertimeHoursRequested = 6,
                Details = "Covering evening PT sessions during peak week.",
                Status = RequestStatus.Pending,
            });

            // 4. Shift swap (Mahmoud ↔ Karim)
            db.EmployeeRequests.Add(new EmployeeRequest
            {
                EmployeeId = mahmoud.Id,
                Type = "ShiftSwap",
                SubmittedAt = new DateTime(2026, 10, 21, 13, 22, 0, DateTimeKind.Utc),
                CreatedAt = new DateOnly(2026, 10, 21).ToDateTime(new TimeOnly(13, 22)),
                RequestDate = new DateOnly(2026, 10, 22),
                SwapWithEmployeeId = karimId,
                Details = "Swapping the Oct 25 morning shift — family commitment.",
                Status = RequestStatus.Pending,
            });

            // 5. Approved salary advance (Dina)
            var advance = new EmployeeRequest
            {
                EmployeeId = dina.Id,
                Type = "SalaryAdvance",
                SubmittedAt = new DateTime(2026, 10, 5, 10, 0, 0, DateTimeKind.Utc),
                CreatedAt = new DateOnly(2026, 10, 5).ToDateTime(new TimeOnly(10, 0)),
                RequestDate = new DateOnly(2026, 10, 5),
                RequestedAmount = 2000m,
                Details = "Medical expense advance — to be settled via payroll.",
                Status = RequestStatus.Approved,
            };
            AddDecision(advance, ApprovalStage.BranchManager, DecisionOutcome.Approved, omarId,
                new DateTime(2026, 10, 5, 12, 0, 0, DateTimeKind.Utc));
            AddDecision(advance, ApprovalStage.HR, DecisionOutcome.Approved, hrId,
                new DateTime(2026, 10, 6, 9, 0, 0, DateTimeKind.Utc), "Deduct from October payroll.");
            db.EmployeeRequests.Add(advance);

            // 6. Historical approved leave (Karim)
            var karimLeave = new EmployeeRequest
            {
                EmployeeId = karimId,
                Type = "Leave",
                SubmittedAt = new DateTime(2026, 9, 4, 11, 0, 0, DateTimeKind.Utc),
                CreatedAt = new DateOnly(2026, 9, 4).ToDateTime(new TimeOnly(11, 0)),
                RequestDate = new DateOnly(2026, 9, 4),
                TargetStartDate = new DateOnly(2026, 9, 14),
                TargetEndDate = new DateOnly(2026, 9, 16),
                Details = "Annual leave — 3 days.",
                Status = RequestStatus.Approved,
                Payment = "paid",
            };
            AddDecision(karimLeave, ApprovalStage.BranchManager, DecisionOutcome.Approved, omarId,
                new DateTime(2026, 9, 5, 9, 0, 0, DateTimeKind.Utc));
            AddDecision(karimLeave, ApprovalStage.HR, DecisionOutcome.Approved, hrId,
                new DateTime(2026, 9, 6, 10, 0, 0, DateTimeKind.Utc));
            db.EmployeeRequests.Add(karimLeave);

            // 7. Rejected leave (Sara)
            var sara = await db.Employees.FirstAsync(e => e.EmployeeNumber == "EMP-1060");
            var rejectedLeave = new EmployeeRequest
            {
                EmployeeId = sara.Id,
                Type = "Leave",
                SubmittedAt = new DateTime(2026, 9, 11, 15, 30, 0, DateTimeKind.Utc),
                CreatedAt = new DateOnly(2026, 9, 11).ToDateTime(new TimeOnly(15, 30)),
                RequestDate = new DateOnly(2026, 9, 11),
                TargetStartDate = new DateOnly(2026, 9, 20),
                TargetEndDate = new DateOnly(2026, 9, 22),
                Details = "Personal leave — 3 days.",
                Status = RequestStatus.Rejected,
            };
            AddDecision(rejectedLeave, ApprovalStage.BranchManager, DecisionOutcome.Approved, omarId,
                new DateTime(2026, 9, 12, 9, 0, 0, DateTimeKind.Utc));
            AddDecision(rejectedLeave, ApprovalStage.HR, DecisionOutcome.Rejected, hrId,
                new DateTime(2026, 9, 13, 11, 0, 0, DateTimeKind.Utc),
                "Coverage shortage during members' day — please resubmit for October.");
            db.EmployeeRequests.Add(rejectedLeave);

            // 8. Approved day off (Hossam)
            var dayOff = new EmployeeRequest
            {
                EmployeeId = hossam.Id,
                Type = "DayOff",
                SubmittedAt = new DateTime(2026, 10, 14, 9, 0, 0, DateTimeKind.Utc),
                CreatedAt = new DateOnly(2026, 10, 14).ToDateTime(new TimeOnly(9, 0)),
                RequestDate = new DateOnly(2026, 10, 14),
                TargetStartDate = new DateOnly(2026, 10, 20),
                TargetEndDate = new DateOnly(2026, 10, 20),
                Details = "Personal day.",
                Status = RequestStatus.Approved,
            };
            AddDecision(dayOff, ApprovalStage.BranchManager, DecisionOutcome.Approved, omarId,
                new DateTime(2026, 10, 14, 10, 0, 0, DateTimeKind.Utc));
            AddDecision(dayOff, ApprovalStage.HR, DecisionOutcome.Approved, hrId,
                new DateTime(2026, 10, 15, 8, 30, 0, DateTimeKind.Utc));
            db.EmployeeRequests.Add(dayOff);

            // 9. Pending leave at Second Gym (Aya)
            db.EmployeeRequests.Add(new EmployeeRequest
            {
                EmployeeId = aya.Id,
                Type = "Leave",
                SubmittedAt = new DateTime(2026, 10, 22, 12, 0, 0, DateTimeKind.Utc),
                CreatedAt = new DateOnly(2026, 10, 22).ToDateTime(new TimeOnly(12, 0)),
                RequestDate = new DateOnly(2026, 10, 22),
                TargetStartDate = new DateOnly(2026, 11, 3),
                TargetEndDate = new DateOnly(2026, 11, 5),
                Details = "Wedding of a close friend — 3 days.",
                Status = RequestStatus.Pending,
            });

            // 10. Overtime awaiting HR (Khaled)
            var khaledOt = new EmployeeRequest
            {
                EmployeeId = khaled.Id,
                Type = "Overtime",
                SubmittedAt = new DateTime(2026, 10, 15, 20, 0, 0, DateTimeKind.Utc),
                CreatedAt = new DateOnly(2026, 10, 15).ToDateTime(new TimeOnly(20, 0)),
                RequestDate = new DateOnly(2026, 10, 15),
                OvertimeHoursRequested = 4,
                Details = "Weekend PT catch-up sessions.",
                Status = RequestStatus.PendingHRReview,
            };
            AddDecision(khaledOt, ApprovalStage.BranchManager, DecisionOutcome.Approved, omarId,
                new DateTime(2026, 10, 16, 9, 0, 0, DateTimeKind.Utc));
            db.EmployeeRequests.Add(khaledOt);

            // 11. Resignation (Laila) — matches the offboarding case below
            var resignation = new EmployeeRequest
            {
                EmployeeId = laila.Id,
                Type = "Resignation",
                SubmittedAt = new DateTime(2026, 10, 20, 9, 0, 0, DateTimeKind.Utc),
                CreatedAt = new DateOnly(2026, 10, 20).ToDateTime(new TimeOnly(9, 0)),
                RequestDate = new DateOnly(2026, 10, 20),
                TargetEndDate = new DateOnly(2026, 11, 30),
                Details = "Resigning for family relocation — last working day Nov 30.",
                Status = RequestStatus.Approved,
            };
            AddDecision(resignation, ApprovalStage.BranchManager, DecisionOutcome.Approved, omarId,
                new DateTime(2026, 10, 20, 11, 0, 0, DateTimeKind.Utc), "Approved with regret — strong trainer.");
            AddDecision(resignation, ApprovalStage.HR, DecisionOutcome.Approved, hrId,
                new DateTime(2026, 10, 21, 9, 0, 0, DateTimeKind.Utc), "Offboarding case opened.");
            db.EmployeeRequests.Add(resignation);

            await db.SaveChangesAsync();
        }

        // ==================================================================
        // Offboarding (Terminations)
        // ==================================================================

        private static async Task<OffboardingCase> SeedOffboardingAsync(
            ReviveHrDbContext db, IReadOnlyDictionary<string, Employee> staff, int omarId, int hrManagerId, int hrId)
        {
            var laila = staff["EMP-2007"];
            var mostafa = staff["EMP-2011"];

            var lailaCase = await db.OffboardingCases.FirstOrDefaultAsync(c => c.EmployeeId == laila.Id);
            if (lailaCase is null)
            {
                lailaCase = new OffboardingCase
                {
                    EmployeeId = laila.Id,
                    LastWorkingDate = new DateOnly(2026, 11, 30),
                    Reason = "Family relocation",
                    Status = "Notice Period",
                    SeparationType = "Resignation",
                    InitiatedBy = omarId,
                    InitiatedAt = new DateTime(2026, 10, 20, 11, 30, 0, DateTimeKind.Utc),
                    Notes = "Handover of evening classes in progress.",
                };
                db.OffboardingCases.Add(lailaCase);
            }

            if (!await db.OffboardingCases.AnyAsync(c => c.EmployeeId == mostafa.Id))
            {
                db.OffboardingCases.Add(new OffboardingCase
                {
                    EmployeeId = mostafa.Id,
                    LastWorkingDate = new DateOnly(2026, 10, 10),
                    Reason = "Gross misconduct",
                    Status = "Completed",
                    SeparationType = "Termination",
                    InitiatedBy = hrManagerId,
                    InitiatedAt = new DateTime(2026, 9, 28, 10, 0, 0, DateTimeKind.Utc),
                    CompletedAt = new DateTime(2026, 10, 12, 14, 0, 0, DateTimeKind.Utc),
                    Notes = "Escalated by the Second Gym branch manager.",
                    FinalReason = "Repeated policy violations after two written warnings",
                    SettlementDirection = "employeeOwes",
                    SettlementAmount = 1200m,
                    SettlementNote = "Unreturned equipment — deducted from final settlement.",
                    RehireStatus = "Banned",
                    RehireNote = "Do not rehire.",
                });
            }

            await db.SaveChangesAsync();
            return lailaCase;
        }

        // ==================================================================
        // Recruitment
        // ==================================================================

        private static async Task SeedRecruitmentAsync(
            ReviveHrDbContext db,
            IReadOnlyDictionary<(int GymId, string Title), Position> positions,
            Employee hiredEmployee,
            int hrId, int hrManagerId)
        {
            if (await db.Vacancies.AnyAsync(v => v.PublicLinkToken == "seed-vac-pt-evening-2026"))
            {
                return;
            }

            var gym1Id = (await db.Gyms.FirstAsync(g => g.Name == DevelopmentDataSeeder.Gym1Name)).Id;
            var gym2Id = (await db.Gyms.FirstAsync(g => g.Name == DevelopmentDataSeeder.Gym2Name)).Id;

            var vacancyPt = new Vacancy
            {
                GymId = gym1Id,
                PositionId = positions[(gym1Id, "Personal Trainer")].Id,
                Title = "Personal Trainer — Evening Shift",
                Description = "Evening-shift personal trainer for the Main Gym floor (16:00–00:00).",
                Requirements = "2+ years coaching experience; ISSA or equivalent certificate; native Arabic, good English.",
                HeadcountNeeded = 2,
                PublicLinkToken = "seed-vac-pt-evening-2026",
                Status = VacancyStatus.Open,
                Urgency = "High",
                Salary = 9500m,
                Shift = "Evening",
                Source = "Website",
                RequestedBy = hrId,
                CreatedDate = new DateTime(2026, 9, 20, 10, 0, 0, DateTimeKind.Utc),
            };
            var vacancyFd = new Vacancy
            {
                GymId = gym1Id,
                PositionId = positions[(gym1Id, "Receptionist")].Id,
                Title = "Front Desk Receptionist",
                Description = "Morning-shift front desk receptionist — member check-ins, phone, sales leads.",
                Requirements = "Fresh graduates welcome; MS Office; strong communication.",
                HeadcountNeeded = 1,
                PublicLinkToken = "seed-vac-reception-2026",
                Status = VacancyStatus.Open,
                Urgency = "Medium",
                Salary = 6500m,
                Shift = "Morning",
                Source = "Referral",
                RequestedBy = hrId,
                CreatedDate = new DateTime(2026, 10, 2, 9, 0, 0, DateTimeKind.Utc),
            };
            var vacancyTrainer2 = new Vacancy
            {
                GymId = gym2Id,
                PositionId = positions[(gym2Id, "Fitness Trainer")].Id,
                Title = "Fitness Trainer — Morning Shift",
                Description = "Morning-shift fitness trainer for the Second Gym.",
                Requirements = "1+ year floor experience; trainer certificate.",
                HeadcountNeeded = 1,
                PublicLinkToken = "seed-vac-trainer-g2-2026",
                Status = VacancyStatus.Closed,
                Urgency = "Low",
                Salary = 9000m,
                Shift = "Morning",
                Source = "Job board",
                RequestedBy = hrId,
                CreatedDate = new DateTime(2026, 8, 10, 9, 0, 0, DateTimeKind.Utc),
            };
            db.Vacancies.AddRange(vacancyPt, vacancyFd, vacancyTrainer2);
            await db.SaveChangesAsync();

            var candidateSeeds = new[]
            {
                new CandidateSeed("Mostafa Atef", "mostafa.atef@gmail.com", "01123456001",
                    new DateOnly(1996, 4, 12), "28100198765401", 4.5m),
                new CandidateSeed("Habiba Emad", "habiba.emad@gmail.com", "01123456002",
                    new DateOnly(1999, 7, 3), "28100298765402", 4.0m),
                new CandidateSeed("Ziad Maher", "ziad.maher@gmail.com", "01123456003",
                    new DateOnly(1994, 1, 25), "28100398765403", 3.5m),
                new CandidateSeed("Nada Ashraf", "nada.ashraf@gmail.com", "01123456004",
                    new DateOnly(2001, 10, 9), "28100498765404", null),
                new CandidateSeed("Fady Raouf", "fady.raouf@gmail.com", "01123456005",
                    new DateOnly(1992, 12, 30), "28100598765405", 3.0m),
                new CandidateSeed("Rowan Alaa", "rowan.alaa@gmail.com", "01123456006",
                    new DateOnly(1998, 6, 18), "28100698765406", 4.5m),
                new CandidateSeed("Amr Tarek", "amr.tarek@gmail.com", "01123456007",
                    new DateOnly(1995, 3, 7), "28100798765407", null),
                new CandidateSeed("Jana Sameh", "jana.sameh@gmail.com", "01123456008",
                    new DateOnly(2000, 8, 21), "28100898765408", null, Blocked: true,
                    BlockReason: "No-show for two scheduled interviews."),
            };

            var candidates = new List<Candidate>();
            foreach (var (index, seed) in candidateSeeds.Select((s, i) => (i, s)))
            {
                var candidate = new Candidate
                {
                    FullName = seed.FullName,
                    Email = seed.Email,
                    Phone = seed.Phone,
                    DateOfBirth = seed.Dob,
                    NationalId = seed.NationalId,
                    Rating = seed.Rating,
                    Blocked = seed.Blocked,
                    BlockReason = seed.BlockReason,
                    EducationJson = "[\"BSc Physical Education\"]",
                    ExperienceJson = $"[{{\"years\":{2 + index % 4},\"place\":\"Previous gym\"}}]",
                    SkillsJson = "[\"Member coaching\",\"Nutrition basics\"]",
                };
                candidates.Add(candidate);
            }

            db.Candidates.AddRange(candidates);
            await db.SaveChangesAsync();
            var (c1, c2, c3, c4, c5, c6, c7, c8) = (
                candidates[0], candidates[1], candidates[2], candidates[3],
                candidates[4], candidates[5], candidates[6], candidates[7]);

            PipelineStage Stage(Application app, PipelineStageType stage, DateTime entered,
                DateTime? completed = null, string? outcome = null, string? action = null, DateTime? due = null)
            {
                return new PipelineStage
                {
                    Application = app,
                    Stage = stage,
                    EnteredDate = entered,
                    CompletedDate = completed,
                    Outcome = outcome,
                    RequiredAction = action,
                    ActionDueDate = due,
                    ByUserId = hrId,
                };
            }

            // A1 — screening, CV review due (staleness demo candidate)
            var a1 = new Application
            {
                Vacancy = vacancyPt,
                Candidate = c1,
                AppliedDate = new DateTime(2026, 9, 25, 11, 0, 0, DateTimeKind.Utc),
                CurrentStage = PipelineStageType.Screening,
                Status = ApplicationStatus.InProgress,
                Source = "Website",
                ExperienceYears = 3,
                Education = "BSc Physical Education",
                LanguagesJson = "[\"Arabic\",\"English\"]",
                ShiftPreference = "Evening",
                SalaryExpectation = 9000m,
                Availability = "Immediately",
                LastActivityAt = new DateTime(2026, 10, 20, 10, 0, 0, DateTimeKind.Utc),
            };
            a1.PipelineStages.Add(Stage(a1, PipelineStageType.Applied,
                new DateTime(2026, 9, 25, 11, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 9, 25, 11, 0, 0, DateTimeKind.Utc), "Passed"));
            a1.PipelineStages.Add(Stage(a1, PipelineStageType.Screening,
                new DateTime(2026, 10, 3, 10, 0, 0, DateTimeKind.Utc),
                action: "Review CV and call for screening", due: new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc)));

            // A2 — first interview scheduled
            var a2 = new Application
            {
                Vacancy = vacancyPt,
                Candidate = c2,
                AppliedDate = new DateTime(2026, 9, 28, 14, 0, 0, DateTimeKind.Utc),
                CurrentStage = PipelineStageType.FirstInterview,
                Status = ApplicationStatus.InProgress,
                Source = "Website",
                ExperienceYears = 4,
                Education = "BA Sports Science",
                LanguagesJson = "[\"Arabic\",\"English\",\"French\"]",
                ShiftPreference = "Evening",
                SalaryExpectation = 9500m,
                Availability = "2 weeks notice",
                LastActivityAt = new DateTime(2026, 10, 21, 9, 0, 0, DateTimeKind.Utc),
            };
            a2.PipelineStages.Add(Stage(a2, PipelineStageType.Applied,
                new DateTime(2026, 9, 28, 14, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 9, 28, 14, 0, 0, DateTimeKind.Utc), "Passed"));
            a2.PipelineStages.Add(Stage(a2, PipelineStageType.Screening,
                new DateTime(2026, 10, 5, 10, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 10, 12, 10, 0, 0, DateTimeKind.Utc), "Passed"));
            a2.PipelineStages.Add(Stage(a2, PipelineStageType.FirstInterview,
                new DateTime(2026, 10, 21, 9, 0, 0, DateTimeKind.Utc),
                action: "Conduct first interview", due: new DateTime(2026, 10, 28, 0, 0, 0, DateTimeKind.Utc)));
            a2.Interviews.Add(new Interview
            {
                Application = a2,
                Stage = PipelineStageType.FirstInterview,
                ScheduledDate = new DateTime(2026, 10, 28, 13, 0, 0, DateTimeKind.Utc),
                Outcome = InterviewOutcome.Pending,
                Status = "Scheduled",
                Type = "On-site",
                Room = "Meeting Room 1",
                ConductedBy = hrId,
            });

            // A3 — passed first interview, second interview scheduled
            var a3 = new Application
            {
                Vacancy = vacancyPt,
                Candidate = c3,
                AppliedDate = new DateTime(2026, 9, 18, 9, 30, 0, DateTimeKind.Utc),
                CurrentStage = PipelineStageType.SecondInterview,
                Status = ApplicationStatus.InProgress,
                Source = "Job board",
                ExperienceYears = 5,
                Education = "MSc Exercise Physiology",
                LanguagesJson = "[\"Arabic\",\"English\"]",
                ShiftPreference = "Evening",
                SalaryExpectation = 10000m,
                Availability = "Next month",
                LastActivityAt = new DateTime(2026, 10, 22, 15, 0, 0, DateTimeKind.Utc),
            };
            a3.PipelineStages.Add(Stage(a3, PipelineStageType.Applied,
                new DateTime(2026, 9, 18, 9, 30, 0, DateTimeKind.Utc),
                new DateTime(2026, 9, 18, 9, 30, 0, DateTimeKind.Utc), "Passed"));
            a3.PipelineStages.Add(Stage(a3, PipelineStageType.Screening,
                new DateTime(2026, 9, 24, 11, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 10, 1, 11, 0, 0, DateTimeKind.Utc), "Passed"));
            a3.PipelineStages.Add(Stage(a3, PipelineStageType.FirstInterview,
                new DateTime(2026, 10, 8, 13, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 10, 15, 14, 0, 0, DateTimeKind.Utc), "Passed"));
            a3.PipelineStages.Add(Stage(a3, PipelineStageType.SecondInterview,
                new DateTime(2026, 10, 22, 15, 0, 0, DateTimeKind.Utc),
                action: "Final interview with HR Manager", due: new DateTime(2026, 10, 27, 0, 0, 0, DateTimeKind.Utc)));
            a3.Interviews.Add(new Interview
            {
                Application = a3,
                Stage = PipelineStageType.FirstInterview,
                ScheduledDate = new DateTime(2026, 10, 15, 13, 0, 0, DateTimeKind.Utc),
                Outcome = InterviewOutcome.Passed,
                InterviewerNotes = "Strong practical demo; member-communication skills above bar.",
                Status = "Completed",
                Verdict = "Pass",
                Evaluation = "Excellent floor presence.",
                CompletedAt = new DateTime(2026, 10, 15, 14, 0, 0, DateTimeKind.Utc),
                Type = "Trial",
                Room = "Gym floor",
                ConductedBy = hrManagerId,
            });
            a3.Interviews.Add(new Interview
            {
                Application = a3,
                Stage = PipelineStageType.SecondInterview,
                ScheduledDate = new DateTime(2026, 10, 27, 15, 0, 0, DateTimeKind.Utc),
                Outcome = InterviewOutcome.Pending,
                Status = "Scheduled",
                Type = "Video",
                Room = "meet.example.com/revive-interview",
                ConductedBy = hrId,
            });

            // A4 — fresh application, untouched (follow-up staleness demo)
            var a4 = new Application
            {
                Vacancy = vacancyPt,
                Candidate = c4,
                AppliedDate = new DateTime(2026, 10, 12, 16, 0, 0, DateTimeKind.Utc),
                CurrentStage = PipelineStageType.Applied,
                Status = ApplicationStatus.InProgress,
                Source = "Instagram",
                ExperienceYears = 1,
                LanguagesJson = "[\"Arabic\"]",
                ShiftPreference = "Evening",
                Availability = "Immediately",
                LastActivityAt = new DateTime(2026, 10, 12, 16, 0, 0, DateTimeKind.Utc),
            };
            a4.PipelineStages.Add(Stage(a4, PipelineStageType.Applied,
                new DateTime(2026, 10, 12, 16, 0, 0, DateTimeKind.Utc),
                action: "Screen new application", due: new DateTime(2026, 10, 19, 0, 0, 0, DateTimeKind.Utc)));

            // A5 — receptionist screening
            var a5 = new Application
            {
                Vacancy = vacancyFd,
                Candidate = c5,
                AppliedDate = new DateTime(2026, 10, 8, 10, 0, 0, DateTimeKind.Utc),
                CurrentStage = PipelineStageType.Screening,
                Status = ApplicationStatus.InProgress,
                Source = "Referral",
                ExperienceYears = 2,
                Education = "Commercial diploma",
                LanguagesJson = "[\"Arabic\",\"English\"]",
                ShiftPreference = "Morning",
                SalaryExpectation = 6500m,
                Availability = "Immediately",
                LastActivityAt = new DateTime(2026, 10, 19, 11, 0, 0, DateTimeKind.Utc),
            };
            a5.PipelineStages.Add(Stage(a5, PipelineStageType.Applied,
                new DateTime(2026, 10, 8, 10, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 10, 8, 10, 0, 0, DateTimeKind.Utc), "Passed"));
            a5.PipelineStages.Add(Stage(a5, PipelineStageType.Screening,
                new DateTime(2026, 10, 19, 11, 0, 0, DateTimeKind.Utc),
                action: "Phone screening", due: new DateTime(2026, 10, 26, 0, 0, 0, DateTimeKind.Utc)));

            // A6 — hired (became Rania Mostafa Atef)
            var a6 = new Application
            {
                Vacancy = vacancyPt,
                Candidate = c6,
                AppliedDate = new DateTime(2026, 9, 10, 9, 0, 0, DateTimeKind.Utc),
                CurrentStage = PipelineStageType.Hired,
                Status = ApplicationStatus.Hired,
                Source = "Referral",
                ExperienceYears = 4,
                Education = "BSc Physical Education",
                LanguagesJson = "[\"Arabic\",\"English\"]",
                ShiftPreference = "Evening",
                SalaryExpectation = 9000m,
                Availability = "Immediately",
                HiredDate = new DateTime(2026, 10, 1, 12, 0, 0, DateTimeKind.Utc),
                HiredBy = hrId,
                DecisionBy = hrId,
                DecisionAt = new DateTime(2026, 10, 1, 12, 0, 0, DateTimeKind.Utc),
                DecisionNote = "Strong trial session; offered 9,000 EGP.",
                LastActivityAt = new DateTime(2026, 10, 1, 12, 0, 0, DateTimeKind.Utc),
            };
            foreach (var (stage, entered) in new[]
            {
                (PipelineStageType.Applied, new DateTime(2026, 9, 10, 9, 0, 0, DateTimeKind.Utc)),
                (PipelineStageType.Screening, new DateTime(2026, 9, 16, 9, 0, 0, DateTimeKind.Utc)),
                (PipelineStageType.FirstInterview, new DateTime(2026, 9, 22, 13, 0, 0, DateTimeKind.Utc)),
                (PipelineStageType.SecondInterview, new DateTime(2026, 9, 28, 15, 0, 0, DateTimeKind.Utc)),
                (PipelineStageType.Accepted, new DateTime(2026, 9, 30, 10, 0, 0, DateTimeKind.Utc)),
                (PipelineStageType.Hired, new DateTime(2026, 10, 1, 12, 0, 0, DateTimeKind.Utc)),
            })
            {
                a6.PipelineStages.Add(Stage(a6, stage, entered, entered, "Passed"));
            }

            // A7 — rejected after failed interview
            var a7 = new Application
            {
                Vacancy = vacancyTrainer2,
                Candidate = c7,
                AppliedDate = new DateTime(2026, 8, 15, 10, 0, 0, DateTimeKind.Utc),
                CurrentStage = PipelineStageType.Rejected,
                Status = ApplicationStatus.Rejected,
                Source = "Job board",
                ExperienceYears = 1,
                ShiftPreference = "Morning",
                RejectedAt = new DateTime(2026, 9, 5, 12, 0, 0, DateTimeKind.Utc),
                RejectedBy = hrManagerId,
                RejectReason = "Insufficient coaching experience for the trainer role.",
                LastActivityAt = new DateTime(2026, 9, 5, 12, 0, 0, DateTimeKind.Utc),
            };
            a7.PipelineStages.Add(Stage(a7, PipelineStageType.Applied,
                new DateTime(2026, 8, 15, 10, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 8, 15, 10, 0, 0, DateTimeKind.Utc), "Passed"));
            a7.PipelineStages.Add(Stage(a7, PipelineStageType.Screening,
                new DateTime(2026, 8, 20, 10, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 8, 28, 10, 0, 0, DateTimeKind.Utc), "Passed"));
            a7.PipelineStages.Add(Stage(a7, PipelineStageType.FirstInterview,
                new DateTime(2026, 9, 1, 13, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 9, 4, 14, 0, 0, DateTimeKind.Utc), "Failed"));
            a7.Interviews.Add(new Interview
            {
                Application = a7,
                Stage = PipelineStageType.FirstInterview,
                ScheduledDate = new DateTime(2026, 9, 4, 13, 0, 0, DateTimeKind.Utc),
                Outcome = InterviewOutcome.Failed,
                InterviewerNotes = "Practical knowledge below the bar for a solo floor trainer.",
                Status = "Completed",
                Verdict = "Fail",
                CompletedAt = new DateTime(2026, 9, 4, 14, 0, 0, DateTimeKind.Utc),
                Type = "On-site",
                Room = "Meeting Room 2",
                ConductedBy = hrManagerId,
            });

            // A8 — waiting list (blocked candidate kept for January intake)
            var a8 = new Application
            {
                Vacancy = vacancyPt,
                Candidate = c8,
                AppliedDate = new DateTime(2026, 10, 5, 12, 0, 0, DateTimeKind.Utc),
                CurrentStage = PipelineStageType.Applied,
                Status = ApplicationStatus.WaitingList,
                Source = "Walk-in",
                ExperienceYears = 2,
                ShiftPreference = "Evening",
                Notes = "Strong CV — revisit for the January intake after the no-shows are reviewed.",
                LastActivityAt = new DateTime(2026, 10, 15, 12, 0, 0, DateTimeKind.Utc),
            };
            a8.PipelineStages.Add(Stage(a8, PipelineStageType.Applied,
                new DateTime(2026, 10, 5, 12, 0, 0, DateTimeKind.Utc), null, null,
                "Review availability", new DateTime(2026, 10, 12, 0, 0, 0, DateTimeKind.Utc)));

            db.Applications.AddRange(a1, a2, a3, a4, a5, a6, a7, a8);
            await db.SaveChangesAsync();

            // Link the hired candidate to Rania's employee profile.
            hiredEmployee.CandidateId = c6.Id;
            hiredEmployee.OnboardingCompletedBy = hrId;
            hiredEmployee.OnboardingCompletedAt = new DateTime(2026, 10, 1, 12, 30, 0, DateTimeKind.Utc);
            await db.SaveChangesAsync();
        }

        // ==================================================================
        // Escalation queues (VacancyRequest + ActionRequest)
        // ==================================================================

        /// <summary>
        /// Seeds the two queues the recruitment/events modules read directly and that no
        /// other section covers: <see cref="VacancyRequest"/> (branch-manager requisitions
        /// HR approves into a <see cref="Vacancy"/>) and <see cref="ActionRequest"/> (the
        /// HR escalation queue behind the Events "Escalated" tab). Idempotent — keyed on
        /// the justification text so an interrupted run resumes without duplicating.
        /// </summary>
        private static async Task SeedEscalationQueuesAsync(
            ReviveHrDbContext db,
            IReadOnlyDictionary<(int GymId, string Title), Position> positions,
            IReadOnlyDictionary<string, Employee> staff,
            int omarId, int hrId, int hrManagerId)
        {
            if (!await db.VacancyRequests.AnyAsync(v => v.Justification == "Peak-season floor coverage"))
            {
                var gym1Id = (await db.Gyms.FirstAsync(g => g.Name == DevelopmentDataSeeder.Gym1Name)).Id;
                var gym2Id = (await db.Gyms.FirstAsync(g => g.Name == DevelopmentDataSeeder.Gym2Name)).Id;

                db.VacancyRequests.AddRange(
                    new VacancyRequest
                    {
                        GymId = gym1Id,
                        PositionId = positions[(gym1Id, "Personal Trainer")].Id,
                        RequestedBy = omarId,
                        Justification = "Peak-season floor coverage",
                        Status = VacancyRequestStatus.Pending,
                        Urgency = "High",
                        Salary = 9500m,
                        Shift = "Evening",
                        Headcount = 2,
                        SubmittedDate = new DateTime(2026, 10, 18, 9, 30, 0, DateTimeKind.Utc),
                    },
                    new VacancyRequest
                    {
                        GymId = gym2Id,
                        PositionId = positions[(gym2Id, "Nutrition Coach")].Id,
                        RequestedBy = omarId,
                        Justification = "Weekend nutrition clinic demand",
                        Status = VacancyRequestStatus.Pending,
                        Urgency = "Medium",
                        Salary = 11000m,
                        Shift = "Weekend",
                        Headcount = 1,
                        SubmittedDate = new DateTime(2026, 10, 21, 17, 5, 0, DateTimeKind.Utc),
                    },
                    new VacancyRequest
                    {
                        GymId = gym1Id,
                        PositionId = positions[(gym1Id, "Cleaner")].Id,
                        RequestedBy = omarId,
                        Justification = "Replacement for a resigned cleaner",
                        Status = VacancyRequestStatus.Approved,
                        Urgency = "Low",
                        Salary = 4500m,
                        Shift = "Morning",
                        Headcount = 1,
                        SubmittedDate = new DateTime(2026, 10, 5, 8, 0, 0, DateTimeKind.Utc),
                        DecidedBy = hrId,
                        DecidedAt = new DateTime(2026, 10, 7, 11, 0, 0, DateTimeKind.Utc),
                        DecisionComment = "Approved — opening the vacancy on the public careers page.",
                    });
                await db.SaveChangesAsync();
            }

            if (!await db.ActionRequests.AnyAsync(a => a.Justification == "Requested by branch manager"))
            {
                var gym1Id = (await db.Gyms.FirstAsync(g => g.Name == DevelopmentDataSeeder.Gym1Name)).Id;
                var hossam = staff["EMP-2006"];

                db.ActionRequests.AddRange(
                    new ActionRequest
                    {
                        GymId = gym1Id,
                        EmployeeId = hossam.Id,
                        ActionType = "Transfer",
                        ProposedDetailsJson = """{"fromGym":"Revive Main Gym","toGym":"Revive Second Gym","effectiveDate":"2026-11-01","reason":"Requested relocation closer to home"}""",
                        Justification = "Requested by branch manager",
                        RequestedById = omarId,
                        Status = "Pending",
                        SubmittedDate = new DateTime(2026, 10, 19, 12, 0, 0, DateTimeKind.Utc),
                    },
                    new ActionRequest
                    {
                        GymId = gym1Id,
                        EmployeeId = hossam.Id,
                        ActionType = "CompensationChange",
                        ProposedDetailsJson = """{"currentSalary":9000,"newSalary":9750,"effectiveDate":"2026-11-01","reason":"Annual increase review"}""",
                        Justification = "Requested by branch manager",
                        RequestedById = omarId,
                        Status = "Approved",
                        SubmittedDate = new DateTime(2026, 10, 10, 9, 0, 0, DateTimeKind.Utc),
                        ReviewedById = hrManagerId,
                        ReviewedDate = new DateTime(2026, 10, 12, 15, 30, 0, DateTimeKind.Utc),
                        ReviewComment = "Within the annual increase band — approved.",
                    },
                    new ActionRequest
                    {
                        GymId = gym1Id,
                        EmployeeId = hossam.Id,
                        ActionType = "RoleAssign",
                        ProposedDetailsJson = """{"systemRole":"TeamLeader","effectiveDate":"2026-10-15","reason":"Promoted to front-desk shift lead"}""",
                        Justification = "Requested by branch manager",
                        RequestedById = omarId,
                        Status = "Rejected",
                        SubmittedDate = new DateTime(2026, 9, 28, 14, 0, 0, DateTimeKind.Utc),
                        ReviewedById = hrManagerId,
                        ReviewedDate = new DateTime(2026, 10, 2, 10, 0, 0, DateTimeKind.Utc),
                        ReviewComment = "Hold until the probation review closes.",
                    });
                await db.SaveChangesAsync();
            }
        }

        // ==================================================================
        // Evaluations
        // ==================================================================

        private static async Task SeedEvaluationsAsync(
            ReviveHrDbContext db, int gym1Id,
            IReadOnlyDictionary<(int GymId, string Title), Position> positions,
            IReadOnlyDictionary<string, Employee> staff,
            int karimUserId, int hrId, int hrManagerId)
        {
            // Forms and responses are guarded independently: an earlier crashed run may have
            // committed the forms and unwound before the responses were saved.
            var form = await db.EvaluationForms
                .Include(f => f.Questions)
                .FirstOrDefaultAsync(f => f.Name == "Trainer Performance Review — Q3 2026");

            if (form is null)
            {
                form = new EvaluationForm
                {
                    GymId = gym1Id,
                    PositionId = positions[(gym1Id, "Fitness Trainer")].Id,
                    Name = "Trainer Performance Review — Q3 2026",
                    IsActive = true,
                    Status = "Active",
                    Target = "Fitness Trainer",
                    CreatedDate = new DateTime(2026, 9, 1, 10, 0, 0, DateTimeKind.Utc),
                    LastUsedAt = new DateTime(2026, 10, 8, 15, 0, 0, DateTimeKind.Utc),
                };
                foreach (var (text, type, order, options) in new (string, EvaluationQuestionType, int, string?)[]
                {
                    ("Quality of coaching sessions", EvaluationQuestionType.Rating5, 1, null),
                    ("Punctuality and attendance discipline", EvaluationQuestionType.Rating5, 2, null),
                    ("Member feedback score", EvaluationQuestionType.Rating5, 3, null),
                    ("Teamwork with floor staff", EvaluationQuestionType.Rating5, 4, null),
                    ("Overall conduct", EvaluationQuestionType.MultipleChoice, 5,
                        "[\"Excellent\",\"Good\",\"Average\",\"Poor\"]"),
                })
                {
                    form.Questions.Add(new EvaluationQuestion
                    {
                        QuestionText = text,
                        QuestionType = type,
                        SortOrder = order,
                        OptionsJson = options,
                    });
                }

                db.EvaluationForms.Add(form);
                await db.SaveChangesAsync();
            }

            var probation = await db.EvaluationForms
                .FirstOrDefaultAsync(f => f.Name == "Probation Review — First 90 Days");

            if (probation is null)
            {
                probation = new EvaluationForm
                {
                    GymId = gym1Id,
                    Name = "Probation Review — First 90 Days",
                    IsActive = true,
                    Status = "Active",
                    Target = "All",
                    CreatedDate = new DateTime(2026, 9, 15, 10, 0, 0, DateTimeKind.Utc),
                };
                foreach (var (text, type, order, options) in new (string, EvaluationQuestionType, int, string?)[]
                {
                    ("Role understanding", EvaluationQuestionType.Rating5, 1, null),
                    ("Initiative shown", EvaluationQuestionType.Rating5, 2, null),
                    ("Training completed", EvaluationQuestionType.Checkbox, 3,
                        "[\"Product knowledge\",\"Safety protocol\",\"Member service\"]"),
                })
                {
                    probation.Questions.Add(new EvaluationQuestion
                    {
                        QuestionText = text,
                        QuestionType = type,
                        SortOrder = order,
                        OptionsJson = options,
                    });
                }

                db.EvaluationForms.Add(probation);
                await db.SaveChangesAsync();
            }

            // Responses are guarded separately from the forms: the forms may already exist
            // from an earlier run that crashed before the responses were committed.
            if (await db.EvaluationResponses.AnyAsync())
            {
                return;
            }

            var formQuestions = form.Questions.OrderBy(q => q.SortOrder).ToList();

            EvaluationResponse Response(Employee employee, int evaluatorId, DateTime submittedAt,
                string[] answers, string comment, string period, string status = "Completed")
            {
                var response = new EvaluationResponse
                {
                    EvaluationFormId = form.Id,
                    EmployeeId = employee.Id,
                    EvaluatedBy = evaluatorId,
                    SubmittedAt = submittedAt,
                    Period = period,
                    OverallComment = comment,
                    Status = status,
                };
                var ratingSum = 0m;
                for (var q = 0; q < answers.Length && q < formQuestions.Count; q++)
                {
                    var question = formQuestions[q];
                    string json;
                    if (question.QuestionType is EvaluationQuestionType.MultipleChoice or EvaluationQuestionType.Checkbox)
                    {
                        json = System.Text.Json.JsonSerializer.Serialize(new
                        {
                            selectedValues = new[] { answers[q] },
                            comment = (string?)null,
                        });
                    }
                    else
                    {
                        var score = decimal.Parse(answers[q]);
                        ratingSum += score;
                        json = System.Text.Json.JsonSerializer.Serialize(new { score, comment = (string?)null });
                    }

                    response.Answers.Add(new EvaluationAnswer
                    {
                        EvaluationQuestionId = question.Id,
                        AnswerValueJson = json,
                    });
                }

                var ratingCount = formQuestions.Count(q => q.QuestionType == EvaluationQuestionType.Rating5);
                response.Score = Math.Round(ratingSum / (ratingCount * 5) * 100, 0);
                return response;
            }

            var karim = await db.Employees.FirstAsync(e => e.UserId == karimUserId);
            db.EvaluationResponses.AddRange(
                Response(karim, hrManagerId, new DateTime(2026, 9, 28, 14, 0, 0, DateTimeKind.Utc),
                    new[] { "5", "4", "5", "4", "Excellent" },
                    "Consistent top performer — recommend the senior-trainer development track.",
                    "Q3 2026"),
                Response(staff["EMP-2001"], hrId, new DateTime(2026, 10, 5, 11, 0, 0, DateTimeKind.Utc),
                    new[] { "4", "5", "4", "4", "Good" },
                    "Solid front-desk coverage; start cross-training on PT sales.",
                    "Q3 2026"),
                Response(staff["EMP-2002"], hrId, new DateTime(2026, 10, 8, 15, 0, 0, DateTimeKind.Utc),
                    new[] { "5", "5", "4", "5", "Excellent" },
                    "Outstanding member retention on nutrition plans.",
                    "Q3 2026"));

            db.EvaluationResponses.Add(new EvaluationResponse
            {
                EvaluationFormId = probation.Id,
                EmployeeId = staff["EMP-2012"].Id,
                EvaluatedBy = hrManagerId,
                SubmittedAt = new DateTime(2026, 10, 20, 10, 0, 0, DateTimeKind.Utc),
                Period = "Probation — 90 days",
                Status = "In Progress",
                Notes = "First-month check-in done; final verdict due mid-December.",
            });

            await db.SaveChangesAsync();
        }

        // ==================================================================
        // Announcements + inbox notifications
        // ==================================================================

        private static async Task SeedAnnouncementsAndNotificationsAsync(
            ReviveHrDbContext db, int gym1Id, int gym2Id, int hrId, int hrManagerId, int omarId)
        {
            if (!await db.Announcements.AnyAsync(a => a.Title.StartsWith("October Gym Maintenance")))
            {
                var sent = new Announcement
                {
                    AuthorId = hrId,
                    Title = "October Gym Maintenance — Main Gym",
                    Body = "The Main Gym runs treadmill maintenance Oct 24–26. Free weights stay open; expect reduced class slots on Saturday.",
                    SentAt = new DateTime(2026, 10, 10, 9, 0, 0, DateTimeKind.Utc),
                    Status = AnnouncementStatus.Sent,
                };
                sent.Targets.Add(new AnnouncementTarget { TargetType = AnnouncementTargetType.AllGym, GymId = gym1Id });

                var bonuses = new Announcement
                {
                    AuthorId = hrManagerId,
                    Title = "September Performance Bonuses",
                    Body = "September bonuses were approved and appear on the October payslip. Branch managers: pending proposals are waiting in the Branch Queue.",
                    SentAt = new DateTime(2026, 9, 30, 17, 30, 0, DateTimeKind.Utc),
                    Status = AnnouncementStatus.Sent,
                };
                bonuses.Targets.Add(new AnnouncementTarget { TargetType = AnnouncementTargetType.AllGym, GymId = gym1Id });

                var scheduled = new Announcement
                {
                    AuthorId = hrId,
                    Title = "Winter Schedule Starts November 1",
                    Body = "From Nov 1 the evening shift moves to 15:00–23:00 at both branches. Published shift cycles are updated.",
                    ScheduledAt = new DateTime(2026, 11, 1, 8, 0, 0, DateTimeKind.Utc),
                    Status = AnnouncementStatus.Scheduled,
                };
                scheduled.Targets.Add(new AnnouncementTarget { TargetType = AnnouncementTargetType.AllGym, GymId = gym1Id });
                scheduled.Targets.Add(new AnnouncementTarget { TargetType = AnnouncementTargetType.AllGym, GymId = gym2Id });

                var draft = new Announcement
                {
                    AuthorId = hrId,
                    Title = "New Nutrition Service Launch",
                    Body = "Draft — announce the member-facing nutrition plans from Nov 15 with pricing tiers.",
                    Status = AnnouncementStatus.Draft,
                };

                db.Announcements.AddRange(sent, bonuses, scheduled, draft);
                await db.SaveChangesAsync();

                // Fan-out inbox notifications for the sent announcements.
                var gym1UserIds = await db.UserGymAccesses
                    .Where(a => a.GymId == gym1Id)
                    .Select(a => a.UserId)
                    .Distinct()
                    .ToListAsync();
                foreach (var (announcement, offset) in new[] { (sent, 0), (bonuses, 3) })
                {
                    foreach (var userId in gym1UserIds)
                    {
                        db.Notifications.Add(new Notification
                        {
                            UserId = userId,
                            Title = announcement.Title,
                            Message = announcement.Body.Length > 140
                                ? announcement.Body[..140] + "…"
                                : announcement.Body,
                            Type = NotificationType.Announcement,
                            IsRead = (userId + offset) % 3 == 0,
                            LinkTo = "/console/notifications",
                            CreatedAt = announcement.SentAt ?? DateTime.UtcNow,
                        });
                    }
                }
            }

            if (!await db.Notifications.AnyAsync(n => n.Title == "Payroll period awaiting settlement"))
            {
                db.Notifications.AddRange(
                    new Notification
                    {
                        UserId = hrId,
                        Title = "Payroll period awaiting settlement",
                        Message = "October 2026 sheets are still open — settle every sheet, then publish & lock before Oct 31.",
                        Type = NotificationType.SystemUpdate,
                        IsRead = false,
                        LinkTo = "/console/payroll",
                        CreatedAt = new DateTime(2026, 10, 20, 8, 0, 0, DateTimeKind.Utc),
                    },
                    new Notification
                    {
                        UserId = hrId,
                        Title = "Request approved — Karim Hassan",
                        Message = "Annual leave Sep 14–16 completed the two-stage approval and was marked paid.",
                        Type = NotificationType.RequestUpdate,
                        IsRead = false,
                        LinkTo = "/console/requests",
                        CreatedAt = new DateTime(2026, 9, 6, 10, 30, 0, DateTimeKind.Utc),
                    },
                    new Notification
                    {
                        UserId = hrId,
                        Title = "Candidate moved to interview",
                        Message = "Ziad Maher was moved to First Interview for Personal Trainer — Evening Shift.",
                        Type = NotificationType.RecruitmentFollowUp,
                        IsRead = true,
                        LinkTo = "/console/recruitment",
                        CreatedAt = new DateTime(2026, 10, 21, 9, 30, 0, DateTimeKind.Utc),
                    },
                    new Notification
                    {
                        UserId = omarId,
                        Title = "Two proposals await HR review",
                        Message = "Your warning and bonus proposals were forwarded to HR — track them in the Branch Queue.",
                        Type = NotificationType.SystemUpdate,
                        IsRead = false,
                        LinkTo = "/console/branch-queue",
                        CreatedAt = new DateTime(2026, 10, 18, 10, 0, 0, DateTimeKind.Utc),
                    });
            }

            await db.SaveChangesAsync();
        }

        // ==================================================================
        // Schedule (published November cycles)
        // ==================================================================

        private static async Task SeedNovemberCyclesAsync(
            ReviveHrDbContext db,
            IReadOnlyList<Employee> roster,
            IReadOnlyDictionary<int, int> rosterIndex,
            IReadOnlyDictionary<(int GymId, string Name), ShiftTemplate> templates,
            int gym1Id, int gym2Id, int adminId)
        {
            var start = new DateOnly(2026, 11, 1);
            var end = new DateOnly(2026, 11, 30);

            var existingDates = (await db.ShiftAssignments
                    .Where(a => a.Date >= start && a.Date <= end)
                    .Select(a => new { a.EmployeeId, a.Date })
                    .ToListAsync())
                .Select(a => (a.EmployeeId, a.Date))
                .ToHashSet();

            foreach (var gymId in new[] { gym1Id, gym2Id })
            {
                var cycle = await db.ShiftCycles.FirstOrDefaultAsync(c =>
                    c.GymId == gymId && c.StartDate == start && c.EndDate == end);
                if (cycle is null)
                {
                    cycle = new ShiftCycle
                    {
                        GymId = gymId,
                        Label = "November 2026",
                        StartDate = start,
                        EndDate = end,
                        Status = ShiftCycleStatus.Published,
                        PublishedAt = new DateTime(2026, 10, 20, 10, 0, 0, DateTimeKind.Utc),
                        PublishedBy = adminId,
                    };
                    db.ShiftCycles.Add(cycle);
                    await db.SaveChangesAsync();
                }

                var morning = templates[(gymId, "Morning Shift")];
                var evening = templates[(gymId, "Evening Shift")];

                foreach (var employee in roster.Where(e => e.GymId == gymId))
                {
                    var i = rosterIndex[employee.Id];
                    for (var date = start; date <= end; date = date.AddDays(1))
                    {
                        if (date.DayOfWeek == DayOfWeek.Friday || existingDates.Contains((employee.Id, date)))
                        {
                            continue;
                        }

                        var slot = (i + date.DayNumber) % 6;
                        db.ShiftAssignments.Add(new ShiftAssignment
                        {
                            ShiftCycleId = cycle.Id,
                            EmployeeId = employee.Id,
                            Date = date,
                            ShiftTemplateId = slot < 4 ? morning.Id : slot == 4 ? evening.Id : null,
                        });
                    }
                }

                await db.SaveChangesAsync();
            }
        }
    }
}
