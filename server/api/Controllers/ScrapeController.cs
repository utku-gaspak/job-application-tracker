using System.Globalization;
using System.Text.Json;
using api;
using api.Data;
using api.Dto;
using api.Models;
using api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers;

[ApiController]
[Authorize]
[Route("api/scrape")]
public class ScrapeController(
    AppDbContext dbContext,
    IScrapeJobQueue scrapeJobQueue,
    IConfiguration configuration
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

        var jobId = CreateJobId();
        var runDirectory = Path.Combine(
            RequiredConfiguration.GetScraperRunsDirectory(configuration),
            jobId
        );
        var profileDirectory = Path.Combine(
            RequiredConfiguration.GetScraperProfilesDirectory(configuration),
            jobId
        );

        var entity = new ScrapeJob
        {
            JobId = jobId,
            SourceUrl = normalizedUrl,
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

        if (!job.Status.Equals("needs_verification", StringComparison.OrdinalIgnoreCase))
        {
            return Conflict("Verification can only be completed for a job that needs verification.");
        }

        job.Status = "queued";
        job.Message = "Verification completed. Scrape job re-queued.";
        job.Error = null;
        job.UpdatedAt = DateTime.UtcNow;
        job.FinishedAt = null;

        await dbContext.SaveChangesAsync(cancellationToken);
        await scrapeJobQueue.QueueAsync(job.JobId, cancellationToken);

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

        return Ok(await ToStatusDtoAsync(job, cancellationToken));
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

    private async Task<ScrapeJobStatusDto> ToStatusDtoAsync(
        ScrapeJob job,
        CancellationToken cancellationToken
    )
    {
        var isDone = job.Status.Equals("done", StringComparison.OrdinalIgnoreCase);
        var needsVerification = job.Status.Equals("needs_verification", StringComparison.OrdinalIgnoreCase);
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

    private static bool CanDownload(ScrapeJob job) =>
        job.Status.Equals("done", StringComparison.OrdinalIgnoreCase);
}
