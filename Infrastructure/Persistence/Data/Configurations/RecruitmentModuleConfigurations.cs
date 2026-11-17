using DomainLayer.Models.RecruitmentModule;
using DomainLayer.Models.UserModule;
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
            builder.Property(vr => vr.Urgency).HasMaxLength(20);
            builder.Property(vr => vr.Salary).HasPrecision(12, 2);
            builder.Property(vr => vr.Shift).HasMaxLength(100);
            builder.Property(vr => vr.SubmittedDate).HasDefaultValueSql("CURRENT_TIMESTAMP");

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
            builder.Property(v => v.Urgency).HasMaxLength(20);
            builder.Property(v => v.Salary).HasPrecision(12, 2);
            builder.Property(v => v.Shift).HasMaxLength(100);
            builder.Property(v => v.Source).HasMaxLength(100);
            builder.Property(v => v.CreatedDate).HasDefaultValueSql("CURRENT_TIMESTAMP");

            builder.HasIndex(v => v.PublicLinkToken).IsUnique();

            builder.HasOne(v => v.Gym)
                   .WithMany()
                   .HasForeignKey(v => v.GymId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(v => v.Position)
                   .WithMany()
                   .HasForeignKey(v => v.PositionId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne<User>()
                   .WithMany()
                   .HasForeignKey(v => v.RequestedBy)
                   .OnDelete(DeleteBehavior.SetNull);

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
            builder.Property(c => c.Rating).HasPrecision(4, 2);
            builder.Property(c => c.BlockReason).HasMaxLength(500);

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

            builder.Property(a => a.Source).HasMaxLength(100);
            builder.Property(a => a.PreferredGym).HasMaxLength(100);
            builder.Property(a => a.Education).HasMaxLength(500);
            builder.Property(a => a.LanguagesJson).HasColumnType("jsonb");
            builder.Property(a => a.ShiftPreference).HasMaxLength(100);
            builder.Property(a => a.SalaryExpectation).HasPrecision(12, 2);
            builder.Property(a => a.Availability).HasMaxLength(100);
            builder.Property(a => a.Notes).HasMaxLength(1000);
            builder.Property(a => a.RejectReason).HasMaxLength(500);
            builder.Property(a => a.DecisionNote).HasMaxLength(500);

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
            builder.Property(i => i.Type).HasMaxLength(50);
            builder.Property(i => i.Room).HasMaxLength(200);
            builder.Property(i => i.Status).HasMaxLength(20);
            builder.Property(i => i.Verdict).HasMaxLength(50);
            builder.Property(i => i.Evaluation).HasMaxLength(2000);
            builder.Property(i => i.InterviewerName).HasMaxLength(200);

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

    public class HiringFormConfiguration : IEntityTypeConfiguration<HiringForm>
    {
        public void Configure(EntityTypeBuilder<HiringForm> builder)
        {
            builder.ToTable("HiringForms");
            builder.HasKey(hf => hf.Id);

            builder.Property(hf => hf.Name).IsRequired().HasMaxLength(200);
            builder.Property(hf => hf.Position).HasMaxLength(200);
            builder.Property(hf => hf.Status).IsRequired().HasMaxLength(20);
            builder.Property(hf => hf.QuestionsJson).IsRequired().HasColumnType("jsonb");
            builder.Property(hf => hf.CreatedDate).HasDefaultValueSql("CURRENT_TIMESTAMP");

            builder.HasOne(hf => hf.Gym)
                   .WithMany()
                   .HasForeignKey(hf => hf.GymId)
                   .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(hf => hf.Creator)
                   .WithMany()
                   .HasForeignKey(hf => hf.CreatedBy)
                   .OnDelete(DeleteBehavior.SetNull);

            builder.HasIndex(hf => hf.Status);
        }
    }

    public class HiringFormApplicationConfiguration : IEntityTypeConfiguration<HiringFormApplication>
    {
        public void Configure(EntityTypeBuilder<HiringFormApplication> builder)
        {
            builder.ToTable("HiringFormApplications");
            builder.HasKey(hfa => hfa.Id);

            builder.Property(hfa => hfa.Name).IsRequired().HasMaxLength(200);
            builder.Property(hfa => hfa.Email).IsRequired().HasMaxLength(256);
            builder.Property(hfa => hfa.Phone).IsRequired().HasMaxLength(50);
            builder.Property(hfa => hfa.Gym).HasMaxLength(200);
            builder.Property(hfa => hfa.AnswersJson).IsRequired().HasColumnType("jsonb");
            builder.Property(hfa => hfa.Status).IsRequired().HasMaxLength(30);
            builder.Property(hfa => hfa.AppliedDate).HasDefaultValueSql("CURRENT_TIMESTAMP");
            builder.Property(hfa => hfa.RejectComment).HasMaxLength(1000);

            builder.HasOne(hfa => hfa.HiringForm)
                   .WithMany()
                   .HasForeignKey(hfa => hfa.HiringFormId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(hfa => hfa.Candidate)
                   .WithMany()
                   .HasForeignKey(hfa => hfa.CandidateId)
                   .OnDelete(DeleteBehavior.SetNull);

            builder.HasIndex(hfa => new { hfa.HiringFormId, hfa.Status });
            builder.HasIndex(hfa => hfa.Email);
        }
    }
}
