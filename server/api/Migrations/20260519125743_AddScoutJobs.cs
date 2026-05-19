using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class AddScoutJobs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS "ScoutJobs" (
                    "Id" uuid NOT NULL,
                    "Title" text NOT NULL,
                    "Company" text NOT NULL,
                    "Location" text NULL,
                    "WorkplaceType" text NULL,
                    "Commitment" text NULL,
                    "PostedAt" timestamp with time zone NULL,
                    "JobUrl" text NULL,
                    "ApplyUrl" text NULL,
                    "TechnicalTools" text NULL,
                    "RequirementsSummary" text NULL,
                    "CreatedAt" timestamp with time zone NOT NULL,
                    CONSTRAINT "PK_ScoutJobs" PRIMARY KEY ("Id")
                );
                """);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_ScoutJobs_JobUrl"
                ON "ScoutJobs" ("JobUrl");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ScoutJobs");
        }
    }
}
