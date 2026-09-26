namespace EnglishPath.Progress.Domain.Learners;

/// <summary>
/// XP rules (FR-50). Must stay in parity with packages/core/src/gamification/rules.ts, which the
/// client uses to show XP immediately; the values awarded here are authoritative.
/// </summary>
public static class GamificationRules
{
    public const int XpPerCorrectAnswer = 1;
    public const int XpLessonCompletion = 10;
    public const int XpPerfectLessonBonus = 5;
    public const int DefaultDailyGoalXp = 20;

    public static int LessonXp(int correctAnswers, int totalExercises)
    {
        if (totalExercises <= 0 || correctAnswers < 0 || correctAnswers > totalExercises)
        {
            throw new ArgumentOutOfRangeException(nameof(correctAnswers), "Invalid lesson result.");
        }

        var perfect = correctAnswers == totalExercises ? XpPerfectLessonBonus : 0;
        return (correctAnswers * XpPerCorrectAnswer) + XpLessonCompletion + perfect;
    }
}
