using api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260603170000_EnsureDemoSessionColumns")]
    public partial class EnsureDemoSessionColumns : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "AspNetUsers"
                ADD COLUMN IF NOT EXISTS "DemoSessionCreatedAt" timestamp with time zone;

                ALTER TABLE "AspNetUsers"
                ADD COLUMN IF NOT EXISTS "DemoSessionExpiresAt" timestamp with time zone;

                ALTER TABLE "AspNetUsers"
                ADD COLUMN IF NOT EXISTS "IsDemoSession" boolean NOT NULL DEFAULT false;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "AspNetUsers"
                DROP COLUMN IF EXISTS "DemoSessionCreatedAt";

                ALTER TABLE "AspNetUsers"
                DROP COLUMN IF EXISTS "DemoSessionExpiresAt";

                ALTER TABLE "AspNetUsers"
                DROP COLUMN IF EXISTS "IsDemoSession";
                """);
        }
    }
}
