using System.Reflection;
using System.Linq.Expressions;
using DomainLayer.Models;
using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.AuditModule;
using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.EvaluationModule;
using DomainLayer.Models.NotificationModule;
using DomainLayer.Models.OrganizationModule;
using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.RecruitmentModule;
using DomainLayer.Models.RequestModule;
using DomainLayer.Models.SchedulingModule;
using DomainLayer.Models.UserModule;
using Microsoft.EntityFrameworkCore;

namespace Presistence.Data
{
    public class ReviveHrDbContext : DbContext
    {
        public ReviveHrDbContext(DbContextOptions<ReviveHrDbContext> options) : base(options)
        {
        }

        #region DbSets

        // Identity & Access
        public DbSet<User> Users => Set<User>();
        public DbSet<Role> Roles => Set<Role>();
        public DbSet<Permission> Permissions => Set<Permission>();
        public DbSet<UserRole> UserRoles => Set<UserRole>();
        public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
        public DbSet<UserPermission> UserPermissions => Set<UserPermission>();
        public DbSet<UserGymAccess> UserGymAccesses => Set<UserGymAccess>();
        public DbSet<UserNotificationPreference> UserNotificationPreferences => Set<UserNotificationPreference>();

        // Organization
        public DbSet<Gym> Gyms => Set<Gym>();
        public DbSet<Department> Departments => Set<Department>();
        public DbSet<Position> Positions => Set<Position>();
        public DbSet<Team> Teams => Set<Team>();
        public DbSet<TeamLeader> TeamLeaders => Set<TeamLeader>();

        // Recruitment
        public DbSet<VacancyRequest> VacancyRequests => Set<VacancyRequest>();
        public DbSet<Vacancy> Vacancies => Set<Vacancy>();
        public DbSet<Candidate> Candidates => Set<Candidate>();
        public DbSet<Application> Applications => Set<Application>();
        public DbSet<PipelineStage> PipelineStages => Set<PipelineStage>();
        public DbSet<Interview> Interviews => Set<Interview>();

        // Employee
        public DbSet<Employee> Employees => Set<Employee>();
        public DbSet<EmploymentHistory> EmploymentHistories => Set<EmploymentHistory>();
        public DbSet<EmployeeDocument> EmployeeDocuments => Set<EmployeeDocument>();
        public DbSet<Compensation> Compensations => Set<Compensation>();
        public DbSet<LeaveBalance> LeaveBalances => Set<LeaveBalance>();
        public DbSet<OnboardingChecklistItem> OnboardingChecklistItems => Set<OnboardingChecklistItem>();
        public DbSet<OffboardingCase> OffboardingCases => Set<OffboardingCase>();
        public DbSet<OffboardingChecklistItem> OffboardingChecklistItems => Set<OffboardingChecklistItem>();

        // Scheduling
        public DbSet<ShiftTemplate> ShiftTemplates => Set<ShiftTemplate>();
        public DbSet<ShiftCycle> ShiftCycles => Set<ShiftCycle>();
        public DbSet<ShiftAssignment> ShiftAssignments => Set<ShiftAssignment>();

        // Attendance
        public DbSet<BiometricDevice> BiometricDevices => Set<BiometricDevice>();
        public DbSet<AttendanceRecord> AttendanceRecords => Set<AttendanceRecord>();
        public DbSet<AttendanceCorrection> AttendanceCorrections => Set<AttendanceCorrection>();

        // Requests
        public DbSet<EmployeeRequest> EmployeeRequests => Set<EmployeeRequest>();
        public DbSet<RequestDecision> RequestDecisions => Set<RequestDecision>();

        // Payroll
        public DbSet<PayrollPeriod> PayrollPeriods => Set<PayrollPeriod>();
        public DbSet<PayrollEntry> PayrollEntries => Set<PayrollEntry>();
        public DbSet<PayrollEntryLineItem> PayrollEntryLineItems => Set<PayrollEntryLineItem>();
        public DbSet<DeductionCandidate> DeductionCandidates => Set<DeductionCandidate>();

        // Communication & Events
        public DbSet<Notification> Notifications => Set<Notification>();
        public DbSet<Announcement> Announcements => Set<Announcement>();
        public DbSet<AnnouncementTarget> AnnouncementTargets => Set<AnnouncementTarget>();
        public DbSet<Event> Events => Set<Event>();

        // Evaluations
        public DbSet<EvaluationForm> EvaluationForms => Set<EvaluationForm>();
        public DbSet<EvaluationQuestion> EvaluationQuestions => Set<EvaluationQuestion>();
        public DbSet<EvaluationResponse> EvaluationResponses => Set<EvaluationResponse>();
        public DbSet<EvaluationAnswer> EvaluationAnswers => Set<EvaluationAnswer>();
        public DbSet<EvaluationAssignment> EvaluationAssignments => Set<EvaluationAssignment>();

        // Auditing
        public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

        #endregion

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.ApplyConfigurationsFromAssembly(typeof(AssemblyReference).Assembly);
            ConfigureRecordMetadata(modelBuilder);
        }

        private static void ConfigureRecordMetadata(ModelBuilder modelBuilder)
        {
            foreach (var entityType in modelBuilder.Model.GetEntityTypes().ToList())
            {
                if (entityType.FindProperty("Id") is null || entityType.ClrType == typeof(AuditLog))
                    continue;

                var entity = modelBuilder.Entity(entityType.ClrType);
                entity.Property<bool>("IsDeleted").HasDefaultValue(false).IsRequired();
                entity.Property<DateTime>("CreatedAt").HasDefaultValueSql("CURRENT_TIMESTAMP").IsRequired();
                entity.Property<DateTime?>("UpdatedAt");
                entity.Property<int?>("CreatedBy");
                entity.Property<int?>("UpdatedBy");

                var parameter = Expression.Parameter(entityType.ClrType, "row");
                var isDeleted = Expression.Call(
                    typeof(EF),
                    nameof(EF.Property),
                    new[] { typeof(bool) },
                    parameter,
                    Expression.Constant("IsDeleted"));
                entity.HasQueryFilter(Expression.Lambda(Expression.Equal(isDeleted, Expression.Constant(false)), parameter));
            }

            // Relationship tables have composite keys and are intentionally hard-deleted,
            // but their filtered endpoints must stay hidden from relationship queries.
            modelBuilder.Entity<UserRole>().HasQueryFilter(x =>
                !EF.Property<bool>(x.User, "IsDeleted") && !EF.Property<bool>(x.Role, "IsDeleted"));
            modelBuilder.Entity<RolePermission>().HasQueryFilter(x =>
                !EF.Property<bool>(x.Role, "IsDeleted") && !EF.Property<bool>(x.Permission, "IsDeleted"));
            modelBuilder.Entity<UserPermission>().HasQueryFilter(x =>
                !EF.Property<bool>(x.User, "IsDeleted") && !EF.Property<bool>(x.Permission, "IsDeleted"));
            modelBuilder.Entity<UserGymAccess>().HasQueryFilter(x =>
                !EF.Property<bool>(x.User, "IsDeleted") && !EF.Property<bool>(x.Gym, "IsDeleted"));
        }

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            StampRecordMetadata();
            return base.SaveChangesAsync(cancellationToken);
        }

        public override int SaveChanges()
        {
            StampRecordMetadata();
            return base.SaveChanges();
        }

        public override int SaveChanges(bool acceptAllChangesOnSuccess)
        {
            StampRecordMetadata();
            return base.SaveChanges(acceptAllChangesOnSuccess);
        }

        public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
        {
            StampRecordMetadata();
            return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
        }

        private void StampRecordMetadata()
        {
            var now = DateTime.UtcNow;
            foreach (var entry in ChangeTracker.Entries().Where(e => e.Metadata.FindProperty("IsDeleted") is not null))
            {
                if (entry.State == EntityState.Deleted)
                {
                    entry.State = EntityState.Modified;
                    entry.Property("IsDeleted").CurrentValue = true;
                }

                if (entry.State == EntityState.Added)
                    entry.Property("CreatedAt").CurrentValue = now;
                else if (entry.State == EntityState.Modified)
                    entry.Property("UpdatedAt").CurrentValue = now;
            }
        }
    }
}
