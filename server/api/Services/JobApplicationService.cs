using System.ComponentModel.DataAnnotations;
using api.Data;
using api.Dto;
using api.Exceptions;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Services;

public class JobApplicationService(
    AppDbContext dbContext,
    JobDuplicateDetector? duplicateDetector = null) : IJobApplicationService
{
    private readonly JobDuplicateDetector jobDuplicateDetector = duplicateDetector ?? new(dbContext);

    public async Task<JobApplication> CreateAsync(JobApplicationCreateDto dto, string userId, CancellationToken cancellationToken = default)
    {
        ValidateCreateRequest(dto, userId);

        if (await jobDuplicateDetector.IsDuplicateApplicationAsync(dto, userId, cancellationToken))
            throw new ValidationException(JobDuplicateDetector.DuplicateMessage);

        var jobApplication = new JobApplication
        {
            Id = Guid.NewGuid().ToString(),
            CompanyName = dto.CompanyName,
            Position = dto.Position,
            JobUrl = NormalizeOptionalText(dto.JobUrl),
            Location = NormalizeOptionalText(dto.Location),
            SalaryRange = NormalizeOptionalText(dto.SalaryRange),
            JobDescription = NormalizeOptionalText(dto.JobDescription),
            Notes = NormalizeOptionalText(dto.Notes),
            InterestLevel = dto.InterestLevel,
            TechnicalStack = NormalizeOptionalText(dto.TechnicalStack),
            Status = dto.Status,
            DateApplied = DateTime.UtcNow,
            UserId = userId,
        };

        dbContext.JobApplications.Add(jobApplication);
        await dbContext.SaveChangesAsync(cancellationToken);

        return jobApplication;
    }

    public async Task<List<JobApplication>> GetAllAsync(string userId, CancellationToken cancellationToken = default)
    {
        ValidateUserId(userId);

        return await dbContext
            .JobApplications.Where(jobApplication => jobApplication.UserId == userId)
            .OrderByDescending(jobApplication => jobApplication.DateApplied)
            .ToListAsync(cancellationToken);
    }

    public async Task<JobApplication> GetByIdAsync(string id, string userId, CancellationToken cancellationToken = default)
    {
        ValidateId(id);
        ValidateUserId(userId);

        return await dbContext.JobApplications.FirstOrDefaultAsync(
                jobApplication => jobApplication.Id == id && jobApplication.UserId == userId,
                cancellationToken
            ) ?? throw new NotFoundException("Job application could not be found");
    }

    public async Task UpdateAsync(string id, JobApplicationUpdateDto dto, string userId, CancellationToken cancellationToken = default)
    {
        ValidateId(id);
        ValidateUpdateRequest(dto, userId);

        var jobApplication = await dbContext.JobApplications.FirstOrDefaultAsync(
                current => current.Id == id && current.UserId == userId,
                cancellationToken
            ) ?? throw new NotFoundException("Job application could not be found");

        jobApplication.CompanyName = dto.CompanyName;
        jobApplication.Position = dto.Position;
        jobApplication.JobUrl = NormalizeOptionalText(dto.JobUrl);
        jobApplication.Location = NormalizeOptionalText(dto.Location);
        jobApplication.SalaryRange = NormalizeOptionalText(dto.SalaryRange);
        jobApplication.JobDescription = NormalizeOptionalText(dto.JobDescription);
        jobApplication.Notes = NormalizeOptionalText(dto.Notes);
        jobApplication.InterestLevel = dto.InterestLevel;
        jobApplication.TechnicalStack = NormalizeOptionalText(dto.TechnicalStack);
        jobApplication.Status = dto.Status;
        jobApplication.DateApplied = dto.DateApplied;
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<bool> DeleteAsync(string id, string userId, CancellationToken cancellationToken = default)
    {
        ValidateId(id);
        ValidateUserId(userId);

        var jobApplication = await dbContext.JobApplications.FirstOrDefaultAsync(
            current => current.Id == id && current.UserId == userId,
            cancellationToken
        );

        if (jobApplication == null)
            return false;

        dbContext.JobApplications.Remove(jobApplication);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static void ValidateCreateRequest(JobApplicationCreateDto? dto, string userId)
    {
        if (dto is null)
            throw new ValidationException("Job application payload is required.");

        ValidateUserId(userId);
        ValidateRequiredText(dto.CompanyName, nameof(dto.CompanyName));
        ValidateRequiredText(dto.Position, nameof(dto.Position));
        ValidateInterestLevel(dto.InterestLevel);
    }

    private static void ValidateUpdateRequest(JobApplicationUpdateDto? dto, string userId)
    {
        if (dto is null)
            throw new ValidationException("Job application payload is required.");

        ValidateUserId(userId);
        ValidateRequiredText(dto.CompanyName, nameof(dto.CompanyName));
        ValidateRequiredText(dto.Position, nameof(dto.Position));
        ValidateInterestLevel(dto.InterestLevel);
    }

    private static void ValidateId(string id)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ValidationException("Id is required.");
    }

    private static void ValidateUserId(string userId)
    {
        if (string.IsNullOrWhiteSpace(userId))
            throw new ValidationException("UserId is required.");
    }

    private static void ValidateRequiredText(string value, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ValidationException($"{fieldName} is required.");
    }

    private static string? NormalizeOptionalText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        return value.Trim();
    }

    private static void ValidateInterestLevel(int? interestLevel)
    {
        if (interestLevel is < 1 or > 5)
            throw new ValidationException("InterestLevel must be between 1 and 5 when provided.");
    }
}
