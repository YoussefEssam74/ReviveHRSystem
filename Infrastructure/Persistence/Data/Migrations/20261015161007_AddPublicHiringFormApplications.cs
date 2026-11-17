using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPublicHiringFormApplications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CareersJson",
                table: "HiringFormApplications",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Position",
                table: "HiringFormApplications",
                type: "text",
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "VacancyId",
                table: "Applications",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<string>(
                name: "PositionTitle",
                table: "Applications",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CareersJson",
                table: "HiringFormApplications");

            migrationBuilder.DropColumn(
                name: "Position",
                table: "HiringFormApplications");

            migrationBuilder.DropColumn(
                name: "PositionTitle",
                table: "Applications");

            migrationBuilder.AlterColumn<int>(
                name: "VacancyId",
                table: "Applications",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
