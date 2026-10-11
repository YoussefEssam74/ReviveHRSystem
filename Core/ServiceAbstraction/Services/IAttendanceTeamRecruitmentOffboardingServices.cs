using Shared.DataTransferObject.EmployeeProfile;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Branch/team attendance management (mock §22): the day view with late,
    /// absent and missing-checkout breakdowns, scoped to the caller's team (Team
    /// Leader) or gym (Branch Manager). Corrections are manual entries, not edits.
    /// </summary>
    public interface IAttendanceManagementService
    {
        Task<AttendanceManagementDto> GetDayAsync(
            int actorUserId, int? activeGymId, DateOnly? date, CancellationToken cancellationToken = default);
    }

    /// <summary>Team overview (mock §13 My Team): the caller's teams and a team-day view.</summary>
    public interface ITeamOverviewService
    {
        Task<IReadOnlyList<TeamDto>> GetMyTeamsAsync(
            int actorUserId, int? activeGymId, CancellationToken cancellationToken = default);

        Task<TeamTodayDto> GetTeamTodayAsync(
            int actorUserId, int teamId, int? activeGymId, DateOnly? date, CancellationToken cancellationToken = default);
    }

    /// <summary>Vacancy requests raised by the branch (mock §23 Recruitment).</summary>
    public interface IVacancyRequestService
    {
        Task<IReadOnlyList<VacancyRequestDto>> GetRequestsAsync(
            int actorUserId, int? activeGymId, CancellationToken cancellationToken = default);

        Task<VacancyRequestDto> CreateAsync(
            int actorUserId, int? activeGymId, CreateVacancyRequestDto request, CancellationToken cancellationToken = default);
    }

    /// <summary>Employee leaving / offboarding cases (mock §24).</summary>
    public interface IOffboardingService
    {
        Task<IReadOnlyList<OffboardingCaseDto>> GetCasesAsync(
            int actorUserId, int? activeGymId, CancellationToken cancellationToken = default);

        Task<OffboardingCaseDto> InitiateAsync(
            int actorUserId, int? activeGymId, InitiateOffboardingDto request, CancellationToken cancellationToken = default);
    }
}
