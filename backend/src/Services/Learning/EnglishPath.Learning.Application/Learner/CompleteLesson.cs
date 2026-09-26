using System.Text.Json;
using EnglishPath.BuildingBlocks.Application;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Contracts;
using EnglishPath.Learning.Application.Abstractions;
using EnglishPath.Learning.Domain.Completions;
using EnglishPath.Learning.Domain.Content;
using EnglishPath.Learning.Domain.Lessons;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Learning.Application.Learner;

public sealed record AttemptInput(string ExerciseId, JsonElement Answer, DateTimeOffset AnsweredAt, int TimeTakenMs);

/// <summary>
/// Syncs a finished lesson from the client. The server re-grades every attempt against the
/// lesson version the learner played and publishes <see cref="LessonCompleted"/> so Progress
/// can award XP, streaks and review cards (BRD §8.3 decisions 3 and 4).
/// </summary>
public sealed record CompleteLessonCommand(
    Guid LessonId,
    Guid CompletionId,
    int LessonVersion,
    DateOnly LearnerLocalDay,
    IReadOnlyList<AttemptInput> Attempts) : IRequest<Result<CompletionResultDto>>;

public sealed record CompletionResultDto(Guid CompletionId, int CorrectFirstTry, int TotalExercises);

internal sealed class CompleteLessonValidator : AbstractValidator<CompleteLessonCommand>
{
    public CompleteLessonValidator(IClock clock)
    {
        RuleFor(c => c.CompletionId).NotEmpty();
        RuleFor(c => c.LessonVersion).GreaterThan(0);
        RuleFor(c => c.Attempts).NotEmpty().Must(a => a.Count <= 100).WithMessage("Too many attempts.");
        RuleForEach(c => c.Attempts).ChildRules(a =>
        {
            a.RuleFor(x => x.ExerciseId).NotEmpty();
            a.RuleFor(x => x.TimeTakenMs).GreaterThanOrEqualTo(0);
        });

        // Attempts can't come from the future, and the learner's local day must match when they
        // answered (time zones put it within one day of the UTC date).
        RuleForEach(c => c.Attempts)
            .Must(a => a.AnsweredAt <= clock.UtcNow.AddMinutes(5))
            .WithMessage("Attempt time is in the future.");
        RuleFor(c => c)
            .Must(c => Math.Abs(c.LearnerLocalDay.DayNumber - DateOnly.FromDateTime(c.Attempts.Max(a => a.AnsweredAt).UtcDateTime).DayNumber) <= 1)
            .When(c => c.Attempts.Count > 0)
            .WithName(nameof(CompleteLessonCommand.LearnerLocalDay))
            .WithMessage("Local day does not match the attempt times.");
    }
}

internal sealed class CompleteLessonHandler(
    ILearningDbContext db,
    ICurrentUser user,
    IIntegrationEventPublisher publisher,
    IClock clock) : IRequestHandler<CompleteLessonCommand, Result<CompletionResultDto>>
{
    public async Task<Result<CompletionResultDto>> Handle(CompleteLessonCommand request, CancellationToken cancellationToken)
    {
        var existing = await db.Completions.AsNoTracking()
            .SingleOrDefaultAsync(c => c.Id == request.CompletionId, cancellationToken);
        if (existing is not null)
        {
            // Idempotent retry of an offline sync.
            return existing.UserId == user.UserId && existing.LessonId == request.LessonId
                ? new CompletionResultDto(existing.Id, existing.CorrectFirstTry, existing.TotalExercises)
                : Error.Conflict("completion.id_conflict", "Completion id already used.");
        }

        var version = await db.Lessons.AsNoTracking()
            .Where(l => l.Id == request.LessonId && l.PublishedVersion != null)
            .SelectMany(l => l.Versions.Where(v => v.Version == request.LessonVersion))
            .SingleOrDefaultAsync(cancellationToken);
        if (version is null)
        {
            return LessonErrors.NotFound;
        }

        var attempts = request.Attempts
            .Select(a => new SubmittedAttempt(a.ExerciseId, a.Answer, a.AnsweredAt, a.TimeTakenMs))
            .ToList();
        var graded = CompletionGrader.Grade(LessonContent.Parse(version.Content), attempts);
        if (!graded.IsSuccess)
        {
            return graded.Error!;
        }

        var now = clock.UtcNow;
        var completion = LessonCompletion.Record(
            request.CompletionId,
            user.UserId,
            request.LessonId,
            request.LessonVersion,
            graded.Value.CorrectFirstTry,
            graded.Value.TotalExercises,
            request.LearnerLocalDay,
            now);
        db.Completions.Add(completion);

        await publisher.PublishAsync(
            new LessonCompleted(
                completion.Id,
                completion.UserId,
                completion.LessonId,
                completion.LessonVersion,
                completion.CorrectFirstTry,
                completion.TotalExercises,
                graded.Value.SkillsPracticed,
                graded.Value.VocabularyIds,
                now,
                request.LearnerLocalDay),
            cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        return new CompletionResultDto(completion.Id, completion.CorrectFirstTry, completion.TotalExercises);
    }
}
