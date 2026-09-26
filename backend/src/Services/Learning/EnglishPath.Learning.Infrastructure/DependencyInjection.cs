using EnglishPath.BuildingBlocks.Messaging;
using EnglishPath.Learning.Application.Abstractions;
using EnglishPath.Learning.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EnglishPath.Learning.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddLearningInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Learning")
            ?? throw new InvalidOperationException("Connection string 'Learning' is missing.");

        services.AddDbContext<LearningDbContext>(o => o.UseSqlServer(
            connectionString,
            sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", LearningDbContext.Schema).EnableRetryOnFailure()));
        services.AddScoped<ILearningDbContext>(sp => sp.GetRequiredService<LearningDbContext>());
        services.AddHealthChecks().AddDbContextCheck<LearningDbContext>("learning-db", tags: ["ready"]);
        services.AddMessaging<LearningDbContext>("Learning", configuration, x => x.AddConsumer<UserDeletedConsumer>());
        return services;
    }
}
