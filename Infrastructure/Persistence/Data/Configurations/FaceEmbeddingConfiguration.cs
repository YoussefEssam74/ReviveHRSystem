using DomainLayer.Models.AttendanceModule;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Presistence.Data.Configurations
{
    public class FaceEmbeddingConfiguration : IEntityTypeConfiguration<FaceEmbedding>
    {
        public void Configure(EntityTypeBuilder<FaceEmbedding> builder)
        {
            builder.ToTable("FaceEmbeddings");
            builder.HasKey(f => f.Id);

            // SFace produces a 128-d float vector.
            builder.Property(f => f.Feature).IsRequired().HasColumnType("real[]");

            // Deleting an employee removes their biometric.
            builder.HasOne(f => f.Employee)
                   .WithMany()
                   .HasForeignKey(f => f.EmployeeId)
                   .OnDelete(DeleteBehavior.Cascade);

            // One enrolled face per employee; re-enrolling updates the row.
            builder.HasIndex(f => f.EmployeeId).IsUnique();
        }
    }
}
