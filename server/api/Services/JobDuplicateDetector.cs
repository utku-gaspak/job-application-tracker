using System.Text.RegularExpressions;
using api.Data;
using api.Dto;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Services;

public sealed class JobDuplicateDetector(AppDbContext dbContext)
{
    public const string DuplicateMessage = "This job already exists in Scout or Tracker.";

    private static readonly Regex WhitespaceRegex = new(@"\s+", RegexOptions.Compiled);

    public async Task<JobDuplicateSnapshot> CreateSnapshotAsync(
        string? userId,
        CancellationToken cancellationToken)
    {
        var scoutJobs = await dbContext.ScoutJobs
            .Where(job => job.UserId == userId)
            .Select(job => new JobDuplicateCandidate(
                job.Title,
                job.Company,
                job.Location,
                job.JobUrl,
                job.ApplyUrl))
            .ToListAsync(cancellationToken);

        var applications = await dbContext.JobApplications
            .Where(application => application.UserId == userId)
            .Select(application => new JobDuplicateCandidate(
                application.Position,
                application.CompanyName,
                application.Location,
                application.JobUrl,
                null))
            .ToListAsync(cancellationToken);

        var snapshot = new JobDuplicateSnapshot();

        foreach (var candidate in scoutJobs.Concat(applications))
            snapshot.Add(candidate);

        return snapshot;
    }

    public async Task<bool> IsDuplicateScoutJobAsync(
        ScoutJob job,
        string userId,
        CancellationToken cancellationToken)
    {
        var snapshot = await CreateSnapshotAsync(userId, cancellationToken);
        return snapshot.Contains(ToCandidate(job));
    }

    public async Task<bool> IsDuplicateScoutJobAsync(
        ScoutJobCreateDto dto,
        string userId,
        CancellationToken cancellationToken)
    {
        var snapshot = await CreateSnapshotAsync(userId, cancellationToken);
        return snapshot.Contains(new JobDuplicateCandidate(
            dto.Title,
            dto.Company,
            dto.Location,
            dto.JobUrl,
            dto.ApplyUrl));
    }

    public async Task<bool> IsDuplicateApplicationAsync(
        JobApplicationCreateDto dto,
        string userId,
        CancellationToken cancellationToken)
    {
        var snapshot = await CreateSnapshotAsync(userId, cancellationToken);
        return snapshot.Contains(new JobDuplicateCandidate(
            dto.Position,
            dto.CompanyName,
            dto.Location,
            dto.JobUrl,
            null));
    }

    public static JobDuplicateCandidate ToCandidate(ScoutJob job) =>
        new(job.Title, job.Company, job.Location, job.JobUrl, job.ApplyUrl);

    public static string? NormalizeUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var withoutFragment = RemoveFragment(value.Trim());

        if (Uri.TryCreate(withoutFragment, UriKind.Absolute, out var uri) && !string.IsNullOrWhiteSpace(uri.Host))
        {
            var builder = new UriBuilder(uri)
            {
                Scheme = uri.Scheme.ToLowerInvariant(),
                Host = uri.Host.ToLowerInvariant(),
                Fragment = string.Empty,
            };

            return TrimTrailingSlash(builder.Uri.ToString());
        }

        return TrimTrailingSlash(withoutFragment);
    }

    internal static string? BuildTextKey(string? title, string? company, string? location)
    {
        var normalizedTitle = NormalizeTextPart(title);
        var normalizedCompany = NormalizeTextPart(company);

        if (normalizedTitle is null || normalizedCompany is null)
            return null;

        var normalizedLocation = NormalizeTextPart(location) ?? string.Empty;
        return $"{normalizedTitle}|{normalizedCompany}|{normalizedLocation}";
    }

    private static string? NormalizeTextPart(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        return WhitespaceRegex.Replace(value.Trim(), " ").ToLowerInvariant();
    }

    private static string RemoveFragment(string value)
    {
        var fragmentIndex = value.IndexOf('#', StringComparison.Ordinal);
        return fragmentIndex >= 0 ? value[..fragmentIndex] : value;
    }

    private static string TrimTrailingSlash(string value)
    {
        if (value.EndsWith("/", StringComparison.Ordinal) && !IsUriRoot(value))
            return value.TrimEnd('/');

        return value;
    }

    private static bool IsUriRoot(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && uri.AbsolutePath == "/";
}

public sealed record JobDuplicateCandidate(
    string? Title,
    string? Company,
    string? Location,
    string? JobUrl,
    string? ApplyUrl);

public sealed class JobDuplicateSnapshot
{
    private readonly HashSet<string> urls = new(StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<string> textKeys = new(StringComparer.Ordinal);

    public bool Contains(JobDuplicateCandidate candidate)
    {
        var candidateUrls = GetNormalizedUrls(candidate).ToList();
        if (candidateUrls.Count > 0)
            return candidateUrls.Any(urls.Contains);

        var textKey = JobDuplicateDetector.BuildTextKey(
            candidate.Title,
            candidate.Company,
            candidate.Location);

        return textKey is not null && textKeys.Contains(textKey);
    }

    public void Add(JobDuplicateCandidate candidate)
    {
        foreach (var url in GetNormalizedUrls(candidate))
            urls.Add(url);

        var textKey = JobDuplicateDetector.BuildTextKey(
            candidate.Title,
            candidate.Company,
            candidate.Location);

        if (textKey is not null)
            textKeys.Add(textKey);
    }

    private static IEnumerable<string> GetNormalizedUrls(JobDuplicateCandidate candidate)
    {
        var jobUrl = JobDuplicateDetector.NormalizeUrl(candidate.JobUrl);
        if (jobUrl is not null)
            yield return jobUrl;

        var applyUrl = JobDuplicateDetector.NormalizeUrl(candidate.ApplyUrl);
        if (applyUrl is not null)
            yield return applyUrl;
    }
}
