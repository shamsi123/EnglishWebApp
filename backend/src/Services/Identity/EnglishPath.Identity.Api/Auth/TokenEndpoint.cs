using System.Collections.Immutable;
using System.Security.Claims;
using EnglishPath.Identity.Api.Accounts;
using EnglishPath.Identity.Api.Data;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace EnglishPath.Identity.Api.Auth;

public static class AuthConstants
{
    /// <summary>Exchanges a Google/Apple ID token for EnglishPath tokens (parameters: provider, id_token[, date_of_birth, guardian_email]).</summary>
    public const string ExternalGrantType = "urn:englishpath:params:oauth:grant-type:external_id_token";

    /// <summary>Audience of access tokens accepted by all EnglishPath APIs.</summary>
    public const string ApiResource = "englishpath-api";

    public const string ApiScope = "api";

    /// <summary>Kept in refresh tokens only; a changed stamp (e.g. password reset) invalidates them.</summary>
    public const string SecurityStampClaim = "englishpath:sstamp";
}

/// <summary>
/// OAuth 2.0 token endpoint (FR-01, NFR-06). Access tokens are 15-minute JWTs; refresh tokens rotate
/// on every use. Roles and account state are re-read from the database on each refresh.
/// </summary>
internal static class TokenEndpoint
{
    public static void MapTokenEndpoint(this IEndpointRouteBuilder app) =>
        app.MapPost("/connect/token", HandleAsync).ExcludeFromDescription();

    private static async Task<IResult> HandleAsync(
        HttpContext context,
        UserManager<ApplicationUser> users,
        SignInManager<ApplicationUser> signIn,
        IExternalIdTokenValidator externalValidator,
        AccountRegistrar registrar,
        CancellationToken cancellationToken)
    {
        var request = context.GetOpenIddictServerRequest()
            ?? throw new InvalidOperationException("The OpenID Connect request cannot be retrieved.");

        if (request.IsPasswordGrantType())
        {
            var user = await users.FindByEmailAsync(request.Username ?? string.Empty);
            if (user is null)
            {
                return Reject(Errors.InvalidGrant, "The email or password is incorrect.");
            }

            var check = await signIn.CheckPasswordSignInAsync(user, request.Password ?? string.Empty, lockoutOnFailure: true);
            if (check.IsLockedOut)
            {
                return Reject(Errors.InvalidGrant, "Too many failed attempts. Try again in 15 minutes or reset your password.", "account_locked");
            }

            if (!check.Succeeded)
            {
                return Reject(Errors.InvalidGrant, "The email or password is incorrect.");
            }

            return await IssueAsync(user, request, users);
        }

        if (request.IsRefreshTokenGrantType())
        {
            var result = await context.AuthenticateAsync(OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
            var user = await users.FindByIdAsync(result.Principal?.GetClaim(Claims.Subject) ?? string.Empty);
            if (user is null || result.Principal!.GetClaim(AuthConstants.SecurityStampClaim) != await users.GetSecurityStampAsync(user))
            {
                return Reject(Errors.InvalidGrant, "Your session has expired. Please sign in again.");
            }

            return await IssueAsync(user, request, users);
        }

        if (request.GrantType == AuthConstants.ExternalGrantType)
        {
            return await ExternalAsync(request, users, externalValidator, registrar, cancellationToken);
        }

        return Reject(Errors.UnsupportedGrantType, "The grant type is not supported.");
    }

    private static async Task<IResult> ExternalAsync(
        OpenIddictRequest request,
        UserManager<ApplicationUser> users,
        IExternalIdTokenValidator validator,
        AccountRegistrar registrar,
        CancellationToken cancellationToken)
    {
        var provider = (string?)request["provider"];
        var idToken = (string?)request["id_token"];
        if (string.IsNullOrEmpty(provider) || string.IsNullOrEmpty(idToken))
        {
            return Reject(Errors.InvalidRequest, "provider and id_token are required.");
        }

        var external = await validator.ValidateAsync(provider, idToken, cancellationToken);
        if (external is null)
        {
            return Reject(Errors.InvalidGrant, "The sign-in could not be verified.");
        }

        var user = await users.FindByLoginAsync(external.Provider, external.Subject);
        if (user is null && external.Email is not null)
        {
            var existing = await users.FindByEmailAsync(external.Email);
            if (existing is not null)
            {
                // Only link to an existing account when the provider vouches for the address.
                if (!external.EmailVerified)
                {
                    return Reject(Errors.InvalidGrant, "An account with this email already exists. Sign in with your password.", "account_exists");
                }

                var linked = await users.AddLoginAsync(existing, new UserLoginInfo(external.Provider, external.Subject, external.Provider));
                if (!linked.Succeeded)
                {
                    return Reject(Errors.InvalidGrant, AccountRegistrar.ToError(linked).Message);
                }

                user = existing;
            }
        }

        if (user is null)
        {
            if (external.Email is null)
            {
                return Reject(Errors.InvalidGrant, "The provider did not share an email address.");
            }

            // First sign-in: the client collects date of birth (and guardian email for minors) and retries.
            if (!DateOnly.TryParse((string?)request["date_of_birth"], out var dateOfBirth))
            {
                return Reject(Errors.InvalidGrant, "Tell us your date of birth to finish creating your account.", "registration_required");
            }

            var created = await registrar.CreateAsync(
                new NewAccount(external.Email, null, dateOfBirth, (string?)request["guardian_email"], external.EmailVerified, external),
                cancellationToken);
            if (!created.IsSuccess)
            {
                return Reject(Errors.InvalidGrant, created.Error!.Message, created.Error.Code);
            }

            user = created.Value;
        }

        return await IssueAsync(user, request, users);
    }

    private static async Task<IResult> IssueAsync(ApplicationUser user, OpenIddictRequest request, UserManager<ApplicationUser> users)
    {
        if (!user.CanUseAccount)
        {
            return Reject(Errors.AccessDenied, "Waiting for your parent or guardian to approve your account.", "guardian_consent_required");
        }

        var identity = new ClaimsIdentity(TokenValidationParameters.DefaultAuthenticationType, Claims.Name, Claims.Role);
        identity.SetClaim(Claims.Subject, user.Id.ToString())
            .SetClaim(Claims.Email, user.Email)
            .SetClaim(Claims.EmailVerified, user.EmailConfirmed)
            .SetClaim(AuthConstants.SecurityStampClaim, await users.GetSecurityStampAsync(user))
            .SetClaims(Claims.Role, (await users.GetRolesAsync(user)).ToImmutableArray());

        identity.SetScopes(request.GetScopes().Intersect([Scopes.OpenId, Scopes.Email, Scopes.Roles, Scopes.OfflineAccess, AuthConstants.ApiScope]));
        identity.SetResources(AuthConstants.ApiResource);
        identity.SetDestinations(claim => claim.Type switch
        {
            Claims.Subject => [Destinations.AccessToken, Destinations.IdentityToken],
            Claims.Email or Claims.EmailVerified => [Destinations.AccessToken, Destinations.IdentityToken],
            Claims.Role => [Destinations.AccessToken],
            _ => [],
        });

        return Results.SignIn(new ClaimsPrincipal(identity), authenticationScheme: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }

    private static IResult Reject(string error, string description, string? code = null)
    {
        var properties = new Dictionary<string, string?>
        {
            [OpenIddictServerAspNetCoreConstants.Properties.Error] = error,
            [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] = description,
        };
        if (code is not null)
        {
            // Machine-readable reason for the client (e.g. registration_required); sent as error_uri.
            properties[OpenIddictServerAspNetCoreConstants.Properties.ErrorUri] = $"https://englishpath.app/errors/{code}";
        }

        return Results.Forbid(new AuthenticationProperties(properties), [OpenIddictServerAspNetCoreDefaults.AuthenticationScheme]);
    }
}
