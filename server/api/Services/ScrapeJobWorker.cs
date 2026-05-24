using System.Diagnostics;
using System.Text.Json;
using api;
using api.Data;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Services;

public sealed class ScrapeJobWorker(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ScrapeJobQueue queue,
    ILogger<ScrapeJobWorker> logger
) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await RecoverActiveJobsAsync(stoppingToken);

        await foreach (var jobId in queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                await RunJobAsync(jobId, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Unexpected scrape worker failure for job {JobId}", jobId);
                await MarkJobFailedAsync(jobId, exception, stoppingToken);
            }
        }
    }

    private async Task RunJobAsync(string jobId, CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var job = await dbContext.ScrapeJobs.FirstOrDefaultAsync(
            current => current.JobId == jobId,
            cancellationToken
        );

        if (job is null)
        {
            logger.LogWarning("Scrape job {JobId} was not found when the worker started.", jobId);
            return;
        }

        if (await HasCompletedArtifactsAsync(job, cancellationToken))
        {
            await MarkJobDoneFromArtifactsAsync(job, dbContext, cancellationToken);
            return;
        }

        job.Status = "running";
        job.Message = "Scraping HiringCafe results.";
        job.Error = null;
        job.StartedAt ??= DateTime.UtcNow;
        job.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        Directory.CreateDirectory(job.RunDirectory);
        Directory.CreateDirectory(job.ProfileDirectory);
        var removedProfileLocks = ChromiumProfileLocks.ClearStaleLocks(job.ProfileDirectory);
        if (removedProfileLocks.Count > 0)
        {
            logger.LogInformation(
                "Cleared {Count} stale Chromium profile locks for scrape job {JobId}.",
                removedProfileLocks.Count,
                job.JobId
            );
        }

        var scraperRoot = RequiredConfiguration.GetScraperRootDirectory(configuration);

        if (!Directory.Exists(scraperRoot))
        {
            job.Status = "failed";
            job.Message = "Scraper root directory was not found.";
            job.Error = $"Scraper root directory does not exist: {scraperRoot}";
            job.FinishedAt = DateTime.UtcNow;
            job.UpdatedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            return;
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = "uv",
            WorkingDirectory = scraperRoot,
            RedirectStandardError = true,
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        startInfo.Environment["CAFE_SCOUT_HEADLESS"] = "1";
        startInfo.Environment["CAFE_SCOUT_BROWSER_BINARY"] =
            RequiredConfiguration.GetScraperBrowserBinary();
        startInfo.Environment["PLAYWRIGHT_BROWSERS_PATH"] = "/root/.cache/ms-playwright";
        startInfo.Environment["UV_LINK_MODE"] = "copy";
        startInfo.Environment["HOME"] = "/root";
        startInfo.Environment["XDG_CACHE_HOME"] = "/root/.cache";
        startInfo.Environment["XDG_CONFIG_HOME"] = "/root/.config";

        startInfo.ArgumentList.Add("run");
        startInfo.ArgumentList.Add("cafe-scout");
        startInfo.ArgumentList.Add("--url");
        startInfo.ArgumentList.Add(job.SourceUrl);
        startInfo.ArgumentList.Add("--json-output");
        startInfo.ArgumentList.Add(job.JsonOutputPath!);
        startInfo.ArgumentList.Add("--markdown-output");
        startInfo.ArgumentList.Add(job.MarkdownOutputPath!);
        startInfo.ArgumentList.Add("--progress-output");
        startInfo.ArgumentList.Add(Path.Combine(job.RunDirectory, "progress.json"));
        startInfo.ArgumentList.Add("--browser-profile-dir");
        startInfo.ArgumentList.Add(job.ProfileDirectory);

        if (job.IncludeSeen)
        {
            startInfo.ArgumentList.Add("--include-seen");
        }

        string stdout;
        string stderr;
        int exitCode;
        var completedFromArtifacts = false;
        var needsVerificationFromProgress = false;

        try
        {
            using var process = new Process { StartInfo = startInfo };

            if (!process.Start())
            {
                throw new InvalidOperationException("Failed to start the HiringCafe scraper process.");
            }

            var stdoutTask = process.StandardOutput.ReadToEndAsync();
            var stderrTask = process.StandardError.ReadToEndAsync();
            var waitForExitTask = process.WaitForExitAsync(cancellationToken);

            while (!process.HasExited)
            {
                var completedTask = await Task.WhenAny(
                    waitForExitTask,
                    Task.Delay(TimeSpan.FromSeconds(2), cancellationToken)
                );

                if (completedTask == waitForExitTask)
                {
                    break;
                }

                if (await HasVerificationProgressAsync(job, cancellationToken))
                {
                    needsVerificationFromProgress = true;

                    try
                    {
                        process.Kill(entireProcessTree: true);
                    }
                    catch (InvalidOperationException)
                    {
                        // Process already exited between the progress check and kill request.
                    }

                    await waitForExitTask;
                    break;
                }

                if (await HasCompletedArtifactsAsync(job, cancellationToken))
                {
                    completedFromArtifacts = true;

                    try
                    {
                        process.Kill(entireProcessTree: true);
                    }
                    catch (InvalidOperationException)
                    {
                        // Process already exited between the artifact check and kill request.
                    }

                    await waitForExitTask;
                    break;
                }
            }

            stdout = await stdoutTask;
            stderr = await stderrTask;
            exitCode = process.ExitCode;
        }
        catch (Exception exception)
        {
            job.Status = "failed";
            job.Message = "Scrape job failed to start.";
            job.Error = exception.Message;
            job.FinishedAt = DateTime.UtcNow;
            job.UpdatedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            return;
        }

        await File.WriteAllTextAsync(job.StdoutLogPath!, stdout, cancellationToken);
        await File.WriteAllTextAsync(job.StderrLogPath!, stderr, cancellationToken);

        if (
            needsVerificationFromProgress
            || await HasVerificationProgressAsync(job, cancellationToken)
            || NeedsVerification(stdout, stderr, exitCode)
        )
        {
            job.Status = "needs_verification";
            job.Message = "HiringCafe requires manual verification.";
            job.Error = null;
            job.VerificationUrl ??= $"/verify/{job.JobId}";
            job.FinishedAt = null;
            job.UpdatedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            return;
        }

        job.FinishedAt = DateTime.UtcNow;
        job.UpdatedAt = DateTime.UtcNow;

        if (
            (exitCode == 0 || completedFromArtifacts)
            && File.Exists(job.JsonOutputPath)
            && File.Exists(job.MarkdownOutputPath)
        )
        {
            var importSummary = await TryImportIntoScoutAsync(job, dbContext, cancellationToken);
            job.Status = "done";
            job.Message = importSummary is null
                ? "Scrape job completed."
                : importSummary.Imported > 0
                    ? $"Scrape job completed. Imported {importSummary.Imported} new jobs into Scout."
                    : "Scrape job completed. No new Scout jobs were added.";
            job.Error = null;
        }
        else
        {
            job.Status = "failed";
            job.Message = "Scrape job failed.";
            job.Error = !string.IsNullOrWhiteSpace(stderr) ? stderr : stdout;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task RecoverActiveJobsAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var activeJobIds = await dbContext
                .ScrapeJobs.Where(job =>
                    job.Status == "queued"
                    || job.Status == "running"
                )
                .OrderBy(job => job.CreatedAt)
                .Select(job => job.JobId)
                .ToListAsync(cancellationToken);

            foreach (var activeJobId in activeJobIds)
            {
                await queue.QueueAsync(activeJobId, cancellationToken);
            }
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogError(exception, "Failed to recover active scrape jobs on worker startup.");
        }
    }

    private static async Task MarkJobDoneFromArtifactsAsync(
        ScrapeJob job,
        AppDbContext dbContext,
        CancellationToken cancellationToken
    )
    {
        var importSummary = await TryImportIntoScoutAsync(job, dbContext, cancellationToken);

        job.Status = "done";
        job.Message = importSummary is null
            ? "Scrape job completed."
            : importSummary.Imported > 0
                ? $"Scrape job completed. Imported {importSummary.Imported} new jobs into Scout."
                : "Scrape job completed. No new Scout jobs were added.";
        job.Error = null;
        job.FinishedAt ??= DateTime.UtcNow;
        job.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task MarkJobFailedAsync(
        string jobId,
        Exception exception,
        CancellationToken cancellationToken
    )
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var job = await dbContext.ScrapeJobs.FirstOrDefaultAsync(
                current => current.JobId == jobId,
                cancellationToken
            );

            if (job is null || IsTerminalStatus(job.Status))
            {
                return;
            }

            job.Status = "failed";
            job.Message = "Scrape job failed.";
            job.Error = exception.Message;
            job.FinishedAt = DateTime.UtcNow;
            job.UpdatedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception markFailedException)
        {
            logger.LogError(
                markFailedException,
                "Failed to mark scrape job {JobId} as failed after worker exception.",
                jobId
            );
        }
    }

    private static bool IsTerminalStatus(string status) =>
        status.Equals("done", StringComparison.OrdinalIgnoreCase)
        || status.Equals("failed", StringComparison.OrdinalIgnoreCase)
        || status.Equals("cancelled", StringComparison.OrdinalIgnoreCase);

    private static async Task<bool> HasCompletedArtifactsAsync(
        ScrapeJob job,
        CancellationToken cancellationToken
    )
    {
        if (
            string.IsNullOrWhiteSpace(job.JsonOutputPath)
            || string.IsNullOrWhiteSpace(job.MarkdownOutputPath)
            || !File.Exists(job.JsonOutputPath)
            || !File.Exists(job.MarkdownOutputPath)
        )
        {
            return false;
        }

        var progressPath = Path.Combine(job.RunDirectory, "progress.json");
        if (!File.Exists(progressPath))
        {
            return false;
        }

        try
        {
            await using var progressStream = File.OpenRead(progressPath);
            using var document = await JsonDocument.ParseAsync(
                progressStream,
                cancellationToken: cancellationToken
            );

            if (
                document.RootElement.TryGetProperty("status", out var statusElement)
                && statusElement.ValueKind == JsonValueKind.String
            )
            {
                var progressStatus = statusElement.GetString();
                if (
                    progressStatus?.Equals("done", StringComparison.OrdinalIgnoreCase) == true
                    || progressStatus?.Equals("complete", StringComparison.OrdinalIgnoreCase) == true
                    || progressStatus?.Equals("completed", StringComparison.OrdinalIgnoreCase) == true
                )
                {
                    return true;
                }
            }

            if (
                document.RootElement.TryGetProperty("progress_percent", out var percentElement)
                && percentElement.TryGetDouble(out var progressPercent)
                && progressPercent >= 100
            )
            {
                return true;
            }
        }
        catch (JsonException)
        {
            return false;
        }
        catch (IOException)
        {
            return false;
        }
        catch (UnauthorizedAccessException)
        {
            return false;
        }

        return false;
    }

    private static async Task<bool> HasVerificationProgressAsync(
        ScrapeJob job,
        CancellationToken cancellationToken
    )
    {
        var progressStatus = await TryReadProgressStatusAsync(job, cancellationToken);

        return progressStatus?.Equals("needs_verification", StringComparison.OrdinalIgnoreCase) == true
            || progressStatus?.Equals("verification_required", StringComparison.OrdinalIgnoreCase) == true;
    }

    private static async Task<string?> TryReadProgressStatusAsync(
        ScrapeJob job,
        CancellationToken cancellationToken
    )
    {
        var progressPath = Path.Combine(job.RunDirectory, "progress.json");
        if (!File.Exists(progressPath))
        {
            return null;
        }

        try
        {
            await using var progressStream = File.OpenRead(progressPath);
            using var document = await JsonDocument.ParseAsync(
                progressStream,
                cancellationToken: cancellationToken
            );

            return document.RootElement.TryGetProperty("status", out var statusElement)
                && statusElement.ValueKind == JsonValueKind.String
                    ? statusElement.GetString()
                    : null;
        }
        catch (JsonException)
        {
            return null;
        }
        catch (IOException)
        {
            return null;
        }
        catch (UnauthorizedAccessException)
        {
            return null;
        }
    }

    private static async Task<ScoutUploadResult?> TryImportIntoScoutAsync(
        ScrapeJob job,
        AppDbContext dbContext,
        CancellationToken cancellationToken
    )
    {
        if (string.IsNullOrWhiteSpace(job.JsonOutputPath) || !File.Exists(job.JsonOutputPath))
        {
            return null;
        }

        try
        {
            await using var stream = File.OpenRead(job.JsonOutputPath);
            var parsed = await ScoutJobUploadParser.ParseAsync(stream, cancellationToken);

            var existingJobUrls = new HashSet<string>(
                await dbContext
                    .ScoutJobs.Where(current => current.JobUrl != null)
                    .Select(current => current.JobUrl!)
                    .ToListAsync(cancellationToken),
                StringComparer.OrdinalIgnoreCase
            );
            var importedJobUrls = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var jobsToImport = new List<ScoutJob>();
            var skipped = parsed.Skipped;

            foreach (var scoutJob in parsed.Jobs)
            {
                if (
                    scoutJob.JobUrl is not null
                    && (!importedJobUrls.Add(scoutJob.JobUrl) || existingJobUrls.Contains(scoutJob.JobUrl))
                )
                {
                    skipped++;
                    continue;
                }

                jobsToImport.Add(scoutJob);
            }

            if (jobsToImport.Count > 0)
            {
                dbContext.ScoutJobs.AddRange(jobsToImport);
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            return new ScoutUploadResult(jobsToImport.Count, skipped);
        }
        catch (Exception exception) when (
            exception is JsonException
            or IOException
            or UnauthorizedAccessException
        )
        {
            return null;
        }
    }

    private sealed record ScoutUploadResult(int Imported, int Skipped);

    private static bool NeedsVerification(string stdout, string stderr, int exitCode)
    {
        var output = string.Join(
            Environment.NewLine,
            [stdout ?? string.Empty, stderr ?? string.Empty]
        );

        if (
            output.Contains("cloudflare", StringComparison.OrdinalIgnoreCase)
            || output.Contains("verify you are human", StringComparison.OrdinalIgnoreCase)
            || output.Contains("just a moment", StringComparison.OrdinalIgnoreCase)
            || output.Contains("captcha", StringComparison.OrdinalIgnoreCase)
            || output.Contains("challenge", StringComparison.OrdinalIgnoreCase)
            || output.Contains("checking your browser", StringComparison.OrdinalIgnoreCase)
        )
        {
            return true;
        }

        return exitCode != 0
            && output.Contains("verification", StringComparison.OrdinalIgnoreCase)
            && output.Contains("browser", StringComparison.OrdinalIgnoreCase);
    }
}
