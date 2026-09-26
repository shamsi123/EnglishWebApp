using EnglishPath.BuildingBlocks.Application;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EnglishPath.BuildingBlocks.Messaging;

public static class MessagingExtensions
{
    /// <summary>
    /// RabbitMQ bus with the EF Core transactional outbox (BRD §8.1): publishes are stored with the
    /// DbContext's SaveChanges and delivered afterwards; consumers get inbox de-duplication.
    /// </summary>
    public static IServiceCollection AddMessaging<TDbContext>(
        this IServiceCollection services,
        IConfiguration configuration,
        Action<IBusRegistrationConfigurator>? configureConsumers = null)
        where TDbContext : DbContext
    {
        services.AddScoped<IIntegrationEventPublisher, MassTransitEventPublisher>();
        services.AddMassTransit(x =>
        {
            x.SetKebabCaseEndpointNameFormatter();
            x.AddEntityFrameworkOutbox<TDbContext>(o =>
            {
                o.UseSqlServer();
                o.UseBusOutbox();
            });
            x.AddConfigureEndpointsCallback((context, _, cfg) => cfg.UseEntityFrameworkOutbox<TDbContext>(context));
            configureConsumers?.Invoke(x);

            x.UsingRabbitMq((context, cfg) =>
            {
                cfg.Host(configuration["RabbitMq:Host"] ?? "localhost", "/", h =>
                {
                    h.Username(configuration["RabbitMq:Username"] ?? "guest");
                    h.Password(configuration["RabbitMq:Password"] ?? "guest");
                });
                cfg.UseMessageRetry(r => r.Intervals(100, 500, 2000));
                cfg.ConfigureEndpoints(context);
            });
        });
        return services;
    }
}

internal sealed class MassTransitEventPublisher(IPublishEndpoint publishEndpoint) : IIntegrationEventPublisher
{
    public Task PublishAsync<T>(T message, CancellationToken cancellationToken)
        where T : class => publishEndpoint.Publish(message, cancellationToken);
}
