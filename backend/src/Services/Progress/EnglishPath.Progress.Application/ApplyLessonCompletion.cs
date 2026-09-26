using EnglishPath.BuildingBlocks.Application;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Contracts;
using EnglishPath.Progress.Domain.Learners;
using EnglishPath.Progress.Domain.Reviews;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Progress.Application;

/// <summary>
/// Handles <see cref="LessonCompleted"/> from Learning: awards XP, updates the streak and skill
/// radar, and adds the lesson's words to the learner's review queue (FR-30, FR-50, FR-60).
/// De-duplication of redelivered messages is handled by the messaging inbox.
/// </summary>
public sealed record ApplyLessonCompletionCommand(LessonCompleted Event) : IRequest<Result<int>>;

internal sealed class ApplyLessonCompletionHandler(IProgressDbContext db, IIntegrationEventPublisher publisher, IClock clock)
    : IRequestHandler<ApplyLessonCompletionCommand, Result<int>>
{
    public async Task<Result<int>> Handle(ApplyLessonCompletionCommand request, CancellationToken cancellationToken)
    {
        var e = request.Event;
        var progress = await db.Learners
            .Include(l => l.Days.Where(d => d.Day == e.LearnerLocalDay))
            .Include(l => l.SkillPractice)
            .SingleOrDefaultAsync(l => l.Id == e.UserId, cancellationToken);
        if (progress is null)
        {
            progress = LearnerProgress.Start(e.UserId);
            db.Learners.Add(progress);
        }

        var xp = progress.ApplyLessonCompletion(e.CorrectFirstTry, e.TotalExercises, e.SkillsPracticed, e.LearnerLocalDay);

        var known = await db.ReviewCards
            .Where(c => c.UserId == e.UserId && e.VocabularyIds.Contains(c.VocabularyId))
            .Select(c => c.VocabularyId)
            .ToListAsync(cancellationToken);
        foreach (var vocabularyId in e.VocabularyIds.Except(known).Distinct())
        {
            db.ReviewCards.Add(ReviewCard.Create(e.UserId, vocabularyId, clock.UtcNow));
        }

        foreach (var broken in progress.DomainEvents.OfType<StreakBrokenDomainEvent>())
        {
            await publisher.PublishAsync(new StreakBroken(broken.UserId, broken.PreviousStreak, broken.Day), cancellationToken);
        }

        progress.ClearDomainEvents();
        await db.SaveChangesAsync(cancellationToken);
        return xp;
    }
}
