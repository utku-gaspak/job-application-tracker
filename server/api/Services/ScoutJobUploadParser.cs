using System.Globalization;
using System.Text.Json;
using api.Dto;
using api.Models;

namespace api.Services;

public static class ScoutJobUploadParser
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public static async Task<ScoutUploadParseResult> ParseAsync(
        Stream stream,
        CancellationToken cancellationToken
    )
    {
        using var document = await JsonDocument.ParseAsync(
            stream,
            cancellationToken: cancellationToken
        );

        var results = ResolveResults(document.RootElement);
        var jobs = new List<ScoutJob>();
        var skipped = 0;

        foreach (var item in results.EnumerateArray())
        {
            var title = NormalizeOptionalText(ReadString(item, "title"));
            var company = NormalizeOptionalText(ReadString(item, "company"));

            if (title is null || company is null)
            {
                skipped++;
                continue;
            }

            jobs.Add(new ScoutJob
            {
                Id = Guid.NewGuid(),
                Title = title,
                Company = company,
                Location = NormalizeOptionalText(ReadString(item, "location_display", "locationDisplay", "location")),
                WorkplaceType = NormalizeOptionalText(ReadString(item, "workplace_type", "workplaceType")),
                Commitment = NormalizeOptionalText(ReadString(item, "commitment")),
                PostedAt = ReadDate(item, "posted_at", "postedAt"),
                JobUrl = NormalizeOptionalText(ReadString(item, "job_url", "jobUrl")),
                ApplyUrl = NormalizeOptionalText(ReadString(item, "apply_url", "applyUrl")),
                TechnicalTools = NormalizeOptionalText(ReadStringOrArray(
                    item,
                    "technical_tools",
                    "technicalTools",
                    "technical_tools_display",
                    "tools"
                )),
                RequirementsSummary = NormalizeOptionalText(ReadStringOrArray(
                    item,
                    "requirements_summary",
                    "requirementsSummary",
                    "requirements",
                    "summary"
                )),
                SavedForApply = ReadBoolean(item, "saved_for_apply", "savedForApply") ?? false,
                IsDiscarded = ReadBoolean(item, "is_discarded", "isDiscarded") ?? false,
                CreatedAt = ReadDate(item, "created_at", "createdAt") ?? DateTime.UtcNow,
            });
        }

        return new ScoutUploadParseResult(jobs, skipped);
    }

    private static JsonElement ResolveResults(JsonElement root)
    {
        if (root.ValueKind == JsonValueKind.Array)
        {
            return root;
        }

        if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("results", out var results))
        {
            if (results.ValueKind != JsonValueKind.Array)
            {
                throw new JsonException("Scout upload results must be an array.");
            }

            return results;
        }

        throw new JsonException("Scout upload must contain a results array.");
    }

    private static string? ReadString(JsonElement item, params string[] propertyNames)
    {
        foreach (var propertyName in propertyNames)
        {
            if (item.TryGetProperty(propertyName, out var value))
            {
                if (value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
                {
                    return null;
                }

                return value.ValueKind == JsonValueKind.String
                    ? value.GetString()
                    : value.GetRawText();
            }
        }

        return null;
    }

    private static string? ReadStringOrArray(JsonElement item, params string[] propertyNames)
    {
        foreach (var propertyName in propertyNames)
        {
            if (!item.TryGetProperty(propertyName, out var value))
            {
                continue;
            }

            if (value.ValueKind == JsonValueKind.String)
            {
                return value.GetString();
            }

            if (value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            {
                return null;
            }

            if (value.ValueKind == JsonValueKind.Array)
            {
                var values = value
                    .EnumerateArray()
                    .Select(ReadJsonScalar)
                    .Where(text => !string.IsNullOrWhiteSpace(text));

                return string.Join(", ", values);
            }

            return JsonSerializer.Serialize(value, JsonOptions);
        }

        return null;
    }

    private static string? ReadJsonScalar(JsonElement value) =>
        value.ValueKind == JsonValueKind.Null || value.ValueKind == JsonValueKind.Undefined
            ? null
            : value.ValueKind == JsonValueKind.String
                ? value.GetString()
                : value.GetRawText();

    private static DateTime? ReadDate(JsonElement item, params string[] propertyNames)
    {
        var value = NormalizeOptionalText(ReadString(item, propertyNames));
        if (value is null)
        {
            return null;
        }

        if (DateTime.TryParseExact(
                value,
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                out var exactDate
            ))
        {
            return DateTime.SpecifyKind(exactDate, DateTimeKind.Utc);
        }

        return DateTime.TryParse(
            value,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out var parsedDate
        )
            ? DateTime.SpecifyKind(parsedDate, DateTimeKind.Utc)
            : null;
    }

    private static bool? ReadBoolean(JsonElement item, params string[] propertyNames)
    {
        foreach (var propertyName in propertyNames)
        {
            if (!item.TryGetProperty(propertyName, out var value))
            {
                continue;
            }

            if (value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            {
                return null;
            }

            if (value.ValueKind == JsonValueKind.True)
            {
                return true;
            }

            if (value.ValueKind == JsonValueKind.False)
            {
                return false;
            }

            if (
                value.ValueKind == JsonValueKind.String
                && bool.TryParse(value.GetString(), out var parsed)
            )
            {
                return parsed;
            }
        }

        return null;
    }

    private static string? NormalizeOptionalText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim();
    }
}
