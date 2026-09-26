using KidsLang.Application.Abstractions;
using KidsLang.Infrastructure.Content;
using KidsLang.Infrastructure.Persistence;
using KidsLang.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace KidsLang.Infrastructure;

public static class DependencyInjection
{
    /// <summary>Database__Provider = Sqlite (default) | Postgres. All access goes through EF Core.</summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config, string contentRootPath)
    {
        var provider = config["Database:Provider"] ?? "Sqlite";
        services.AddDbContext<KidsLangDbContext>(o =>
        {
            if (provider.Equals("Postgres", StringComparison.OrdinalIgnoreCase))
                o.UseNpgsql(config.GetConnectionString("Postgres"));
            else
                o.UseSqlite(config.GetConnectionString("Sqlite") ?? "Data Source=kidslang.db");
        });
        services.AddScoped<IKidsLangDb>(sp => sp.GetRequiredService<KidsLangDbContext>());
        services.AddSingleton<IPasswordService, PasswordService>();
        services.AddSingleton<IClock, SystemClock>();
        var root = config["Content:Root"] ?? JsonContentCatalog.LocateContentRoot(contentRootPath);
        services.AddSingleton<IContentCatalog>(new JsonContentCatalog(root));
        return services;
    }
}
