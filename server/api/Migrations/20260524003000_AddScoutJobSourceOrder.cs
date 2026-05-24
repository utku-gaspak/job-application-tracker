using api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260524003000_AddScoutJobSourceOrder")]
    public partial class AddScoutJobSourceOrder : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SourceOrder",
                table: "ScoutJobs",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScoutJobs_SourceOrder",
                table: "ScoutJobs",
                column: "SourceOrder");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ScoutJobs_SourceOrder",
                table: "ScoutJobs");

            migrationBuilder.DropColumn(
                name: "SourceOrder",
                table: "ScoutJobs");
        }
    }
}
