using DomainLayer.Models.AuditModule;
using DomainLayer.Models.EvaluationModule;
using DomainLayer.Models.NotificationModule;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Presistence.Data.Configurations
{
    public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
    {
        public void Configure(EntityTypeBuilder<Notification> builder)
        {
            builder.ToTable("Notifications");
            builder.HasKey(n => n.Id);

            builder.Property(n => n.Title).IsRequired().HasMaxLength(200);
            builder.Property(n => n.Message).IsRequired();
            builder.Property(n => n.LinkTo).HasMaxLength(500);

            builder.HasOne(n => n.User)
                   .WithMany(u => u.Notifications)
                   .HasForeignKey(n => n.UserId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(n => new { n.UserId, n.IsRead });
        }
    }

    public class AnnouncementConfiguration : IEntityTypeConfiguration<Announcement>
    {
        public void Configure(EntityTypeBuilder<Announcement> builder)
        {
            builder.ToTable("Announcements");
            builder.HasKey(a => a.Id);

            builder.Property(a => a.Title).IsRequired().HasMaxLength(200);
            builder.Property(a => a.Body).IsRequired();

            builder.HasOne(a => a.Author)
                   .WithMany()
                   .HasForeignKey(a => a.AuthorId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(a => new { a.Status, a.ScheduledAt });
        }
    }

    public class AnnouncementTargetConfiguration : IEntityTypeConfiguration<AnnouncementTarget>
    {
        public void Configure(EntityTypeBuilder<AnnouncementTarget> builder)
        {
            builder.ToTable("AnnouncementTargets");
            builder.HasKey(at => at.Id);

            builder.HasOne(at => at.Announcement)
                   .WithMany(a => a.Targets)
                   .HasForeignKey(at => at.AnnouncementId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(at => at.Gym)
                   .WithMany()
                   .HasForeignKey(at => at.GymId)
                   .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(at => at.Department)
                   .WithMany()
                   .HasForeignKey(at => at.DepartmentId)
                   .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(at => at.Role)
                   .WithMany()
                   .HasForeignKey(at => at.RoleId)
                   .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(at => at.User)
                   .WithMany()
                   .HasForeignKey(at => at.UserId)
                   .OnDelete(DeleteBehavior.SetNull);

            builder.HasIndex(at => at.AnnouncementId);
        }
    }

    public class EventConfiguration : IEntityTypeConfiguration<Event>
    {
        public void Configure(EntityTypeBuilder<Event> builder)
        {
            builder.ToTable("Events");
            builder.HasKey(e => e.Id);

            builder.Property(e => e.EntityType).IsRequired().HasMaxLength(100);
            builder.Property(e => e.Title).IsRequired().HasMaxLength(200);
            builder.Property(e => e.Description).IsRequired();

            builder.HasOne(e => e.Gym)
                   .WithMany()
                   .HasForeignKey(e => e.GymId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(e => e.Resolver)
                   .WithMany()
                   .HasForeignKey(e => e.ResolvedBy)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(e => new { e.GymId, e.Status });
        }
    }

    public class EvaluationFormConfiguration : IEntityTypeConfiguration<EvaluationForm>
    {
        public void Configure(EntityTypeBuilder<EvaluationForm> builder)
        {
            builder.ToTable("EvaluationForms");
            builder.HasKey(ef => ef.Id);

            builder.Property(ef => ef.Name).IsRequired().HasMaxLength(200);

            builder.HasOne(ef => ef.Gym)
                   .WithMany()
                   .HasForeignKey(ef => ef.GymId)
                   .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(ef => ef.Position)
                   .WithMany()
                   .HasForeignKey(ef => ef.PositionId)
                   .OnDelete(DeleteBehavior.SetNull);
        }
    }

    public class EvaluationQuestionConfiguration : IEntityTypeConfiguration<EvaluationQuestion>
    {
        public void Configure(EntityTypeBuilder<EvaluationQuestion> builder)
        {
            builder.ToTable("EvaluationQuestions");
            builder.HasKey(eq => eq.Id);

            builder.Property(eq => eq.QuestionText).IsRequired().HasMaxLength(500);
            builder.Property(eq => eq.OptionsJson).HasColumnType("jsonb");

            builder.HasOne(eq => eq.EvaluationForm)
                   .WithMany(ef => ef.Questions)
                   .HasForeignKey(eq => eq.EvaluationFormId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(eq => eq.EvaluationFormId);
        }
    }

    public class EvaluationResponseConfiguration : IEntityTypeConfiguration<EvaluationResponse>
    {
        public void Configure(EntityTypeBuilder<EvaluationResponse> builder)
        {
            builder.ToTable("EvaluationResponses");
            builder.HasKey(er => er.Id);

            builder.HasOne(er => er.EvaluationForm)
                   .WithMany(ef => ef.Responses)
                   .HasForeignKey(er => er.EvaluationFormId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(er => er.Employee)
                   .WithMany()
                   .HasForeignKey(er => er.EmployeeId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(er => er.Evaluator)
                   .WithMany()
                   .HasForeignKey(er => er.EvaluatedBy)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(er => er.EmployeeId);
        }
    }

    public class EvaluationAnswerConfiguration : IEntityTypeConfiguration<EvaluationAnswer>
    {
        public void Configure(EntityTypeBuilder<EvaluationAnswer> builder)
        {
            builder.ToTable("EvaluationAnswers");
            builder.HasKey(ea => ea.Id);

            builder.Property(ea => ea.AnswerValueJson).IsRequired().HasColumnType("jsonb");

            builder.HasOne(ea => ea.EvaluationResponse)
                   .WithMany(er => er.Answers)
                   .HasForeignKey(ea => ea.EvaluationResponseId)
                   .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(ea => ea.EvaluationQuestion)
                   .WithMany()
                   .HasForeignKey(ea => ea.EvaluationQuestionId)
                   .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(ea => ea.EvaluationResponseId);
        }
    }

    public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
    {
        public void Configure(EntityTypeBuilder<AuditLog> builder)
        {
            builder.ToTable("AuditLogs");
            builder.HasKey(al => al.Id);

            builder.Property(al => al.Action).IsRequired().HasMaxLength(50);
            builder.Property(al => al.EntityType).IsRequired().HasMaxLength(100);
            builder.Property(al => al.OldValues).HasColumnType("jsonb");
            builder.Property(al => al.NewValues).HasColumnType("jsonb");
            builder.Property(al => al.IpAddress).HasMaxLength(45);

            builder.HasIndex(al => new { al.EntityType, al.EntityId });
            builder.HasIndex(al => al.Timestamp);
        }
    }
}
