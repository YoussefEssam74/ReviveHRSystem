using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Data.Migrations
{
    /// <inheritdoc />
    public partial class DeductionDayAndCandidateLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DeductionCandidateId",
                table: "PayrollEntryLineItems",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "DeductionDate",
                table: "DeductionCandidates",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.AddColumn<bool>(
                name: "IsSystemGenerated",
                table: "DeductionCandidates",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // Backfill the punished day: the linked attendance day first, then the
            // sweep's note marker, then the issue day (UTC). The old rows were raised
            // with a UTC IssuedAt, which can lag the gym-local day by one.
            migrationBuilder.Sql("""
                UPDATE "DeductionCandidates" c
                SET "DeductionDate" = COALESCE(
                    (SELECT a."Date" FROM "AttendanceRecords" a WHERE a."Id" = c."AttendanceRecordId"),
                    CASE
                        WHEN c."Note" ~ 'auto-absence:[0-9]{4}-[0-9]{2}-[0-9]{2}'
                        THEN substring(c."Note" from 'auto-absence:([0-9]{4}-[0-9]{2}-[0-9]{2})')::date
                    END,
                    (c."IssuedAt" AT TIME ZONE 'UTC')::date);
                """);

            // The sweep owns rows it priced automatically; manager-issued rows keep
            // their free-text notes and are never touched by reconciliation.
            migrationBuilder.Sql("""
                UPDATE "DeductionCandidates"
                SET "IsSystemGenerated" = true
                WHERE "Note" LIKE 'Auto-priced:%'
                   OR "Note" LIKE '%auto-absence:%';
                """);

            // Link legacy payroll lines to the candidate they materialized from so
            // HR review keeps the employee-facing candidate in sync.
            migrationBuilder.Sql("""
                UPDATE "PayrollEntryLineItems" l
                SET "DeductionCandidateId" = (
                    SELECT dc."Id"
                    FROM "DeductionCandidates" dc
                    WHERE dc."EmployeeId" = e."EmployeeId"
                      AND dc."DeductionDate" = l."EffectiveDate"
                    ORDER BY (dc."AttendanceRecordId" = l."AttendanceRecordId") DESC,
                             (dc."Amount" = l."Amount") DESC,
                             dc."Id"
                    LIMIT 1)
                FROM "PayrollEntries" e
                WHERE l."PayrollEntryId" = e."Id"
                  AND l."Type" = 'Deduction'
                  AND l."DeductionCandidateId" IS NULL;
                """);

            // One deduction per employee/day. Before enforcing it, close the legacy
            // duplicates: keep the strongest row (rejected is final, then applied,
            // then branch-approved, then a row backed by a record) and soft-delete
            // the rest so no decision is lost.
            migrationBuilder.Sql("""
                WITH ranked AS (
                    SELECT dc."Id",
                           row_number() OVER (
                               PARTITION BY dc."EmployeeId", dc."DeductionDate"
                               ORDER BY CASE dc."Status"
                                            WHEN 3 THEN 0
                                            WHEN 2 THEN 1
                                            WHEN 4 THEN 2
                                            ELSE 3
                                        END,
                                        (dc."AttendanceRecordId" IS NULL),
                                        dc."Id") AS rn
                    FROM "DeductionCandidates" dc
                    WHERE dc."IsDeleted" = false
                )
                UPDATE "DeductionCandidates" dc
                SET "IsDeleted" = true
                FROM ranked r
                WHERE dc."Id" = r."Id" AND r.rn > 1;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_PayrollEntryLineItems_DeductionCandidateId",
                table: "PayrollEntryLineItems",
                column: "DeductionCandidateId");

            migrationBuilder.CreateIndex(
                name: "IX_DeductionCandidates_EmployeeId_DeductionDate",
                table: "DeductionCandidates",
                columns: new[] { "EmployeeId", "DeductionDate" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.AddForeignKey(
                name: "FK_PayrollEntryLineItems_DeductionCandidates_DeductionCandidat~",
                table: "PayrollEntryLineItems",
                column: "DeductionCandidateId",
                principalTable: "DeductionCandidates",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PayrollEntryLineItems_DeductionCandidates_DeductionCandidat~",
                table: "PayrollEntryLineItems");

            migrationBuilder.DropIndex(
                name: "IX_PayrollEntryLineItems_DeductionCandidateId",
                table: "PayrollEntryLineItems");

            migrationBuilder.DropIndex(
                name: "IX_DeductionCandidates_EmployeeId_DeductionDate",
                table: "DeductionCandidates");

            migrationBuilder.DropColumn(
                name: "DeductionCandidateId",
                table: "PayrollEntryLineItems");

            migrationBuilder.DropColumn(
                name: "DeductionDate",
                table: "DeductionCandidates");

            migrationBuilder.DropColumn(
                name: "IsSystemGenerated",
                table: "DeductionCandidates");
        }
    }
}
