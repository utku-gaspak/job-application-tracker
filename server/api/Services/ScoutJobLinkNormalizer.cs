using api.Models;

namespace api.Services;

public static class ScoutJobLinkNormalizer
{
    public static bool Normalize(ScoutJob job)
    {
        var (jobUrl, applyUrl) = Normalize(job.JobUrl, job.ApplyUrl);
        var changed = !string.Equals(job.JobUrl, jobUrl, StringComparison.Ordinal)
            || !string.Equals(job.ApplyUrl, applyUrl, StringComparison.Ordinal);

        job.JobUrl = jobUrl;
        job.ApplyUrl = applyUrl;

        return changed;
    }

    public static (string? JobUrl, string? ApplyUrl) Normalize(string? jobUrl, string? applyUrl)
    {
        jobUrl = TrimToNull(jobUrl);
        applyUrl = TrimToNull(applyUrl);

        var jobUrlIsHiringCafe = IsHiringCafeUrl(jobUrl);
        var applyUrlIsHiringCafe = IsHiringCafeUrl(applyUrl);

        if (applyUrlIsHiringCafe && !jobUrlIsHiringCafe)
        {
            return (applyUrl, jobUrl);
        }

        if (applyUrl is not null && applyUrlIsHiringCafe && jobUrl is null)
        {
            return (applyUrl, null);
        }

        return (jobUrl, applyUrl);
    }

    private static bool IsHiringCafeUrl(string? value)
    {
        if (
            string.IsNullOrWhiteSpace(value)
            || !Uri.TryCreate(value, UriKind.Absolute, out var uri)
        )
        {
            return false;
        }

        return uri.Host.Equals("hiring.cafe", StringComparison.OrdinalIgnoreCase)
            || uri.Host.EndsWith(".hiring.cafe", StringComparison.OrdinalIgnoreCase);
    }

    private static string? TrimToNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
