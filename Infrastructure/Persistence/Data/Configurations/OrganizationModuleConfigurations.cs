using DomainLayer.Models.OrganizationModule;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Presistence.Data.Configurations
{
    public class GymConfiguration : IEntityTypeConfiguration<Gym>
    {
        public void Configure(EntityTypeBuilder<Gym> builder)
        {
            builder.ToTable("Gyms");
            builder.HasKey(g => g.Id);

            builder.Property(g => g.Name).IsRequired().HasMaxLength(200);
            builder.Property(g => g.Location).IsRequired().HasMaxLength(300);
            builder.Property(g => g.ContactInfo).HasMaxLength(300);
            builder.Property(g => g.AnnualIncreasePercent).HasPrecision(5, 2);

            builder.HasIndex(g => g.Name);
        }
    }

    public class DepartmentConfiguration : IEntityTypeConfiguration<Department>
    {
        public void Configure(EntityTypeBuilder<Department> builder)
        {
            builder.ToTable("Departments");
            builder.HasKey(d => d.Id);

            builder.Property(d => d.Name).IsRequired().HasMaxLength(150);

            builder.HasOne(d => d.Gym)
                   .WithMany(g => g.Departments)
                   .HasForeignKey(d => d.GymId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(d => d.GymId);
        }
    }

    public class PositionConfiguration : IEntityTypeConfiguration<Position>
    {
        public void Configure(EntityTypeBuilder<Position> builder)
        {
            builder.ToTable("Positions");
            builder.HasKey(p => p.Id);

            builder.Property(p => p.Title).IsRequired().HasMaxLength(150);
            builder.Property(p => p.Level).IsRequired().HasMaxLength(100);

            builder.HasOne(p => p.Gym)
                   .WithMany(g => g.Positions)
                   .HasForeignKey(p => p.GymId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(p => p.GymId);
        }
    }

    public class TeamConfiguration : IEntityTypeConfiguration<Team>
    {
        public void Configure(EntityTypeBuilder<Team> builder)
        {
            builder.ToTable("Teams");
            builder.HasKey(t => t.Id);

            builder.Property(t => t.Name).IsRequired().HasMaxLength(150);

            builder.HasOne(t => t.Gym)
                   .WithMany(g => g.Teams)
                   .HasForeignKey(t => t.GymId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(t => t.GymId);
        }
    }

    public class TeamLeaderConfiguration : IEntityTypeConfiguration<TeamLeader>
    {
        public void Configure(EntityTypeBuilder<TeamLeader> builder)
        {
            builder.ToTable("TeamLeaders");
            builder.HasKey(tl => tl.Id);

            builder.HasOne(tl => tl.Team)
                   .WithMany(t => t.TeamLeaders)
                   .HasForeignKey(tl => tl.TeamId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(tl => tl.Employee)
                   .WithMany(e => e.TeamLeaders)
                   .HasForeignKey(tl => tl.EmployeeId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(tl => tl.EmployeeId);
            builder.HasIndex(tl => tl.TeamId);
        }
    }

    public class TeamMemberConfiguration : IEntityTypeConfiguration<TeamMember>
    {
        public void Configure(EntityTypeBuilder<TeamMember> builder)
        {
            builder.ToTable("TeamMembers");
            builder.HasKey(tm => tm.Id);

            builder.HasOne(tm => tm.Team)
                   .WithMany(t => t.TeamMembers)
                   .HasForeignKey(tm => tm.TeamId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(tm => tm.Employee)
                   .WithMany(e => e.TeamMembers)
                   .HasForeignKey(tm => tm.EmployeeId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(tm => tm.EmployeeId);
            builder.HasIndex(tm => tm.TeamId);
        }
    }
}
