using DomainLayer.Contracts;
using DomainLayer.Models.AuditModule;
using DomainLayer.Models.OrganizationModule;

namespace Service.Specifications
{
    /// <summary>
    /// Positions catalog rows (api-spec-from-ui.md §5.9.2). Org-wide listing filtered
    /// to the actor's gym scope; null/empty scope matches everything (same semantics
    /// as VacancyListSpec).
    /// </summary>
    public sealed class PositionCatalogSpec : BaseSpecification<Position, int>
    {
        public PositionCatalogSpec(int[]? gymIds, int? requestedGym, string? search, bool? active)
        {
            var term = string.IsNullOrWhiteSpace(search) ? null : search.Trim().ToLower();

            Criteria = p =>
                (gymIds == null || gymIds.Length == 0 || gymIds.Contains(p.GymId)) &&
                (requestedGym == null || p.GymId == requestedGym) &&
                (term == null || p.Title.ToLower().Contains(term)) &&
                (active == null || p.IsActive == active);

            AddInclude(p => p.Gym);
            AddInclude(p => p.Department!);
            OrderBy = p => p.Title;
        }
    }

    /// <summary>
    /// Audit log rows (api-spec-from-ui.md §5.9.3). The category filter maps the UI's
    /// "All Actions | Employee | Payroll | Recruitment | Bulk Import" selector onto the
    /// recorded entity types; rows without a gym (org-wide actions) stay visible to
    /// every audited reader while gym-tagged rows honor the actor's scope.
    /// </summary>
    public sealed class AuditLogListSpec : BaseSpecification<AuditLog, int>
    {
        public AuditLogListSpec(int[]? gymIds, int? gym, int? userId, string? actionCategory, DateTime? from, DateTime? to, int skip, int take)
        {
            var category = string.IsNullOrWhiteSpace(actionCategory)
                ? null
                : actionCategory.Trim().ToLowerInvariant();

            Criteria = a =>
                (a.GymId == null || gymIds == null || gymIds.Length == 0 || gymIds.Contains(a.GymId.Value)) &&
                (gym == null || a.GymId == gym) &&
                (userId == null || a.UserId == userId) &&
                (from == null || a.Timestamp >= from.Value) &&
                (to == null || a.Timestamp <= to.Value) &&
                (category == null ||
                    (category == "employee" && a.EntityType.Contains("Employee")) ||
                    (category == "payroll" && (a.EntityType.Contains("Payroll") || a.EntityType.Contains("Payslip") || a.EntityType.Contains("Deduction"))) ||
                    (category == "recruitment" && (a.EntityType.Contains("Vacancy") || a.EntityType.Contains("Candidate") || a.EntityType.Contains("Application") || a.EntityType.Contains("Interview") || a.EntityType.Contains("HiringForm"))) ||
                    (category == "bulk import" && (a.Action.ToLower().Contains("import") || a.EntityType.Contains("Import"))));

            OrderByDescending = a => a.Timestamp;

            if (take > 0)
            {
                ApplyPaging(skip, take);
            }
        }
    }
}
