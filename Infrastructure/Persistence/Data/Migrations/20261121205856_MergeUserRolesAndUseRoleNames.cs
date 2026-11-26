using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <summary>
    /// Collapses the two role-grant tables into one and keys it by role NAME.
    ///
    /// Before: <c>UserRoles</c> (UserId, RoleId) held the platform-wide grants and
    /// <c>UserGymRoles</c> (UserId, GymId, RoleId) held the per-gym ones. Two tables
    /// meant two permission-resolution paths that could disagree, and neither read
    /// well in a database browser.
    ///
    /// After: a single <c>UserRoles</c> row is (UserId, GymId?, RoleName), where
    /// <c>GymId IS NULL</c> means platform-wide. <c>RoleName</c> references
    /// <c>Roles.Name</c>, so the row says "user 4 is a Team Leader in gym 2" with no
    /// join and no integer to decode.
    ///
    /// Order matters: the per-gym rows are copied in BEFORE <c>UserGymRoles</c> is
    /// dropped, so no assignment is lost. <c>Id</c> is a new identity column because
    /// PostgreSQL cannot include a nullable column in a primary key.
    /// </summary>
    public partial class MergeUserRolesAndUseRoleNames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Roles.Name becomes the principal key for the assignment rows.
            //
            //    The historical IX_Roles_Name was a *filtered* unique index
            //    (WHERE IsDeleted = false), so twice-archived roles could share a name —
            //    and an FK principal key cannot be filtered. Rename the duplicates first,
            //    then replace the filtered index with one unfiltered constraint.
            migrationBuilder.Sql(
                """
                WITH ranked AS (
                    SELECT "Id", "Name",
                           ROW_NUMBER() OVER (PARTITION BY "Name" ORDER BY "IsDeleted", "Id") AS rn
                    FROM "Roles"
                )
                UPDATE "Roles" AS r
                SET "Name" = LEFT(ranked."Name", 80) || ' #' || r."Id"
                FROM ranked
                WHERE r."Id" = ranked."Id" AND ranked.rn > 1;
                """);

            migrationBuilder.DropIndex(
                name: "IX_Roles_Name",
                table: "Roles");

            migrationBuilder.AddUniqueConstraint(
                name: "AK_Roles_Name",
                table: "Roles",
                column: "Name");

            // 2. Reshape UserRoles: surrogate Id, nullable GymId, RoleName.
            migrationBuilder.DropForeignKey(
                name: "FK_UserRoles_Roles_RoleId",
                table: "UserRoles");

            migrationBuilder.DropPrimaryKey(
                name: "PK_UserRoles",
                table: "UserRoles");

            migrationBuilder.DropIndex(
                name: "IX_UserRoles_RoleId",
                table: "UserRoles");

            migrationBuilder.AddColumn<int>(
                name: "Id",
                table: "UserRoles",
                type: "integer",
                nullable: false)
                .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AddColumn<int>(
                name: "GymId",
                table: "UserRoles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AssignedAt",
                table: "UserRoles",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP");

            migrationBuilder.AddColumn<string>(
                name: "RoleName",
                table: "UserRoles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            // 3. Existing UserRoles rows are the platform-wide grants: resolve their name.
            migrationBuilder.Sql(
                """
                UPDATE "UserRoles" AS ur
                SET "RoleName" = r."Name"
                FROM "Roles" AS r
                WHERE r."Id" = ur."RoleId";
                """);

            // The copied rows have no integer role id, and the column is still NOT NULL
            // until it is dropped in step 6 — so relax it for the duration of the copy.
            migrationBuilder.AlterColumn<int>(
                name: "RoleId",
                table: "UserRoles",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            // 4. Copy every per-gym assignment across before the old table goes away.
            //    DISTINCT guards against a role having been granted twice for the same
            //    (user, gym) pair, which the old composite key allowed via different ids.
            migrationBuilder.Sql(
                """
                INSERT INTO "UserRoles" ("UserId", "GymId", "RoleName", "AssignedAt")
                SELECT DISTINCT ugr."UserId", ugr."GymId", r."Name", ugr."AssignedAt"
                FROM "UserGymRoles" AS ugr
                JOIN "Roles" AS r ON r."Id" = ugr."RoleId"
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM "UserRoles" AS existing
                    WHERE existing."UserId" = ugr."UserId"
                      AND existing."GymId" = ugr."GymId"
                      AND existing."RoleName" = r."Name");
                """);

            // 5. Every row must now name a role; "Roles" was the only source.
            migrationBuilder.AlterColumn<string>(
                name: "RoleName",
                table: "UserRoles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldNullable: true);

            // 6. The integer reference is retired.
            migrationBuilder.DropColumn(
                name: "RoleId",
                table: "UserRoles");

            migrationBuilder.AddPrimaryKey(
                name: "PK_UserRoles",
                table: "UserRoles",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_UserRoles_GymId",
                table: "UserRoles",
                column: "GymId");

            migrationBuilder.CreateIndex(
                name: "IX_UserRoles_RoleName",
                table: "UserRoles",
                column: "RoleName");

            // GymId is nullable and PostgreSQL treats NULLs as distinct, so one
            // unique index cannot cover both reaches.
            migrationBuilder.CreateIndex(
                name: "UX_UserRoles_PerGym",
                table: "UserRoles",
                columns: new[] { "UserId", "GymId", "RoleName" },
                unique: true,
                filter: "\"GymId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "UX_UserRoles_PlatformWide",
                table: "UserRoles",
                columns: new[] { "UserId", "RoleName" },
                unique: true,
                filter: "\"GymId\" IS NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_UserRoles_Gyms_GymId",
                table: "UserRoles",
                column: "GymId",
                principalTable: "Gyms",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            // ON UPDATE CASCADE is what makes the name a usable key: renaming a role
            // rewrites every assignment in the same statement, atomically. EF cannot
            // express it (and refuses to modify a key property on a tracked entity),
            // so the constraint is created here and the rename runs as SQL
            // (UserAccessRepository.RenameRoleAsync).
            migrationBuilder.Sql(
                """
                ALTER TABLE "UserRoles"
                ADD CONSTRAINT "FK_UserRoles_Roles_RoleName"
                FOREIGN KEY ("RoleName") REFERENCES "Roles" ("Name")
                ON UPDATE CASCADE ON DELETE CASCADE;
                """);

            // 7. Only now is the old table redundant.
            migrationBuilder.DropTable(
                name: "UserGymRoles");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Rebuilds the two-table shape. Per-gym rows are restored from the gym-scoped
            // half of UserRoles; platform-wide grants go back to (UserId, RoleId).
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

            migrationBuilder.Sql(
                """
                INSERT INTO "UserGymRoles" ("UserId", "GymId", "RoleId", "AssignedAt")
                SELECT ur."UserId", ur."GymId", r."Id", ur."AssignedAt"
                FROM "UserRoles" AS ur
                JOIN "Roles" AS r ON r."Name" = ur."RoleName"
                WHERE ur."GymId" IS NOT NULL;
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_UserRoles_Gyms_GymId",
                table: "UserRoles");

            migrationBuilder.Sql("ALTER TABLE \"UserRoles\" DROP CONSTRAINT \"FK_UserRoles_Roles_RoleName\";");

            migrationBuilder.Sql("DELETE FROM \"UserRoles\" WHERE \"GymId\" IS NOT NULL;");

            migrationBuilder.DropPrimaryKey(
                name: "PK_UserRoles",
                table: "UserRoles");

            migrationBuilder.DropIndex(
                name: "IX_UserRoles_GymId",
                table: "UserRoles");

            migrationBuilder.DropIndex(
                name: "IX_UserRoles_RoleName",
                table: "UserRoles");

            migrationBuilder.DropIndex(
                name: "UX_UserRoles_PerGym",
                table: "UserRoles");

            migrationBuilder.DropIndex(
                name: "UX_UserRoles_PlatformWide",
                table: "UserRoles");

            migrationBuilder.AddColumn<int>(
                name: "RoleId",
                table: "UserRoles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(
                """
                UPDATE "UserRoles" AS ur
                SET "RoleId" = r."Id"
                FROM "Roles" AS r
                WHERE r."Name" = ur."RoleName";
                """);

            migrationBuilder.AlterColumn<int>(
                name: "RoleId",
                table: "UserRoles",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.DropColumn(
                name: "AssignedAt",
                table: "UserRoles");

            migrationBuilder.DropColumn(
                name: "GymId",
                table: "UserRoles");

            migrationBuilder.DropColumn(
                name: "RoleName",
                table: "UserRoles");

            migrationBuilder.DropColumn(
                name: "Id",
                table: "UserRoles");

            migrationBuilder.AddPrimaryKey(
                name: "PK_UserRoles",
                table: "UserRoles",
                columns: new[] { "UserId", "RoleId" });

            migrationBuilder.CreateIndex(
                name: "IX_UserRoles_RoleId",
                table: "UserRoles",
                column: "RoleId");

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

            migrationBuilder.AddForeignKey(
                name: "FK_UserRoles_Roles_RoleId",
                table: "UserRoles",
                column: "RoleId",
                principalTable: "Roles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.DropUniqueConstraint(
                name: "AK_Roles_Name",
                table: "Roles");

            migrationBuilder.CreateIndex(
                name: "IX_Roles_Name",
                table: "Roles",
                column: "Name",
                unique: true);
        }
    }
}
