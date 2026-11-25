using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class DeductionUnitAndValue : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "DeductionDays",
                table: "DeductionCandidates",
                type: "numeric(9,2)",
                precision: 9,
                scale: 2,
                nullable: false,
                defaultValue: 0m,
                oldClrType: typeof(decimal),
                oldType: "numeric(9,2)",
                oldPrecision: 9,
                oldScale: 2,
                oldDefaultValue: 1m);

            migrationBuilder.AddColumn<int>(
                name: "DeductionUnit",
                table: "DeductionCandidates",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "DeductionValue",
                table: "DeductionCandidates",
                type: "numeric(9,2)",
                precision: 9,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            // Existing rows were sized in days (a quarter, a half, one, three): carry that
            // size into the new unit/value pair so nothing loses its meaning.
            migrationBuilder.Sql(
                "UPDATE \"DeductionCandidates\" SET \"DeductionValue\" = \"DeductionDays\", \"DeductionUnit\" = 0;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeductionUnit",
                table: "DeductionCandidates");

            migrationBuilder.DropColumn(
                name: "DeductionValue",
                table: "DeductionCandidates");

            migrationBuilder.AlterColumn<decimal>(
                name: "DeductionDays",
                table: "DeductionCandidates",
                type: "numeric(9,2)",
                precision: 9,
                scale: 2,
                nullable: false,
                defaultValue: 1m,
                oldClrType: typeof(decimal),
                oldType: "numeric(9,2)",
                oldPrecision: 9,
                oldScale: 2,
                oldDefaultValue: 0m);
        }
    }
}
