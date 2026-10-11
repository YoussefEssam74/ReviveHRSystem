using Shared.DataTransferObject.EmployeeProfile;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Shift/schedule management (mock §§15-16): cycles of the gym (create, read,
    /// assignment upserts, publish, delete) and reusable shift templates. Scope:
    /// team-scoped leaders act on their team's members, Branch Managers on the
    /// gym's roster; employees only ever see published cycles (Slice 1 endpoint).
    /// </summary>
    public interface IShiftManagementService
    {
        Task<IReadOnlyList<ShiftCycleDto>> GetCyclesAsync(
            int actorUserId, int gymId, string? month, CancellationToken cancellationToken = default);

        Task<ShiftCycleDetailDto> GetCycleAsync(
            int actorUserId, int gymId, int cycleId, CancellationToken cancellationToken = default);

        Task<ShiftCycleDto> CreateCycleAsync(
            int actorUserId, int gymId, CreateShiftCycleDto request, CancellationToken cancellationToken = default);

        Task UpdateAssignmentsAsync(
            int actorUserId, int gymId, int cycleId, UpdateAssignmentsDto request, CancellationToken cancellationToken = default);

        Task PublishAsync(int actorUserId, int gymId, int cycleId, CancellationToken cancellationToken = default);

        Task DeleteAsync(int actorUserId, int gymId, int cycleId, CancellationToken cancellationToken = default);

        Task<IReadOnlyList<ShiftTemplateDto>> GetTemplatesAsync(
            int actorUserId, int gymId, CancellationToken cancellationToken = default);

        Task<ShiftTemplateDto> CreateTemplateAsync(
            int actorUserId, int gymId, CreateShiftTemplateDto request, CancellationToken cancellationToken = default);

        Task<ShiftTemplateDto> UpdateTemplateAsync(
            int actorUserId, int gymId, int templateId, UpdateShiftTemplateDto request, CancellationToken cancellationToken = default);

        Task DeleteTemplateAsync(int actorUserId, int gymId, int templateId, CancellationToken cancellationToken = default);
    }
}
