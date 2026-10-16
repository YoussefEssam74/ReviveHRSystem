using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class Fix_TeamLeader_Composite_Fk : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TeamLeaders_Employees_EmployeeId_TeamId",
                table: "TeamLeaders");

            migrationBuilder.DropIndex(
                name: "IX_TeamLeaders_EmployeeId_TeamId",
                table: "TeamLeaders");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_Employees_Id_TeamId",
                table: "Employees");

            migrationBuilder.AlterColumn<int>(
                name: "TeamId",
                table: "Employees",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddForeignKey(
                name: "FK_TeamLeaders_Employees_EmployeeId",
                table: "TeamLeaders",
                column: "EmployeeId",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TeamLeaders_Employees_EmployeeId",
                table: "TeamLeaders");

            migrationBuilder.AlterColumn<int>(
                name: "TeamId",
                table: "Employees",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AddUniqueConstraint(
                name: "AK_Employees_Id_TeamId",
                table: "Employees",
                columns: new[] { "Id", "TeamId" });

            migrationBuilder.CreateIndex(
                name: "IX_TeamLeaders_EmployeeId_TeamId",
                table: "TeamLeaders",
                columns: new[] { "EmployeeId", "TeamId" });

            migrationBuilder.AddForeignKey(
                name: "FK_TeamLeaders_Employees_EmployeeId_TeamId",
                table: "TeamLeaders",
                columns: new[] { "EmployeeId", "TeamId" },
                principalTable: "Employees",
                principalColumns: new[] { "Id", "TeamId" },
                onDelete: ReferentialAction.Cascade);
        }
    }
}
