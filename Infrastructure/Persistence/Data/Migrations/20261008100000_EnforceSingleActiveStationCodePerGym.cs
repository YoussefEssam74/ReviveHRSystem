using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    public partial class EnforceSingleActiveStationCodePerGym : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Repair any existing duplicate active codes before enforcing the invariant.
            migrationBuilder.Sql("""
                UPDATE "StationCodes" AS current
                SET "IsActive" = FALSE
                WHERE current."IsActive" = TRUE
                  AND current."Id" NOT IN (
                      SELECT DISTINCT ON ("GymId") "Id"
                      FROM "StationCodes"
                      WHERE "IsActive" = TRUE
                      ORDER BY "GymId", "GeneratedAt" DESC, "Id" DESC
                  );
                """);

            migrationBuilder.DropIndex(
                name: "IX_StationCodes_GymId_IsActive",
                table: "StationCodes");

            migrationBuilder.CreateIndex(
                name: "IX_StationCodes_GymId_Active",
                table: "StationCodes",
                column: "GymId",
                unique: true,
                filter: "\"IsActive\" = TRUE");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_StationCodes_GymId_Active",
                table: "StationCodes");

            migrationBuilder.CreateIndex(
                name: "IX_StationCodes_GymId_IsActive",
                table: "StationCodes",
                columns: new[] { "GymId", "IsActive" });
        }
    }
}
