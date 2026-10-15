using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class Add_EmployeeRequestRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ExcusedLateHoursCapPerMonth",
                table: "Gyms",
                type: "numeric(4,2)",
                precision: 4,
                scale: 2,
                nullable: false,
                defaultValue: 4m);

            migrationBuilder.AddColumn<decimal>(
                name: "RequestedAmount",
                table: "EmployeeRequests",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RequestedHours",
                table: "EmployeeRequests",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExcusedLateHoursCapPerMonth",
                table: "Gyms");

            migrationBuilder.DropColumn(
                name: "RequestedAmount",
                table: "EmployeeRequests");

            migrationBuilder.DropColumn(
                name: "RequestedHours",
                table: "EmployeeRequests");
        }
    }
}
