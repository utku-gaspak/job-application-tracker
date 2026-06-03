namespace JobTracker.Tests.Services;

public class ScrapeJobWorkerImportTests
{
    private const string UserId = "user-1";

    [Fact]
    public async Task TryImportIntoScoutAsync_SkipsTrackerDuplicateByApplyUrl()
    {
        await using var dbContext = new TestAppDbContextFactory().CreateContext();
        dbContext.JobApplications.Add(new JobApplication
        {
            Id = "application-1",
            CompanyName = "Acme",
            Position = "Backend Engineer",
            JobUrl = "https://example.com/apply",
            Status = JobApplicationStatus.Applied,
            UserId = UserId,
        });
        await dbContext.SaveChangesAsync();

        var job = await CreateScrapeJobAsync("""
            {
              "results": [
                { "title": "Backend Engineer", "company": "Acme", "apply_url": "https://example.com/apply" },
                { "title": "Frontend Engineer", "company": "Globex", "job_url": "https://example.com/frontend" }
              ]
            }
            """);

        var result = await ScrapeJobWorker.TryImportIntoScoutAsync(job, dbContext, CancellationToken.None);

        result.Should().NotBeNull();
        result!.Imported.Should().Be(1);
        result.Skipped.Should().Be(1);
        (await dbContext.ScoutJobs.SingleAsync()).Company.Should().Be("Globex");
    }

    [Fact]
    public async Task TryImportIntoScoutAsync_SkipsTrackerDuplicateByJobUrl()
    {
        await using var dbContext = new TestAppDbContextFactory().CreateContext();
        dbContext.JobApplications.Add(new JobApplication
        {
            Id = "application-1",
            CompanyName = "Acme",
            Position = "Backend Engineer",
            JobUrl = "https://example.com/jobs/backend",
            Status = JobApplicationStatus.Interviewing,
            UserId = UserId,
        });
        await dbContext.SaveChangesAsync();

        var job = await CreateScrapeJobAsync("""
            {
              "results": [
                { "title": "Backend Engineer", "company": "Acme", "job_url": "https://example.com/jobs/backend/" },
                { "title": "Frontend Engineer", "company": "Globex", "job_url": "https://example.com/frontend" }
              ]
            }
            """);

        var result = await ScrapeJobWorker.TryImportIntoScoutAsync(job, dbContext, CancellationToken.None);

        result.Should().NotBeNull();
        result!.Imported.Should().Be(1);
        result.Skipped.Should().Be(1);
        (await dbContext.ScoutJobs.SingleAsync()).Company.Should().Be("Globex");
    }

    private static async Task<ScrapeJob> CreateScrapeJobAsync(string json)
    {
        var runDirectory = Path.Combine(Path.GetTempPath(), $"traxr-scrape-test-{Guid.NewGuid():N}");
        Directory.CreateDirectory(runDirectory);
        var jsonOutputPath = Path.Combine(runDirectory, "jobs.json");
        await File.WriteAllTextAsync(jsonOutputPath, json);

        return new ScrapeJob
        {
            JobId = Guid.NewGuid().ToString("N"),
            SourceUrl = "https://hiring.cafe/search",
            UserId = UserId,
            Status = "done",
            RunDirectory = runDirectory,
            ProfileDirectory = Path.Combine(runDirectory, "profile"),
            JsonOutputPath = jsonOutputPath,
            MarkdownOutputPath = Path.Combine(runDirectory, "jobs.md"),
        };
    }
}
