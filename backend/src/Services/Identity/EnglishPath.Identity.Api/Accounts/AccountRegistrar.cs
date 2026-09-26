using EnglishPath.BuildingBlocks.Application;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Contracts;
using EnglishPath.Identity.Api.Auth;
using EnglishPath.Identity.Api.Data;
using EnglishPath.Identity.Api.Email;
using EnglishPath.Identity.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Identity.Api.Accounts;

public sealed record NewAccount(
    string Email,
    string? Password,
    DateOnly DateOfBirth,
    string? GuardianEmail,
    bool EmailVerified = false,
    ExternalIdentity? ExternalLogin = null);

/// <summary>
/// Creates accounts for both email/password sign-up and first-time Google/Apple sign-in, applying
/// the age rules (FR-05) and publishing <see cref="UserRegistered"/> atomically with the user row.
/// </summary>
public sealed class AccountRegistrar(
    UserManager<ApplicationUser> users,
    AppIdentityDbContext db,
    IIntegrationEventPublisher publisher,
    AccountEmails emails,
    IConfiguration configuration,
    IClock clock)
{
    public const string GuardianConsentPurpose = "GuardianConsent";

    public async Task<Result<ApplicationUser>> CreateAsync(NewAccount account, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var minimumAge = configuration.GetValue("Identity:MinimumAge", AgePolicy.DefaultMinimumAge);
        var bracket = AgePolicy.Classify(account.DateOfBirth, DateOnly.FromDateTime(now.UtcDateTime), minimumAge);
        if (bracket == AgeBracket.TooYoung)
        {
            return new Error("account.too_young", $"You must be at least {minimumAge} to create an account.");
        }

        var guardianEmail = account.GuardianEmail?.Trim();
        if (bracket == AgeBracket.Minor)
        {
            if (string.IsNullOrEmpty(guardianEmail))
            {
                return new Error("account.guardian_required", "Learners under 18 need a parent or guardian's email address.");
            }

            if (string.Equals(guardianEmail, account.Email.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return new Error("account.guardian_email", "The guardian's email must be different from yours.");
            }
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = account.Email.Trim(),
            Email = account.Email.Trim(),
            EmailConfirmed = account.EmailVerified,
            DateOfBirth = account.DateOfBirth,
            CreatedAt = now,
            GuardianEmail = bracket == AgeBracket.Minor ? guardianEmail : null,
            GuardianConsent = bracket == AgeBracket.Minor ? GuardianConsentStatus.Pending : GuardianConsentStatus.NotRequired,
        };

        Error? failure = null;
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            var created = account.Password is null ? await users.CreateAsync(user) : await users.CreateAsync(user, account.Password);
            if (!created.Succeeded)
            {
                failure = ToError(created);
                return;
            }

            if (account.ExternalLogin is { } login)
            {
                var linked = await users.AddLoginAsync(user, new UserLoginInfo(login.Provider, login.Subject, login.Provider));
                if (!linked.Succeeded)
                {
                    failure = ToError(linked);
                    return;
                }
            }

            await publisher.PublishAsync(new UserRegistered(user.Id, now, bracket == AgeBracket.Minor), cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        });

        if (failure is not null)
        {
            db.ChangeTracker.Clear();
            return failure;
        }

        if (!user.EmailConfirmed)
        {
            await emails.SendVerificationAsync(user, cancellationToken);
        }

        if (user.GuardianConsent == GuardianConsentStatus.Pending)
        {
            await emails.SendGuardianConsentAsync(user, cancellationToken);
        }

        return user;
    }

    public static Error ToError(IdentityResult result)
    {
        var error = result.Errors.First();
        return error.Code switch
        {
            nameof(IdentityErrorDescriber.DuplicateEmail) or nameof(IdentityErrorDescriber.DuplicateUserName) =>
                Error.Conflict("account.email_taken", "An account with this email already exists."),
            nameof(IdentityErrorDescriber.LoginAlreadyAssociated) =>
                Error.Conflict("account.login_taken", "This sign-in is already linked to another account."),
            _ when error.Code.StartsWith("Password", StringComparison.Ordinal) => new Error("account.password", error.Description),
            nameof(IdentityErrorDescriber.InvalidToken) => new Error("account.invalid_token", "This link is invalid or has expired."),
            _ => new Error($"account.{error.Code}", error.Description),
        };
    }
}

/// <summary>Account emails. Links point at the web app, which calls the account API.</summary>
public sealed class AccountEmails(UserManager<ApplicationUser> users, IEmailSender sender, AccountLinks links)
{
    public async Task SendVerificationAsync(ApplicationUser user, CancellationToken cancellationToken)
    {
        var token = await users.GenerateEmailConfirmationTokenAsync(user);
        await sender.SendAsync(
            new EmailMessage(user.Email!, "Confirm your EnglishPath email", $"Confirm your email address: {links.VerifyEmail(user.Id, token)}"),
            cancellationToken);
    }

    public async Task SendPasswordResetAsync(ApplicationUser user, CancellationToken cancellationToken)
    {
        var token = await users.GeneratePasswordResetTokenAsync(user);
        await sender.SendAsync(
            new EmailMessage(user.Email!, "Reset your EnglishPath password", $"Reset your password (valid for 24 hours): {links.ResetPassword(user.Id, token)}"),
            cancellationToken);
    }

    public async Task SendGuardianConsentAsync(ApplicationUser user, CancellationToken cancellationToken)
    {
        var token = await users.GenerateUserTokenAsync(user, TokenOptions.DefaultProvider, AccountRegistrar.GuardianConsentPurpose);
        await sender.SendAsync(
            new EmailMessage(
                user.GuardianEmail!,
                "Your child wants to learn English with EnglishPath",
                $"{user.Email} has asked to create an EnglishPath account and listed you as their parent or guardian. " +
                $"We only use their data to run their lessons, never for advertising. Review and approve or decline: {links.GuardianConsent(user.Id, token)}"),
            cancellationToken);
    }
}
