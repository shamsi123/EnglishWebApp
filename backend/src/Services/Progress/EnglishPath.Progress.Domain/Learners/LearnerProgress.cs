using EnglishPath.BuildingBlocks.Domain;

namespace EnglishPath.Progress.Domain.Learners;

public sealed record StreakBrokenDomainEvent(Guid UserId, int PreviousStreak, DateOnly Day) : IDomainEvent;

public sealed class DailyActivity
{
    internal DailyActivity(DateOnly day) => Day = day;

    private DailyActivity()
    {
    }

    public DateOnly Day { get; private set; }

    public int Xp { get; internal set; }

    public int LessonsCompleted { get; internal set; }
}

public sealed class SkillPractice
{
    internal SkillPractice(string skill) => Skill = skill;

    private SkillPractice()
    {
    }

    public string Skill { get; private set; } = string.Empty;

    public int LessonsPracticed { get; internal set; }
}

/// <summary>A learner's XP, daily goal, streak and skill practice (FR-50, FR-60). Id is the user id.</summary>
public sealed class LearnerProgress : AggregateRoot<Guid>
{
    public static readonly IReadOnlyList<string> Skills = ["reading", "listening", "speaking", "writing", "grammar", "vocabulary"];

    private readonly List<DailyActivity> _days = [];
    private readonly List<SkillPractice> _skills = [];

    private LearnerProgress()
    {
    }

    public int TotalXp { get; private set; }

    public int DailyGoalXp { get; private set; } = GamificationRules.DefaultDailyGoalXp;

    public int LessonsCompleted { get; private set; }

    public Streak Streak { get; private set; } = Streak.None;

    public IReadOnlyList<DailyActivity> Days => _days;

    public IReadOnlyList<SkillPractice> SkillPractice => _skills;

    public static LearnerProgress Start(Guid userId) => new() { Id = userId };

    public int XpOn(DateOnly day) => _days.SingleOrDefault(d => d.Day == day)?.Xp ?? 0;

    public void SetDailyGoal(int xp)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(xp);
        DailyGoalXp = xp;
    }

    /// <summary>Awards XP for a completed lesson and extends the streak once the day's goal is met.</summary>
    public int ApplyLessonCompletion(int correctFirstTry, int totalExercises, IEnumerable<string> skills, DateOnly localDay)
    {
        var xp = GamificationRules.LessonXp(correctFirstTry, totalExercises);
        var day = _days.SingleOrDefault(d => d.Day == localDay);
        if (day is null)
        {
            day = new DailyActivity(localDay);
            _days.Add(day);
        }

        var goalWasMet = day.Xp >= DailyGoalXp;
        day.Xp += xp;
        day.LessonsCompleted++;
        TotalXp += xp;
        LessonsCompleted++;

        foreach (var skill in skills.Where(Skills.Contains).Distinct())
        {
            var practice = _skills.SingleOrDefault(s => s.Skill == skill);
            if (practice is null)
            {
                practice = new SkillPractice(skill);
                _skills.Add(practice);
            }

            practice.LessonsPracticed++;
        }

        if (!goalWasMet && day.Xp >= DailyGoalXp)
        {
            var previous = Streak.Current;
            var (next, outcome) = Streak.RecordActivity(localDay);
            Streak = next;
            if (outcome == StreakOutcome.Reset)
            {
                Raise(new StreakBrokenDomainEvent(Id, previous, localDay));
            }
        }

        return xp;
    }
}
