using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    public partial class ConsolidateMissingColumns : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Use IF NOT EXISTS so this migration is safe to run against
            // production databases that already have these columns from the
            // previous raw-SQL fallback in Program.cs.

            // JobApplications — Notes
            migrationBuilder.Sql("""
                ALTER TABLE "JobApplications"
                ADD COLUMN IF NOT EXISTS "Notes" text NULL;
                """);

            // ScoutJobs — SavedForApply, IsDiscarded
            migrationBuilder.Sql("""
                ALTER TABLE "ScoutJobs"
                ADD COLUMN IF NOT EXISTS "SavedForApply" boolean NOT NULL DEFAULT false;
                """);
            migrationBuilder.Sql("""
                ALTER TABLE "ScoutJobs"
                ADD COLUMN IF NOT EXISTS "IsDiscarded" boolean NOT NULL DEFAULT false;
                """);

            // ScoutJobs — UserId + index
            migrationBuilder.Sql("""
                ALTER TABLE "ScoutJobs"
                ADD COLUMN IF NOT EXISTS "UserId" text NULL;
                """);
            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_ScoutJobs_UserId"
                ON "ScoutJobs" ("UserId");
                """);

            // ScoutJobs — SourceOrder + index
            migrationBuilder.Sql("""
                ALTER TABLE "ScoutJobs"
                ADD COLUMN IF NOT EXISTS "SourceOrder" integer NULL;
                """);
            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_ScoutJobs_SourceOrder"
                ON "ScoutJobs" ("SourceOrder");
                """);

            // ScrapeJobs — UserId + index
            migrationBuilder.Sql("""
                ALTER TABLE "ScrapeJobs"
                ADD COLUMN IF NOT EXISTS "UserId" text NULL;
                """);
            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_ScrapeJobs_UserId"
                ON "ScrapeJobs" ("UserId");
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "JobApplications"
                DROP COLUMN IF EXISTS "Notes";
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "ScoutJobs"
                DROP COLUMN IF EXISTS "SavedForApply";
                """);
            migrationBuilder.Sql("""
                ALTER TABLE "ScoutJobs"
                DROP COLUMN IF EXISTS "IsDiscarded";
                """);

            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_ScoutJobs_UserId";
                """);
            migrationBuilder.Sql("""
                ALTER TABLE "ScoutJobs"
                DROP COLUMN IF EXISTS "UserId";
                """);

            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_ScoutJobs_SourceOrder";
                """);
            migrationBuilder.Sql("""
                ALTER TABLE "ScoutJobs"
                DROP COLUMN IF EXISTS "SourceOrder";
                """);

            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_ScrapeJobs_UserId";
                """);
            migrationBuilder.Sql("""
                ALTER TABLE "ScrapeJobs"
                DROP COLUMN IF EXISTS "UserId";
                """);
        }
    }
}
