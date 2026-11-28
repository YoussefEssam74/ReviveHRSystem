using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddEvaluationFormKindAndAttachment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AttachmentName",
                table: "HiringForms",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AttachmentPath",
                table: "HiringForms",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AttachmentName",
                table: "EvaluationForms",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AttachmentPath",
                table: "EvaluationForms",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "EvaluationForms",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AttachmentName",
                table: "HiringForms");

            migrationBuilder.DropColumn(
                name: "AttachmentPath",
                table: "HiringForms");

            migrationBuilder.DropColumn(
                name: "AttachmentName",
                table: "EvaluationForms");

            migrationBuilder.DropColumn(
                name: "AttachmentPath",
                table: "EvaluationForms");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "EvaluationForms");
        }
    }
}
