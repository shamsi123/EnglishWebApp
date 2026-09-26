namespace EnglishPath.Identity.Domain;

public enum AgeBracket
{
    /// <summary>Below the minimum age; registration is refused.</summary>
    TooYoung,

    /// <summary>13–17: needs verifiable guardian consent before the account can be used (FR-05).</summary>
    Minor,

    Adult,
}

/// <summary>
/// Age gating (BRD §10 Compliance). The minimum age follows the BRD recommendation of 13 and is
/// configurable while the open question on younger learners is decided.
/// </summary>
public static class AgePolicy
{
    public const int DefaultMinimumAge = 13;
    public const int AdultAge = 18;

    public static int AgeOn(DateOnly dateOfBirth, DateOnly today)
    {
        var age = today.Year - dateOfBirth.Year;
        return dateOfBirth > today.AddYears(-age) ? age - 1 : age;
    }

    public static AgeBracket Classify(DateOnly dateOfBirth, DateOnly today, int minimumAge = DefaultMinimumAge)
    {
        if (dateOfBirth > today)
        {
            throw new ArgumentOutOfRangeException(nameof(dateOfBirth), "Date of birth is in the future.");
        }

        var age = AgeOn(dateOfBirth, today);
        return age < minimumAge ? AgeBracket.TooYoung : age < AdultAge ? AgeBracket.Minor : AgeBracket.Adult;
    }
}

public enum GuardianConsentStatus
{
    NotRequired = 0,
    Pending = 1,
    Granted = 2,
}
