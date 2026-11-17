using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Presistence.Data;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <summary>
    /// HR reconciliation of a settlement sheet: the four attendance counters that are
    /// derived from attendance records can be corrected per payroll entry (null = derive),
    /// and the correction is stamped with when/who applied it.
    /// </summary>
    [DbContext(typeof(ReviveHrDbContext))]
    [Migration("20261112015000_AddPayrollAttendanceOverrides")]
    public partial class AddPayrollAttendanceOverrides : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ApprovedLeavesOverride",
                table: "PayrollEntries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AttendanceAdjustedAt",
                table: "PayrollEntries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AttendanceAdjustedBy",
                table: "PayrollEntries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LateArrivalsOverride",
                table: "PayrollEntries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UnexcusedAbsencesOverride",
                table: "PayrollEntries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "WeeklyOffsOverride",
                table: "PayrollEntries",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "ApprovedLeavesOverride", table: "PayrollEntries");
            migrationBuilder.DropColumn(name: "AttendanceAdjustedAt", table: "PayrollEntries");
            migrationBuilder.DropColumn(name: "AttendanceAdjustedBy", table: "PayrollEntries");
            migrationBuilder.DropColumn(name: "LateArrivalsOverride", table: "PayrollEntries");
            migrationBuilder.DropColumn(name: "UnexcusedAbsencesOverride", table: "PayrollEntries");
            migrationBuilder.DropColumn(name: "WeeklyOffsOverride", table: "PayrollEntries");
        }
    }
}
