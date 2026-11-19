using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class UniqueIndexesIgnoreSoftDeleted : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Vacancies_PublicLinkToken",
                table: "Vacancies");

            migrationBuilder.DropIndex(
                name: "IX_Users_Email",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_UserName",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_StationSessions_TokenHash",
                table: "StationSessions");

            migrationBuilder.DropIndex(
                name: "IX_StationCodes_Code",
                table: "StationCodes");

            migrationBuilder.DropIndex(
                name: "IX_Roles_Name",
                table: "Roles");

            migrationBuilder.DropIndex(
                name: "IX_RefreshTokens_TokenHash",
                table: "RefreshTokens");

            migrationBuilder.DropIndex(
                name: "IX_Permissions_Key",
                table: "Permissions");

            migrationBuilder.DropIndex(
                name: "IX_PayrollEntries_PayrollPeriodId_EmployeeId",
                table: "PayrollEntries");

            migrationBuilder.DropIndex(
                name: "IX_OnboardingChecklistItems_EmployeeId_SortOrder",
                table: "OnboardingChecklistItems");

            migrationBuilder.DropIndex(
                name: "IX_OffboardingChecklistItems_OffboardingCaseId_SortOrder",
                table: "OffboardingChecklistItems");

            migrationBuilder.DropIndex(
                name: "IX_LeaveBalances_EmployeeId_LeaveType_Year",
                table: "LeaveBalances");

            migrationBuilder.DropIndex(
                name: "IX_FaceEmbeddings_EmployeeId",
                table: "FaceEmbeddings");

            migrationBuilder.DropIndex(
                name: "IX_Events_Type_EntityType_EntityId",
                table: "Events");

            migrationBuilder.DropIndex(
                name: "IX_Employees_EmployeeNumber",
                table: "Employees");

            migrationBuilder.DropIndex(
                name: "IX_Employees_UserId",
                table: "Employees");

            migrationBuilder.DropIndex(
                name: "IX_BiometricDevices_DeviceToken",
                table: "BiometricDevices");

            migrationBuilder.DropIndex(
                name: "IX_AttendanceRecords_EmployeeId_Date",
                table: "AttendanceRecords");

            migrationBuilder.CreateIndex(
                name: "IX_Vacancies_PublicLinkToken",
                table: "Vacancies",
                column: "PublicLinkToken",
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_Users_UserName",
                table: "Users",
                column: "UserName",
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_StationSessions_TokenHash",
                table: "StationSessions",
                column: "TokenHash",
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_StationCodes_Code",
                table: "StationCodes",
                column: "Code",
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_Roles_Name",
                table: "Roles",
                column: "Name",
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_TokenHash",
                table: "RefreshTokens",
                column: "TokenHash",
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_Permissions_Key",
                table: "Permissions",
                column: "Key",
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollEntries_PayrollPeriodId_EmployeeId",
                table: "PayrollEntries",
                columns: new[] { "PayrollPeriodId", "EmployeeId" },
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_OnboardingChecklistItems_EmployeeId_SortOrder",
                table: "OnboardingChecklistItems",
                columns: new[] { "EmployeeId", "SortOrder" },
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_OffboardingChecklistItems_OffboardingCaseId_SortOrder",
                table: "OffboardingChecklistItems",
                columns: new[] { "OffboardingCaseId", "SortOrder" },
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_LeaveBalances_EmployeeId_LeaveType_Year",
                table: "LeaveBalances",
                columns: new[] { "EmployeeId", "LeaveType", "Year" },
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_FaceEmbeddings_EmployeeId",
                table: "FaceEmbeddings",
                column: "EmployeeId",
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_Events_Type_EntityType_EntityId",
                table: "Events",
                columns: new[] { "Type", "EntityType", "EntityId" },
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_Employees_EmployeeNumber",
                table: "Employees",
                column: "EmployeeNumber",
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_Employees_UserId",
                table: "Employees",
                column: "UserId",
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_BiometricDevices_DeviceToken",
                table: "BiometricDevices",
                column: "DeviceToken",
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceRecords_EmployeeId_Date",
                table: "AttendanceRecords",
                columns: new[] { "EmployeeId", "Date" },
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            // Backfill the authoritative per-gym role table for legacy accounts: a user
            // with no per-gym role at all inherits his global roles in every gym he can
            // access. Accounts that already hold a per-gym role keep exactly that one.
            // Idempotent, and soft-deleted rows are ignored, never removed.
            migrationBuilder.Sql(
                """
                INSERT INTO "UserGymRoles" ("UserId", "GymId", "RoleId", "AssignedAt")
                SELECT DISTINCT ur."UserId", uga."GymId", ur."RoleId", NOW()
                FROM "UserRoles" ur
                JOIN "UserGymAccess" uga ON uga."UserId" = ur."UserId"
                JOIN "Users" u ON u."Id" = ur."UserId" AND u."IsDeleted" = FALSE
                JOIN "Roles" r ON r."Id" = ur."RoleId" AND r."IsDeleted" = FALSE
                JOIN "Gyms" g ON g."Id" = uga."GymId" AND g."IsDeleted" = FALSE
                -- Legacy accounts only: a user who already holds a per-gym role keeps
                -- exactly that assignment. Copying the global union into every gym would
                -- flatten per-gym roles (Branch Manager in gym 1 + Team Leader in gym 2).
                WHERE NOT EXISTS (
                    SELECT 1 FROM "UserGymRoles" existing
                    WHERE existing."UserId" = ur."UserId"
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The UserGymRoles backfill is intentionally not reverted: those rows are
            // valid assignments, and deleting them on rollback would strip access.
            migrationBuilder.DropIndex(
                name: "IX_Vacancies_PublicLinkToken",
                table: "Vacancies");

            migrationBuilder.DropIndex(
                name: "IX_Users_Email",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_UserName",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_StationSessions_TokenHash",
                table: "StationSessions");

            migrationBuilder.DropIndex(
                name: "IX_StationCodes_Code",
                table: "StationCodes");

            migrationBuilder.DropIndex(
                name: "IX_Roles_Name",
                table: "Roles");

            migrationBuilder.DropIndex(
                name: "IX_RefreshTokens_TokenHash",
                table: "RefreshTokens");

            migrationBuilder.DropIndex(
                name: "IX_Permissions_Key",
                table: "Permissions");

            migrationBuilder.DropIndex(
                name: "IX_PayrollEntries_PayrollPeriodId_EmployeeId",
                table: "PayrollEntries");

            migrationBuilder.DropIndex(
                name: "IX_OnboardingChecklistItems_EmployeeId_SortOrder",
                table: "OnboardingChecklistItems");

            migrationBuilder.DropIndex(
                name: "IX_OffboardingChecklistItems_OffboardingCaseId_SortOrder",
                table: "OffboardingChecklistItems");

            migrationBuilder.DropIndex(
                name: "IX_LeaveBalances_EmployeeId_LeaveType_Year",
                table: "LeaveBalances");

            migrationBuilder.DropIndex(
                name: "IX_FaceEmbeddings_EmployeeId",
                table: "FaceEmbeddings");

            migrationBuilder.DropIndex(
                name: "IX_Events_Type_EntityType_EntityId",
                table: "Events");

            migrationBuilder.DropIndex(
                name: "IX_Employees_EmployeeNumber",
                table: "Employees");

            migrationBuilder.DropIndex(
                name: "IX_Employees_UserId",
                table: "Employees");

            migrationBuilder.DropIndex(
                name: "IX_BiometricDevices_DeviceToken",
                table: "BiometricDevices");

            migrationBuilder.DropIndex(
                name: "IX_AttendanceRecords_EmployeeId_Date",
                table: "AttendanceRecords");

            migrationBuilder.CreateIndex(
                name: "IX_Vacancies_PublicLinkToken",
                table: "Vacancies",
                column: "PublicLinkToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_UserName",
                table: "Users",
                column: "UserName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StationSessions_TokenHash",
                table: "StationSessions",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StationCodes_Code",
                table: "StationCodes",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Roles_Name",
                table: "Roles",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_TokenHash",
                table: "RefreshTokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Permissions_Key",
                table: "Permissions",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PayrollEntries_PayrollPeriodId_EmployeeId",
                table: "PayrollEntries",
                columns: new[] { "PayrollPeriodId", "EmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OnboardingChecklistItems_EmployeeId_SortOrder",
                table: "OnboardingChecklistItems",
                columns: new[] { "EmployeeId", "SortOrder" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OffboardingChecklistItems_OffboardingCaseId_SortOrder",
                table: "OffboardingChecklistItems",
                columns: new[] { "OffboardingCaseId", "SortOrder" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LeaveBalances_EmployeeId_LeaveType_Year",
                table: "LeaveBalances",
                columns: new[] { "EmployeeId", "LeaveType", "Year" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FaceEmbeddings_EmployeeId",
                table: "FaceEmbeddings",
                column: "EmployeeId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Events_Type_EntityType_EntityId",
                table: "Events",
                columns: new[] { "Type", "EntityType", "EntityId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Employees_EmployeeNumber",
                table: "Employees",
                column: "EmployeeNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Employees_UserId",
                table: "Employees",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BiometricDevices_DeviceToken",
                table: "BiometricDevices",
                column: "DeviceToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceRecords_EmployeeId_Date",
                table: "AttendanceRecords",
                columns: new[] { "EmployeeId", "Date" },
                unique: true);
        }
    }
}
