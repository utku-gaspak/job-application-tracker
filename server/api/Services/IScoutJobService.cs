using api.Dto;
using api.Models;

namespace api.Services;

public interface IScoutJobService
{
    Task<List<ScoutJob>> GetJobsAsync(string userId, CancellationToken cancellationToken);
    Task<ScoutJob> UpdateStateAsync(Guid id, ScoutJobStateUpdateDto dto, string userId, CancellationToken cancellationToken);
    Task<ScoutJob> CreateAsync(ScoutJobCreateDto dto, string userId, CancellationToken cancellationToken);
    Task<ScoutUploadResultDto> UploadAsync(Stream fileStream, string userId, CancellationToken cancellationToken);
    Task DeleteAsync(Guid id, string userId, CancellationToken cancellationToken);
    Task DeleteAllAsync(string userId, CancellationToken cancellationToken);
    Task<(byte[] Content, string ContentType, string FileName)> ExportJobsAsync(
        string userId, string format, CancellationToken cancellationToken);
}
