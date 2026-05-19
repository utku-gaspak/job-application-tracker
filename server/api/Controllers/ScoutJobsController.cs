using System.Text.Json;
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
    [HttpPost("jobs")]
    public async Task<ActionResult<ScoutJob>> Create(
        [FromBody] ScoutJobCreateDto scoutJob,
        CancellationToken cancellationToken
    )
    {
        if (string.IsNullOrWhiteSpace(scoutJob.Title) || string.IsNullOrWhiteSpace(scoutJob.Company))
        {
            return BadRequest("Title and company are required.");
        }

        var normalizedJobUrl = string.IsNullOrWhiteSpace(scoutJob.JobUrl)
            ? null
            : scoutJob.JobUrl.Trim();
        if (
            normalizedJobUrl is not null
            && await dbContext.ScoutJobs.AnyAsync(
                job => job.JobUrl == normalizedJobUrl,
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
            ApplyUrl = TrimToNull(scoutJob.ApplyUrl),
            TechnicalTools = TrimToNull(scoutJob.TechnicalTools),
            RequirementsSummary = TrimToNull(scoutJob.RequirementsSummary),
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
                .ScoutJobs.Where(job => job.JobUrl != null)
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

            jobsToImport.Add(job);
        }

        dbContext.ScoutJobs.AddRange(jobsToImport);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ScoutUploadResultDto(jobsToImport.Count, skipped));
    }

    [HttpGet("jobs")]
    public async Task<ActionResult<List<ScoutJob>>> GetJobs(CancellationToken cancellationToken)
    {
        var jobs = await dbContext
            .ScoutJobs.OrderBy(job => job.PostedAt == null)
            .ThenByDescending(job => job.PostedAt)
            .ThenByDescending(job => job.CreatedAt)
            .ToListAsync(cancellationToken);

        return Ok(jobs);
    }

    [HttpDelete("jobs/{id:guid}")]
    public async Task<IActionResult> Delete([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        var job = await dbContext.ScoutJobs.FindAsync([id], cancellationToken);
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
        await dbContext.ScoutJobs.ExecuteDeleteAsync(cancellationToken);
        return NoContent();
    }

    private static string? TrimToNull(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }
}
