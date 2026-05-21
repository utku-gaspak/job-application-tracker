using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class AddScrapeJobs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ScrapeJobs",
                columns: table => new
                {
                    JobId = table.Column<string>(type: "text", nullable: false),
                    SourceUrl = table.Column<string>(type: "text", nullable: false),
                    IncludeSeen = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Message = table.Column<string>(type: "text", nullable: true),
                    Error = table.Column<string>(type: "text", nullable: true),
                    VerificationUrl = table.Column<string>(type: "text", nullable: true),
                    RunDirectory = table.Column<string>(type: "text", nullable: false),
                    ProfileDirectory = table.Column<string>(type: "text", nullable: false),
                    StatusFilePath = table.Column<string>(type: "text", nullable: true),
                    JsonOutputPath = table.Column<string>(type: "text", nullable: true),
                    MarkdownOutputPath = table.Column<string>(type: "text", nullable: true),
                    StdoutLogPath = table.Column<string>(type: "text", nullable: true),
                    StderrLogPath = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FinishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScrapeJobs", x => x.JobId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ScrapeJobs_Status",
                table: "ScrapeJobs",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ScrapeJobs");
        }
    }
}
