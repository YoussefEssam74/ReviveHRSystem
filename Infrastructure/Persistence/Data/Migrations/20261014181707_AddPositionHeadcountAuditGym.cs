using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPositionHeadcountAuditGym : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Headcount",
                table: "Positions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "GymId",
                table: "AuditLogs",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_GymId",
                table: "AuditLogs",
                column: "GymId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AuditLogs_GymId",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "Headcount",
                table: "Positions");

            migrationBuilder.DropColumn(
                name: "GymId",
                table: "AuditLogs");
        }
    }
}
