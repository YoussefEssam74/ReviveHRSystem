using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class ShiftAssignmentUniqueIndexIgnoresSoftDeleted : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Soft-deleted assignments (schedule deletions) must not occupy the
            // unique (EmployeeId, Date) slot — a deleted schedule's dates have to
            // be assignable again.
            migrationBuilder.DropIndex(
                name: "IX_ShiftAssignments_EmployeeId_Date",
                table: "ShiftAssignments");

            migrationBuilder.CreateIndex(
                name: "IX_ShiftAssignments_EmployeeId_Date",
                table: "ShiftAssignments",
                columns: new[] { "EmployeeId", "Date" },
                unique: true,
                filter: "\"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ShiftAssignments_EmployeeId_Date",
                table: "ShiftAssignments");

            migrationBuilder.CreateIndex(
                name: "IX_ShiftAssignments_EmployeeId_Date",
                table: "ShiftAssignments",
                columns: new[] { "EmployeeId", "Date" },
                unique: true);
        }
    }
}
