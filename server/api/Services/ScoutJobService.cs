using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text;
using System.Text.Json;
using api.Data;
using api.Dto;
using api.Exceptions;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Services;

public class ScoutJobService(AppDbContext dbContext) : IScoutJobService
{
    public async Task<List<ScoutJob>> GetJobsAsync(
        string userId,
        CancellationToken cancellationToken)
    {
        var jobs = await QueryJobs(userId)
            .ToListAsync(cancellationToken);

        await NormalizeLinksAsync(jobs, cancellationToken);

        return jobs;
    }

    public async Task<ScoutJob> UpdateStateAsync(
        Guid id,
        ScoutJobStateUpdateDto dto,
        string userId,
        CancellationToken cancellationToken)
    {
        var job = await dbContext.ScoutJobs.FirstOrDefaultAsync(
            j => j.Id == id && j.UserId == userId,
            cancellationToken)
            ?? throw new NotFoundException("Scout job not found.");

        job.SavedForApply = dto.SavedForApply;
        job.IsDiscarded = dto.IsDiscarded;

        await dbContext.SaveChangesAsync(cancellationToken);
        return job;
    }

    public async Task<ScoutJob> CreateAsync(
        ScoutJobCreateDto dto,
        string userId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Company))
            throw new ValidationException("Title and company are required.");

        var (normalizedJobUrl, normalizedApplyUrl) = ScoutJobLinkNormalizer.Normalize(
            dto.JobUrl, dto.ApplyUrl);

        if (normalizedJobUrl is not null
            && await dbContext.ScoutJobs.AnyAsync(
                j => j.UserId == userId && j.JobUrl == normalizedJobUrl,
                cancellationToken))
            throw new ValidationException("A scout job with the same job URL already exists.");

        var entity = new ScoutJob
        {
            Title = dto.Title.Trim(),
            Company = dto.Company.Trim(),
            Location = NormalizeOptionalText(dto.Location),
            WorkplaceType = NormalizeOptionalText(dto.WorkplaceType),
            Commitment = NormalizeOptionalText(dto.Commitment),
            PostedAt = dto.PostedAt,
            JobUrl = normalizedJobUrl,
            ApplyUrl = normalizedApplyUrl,
            TechnicalTools = NormalizeOptionalText(dto.TechnicalTools),
            RequirementsSummary = NormalizeOptionalText(dto.RequirementsSummary),
            SavedForApply = false,
            IsDiscarded = false,
            UserId = userId,
        };

        dbContext.ScoutJobs.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);

        return entity;
    }

    public async Task<ScoutUploadResultDto> UploadAsync(
        Stream fileStream,
        string userId,
        CancellationToken cancellationToken)
    {
        ScoutUploadParseResult parsed;
        try
        {
            parsed = await ScoutJobUploadParser.ParseAsync(fileStream, cancellationToken);
        }
        catch (JsonException)
        {
            throw new ValidationException("Upload must be a hiring-cafe-scout JSON file with a results array.");
        }

        var existingJobUrls = new HashSet<string>(
            await dbContext
                .ScoutJobs.Where(j => j.UserId == userId && j.JobUrl != null)
                .Select(j => j.JobUrl!)
                .ToListAsync(cancellationToken),
            StringComparer.OrdinalIgnoreCase);

        var uploadJobUrls = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var jobsToImport = new List<ScoutJob>();
        var skipped = parsed.Skipped;

        foreach (var job in parsed.Jobs)
        {
            if (job.JobUrl is not null
                && (!uploadJobUrls.Add(job.JobUrl) || existingJobUrls.Contains(job.JobUrl)))
            {
                skipped++;
                continue;
            }

            job.UserId = userId;
            jobsToImport.Add(job);
        }

        dbContext.ScoutJobs.AddRange(jobsToImport);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new ScoutUploadResultDto(jobsToImport.Count, skipped);
    }

    public async Task DeleteAsync(
        Guid id,
        string userId,
        CancellationToken cancellationToken)
    {
        var job = await dbContext.ScoutJobs.FirstOrDefaultAsync(
            j => j.Id == id && j.UserId == userId,
            cancellationToken)
            ?? throw new NotFoundException("Scout job not found.");

        dbContext.ScoutJobs.Remove(job);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAllAsync(
        string userId,
        CancellationToken cancellationToken)
    {
        await dbContext.ScoutJobs
            .Where(j => j.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
    }

    public async Task<(byte[] Content, string ContentType, string FileName)> ExportJobsAsync(
        string userId,
        string format,
        CancellationToken cancellationToken)
    {
        var jobs = await QueryJobs(userId).ToListAsync(cancellationToken);
        await NormalizeLinksAsync(jobs, cancellationToken);

        if (format.Equals("csv", StringComparison.OrdinalIgnoreCase))
        {
            var csv = BuildCsv(jobs);
            var csvBytes = new UTF8Encoding(encoderShouldEmitUTF8Identifier: true).GetBytes(csv);
            return (csvBytes, "text/csv", "jobs.csv");
        }

        if (!format.Equals("json", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(format))
            throw new ValidationException("Export format must be json or csv.");

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
            });

        return (json, "application/json", "jobs.json");
    }

    public async Task NormalizeLinksAsync(
        IEnumerable<ScoutJob> jobs,
        CancellationToken cancellationToken)
    {
        var changed = false;
        foreach (var job in jobs)
            changed |= ScoutJobLinkNormalizer.Normalize(job);

        if (changed)
            await dbContext.SaveChangesAsync(cancellationToken);
    }

    private IOrderedQueryable<ScoutJob> QueryJobs(string userId) =>
        dbContext.ScoutJobs
            .Where(j => j.UserId == userId)
            .OrderBy(j => j.SourceOrder == null)
            .ThenBy(j => j.SourceOrder)
            .ThenBy(j => j.PostedAt == null)
            .ThenByDescending(j => j.PostedAt)
            .ThenByDescending(j => j.CreatedAt);

    private static string BuildCsv(IEnumerable<ScoutJob> jobs)
    {
        var rows = new List<string>
        {
            string.Join(",",
            [
                "id", "title", "company", "location_display", "workplace_type",
                "commitment", "posted_at", "job_url", "apply_url", "source_order",
                "technical_tools", "requirements_summary", "saved_for_apply",
                "is_discarded", "created_at",
            ]),
        };

        rows.AddRange(jobs.Select(job =>
            string.Join(",",
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
            ])));

        return string.Join(Environment.NewLine, rows);
    }

    private static string CsvEscape(string? value)
    {
        var safeValue = value ?? string.Empty;
        var escaped = safeValue.Replace("\"", "\"\"");
        return $"\"{escaped}\"";
    }

    private static string? NormalizeOptionalText(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }
}
