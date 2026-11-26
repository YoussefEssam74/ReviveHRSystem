using DomainLayer.Models.SubscriptionModule;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Presistence.Data.Configurations
{
    public class GymSubscriptionConfiguration : IEntityTypeConfiguration<GymSubscription>
    {
        public void Configure(EntityTypeBuilder<GymSubscription> builder)
        {
            builder.ToTable("GymSubscriptions");
            builder.HasKey(s => s.Id);

            builder.Property(s => s.Amount).HasPrecision(12, 2);
            builder.Property(s => s.SuspensionReason).HasMaxLength(500);
            builder.Property(s => s.BillingStartDate).HasColumnType("date");
            builder.Property(s => s.NextDueDate).HasColumnType("date");
            builder.Property(s => s.AccessOverrideUntil).HasColumnType("date");

            builder.HasOne(s => s.Gym)
                   .WithMany()
                   .HasForeignKey(s => s.GymId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(s => s.Plan)
                   .WithMany(p => p.Subscriptions)
                   .HasForeignKey(s => s.PlanId)
                   .OnDelete(DeleteBehavior.Restrict);

            // One billing agreement per gym.
            builder.HasIndex(s => s.GymId)
                   .IsUnique()
                   .HasFilter("\"IsDeleted\" = FALSE");

            builder.HasIndex(s => s.Status);
        }
    }

    public class SubscriptionInvoiceConfiguration : IEntityTypeConfiguration<SubscriptionInvoice>
    {
        public void Configure(EntityTypeBuilder<SubscriptionInvoice> builder)
        {
            builder.ToTable("SubscriptionInvoices");
            builder.HasKey(i => i.Id);

            builder.Property(i => i.InvoiceNumber).IsRequired().HasMaxLength(40);
            builder.Property(i => i.PeriodStart).HasColumnType("date");
            builder.Property(i => i.PeriodEnd).HasColumnType("date");
            builder.Property(i => i.DueDate).HasColumnType("date");
            builder.Property(i => i.GraceEndsOn).HasColumnType("date");
            builder.Property(i => i.Amount).HasPrecision(12, 2);
            builder.Property(i => i.AmountPaid).HasPrecision(12, 2);

            builder.HasOne(i => i.Subscription)
                   .WithMany(s => s.Invoices)
                   .HasForeignKey(i => i.SubscriptionId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(i => i.Gym)
                   .WithMany()
                   .HasForeignKey(i => i.GymId)
                   .OnDelete(DeleteBehavior.Restrict);

            // One invoice per billing period; idempotent generation and a DB guard
            // against two sweep nodes creating the same period.
            builder.HasIndex(i => new { i.SubscriptionId, i.PeriodStart })
                   .IsUnique()
                   .HasFilter("\"IsDeleted\" = FALSE");

            builder.HasIndex(i => i.InvoiceNumber)
                   .IsUnique()
                   .HasFilter("\"IsDeleted\" = FALSE");

            builder.HasIndex(i => new { i.GymId, i.Status });
            builder.HasIndex(i => i.DueDate);
        }
    }

    public class SubscriptionPaymentConfiguration : IEntityTypeConfiguration<SubscriptionPayment>
    {
        public void Configure(EntityTypeBuilder<SubscriptionPayment> builder)
        {
            builder.ToTable("SubscriptionPayments");
            builder.HasKey(p => p.Id);

            builder.Property(p => p.Amount).HasPrecision(12, 2);
            builder.Property(p => p.Method).IsRequired().HasMaxLength(40);
            builder.Property(p => p.Reference).HasMaxLength(120);
            builder.Property(p => p.Notes).HasMaxLength(500);

            builder.HasOne(p => p.Invoice)
                   .WithMany(i => i.Payments)
                   .HasForeignKey(p => p.InvoiceId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(p => p.Gym)
                   .WithMany()
                   .HasForeignKey(p => p.GymId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(p => p.GymId);
            builder.HasIndex(p => new { p.InvoiceId, p.PaidAtUtc });
        }
    }

    public class SubscriptionSettingsConfiguration : IEntityTypeConfiguration<SubscriptionSettings>
    {
        public void Configure(EntityTypeBuilder<SubscriptionSettings> builder)
        {
            builder.ToTable("SubscriptionSettings");
            builder.HasKey(s => s.Id);
            // Explicit singleton id (1): the default identity convention would let the
            // database assign a different value and orphan the platform defaults.
            builder.Property(s => s.Id).ValueGeneratedNever();
            builder.Property(s => s.Currency).IsRequired().HasMaxLength(10);
        }
    }

    public class GymSubscriptionPlanConfiguration : IEntityTypeConfiguration<SubscriptionPlan>
    {
        public void Configure(EntityTypeBuilder<SubscriptionPlan> builder)
        {
            builder.ToTable("GymSubscriptionPlans");
            builder.HasKey(p => p.Id);

            builder.Property(p => p.Name).IsRequired().HasMaxLength(120);
            builder.Property(p => p.Description).HasMaxLength(500);
            builder.Property(p => p.PricePerCycle).HasPrecision(12, 2);

            builder.HasIndex(p => p.Name)
                   .IsUnique()
                   .HasFilter("\"IsDeleted\" = FALSE");
            builder.HasIndex(p => new { p.IsActive, p.SortOrder });
        }
    }

    public class SubscriptionChangeRequestConfiguration : IEntityTypeConfiguration<SubscriptionChangeRequest>
    {
        public void Configure(EntityTypeBuilder<SubscriptionChangeRequest> builder)
        {
            builder.ToTable("SubscriptionChangeRequests");
            builder.HasKey(r => r.Id);

            builder.Property(r => r.Note).HasMaxLength(500);
            builder.Property(r => r.ReviewNote).HasMaxLength(500);

            builder.HasOne(r => r.Gym)
                   .WithMany()
                   .HasForeignKey(r => r.GymId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(r => r.CurrentPlan)
                   .WithMany()
                   .HasForeignKey(r => r.CurrentPlanId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(r => r.RequestedPlan)
                   .WithMany()
                   .HasForeignKey(r => r.RequestedPlanId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(r => r.RequestedBy)
                   .WithMany()
                   .HasForeignKey(r => r.RequestedByUserId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(r => new { r.GymId, r.Status });
            builder.HasIndex(r => r.Status);
        }
    }
}
