using DomainLayer.Models.PayrollModule;
using DomainLayer.Models.RequestModule;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Presistence.Data.Configurations
{
    public class EmployeeRequestConfiguration : IEntityTypeConfiguration<EmployeeRequest>
    {
        public void Configure(EntityTypeBuilder<EmployeeRequest> builder)
        {
            builder.ToTable("EmployeeRequests");
            builder.HasKey(er => er.Id);

            builder.Property(er => er.Type).IsRequired().HasMaxLength(100);
            builder.Property(er => er.Details).IsRequired();
            builder.Property(er => er.AttachmentPath).HasMaxLength(500);
            builder.Property(er => er.OvertimeHoursRequested).HasPrecision(5, 2);

            builder.HasOne(er => er.Employee)
                   .WithMany()
                   .HasForeignKey(er => er.EmployeeId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(er => er.SwapWithEmployee)
                   .WithMany()
                   .HasForeignKey(er => er.SwapWithEmployeeId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(er => er.EmployeeId);
            builder.HasIndex(er => er.Status);
        }
    }

    public class RequestDecisionConfiguration : IEntityTypeConfiguration<RequestDecision>
    {
        public void Configure(EntityTypeBuilder<RequestDecision> builder)
        {
            builder.ToTable("RequestDecisions");
            builder.HasKey(rd => rd.Id);

            builder.Property(rd => rd.Comment).HasMaxLength(1000);

            builder.HasOne(rd => rd.Request)
                   .WithMany(r => r.Decisions)
                   .HasForeignKey(rd => rd.RequestId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(rd => rd.DecidedByUser)
                   .WithMany()
                   .HasForeignKey(rd => rd.DecidedBy)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(rd => rd.RequestId);
        }
    }

    public class PayrollPeriodConfiguration : IEntityTypeConfiguration<PayrollPeriod>
    {
        public void Configure(EntityTypeBuilder<PayrollPeriod> builder)
        {
            builder.ToTable("PayrollPeriods");
            builder.HasKey(pp => pp.Id);

            builder.HasOne(pp => pp.Gym)
                   .WithMany()
                   .HasForeignKey(pp => pp.GymId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(pp => pp.Approver)
                   .WithMany()
                   .HasForeignKey(pp => pp.ApprovedBy)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(pp => new { pp.GymId, pp.StartDate, pp.EndDate });
        }
    }

    public class PayrollEntryConfiguration : IEntityTypeConfiguration<PayrollEntry>
    {
        public void Configure(EntityTypeBuilder<PayrollEntry> builder)
        {
            builder.ToTable("PayrollEntries");
            builder.HasKey(pe => pe.Id);

            builder.Property(pe => pe.BaseSalary).HasPrecision(18, 2);
            builder.Property(pe => pe.TotalDeductions).HasPrecision(18, 2);
            builder.Property(pe => pe.TotalBonuses).HasPrecision(18, 2);
            builder.Property(pe => pe.NetPay).HasPrecision(18, 2);

            builder.HasOne(pe => pe.PayrollPeriod)
                   .WithMany(pp => pp.Entries)
                   .HasForeignKey(pe => pe.PayrollPeriodId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(pe => pe.Employee)
                   .WithMany()
                   .HasForeignKey(pe => pe.EmployeeId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(pe => new { pe.PayrollPeriodId, pe.EmployeeId }).IsUnique();
        }
    }

    public class PayrollEntryLineItemConfiguration : IEntityTypeConfiguration<PayrollEntryLineItem>
    {
        public void Configure(EntityTypeBuilder<PayrollEntryLineItem> builder)
        {
            builder.ToTable("PayrollEntryLineItems");
            builder.HasKey(i => i.Id);
            builder.Property(i => i.Type).IsRequired().HasMaxLength(30);
            builder.Property(i => i.Label).IsRequired().HasMaxLength(200);
            builder.Property(i => i.Reason).HasMaxLength(1000);
            builder.Property(i => i.Source).IsRequired().HasMaxLength(50);
            builder.Property(i => i.Status).IsRequired().HasMaxLength(50);
            builder.Property(i => i.Amount).HasPrecision(18, 2);
            builder.HasOne(i => i.PayrollEntry).WithMany(e => e.LineItems).HasForeignKey(i => i.PayrollEntryId)
                   .OnDelete(DeleteBehavior.Cascade);
            builder.HasOne(i => i.AttendanceRecord).WithMany().HasForeignKey(i => i.AttendanceRecordId)
                   .OnDelete(DeleteBehavior.SetNull);
            builder.HasOne(i => i.EmployeeRequest).WithMany().HasForeignKey(i => i.EmployeeRequestId)
                   .OnDelete(DeleteBehavior.SetNull);
            builder.HasOne(i => i.Reviewer).WithMany().HasForeignKey(i => i.ReviewedBy)
                   .OnDelete(DeleteBehavior.SetNull);
            builder.HasIndex(i => new { i.PayrollEntryId, i.Type });
        }
    }

    public class DeductionCandidateConfiguration : IEntityTypeConfiguration<DeductionCandidate>
    {
        public void Configure(EntityTypeBuilder<DeductionCandidate> builder)
        {
            builder.ToTable("DeductionCandidates");
            builder.HasKey(dc => dc.Id);

            builder.Property(dc => dc.Amount).HasPrecision(18, 2);
            builder.Property(dc => dc.Reason).IsRequired().HasMaxLength(500);

            builder.HasOne(dc => dc.Employee)
                   .WithMany()
                   .HasForeignKey(dc => dc.EmployeeId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(dc => dc.AttendanceRecord)
                   .WithMany()
                   .HasForeignKey(dc => dc.AttendanceRecordId)
                   .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(dc => dc.Reviewer)
                   .WithMany()
                   .HasForeignKey(dc => dc.ReviewedBy)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(dc => dc.EmployeeId);
            builder.HasIndex(dc => dc.Status);
        }
    }
}
