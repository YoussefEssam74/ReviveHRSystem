using DomainLayer.Contracts;
using DomainLayer.Models.AttendanceModule;

namespace Service.Specifications
{
    /// <summary>The employee's stored face embedding, if any.</summary>
    public class FaceEmbeddingByEmployeeSpec : BaseSpecification<FaceEmbedding, int>
    {
        public FaceEmbeddingByEmployeeSpec(int employeeId)
        {
            Criteria = f => f.EmployeeId == employeeId;
            // Enroll/delete mutate the fetched row before SaveChanges without
            // Update() — keep tracked.
            ApplyTracking();
        }
    }

    /// <summary>
    /// Face embeddings of employees with access to the given gym (ADR-004 scope) —
    /// the candidate set for station face recognition.
    /// </summary>
    public class FaceEmbeddingsForGymSpec : BaseSpecification<FaceEmbedding, int>
    {
        public FaceEmbeddingsForGymSpec(int gymId)
        {
            Criteria = f => f.Employee.User.UserGymAccesses.Any(a => a.GymId == gymId);
            AddInclude(f => f.Employee);
            ApplyNoTracking();
        }
    }
}
