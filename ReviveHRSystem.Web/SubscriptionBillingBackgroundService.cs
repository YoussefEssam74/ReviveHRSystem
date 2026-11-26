using ServiceAbstraction.Services;

namespace ReviveHRSystem.Web
{
    /// <summary>
    /// Runs the subscription billing cycle on a schedule. The cycle itself is
    /// idempotent (per-period unique invoice index + PostgreSQL advisory lock), so
    /// running it here and from the Revive Admin "Run now" action is safe.
    /// </summary>
    public sealed class SubscriptionBillingBackgroundService(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<SubscriptionBillingBackgroundService> logger) : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!configuration.GetValue("Subscriptions:BackgroundSweepEnabled", true))
            {
                logger.LogInformation("Subscription billing background sweep is disabled.");
                return;
            }

            var intervalHours = configuration.GetValue("Subscriptions:SweepIntervalHours", 6d);
            var interval = TimeSpan.FromHours(Math.Clamp(intervalHours, 0.1, 168));

            // Let the host finish starting (and migrations/seeding settle) before
            // the first sweep; a failure here must never take the API down.
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = scopeFactory.CreateScope();
                    var subscriptions = scope.ServiceProvider.GetRequiredService<ISubscriptionService>();
                    await subscriptions.ProcessBillingCycleAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception exception)
                {
                    logger.LogError(exception, "The subscription billing sweep failed.");
                }

                try
                {
                    await Task.Delay(interval, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
            }
        }
    }
}
