using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddHiringFormsEvaluationsPayrollEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "PaidDate",
                table: "PayrollPeriods",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DaysWorked",
                table: "PayrollEntries",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "OvertimeHours",
                table: "PayrollEntries",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReviewedAt",
                table: "PayrollEntries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "PayrollEntries",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SeparationType",
                table: "OffboardingCases",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "Resignation");

            migrationBuilder.AddColumn<DateTime>(
                name: "DueDate",
                table: "Events",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Urgency",
                table: "Events",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "EvaluationResponses",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Period",
                table: "EvaluationResponses",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Score",
                table: "EvaluationResponses",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "EvaluationResponses",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedDate",
                table: "EvaluationForms",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "LastUsedAt",
                table: "EvaluationForms",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "EvaluationForms",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Target",
                table: "EvaluationForms",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ActionRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    GymId = table.Column<int>(type: "integer", nullable: false),
                    EmployeeId = table.Column<int>(type: "integer", nullable: true),
                    ActionType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ProposedDetailsJson = table.Column<string>(type: "jsonb", nullable: false),
                    Justification = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    RequestedById = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    SubmittedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    ReviewedById = table.Column<int>(type: "integer", nullable: true),
                    ReviewedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewComment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActionRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ActionRequests_Employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ActionRequests_Gyms_GymId",
                        column: x => x.GymId,
                        principalTable: "Gyms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ActionRequests_Users_RequestedById",
                        column: x => x.RequestedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ActionRequests_Users_ReviewedById",
                        column: x => x.ReviewedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Goals",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmployeeId = table.Column<int>(type: "integer", nullable: true),
                    EmployeeName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Progress = table.Column<int>(type: "integer", nullable: false),
                    DueDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Owner = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Goals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Goals_Employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "HiringForms",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    GymId = table.Column<int>(type: "integer", nullable: true),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Position = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    QuestionsJson = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    LastUsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HiringForms", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HiringForms_Gyms_GymId",
                        column: x => x.GymId,
                        principalTable: "Gyms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_HiringForms_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "PerformanceCycles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformanceCycles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HiringFormApplications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    HiringFormId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Phone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Gym = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    AnswersJson = table.Column<string>(type: "jsonb", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    AppliedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    RejectComment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CandidateId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    CreatedBy = table.Column<int>(type: "integer", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HiringFormApplications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HiringFormApplications_Candidates_CandidateId",
                        column: x => x.CandidateId,
                        principalTable: "Candidates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_HiringFormApplications_HiringForms_HiringFormId",
                        column: x => x.HiringFormId,
                        principalTable: "HiringForms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ActionRequests_EmployeeId",
                table: "ActionRequests",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_ActionRequests_GymId",
                table: "ActionRequests",
                column: "GymId");

            migrationBuilder.CreateIndex(
                name: "IX_ActionRequests_RequestedById",
                table: "ActionRequests",
                column: "RequestedById");

            migrationBuilder.CreateIndex(
                name: "IX_ActionRequests_ReviewedById",
                table: "ActionRequests",
                column: "ReviewedById");

            migrationBuilder.CreateIndex(
                name: "IX_ActionRequests_Status_ActionType",
                table: "ActionRequests",
                columns: new[] { "Status", "ActionType" });

            migrationBuilder.CreateIndex(
                name: "IX_Goals_EmployeeId",
                table: "Goals",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_HiringFormApplications_CandidateId",
                table: "HiringFormApplications",
                column: "CandidateId");

            migrationBuilder.CreateIndex(
                name: "IX_HiringFormApplications_Email",
                table: "HiringFormApplications",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_HiringFormApplications_HiringFormId_Status",
                table: "HiringFormApplications",
                columns: new[] { "HiringFormId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_HiringForms_CreatedBy",
                table: "HiringForms",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_HiringForms_GymId",
                table: "HiringForms",
                column: "GymId");

            migrationBuilder.CreateIndex(
                name: "IX_HiringForms_Status",
                table: "HiringForms",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ActionRequests");

            migrationBuilder.DropTable(
                name: "Goals");

            migrationBuilder.DropTable(
                name: "HiringFormApplications");

            migrationBuilder.DropTable(
                name: "PerformanceCycles");

            migrationBuilder.DropTable(
                name: "HiringForms");

            migrationBuilder.DropColumn(
                name: "PaidDate",
                table: "PayrollPeriods");

            migrationBuilder.DropColumn(
                name: "DaysWorked",
                table: "PayrollEntries");

            migrationBuilder.DropColumn(
                name: "OvertimeHours",
                table: "PayrollEntries");

            migrationBuilder.DropColumn(
                name: "ReviewedAt",
                table: "PayrollEntries");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "PayrollEntries");

            migrationBuilder.DropColumn(
                name: "SeparationType",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "DueDate",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "Urgency",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "EvaluationResponses");

            migrationBuilder.DropColumn(
                name: "Period",
                table: "EvaluationResponses");

            migrationBuilder.DropColumn(
                name: "Score",
                table: "EvaluationResponses");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "EvaluationResponses");

            migrationBuilder.DropColumn(
                name: "CreatedDate",
                table: "EvaluationForms");

            migrationBuilder.DropColumn(
                name: "LastUsedAt",
                table: "EvaluationForms");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "EvaluationForms");

            migrationBuilder.DropColumn(
                name: "Target",
                table: "EvaluationForms");
        }
    }
}
