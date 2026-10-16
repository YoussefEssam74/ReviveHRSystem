using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class Add_FeatureLevelAuthorization : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Level",
                table: "UserPermissions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Level",
                table: "RolePermissions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "UserGymPermissions",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    GymId = table.Column<int>(type: "integer", nullable: false),
                    PermissionId = table.Column<int>(type: "integer", nullable: false),
                    Level = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    AssignedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserGymPermissions", x => new { x.UserId, x.GymId, x.PermissionId });
                    table.ForeignKey(
                        name: "FK_UserGymPermissions_Gyms_GymId",
                        column: x => x.GymId,
                        principalTable: "Gyms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserGymPermissions_Permissions_PermissionId",
                        column: x => x.PermissionId,
                        principalTable: "Permissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserGymPermissions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserGymRoles",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    GymId = table.Column<int>(type: "integer", nullable: false),
                    RoleId = table.Column<int>(type: "integer", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserGymRoles", x => new { x.UserId, x.GymId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_UserGymRoles_Gyms_GymId",
                        column: x => x.GymId,
                        principalTable: "Gyms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserGymRoles_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserGymRoles_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserGymPermissions_GymId",
                table: "UserGymPermissions",
                column: "GymId");

            migrationBuilder.CreateIndex(
                name: "IX_UserGymPermissions_PermissionId",
                table: "UserGymPermissions",
                column: "PermissionId");

            migrationBuilder.CreateIndex(
                name: "IX_UserGymPermissions_UserId_GymId",
                table: "UserGymPermissions",
                columns: new[] { "UserId", "GymId" });

            migrationBuilder.CreateIndex(
                name: "IX_UserGymRoles_GymId",
                table: "UserGymRoles",
                column: "GymId");

            migrationBuilder.CreateIndex(
                name: "IX_UserGymRoles_RoleId",
                table: "UserGymRoles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_UserGymRoles_UserId_GymId",
                table: "UserGymRoles",
                columns: new[] { "UserId", "GymId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserGymPermissions");

            migrationBuilder.DropTable(
                name: "UserGymRoles");

            migrationBuilder.DropColumn(
                name: "Level",
                table: "UserPermissions");

            migrationBuilder.DropColumn(
                name: "Level",
                table: "RolePermissions");
        }
    }
}
