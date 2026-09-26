using System.Text.Json;
using System.Text.Json.Nodes;
using EnglishPath.BuildingBlocks.Application;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Contracts;
using EnglishPath.Learning.Application.Abstractions;
using EnglishPath.Learning.Domain.Content;
using EnglishPath.Learning.Domain.Placement;
using EnglishPath.Learning.Domain.Units;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Learning.Application.Placement;

/// <summary>A placement question with the answer key and explanation removed (scored on the server).</summary>
public sealed record PlacementQuestionDto(Guid ItemId, JsonObject Exercise);

public sealed record PlacementResultDto(string StartLevel, string? HighestPassedLevel);

public sealed record PlacementStepDto(Guid SessionId, int Answered, int MaxQuestions, PlacementQuestionDto? Question, PlacementResultDto? Result);

/// <summary>Starts a placement test, or resumes the learner's unfinished one (FR-10).</summary>
public sealed record StartPlacementCommand : IRequest<Result<PlacementStepDto>>;

public sealed record AnswerPlacementCommand(Guid SessionId, Guid ItemId, JsonElement Answer) : IRequest<Result<PlacementStepDto>>;

/// <summary>FR-11: skip placement and start from Pre-A1.</summary>
public sealed record SkipPlacementCommand : IRequest<Result>;

internal sealed class PlacementHandlers(
    ILearningDbContext db,
    ICurrentUser user,
    IIntegrationEventPublisher publisher,
    IClock clock) :
    IRequestHandler<StartPlacementCommand, Result<PlacementStepDto>>,
    IRequestHandler<AnswerPlacementCommand, Result<PlacementStepDto>>,
    IRequestHandler<SkipPlacementCommand, Result>
{
    private static readonly Error Unavailable = Error.Conflict("placement.unavailable", "The placement test isn't available yet.");

    public async Task<Result<PlacementStepDto>> Handle(StartPlacementCommand request, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var session = await db.PlacementSessions
            .Where(s => s.UserId == user.UserId && s.Status == PlacementStatus.InProgress)
            .OrderByDescending(s => s.StartedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (session is null || session.IsExpired(now))
        {
            var itemLevels = await db.PlacementItems.Where(i => i.IsActive).Select(i => i.Level).Distinct().ToListAsync(cancellationToken);
            if (itemLevels.Count == 0)
            {
                return Unavailable;
            }

            // Results are capped at the highest level that has lessons to start from.
            var contentLevels = await db.Units
                .Where(u => db.Lessons.Any(l => l.UnitId == u.Id && l.PublishedVersion != null))
                .Select(u => u.Level)
                .Distinct()
                .ToListAsync(cancellationToken);
            var min = itemLevels.Min();
            var max = contentLevels.Count > 0 ? contentLevels.Max() : itemLevels.Max();
            session = PlacementSession.Start(user.UserId, min, max < min ? min : max, now);
            db.PlacementSessions.Add(session);
        }

        return await NextStepAsync(session, cancellationToken);
    }

    public async Task<Result<PlacementStepDto>> Handle(AnswerPlacementCommand request, CancellationToken cancellationToken)
    {
        var session = await db.PlacementSessions
            .SingleOrDefaultAsync(s => s.Id == request.SessionId && s.UserId == user.UserId, cancellationToken);
        if (session is null)
        {
            return Error.NotFound("placement.not_found", "Placement test not found.");
        }

        var item = await db.PlacementItems.AsNoTracking().SingleOrDefaultAsync(i => i.Id == request.ItemId, cancellationToken);
        if (item is null)
        {
            return Error.Conflict("placement.unexpected_item", "That question is not the current one.");
        }

        var recorded = session.RecordAnswer(item.Id, AnswerChecker.IsCorrect(item.Exercise, request.Answer), clock.UtcNow);
        if (!recorded.IsSuccess)
        {
            return recorded.Error!;
        }

        return await NextStepAsync(session, cancellationToken);
    }

    public async Task<Result> Handle(SkipPlacementCommand request, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var placement = await UpsertPlacementAsync(cancellationToken);
        placement.Skip(CefrLevel.PreA1, now);
        await publisher.PublishAsync(new PlacementCompleted(user.UserId, CefrLevel.PreA1.ToString(), null, true, now), cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    /// <summary>Presents the next question, or records the result if the test is over.</summary>
    private async Task<Result<PlacementStepDto>> NextStepAsync(PlacementSession session, CancellationToken cancellationToken)
    {
        PlacementItem? item = null;
        if (session.Status == PlacementStatus.InProgress)
        {
            item = session.PendingItemId is { } pending
                ? await db.PlacementItems.AsNoTracking().SingleAsync(i => i.Id == pending, cancellationToken)
                : await PickNextAsync(session, cancellationToken);
            if (item is null)
            {
                session.Finish(clock.UtcNow);
            }
            else
            {
                session.Present(item.Id);
            }
        }

        PlacementResultDto? result = null;
        foreach (var completed in session.DomainEvents.OfType<PlacementCompletedDomainEvent>())
        {
            var placement = await UpsertPlacementAsync(cancellationToken);
            placement.Place(completed.StartLevel, clock.UtcNow);
            await publisher.PublishAsync(
                new PlacementCompleted(completed.UserId, completed.StartLevel.ToString(), completed.HighestPassed?.ToString(), false, clock.UtcNow),
                cancellationToken);
        }

        session.ClearDomainEvents();
        await db.SaveChangesAsync(cancellationToken);

        if (session.Status == PlacementStatus.Completed)
        {
            result = new PlacementResultDto(session.StartLevel!.Value.ToString(), session.HighestPassed?.ToString());
        }

        return new PlacementStepDto(
            session.Id,
            session.Responses.Count,
            session.MaxQuestions,
            item is null ? null : new PlacementQuestionDto(item.Id, ToQuestion(item)),
            result);
    }

    /// <summary>An unused item at the current level, rotating skills so each block mixes them (FR-10).</summary>
    private async Task<PlacementItem?> PickNextAsync(PlacementSession session, CancellationToken cancellationToken)
    {
        var asked = session.AskedItemIds;
        var candidates = await db.PlacementItems.AsNoTracking()
            .Where(i => i.IsActive && i.Level == session.CurrentLevel)
            .ToListAsync(cancellationToken);
        candidates = candidates.Where(i => !asked.Contains(i.Id)).ToList();
        if (candidates.Count == 0)
        {
            return null;
        }

        var askedSkills = await db.PlacementItems.AsNoTracking()
            .Where(i => asked.Contains(i.Id))
            .Select(i => i.Skill)
            .ToListAsync(cancellationToken);
        return candidates
            .OrderBy(i => askedSkills.Count(s => s == i.Skill))
            .ThenBy(i => HashCode.Combine(session.Id, i.Id))
            .First();
    }

    private async Task<LearnerPlacement> UpsertPlacementAsync(CancellationToken cancellationToken)
    {
        var placement = await db.Placements.SingleOrDefaultAsync(p => p.Id == user.UserId, cancellationToken);
        if (placement is null)
        {
            placement = LearnerPlacement.Create(user.UserId);
            db.Placements.Add(placement);
        }

        return placement;
    }

    private static JsonObject ToQuestion(PlacementItem item)
    {
        var node = JsonNode.Parse(item.Content)!.AsObject();
        node.Remove("correctIndex");
        node.Remove("acceptedAnswers");
        node.Remove("explanation");
        node["id"] = item.Id.ToString();
        return node;
    }
}
