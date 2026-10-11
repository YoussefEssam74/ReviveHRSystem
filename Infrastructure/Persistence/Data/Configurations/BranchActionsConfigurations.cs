using DomainLayer.Models.EmployeeModule;
using DomainLayer.Models.PayrollModule;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Presistence.Data.Configurations
{
    /// <summary>Disciplinary warning notices raised for HR to file.</summary>
    public class WarningNoticeConfiguration : IEntityTypeConfiguration<WarningNotice>
    {
        public void Configure(EntityTypeBuilder<WarningNotice> builder)
        {
            builder.ToTable("WarningNotices");
            builder.HasKey(w => w.Id);

            builder.Property(w => w.Type).IsRequired().HasMaxLength(100);
            builder.Property(w => w.Reason).IsRequired().HasMaxLength(500);
            builder.Property(w => w.Note).HasMaxLength(1000);

            builder.HasOne(w => w.Employee)
                   .WithMany()
                   .HasForeignKey(w => w.EmployeeId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(w => w.IssuedByUser)
                   .WithMany()
                   .HasForeignKey(w => w.IssuedBy)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(w => new { w.EmployeeId, w.IssuedAt });
        }
    }

    /// <summary>Bonus proposals awaiting HR approval (approved ones become payroll items).</summary>
    public class BonusProposalConfiguration : IEntityTypeConfiguration<BonusProposal>
    {
        public void Configure(EntityTypeBuilder<BonusProposal> builder)
        {
            builder.ToTable("BonusProposals");
            builder.HasKey(b => b.Id);

            builder.Property(b => b.Type).IsRequired().HasMaxLength(100);
            builder.Property(b => b.Amount).HasPrecision(18, 2);
            builder.Property(b => b.Reason).IsRequired().HasMaxLength(500);
            builder.Property(b => b.Note).HasMaxLength(1000);

            builder.HasOne(b => b.Employee)
                   .WithMany()
                   .HasForeignKey(b => b.EmployeeId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(b => b.IssuedByUser)
                   .WithMany()
                   .HasForeignKey(b => b.IssuedBy)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(b => new { b.EmployeeId, b.IssuedAt });
        }
    }
}
