using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using System.Text;
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
[Route("api/scout")]
public class ScoutJobsController(AppDbContext dbContext) : ControllerBase
{
    [HttpPatch("jobs/{id:guid}")]
    public async Task<ActionResult<ScoutJob>> UpdateState(
        [FromRoute] Guid id,
        [FromBody] ScoutJobStateUpdateDto scoutJobState,
        CancellationToken cancellationToken
    )
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var job = await dbContext.ScoutJobs.FirstOrDefaultAsync(
            current => current.Id == id && current.UserId == userId,
            cancellationToken
        );
        if (job is null)
        {
            return NotFound();
        }

        job.SavedForApply = scoutJobState.SavedForApply;
        job.IsDiscarded = scoutJobState.IsDiscarded;

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(job);
    }

    [HttpPost("jobs")]
    public async Task<ActionResult<ScoutJob>> Create(
        [FromBody] ScoutJobCreateDto scoutJob,
        CancellationToken cancellationToken
    )
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(scoutJob.Title) || string.IsNullOrWhiteSpace(scoutJob.Company))
        {
            return BadRequest("Title and company are required.");
        }

        var (normalizedJobUrl, normalizedApplyUrl) = ScoutJobLinkNormalizer.Normalize(
            scoutJob.JobUrl,
            scoutJob.ApplyUrl
        );
        if (
            normalizedJobUrl is not null
            && await dbContext.ScoutJobs.AnyAsync(
                job => job.UserId == userId && job.JobUrl == normalizedJobUrl,
                cancellationToken
            )
        )
        {
            return Conflict("A scout job with the same job URL already exists.");
        }

        var entity = new ScoutJob
        {
            Title = scoutJob.Title.Trim(),
            Company = scoutJob.Company.Trim(),
            Location = TrimToNull(scoutJob.Location),
            WorkplaceType = TrimToNull(scoutJob.WorkplaceType),
            Commitment = TrimToNull(scoutJob.Commitment),
            PostedAt = scoutJob.PostedAt,
            JobUrl = normalizedJobUrl,
            ApplyUrl = normalizedApplyUrl,
            TechnicalTools = TrimToNull(scoutJob.TechnicalTools),
            RequirementsSummary = TrimToNull(scoutJob.RequirementsSummary),
            SavedForApply = false,
            IsDiscarded = false,
            UserId = userId,
        };

        dbContext.ScoutJobs.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(entity);
    }

    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<ScoutUploadResultDto>> Upload(
        [FromForm] IFormFile? file,
        CancellationToken cancellationToken
    )
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        if (file is null || file.Length == 0)
        {
            return BadRequest("Upload a non-empty jobs.json file.");
        }

        ScoutUploadParseResult parsed;
        await using (var stream = file.OpenReadStream())
        {
            try
            {
                parsed = await ScoutJobUploadParser.ParseAsync(stream, cancellationToken);
            }
            catch (JsonException)
            {
                return BadRequest("Upload must be a hiring-cafe-scout JSON file with a results array.");
            }
        }

        var existingJobUrls = new HashSet<string>(
            await dbContext
                .ScoutJobs.Where(job => job.UserId == userId && job.JobUrl != null)
                .Select(job => job.JobUrl!)
                .ToListAsync(cancellationToken),
            StringComparer.OrdinalIgnoreCase
        );
        var uploadJobUrls = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var jobsToImport = new List<ScoutJob>();
        var skipped = parsed.Skipped;

        foreach (var job in parsed.Jobs)
        {
            if (
                job.JobUrl is not null
                && (!uploadJobUrls.Add(job.JobUrl) || existingJobUrls.Contains(job.JobUrl))
            )
            {
                skipped++;
                continue;
            }

            job.UserId = userId;
            jobsToImport.Add(job);
        }

        dbContext.ScoutJobs.AddRange(jobsToImport);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ScoutUploadResultDto(jobsToImport.Count, skipped));
    }

    [HttpGet("jobs")]
    public async Task<ActionResult<List<ScoutJob>>> GetJobs(CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var jobs = await dbContext
            .ScoutJobs.Where(job => job.UserId == userId)
            .OrderBy(job => job.SourceOrder == null)
            .ThenBy(job => job.SourceOrder)
            .ThenBy(job => job.PostedAt == null)
            .ThenByDescending(job => job.PostedAt)
            .ThenByDescending(job => job.CreatedAt)
            .ToListAsync(cancellationToken);

        await NormalizeScoutJobLinksAsync(jobs, cancellationToken);

        return Ok(jobs);
    }

    [HttpGet("jobs/export")]
    public async Task<IActionResult> ExportJobs(
        [FromQuery] string format = "json",
        CancellationToken cancellationToken = default
    )
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var jobs = await dbContext
            .ScoutJobs.Where(job => job.UserId == userId)
            .OrderBy(job => job.SourceOrder == null)
            .ThenBy(job => job.SourceOrder)
            .ThenBy(job => job.PostedAt == null)
            .ThenByDescending(job => job.PostedAt)
            .ThenByDescending(job => job.CreatedAt)
            .ToListAsync(cancellationToken);

        await NormalizeScoutJobLinksAsync(jobs, cancellationToken);

        if (format.Equals("csv", StringComparison.OrdinalIgnoreCase))
        {
            var csv = BuildCsv(jobs);
            var csvBytes = new UTF8Encoding(encoderShouldEmitUTF8Identifier: true).GetBytes(csv);
            return File(csvBytes, "text/csv", "jobs.csv");
        }

        if (
            !format.Equals("json", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(format)
        )
        {
            return BadRequest("Export format must be json or csv.");
        }

        var payload = new
        {
            results = jobs.Select(job => new
            {
                job.Id,
                job.Title,
                job.Company,
                LocationDisplay = job.Location,
                job.WorkplaceType,
                job.Commitment,
                PostedAt = job.PostedAt?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                JobUrl = job.JobUrl,
                ApplyUrl = job.ApplyUrl,
                TechnicalTools = job.TechnicalTools,
                RequirementsSummary = job.RequirementsSummary,
                job.SavedForApply,
                job.IsDiscarded,
                CreatedAt = job.CreatedAt,
            }),
        };

        var json = JsonSerializer.SerializeToUtf8Bytes(
            payload,
            new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
                WriteIndented = true,
            }
        );

        return File(json, "application/json", "jobs.json");
    }

    [HttpDelete("jobs/{id:guid}")]
    public async Task<IActionResult> Delete([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var job = await dbContext.ScoutJobs.FirstOrDefaultAsync(
            current => current.Id == id && current.UserId == userId,
            cancellationToken
        );
        if (job is null)
        {
            return NotFound();
        }

        dbContext.ScoutJobs.Remove(job);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("jobs")]
    public async Task<IActionResult> DeleteAll(CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        await dbContext
            .ScoutJobs.Where(job => job.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
        return NoContent();
    }

    private string? GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);

    private static string? TrimToNull(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    private async Task NormalizeScoutJobLinksAsync(
        IEnumerable<ScoutJob> jobs,
        CancellationToken cancellationToken
    )
    {
        var changed = false;
        foreach (var job in jobs)
        {
            changed |= ScoutJobLinkNormalizer.Normalize(job);
        }

        if (changed)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private static string BuildCsv(IEnumerable<ScoutJob> jobs)
    {
        var rows = new List<string>
        {
            string.Join(
                ",",
                [
                    "id",
                    "title",
                    "company",
                    "location_display",
                    "workplace_type",
                    "commitment",
                    "posted_at",
                    "job_url",
                    "apply_url",
                    "source_order",
                    "technical_tools",
                    "requirements_summary",
                    "saved_for_apply",
                    "is_discarded",
                    "created_at",
                ]
            ),
        };

        rows.AddRange(
            jobs.Select(job =>
                string.Join(
                    ",",
                    [
                        CsvEscape(job.Id.ToString()),
                        CsvEscape(job.Title),
                        CsvEscape(job.Company),
                        CsvEscape(job.Location),
                        CsvEscape(job.WorkplaceType),
                        CsvEscape(job.Commitment),
                        CsvEscape(job.PostedAt?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)),
                        CsvEscape(job.JobUrl),
                        CsvEscape(job.ApplyUrl),
                        CsvEscape(job.SourceOrder?.ToString(CultureInfo.InvariantCulture)),
                        CsvEscape(job.TechnicalTools),
                        CsvEscape(job.RequirementsSummary),
                        CsvEscape(job.SavedForApply ? "true" : "false"),
                        CsvEscape(job.IsDiscarded ? "true" : "false"),
                        CsvEscape(job.CreatedAt.ToString("O", CultureInfo.InvariantCulture)),
                    ]
                )
            )
        );

        return string.Join(Environment.NewLine, rows);
    }

    private static string CsvEscape(string? value)
    {
        var safeValue = value ?? string.Empty;
        var escaped = safeValue.Replace("\"", "\"\"");
        return $"\"{escaped}\"";
    }
}
