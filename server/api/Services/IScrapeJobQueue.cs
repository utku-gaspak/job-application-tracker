namespace api.Services;

public interface IScrapeJobQueue
{
    ValueTask QueueAsync(string jobId, CancellationToken cancellationToken = default);
}
