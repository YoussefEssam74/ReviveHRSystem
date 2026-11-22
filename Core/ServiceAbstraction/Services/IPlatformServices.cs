using Shared.DataTransferObject.Platform;

namespace ServiceAbstraction.Services
{
    /// <summary>
    /// Gym companies (tenants): provisioning, profile, lifecycle, branches and the
    /// per-company views of the Super Admin console (overview, employees, billing, audit).
    /// Every method takes the acting user id so permission and scope checks run at the
    /// service layer (ADR-003), never in the controller.
    /// </summary>
    public interface ICompanyService
    {
        // ----- companies -----

        Task<CompanyListResponse> GetCompaniesAsync(int? actorUserId, CompanyListQuery query, CancellationToken cancellationToken = default);

        Task<CompanyDetailResponse> GetCompanyAsync(int? actorUserId, int companyId, CancellationToken cancellationToken = default);

        /// <summary>Provisions company + primary branch + subscription + HR grants in one transaction.</summary>
        Task<CreateCompanyResponse> CreateCompanyAsync(int? actorUserId, CreateCompanyRequest request, CancellationToken cancellationToken = default);

        Task<CompanyDetailResponse> UpdateCompanyAsync(int? actorUserId, int companyId, UpdateCompanyRequest request, CancellationToken cancellationToken = default);

        /// <summary>Suspends, restores or closes a company. Closing is terminal.</summary>
        Task<CompanyStatusChangeResponse> ChangeStatusAsync(int? actorUserId, int companyId, UpdateCompanyStatusRequest request, CancellationToken cancellationToken = default);

        // ----- company tabs -----

        Task<CompanyOverviewResponse> GetOverviewAsync(int? actorUserId, int companyId, CancellationToken cancellationToken = default);

        Task<CompanyEmployeesResponse> GetEmployeesAsync(int? actorUserId, int companyId, CompanyEmployeeQuery query, CancellationToken cancellationToken = default);

        Task<CompanyBillingResponse> GetBillingAsync(int? actorUserId, int companyId, CancellationToken cancellationToken = default);

        Task<PlatformAuditListResponse> GetAuditAsync(int? actorUserId, int companyId, PlatformAuditQuery query, CancellationToken cancellationToken = default);

        // ----- branches -----

        Task<BranchListResponse> GetBranchesAsync(int? actorUserId, int companyId, CancellationToken cancellationToken = default);

        Task<BranchListItem> CreateBranchAsync(int? actorUserId, int companyId, BranchUpsertRequest request, CancellationToken cancellationToken = default);

        Task<BranchListItem> UpdateBranchAsync(int? actorUserId, int companyId, int branchId, BranchUpsertRequest request, CancellationToken cancellationToken = default);

        /// <summary>Archives the branch (soft). Refused while it still has active staff.</summary>
        Task ArchiveBranchAsync(int? actorUserId, int companyId, int branchId, CancellationToken cancellationToken = default);

        // ----- HR staff assignment -----

        Task<HrStaffListResponse> GetHrStaffAsync(int? actorUserId, int companyId, CancellationToken cancellationToken = default);

        Task<AssignHrStaffResponse> AssignHrStaffAsync(int? actorUserId, int companyId, AssignHrStaffRequest request, CancellationToken cancellationToken = default);

        Task<RevokeHrStaffResponse> RevokeHrStaffAsync(int? actorUserId, int companyId, int userId, CancellationToken cancellationToken = default);
    }

    /// <summary>
    /// The platform-wide user directory: HR Manager and HR/employee accounts, their
    /// status, password resets, session revocation and branch assignments.
    /// </summary>
    public interface IPlatformUserService
    {
        Task<PlatformUsersResponse> GetUsersAsync(int? actorUserId, PlatformUserListQuery query, CancellationToken cancellationToken = default);

        Task<PlatformUserDetailResponse> GetUserAsync(int? actorUserId, int userId, CancellationToken cancellationToken = default);

        /// <summary>Creates a platform-wide HR Manager account (Super Admin only).</summary>
        Task<CreateHrManagerResponse> CreateHrManagerAsync(int? actorUserId, CreateHrManagerRequest request, CancellationToken cancellationToken = default);

        /// <summary>Creates an HR or employee account. HR Manager cannot mint another HR Manager.</summary>
        Task<PlatformUserDetailResponse> CreateUserAsync(int? actorUserId, CreatePlatformUserRequest request, CancellationToken cancellationToken = default);

        Task<ChangePlatformUserStatusResponse> ChangeStatusAsync(int? actorUserId, int userId, ChangePlatformUserStatusRequest request, CancellationToken cancellationToken = default);

        Task<ResetPlatformUserPasswordResponse> ResetPasswordAsync(int? actorUserId, int userId, ResetPlatformUserPasswordRequest request, CancellationToken cancellationToken = default);

        Task<RevokeSessionsResponse> RevokeSessionsAsync(int? actorUserId, int userId, RevokeSessionsRequest request, CancellationToken cancellationToken = default);

        /// <summary>Replaces an HR user's branch assignments wholesale (HR users only).</summary>
        Task<ReplaceGymAccessResponse> ReplaceGymAccessAsync(int? actorUserId, int userId, ReplaceGymAccessRequest request, CancellationToken cancellationToken = default);
    }

    /// <summary>Dashboard KPIs, the derived attention queue, user growth and global search.</summary>
    public interface IPlatformDashboardService
    {
        Task<PlatformDashboardResponse> GetDashboardAsync(int? actorUserId, CancellationToken cancellationToken = default);

        Task<PlatformAlertListResponse> GetAlertsAsync(int? actorUserId, PlatformAlertQuery query, CancellationToken cancellationToken = default);

        Task<UserGrowthResponse> GetUserGrowthAsync(int? actorUserId, int months, CancellationToken cancellationToken = default);

        Task<PlatformSearchResponse> SearchAsync(int? actorUserId, string query, int limit, CancellationToken cancellationToken = default);
    }
}
