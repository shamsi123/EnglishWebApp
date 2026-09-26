using EnglishPath.BuildingBlocks.Application;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Contracts;
using EnglishPath.Identity.Api.Data;
using EnglishPath.Identity.Domain;
using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Abstractions;

namespace EnglishPath.Identity.Api.Accounts;

public sealed record RegisteredDto(Guid UserId, bool RequiresGuardianConsent);

public sealed record RegisterCommand(string Email, string Password, DateOnly DateOfBirth, string? GuardianEmail, bool AcceptedTerms)
    : IRequest<Result<RegisteredDto>>;

public sealed record VerifyEmailCommand(Guid UserId, string Token) : IRequest<Result>;

public sealed record ResendVerificationCommand : IRequest<Result>;

public sealed record ForgotPasswordCommand(string Email) : IRequest<Result>;

public sealed record ResetPasswordCommand(Guid UserId, string Token, string NewPassword) : IRequest<Result>;

public sealed record GuardianConsentCommand(Guid UserId, string Token, bool Granted) : IRequest<Result>;

public sealed record CompleteOnboardingCommand(LearningGoal Goal, int DailyMinutes, string NativeLanguage) : IRequest<Result>;

public sealed record DeleteAccountCommand(string? Password) : IRequest<Result>;

public sealed record OnboardingDto(string Goal, int DailyMinutes, string NativeLanguage);

public sealed record MeDto(
    Guid Id,
    string Email,
    bool EmailVerified,
    string GuardianConsent,
    bool HasPassword,
    IReadOnlyList<string> Logins,
    IReadOnlyList<string> Roles,
    OnboardingDto? Onboarding);

public sealed record GetMeQuery : IRequest<Result<MeDto>>;

internal sealed class RegisterValidator : AbstractValidator<RegisterCommand>
{
    public RegisterValidator()
    {
        RuleFor(c => c.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(c => c.Password).NotEmpty().MaximumLength(128);
        RuleFor(c => c.DateOfBirth).NotEmpty();
        RuleFor(c => c.GuardianEmail).EmailAddress().MaximumLength(256).When(c => !string.IsNullOrEmpty(c.GuardianEmail));
        RuleFor(c => c.AcceptedTerms).Equal(true).WithMessage("You must accept the terms and privacy policy.");
    }
}

internal sealed class ResetPasswordValidator : AbstractValidator<ResetPasswordCommand>
{
    public ResetPasswordValidator()
    {
        RuleFor(c => c.Token).NotEmpty();
        RuleFor(c => c.NewPassword).NotEmpty().MaximumLength(128);
    }
}

internal sealed class AccountHandlers(
    UserManager<ApplicationUser> users,
    AppIdentityDbContext db,
    AccountRegistrar registrar,
    AccountEmails emails,
    IIntegrationEventPublisher publisher,
    IOpenIddictTokenManager tokens,
    ICurrentUser currentUser,
    IClock clock) :
    IRequestHandler<RegisterCommand, Result<RegisteredDto>>,
    IRequestHandler<VerifyEmailCommand, Result>,
    IRequestHandler<ResendVerificationCommand, Result>,
    IRequestHandler<ForgotPasswordCommand, Result>,
    IRequestHandler<ResetPasswordCommand, Result>,
    IRequestHandler<GuardianConsentCommand, Result>,
    IRequestHandler<CompleteOnboardingCommand, Result>,
    IRequestHandler<DeleteAccountCommand, Result>,
    IRequestHandler<GetMeQuery, Result<MeDto>>
{
    private static readonly Error InvalidLink = new("account.invalid_token", "This link is invalid or has expired.");

    public async Task<Result<RegisteredDto>> Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        var created = await registrar.CreateAsync(
            new NewAccount(request.Email, request.Password, request.DateOfBirth, request.GuardianEmail),
            cancellationToken);
        return created.IsSuccess
            ? new RegisteredDto(created.Value.Id, created.Value.GuardianConsent == GuardianConsentStatus.Pending)
            : created.Error!;
    }

    public async Task<Result> Handle(VerifyEmailCommand request, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(request.UserId.ToString());
        if (user is null)
        {
            return InvalidLink;
        }

        var result = await users.ConfirmEmailAsync(user, request.Token);
        return result.Succeeded ? Result.Success() : InvalidLink;
    }

    public async Task<Result> Handle(ResendVerificationCommand request, CancellationToken cancellationToken)
    {
        var user = await CurrentAsync();
        if (user is { EmailConfirmed: false })
        {
            await emails.SendVerificationAsync(user, cancellationToken);
        }

        return Result.Success();
    }

    /// <summary>Always succeeds so the response doesn't reveal whether an account exists.</summary>
    public async Task<Result> Handle(ForgotPasswordCommand request, CancellationToken cancellationToken)
    {
        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is not null && await users.HasPasswordAsync(user))
        {
            await emails.SendPasswordResetAsync(user, cancellationToken);
        }

        return Result.Success();
    }

    public async Task<Result> Handle(ResetPasswordCommand request, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(request.UserId.ToString());
        if (user is null)
        {
            return InvalidLink;
        }

        // Also rotates the security stamp, which invalidates existing refresh tokens.
        var result = await users.ResetPasswordAsync(user, request.Token, request.NewPassword);
        if (!result.Succeeded)
        {
            return AccountRegistrar.ToError(result);
        }

        if (!user.EmailConfirmed)
        {
            // The reset link proved ownership of the address.
            user.EmailConfirmed = true;
            await users.UpdateAsync(user);
        }

        await users.ResetAccessFailedCountAsync(user);
        await users.SetLockoutEndDateAsync(user, null);
        return Result.Success();
    }

    public async Task<Result> Handle(GuardianConsentCommand request, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(request.UserId.ToString());
        if (user is not { GuardianConsent: GuardianConsentStatus.Pending }
            || !await users.VerifyUserTokenAsync(user, TokenOptions.DefaultProvider, AccountRegistrar.GuardianConsentPurpose, request.Token))
        {
            return InvalidLink;
        }

        if (!request.Granted)
        {
            // A declined request erases the child's account and data.
            return await DeleteAsync(user, cancellationToken);
        }

        user.GuardianConsent = GuardianConsentStatus.Granted;
        user.GuardianConsentAt = clock.UtcNow;
        var updated = await users.UpdateAsync(user);
        return updated.Succeeded ? Result.Success() : AccountRegistrar.ToError(updated);
    }

    public async Task<Result> Handle(CompleteOnboardingCommand request, CancellationToken cancellationToken)
    {
        var preferences = OnboardingPreferences.Create(request.Goal, request.DailyMinutes, request.NativeLanguage);
        if (!preferences.IsSuccess)
        {
            return preferences.Error!;
        }

        var user = await CurrentAsync();
        if (user is null)
        {
            return Error.NotFound("account.not_found", "Account not found.");
        }

        var p = preferences.Value;
        user.Goal = p.Goal;
        user.DailyMinutes = p.DailyMinutes;
        user.NativeLanguage = p.NativeLanguage;
        user.OnboardedAt ??= clock.UtcNow;

        // UpdateAsync saves the context, so the outbox message commits with the profile change.
        await publisher.PublishAsync(
            new OnboardingCompleted(user.Id, p.Goal.ToString().ToLowerInvariant(), p.DailyMinutes, p.NativeLanguage),
            cancellationToken);
        var updated = await users.UpdateAsync(user);
        return updated.Succeeded ? Result.Success() : AccountRegistrar.ToError(updated);
    }

    public async Task<Result> Handle(DeleteAccountCommand request, CancellationToken cancellationToken)
    {
        var user = await CurrentAsync();
        if (user is null)
        {
            return Result.Success();
        }

        // Re-authenticate password accounts before an irreversible action.
        if (await users.HasPasswordAsync(user)
            && (request.Password is null || !await users.CheckPasswordAsync(user, request.Password)))
        {
            return new Error("account.password_required", "Enter your password to delete your account.", ErrorType.Forbidden);
        }

        return await DeleteAsync(user, cancellationToken);
    }

    public async Task<Result<MeDto>> Handle(GetMeQuery request, CancellationToken cancellationToken)
    {
        var user = await CurrentAsync();
        if (user is null)
        {
            return Error.NotFound("account.not_found", "Account not found.");
        }

        var logins = await users.GetLoginsAsync(user);
        var roles = await users.GetRolesAsync(user);
        return new MeDto(
            user.Id,
            user.Email!,
            user.EmailConfirmed,
            user.GuardianConsent.ToString(),
            await users.HasPasswordAsync(user),
            logins.Select(l => l.LoginProvider).ToList(),
            roles.Order().ToList(),
            user is { Goal: { } goal, DailyMinutes: { } minutes, NativeLanguage: { } language }
                ? new OnboardingDto(goal.ToString().ToLowerInvariant(), minutes, language)
                : null);
    }

    private Task<ApplicationUser?> CurrentAsync() => users.FindByIdAsync(currentUser.UserId.ToString());

    /// <summary>Deletes the account and tells other services to erase the learner's data (NFR-08).</summary>
    private async Task<Result> DeleteAsync(ApplicationUser user, CancellationToken cancellationToken)
    {
        Error? failure = null;
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            await publisher.PublishAsync(new UserDeleted(user.Id, clock.UtcNow), cancellationToken);
            var deleted = await users.DeleteAsync(user);
            if (!deleted.Succeeded)
            {
                failure = AccountRegistrar.ToError(deleted);
                return;
            }

            await transaction.CommitAsync(cancellationToken);
        });

        if (failure is not null)
        {
            db.ChangeTracker.Clear();
            return failure;
        }

        // Refresh tokens would already fail (unknown subject); revoking them keeps the token store clean.
        await foreach (var token in tokens.FindBySubjectAsync(user.Id.ToString(), cancellationToken))
        {
            await tokens.TryRevokeAsync(token, cancellationToken);
        }

        return Result.Success();
    }
}
