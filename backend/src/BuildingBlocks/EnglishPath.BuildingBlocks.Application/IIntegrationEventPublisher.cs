namespace EnglishPath.BuildingBlocks.Application;

/// <summary>
/// Publishes integration events through the service's transactional outbox, so they are only
/// sent if the surrounding DbContext <c>SaveChangesAsync</c> commits.
/// </summary>
public interface IIntegrationEventPublisher
{
    Task PublishAsync<T>(T message, CancellationToken cancellationToken)
        where T : class;
}
