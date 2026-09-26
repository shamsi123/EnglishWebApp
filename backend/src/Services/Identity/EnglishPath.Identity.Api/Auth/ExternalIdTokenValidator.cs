using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace EnglishPath.Identity.Api.Auth;

public sealed record ExternalIdentity(string Provider, string Subject, string? Email, bool EmailVerified);

/// <summary>
/// Validates an ID token issued to our app by Google or Apple sign-in (FR-01). The web and
/// Capacitor apps use the providers' own SDKs and exchange the resulting ID token for ours.
/// </summary>
public interface IExternalIdTokenValidator
{
    Task<ExternalIdentity?> ValidateAsync(string provider, string idToken, CancellationToken cancellationToken);
}

public sealed class ExternalProviderOptions
{
    /// <summary>OIDC issuer, e.g. https://accounts.google.com or https://appleid.apple.com.</summary>
    public string Authority { get; set; } = string.Empty;

    /// <summary>Our OAuth client ids at the provider (web, iOS, Android); the token's audience must be one of them.</summary>
    public string[] ClientIds { get; set; } = [];
}

internal sealed class OidcExternalIdTokenValidator : IExternalIdTokenValidator
{
    private readonly Dictionary<string, (ExternalProviderOptions Options, ConfigurationManager<OpenIdConnectConfiguration> Metadata)> _providers;
    private readonly ILogger<OidcExternalIdTokenValidator> _logger;

    public OidcExternalIdTokenValidator(IConfiguration configuration, ILogger<OidcExternalIdTokenValidator> logger)
    {
        _logger = logger;
        _providers = configuration.GetSection("Identity:ExternalProviders").GetChildren()
            .Select(s => (Name: s.Key.ToLowerInvariant(), Options: s.Get<ExternalProviderOptions>()!))
            .Where(p => !string.IsNullOrEmpty(p.Options.Authority) && p.Options.ClientIds.Length > 0)
            .ToDictionary(
                p => p.Name,
                p => (p.Options, new ConfigurationManager<OpenIdConnectConfiguration>(
                    $"{p.Options.Authority.TrimEnd('/')}/.well-known/openid-configuration",
                    new OpenIdConnectConfigurationRetriever(),
                    new HttpDocumentRetriever { RequireHttps = true })));
    }

    public async Task<ExternalIdentity?> ValidateAsync(string provider, string idToken, CancellationToken cancellationToken)
    {
        if (!_providers.TryGetValue(provider.ToLowerInvariant(), out var p))
        {
            return null;
        }

        var metadata = await p.Metadata.GetConfigurationAsync(cancellationToken);
        var parameters = new TokenValidationParameters
        {
            ValidIssuer = metadata.Issuer,
            ValidAudiences = p.Options.ClientIds,
            IssuerSigningKeys = metadata.SigningKeys,
            ClockSkew = TimeSpan.FromMinutes(1),
        };

        try
        {
            var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
            var principal = handler.ValidateToken(idToken, parameters, out _);
            var subject = principal.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(subject))
            {
                return null;
            }

            // Google sends a boolean; Apple sends the string "true".
            var verified = principal.FindFirst("email_verified")?.Value;
            return new ExternalIdentity(
                provider.ToLowerInvariant(),
                subject,
                principal.FindFirst("email")?.Value,
                string.Equals(verified, "true", StringComparison.OrdinalIgnoreCase));
        }
        catch (SecurityTokenException ex)
        {
            _logger.LogInformation(ex, "Rejected {Provider} ID token", provider);
            return null;
        }
    }
}
