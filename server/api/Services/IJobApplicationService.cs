using api.Dto;
using api.Models;

namespace api.Services;

public interface IJobApplicationService
{
    Task<JobApplication> CreateAsync(JobApplicationCreateDto dto, string userId, CancellationToken cancellationToken = default);
    Task<List<JobApplication>> GetAllAsync(string userId, CancellationToken cancellationToken = default);
    Task<JobApplication> GetByIdAsync(string id, string userId, CancellationToken cancellationToken = default);
    Task UpdateAsync(string id, JobApplicationUpdateDto dto, string userId, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(string id, string userId, CancellationToken cancellationToken = default);
}
