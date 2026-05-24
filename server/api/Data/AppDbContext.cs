using api.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<AppUser>(options)
{
    public DbSet<JobApplication> JobApplications { get; set; } = null!;
    public DbSet<ScoutJob> ScoutJobs { get; set; } = null!;
    public DbSet<ScrapeJob> ScrapeJobs { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<AppUser>()
            .HasMany(user => user.JobApplications)
            .WithOne(jobApplication => jobApplication.User)
            .HasForeignKey(jobApplication => jobApplication.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<AppUser>()
            .HasMany(user => user.ScoutJobs)
            .WithOne(scoutJob => scoutJob.User)
            .HasForeignKey(scoutJob => scoutJob.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<ScoutJob>()
            .HasIndex(scoutJob => scoutJob.JobUrl);

        builder.Entity<ScoutJob>()
            .HasIndex(scoutJob => scoutJob.UserId);

        builder.Entity<ScrapeJob>()
            .HasIndex(scrapeJob => scrapeJob.Status);

        builder.Entity<ScrapeJob>()
            .HasIndex(scrapeJob => scrapeJob.UserId);
    }
}
