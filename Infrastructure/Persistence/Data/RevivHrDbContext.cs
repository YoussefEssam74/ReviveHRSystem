using System.Reflection;
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
        public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

        // Organization
        public DbSet<Gym> Gyms => Set<Gym>();
        public DbSet<Department> Departments => Set<Department>();
        public DbSet<Position> Positions => Set<Position>();
        public DbSet<Team> Teams => Set<Team>();
        public DbSet<TeamLeader> TeamLeaders => Set<TeamLeader>();
        public DbSet<TeamMember> TeamMembers => Set<TeamMember>();

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

        // Auditing
        public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

        #endregion

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.ApplyConfigurationsFromAssembly(typeof(AssemblyReference).Assembly);
        }

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return base.SaveChangesAsync(cancellationToken);
        }
    }
}
