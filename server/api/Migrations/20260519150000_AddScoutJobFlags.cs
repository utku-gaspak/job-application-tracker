using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class AddScoutJobFlags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "ScoutJobs"
                ADD COLUMN IF NOT EXISTS "SavedForApply" boolean NOT NULL DEFAULT false;
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "ScoutJobs"
                ADD COLUMN IF NOT EXISTS "IsDiscarded" boolean NOT NULL DEFAULT false;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "ScoutJobs"
                DROP COLUMN IF EXISTS "SavedForApply";
                """);

            migrationBuilder.Sql("""
                ALTER TABLE "ScoutJobs"
                DROP COLUMN IF EXISTS "IsDiscarded";
                """);
        }
    }
}
