using EnglishPath.Identity.Domain;
using Microsoft.AspNetCore.Identity;

namespace EnglishPath.Identity.Api.Data;

/// <summary>A learner or staff account (FR-01). Personal data is limited to what the BRD requires.</summary>
public sealed class ApplicationUser : IdentityUser<Guid>
{
    public DateOnly DateOfBirth { get; set; }

    /// <summary>Guardian contact for learners aged 13–17 (FR-05).</summary>
    public string? GuardianEmail { get; set; }

    public GuardianConsentStatus GuardianConsent { get; set; }

    public DateTimeOffset? GuardianConsentAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public LearningGoal? Goal { get; set; }

    public int? DailyMinutes { get; set; }

    public string? NativeLanguage { get; set; }

    public DateTimeOffset? OnboardedAt { get; set; }

    /// <summary>Whether the account may sign in. Minors wait for guardian consent.</summary>
    public bool CanUseAccount => GuardianConsent != GuardianConsentStatus.Pending;
}
