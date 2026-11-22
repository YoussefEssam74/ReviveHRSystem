using DomainLayer.Models.BillingModule;
using DomainLayer.Models.PlatformModule;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Presistence.Data.Configurations
{
    public class CompanyConfiguration : IEntityTypeConfiguration<Company>
    {
        public void Configure(EntityTypeBuilder<Company> builder)
        {
            builder.ToTable("Companies");
            builder.HasKey(c => c.Id);

            builder.Property(c => c.Name).IsRequired().HasMaxLength(200);
            builder.Property(c => c.Code).IsRequired().HasMaxLength(50);
            builder.Property(c => c.City).HasMaxLength(100);
            builder.Property(c => c.LogoUrl).HasMaxLength(500);
            builder.Property(c => c.ContactName).HasMaxLength(200);
            builder.Property(c => c.ContactEmail).HasMaxLength(256);
            builder.Property(c => c.ContactPhone).HasMaxLength(50);

            // The code prefixes every branch code, so it must stay unique while the row
            // is alive — but remain reusable after a soft-delete.
            builder.HasIndex(c => c.Code)
                   .IsUnique()
                   .HasFilter("\"IsDeleted\" = FALSE");
            builder.HasIndex(c => c.Name);
            builder.HasIndex(c => c.Status);

            builder.HasMany(c => c.Branches)
                   .WithOne(g => g.Company)
                   .HasForeignKey(g => g.CompanyId)
                   .OnDelete(DeleteBehavior.Restrict);
        }
    }

    public class ImpersonationSessionConfiguration : IEntityTypeConfiguration<ImpersonationSession>
    {
        public void Configure(EntityTypeBuilder<ImpersonationSession> builder)
        {
            builder.ToTable("ImpersonationSessions");
            builder.HasKey(s => s.Id);

            builder.Property(s => s.IpAddress).HasMaxLength(64);
            builder.Property(s => s.Reason).HasMaxLength(500);

            builder.HasOne(s => s.ActorUser)
                   .WithMany()
                   .HasForeignKey(s => s.ActorUserId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(s => s.Company)
                   .WithMany(c => c.ImpersonationSessions)
                   .HasForeignKey(s => s.CompanyId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(s => s.EffectiveRole)
                   .WithMany()
                   .HasForeignKey(s => s.EffectiveRoleId)
                   .OnDelete(DeleteBehavior.SetNull);

            builder.HasIndex(s => new { s.ActorUserId, s.StartedAt });
            builder.HasIndex(s => s.CompanyId);
            // The hourly expiry sweep looks for open sessions past their deadline.
            builder.HasIndex(s => s.ExpiresAt);
        }
    }

    public class PlatformSettingConfiguration : IEntityTypeConfiguration<PlatformSetting>
    {
        public void Configure(EntityTypeBuilder<PlatformSetting> builder)
        {
            builder.ToTable("PlatformSettings");
            builder.HasKey(s => s.Id);

            builder.Property(s => s.Key).IsRequired().HasMaxLength(150);
            builder.Property(s => s.Value).IsRequired().HasMaxLength(2000);

            builder.HasIndex(s => s.Key)
                   .IsUnique()
                   .HasFilter("\"IsDeleted\" = FALSE");
        }
    }

    public class FeatureFlagConfiguration : IEntityTypeConfiguration<FeatureFlag>
    {
        public void Configure(EntityTypeBuilder<FeatureFlag> builder)
        {
            builder.ToTable("FeatureFlags");
            builder.HasKey(f => f.Id);

            builder.Property(f => f.Key).IsRequired().HasMaxLength(150);
            builder.Property(f => f.Name).IsRequired().HasMaxLength(200);
            builder.Property(f => f.Description).HasMaxLength(500);

            builder.HasIndex(f => f.Key)
                   .IsUnique()
                   .HasFilter("\"IsDeleted\" = FALSE");
        }
    }

    public class FeatureFlagTargetConfiguration : IEntityTypeConfiguration<FeatureFlagTarget>
    {
        public void Configure(EntityTypeBuilder<FeatureFlagTarget> builder)
        {
            builder.ToTable("FeatureFlagTargets");
            builder.HasKey(t => t.Id);

            builder.HasOne(t => t.FeatureFlag)
                   .WithMany(f => f.Targets)
                   .HasForeignKey(t => t.FeatureFlagId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(t => t.Plan)
                   .WithMany()
                   .HasForeignKey(t => t.PlanId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(t => t.Company)
                   .WithMany()
                   .HasForeignKey(t => t.CompanyId)
                   .OnDelete(DeleteBehavior.Cascade);

            // A target row must point at exactly one plan or one company.
            builder.ToTable(t => t.HasCheckConstraint(
                "CK_FeatureFlagTargets_OneTarget",
                "(\"PlanId\" IS NOT NULL AND \"CompanyId\" IS NULL) OR (\"PlanId\" IS NULL AND \"CompanyId\" IS NOT NULL)"));
        }
    }

    public class AuditExportPackageConfiguration : IEntityTypeConfiguration<AuditExportPackage>
    {
        public void Configure(EntityTypeBuilder<AuditExportPackage> builder)
        {
            builder.ToTable("AuditExportPackages");
            builder.HasKey(p => p.Id);

            builder.Property(p => p.ExportId).IsRequired().HasMaxLength(40);
            builder.Property(p => p.Format).IsRequired().HasMaxLength(10);
            builder.Property(p => p.Status).IsRequired().HasMaxLength(20);
            builder.Property(p => p.ContentType).HasMaxLength(100);
            builder.Property(p => p.FileName).IsRequired().HasMaxLength(200);

            builder.HasIndex(p => p.ExportId)
                   .IsUnique()
                   .HasFilter("\"IsDeleted\" = FALSE");
            // The cleanup job scans by expiry.
            builder.HasIndex(p => p.ExpiresAt);
        }
    }
}
