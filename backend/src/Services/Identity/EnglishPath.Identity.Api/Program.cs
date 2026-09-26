using System.Security.Cryptography.X509Certificates;
using System.Text.Json.Serialization;
using EnglishPath.BuildingBlocks.Application;
using EnglishPath.BuildingBlocks.Messaging;
using EnglishPath.BuildingBlocks.Web;
using EnglishPath.Identity.Api;
using EnglishPath.Identity.Api.Accounts;
using EnglishPath.Identity.Api.Auth;
using EnglishPath.Identity.Api.Data;
using EnglishPath.Identity.Api.Email;
using FluentValidation;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using static OpenIddict.Abstractions.OpenIddictConstants;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;
var services = builder.Services;

builder.AddServiceDefaults("Identity", useJwtBearer: false);
services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase)));

services.AddDbContext<AppIdentityDbContext>(o =>
{
    o.UseSqlServer(
        config.GetConnectionString("Identity") ?? throw new InvalidOperationException("Connection string 'Identity' is missing."),
        sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", AppIdentityDbContext.Schema).EnableRetryOnFailure());
    o.UseOpenIddict<Guid>();
});
services.AddHealthChecks().AddDbContextCheck<AppIdentityDbContext>("identity-db", tags: ["ready"]);

// ASP.NET Core Identity without cookies: this service only issues and validates tokens.
services.AddIdentityCore<ApplicationUser>(o =>
    {
        o.User.RequireUniqueEmail = true;
        // OWASP ASVS 2.1: length over composition rules.
        o.Password.RequiredLength = 12;
        o.Password.RequireDigit = false;
        o.Password.RequireLowercase = false;
        o.Password.RequireUppercase = false;
        o.Password.RequireNonAlphanumeric = false;
        o.Password.RequiredUniqueChars = 4;
        o.Lockout.MaxFailedAccessAttempts = 5;
        o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        o.Lockout.AllowedForNewUsers = true;
        o.ClaimsIdentity.UserIdClaimType = Claims.Subject;
        o.ClaimsIdentity.RoleClaimType = Claims.Role;
    })
    .AddRoles<IdentityRole<Guid>>()
    .AddSignInManager()
    .AddEntityFrameworkStores<AppIdentityDbContext>()
    .AddDefaultTokenProviders();
services.Configure<DataProtectionTokenProviderOptions>(o => o.TokenLifespan = TimeSpan.FromHours(24));

services.AddOpenIddict()
    .AddCore(o => o.UseEntityFrameworkCore().UseDbContext<AppIdentityDbContext>().ReplaceDefaultEntities<Guid>())
    .AddServer(o =>
    {
        o.SetTokenEndpointUris("connect/token").SetRevocationEndpointUris("connect/revoke");
        o.AllowPasswordFlow().AllowRefreshTokenFlow().AllowCustomFlow(AuthConstants.ExternalGrantType);
        o.RegisterScopes(Scopes.OpenId, Scopes.Email, Scopes.Roles, Scopes.OfflineAccess, AuthConstants.ApiScope);

        // NFR-06: 15-minute JWT access tokens, rotating refresh tokens.
        o.SetAccessTokenLifetime(TimeSpan.FromMinutes(15));
        o.SetRefreshTokenLifetime(TimeSpan.FromDays(30));
        o.SetRefreshTokenReuseLeeway(TimeSpan.FromSeconds(30));
        // Plain signed JWTs so every service can validate them from the published keys.
        o.DisableAccessTokenEncryption();

        if (config["Identity:Issuer"] is { Length: > 0 } issuer)
        {
            o.SetIssuer(new Uri(issuer));
        }

        var aspNetCore = o.UseAspNetCore().EnableTokenEndpointPassthrough();
        if (builder.Environment.IsDevelopment())
        {
            o.AddDevelopmentEncryptionCertificate().AddDevelopmentSigningCertificate();
            aspNetCore.DisableTransportSecurityRequirement();
        }
        else
        {
            // Certificates are mounted from the secrets vault (NFR-07).
            var password = config["Identity:Certificates:Password"];
            o.AddSigningCertificate(LoadCertificate(config["Identity:Certificates:SigningPath"], password));
            o.AddEncryptionCertificate(LoadCertificate(config["Identity:Certificates:EncryptionPath"], password));
        }
    })
    .AddValidation(o =>
    {
        o.UseLocalServer();
        o.UseAspNetCore();
    });
services.AddAuthentication(OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme);

services.AddMediatR(c =>
{
    c.RegisterServicesFromAssemblyContaining<AccountRegistrar>();
    c.AddOpenBehavior(typeof(ValidationBehavior<,>));
});
services.AddValidatorsFromAssemblyContaining<AccountRegistrar>(includeInternalTypes: true);
services.AddScoped<AccountRegistrar>();
services.AddScoped<AccountEmails>();
services.AddSingleton<AccountLinks>();
services.AddSingleton<IEmailSender, LoggingEmailSender>();
services.AddSingleton<IExternalIdTokenValidator, OidcExternalIdTokenValidator>();
services.AddMessaging<AppIdentityDbContext>("Identity", config);
services.AddHostedService<IdentitySeeder>();

var app = builder.Build();

app.UseServiceDefaults();
app.MapTokenEndpoint();
app.MapAccountEndpoints();

app.Run();

static X509Certificate2 LoadCertificate(string? path, string? password) =>
    string.IsNullOrEmpty(path)
        ? throw new InvalidOperationException("Identity signing/encryption certificate paths must be configured outside Development.")
        : new X509Certificate2(path, password);

public partial class Program;
