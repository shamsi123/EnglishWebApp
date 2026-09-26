namespace EnglishPath.Progress.Domain.Learners;

public enum StreakOutcome
{
    Unchanged,
    Extended,
    Frozen,
    Reset,
}

/// <summary>
/// Daily streak on the learner's local calendar (FR-50). A missed day is covered by a streak
/// freeze if one is available. Mirrors <c>recordActivity</c> in packages/core.
/// </summary>
public sealed record Streak(int Current, int Longest, DateOnly? LastActiveDay, int FreezesAvailable)
{
    public static readonly Streak None = new(0, 0, null, 0);

    public (Streak Next, StreakOutcome Outcome) RecordActivity(DateOnly today)
    {
        if (LastActiveDay is not { } last)
        {
            return (this with { Current = 1, Longest = Math.Max(Longest, 1), LastActiveDay = today }, StreakOutcome.Extended);
        }

        var gap = today.DayNumber - last.DayNumber;
        if (gap <= 0)
        {
            return (this, StreakOutcome.Unchanged);
        }

        var missedDays = gap - 1;
        if (missedDays == 0 || missedDays <= FreezesAvailable)
        {
            var current = Current + 1;
            return (
                new Streak(current, Math.Max(Longest, current), today, FreezesAvailable - missedDays),
                missedDays == 0 ? StreakOutcome.Extended : StreakOutcome.Frozen);
        }

        return (this with { Current = 1, LastActiveDay = today }, StreakOutcome.Reset);
    }

    /// <summary>The streak to display on <paramref name="today"/>: 0 once it can no longer be continued.</summary>
    public int EffectiveOn(DateOnly today) =>
        LastActiveDay is { } last && today.DayNumber - last.DayNumber - 1 <= FreezesAvailable ? Current : 0;
}
