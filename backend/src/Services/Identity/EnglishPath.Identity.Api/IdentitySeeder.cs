using EnglishPath.BuildingBlocks.Application;
using EnglishPath.Identity.Api.Auth;
using EnglishPath.Identity.Api.Data;
using EnglishPath.Identity.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace EnglishPath.Identity.Api;

/// <summary>Applies migrations (if enabled) and seeds roles (FR-91), OAuth clients and, in Development, an admin.</summary>
internal sealed class IdentitySeeder(IServiceProvider services, IConfiguration configuration, ILogger<IdentitySeeder> logger) : IHostedService
{
    /// <summary>First-party public clients: the PWA and the Capacitor apps (Phase 3).</summary>
    public static readonly string[] ClientIds = ["englishpath-web", "englishpath-mobile"];

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await using var scope = services.CreateAsyncScope();
        var sp = scope.ServiceProvider;

        if (configuration.GetValue<bool>("Database:MigrateOnStartup"))
        {
            await sp.GetRequiredService<AppIdentityDbContext>().Database.MigrateAsync(cancellationToken);
        }

        var roles = sp.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        foreach (var role in new[] { Roles.SuperAdmin, Roles.ContentAuthor, Roles.Reviewer, Roles.Support })
        {
            if (!await roles.RoleExistsAsync(role))
            {
                await roles.CreateAsync(new IdentityRole<Guid>(role));
            }
        }

        var applications = sp.GetRequiredService<IOpenIddictApplicationManager>();
        foreach (var clientId in ClientIds)
        {
            if (await applications.FindByClientIdAsync(clientId, cancellationToken) is null)
            {
                await applications.CreateAsync(
                    new OpenIddictApplicationDescriptor
                    {
                        ClientId = clientId,
                        ClientType = ClientTypes.Public,
                        DisplayName = clientId,
                        Permissions =
                        {
                            Permissions.Endpoints.Token,
                            Permissions.Endpoints.Revocation,
                            Permissions.GrantTypes.Password,
                            Permissions.GrantTypes.RefreshToken,
                            Permissions.Prefixes.GrantType + AuthConstants.ExternalGrantType,
                            Permissions.Scopes.Email,
                            Permissions.Scopes.Roles,
                            Permissions.Prefixes.Scope + AuthConstants.ApiScope,
                        },
                    },
                    cancellationToken);
            }
        }

        if (configuration.GetSection("Identity:SeedAdmin") is { } admin
            && admin["Email"] is { Length: > 0 } email
            && admin["Password"] is { Length: > 0 } password)
        {
            var users = sp.GetRequiredService<UserManager<ApplicationUser>>();
            if (await users.FindByEmailAsync(email) is null)
            {
                var user = new ApplicationUser
                {
                    Id = Guid.NewGuid(),
                    UserName = email,
                    Email = email,
                    EmailConfirmed = true,
                    DateOfBirth = new DateOnly(1990, 1, 1),
                    CreatedAt = DateTimeOffset.UtcNow,
                    GuardianConsent = GuardianConsentStatus.NotRequired,
                };
                var created = await users.CreateAsync(user, password);
                if (created.Succeeded)
                {
                    await users.AddToRoleAsync(user, Roles.SuperAdmin);
                    logger.LogInformation("Seeded admin {Email}", email);
                }
                else
                {
                    logger.LogWarning("Could not seed admin: {Errors}", string.Join(", ", created.Errors.Select(e => e.Description)));
                }
            }
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
