using EnglishPath.Identity.Domain;

namespace EnglishPath.Identity.Tests;

public class AgePolicyTests
{
    private static readonly DateOnly Today = new(2026, 9, 26);

    [Theory]
    [InlineData("2013-09-27", AgeBracket.TooYoung)] // 12, turns 13 tomorrow
    [InlineData("2013-09-26", AgeBracket.Minor)] // 13 today
    [InlineData("2008-09-27", AgeBracket.Minor)] // 17, turns 18 tomorrow
    [InlineData("2008-09-26", AgeBracket.Adult)] // 18 today
    [InlineData("1976-01-01", AgeBracket.Adult)]
    public void Classifies_by_age_on_the_day(string dateOfBirth, AgeBracket expected) =>
        Assert.Equal(expected, AgePolicy.Classify(DateOnly.Parse(dateOfBirth), Today));

    [Fact]
    public void Handles_leap_day_birthdays() =>
        Assert.Equal(17, AgePolicy.AgeOn(new DateOnly(2008, 2, 29), new DateOnly(2026, 2, 28)));

    [Fact]
    public void Minimum_age_is_configurable() =>
        Assert.Equal(AgeBracket.Minor, AgePolicy.Classify(new DateOnly(2016, 1, 1), Today, minimumAge: 10));

    [Fact]
    public void Rejects_future_birth_dates() =>
        Assert.Throws<ArgumentOutOfRangeException>(() => AgePolicy.Classify(Today.AddDays(1), Today));
}

public class OnboardingTests
{
    [Fact]
    public void Accepts_valid_preferences_and_normalises_language()
    {
        var result = OnboardingPreferences.Create(LearningGoal.Work, 10, " ML ");
        Assert.True(result.IsSuccess);
        Assert.Equal("ml", result.Value.NativeLanguage);
    }

    [Theory]
    [InlineData(LearningGoal.Travel, 7, "ar", "onboarding.daily_minutes")]
    [InlineData(LearningGoal.Travel, 5, "arabic", "onboarding.native_language")]
    [InlineData((LearningGoal)99, 5, "ar", "onboarding.goal")]
    public void Rejects_invalid_preferences(LearningGoal goal, int minutes, string language, string code) =>
        Assert.Equal(code, OnboardingPreferences.Create(goal, minutes, language).Error!.Code);
}
