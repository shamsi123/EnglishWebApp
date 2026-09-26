using EnglishPath.BuildingBlocks.Domain;

namespace EnglishPath.Progress.Domain.Reviews;

/// <summary>
/// A word in the learner's word bank scheduled with SM-2 (FR-30, FR-31). Mirrors
/// packages/core/src/srs/sm2.ts.
/// </summary>
public sealed class ReviewCard : Entity<Guid>
{
    public const double MinEase = 1.3;
    public const double InitialEase = 2.5;

    private ReviewCard()
    {
    }

    public Guid UserId { get; private set; }

    public string VocabularyId { get; private set; } = string.Empty;

    public int Repetitions { get; private set; }

    public int IntervalDays { get; private set; }

    public double EaseFactor { get; private set; } = InitialEase;

    public DateTimeOffset DueAt { get; private set; }

    public DateTimeOffset? LastReviewedAt { get; private set; }

    public static ReviewCard Create(Guid userId, string vocabularyId, DateTimeOffset now)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(vocabularyId);
        return new ReviewCard { Id = Guid.NewGuid(), UserId = userId, VocabularyId = vocabularyId, DueAt = now };
    }

    public bool IsDue(DateTimeOffset now) => DueAt <= now;

    /// <param name="grade">0 = blackout … 5 = perfect recall; below 3 is a lapse.</param>
    public void Review(int grade, DateTimeOffset now)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(grade);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(grade, 5);

        if (grade < 3)
        {
            Repetitions = 0;
            IntervalDays = 1;
        }
        else
        {
            Repetitions++;
            IntervalDays = Repetitions switch
            {
                1 => 1,
                2 => 6,
                _ => (int)Math.Round(IntervalDays * EaseFactor, MidpointRounding.AwayFromZero),
            };
        }

        var ease = EaseFactor + (0.1 - ((5 - grade) * (0.08 + ((5 - grade) * 0.02))));
        EaseFactor = Math.Round(Math.Max(MinEase, ease), 3, MidpointRounding.AwayFromZero);
        DueAt = now.AddDays(IntervalDays);
        LastReviewedAt = now;
    }
}
