using api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260524000000_AddScoutJobUserId")]
    public partial class AddScoutJobUserId : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "UserId",
                table: "ScoutJobs",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScoutJobs_UserId",
                table: "ScoutJobs",
                column: "UserId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ScoutJobs_UserId",
                table: "ScoutJobs");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "ScoutJobs");
        }
    }
}
