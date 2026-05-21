using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace api.Dto;

// Record primary-constructor validation must stay on the constructor parameter or ASP.NET will reject the metadata at runtime.
public record ScrapeJobCreateDto(
    [Required] string Url,
    bool IncludeSeen = false
);

public record ScrapeProgressDto(
    string? Status,
    int? PagesScraped,
    int? VisibleJobsScraped,
    int? MatchedJobs,
    int? EstimatedTotalJobs,
    bool? TotalIsEstimate,
    double? ProgressPercent,
    int? CurrentPageListings,
    int? CurrentPageMatched,
    int? SkippedSeen,
    string? Message
);

internal sealed record ScrapeProgressFileDto(
    [property: JsonPropertyName("status")] string? Status,
    [property: JsonPropertyName("pages_scraped")] int? PagesScraped,
    [property: JsonPropertyName("visible_jobs_scraped")] int? VisibleJobsScraped,
    [property: JsonPropertyName("matched_jobs")] int? MatchedJobs,
    [property: JsonPropertyName("estimated_total_jobs")] int? EstimatedTotalJobs,
    [property: JsonPropertyName("total_is_estimate")] bool? TotalIsEstimate,
    [property: JsonPropertyName("progress_percent")] double? ProgressPercent,
    [property: JsonPropertyName("current_page_listings")] int? CurrentPageListings,
    [property: JsonPropertyName("current_page_matched")] int? CurrentPageMatched,
    [property: JsonPropertyName("skipped_seen")] int? SkippedSeen,
    [property: JsonPropertyName("message")] string? Message
);

public record ScrapeJobStatusDto(
    string JobId,
    string Status,
    string? Message,
    string? VerificationUrl,
    string? JsonUrl,
    string? MarkdownUrl,
    string? Error,
    int? ResultCount,
    ScrapeProgressDto? Progress
);
