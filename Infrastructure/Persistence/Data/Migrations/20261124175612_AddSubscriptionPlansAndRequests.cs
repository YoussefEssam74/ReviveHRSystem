using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGymSubscriptionPlansAndRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PlanId",
                table: "GymSubscriptions",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "GymSubscriptionPlans",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    PricePerCycle = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    BillingCycleMonths = table.Column<int>(type: "integer", nullable: false),
                    GracePeriodDays = table.Column<int>(type: "integer", nullable: true),
                    ReminderLeadDays = table.Column<int>(type: "integer", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GymSubscriptionPlans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SubscriptionChangeRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    GymId = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CurrentPlanId = table.Column<int>(type: "integer", nullable: true),
                    RequestedPlanId = table.Column<int>(type: "integer", nullable: true),
                    RequestedByUserId = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RequestedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReviewedByUserId = table.Column<int>(type: "integer", nullable: true),
                    ReviewedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewNote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubscriptionChangeRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SubscriptionChangeRequests_Gyms_GymId",
                        column: x => x.GymId,
                        principalTable: "Gyms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SubscriptionChangeRequests_GymSubscriptionPlans_CurrentPlanId",
                        column: x => x.CurrentPlanId,
                        principalTable: "GymSubscriptionPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SubscriptionChangeRequests_GymSubscriptionPlans_RequestedPlanId",
                        column: x => x.RequestedPlanId,
                        principalTable: "GymSubscriptionPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SubscriptionChangeRequests_Users_RequestedByUserId",
                        column: x => x.RequestedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GymSubscriptions_PlanId",
                table: "GymSubscriptions",
                column: "PlanId");

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionChangeRequests_CurrentPlanId",
                table: "SubscriptionChangeRequests",
                column: "CurrentPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionChangeRequests_GymId_Status",
                table: "SubscriptionChangeRequests",
                columns: new[] { "GymId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionChangeRequests_RequestedByUserId",
                table: "SubscriptionChangeRequests",
                column: "RequestedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionChangeRequests_RequestedPlanId",
                table: "SubscriptionChangeRequests",
                column: "RequestedPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionChangeRequests_Status",
                table: "SubscriptionChangeRequests",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_GymSubscriptionPlans_IsActive_SortOrder",
                table: "GymSubscriptionPlans",
                columns: new[] { "IsActive", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_GymSubscriptionPlans_Name",
                table: "GymSubscriptionPlans",
                column: "Name",
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.AddForeignKey(
                name: "FK_GymSubscriptions_GymSubscriptionPlans_PlanId",
                table: "GymSubscriptions",
                column: "PlanId",
                principalTable: "GymSubscriptionPlans",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GymSubscriptions_GymSubscriptionPlans_PlanId",
                table: "GymSubscriptions");

            migrationBuilder.DropTable(
                name: "SubscriptionChangeRequests");

            migrationBuilder.DropTable(
                name: "GymSubscriptionPlans");

            migrationBuilder.DropIndex(
                name: "IX_GymSubscriptions_PlanId",
                table: "GymSubscriptions");

            migrationBuilder.DropColumn(
                name: "PlanId",
                table: "GymSubscriptions");
        }
    }
}
