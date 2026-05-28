namespace JobTracker.Tests.Services;

public class JobApplicationServiceTests(TestAppDbContextFactory dbContextFactory)
    : IClassFixture<TestAppDbContextFactory>
{
    [Fact]
    public async Task CreateAsync_ValidRequest_PersistsJobApplication()
    {
        await using var dbContext = dbContextFactory.CreateContext();
        var service = new JobApplicationService(dbContext);
        var dto = new JobApplicationCreateDto(
            "Acme",
            "Backend Engineer",
            "https://example.com/jobs/acme-backend",
            "Remote",
            "$100k - $120k",
            "Strong backend role working on distributed systems.",
            "Hiring manager seems responsive.",
            5,
            "C#, PostgreSQL, React",
            JobApplicationStatus.Applied
        );

        var result = await service.CreateAsync(dto, "user-1");

        result.Should().NotBeNull();
        result.CompanyName.Should().Be("Acme");
        result.Position.Should().Be("Backend Engineer");
        result.JobUrl.Should().Be("https://example.com/jobs/acme-backend");
        result.Location.Should().Be("Remote");
        result.SalaryRange.Should().Be("$100k - $120k");
        result.JobDescription.Should().Be("Strong backend role working on distributed systems.");
        result.Notes.Should().Be("Hiring manager seems responsive.");
        result.InterestLevel.Should().Be(5);
        result.TechnicalStack.Should().Be("C#, PostgreSQL, React");
        result.UserId.Should().Be("user-1");
        result.Id.Should().NotBeNullOrWhiteSpace();

        var persisted = await dbContext.JobApplications.SingleAsync();
        persisted.CompanyName.Should().Be("Acme");
        persisted.Position.Should().Be("Backend Engineer");
        persisted.JobUrl.Should().Be("https://example.com/jobs/acme-backend");
        persisted.Location.Should().Be("Remote");
        persisted.SalaryRange.Should().Be("$100k - $120k");
        persisted.JobDescription.Should().Be("Strong backend role working on distributed systems.");
        persisted.Notes.Should().Be("Hiring manager seems responsive.");
        persisted.InterestLevel.Should().Be(5);
        persisted.TechnicalStack.Should().Be("C#, PostgreSQL, React");
        persisted.UserId.Should().Be("user-1");
    }

    [Fact]
    public async Task CreateAsync_NullOptionalFields_PersistsJobApplication()
    {
        await using var dbContext = dbContextFactory.CreateContext();
        var service = new JobApplicationService(dbContext);
        var dto = new JobApplicationCreateDto(
            "Acme",
            "Backend Engineer",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            JobApplicationStatus.Applied
        );

        var result = await service.CreateAsync(dto, "user-1");

        result.JobUrl.Should().BeNull();
        result.Location.Should().BeNull();
        result.SalaryRange.Should().BeNull();
        result.JobDescription.Should().BeNull();
        result.Notes.Should().BeNull();
        result.InterestLevel.Should().BeNull();
        result.TechnicalStack.Should().BeNull();

        var persisted = await dbContext.JobApplications.SingleAsync();
        persisted.JobUrl.Should().BeNull();
        persisted.Location.Should().BeNull();
        persisted.SalaryRange.Should().BeNull();
        persisted.JobDescription.Should().BeNull();
        persisted.Notes.Should().BeNull();
        persisted.InterestLevel.Should().BeNull();
        persisted.TechnicalStack.Should().BeNull();
    }

    [Fact]
    public async Task CreateAsync_LongJobDescription_PersistsWithoutTruncation()
    {
        await using var dbContext = dbContextFactory.CreateContext();
        var service = new JobApplicationService(dbContext);
        var longDescription = new string('A', 2500);
        var dto = new JobApplicationCreateDto(
            "Acme",
            "Backend Engineer",
            null,
            null,
            null,
            longDescription,
            null,
            null,
            null,
            JobApplicationStatus.Applied
        );

        var result = await service.CreateAsync(dto, "user-1");

        result.JobDescription.Should().HaveLength(2500);
        result.JobDescription.Should().Be(longDescription);

        var persisted = await dbContext.JobApplications.SingleAsync();
        persisted.JobDescription.Should().HaveLength(2500);
        persisted.JobDescription.Should().Be(longDescription);
    }

    [Fact]
    public async Task GetAllAsync_MultipleUsersExist_ReturnsOnlyCurrentUsersData()
    {
        await using var dbContext = dbContextFactory.CreateContext();
        var service = new JobApplicationService(dbContext);

        dbContext.JobApplications.AddRange(
            new JobApplication
            {
                Id = "user-1-latest",
                CompanyName = "Contoso",
                Position = "Senior Engineer",
                Status = JobApplicationStatus.Interviewing,
                DateApplied = new DateTime(2026, 05, 10, 10, 00, 00, DateTimeKind.Utc),
                UserId = "user-1",
            },
            new JobApplication
            {
                Id = "user-2-only",
                CompanyName = "Globex",
                Position = "Platform Engineer",
                Status = JobApplicationStatus.Applied,
                DateApplied = new DateTime(2026, 05, 09, 10, 00, 00, DateTimeKind.Utc),
                UserId = "user-2",
            },
            new JobApplication
            {
                Id = "user-1-earlier",
                CompanyName = "Fabrikam",
                Position = "Software Engineer",
                Status = JobApplicationStatus.Offer,
                DateApplied = new DateTime(2026, 05, 08, 10, 00, 00, DateTimeKind.Utc),
                UserId = "user-1",
            }
        );

        await dbContext.SaveChangesAsync();

        var result = await service.GetAllAsync("user-1");

        result.Should().HaveCount(2);
        result.Should().OnlyContain(jobApplication => jobApplication.UserId == "user-1");
        result.Select(jobApplication => jobApplication.Id)
            .Should()
            .Equal("user-1-latest", "user-1-earlier");
    }

    [Fact]
    public async Task UpdateAsync_RecordOwnedByAnotherUser_ShouldThrowNotFoundException()
    {
        await using var dbContext = dbContextFactory.CreateContext();
        var service = new JobApplicationService(dbContext);
        var existing = new JobApplication
        {
            Id = "job-1",
            CompanyName = "Acme",
            Position = "Engineer",
            Status = JobApplicationStatus.Applied,
            DateApplied = new DateTime(2026, 05, 01, 12, 00, 00, DateTimeKind.Utc),
            UserId = "owner-user",
        };

        dbContext.JobApplications.Add(existing);
        await dbContext.SaveChangesAsync();

        var dto = new JobApplicationUpdateDto(
            "Acme Updated",
            "Staff Engineer",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            JobApplicationStatus.Interviewing,
            new DateTime(2026, 05, 11, 12, 00, 00, DateTimeKind.Utc)
        );

        Func<Task> act = async () => await service.UpdateAsync(existing.Id, dto, "other-user");

        await act.Should().ThrowAsync<NotFoundException>();

        var persisted = await dbContext.JobApplications.SingleAsync();
        persisted.CompanyName.Should().Be("Acme");
        persisted.Position.Should().Be("Engineer");
        persisted.Status.Should().Be(JobApplicationStatus.Applied);
    }

    [Fact]
    public async Task UpdateAsync_ValidRequest_UpdatesInterestLevelAndTechnicalStack()
    {
        await using var dbContext = dbContextFactory.CreateContext();
        var service = new JobApplicationService(dbContext);
        var existing = new JobApplication
        {
            Id = "job-1",
            CompanyName = "Acme",
            Position = "Engineer",
            InterestLevel = 2,
            TechnicalStack = "C#",
            Status = JobApplicationStatus.Applied,
            DateApplied = new DateTime(2026, 05, 01, 12, 00, 00, DateTimeKind.Utc),
            UserId = "owner-user",
        };

        dbContext.JobApplications.Add(existing);
        await dbContext.SaveChangesAsync();

        var updatedDate = new DateTime(2026, 05, 11, 12, 00, 00, DateTimeKind.Utc);
        var dto = new JobApplicationUpdateDto(
            "Acme",
            "Engineer",
            null,
            null,
            null,
            null,
            null,
            5,
            "SQL, PostgreSQL, Redis",
            JobApplicationStatus.Interviewing,
            updatedDate
        );

        await service.UpdateAsync(existing.Id, dto, "owner-user");

        var persisted = await dbContext.JobApplications.SingleAsync();
        persisted.InterestLevel.Should().Be(5);
        persisted.TechnicalStack.Should().Be("SQL, PostgreSQL, Redis");
        persisted.Status.Should().Be(JobApplicationStatus.Interviewing);
        persisted.DateApplied.Should().Be(updatedDate);
    }

    [Fact]
    public async Task DeleteAsync_RecordOwnedByAnotherUser_ShouldReturnFalse()
    {
        await using var dbContext = dbContextFactory.CreateContext();
        var service = new JobApplicationService(dbContext);
        var existing = new JobApplication
        {
            Id = "job-1",
            CompanyName = "Acme",
            Position = "Engineer",
            Status = JobApplicationStatus.Applied,
            UserId = "owner-user",
        };

        dbContext.JobApplications.Add(existing);
        await dbContext.SaveChangesAsync();

        var result = await service.DeleteAsync(existing.Id, "other-user");

        result.Should().BeFalse();
        dbContext.JobApplications.Should().ContainSingle();
        (await dbContext.JobApplications.SingleAsync()).Id.Should().Be(existing.Id);
    }

    [Fact]
    public async Task CreateAsync_NullDto_ShouldThrowValidationException()
    {
        await using var dbContext = dbContextFactory.CreateContext();
        var service = new JobApplicationService(dbContext);

        Func<Task> act = async () => await service.CreateAsync(null!, "user-1");

        var exceptionAssertions = await act.Should().ThrowAsync<ValidationException>();

        exceptionAssertions.WithMessage("Job application payload is required.");
        dbContext.JobApplications.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_EmptyCompanyName_ShouldThrowValidationException()
    {
        await using var dbContext = dbContextFactory.CreateContext();
        var service = new JobApplicationService(dbContext);
        var dto = new JobApplicationCreateDto(
            " ",
            "Backend Engineer",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            JobApplicationStatus.Applied
        );

        Func<Task> act = async () => await service.CreateAsync(dto, "user-1");

        var exceptionAssertions = await act.Should().ThrowAsync<ValidationException>();

        exceptionAssertions.WithMessage("CompanyName is required.");
        dbContext.JobApplications.Should().BeEmpty();
    }

    [Fact]
    public async Task UpdateAsync_EmptyPosition_ShouldThrowValidationException()
    {
        await using var dbContext = dbContextFactory.CreateContext();
        var service = new JobApplicationService(dbContext);
        var existing = new JobApplication
        {
            Id = "job-1",
            CompanyName = "Acme",
            Position = "Engineer",
            Status = JobApplicationStatus.Applied,
            DateApplied = new DateTime(2026, 05, 01, 12, 00, 00, DateTimeKind.Utc),
            UserId = "owner-user",
        };

        dbContext.JobApplications.Add(existing);
        await dbContext.SaveChangesAsync();

        var dto = new JobApplicationUpdateDto(
            "Acme Updated",
            "",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            JobApplicationStatus.Interviewing,
            new DateTime(2026, 05, 11, 12, 00, 00, DateTimeKind.Utc)
        );

        Func<Task> act = async () => await service.UpdateAsync(existing.Id, dto, "owner-user");

        var exceptionAssertions = await act.Should().ThrowAsync<ValidationException>();

        exceptionAssertions.WithMessage("Position is required.");

        var persisted = await dbContext.JobApplications.SingleAsync();
        persisted.CompanyName.Should().Be("Acme");
        persisted.Position.Should().Be("Engineer");
        persisted.Status.Should().Be(JobApplicationStatus.Applied);
    }

    [Fact]
    public async Task GetByIdAsync_NonExistent_ThrowsNotFoundException()
    {
        await using var dbContext = dbContextFactory.CreateContext();
        var service = new JobApplicationService(dbContext);

        Func<Task> act = async () => await service.GetByIdAsync("nonexistent", "user-1");

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task GetByIdAsync_CrossUser_ThrowsNotFoundException()
    {
        await using var dbContext = dbContextFactory.CreateContext();
        var service = new JobApplicationService(dbContext);
        var existing = new JobApplication
        {
            Id = "job-1",
            CompanyName = "Acme",
            Position = "Engineer",
            Status = JobApplicationStatus.Applied,
            UserId = "owner-user",
        };

        dbContext.JobApplications.Add(existing);
        await dbContext.SaveChangesAsync();

        Func<Task> act = async () => await service.GetByIdAsync("job-1", "other-user");

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    public async Task CreateAsync_InterestLevelOutOfRange_ThrowsValidationException(int interestLevel)
    {
        await using var dbContext = dbContextFactory.CreateContext();
        var service = new JobApplicationService(dbContext);
        var dto = new JobApplicationCreateDto(
            "Acme", "Engineer", null, null, null, null, null,
            interestLevel, null, JobApplicationStatus.Applied
        );

        Func<Task> act = async () => await service.CreateAsync(dto, "user-1");

        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task CreateAsync_InterestLevelNull_Succeeds()
    {
        await using var dbContext = dbContextFactory.CreateContext();
        var service = new JobApplicationService(dbContext);
        var dto = new JobApplicationCreateDto(
            "Acme", "Engineer", null, null, null, null, null,
            null, null, JobApplicationStatus.Applied
        );

        var result = await service.CreateAsync(dto, "user-1");

        result.InterestLevel.Should().BeNull();
    }

    [Theory]
    [InlineData(1)]
    [InlineData(5)]
    public async Task CreateAsync_InterestLevelBoundaryValues_Succeeds(int interestLevel)
    {
        await using var dbContext = dbContextFactory.CreateContext();
        var service = new JobApplicationService(dbContext);
        var dto = new JobApplicationCreateDto(
            "Acme", "Engineer", null, null, null, null, null,
            interestLevel, null, JobApplicationStatus.Applied
        );

        var result = await service.CreateAsync(dto, "user-1");

        result.InterestLevel.Should().Be(interestLevel);
    }

    [Fact]
    public async Task DeleteAsync_NonExistent_ReturnsFalse()
    {
        await using var dbContext = dbContextFactory.CreateContext();
        var service = new JobApplicationService(dbContext);

        var result = await service.DeleteAsync("nonexistent", "user-1");

        result.Should().BeFalse();
    }
}
