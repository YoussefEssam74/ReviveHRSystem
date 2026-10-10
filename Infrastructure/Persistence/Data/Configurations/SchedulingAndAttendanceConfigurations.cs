using DomainLayer.Models.AttendanceModule;
using DomainLayer.Models.SchedulingModule;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Presistence.Data.Configurations
{
    public class ShiftTemplateConfiguration : IEntityTypeConfiguration<ShiftTemplate>
    {
        public void Configure(EntityTypeBuilder<ShiftTemplate> builder)
        {
            builder.ToTable("ShiftTemplates");
            builder.HasKey(st => st.Id);

            builder.Property(st => st.Name).IsRequired().HasMaxLength(100);

            builder.HasOne(st => st.Gym)
                   .WithMany()
                   .HasForeignKey(st => st.GymId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(st => st.GymId);
        }
    }

    public class ShiftCycleConfiguration : IEntityTypeConfiguration<ShiftCycle>
    {
        public void Configure(EntityTypeBuilder<ShiftCycle> builder)
        {
            builder.ToTable("ShiftCycles");
            builder.HasKey(sc => sc.Id);

            builder.HasOne(sc => sc.Gym)
                   .WithMany()
                   .HasForeignKey(sc => sc.GymId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(sc => sc.Publisher)
                   .WithMany()
                   .HasForeignKey(sc => sc.PublishedBy)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(sc => sc.GymId);
        }
    }

    public class ShiftAssignmentConfiguration : IEntityTypeConfiguration<ShiftAssignment>
    {
        public void Configure(EntityTypeBuilder<ShiftAssignment> builder)
        {
            builder.ToTable("ShiftAssignments");
            builder.HasKey(sa => sa.Id);

            builder.HasOne(sa => sa.ShiftCycle)
                   .WithMany(sc => sc.ShiftAssignments)
                   .HasForeignKey(sa => sa.ShiftCycleId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(sa => sa.Employee)
                   .WithMany()
                   .HasForeignKey(sa => sa.EmployeeId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(sa => sa.ShiftTemplate)
                   .WithMany()
                   .HasForeignKey(sa => sa.ShiftTemplateId)
                   .OnDelete(DeleteBehavior.SetNull);

            builder.HasIndex(sa => new { sa.EmployeeId, sa.Date }).IsUnique();
            builder.HasIndex(sa => sa.ShiftCycleId);
        }
    }

    public class BiometricDeviceConfiguration : IEntityTypeConfiguration<BiometricDevice>
    {
        public void Configure(EntityTypeBuilder<BiometricDevice> builder)
        {
            builder.ToTable("BiometricDevices");
            builder.HasKey(bd => bd.Id);

            builder.Property(bd => bd.DeviceToken).IsRequired().HasMaxLength(256);
            builder.Property(bd => bd.Vendor).HasMaxLength(100);

            builder.HasIndex(bd => bd.DeviceToken).IsUnique();

            builder.HasOne(bd => bd.Gym)
                   .WithMany()
                   .HasForeignKey(bd => bd.GymId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(bd => bd.GymId);
        }
    }

    public class AttendanceRecordConfiguration : IEntityTypeConfiguration<AttendanceRecord>
    {
        public void Configure(EntityTypeBuilder<AttendanceRecord> builder)
        {
            builder.ToTable("AttendanceRecords");
            builder.HasKey(ar => ar.Id);

            builder.HasOne(ar => ar.Employee)
                   .WithMany()
                   .HasForeignKey(ar => ar.EmployeeId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(ar => ar.Gym)
                   .WithMany()
                   .HasForeignKey(ar => ar.GymId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(ar => ar.ScheduledShiftTemplate)
                   .WithMany()
                   .HasForeignKey(ar => ar.ScheduledShiftTemplateId)
                   .OnDelete(DeleteBehavior.SetNull);

            // Station session stays referenced for audit; deleting a session must
            // never delete attendance history.
            builder.HasOne(ar => ar.StationSession)
                   .WithMany()
                   .HasForeignKey(ar => ar.StationSessionId)
                   .OnDelete(DeleteBehavior.SetNull);

            builder.HasIndex(ar => new { ar.EmployeeId, ar.Date }).IsUnique();
            builder.HasIndex(ar => ar.GymId);
            builder.HasIndex(ar => ar.StationSessionId);
        }
    }

    public class AttendanceCorrectionConfiguration : IEntityTypeConfiguration<AttendanceCorrection>
    {
        public void Configure(EntityTypeBuilder<AttendanceCorrection> builder)
        {
            builder.ToTable("AttendanceCorrections");
            builder.HasKey(ac => ac.Id);

            builder.Property(ac => ac.Reason).IsRequired().HasMaxLength(500);

            builder.HasOne(ac => ac.AttendanceRecord)
                   .WithMany(ar => ar.Corrections)
                   .HasForeignKey(ac => ac.AttendanceRecordId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(ac => ac.CorrectedByUser)
                   .WithMany()
                   .HasForeignKey(ac => ac.CorrectedBy)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(ac => ac.AttendanceRecordId);
        }
    }

    public class StationCodeConfiguration : IEntityTypeConfiguration<StationCode>
    {
        public void Configure(EntityTypeBuilder<StationCode> builder)
        {
            builder.ToTable("StationCodes");
            builder.HasKey(sc => sc.Id);

            builder.Property(sc => sc.Code).IsRequired().HasMaxLength(6);
            builder.Property(sc => sc.GeneratedAt).IsRequired();
            // Null = never expires (development seeds); HR-rotated codes carry a UTC expiry.
            builder.Property(sc => sc.ExpiresAtUtc);

            // The 6-digit station enrollment credential replaces BiometricDevices.DeviceToken:
            // it identifies the gym at station login and is never device-bound.
            builder.HasIndex(sc => sc.Code).IsUnique();
            builder.HasIndex(sc => sc.GymId)
                   .IsUnique()
                   .HasFilter("\"IsActive\" = TRUE");

            builder.HasOne(sc => sc.Gym)
                   .WithMany()
                   .HasForeignKey(sc => sc.GymId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(sc => sc.Generator)
                   .WithMany()
                   .HasForeignKey(sc => sc.GeneratedBy)
                   .OnDelete(DeleteBehavior.SetNull);
        }
    }

    public class StationSessionConfiguration : IEntityTypeConfiguration<StationSession>
    {
        public void Configure(EntityTypeBuilder<StationSession> builder)
        {
            builder.ToTable("StationSessions");
            builder.HasKey(ss => ss.Id);

            // SHA-256 of the opaque session token (64 hex chars) — looked up on every
            // attendance request, indexed for that hot path.
            builder.Property(ss => ss.TokenHash).IsRequired().HasMaxLength(64);
            builder.Property(ss => ss.CreatedAtUtc).IsRequired();
            builder.Property(ss => ss.ExpiresAtUtc).IsRequired();

            builder.HasIndex(ss => ss.TokenHash).IsUnique();
            builder.HasIndex(ss => ss.GymId);
            builder.HasIndex(ss => ss.StationCodeId);

            builder.HasOne(ss => ss.Gym)
                   .WithMany()
                   .HasForeignKey(ss => ss.GymId)
                   .OnDelete(DeleteBehavior.Restrict);

            // Audit link only: deleting a code never deletes the sessions it enrolled.
            builder.HasOne(ss => ss.StationCode)
                   .WithMany()
                   .HasForeignKey(ss => ss.StationCodeId)
                   .OnDelete(DeleteBehavior.SetNull);
        }
    }
}
