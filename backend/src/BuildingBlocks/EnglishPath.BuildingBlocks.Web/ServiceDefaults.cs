using System.Security.Claims;
using System.Text;
using EnglishPath.BuildingBlocks.Application;
using EnglishPath.BuildingBlocks.Domain;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

namespace EnglishPath.BuildingBlocks.Web;

/// <summary>Cross-cutting setup shared by every service: auth, problem details, health, OpenAPI.</summary>
public static class ServiceDefaults
{
    public static IHostApplicationBuilder AddServiceDefaults(this IHostApplicationBuilder builder, string serviceName)
    {
        var services = builder.Services;

        services.AddProblemDetails();
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, HttpContextCurrentUser>();
        services.AddSingleton<IClock, SystemClock>();
        services.AddHealthChecks().AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live"]);

        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(o =>
        {
            o.SwaggerDoc("v1", new OpenApiInfo { Title = $"EnglishPath {serviceName} API", Version = "v1" });
            o.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
            });
            o.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }] = [],
            });
        });

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(o => ConfigureJwt(o, builder.Configuration, builder.Environment));
        services.AddAuthorization();

        return builder;
    }

    public static WebApplication UseServiceDefaults(this WebApplication app)
    {
        app.UseExceptionHandler();
        app.UseStatusCodePages();
        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }

        app.UseAuthentication();
        app.UseAuthorization();

        app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = r => r.Tags.Contains("live") });
        app.MapHealthChecks("/health/ready");
        return app;
    }

    /// <summary>
    /// NFR-06: access tokens are JWTs issued by the Identity service (OIDC). For local development
    /// without Identity running, <c>Auth:DevSigningKey</c> enables symmetric-key tokens; it is
    /// rejected outside the Development environment.
    /// </summary>
    private static void ConfigureJwt(JwtBearerOptions options, IConfiguration config, IHostEnvironment env)
    {
        var section = config.GetSection("Auth");
        var authority = section["Authority"];
        var audience = section["Audience"] ?? "englishpath-api";
        var devKey = section["DevSigningKey"];

        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidAudience = audience,
            NameClaimType = "sub",
            RoleClaimType = "role",
            ClockSkew = TimeSpan.FromSeconds(30),
        };

        if (!string.IsNullOrEmpty(authority))
        {
            options.Authority = authority;
            options.RequireHttpsMetadata = !env.IsDevelopment();
            return;
        }

        if (!string.IsNullOrEmpty(devKey) && env.IsDevelopment())
        {
            options.TokenValidationParameters.ValidIssuer = section["Issuer"] ?? "englishpath-dev";
            options.TokenValidationParameters.IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(devKey));
            return;
        }

        throw new InvalidOperationException("Configure Auth:Authority (or Auth:DevSigningKey in Development).");
    }
}

internal sealed class HttpContextCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal Principal =>
        accessor.HttpContext?.User ?? throw new InvalidOperationException("No HTTP context");

    public Guid UserId =>
        Guid.TryParse(Principal.FindFirstValue("sub"), out var id)
            ? id
            : throw new UnauthorizedAccessException("Token has no valid 'sub' claim");

    public bool IsInRole(string role) => Principal.IsInRole(role);
}
