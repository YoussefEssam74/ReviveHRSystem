using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class Add_StationSessionCredential : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ExpiresAtUtc",
                table: "StationCodes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "StationSessionId",
                table: "AttendanceRecords",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "StationSessions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    GymId = table.Column<int>(type: "integer", nullable: false),
                    StationCodeId = table.Column<int>(type: "integer", nullable: true),
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RevokedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StationSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StationSessions_Gyms_GymId",
                        column: x => x.GymId,
                        principalTable: "Gyms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StationSessions_StationCodes_StationCodeId",
                        column: x => x.StationCodeId,
                        principalTable: "StationCodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceRecords_StationSessionId",
                table: "AttendanceRecords",
                column: "StationSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_StationSessions_GymId",
                table: "StationSessions",
                column: "GymId");

            migrationBuilder.CreateIndex(
                name: "IX_StationSessions_StationCodeId",
                table: "StationSessions",
                column: "StationCodeId");

            migrationBuilder.CreateIndex(
                name: "IX_StationSessions_TokenHash",
                table: "StationSessions",
                column: "TokenHash",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_AttendanceRecords_StationSessions_StationSessionId",
                table: "AttendanceRecords",
                column: "StationSessionId",
                principalTable: "StationSessions",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AttendanceRecords_StationSessions_StationSessionId",
                table: "AttendanceRecords");

            migrationBuilder.DropTable(
                name: "StationSessions");

            migrationBuilder.DropIndex(
                name: "IX_AttendanceRecords_StationSessionId",
                table: "AttendanceRecords");

            migrationBuilder.DropColumn(
                name: "ExpiresAtUtc",
                table: "StationCodes");

            migrationBuilder.DropColumn(
                name: "StationSessionId",
                table: "AttendanceRecords");
        }
    }
}
