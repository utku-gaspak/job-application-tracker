namespace JobTracker.Tests.Services;

public class ScoutJobServiceTests
{
    private const string UserId = "user-1";
    private const string OtherUserId = "user-2";

    private static ScoutJobService CreateService(AppDbContext dbContext) => new(dbContext);

    private static ScoutJobCreateDto CreateDto(string title = "Job", string company = "Acme") =>
        new(title, company, null, null, null, null, null, null, null, null);

    [Fact]
    public async Task CreateAsync_WithValidData_ReturnsCreatedJob()
    {
        await using var db = new TestAppDbContextFactory().CreateContext();
        var service = CreateService(db);

        var result = await service.CreateAsync(CreateDto("Backend Engineer"), UserId, CancellationToken.None);

        result.Id.Should().NotBeEmpty();
        result.Title.Should().Be("Backend Engineer");
        result.UserId.Should().Be(UserId);
        result.SavedForApply.Should().BeFalse();
        result.IsDiscarded.Should().BeFalse();
    }

    [Fact]
    public async Task CreateAsync_WithMissingTitle_ThrowsValidationException()
    {
        await using var db = new TestAppDbContextFactory().CreateContext();
        var service = CreateService(db);

        await Assert.ThrowsAsync<ValidationException>(
            () => service.CreateAsync(CreateDto(""), UserId, CancellationToken.None));
    }

    [Fact]
    public async Task CreateAsync_WithDuplicateJobUrl_ThrowsValidationException()
    {
        await using var db = new TestAppDbContextFactory().CreateContext();
        var service = CreateService(db);

        await service.CreateAsync(
            new ScoutJobCreateDto("First", "Acme", null, null, null, null, "https://example.com/job", null, null, null),
            UserId, CancellationToken.None);

        await Assert.ThrowsAsync<ValidationException>(
            () => service.CreateAsync(
                new ScoutJobCreateDto("Second", "Acme", null, null, null, null, "https://example.com/job", null, null, null),
                UserId, CancellationToken.None));
    }

    [Fact]
    public async Task CreateAsync_WithSameJobUrlButDifferentUser_Succeeds()
    {
        await using var db = new TestAppDbContextFactory().CreateContext();
        var service = CreateService(db);

        await service.CreateAsync(
            new ScoutJobCreateDto("First", "Acme", null, null, null, null, "https://example.com/job", null, null, null),
            UserId, CancellationToken.None);

        var result = await service.CreateAsync(
            new ScoutJobCreateDto("Second", "Acme", null, null, null, null, "https://example.com/job", null, null, null),
            OtherUserId, CancellationToken.None);

        result.Should().NotBeNull();
    }

    [Fact]
    public async Task GetJobsAsync_ReturnsUserJobsOnly()
    {
        await using var db = new TestAppDbContextFactory().CreateContext();
        var service = CreateService(db);

        await service.CreateAsync(CreateDto("Job 1"), UserId, CancellationToken.None);
        await service.CreateAsync(CreateDto("Job 2"), OtherUserId, CancellationToken.None);

        var jobs = await service.GetJobsAsync(UserId, CancellationToken.None);

        jobs.Should().HaveCount(1);
        jobs[0].Title.Should().Be("Job 1");
    }

    [Fact]
    public async Task UpdateStateAsync_SetsFlags()
    {
        await using var db = new TestAppDbContextFactory().CreateContext();
        var service = CreateService(db);

        var created = await service.CreateAsync(CreateDto(), UserId, CancellationToken.None);

        var updated = await service.UpdateStateAsync(
            created.Id, new ScoutJobStateUpdateDto(true, false),
            UserId, CancellationToken.None);

        updated.SavedForApply.Should().BeTrue();
        updated.IsDiscarded.Should().BeFalse();
    }

    [Fact]
    public async Task UpdateStateAsync_WithWrongUser_ThrowsNotFoundException()
    {
        await using var db = new TestAppDbContextFactory().CreateContext();
        var service = CreateService(db);

        var created = await service.CreateAsync(CreateDto(), UserId, CancellationToken.None);

        await Assert.ThrowsAsync<NotFoundException>(
            () => service.UpdateStateAsync(
                created.Id, new ScoutJobStateUpdateDto(false, false), OtherUserId, CancellationToken.None));
    }

    [Fact]
    public async Task DeleteAsync_RemovesJob()
    {
        await using var db = new TestAppDbContextFactory().CreateContext();
        var service = CreateService(db);

        var created = await service.CreateAsync(CreateDto(), UserId, CancellationToken.None);

        await service.DeleteAsync(created.Id, UserId, CancellationToken.None);

        var jobs = await service.GetJobsAsync(UserId, CancellationToken.None);
        jobs.Should().BeEmpty();
    }

    [Fact]
    public async Task DeleteAsync_WithWrongUser_ThrowsNotFoundException()
    {
        await using var db = new TestAppDbContextFactory().CreateContext();
        var service = CreateService(db);

        var created = await service.CreateAsync(CreateDto(), UserId, CancellationToken.None);

        await Assert.ThrowsAsync<NotFoundException>(
            () => service.DeleteAsync(created.Id, OtherUserId, CancellationToken.None));
    }

    [Fact]
    public async Task DeleteAllAsync_RemovesOnlyUserJobs()
    {
        await using var db = new TestAppDbContextFactory().CreateContext();
        var service = CreateService(db);

        await service.CreateAsync(CreateDto("Job 1"), UserId, CancellationToken.None);
        await service.CreateAsync(CreateDto("Job 2"), OtherUserId, CancellationToken.None);

        await service.DeleteAllAsync(UserId, CancellationToken.None);

        var userJobs = await service.GetJobsAsync(UserId, CancellationToken.None);
        var otherUserJobs = await service.GetJobsAsync(OtherUserId, CancellationToken.None);

        userJobs.Should().BeEmpty();
        otherUserJobs.Should().HaveCount(1);
    }

    [Fact]
    public async Task ExportJobsAsync_Json_ReturnsValidJson()
    {
        await using var db = new TestAppDbContextFactory().CreateContext();
        var service = CreateService(db);

        await service.CreateAsync(CreateDto(), UserId, CancellationToken.None);

        var (content, contentType, fileName) =
            await service.ExportJobsAsync(UserId, "json", CancellationToken.None);

        contentType.Should().Be("application/json");
        fileName.Should().Be("jobs.json");
        content.Should().NotBeEmpty();
    }

    [Fact]
    public async Task ExportJobsAsync_Csv_ReturnsValidCsv()
    {
        await using var db = new TestAppDbContextFactory().CreateContext();
        var service = CreateService(db);

        await service.CreateAsync(CreateDto(), UserId, CancellationToken.None);

        var (content, contentType, fileName) =
            await service.ExportJobsAsync(UserId, "csv", CancellationToken.None);

        contentType.Should().Be("text/csv");
        fileName.Should().Be("jobs.csv");
        content.Should().NotBeEmpty();
    }

    [Fact]
    public async Task ExportJobsAsync_InvalidFormat_ThrowsValidationException()
    {
        await using var db = new TestAppDbContextFactory().CreateContext();
        var service = CreateService(db);

        await Assert.ThrowsAsync<ValidationException>(
            () => service.ExportJobsAsync(UserId, "xml", CancellationToken.None));
    }

    [Fact]
    public async Task UploadAsync_WithValidJson_ImportsJobs()
    {
        await using var db = new TestAppDbContextFactory().CreateContext();
        var service = CreateService(db);

        const string json = """
            {
              "results": [
                { "title": "Backend Engineer", "company": "Acme" },
                { "title": "Frontend Dev", "company": "Globex" }
              ]
            }
            """;
        await using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(json));

        var result = await service.UploadAsync(stream, UserId, CancellationToken.None);

        result.Imported.Should().Be(2);
    }

    [Fact]
    public async Task UploadAsync_SkipsDuplicates()
    {
        await using var db = new TestAppDbContextFactory().CreateContext();
        var service = CreateService(db);

        await service.CreateAsync(
            new ScoutJobCreateDto("Existing", "Acme", null, null, null, null, "https://example.com/job", null, null, null),
            UserId, CancellationToken.None);

        const string json = """
            {
              "results": [
                { "title": "Existing", "company": "Acme", "job_url": "https://example.com/job" },
                { "title": "New Job", "company": "Globex" }
              ]
            }
            """;
        await using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(json));

        var result = await service.UploadAsync(stream, UserId, CancellationToken.None);

        result.Imported.Should().Be(1);
        result.Skipped.Should().Be(1);
    }
}
