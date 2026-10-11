using DomainLayer.Models.UserModule;
using DomainLayer.Models.UserModule.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Presistence.Data.Configurations
{
    public class UserConfiguration : IEntityTypeConfiguration<User>
    {
        public void Configure(EntityTypeBuilder<User> builder)
        {
            builder.ToTable("Users");
            builder.HasKey(u => u.Id);

            builder.Property(u => u.Email).IsRequired().HasMaxLength(256);
            builder.Property(u => u.UserName).IsRequired().HasMaxLength(100);
            builder.Property(u => u.PasswordHash).IsRequired();
            builder.Property(u => u.UserType).IsRequired();

            builder.HasIndex(u => u.Email).IsUnique();
            builder.HasIndex(u => u.UserName).IsUnique();

            builder.HasOne(u => u.EmployeeProfile)
                   .WithOne(e => e.User)
                   .HasForeignKey<DomainLayer.Models.EmployeeModule.Employee>(e => e.UserId)
                   .OnDelete(DeleteBehavior.Restrict);
        }
    }

    public class RoleConfiguration : IEntityTypeConfiguration<Role>
    {
        public void Configure(EntityTypeBuilder<Role> builder)
        {
            builder.ToTable("Roles");
            builder.HasKey(r => r.Id);

            builder.Property(r => r.Name).IsRequired().HasMaxLength(100);
            builder.Property(r => r.Description).HasMaxLength(500);

            builder.HasIndex(r => r.Name).IsUnique();
        }
    }

    public class PermissionConfiguration : IEntityTypeConfiguration<Permission>
    {
        public void Configure(EntityTypeBuilder<Permission> builder)
        {
            builder.ToTable("Permissions");
            builder.HasKey(p => p.Id);

            builder.Property(p => p.Key).IsRequired().HasMaxLength(150);
            builder.Property(p => p.Area).IsRequired().HasMaxLength(100);
            builder.Property(p => p.Description).HasMaxLength(500);

            builder.HasIndex(p => p.Key).IsUnique();
        }
    }

    public class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
    {
        public void Configure(EntityTypeBuilder<UserRole> builder)
        {
            builder.ToTable("UserRoles");
            builder.HasKey(ur => new { ur.UserId, ur.RoleId });

            builder.HasOne(ur => ur.User)
                   .WithMany(u => u.UserRoles)
                   .HasForeignKey(ur => ur.UserId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(ur => ur.Role)
                   .WithMany(r => r.UserRoles)
                   .HasForeignKey(ur => ur.RoleId)
                   .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class RolePermissionConfiguration : IEntityTypeConfiguration<RolePermission>
    {
        public void Configure(EntityTypeBuilder<RolePermission> builder)
        {
            builder.ToTable("RolePermissions");
            builder.HasKey(rp => new { rp.RoleId, rp.PermissionId });

            builder.Property(rp => rp.Level)
                   .IsRequired()
                   .HasDefaultValue(AccessLevel.None)
                   .HasConversion<int>();

            builder.HasOne(rp => rp.Role)
                   .WithMany(r => r.RolePermissions)
                   .HasForeignKey(rp => rp.RoleId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(rp => rp.Permission)
                   .WithMany(p => p.RolePermissions)
                   .HasForeignKey(rp => rp.PermissionId)
                   .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class UserPermissionConfiguration : IEntityTypeConfiguration<UserPermission>
    {
        public void Configure(EntityTypeBuilder<UserPermission> builder)
        {
            builder.ToTable("UserPermissions");
            builder.HasKey(up => new { up.UserId, up.PermissionId });

            builder.Property(up => up.Level)
                   .IsRequired()
                   .HasDefaultValue(AccessLevel.None)
                   .HasConversion<int>();

            builder.HasOne(up => up.User)
                   .WithMany(u => u.UserPermissions)
                   .HasForeignKey(up => up.UserId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(up => up.Permission)
                   .WithMany(p => p.UserPermissions)
                   .HasForeignKey(up => up.PermissionId)
                   .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class UserGymRoleConfiguration : IEntityTypeConfiguration<UserGymRole>
    {
        public void Configure(EntityTypeBuilder<UserGymRole> builder)
        {
            builder.ToTable("UserGymRoles");
            builder.HasKey(ugr => new { ugr.UserId, ugr.GymId, ugr.RoleId });

            builder.HasOne(ugr => ugr.User)
                   .WithMany(u => u.UserGymRoles)
                   .HasForeignKey(ugr => ugr.UserId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(ugr => ugr.Gym)
                   .WithMany(g => g.UserGymRoles)
                   .HasForeignKey(ugr => ugr.GymId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(ugr => ugr.Role)
                   .WithMany(r => r.UserGymRoles)
                   .HasForeignKey(ugr => ugr.RoleId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(ugr => new { ugr.UserId, ugr.GymId });
        }
    }

    public class UserGymPermissionConfiguration : IEntityTypeConfiguration<UserGymPermission>
    {
        public void Configure(EntityTypeBuilder<UserGymPermission> builder)
        {
            builder.ToTable("UserGymPermissions");
            builder.HasKey(ugp => new { ugp.UserId, ugp.GymId, ugp.PermissionId });

            builder.Property(ugp => ugp.Level)
                   .IsRequired()
                   .HasDefaultValue(AccessLevel.None)
                   .HasConversion<int>();

            builder.HasOne(ugp => ugp.User)
                   .WithMany(u => u.UserGymPermissions)
                   .HasForeignKey(ugp => ugp.UserId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(ugp => ugp.Gym)
                   .WithMany(g => g.UserGymPermissions)
                   .HasForeignKey(ugp => ugp.GymId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(ugp => ugp.Permission)
                   .WithMany(p => p.UserGymPermissions)
                   .HasForeignKey(ugp => ugp.PermissionId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(ugp => new { ugp.UserId, ugp.GymId });
        }
    }

    public class UserGymAccessConfiguration : IEntityTypeConfiguration<UserGymAccess>
    {
        public void Configure(EntityTypeBuilder<UserGymAccess> builder)
        {
            builder.ToTable("UserGymAccess");
            builder.HasKey(uga => new { uga.UserId, uga.GymId });

            builder.HasOne(uga => uga.User)
                   .WithMany(u => u.UserGymAccesses)
                   .HasForeignKey(uga => uga.UserId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(uga => uga.Gym)
                   .WithMany(g => g.UserGymAccesses)
                   .HasForeignKey(uga => uga.GymId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(uga => uga.UserId);
        }
    }

    public class UserNotificationPreferenceConfiguration : IEntityTypeConfiguration<UserNotificationPreference>
    {
        public void Configure(EntityTypeBuilder<UserNotificationPreference> builder)
        {
            builder.ToTable("UserNotificationPreferences");
            builder.HasKey(p => p.Id);
            builder.HasOne(p => p.User).WithOne(u => u.NotificationPreference)
                   .HasForeignKey<UserNotificationPreference>(p => p.UserId)
                   .OnDelete(DeleteBehavior.Cascade);
            builder.HasIndex(p => p.UserId).IsUnique();
        }
    }
}
