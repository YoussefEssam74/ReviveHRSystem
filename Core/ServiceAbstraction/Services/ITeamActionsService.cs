using DomainLayer.Models.EmployeeModule;
using Shared.DataTransferObject.EmployeeProfile;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Team Actions surface (mock 13.4-13.8 / 19): follow-ups raised about team
    /// members, the "Remind" shortcut, and one-to-one messages. Every operation is
    /// scoped by the service layer to the caller's team (Team Leader) or gym
    /// (Branch Manager); cross-scope targets answer 404 (ADR-003 Amendment 1).
    /// </summary>
    public interface ITeamActionsService
    {
        /// <summary>Follow-ups of the caller's scope, newest activity first.</summary>
        Task<IReadOnlyList<TeamFollowUpDto>> GetFollowUpsAsync(
            int actorUserId, int? activeGymId, int? teamId, CancellationToken cancellationToken = default);

        /// <summary>Raises a follow-up about an in-scope employee of the caller's team.</summary>
        Task<TeamFollowUpDto> CreateFollowUpAsync(
            int actorUserId, int? activeGymId, CreateTeamFollowUpDto request, CancellationToken cancellationToken = default);

        /// <summary>Records an action on an in-scope follow-up; Resolution closes it.</summary>
        Task<TeamFollowUpDto> UpdateFollowUpAsync(
            int actorUserId, int followUpId, int? activeGymId, UpdateTeamFollowUpDto request, CancellationToken cancellationToken = default);

        /// <summary>Sends a reminder to an in-scope team member (records a follow-up + notification).</summary>
        Task SendReminderAsync(
            int actorUserId, int employeeId, int? activeGymId, CancellationToken cancellationToken = default);

        /// <summary>Sends a one-to-one message to an in-scope team member.</summary>
        Task SendMessageAsync(
            int actorUserId, int employeeId, int? activeGymId, SendTeamMessageDto request, CancellationToken cancellationToken = default);

        /// <summary>
        /// Runs the attendance sweep: for every employee flagged as absent without
        /// permission for a past date it auto-raises a pending 3-day deduction
        /// follow-up, unless one already exists for that employee/date. The item
        /// stays open for the manager / HR to review and confirm.
        /// </summary>
        Task<int> SweepAbsenceDeductionsAsync(
            IReadOnlyList<Employee> employees, DateOnly date, CancellationToken cancellationToken = default);
    }
}
