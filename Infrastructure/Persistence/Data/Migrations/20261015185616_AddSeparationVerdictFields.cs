using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSeparationVerdictFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FinalReason",
                table: "OffboardingCases",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "OffboardingCases",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RehireNote",
                table: "OffboardingCases",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RehireStatus",
                table: "OffboardingCases",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SettlementAmount",
                table: "OffboardingCases",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SettlementDirection",
                table: "OffboardingCases",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SettlementNote",
                table: "OffboardingCases",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Events_Type_EntityType_EntityId",
                table: "Events",
                columns: new[] { "Type", "EntityType", "EntityId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Events_Type_EntityType_EntityId",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "FinalReason",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "RehireNote",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "RehireStatus",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "SettlementAmount",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "SettlementDirection",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "SettlementNote",
                table: "OffboardingCases");
        }
    }
}
