using EnglishPath.BuildingBlocks.Application;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Progress.Domain.Learners;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Progress.Application;

/// <summary>Matches <c>DashboardDto</c> in packages/core. Skill values are 0–100, relative to the learner's strongest skill.</summary>
public sealed record DashboardDto(
    int Streak,
    int LongestStreak,
    int TotalXp,
    int TodayXp,
    int DailyGoalXp,
    int LessonsCompleted,
    int WordsLearned,
    int ReviewsDue,
    IReadOnlyDictionary<string, int> Skills);

/// <summary>Learner dashboard (FR-60). <paramref name="Today"/> is the learner's local date.</summary>
public sealed record GetDashboardQuery(DateOnly Today) : IRequest<Result<DashboardDto>>;

internal sealed class GetDashboardValidator : AbstractValidator<GetDashboardQuery>
{
    public GetDashboardValidator(IClock clock) =>
        RuleFor(q => q.Today).Must(d => LocalDay.IsPlausible(d, clock.UtcNow)).WithMessage("Local day is out of range.");
}

internal sealed class GetDashboardHandler(IProgressDbContext db, ICurrentUser user, IClock clock)
    : IRequestHandler<GetDashboardQuery, Result<DashboardDto>>
{
    public async Task<Result<DashboardDto>> Handle(GetDashboardQuery request, CancellationToken cancellationToken)
    {
        var progress = await db.Learners.AsNoTracking()
            .Include(l => l.Days.Where(d => d.Day == request.Today))
            .Include(l => l.SkillPractice)
            .SingleOrDefaultAsync(l => l.Id == user.UserId, cancellationToken)
            ?? LearnerProgress.Start(user.UserId);

        var now = clock.UtcNow;
        var cards = db.ReviewCards.AsNoTracking().Where(c => c.UserId == user.UserId);
        var wordsLearned = await cards.CountAsync(cancellationToken);
        var reviewsDue = await cards.CountAsync(c => c.DueAt <= now, cancellationToken);

        var max = progress.SkillPractice.Select(s => s.LessonsPracticed).DefaultIfEmpty(0).Max();
        var skills = LearnerProgress.Skills.ToDictionary(
            s => s,
            s => max == 0 ? 0 : (int)Math.Round(100.0 * (progress.SkillPractice.SingleOrDefault(p => p.Skill == s)?.LessonsPracticed ?? 0) / max));

        return new DashboardDto(
            progress.Streak.EffectiveOn(request.Today),
            progress.Streak.Longest,
            progress.TotalXp,
            progress.XpOn(request.Today),
            progress.DailyGoalXp,
            progress.LessonsCompleted,
            wordsLearned,
            reviewsDue,
            skills);
    }
}
