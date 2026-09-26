using EnglishPath.BuildingBlocks.Messaging;
using EnglishPath.Progress.Application;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EnglishPath.Progress.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddProgressInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Progress")
            ?? throw new InvalidOperationException("Connection string 'Progress' is missing.");

        services.AddDbContext<ProgressDbContext>(o => o.UseSqlServer(
            connectionString,
            sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", ProgressDbContext.Schema).EnableRetryOnFailure()));
        services.AddScoped<IProgressDbContext>(sp => sp.GetRequiredService<ProgressDbContext>());
        services.AddHealthChecks().AddDbContextCheck<ProgressDbContext>("progress-db", tags: ["ready"]);
        services.AddMessaging<ProgressDbContext>("Progress", configuration, x =>
        {
            x.AddConsumer<LessonCompletedConsumer>();
            x.AddConsumer<UserDeletedConsumer>();
            x.AddConsumer<OnboardingCompletedConsumer>();
        });
        return services;
    }
}
