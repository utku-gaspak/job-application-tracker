using System.Threading.Channels;

namespace api.Services;

public sealed class ScrapeJobQueue : IScrapeJobQueue
{
    private readonly Channel<string> _queue = Channel.CreateUnbounded<string>(
        new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false,
        }
    );

    public ValueTask QueueAsync(string jobId, CancellationToken cancellationToken = default) =>
        _queue.Writer.WriteAsync(jobId, cancellationToken);

    public IAsyncEnumerable<string> ReadAllAsync(CancellationToken cancellationToken) =>
        _queue.Reader.ReadAllAsync(cancellationToken);
}
