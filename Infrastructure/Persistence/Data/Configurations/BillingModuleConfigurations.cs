using DomainLayer.Models.BillingModule;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Presistence.Data.Configurations
{
    public class SubscriptionPlanConfiguration : IEntityTypeConfiguration<SubscriptionPlan>
    {
        public void Configure(EntityTypeBuilder<SubscriptionPlan> builder)
        {
            builder.ToTable("SubscriptionPlans");
            builder.HasKey(p => p.Id);

            builder.Property(p => p.Name).IsRequired().HasMaxLength(150);
            builder.Property(p => p.Slug).IsRequired().HasMaxLength(150);
            builder.Property(p => p.Tagline).HasMaxLength(300);
            builder.Property(p => p.Price).HasPrecision(12, 2);
            builder.Property(p => p.Currency).IsRequired().HasMaxLength(3).HasDefaultValue("EGP");

            builder.HasIndex(p => p.Slug)
                   .IsUnique()
                   .HasFilter("\"IsDeleted\" = FALSE");
            builder.HasIndex(p => p.Name);
        }
    }

    public class PlanFeatureConfiguration : IEntityTypeConfiguration<PlanFeature>
    {
        public void Configure(EntityTypeBuilder<PlanFeature> builder)
        {
            builder.ToTable("PlanFeatures");
            builder.HasKey(f => f.Id);

            builder.Property(f => f.Label).IsRequired().HasMaxLength(300);

            builder.HasOne(f => f.Plan)
                   .WithMany(p => p.Features)
                   .HasForeignKey(f => f.PlanId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(f => new { f.PlanId, f.SortOrder });
        }
    }

    public class PlanAddOnConfiguration : IEntityTypeConfiguration<PlanAddOn>
    {
        public void Configure(EntityTypeBuilder<PlanAddOn> builder)
        {
            builder.ToTable("PlanAddOns");
            builder.HasKey(a => a.Id);

            builder.Property(a => a.Name).IsRequired().HasMaxLength(150);
            builder.Property(a => a.Price).HasPrecision(12, 2);

            builder.HasOne(a => a.Plan)
                   .WithMany(p => p.AddOns)
                   .HasForeignKey(a => a.PlanId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(a => new { a.PlanId, a.SortOrder });
        }
    }

    public class CompanySubscriptionConfiguration : IEntityTypeConfiguration<CompanySubscription>
    {
        public void Configure(EntityTypeBuilder<CompanySubscription> builder)
        {
            builder.ToTable("CompanySubscriptions");
            builder.HasKey(s => s.Id);

            builder.Property(s => s.PriceOverride).HasPrecision(12, 2);
            builder.Property(s => s.CancelReason).HasMaxLength(500);

            builder.HasOne(s => s.Company)
                   .WithMany(c => c.Subscriptions)
                   .HasForeignKey(s => s.CompanyId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(s => s.Plan)
                   .WithMany(p => p.Subscriptions)
                   .HasForeignKey(s => s.PlanId)
                   .OnDelete(DeleteBehavior.Restrict);

            // A company can only ever hold one live agreement. Past agreements are
            // Cancelled (4) and stay readable for historical invoices.
            builder.HasIndex(s => s.CompanyId)
                   .IsUnique()
                   .HasFilter("\"IsDeleted\" = FALSE AND \"Status\" <> 4");

            builder.HasIndex(s => s.Status);
            builder.HasIndex(s => s.CurrentPeriodEnd);
        }
    }

    public class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
    {
        public void Configure(EntityTypeBuilder<Invoice> builder)
        {
            builder.ToTable("Invoices");
            builder.HasKey(i => i.Id);

            builder.Property(i => i.InvoiceNumber).IsRequired().HasMaxLength(40);
            builder.Property(i => i.PeriodLabel).IsRequired().HasMaxLength(30);
            builder.Property(i => i.Amount).HasPrecision(12, 2);
            builder.Property(i => i.AmountPaid).HasPrecision(12, 2).HasDefaultValue(0m);
            builder.Property(i => i.Currency).IsRequired().HasMaxLength(3).HasDefaultValue("EGP");
            builder.Property(i => i.Notes).HasMaxLength(1000);

            builder.HasOne(i => i.Company)
                   .WithMany(c => c.Invoices)
                   .HasForeignKey(i => i.CompanyId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(i => i.Subscription)
                   .WithMany()
                   .HasForeignKey(i => i.SubscriptionId)
                   .OnDelete(DeleteBehavior.SetNull);

            builder.HasIndex(i => i.InvoiceNumber)
                   .IsUnique()
                   .HasFilter("\"IsDeleted\" = FALSE");
            builder.HasIndex(i => i.Status);
            builder.HasIndex(i => i.DueOn);

            // One invoice per company per period; a voided row frees the slot again.
            // This filtered unique index also serves the (CompanyId, PeriodStart) lookup.
            builder.HasIndex(i => new { i.CompanyId, i.PeriodStart })
                   .IsUnique()
                   .HasFilter("\"IsDeleted\" = FALSE AND \"Status\" <> 6")
                   .HasDatabaseName("IX_Invoices_Company_Period_Active");
        }
    }

    public class InvoicePaymentConfiguration : IEntityTypeConfiguration<InvoicePayment>
    {
        public void Configure(EntityTypeBuilder<InvoicePayment> builder)
        {
            builder.ToTable("InvoicePayments");
            builder.HasKey(p => p.Id);

            builder.Property(p => p.Amount).HasPrecision(12, 2);
            builder.Property(p => p.Reference).HasMaxLength(200);

            builder.HasOne(p => p.Invoice)
                   .WithMany(i => i.Payments)
                   .HasForeignKey(p => p.InvoiceId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(p => new { p.InvoiceId, p.PaidOn });
        }
    }
}
