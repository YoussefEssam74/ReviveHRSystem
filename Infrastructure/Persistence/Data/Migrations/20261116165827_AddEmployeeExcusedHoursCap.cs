using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeExcusedHoursCap : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Environments that already carried the column (added ahead of this
            // migration) must not fail here — the add is idempotent.
            migrationBuilder.Sql(
                "ALTER TABLE \"Employees\" ADD COLUMN IF NOT EXISTS \"ExcusedHoursCapPerMonth\" numeric(4,2);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "ALTER TABLE \"Employees\" DROP COLUMN IF EXISTS \"ExcusedHoursCapPerMonth\";");
        }
    }
}
