using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class Add_ProposalReviewFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReviewNote",
                table: "WarningNotices",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReviewedAt",
                table: "WarningNotices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReviewedBy",
                table: "WarningNotices",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReviewNote",
                table: "BonusProposals",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReviewedAt",
                table: "BonusProposals",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReviewedBy",
                table: "BonusProposals",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_WarningNotices_ReviewedBy",
                table: "WarningNotices",
                column: "ReviewedBy");

            migrationBuilder.CreateIndex(
                name: "IX_BonusProposals_ReviewedBy",
                table: "BonusProposals",
                column: "ReviewedBy");

            migrationBuilder.AddForeignKey(
                name: "FK_BonusProposals_Users_ReviewedBy",
                table: "BonusProposals",
                column: "ReviewedBy",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_WarningNotices_Users_ReviewedBy",
                table: "WarningNotices",
                column: "ReviewedBy",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BonusProposals_Users_ReviewedBy",
                table: "BonusProposals");

            migrationBuilder.DropForeignKey(
                name: "FK_WarningNotices_Users_ReviewedBy",
                table: "WarningNotices");

            migrationBuilder.DropIndex(
                name: "IX_WarningNotices_ReviewedBy",
                table: "WarningNotices");

            migrationBuilder.DropIndex(
                name: "IX_BonusProposals_ReviewedBy",
                table: "BonusProposals");

            migrationBuilder.DropColumn(
                name: "ReviewNote",
                table: "WarningNotices");

            migrationBuilder.DropColumn(
                name: "ReviewedAt",
                table: "WarningNotices");

            migrationBuilder.DropColumn(
                name: "ReviewedBy",
                table: "WarningNotices");

            migrationBuilder.DropColumn(
                name: "ReviewNote",
                table: "BonusProposals");

            migrationBuilder.DropColumn(
                name: "ReviewedAt",
                table: "BonusProposals");

            migrationBuilder.DropColumn(
                name: "ReviewedBy",
                table: "BonusProposals");
        }
    }
}
