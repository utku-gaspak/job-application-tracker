using System.Security.Claims;
using api.Data;
using api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace api.Services;

public class DemoSessionService(
    AppDbContext dbContext,
    UserManager<AppUser> userManager,
    IConfiguration configuration,
    ILogger<DemoSessionService> logger
) : IDemoSessionService
{
    public TimeSpan SessionLifetime { get; } = TimeSpan.FromHours(
        Math.Max(1, configuration.GetValue("Demo:SessionLifetimeHours", 24))
    );

    public async Task<AppUser> CreateSessionAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var sessionId = Guid.NewGuid().ToString("N");
        var sessionUser = new AppUser
        {
            UserName = $"demo-session-{sessionId}",
            Email = $"demo-session-{sessionId}@traxr.local",
            EmailConfirmed = true,
            IsDemoSession = true,
            DemoSessionCreatedAt = now,
            DemoSessionExpiresAt = now.Add(SessionLifetime),
        };

        var result = await userManager.CreateAsync(sessionUser);
        if (!result.Succeeded)
        {
            var errorMessage = string.Join(
                "; ",
                result.Errors.Select(error => error.Description)
            );
            throw new InvalidOperationException($"Failed to create demo session: {errorMessage}");
        }

        var templateUser = await userManager.FindByNameAsync(DemoDataSeeder.DemoUsername);
        var applications = templateUser is null
            ? DemoDataSeeder.CreateDemoJobApplications(sessionUser.Id)
            : await CloneTemplateApplicationsAsync(templateUser.Id, sessionUser.Id, cancellationToken);
        var scoutJobs = templateUser is null
            ? DemoDataSeeder.CreateDemoScoutJobs(sessionUser.Id)
            : await CloneTemplateScoutJobsAsync(templateUser.Id, sessionUser.Id, cancellationToken);

        dbContext.JobApplications.AddRange(applications);
        dbContext.ScoutJobs.AddRange(scoutJobs);
        await dbContext.SaveChangesAsync(cancellationToken);

        return sessionUser;
    }

    public async Task DeleteSessionAsync(string userId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return;

        var user = await dbContext.Users.FirstOrDefaultAsync(
            current => current.Id == userId && current.IsDemoSession,
            cancellationToken
        );

        if (user is null)
            return;

        await DeleteSessionUserAsync(user, cancellationToken);
    }

    public async Task<int> DeleteExpiredSessionsAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var expiredUsers = await dbContext
            .Users.Where(user =>
                user.IsDemoSession
                && user.DemoSessionExpiresAt != null
                && user.DemoSessionExpiresAt <= now)
            .ToListAsync(cancellationToken);

        foreach (var user in expiredUsers)
            await DeleteSessionUserAsync(user, cancellationToken);

        return expiredUsers.Count;
    }

    public bool IsDemoSession(ClaimsPrincipal user) =>
        string.Equals(
            user.FindFirstValue(DemoSessionClaims.IsDemoSession),
            "true",
            StringComparison.OrdinalIgnoreCase
        );

    private async Task DeleteSessionUserAsync(AppUser user, CancellationToken cancellationToken)
    {
        var scrapeJobs = await dbContext
            .ScrapeJobs.Where(job => job.UserId == user.Id)
            .ToListAsync(cancellationToken);
        var scrapePresets = await dbContext
            .ScrapePresets.Where(preset => preset.UserId == user.Id)
            .ToListAsync(cancellationToken);
        var jobApplications = await dbContext
            .JobApplications.Where(application => application.UserId == user.Id)
            .ToListAsync(cancellationToken);
        var scoutJobs = await dbContext
            .ScoutJobs.Where(job => job.UserId == user.Id)
            .ToListAsync(cancellationToken);

        foreach (var scrapeJob in scrapeJobs)
        {
            DeleteDirectoryBestEffort(scrapeJob.RunDirectory);
            DeleteDirectoryBestEffort(scrapeJob.ProfileDirectory);
        }

        dbContext.ScrapeJobs.RemoveRange(scrapeJobs);
        dbContext.ScrapePresets.RemoveRange(scrapePresets);
        dbContext.JobApplications.RemoveRange(jobApplications);
        dbContext.ScoutJobs.RemoveRange(scoutJobs);
        dbContext.Users.Remove(user);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<List<JobApplication>> CloneTemplateApplicationsAsync(
        string templateUserId,
        string sessionUserId,
        CancellationToken cancellationToken)
    {
        var templateApplications = await dbContext
            .JobApplications.AsNoTracking()
            .Where(application => application.UserId == templateUserId)
            .OrderByDescending(application => application.DateApplied)
            .ToListAsync(cancellationToken);

        if (templateApplications.Count == 0)
            return DemoDataSeeder.CreateDemoJobApplications(sessionUserId);

        return templateApplications.Select(application => new JobApplication
        {
            Id = Guid.NewGuid().ToString(),
            CompanyName = application.CompanyName,
            Position = application.Position,
            JobUrl = application.JobUrl,
            Location = application.Location,
            SalaryRange = application.SalaryRange,
            JobDescription = application.JobDescription,
            Notes = application.Notes,
            InterestLevel = application.InterestLevel,
            TechnicalStack = application.TechnicalStack,
            Status = application.Status,
            DateApplied = application.DateApplied,
            UserId = sessionUserId,
        }).ToList();
    }

    private async Task<List<ScoutJob>> CloneTemplateScoutJobsAsync(
        string templateUserId,
        string sessionUserId,
        CancellationToken cancellationToken)
    {
        var templateScoutJobs = await dbContext
            .ScoutJobs.AsNoTracking()
            .Where(job => job.UserId == templateUserId)
            .OrderBy(job => job.SourceOrder == null)
            .ThenBy(job => job.SourceOrder)
            .ThenByDescending(job => job.CreatedAt)
            .ToListAsync(cancellationToken);

        if (templateScoutJobs.Count == 0)
            return DemoDataSeeder.CreateDemoScoutJobs(sessionUserId);

        return templateScoutJobs.Select(job => new ScoutJob
        {
            Id = Guid.NewGuid(),
            Title = job.Title,
            Company = job.Company,
            Location = job.Location,
            WorkplaceType = job.WorkplaceType,
            Commitment = job.Commitment,
            PostedAt = job.PostedAt,
            JobUrl = job.JobUrl,
            ApplyUrl = job.ApplyUrl,
            TechnicalTools = job.TechnicalTools,
            RequirementsSummary = job.RequirementsSummary,
            SavedForApply = job.SavedForApply,
            IsDiscarded = job.IsDiscarded,
            CreatedAt = job.CreatedAt,
            SourceOrder = job.SourceOrder,
            UserId = sessionUserId,
        }).ToList();
    }

    private void DeleteDirectoryBestEffort(string? path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path))
            return;

        try
        {
            Directory.Delete(path, recursive: true);
        }
        catch (Exception exception) when (
            exception is IOException
            or UnauthorizedAccessException
            or ArgumentException
            or NotSupportedException
        )
        {
            logger.LogDebug(exception, "Could not delete demo session directory {Path}.", path);
        }
    }
}
