namespace EnglishPath.Progress.Application;

internal static class LocalDay
{
    /// <summary>A learner's local date is within one day of the UTC date (time zones span UTC−12 to UTC+14).</summary>
    public static bool IsPlausible(DateOnly day, DateTimeOffset utcNow) =>
        Math.Abs(day.DayNumber - DateOnly.FromDateTime(utcNow.UtcDateTime).DayNumber) <= 1;
}
