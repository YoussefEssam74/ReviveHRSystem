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

            builder.HasIndex(ar => new { ar.EmployeeId, ar.Date }).IsUnique();
            builder.HasIndex(ar => ar.GymId);
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
}
