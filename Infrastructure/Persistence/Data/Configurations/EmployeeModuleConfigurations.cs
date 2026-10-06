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

            builder.HasIndex(e => e.EmployeeNumber).IsUnique();
            builder.HasIndex(e => e.GymId);
            builder.HasIndex(e => e.UserId).IsUnique();

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
}
