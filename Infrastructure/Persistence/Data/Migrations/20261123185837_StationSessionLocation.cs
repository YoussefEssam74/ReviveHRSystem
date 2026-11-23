using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class StationSessionLocation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "Latitude",
                table: "StationSessions",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "LocationAccuracyMeters",
                table: "StationSessions",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Longitude",
                table: "StationSessions",
                type: "double precision",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "StationSessions");

            migrationBuilder.DropColumn(
                name: "LocationAccuracyMeters",
                table: "StationSessions");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "StationSessions");
        }
    }
}
