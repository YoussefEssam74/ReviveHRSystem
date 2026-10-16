using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRecruitmentUiFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Headcount",
                table: "VacancyRequests",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "Salary",
                table: "VacancyRequests",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Shift",
                table: "VacancyRequests",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SubmittedDate",
                table: "VacancyRequests",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP");

            migrationBuilder.AddColumn<string>(
                name: "Urgency",
                table: "VacancyRequests",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedDate",
                table: "Vacancies",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP");

            migrationBuilder.AddColumn<int>(
                name: "RequestedBy",
                table: "Vacancies",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Salary",
                table: "Vacancies",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Shift",
                table: "Vacancies",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "Vacancies",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Urgency",
                table: "Vacancies",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ByUserId",
                table: "PipelineStages",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CompletedAt",
                table: "Interviews",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Evaluation",
                table: "Interviews",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InterviewerName",
                table: "Interviews",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Room",
                table: "Interviews",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Interviews",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Type",
                table: "Interviews",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Verdict",
                table: "Interviews",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BlockReason",
                table: "Candidates",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Blocked",
                table: "Candidates",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "Rating",
                table: "Candidates",
                type: "numeric(4,2)",
                precision: 4,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Availability",
                table: "Applications",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DecisionAt",
                table: "Applications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DecisionBy",
                table: "Applications",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DecisionNote",
                table: "Applications",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Education",
                table: "Applications",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ExperienceYears",
                table: "Applications",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "HiredBy",
                table: "Applications",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "HiredDate",
                table: "Applications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LanguagesJson",
                table: "Applications",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastActivityAt",
                table: "Applications",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "Applications",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreferredGym",
                table: "Applications",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectReason",
                table: "Applications",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RejectedAt",
                table: "Applications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RejectedBy",
                table: "Applications",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SalaryExpectation",
                table: "Applications",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShiftPreference",
                table: "Applications",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "Applications",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Vacancies_RequestedBy",
                table: "Vacancies",
                column: "RequestedBy");

            migrationBuilder.AddForeignKey(
                name: "FK_Vacancies_Users_RequestedBy",
                table: "Vacancies",
                column: "RequestedBy",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Vacancies_Users_RequestedBy",
                table: "Vacancies");

            migrationBuilder.DropIndex(
                name: "IX_Vacancies_RequestedBy",
                table: "Vacancies");

            migrationBuilder.DropColumn(
                name: "Headcount",
                table: "VacancyRequests");

            migrationBuilder.DropColumn(
                name: "Salary",
                table: "VacancyRequests");

            migrationBuilder.DropColumn(
                name: "Shift",
                table: "VacancyRequests");

            migrationBuilder.DropColumn(
                name: "SubmittedDate",
                table: "VacancyRequests");

            migrationBuilder.DropColumn(
                name: "Urgency",
                table: "VacancyRequests");

            migrationBuilder.DropColumn(
                name: "CreatedDate",
                table: "Vacancies");

            migrationBuilder.DropColumn(
                name: "RequestedBy",
                table: "Vacancies");

            migrationBuilder.DropColumn(
                name: "Salary",
                table: "Vacancies");

            migrationBuilder.DropColumn(
                name: "Shift",
                table: "Vacancies");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "Vacancies");

            migrationBuilder.DropColumn(
                name: "Urgency",
                table: "Vacancies");

            migrationBuilder.DropColumn(
                name: "ByUserId",
                table: "PipelineStages");

            migrationBuilder.DropColumn(
                name: "CompletedAt",
                table: "Interviews");

            migrationBuilder.DropColumn(
                name: "Evaluation",
                table: "Interviews");

            migrationBuilder.DropColumn(
                name: "InterviewerName",
                table: "Interviews");

            migrationBuilder.DropColumn(
                name: "Room",
                table: "Interviews");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Interviews");

            migrationBuilder.DropColumn(
                name: "Type",
                table: "Interviews");

            migrationBuilder.DropColumn(
                name: "Verdict",
                table: "Interviews");

            migrationBuilder.DropColumn(
                name: "BlockReason",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "Blocked",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "Rating",
                table: "Candidates");

            migrationBuilder.DropColumn(
                name: "Availability",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "DecisionAt",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "DecisionBy",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "DecisionNote",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "Education",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "ExperienceYears",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "HiredBy",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "HiredDate",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "LanguagesJson",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "LastActivityAt",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "PreferredGym",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "RejectReason",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "RejectedAt",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "RejectedBy",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "SalaryExpectation",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "ShiftPreference",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "Applications");
        }
    }
}
