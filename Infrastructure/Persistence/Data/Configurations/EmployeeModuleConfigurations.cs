using DomainLayer.Models.EmployeeModule;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Presistence.Data.Configurations
{
    public class EmployeeConfiguration : IEntityTypeConfiguration<Employee>
    {
        public void Configure(EntityTypeBuilder<Employee> builder)
        {
            builder.ToTable("Employees");
            builder.HasKey(e => e.Id);

            builder.Property(e => e.EmployeeNumber).IsRequired().HasMaxLength(50);
            builder.Property(e => e.ContractType).IsRequired().HasMaxLength(100);
            builder.Property(e => e.FullName).IsRequired().HasMaxLength(200);
            builder.Property(e => e.Phone).HasMaxLength(50);
            builder.Property(e => e.Gender).HasMaxLength(50);
            builder.Property(e => e.NationalId).HasMaxLength(50);
            builder.Property(e => e.Address).HasMaxLength(500);
            builder.Property(e => e.EmergencyContactName).HasMaxLength(200);
            builder.Property(e => e.EmergencyContactRelationship).HasMaxLength(100);
            builder.Property(e => e.EmergencyContactPhone).HasMaxLength(50);

            builder.HasIndex(e => e.EmployeeNumber).IsUnique();
            builder.HasIndex(e => e.GymId);
            builder.HasIndex(e => e.UserId).IsUnique();
            // NOTE: the former (Id, TeamId) alternate key was removed — EF Core cannot
            // SaveChanges an employee whose TeamId is null while it exists, which broke
            // every team-less employee insert. TeamLeaders now references EmployeeId only;
            // "leader must belong to the team" is enforced at application level.

            builder.HasOne(e => e.Gym)
                   .WithMany()
                   .HasForeignKey(e => e.GymId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(e => e.Position)
                   .WithMany()
                   .HasForeignKey(e => e.PositionId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(e => e.Candidate)
                   .WithMany()
                   .HasForeignKey(e => e.CandidateId)
                   .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(e => e.OnboardingCompletedByUser)
                   .WithMany()
                   .HasForeignKey(e => e.OnboardingCompletedBy)
                   .OnDelete(DeleteBehavior.SetNull);
        }
    }

    public class EmploymentHistoryConfiguration : IEntityTypeConfiguration<EmploymentHistory>
    {
        public void Configure(EntityTypeBuilder<EmploymentHistory> builder)
        {
            builder.ToTable("EmploymentHistories");
            builder.HasKey(eh => eh.Id);

            builder.Property(eh => eh.OldValueJson).HasColumnType("jsonb");
            builder.Property(eh => eh.NewValueJson).HasColumnType("jsonb");
            builder.Property(eh => eh.Reason).HasMaxLength(500);

            builder.HasOne(eh => eh.Employee)
                   .WithMany(e => e.EmploymentHistories)
                   .HasForeignKey(eh => eh.EmployeeId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(eh => eh.ChangedByUser)
                   .WithMany()
                   .HasForeignKey(eh => eh.ChangedBy)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(eh => eh.EmployeeId);
        }
    }

    public class EmployeeDocumentConfiguration : IEntityTypeConfiguration<EmployeeDocument>
    {
        public void Configure(EntityTypeBuilder<EmployeeDocument> builder)
        {
            builder.ToTable("EmployeeDocuments");
            builder.HasKey(ed => ed.Id);

            builder.Property(ed => ed.FileName).IsRequired().HasMaxLength(255);
            builder.Property(ed => ed.FilePath).IsRequired().HasMaxLength(500);

            builder.HasOne(ed => ed.Employee)
                   .WithMany(e => e.Documents)
                   .HasForeignKey(ed => ed.EmployeeId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(ed => ed.EmployeeId);
        }
    }

    public class CompensationConfiguration : IEntityTypeConfiguration<Compensation>
    {
        public void Configure(EntityTypeBuilder<Compensation> builder)
        {
            builder.ToTable("Compensations");
            builder.HasKey(c => c.Id);

            builder.Property(c => c.Amount).HasPrecision(18, 2);
            builder.Property(c => c.Currency).IsRequired().HasMaxLength(10);
            builder.Property(c => c.Reason).HasMaxLength(500);

            builder.HasOne(c => c.Employee)
                   .WithMany(e => e.Compensations)
                   .HasForeignKey(c => c.EmployeeId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(c => c.ChangedByUser)
                   .WithMany()
                   .HasForeignKey(c => c.ChangedBy)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(c => c.EmployeeId);
        }
    }

    public class LeaveBalanceConfiguration : IEntityTypeConfiguration<LeaveBalance>
    {
        public void Configure(EntityTypeBuilder<LeaveBalance> builder)
        {
            builder.ToTable("LeaveBalances");
            builder.HasKey(lb => lb.Id);

            builder.Property(lb => lb.TotalEntitlement).HasPrecision(5, 2);
            builder.Property(lb => lb.UsedDays).HasPrecision(5, 2);
            builder.Property(lb => lb.PendingDays).HasPrecision(5, 2);

            builder.HasOne(lb => lb.Employee)
                   .WithMany(e => e.LeaveBalances)
                   .HasForeignKey(lb => lb.EmployeeId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(lb => lb.UpdatedByUser)
                   .WithMany()
                   .HasForeignKey(lb => lb.UpdatedBy)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(lb => new { lb.EmployeeId, lb.LeaveType, lb.Year }).IsUnique();
        }
    }

    public class OnboardingChecklistItemConfiguration : IEntityTypeConfiguration<OnboardingChecklistItem>
    {
        public void Configure(EntityTypeBuilder<OnboardingChecklistItem> builder)
        {
            builder.ToTable("OnboardingChecklistItems");
            builder.HasKey(i => i.Id);
            builder.Property(i => i.Title).IsRequired().HasMaxLength(200);
            builder.Property(i => i.Notes).HasMaxLength(1000);
            builder.HasOne(i => i.Employee).WithMany(e => e.OnboardingChecklistItems)
                   .HasForeignKey(i => i.EmployeeId).OnDelete(DeleteBehavior.Cascade);
            builder.HasOne(i => i.CompletedByUser).WithMany().HasForeignKey(i => i.CompletedBy)
                   .OnDelete(DeleteBehavior.SetNull);
            builder.HasIndex(i => new { i.EmployeeId, i.SortOrder }).IsUnique();
        }
    }

    public class OffboardingCaseConfiguration : IEntityTypeConfiguration<OffboardingCase>
    {
        public void Configure(EntityTypeBuilder<OffboardingCase> builder)
        {
            builder.ToTable("OffboardingCases");
            builder.HasKey(c => c.Id);
            builder.Property(c => c.Reason).IsRequired().HasMaxLength(1000);
            builder.Property(c => c.Status).IsRequired().HasMaxLength(50);
            builder.HasOne(c => c.Employee).WithMany(e => e.OffboardingCases)
                   .HasForeignKey(c => c.EmployeeId).OnDelete(DeleteBehavior.Restrict);
            builder.HasOne(c => c.InitiatedByUser).WithMany().HasForeignKey(c => c.InitiatedBy)
                   .OnDelete(DeleteBehavior.Restrict);
            builder.HasIndex(c => new { c.EmployeeId, c.Status });
        }
    }

    public class OffboardingChecklistItemConfiguration : IEntityTypeConfiguration<OffboardingChecklistItem>
    {
        public void Configure(EntityTypeBuilder<OffboardingChecklistItem> builder)
        {
            builder.ToTable("OffboardingChecklistItems");
            builder.HasKey(i => i.Id);
            builder.Property(i => i.Title).IsRequired().HasMaxLength(200);
            builder.Property(i => i.Notes).HasMaxLength(1000);
            builder.HasOne(i => i.OffboardingCase).WithMany(c => c.ChecklistItems)
                   .HasForeignKey(i => i.OffboardingCaseId).OnDelete(DeleteBehavior.Cascade);
            builder.HasOne(i => i.CompletedByUser).WithMany().HasForeignKey(i => i.CompletedBy)
                   .OnDelete(DeleteBehavior.SetNull);
            builder.HasIndex(i => new { i.OffboardingCaseId, i.SortOrder }).IsUnique();
        }
    }
}
