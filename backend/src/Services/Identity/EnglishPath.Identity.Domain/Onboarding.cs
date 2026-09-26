using System.Text.RegularExpressions;
using EnglishPath.BuildingBlocks.Domain;

namespace EnglishPath.Identity.Domain;

/// <summary>Why the learner is studying (FR-02).</summary>
public enum LearningGoal
{
    Work,
    Travel,
    Study,
    Exam,
}

/// <summary>Onboarding answers (FR-02): goal, daily time target and native language.</summary>
public sealed partial record OnboardingPreferences(LearningGoal Goal, int DailyMinutes, string NativeLanguage)
{
    public static readonly IReadOnlySet<int> AllowedDailyMinutes = new HashSet<int> { 5, 10, 15, 20 };

    public static Result<OnboardingPreferences> Create(LearningGoal goal, int dailyMinutes, string nativeLanguage)
    {
        if (!Enum.IsDefined(goal))
        {
            return new Error("onboarding.goal", "Unknown learning goal.");
        }

        if (!AllowedDailyMinutes.Contains(dailyMinutes))
        {
            return new Error("onboarding.daily_minutes", "Daily goal must be 5, 10, 15 or 20 minutes.");
        }

        var language = (nativeLanguage ?? string.Empty).Trim().ToLowerInvariant();
        if (!LanguageCode().IsMatch(language))
        {
            return new Error("onboarding.native_language", "Native language must be an ISO 639 code, e.g. 'ar' or 'ml'.");
        }

        return new OnboardingPreferences(goal, dailyMinutes, language);
    }

    [GeneratedRegex("^[a-z]{2,3}$")]
    private static partial Regex LanguageCode();
}
