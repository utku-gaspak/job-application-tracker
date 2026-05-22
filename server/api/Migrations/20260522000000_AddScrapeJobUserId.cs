using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    public partial class AddScrapeJobUserId : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "UserId",
                table: "ScrapeJobs",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScrapeJobs_UserId",
                table: "ScrapeJobs",
                column: "UserId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ScrapeJobs_UserId",
                table: "ScrapeJobs");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "ScrapeJobs");
        }
    }
}
