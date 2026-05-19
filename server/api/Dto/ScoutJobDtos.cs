using System.ComponentModel.DataAnnotations;
using api.Models;

namespace api.Dto;

public record ScoutJobCreateDto(
    [property: Required] string Title,
    [property: Required] string Company,
    string? Location,
    string? WorkplaceType,
    string? Commitment,
    DateTime? PostedAt,
    string? JobUrl,
    string? ApplyUrl,
    string? TechnicalTools,
    string? RequirementsSummary
);

public record ScoutJobStateUpdateDto(bool SavedForApply, bool IsDiscarded);

public record ScoutUploadResultDto(int Imported, int Skipped);

public record ScoutUploadParseResult(
    List<ScoutJob> Jobs,
    int Skipped
);
