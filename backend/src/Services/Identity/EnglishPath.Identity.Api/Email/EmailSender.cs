namespace EnglishPath.Identity.Api.Email;

public sealed record EmailMessage(string To, string Subject, string Body);

/// <summary>Transactional email. SendGrid backs this in deployed environments (BRD §8.1).</summary>
public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken);
}

/// <summary>Development sender: writes emails (including their links) to the log instead of sending them.</summary>
internal sealed class LoggingEmailSender(ILogger<LoggingEmailSender> logger) : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        logger.LogInformation("Email to {To}: {Subject}\n{Body}", message.To, message.Subject, message.Body);
        return Task.CompletedTask;
    }
}

/// <summary>Builds links into the web app, which calls back into the account API.</summary>
public sealed class AccountLinks(IConfiguration configuration)
{
    private string BaseUrl => (configuration["Identity:PublicWebUrl"] ?? "http://localhost:5173").TrimEnd('/');

    public string VerifyEmail(Guid userId, string token) => Build("verify-email", userId, token);

    public string ResetPassword(Guid userId, string token) => Build("reset-password", userId, token);

    public string GuardianConsent(Guid userId, string token) => Build("guardian-consent", userId, token);

    private string Build(string path, Guid userId, string token) =>
        $"{BaseUrl}/{path}?userId={userId}&token={Uri.EscapeDataString(token)}";
}
