using DomainLayer.Models.RecruitmentModule;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Presistence.Data.Configurations
{
    public class VacancyRequestConfiguration : IEntityTypeConfiguration<VacancyRequest>
    {
        public void Configure(EntityTypeBuilder<VacancyRequest> builder)
        {
            builder.ToTable("VacancyRequests");
            builder.HasKey(vr => vr.Id);

            builder.Property(vr => vr.Justification).IsRequired();
            builder.Property(vr => vr.DecisionComment).HasMaxLength(1000);

            builder.HasOne(vr => vr.Gym)
                   .WithMany()
                   .HasForeignKey(vr => vr.GymId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(vr => vr.Position)
                   .WithMany()
                   .HasForeignKey(vr => vr.PositionId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(vr => vr.Requester)
                   .WithMany()
                   .HasForeignKey(vr => vr.RequestedBy)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(vr => vr.Decider)
                   .WithMany()
                   .HasForeignKey(vr => vr.DecidedBy)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(vr => vr.ResultingVacancy)
                   .WithMany()
                   .HasForeignKey(vr => vr.ResultingVacancyId)
                   .OnDelete(DeleteBehavior.SetNull);

            builder.HasIndex(vr => new { vr.GymId, vr.Status });
        }
    }

    public class VacancyConfiguration : IEntityTypeConfiguration<Vacancy>
    {
        public void Configure(EntityTypeBuilder<Vacancy> builder)
        {
            builder.ToTable("Vacancies");
            builder.HasKey(v => v.Id);

            builder.Property(v => v.Title).IsRequired().HasMaxLength(200);
            builder.Property(v => v.Description).IsRequired();
            builder.Property(v => v.Requirements).IsRequired();
            builder.Property(v => v.PublicLinkToken).IsRequired().HasMaxLength(100);

            builder.HasIndex(v => v.PublicLinkToken).IsUnique();

            builder.HasOne(v => v.Gym)
                   .WithMany()
                   .HasForeignKey(v => v.GymId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(v => v.Position)
                   .WithMany()
                   .HasForeignKey(v => v.PositionId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(v => v.GymId);
        }
    }

    public class CandidateConfiguration : IEntityTypeConfiguration<Candidate>
    {
        public void Configure(EntityTypeBuilder<Candidate> builder)
        {
            builder.ToTable("Candidates");
            builder.HasKey(c => c.Id);

            builder.Property(c => c.FullName).IsRequired().HasMaxLength(200);
            builder.Property(c => c.Email).IsRequired().HasMaxLength(256);
            builder.Property(c => c.Phone).IsRequired().HasMaxLength(50);
            builder.Property(c => c.NationalId).IsRequired().HasMaxLength(50);
            builder.Property(c => c.CVFilePath).HasMaxLength(500);

            // PostgreSQL JSONB columns
            builder.Property(c => c.EducationJson).HasColumnType("jsonb");
            builder.Property(c => c.ExperienceJson).HasColumnType("jsonb");
            builder.Property(c => c.SkillsJson).HasColumnType("jsonb");

            builder.HasIndex(c => c.Email);
            builder.HasIndex(c => c.NationalId);
        }
    }

    public class ApplicationConfiguration : IEntityTypeConfiguration<Application>
    {
        public void Configure(EntityTypeBuilder<Application> builder)
        {
            builder.ToTable("Applications");
            builder.HasKey(a => a.Id);

            builder.HasOne(a => a.Vacancy)
                   .WithMany(v => v.Applications)
                   .HasForeignKey(a => a.VacancyId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(a => a.Candidate)
                   .WithMany(c => c.Applications)
                   .HasForeignKey(a => a.CandidateId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(a => a.VacancyId);
            builder.HasIndex(a => a.CandidateId);
        }
    }

    public class PipelineStageConfiguration : IEntityTypeConfiguration<PipelineStage>
    {
        public void Configure(EntityTypeBuilder<PipelineStage> builder)
        {
            builder.ToTable("PipelineStages");
            builder.HasKey(ps => ps.Id);

            builder.Property(ps => ps.RequiredAction).HasMaxLength(500);
            builder.Property(ps => ps.Outcome).HasMaxLength(500);
            builder.Property(ps => ps.Notes).HasMaxLength(2000);

            builder.HasOne(ps => ps.Application)
                   .WithMany(a => a.PipelineStages)
                   .HasForeignKey(ps => ps.ApplicationId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(ps => ps.ApplicationId);
        }
    }

    public class InterviewConfiguration : IEntityTypeConfiguration<Interview>
    {
        public void Configure(EntityTypeBuilder<Interview> builder)
        {
            builder.ToTable("Interviews");
            builder.HasKey(i => i.Id);

            builder.Property(i => i.InterviewerNotes).HasMaxLength(2000);

            builder.HasOne(i => i.Application)
                   .WithMany(a => a.Interviews)
                   .HasForeignKey(i => i.ApplicationId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(i => i.Interviewer)
                   .WithMany()
                   .HasForeignKey(i => i.ConductedBy)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(i => i.ApplicationId);
        }
    }
}
