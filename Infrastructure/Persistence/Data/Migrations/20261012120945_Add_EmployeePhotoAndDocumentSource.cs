using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class Add_EmployeePhotoAndDocumentSource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PhotoPath",
                table: "Employees",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContentType",
                table: "EmployeeDocuments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "SizeBytes",
                table: "EmployeeDocuments",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Source",
                table: "EmployeeDocuments",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PhotoPath",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "ContentType",
                table: "EmployeeDocuments");

            migrationBuilder.DropColumn(
                name: "SizeBytes",
                table: "EmployeeDocuments");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "EmployeeDocuments");
        }
    }
}
