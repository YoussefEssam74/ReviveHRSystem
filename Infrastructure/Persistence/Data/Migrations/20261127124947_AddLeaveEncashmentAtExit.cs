using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddLeaveEncashmentAtExit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "LeaveEncashment",
                table: "PayrollEntries",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "LeaveEncashmentDays",
                table: "PayrollEntries",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "LeaveEarnedDaysThisYear",
                table: "OffboardingCases",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LeaveEncashmentAmount",
                table: "OffboardingCases",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LeaveEncashmentDailyRate",
                table: "OffboardingCases",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LeaveEncashmentDays",
                table: "OffboardingCases",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "UnpaidLeaveAmount",
                table: "OffboardingCases",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "UnpaidLeaveDays",
                table: "OffboardingCases",
                type: "numeric",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LeaveEncashment",
                table: "PayrollEntries");

            migrationBuilder.DropColumn(
                name: "LeaveEncashmentDays",
                table: "PayrollEntries");

            migrationBuilder.DropColumn(
                name: "LeaveEarnedDaysThisYear",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "LeaveEncashmentAmount",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "LeaveEncashmentDailyRate",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "LeaveEncashmentDays",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "UnpaidLeaveAmount",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "UnpaidLeaveDays",
                table: "OffboardingCases");
        }
    }
}
