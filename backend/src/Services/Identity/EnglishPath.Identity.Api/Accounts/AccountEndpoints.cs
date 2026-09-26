using EnglishPath.BuildingBlocks.Web;
using EnglishPath.Identity.Domain;
using MediatR;

namespace EnglishPath.Identity.Api.Accounts;

public sealed record VerifyEmailRequest(Guid UserId, string Token);

public sealed record ForgotPasswordRequest(string Email);

public sealed record ResetPasswordRequest(Guid UserId, string Token, string NewPassword);

public sealed record GuardianConsentRequest(Guid UserId, string Token, bool Granted);

public sealed record OnboardingRequest(LearningGoal Goal, int DailyMinutes, string NativeLanguage);

public sealed record DeleteAccountRequest(string? Password);

internal static class AccountEndpoints
{
    public static void MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        var accounts = app.MapGroup("/api/v1/identity/accounts").WithTags("Accounts");

        accounts.MapPost("/", async (RegisterCommand command, ISender sender, CancellationToken ct) =>
            (await sender.Send(command, ct)).ToHttpResult());

        accounts.MapPost("/verify-email", async (VerifyEmailRequest body, ISender sender, CancellationToken ct) =>
            (await sender.Send(new VerifyEmailCommand(body.UserId, body.Token), ct)).ToHttpResult());

        accounts.MapPost("/resend-verification", async (ISender sender, CancellationToken ct) =>
            (await sender.Send(new ResendVerificationCommand(), ct)).ToHttpResult())
            .RequireAuthorization();

        accounts.MapPost("/forgot-password", async (ForgotPasswordRequest body, ISender sender, CancellationToken ct) =>
            (await sender.Send(new ForgotPasswordCommand(body.Email), ct)).ToHttpResult());

        accounts.MapPost("/reset-password", async (ResetPasswordRequest body, ISender sender, CancellationToken ct) =>
            (await sender.Send(new ResetPasswordCommand(body.UserId, body.Token, body.NewPassword), ct)).ToHttpResult());

        accounts.MapPost("/guardian-consent", async (GuardianConsentRequest body, ISender sender, CancellationToken ct) =>
            (await sender.Send(new GuardianConsentCommand(body.UserId, body.Token, body.Granted), ct)).ToHttpResult());

        var me = app.MapGroup("/api/v1/identity/me").RequireAuthorization().WithTags("Me");

        me.MapGet("/", async (ISender sender, CancellationToken ct) =>
            (await sender.Send(new GetMeQuery(), ct)).ToHttpResult());

        me.MapPut("/onboarding", async (OnboardingRequest body, ISender sender, CancellationToken ct) =>
            (await sender.Send(new CompleteOnboardingCommand(body.Goal, body.DailyMinutes, body.NativeLanguage), ct)).ToHttpResult());

        // POST rather than DELETE-with-body so every HTTP client can send the password.
        me.MapPost("/delete", async (DeleteAccountRequest body, ISender sender, CancellationToken ct) =>
            (await sender.Send(new DeleteAccountCommand(body.Password), ct)).ToHttpResult());
    }
}
