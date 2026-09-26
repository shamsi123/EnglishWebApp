using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Progress.Domain.Learners;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Progress.Application;

/// <summary>Right to erasure (NFR-08): removes a deleted user's progress and word bank.</summary>
public sealed record EraseLearnerDataCommand(Guid UserId) : IRequest<Result>;

/// <summary>Applies the onboarding daily time target (FR-02) as the learner's daily XP goal.</summary>
public sealed record ApplyOnboardingCommand(Guid UserId, int DailyMinutes) : IRequest<Result>;

internal sealed class LearnerLifecycleHandlers(IProgressDbContext db) :
    IRequestHandler<EraseLearnerDataCommand, Result>,
    IRequestHandler<ApplyOnboardingCommand, Result>
{
    public async Task<Result> Handle(EraseLearnerDataCommand request, CancellationToken cancellationToken)
    {
        db.ReviewCards.RemoveRange(await db.ReviewCards.Where(c => c.UserId == request.UserId).ToListAsync(cancellationToken));
        var learner = await db.Learners.Include(l => l.Days).Include(l => l.SkillPractice)
            .SingleOrDefaultAsync(l => l.Id == request.UserId, cancellationToken);
        if (learner is not null)
        {
            db.Learners.Remove(learner);
        }

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }

    public async Task<Result> Handle(ApplyOnboardingCommand request, CancellationToken cancellationToken)
    {
        if (!DailyGoals.XpByMinutes.TryGetValue(request.DailyMinutes, out var xp))
        {
            return new Error("progress.daily_goal", "Daily goal must be 5, 10, 15 or 20 minutes.");
        }

        var learner = await db.Learners.SingleOrDefaultAsync(l => l.Id == request.UserId, cancellationToken);
        if (learner is null)
        {
            learner = LearnerProgress.Start(request.UserId);
            db.Learners.Add(learner);
        }

        learner.SetDailyGoal(xp);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
