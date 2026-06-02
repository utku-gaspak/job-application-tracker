using System.Diagnostics;
using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using api;
using api.Data;
using api.Dto;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers;

[ApiController]
[Authorize]
[Route("api/scrape")]
public class ScrapeController(
    AppDbContext dbContext,
    IScrapeJobQueue scrapeJobQueue,
    IConfiguration configuration,
    ILogger<ScrapeController> logger
) : ControllerBase
{
    private const string HiringCafeHost = "hiring.cafe";
    private const string ProgressFileName = "progress.json";
    private static readonly JsonSerializerOptions ProgressJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    [HttpPost]
    public async Task<ActionResult<ScrapeJobStatusDto>> Create(
        [FromBody] ScrapeJobCreateDto request,
        CancellationToken cancellationToken
    )
    {
        if (!TryValidateSourceUrl(request.Url, out var normalizedUrl, out var validationError))
        {
            return BadRequest(validationError);
        }

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var jobId = CreateJobId();
        var runDirectory = Path.Combine(
            RequiredConfiguration.GetScraperRunsDirectory(configuration),
            jobId
        );
        var profileDirectory = GetProfileDirectory(userId);

        var entity = new ScrapeJob
        {
            JobId = jobId,
            SourceUrl = normalizedUrl,
            UserId = userId,
            IncludeSeen = request.IncludeSeen,
            Status = "queued",
            Message = "Scrape job queued.",
            VerificationUrl = $"/verify/{jobId}",
            RunDirectory = runDirectory,
            ProfileDirectory = profileDirectory,
            JsonOutputPath = Path.Combine(runDirectory, "jobs.json"),
            MarkdownOutputPath = Path.Combine(runDirectory, "jobs.md"),
            StdoutLogPath = Path.Combine(runDirectory, "stdout.log"),
            StderrLogPath = Path.Combine(runDirectory, "stderr.log"),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        dbContext.ScrapeJobs.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        await scrapeJobQueue.QueueAsync(entity.JobId, cancellationToken);

        return Ok(await ToStatusDtoAsync(entity, cancellationToken));
    }

    [HttpPost("{jobId}/verification-complete")]
    public async Task<ActionResult<ScrapeJobStatusDto>> MarkVerificationComplete(
        [FromRoute] string jobId,
        CancellationToken cancellationToken
    )
    {
        var job = await dbContext.ScrapeJobs.FindAsync([jobId], cancellationToken);
        if (job is null)
        {
            return NotFound();
        }

        if (!CanAccessJob(job))
        {
            return NotFound();
        }

        if (
            !job.Status.Equals("needs_verification", StringComparison.OrdinalIgnoreCase)
            && !job.Status.Equals("verifying", StringComparison.OrdinalIgnoreCase)
        )
        {
            return Conflict("Verification can only be completed for a job that needs verification.");
        }

        job.Status = "queued";
        job.Message = "Verification completed. Scrape job re-queued.";
        job.Error = null;
        job.UpdatedAt = DateTime.UtcNow;
        job.FinishedAt = null;

        StopVisibleVerificationBrowser(job);

        await dbContext.SaveChangesAsync(cancellationToken);
        await scrapeJobQueue.QueueAsync(job.JobId, cancellationToken);

        return Ok(await ToStatusDtoAsync(job, cancellationToken));
    }

    [HttpPost("{jobId}/verification-started")]
    public async Task<ActionResult<ScrapeJobStatusDto>> MarkVerificationStarted(
        [FromRoute] string jobId,
        CancellationToken cancellationToken
    )
    {
        var job = await dbContext.ScrapeJobs.FindAsync([jobId], cancellationToken);
        if (job is null)
        {
            return NotFound();
        }

        if (!CanAccessJob(job))
        {
            return NotFound();
        }

        if (!job.Status.Equals("needs_verification", StringComparison.OrdinalIgnoreCase))
        {
            return Conflict("Verification can only be started for a job that needs verification.");
        }

        job.Status = "verifying";
        job.Message = "Waiting for manual HiringCafe verification.";
        job.Error = null;
        job.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        StartVisibleVerificationBrowser(job);

        return Ok(await ToStatusDtoAsync(job, cancellationToken));
    }

    [HttpGet("{jobId}")]
    public async Task<ActionResult<ScrapeJobStatusDto>> Get(
        [FromRoute] string jobId,
        CancellationToken cancellationToken
    )
    {
        var job = await dbContext.ScrapeJobs.FindAsync([jobId], cancellationToken);
        if (job is null)
        {
            return NotFound();
        }

        if (!CanAccessJob(job))
        {
            return NotFound();
        }

        return Ok(await ToStatusDtoAsync(job, cancellationToken));
    }

    [HttpPost("presets")]
    public async Task<ActionResult<ScrapePresetDto>> CreatePreset(
        [FromBody] ScrapePresetCreateDto request,
        CancellationToken cancellationToken
    )
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest("Preset name is required.");
        }

        if (
            string.IsNullOrWhiteSpace(request.SourceUrl)
            || !Uri.TryCreate(request.SourceUrl.Trim(), UriKind.Absolute, out var uri)
            || !uri.Host.Equals(HiringCafeHost, StringComparison.OrdinalIgnoreCase)
        )
        {
            return BadRequest("A valid hiring.cafe URL is required.");
        }

        var entity = new ScrapePreset
        {
            UserId = userId,
            Name = request.Name.Trim(),
            SourceUrl = uri.ToString(),
            CreatedAt = DateTime.UtcNow,
        };

        dbContext.ScrapePresets.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(ToPresetDto(entity));
    }

    [HttpPost("{jobId}/cancel")]
    public async Task<ActionResult<ScrapeJobStatusDto>> Cancel(
        [FromRoute] string jobId,
        CancellationToken cancellationToken
    )
    {
        var job = await dbContext.ScrapeJobs.FindAsync([jobId], cancellationToken);
        if (job is null) return NotFound();
        if (!CanAccessJob(job)) return NotFound();

        var status = job.Status?.Trim() ?? string.Empty;
        if (!status.Equals("queued", StringComparison.OrdinalIgnoreCase)
            && !status.Equals("running", StringComparison.OrdinalIgnoreCase))
        {
            return Conflict("Only queued or running scrape jobs can be cancelled.");
        }

        ScrapeJobWorker.KillScraperProcess(job);
        ClearScraperPidFile(job);

        job.Status = "cancelled";
        job.Message = "Scrape job was cancelled.";
        job.Error = null;
        job.FinishedAt = DateTime.UtcNow;
        job.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(await ToStatusDtoAsync(job, cancellationToken));
    }

    private static void ClearScraperPidFile(ScrapeJob job)
    {
        try { System.IO.File.Delete(ScrapeJobWorker.GetScraperPidPath(job)); } catch { /* best effort */ }
    }

    [HttpGet("presets")]
    public async Task<ActionResult<List<ScrapePresetDto>>> ListPresets(
        CancellationToken cancellationToken
    )
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        var presets = await dbContext
            .ScrapePresets.AsNoTracking()
            .Where(preset => preset.UserId == userId)
            .OrderBy(preset => preset.CreatedAt)
            .Select(preset => ToPresetDto(preset))
            .ToListAsync(cancellationToken);

        return Ok(presets);
    }

    [HttpDelete("presets/{id}")]
    public async Task<IActionResult> DeletePreset(
        [FromRoute] string id,
        CancellationToken cancellationToken
    )
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var preset = await dbContext.ScrapePresets.FindAsync([id], cancellationToken);
        if (preset is null)
        {
            return NotFound();
        }

        if (preset.UserId != userId)
        {
            return NotFound();
        }

        dbContext.ScrapePresets.Remove(preset);
        await dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpGet("history")]
    public async Task<ActionResult<ScrapeHistorySummaryDto>> GetHistory(
        CancellationToken cancellationToken
    )
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        var jobs = await dbContext
            .ScrapeJobs.AsNoTracking()
            .Where(job => job.UserId == userId)
            .OrderByDescending(job => job.CreatedAt)
            .ToListAsync(cancellationToken);

        var totalJobs = jobs.Count;
        var completedJobs = 0;
        var failedJobs = 0;
        var runningJobs = 0;
        var queuedJobs = 0;
        var totalResultsFound = 0;
        var totalImportedJobs = 0;
        DateTime? lastScrapedAt = null;
        DateTime? lastSuccessfulScrapedAt = null;
        int? lastSuccessfulResultCount = null;
        int? lastSuccessfulImportedCount = null;
        var recentJobs = new List<ScrapeHistoryJobDto>();

        foreach (var job in jobs)
        {
            var status = job.Status?.Trim() ?? string.Empty;
            var isDone = status.Equals("done", StringComparison.OrdinalIgnoreCase);
            var isFailed = status.Equals("failed", StringComparison.OrdinalIgnoreCase);
            var isRunning = status.Equals("running", StringComparison.OrdinalIgnoreCase);
            var isQueued = status.Equals("queued", StringComparison.OrdinalIgnoreCase);

            if (isDone)
            {
                completedJobs++;
            }
            else if (isFailed)
            {
                failedJobs++;
            }
            else if (isRunning)
            {
                runningJobs++;
            }
            else if (isQueued)
            {
                queuedJobs++;
            }

            var scrapedAt = GetScrapedAt(job);
            if (lastScrapedAt is null || scrapedAt > lastScrapedAt)
            {
                lastScrapedAt = scrapedAt;
            }

            int? resultCount = null;
            if (isDone)
            {
                resultCount = await TryReadResultCountAsync(job, cancellationToken);
                if (resultCount.HasValue)
                {
                    totalResultsFound += resultCount.Value;
                }
            }

            var importedCount = TryReadImportedCount(job.Message);
            if (importedCount.HasValue)
            {
                totalImportedJobs += importedCount.Value;
            }

            if (
                lastSuccessfulScrapedAt is null
                && isDone
                && job.FinishedAt is not null
            )
            {
                lastSuccessfulScrapedAt = scrapedAt;
                lastSuccessfulResultCount = resultCount;
                lastSuccessfulImportedCount = importedCount;
            }

            if (recentJobs.Count < 5)
            {
                recentJobs.Add(
                    new ScrapeHistoryJobDto(
                        job.JobId,
                        status,
                        job.CreatedAt,
                        job.StartedAt,
                        job.FinishedAt,
                        resultCount,
                        importedCount
                    )
                );
            }
        }

        return Ok(
            new ScrapeHistorySummaryDto(
                totalJobs,
                completedJobs,
                failedJobs,
                runningJobs,
                queuedJobs,
                lastScrapedAt,
                lastSuccessfulScrapedAt,
                lastSuccessfulResultCount,
                lastSuccessfulImportedCount,
                totalResultsFound,
                totalImportedJobs,
                recentJobs
            )
        );
    }

    [HttpGet("{jobId}/jobs.json")]
    public async Task<IActionResult> DownloadJson(
        [FromRoute] string jobId,
        CancellationToken cancellationToken
    )
    {
        var job = await dbContext.ScrapeJobs.FindAsync([jobId], cancellationToken);
        if (job is null)
        {
            return NotFound();
        }

        if (!CanAccessJob(job))
        {
            return NotFound();
        }

        if (!CanDownload(job))
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(job.JsonOutputPath) || !System.IO.File.Exists(job.JsonOutputPath))
        {
            return NotFound();
        }

        var json = await System.IO.File.ReadAllBytesAsync(job.JsonOutputPath, cancellationToken);
        return File(json, "application/json", "jobs.json");
    }

    [HttpGet("{jobId}/jobs.md")]
    public async Task<IActionResult> DownloadMarkdown(
        [FromRoute] string jobId,
        CancellationToken cancellationToken
    )
    {
        var job = await dbContext.ScrapeJobs.FindAsync([jobId], cancellationToken);
        if (job is null)
        {
            return NotFound();
        }

        if (!CanAccessJob(job))
        {
            return NotFound();
        }

        if (!CanDownload(job))
        {
            return NotFound();
        }

        if (
            string.IsNullOrWhiteSpace(job.MarkdownOutputPath)
            || !System.IO.File.Exists(job.MarkdownOutputPath)
        )
        {
            return NotFound();
        }

        var markdown = await System.IO.File.ReadAllBytesAsync(job.MarkdownOutputPath, cancellationToken);
        return File(markdown, "text/markdown", "jobs.md");
    }

    private static bool TryValidateSourceUrl(
        string? rawUrl,
        out string normalizedUrl,
        out string? error
    )
    {
        normalizedUrl = string.Empty;
        error = null;

        if (string.IsNullOrWhiteSpace(rawUrl))
        {
            error = "HiringCafe URL is required.";
            return false;
        }

        if (!Uri.TryCreate(rawUrl.Trim(), UriKind.Absolute, out var uri))
        {
            error = "HiringCafe URL must be a valid absolute URL.";
            return false;
        }

        if (!uri.Host.Equals(HiringCafeHost, StringComparison.OrdinalIgnoreCase))
        {
            error = "Only hiring.cafe URLs are allowed.";
            return false;
        }

        var searchState = uri.Query.TrimStart('?');
        if (string.IsNullOrWhiteSpace(searchState))
        {
            error = "HiringCafe URL must include searchState.";
            return false;
        }

        var hasSearchState = searchState
            .Split('&', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Any(part => part.StartsWith("searchState=", StringComparison.OrdinalIgnoreCase));

        if (!hasSearchState)
        {
            error = "HiringCafe URL must include searchState.";
            return false;
        }

        normalizedUrl = uri.ToString();
        return true;
    }

    private static string CreateJobId()
    {
        var shortId = Guid.NewGuid().ToString("N")[..8];
        return $"job_{DateTimeOffset.UtcNow:yyyyMMddHHmmss}_{shortId}";
    }

    private string GetProfileDirectory(string? userId)
    {
        var profileOwner = string.IsNullOrWhiteSpace(userId) ? "default" : userId;
        var safeProfileOwner = string.Concat(
            profileOwner.Select(character =>
                char.IsLetterOrDigit(character) || character is '-' or '_'
                    ? character
                    : '_'
            )
        );

        return Path.Combine(
            RequiredConfiguration.GetScraperProfilesDirectory(configuration),
            safeProfileOwner
        );
    }

    private bool CanAccessJob(ScrapeJob job)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        return string.IsNullOrWhiteSpace(job.UserId)
            || (!string.IsNullOrWhiteSpace(userId) && job.UserId == userId);
    }

    private void StartVisibleVerificationBrowser(ScrapeJob job)
    {
        StopVisibleVerificationBrowser(job);
        Directory.CreateDirectory(job.ProfileDirectory);
        Directory.CreateDirectory(job.RunDirectory);
        var removedProfileLocks = ChromiumProfileLocks.ClearStaleLocks(job.ProfileDirectory);
        if (removedProfileLocks.Count > 0)
        {
            logger.LogInformation(
                "Cleared {Count} stale Chromium profile locks before verification for scrape job {JobId}.",
                removedProfileLocks.Count,
                job.JobId
            );
        }

        var browserBinary =
            Environment.GetEnvironmentVariable("CAFE_SCOUT_BROWSER_BINARY")
            ?? "/usr/bin/chromium-browser";
        var display = Environment.GetEnvironmentVariable("DISPLAY");

        if (string.IsNullOrWhiteSpace(display))
        {
            display = ":99";
        }

        try
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = browserBinary,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

            startInfo.Environment["DISPLAY"] = display;
            startInfo.ArgumentList.Add("--user-data-dir=" + job.ProfileDirectory);
            startInfo.ArgumentList.Add("--no-sandbox");
            startInfo.ArgumentList.Add("--disable-dev-shm-usage");
            startInfo.ArgumentList.Add("--window-size=1920,1080");
            startInfo.ArgumentList.Add(job.SourceUrl);

            var process = Process.Start(startInfo);
            if (process is not null)
            {
                System.IO.File.WriteAllText(
                    GetVerificationBrowserPidPath(job),
                    process.Id.ToString(CultureInfo.InvariantCulture)
                );
            }
        }
        catch (Exception exception) when (
            exception is InvalidOperationException
            or System.ComponentModel.Win32Exception
            or IOException
            or UnauthorizedAccessException
        )
        {
            logger.LogWarning(
                exception,
                "Failed to start visible verification browser for scrape job {JobId}.",
                job.JobId
            );
        }
    }

    private void StopVisibleVerificationBrowser(ScrapeJob job)
    {
        var pidPath = GetVerificationBrowserPidPath(job);
        if (!System.IO.File.Exists(pidPath))
        {
            return;
        }

        try
        {
            var rawPid = System.IO.File.ReadAllText(pidPath);
            if (
                int.TryParse(rawPid, NumberStyles.Integer, CultureInfo.InvariantCulture, out var pid)
                && pid > 0
            )
            {
                using var process = Process.GetProcessById(pid);
                if (!process.HasExited)
                {
                    process.Kill(entireProcessTree: true);
                }
            }
        }
        catch (Exception exception) when (
            exception is ArgumentException
            or InvalidOperationException
            or System.ComponentModel.Win32Exception
            or IOException
            or UnauthorizedAccessException
        )
        {
            logger.LogDebug(
                exception,
                "Could not stop visible verification browser for scrape job {JobId}.",
                job.JobId
            );
        }
        finally
        {
            try
            {
                System.IO.File.Delete(pidPath);
            }
            catch (IOException)
            {
                // The next verification attempt can overwrite or ignore this stale pid file.
            }
            catch (UnauthorizedAccessException)
            {
                // The next verification attempt can overwrite or ignore this stale pid file.
            }
        }
    }

    private static string GetVerificationBrowserPidPath(ScrapeJob job) =>
        Path.Combine(job.RunDirectory, "verification-browser.pid");

    private async Task<ScrapeJobStatusDto> ToStatusDtoAsync(
        ScrapeJob job,
        CancellationToken cancellationToken
    )
    {
        var isDone = job.Status.Equals("done", StringComparison.OrdinalIgnoreCase);
        var needsVerification =
            job.Status.Equals("needs_verification", StringComparison.OrdinalIgnoreCase)
            || job.Status.Equals("verifying", StringComparison.OrdinalIgnoreCase);
        var progress = await TryReadProgressAsync(job, cancellationToken);
        var resultCount = isDone
            ? await TryReadResultCountAsync(job, cancellationToken)
            : null;

        return new ScrapeJobStatusDto(
            job.JobId,
            job.Status,
            job.Message,
            needsVerification ? job.VerificationUrl : null,
            isDone ? $"/api/scrape/{job.JobId}/jobs.json" : null,
            isDone ? $"/api/scrape/{job.JobId}/jobs.md" : null,
            job.Error,
            resultCount,
            progress
        );
    }

    private async Task<ScrapeProgressDto?> TryReadProgressAsync(
        ScrapeJob job,
        CancellationToken cancellationToken
    )
    {
        var progressPath = Path.Combine(job.RunDirectory, ProgressFileName);

        if (!System.IO.File.Exists(progressPath))
        {
            return null;
        }

        try
        {
            var json = await System.IO.File.ReadAllTextAsync(progressPath, cancellationToken);
            if (string.IsNullOrWhiteSpace(json))
            {
                return null;
            }

            var progress = JsonSerializer.Deserialize<ScrapeProgressFileDto>(
                json,
                ProgressJsonOptions
            );

            if (progress is null)
            {
                return null;
            }

            return new ScrapeProgressDto(
                progress.Status,
                progress.PagesScraped,
                progress.VisibleJobsScraped,
                progress.MatchedJobs,
                progress.EstimatedTotalJobs,
                progress.TotalIsEstimate,
                ClampProgressPercent(progress.ProgressPercent),
                progress.CurrentPageListings,
                progress.CurrentPageMatched,
                progress.SkippedSeen,
                progress.Message
            );
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

    private static double? ClampProgressPercent(double? value)
    {
        if (value is null)
        {
            return null;
        }

        return Math.Max(0, Math.Min(100, value.Value));
    }

    private async Task<int?> TryReadResultCountAsync(
        ScrapeJob job,
        CancellationToken cancellationToken
    )
    {
        if (string.IsNullOrWhiteSpace(job.JsonOutputPath) || !System.IO.File.Exists(job.JsonOutputPath))
        {
            return null;
        }

        try
        {
            await using var stream = System.IO.File.OpenRead(job.JsonOutputPath);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

            if (
                document.RootElement.ValueKind == JsonValueKind.Object
                && document.RootElement.TryGetProperty("results", out var resultsElement)
                && resultsElement.ValueKind == JsonValueKind.Array
            )
            {
                return resultsElement.GetArrayLength();
            }
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

        return null;
    }

    private static int? TryReadImportedCount(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return null;
        }

        if (
            message.Contains(
                "No new Scout jobs were added",
                StringComparison.OrdinalIgnoreCase
            )
        )
        {
            return 0;
        }

        var match = Regex.Match(
            message,
            @"Imported\s+(?<count>\d+)\s+new jobs",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant
        );

        if (!match.Success)
        {
            return null;
        }

        return int.TryParse(
            match.Groups["count"].Value,
            NumberStyles.Integer,
            CultureInfo.InvariantCulture,
            out var importedCount
        )
            ? importedCount
            : null;
    }

    private static ScrapePresetDto ToPresetDto(ScrapePreset preset) =>
        new(preset.Id, preset.Name, preset.SourceUrl, preset.CreatedAt);

    private static bool CanDownload(ScrapeJob job) =>
        job.Status.Equals("done", StringComparison.OrdinalIgnoreCase);

    private static DateTime GetScrapedAt(ScrapeJob job) =>
        job.FinishedAt ?? job.StartedAt ?? (DateTime?)job.UpdatedAt ?? job.CreatedAt;
}
