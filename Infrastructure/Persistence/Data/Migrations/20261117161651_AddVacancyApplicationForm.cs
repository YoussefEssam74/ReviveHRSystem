using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddVacancyApplicationForm : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ApplicationFormId",
                table: "Vacancies",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Vacancies_ApplicationFormId",
                table: "Vacancies",
                column: "ApplicationFormId");

            migrationBuilder.AddForeignKey(
                name: "FK_Vacancies_HiringForms_ApplicationFormId",
                table: "Vacancies",
                column: "ApplicationFormId",
                principalTable: "HiringForms",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Vacancies_HiringForms_ApplicationFormId",
                table: "Vacancies");

            migrationBuilder.DropIndex(
                name: "IX_Vacancies_ApplicationFormId",
                table: "Vacancies");

            migrationBuilder.DropColumn(
                name: "ApplicationFormId",
                table: "Vacancies");
        }
    }
}
