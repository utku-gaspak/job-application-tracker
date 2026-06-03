namespace api.Services;

public class DemoSessionCleanupService(
    IServiceScopeFactory scopeFactory,
    ILogger<DemoSessionCleanupService> logger
) : BackgroundService
{
    private static readonly TimeSpan InitialDelay = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan CleanupInterval = TimeSpan.FromHours(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(InitialDelay, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            await CleanupOnceAsync(stoppingToken);

            try
            {
                await Task.Delay(CleanupInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }

    private async Task CleanupOnceAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var demoSessions = scope.ServiceProvider.GetRequiredService<IDemoSessionService>();
            var deletedCount = await demoSessions.DeleteExpiredSessionsAsync(cancellationToken);

            if (deletedCount > 0)
                logger.LogInformation("Deleted {Count} expired demo sessions.", deletedCount);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogWarning(exception, "Failed to clean up expired demo sessions.");
        }
    }
}
