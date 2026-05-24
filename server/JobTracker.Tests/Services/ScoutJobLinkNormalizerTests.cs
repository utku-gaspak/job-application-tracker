namespace JobTracker.Tests.Services;

public class ScoutJobLinkNormalizerTests
{
    [Fact]
    public void Normalize_WhenLinksAreAlreadyCorrect_KeepsHiringCafeJobUrlAndExternalApplyUrl()
    {
        var result = ScoutJobLinkNormalizer.Normalize(
            "https://hiring.cafe/job/example",
            "https://company.example/jobs/123"
        );

        result.JobUrl.Should().Be("https://hiring.cafe/job/example");
        result.ApplyUrl.Should().Be("https://company.example/jobs/123");
    }

    [Fact]
    public void Normalize_WhenLinksAreSwapped_RestoresHiringCafeJobUrlAndExternalApplyUrl()
    {
        var result = ScoutJobLinkNormalizer.Normalize(
            "https://company.example/jobs/123",
            "https://hiring.cafe/job/example"
        );

        result.JobUrl.Should().Be("https://hiring.cafe/job/example");
        result.ApplyUrl.Should().Be("https://company.example/jobs/123");
    }

    [Fact]
    public void Normalize_WhenOnlyExternalUrlIsInJobUrl_TreatsItAsApplyUrl()
    {
        var result = ScoutJobLinkNormalizer.Normalize(
            "https://company.example/jobs/123",
            null
        );

        result.JobUrl.Should().BeNull();
        result.ApplyUrl.Should().Be("https://company.example/jobs/123");
    }

    [Fact]
    public async Task Parser_NormalizesSwappedScraperLinks()
    {
        const string payload = """
            {
              "results": [
                {
                  "title": "Backend Engineer",
                  "company": "Acme",
                  "job_url": "https://company.example/jobs/123",
                  "apply_url": "https://hiring.cafe/job/example"
                }
              ]
            }
            """;
        await using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(payload));

        var result = await ScoutJobUploadParser.ParseAsync(stream, CancellationToken.None);

        var job = result.Jobs.Should().ContainSingle().Subject;
        job.JobUrl.Should().Be("https://hiring.cafe/job/example");
        job.ApplyUrl.Should().Be("https://company.example/jobs/123");
    }
}
