using EnglishPath.Progress.Domain.Learners;
using EnglishPath.Progress.Domain.Reviews;

namespace EnglishPath.Progress.UnitTests;

// Vectors mirror packages/core/src/gamification/rules.test.ts and srs/sm2.test.ts so client
// and server stay in parity.
public class GamificationTests
{
    private static readonly DateOnly Day = new(2026, 9, 26);

    [Theory]
    [InlineData(10, 10, 25)]
    [InlineData(7, 10, 17)]
    [InlineData(0, 8, 10)]
    public void LessonXp_matches_client(int correct, int total, int expected) =>
        Assert.Equal(expected, GamificationRules.LessonXp(correct, total));

    [Fact]
    public void LessonXp_rejects_impossible_results() =>
        Assert.Throws<ArgumentOutOfRangeException>(() => GamificationRules.LessonXp(11, 10));

    private static readonly Streak Base = new(3, 5, new DateOnly(2026, 9, 25), 1);

    [Fact]
    public void Streak_starts_extends_and_ignores_same_day()
    {
        Assert.Equal((new Streak(1, 1, Day, 0), StreakOutcome.Extended), Streak.None.RecordActivity(Day));
        Assert.Equal((new Streak(4, 5, Day, 1), StreakOutcome.Extended), Base.RecordActivity(Day));
        Assert.Equal(StreakOutcome.Unchanged, Base.RecordActivity(new DateOnly(2026, 9, 25)).Outcome);
    }

    [Fact]
    public void Streak_uses_freeze_for_one_missed_day()
    {
        var (next, outcome) = Base.RecordActivity(new DateOnly(2026, 9, 27));
        Assert.Equal(StreakOutcome.Frozen, outcome);
        Assert.Equal(new Streak(4, 5, new DateOnly(2026, 9, 27), 0), next);
    }

    [Fact]
    public void Streak_resets_but_keeps_longest()
    {
        var (next, outcome) = Base.RecordActivity(new DateOnly(2026, 9, 29));
        Assert.Equal(StreakOutcome.Reset, outcome);
        Assert.Equal(1, next.Current);
        Assert.Equal(5, next.Longest);
    }

    [Fact]
    public void Effective_streak_drops_to_zero_once_unrecoverable()
    {
        Assert.Equal(3, Base.EffectiveOn(new DateOnly(2026, 9, 26)));
        Assert.Equal(3, Base.EffectiveOn(new DateOnly(2026, 9, 27))); // freeze still available
        Assert.Equal(0, Base.EffectiveOn(new DateOnly(2026, 9, 28)));
    }

    [Fact]
    public void Learner_streak_extends_only_when_daily_goal_is_met()
    {
        var learner = LearnerProgress.Start(Guid.NewGuid()); // default goal 20 XP

        Assert.Equal(17, learner.ApplyLessonCompletion(7, 10, ["grammar"], Day));
        Assert.Equal(0, learner.Streak.Current);

        learner.ApplyLessonCompletion(10, 10, ["listening", "grammar"], Day);
        Assert.Equal(1, learner.Streak.Current);
        Assert.Equal(42, learner.XpOn(Day));
        Assert.Equal(42, learner.TotalXp);
        Assert.Equal(2, learner.LessonsCompleted);

        // A third lesson the same day does not extend again.
        learner.ApplyLessonCompletion(10, 10, [], Day);
        Assert.Equal(1, learner.Streak.Current);
        Assert.Equal(2, learner.SkillPractice.Single(s => s.Skill == "grammar").LessonsPracticed);
    }

    [Fact]
    public void Learner_raises_streak_broken_on_reset()
    {
        var learner = LearnerProgress.Start(Guid.NewGuid());
        learner.ApplyLessonCompletion(10, 10, [], Day);
        learner.ApplyLessonCompletion(10, 10, [], Day.AddDays(1));
        learner.ClearDomainEvents();

        learner.ApplyLessonCompletion(10, 10, [], Day.AddDays(5));

        var broken = Assert.Single(learner.DomainEvents.OfType<StreakBrokenDomainEvent>());
        Assert.Equal(2, broken.PreviousStreak);
        Assert.Equal(1, learner.Streak.Current);
    }

    [Fact]
    public void Unknown_skills_are_ignored()
    {
        var learner = LearnerProgress.Start(Guid.NewGuid());
        learner.ApplyLessonCompletion(1, 8, ["juggling"], Day);
        Assert.Empty(learner.SkillPractice);
    }
}

public class ReviewCardTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 26, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Schedules_1_6_then_interval_times_ease()
    {
        var card = ReviewCard.Create(Guid.NewGuid(), "v-hello", Now);
        Assert.True(card.IsDue(Now));

        card.Review(4, Now);
        Assert.Equal(1, card.IntervalDays);
        card.Review(4, Now);
        Assert.Equal(6, card.IntervalDays);
        card.Review(4, Now);
        Assert.Equal((int)Math.Round(6 * 2.5), card.IntervalDays);
        Assert.Equal(3, card.Repetitions);
        Assert.Equal(Now.AddDays(15), card.DueAt);
    }

    [Fact]
    public void Lapse_resets_repetitions()
    {
        var card = ReviewCard.Create(Guid.NewGuid(), "v", Now);
        card.Review(5, Now);
        card.Review(5, Now);
        card.Review(1, Now);
        Assert.Equal(0, card.Repetitions);
        Assert.Equal(1, card.IntervalDays);
    }

    [Fact]
    public void Ease_never_drops_below_minimum()
    {
        var card = ReviewCard.Create(Guid.NewGuid(), "v", Now);
        for (var i = 0; i < 20; i++)
        {
            card.Review(0, Now);
        }

        Assert.Equal(ReviewCard.MinEase, card.EaseFactor);
    }

    [Fact]
    public void Rejects_invalid_grades() =>
        Assert.Throws<ArgumentOutOfRangeException>(() => ReviewCard.Create(Guid.NewGuid(), "v", Now).Review(6, Now));
}
