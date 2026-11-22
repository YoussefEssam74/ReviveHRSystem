using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTerminationWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AccessRevoked",
                table: "OffboardingCases",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ApprovalNote",
                table: "OffboardingCases",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovalStatus",
                table: "OffboardingCases",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "Approved");

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                table: "OffboardingCases",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ApprovedBy",
                table: "OffboardingCases",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AssetsReturned",
                table: "OffboardingCases",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "BlacklistReason",
                table: "OffboardingCases",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Blacklisted",
                table: "OffboardingCases",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ClearanceCompleted",
                table: "OffboardingCases",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "ClearanceCompletedAt",
                table: "OffboardingCases",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClearanceNotes",
                table: "OffboardingCases",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CompensationRating",
                table: "OffboardingCases",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ExitInterviewCompletedAt",
                table: "OffboardingCases",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ExitInterviewScheduledAt",
                table: "OffboardingCases",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExitInterviewStatus",
                table: "OffboardingCases",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "FinalSettlementCompleted",
                table: "OffboardingCases",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateOnly>(
                name: "InterviewDate",
                table: "OffboardingCases",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InterviewNotes",
                table: "OffboardingCases",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Interviewer",
                table: "OffboardingCases",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "JobSatisfaction",
                table: "OffboardingCases",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ManagementRating",
                table: "OffboardingCases",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReasonForLeaving",
                table: "OffboardingCases",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "UniformReturned",
                table: "OffboardingCases",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "WhatLikedMost",
                table: "OffboardingCases",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WhatToImprove",
                table: "OffboardingCases",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "WorkEnvironmentRating",
                table: "OffboardingCases",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "WouldRecommend",
                table: "OffboardingCases",
                type: "boolean",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_OffboardingCases_ApprovalStatus",
                table: "OffboardingCases",
                column: "ApprovalStatus");

            migrationBuilder.CreateIndex(
                name: "IX_OffboardingCases_ApprovedBy",
                table: "OffboardingCases",
                column: "ApprovedBy");

            migrationBuilder.AddForeignKey(
                name: "FK_OffboardingCases_Users_ApprovedBy",
                table: "OffboardingCases",
                column: "ApprovedBy",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OffboardingCases_Users_ApprovedBy",
                table: "OffboardingCases");

            migrationBuilder.DropIndex(
                name: "IX_OffboardingCases_ApprovalStatus",
                table: "OffboardingCases");

            migrationBuilder.DropIndex(
                name: "IX_OffboardingCases_ApprovedBy",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "AccessRevoked",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "ApprovalNote",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "ApprovalStatus",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "ApprovedBy",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "AssetsReturned",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "BlacklistReason",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "Blacklisted",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "ClearanceCompleted",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "ClearanceCompletedAt",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "ClearanceNotes",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "CompensationRating",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "ExitInterviewCompletedAt",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "ExitInterviewScheduledAt",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "ExitInterviewStatus",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "FinalSettlementCompleted",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "InterviewDate",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "InterviewNotes",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "Interviewer",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "JobSatisfaction",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "ManagementRating",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "ReasonForLeaving",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "UniformReturned",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "WhatLikedMost",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "WhatToImprove",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "WorkEnvironmentRating",
                table: "OffboardingCases");

            migrationBuilder.DropColumn(
                name: "WouldRecommend",
                table: "OffboardingCases");

        }
    }
}
