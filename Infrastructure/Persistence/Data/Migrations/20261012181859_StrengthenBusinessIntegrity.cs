using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class StrengthenBusinessIntegrity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RequestDecisions_RequestId",
                table: "RequestDecisions");

            migrationBuilder.DropIndex(
                name: "IX_EvaluationAnswers_EvaluationResponseId",
                table: "EvaluationAnswers");

            migrationBuilder.CreateIndex(
                name: "IX_Teams_GymId_Name",
                table: "Teams",
                columns: new[] { "GymId", "Name" },
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_RequestDecisions_RequestId_Stage",
                table: "RequestDecisions",
                columns: new[] { "RequestId", "Stage" },
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_Positions_GymId_Title_Level",
                table: "Positions",
                columns: new[] { "GymId", "Title", "Level" },
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationAnswers_EvaluationResponseId_EvaluationQuestionId",
                table: "EvaluationAnswers",
                columns: new[] { "EvaluationResponseId", "EvaluationQuestionId" },
                unique: true,
                filter: "\"IsDeleted\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_Departments_GymId_Name",
                table: "Departments",
                columns: new[] { "GymId", "Name" },
                unique: true,
                filter: "\"IsDeleted\" = FALSE");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Teams_GymId_Name",
                table: "Teams");

            migrationBuilder.DropIndex(
                name: "IX_RequestDecisions_RequestId_Stage",
                table: "RequestDecisions");

            migrationBuilder.DropIndex(
                name: "IX_Positions_GymId_Title_Level",
                table: "Positions");

            migrationBuilder.DropIndex(
                name: "IX_EvaluationAnswers_EvaluationResponseId_EvaluationQuestionId",
                table: "EvaluationAnswers");

            migrationBuilder.DropIndex(
                name: "IX_Departments_GymId_Name",
                table: "Departments");

            migrationBuilder.CreateIndex(
                name: "IX_RequestDecisions_RequestId",
                table: "RequestDecisions",
                column: "RequestId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationAnswers_EvaluationResponseId",
                table: "EvaluationAnswers",
                column: "EvaluationResponseId");
        }
    }
}
