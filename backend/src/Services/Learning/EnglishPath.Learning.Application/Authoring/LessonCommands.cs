using System.Text.Json;
using EnglishPath.BuildingBlocks.Application;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Contracts;
using EnglishPath.Learning.Application.Abstractions;
using EnglishPath.Learning.Domain.Content;
using EnglishPath.Learning.Domain.Lessons;
using EnglishPath.Learning.Domain.Vocabulary;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Learning.Application.Authoring;

// CMS authoring workflow: Draft → Review → Published, with versioning and rollback (FR-80, FR-82).
// Role checks (Content Author / Reviewer, FR-91) are applied at the endpoint.

public sealed record CreateLessonCommand(Guid UnitId, int Order, string Title, JsonElement Content, LessonKind Kind = LessonKind.Lesson)
    : IRequest<Result<Guid>>, IAuditedCommand
{
    public string AuditAction => "lesson.created";

    public string? AuditTarget => null;
}

public sealed record UpdateLessonDraftCommand(Guid LessonId, string Title, JsonElement Content) : IRequest<Result>, IAuditedCommand
{
    public string AuditAction => "lesson.draft_updated";

    public string? AuditTarget => LessonId.ToString();
}

public sealed record SubmitLessonForReviewCommand(Guid LessonId) : IRequest<Result>, IAuditedCommand
{
    public string AuditAction => "lesson.submitted";

    public string? AuditTarget => LessonId.ToString();
}

public sealed record RequestLessonChangesCommand(Guid LessonId) : IRequest<Result>, IAuditedCommand
{
    public string AuditAction => "lesson.changes_requested";

    public string? AuditTarget => LessonId.ToString();
}

public sealed record PublishLessonCommand(Guid LessonId) : IRequest<Result>, IAuditedCommand
{
    public string AuditAction => "lesson.published";

    public string? AuditTarget => LessonId.ToString();
}

public sealed record RollbackLessonCommand(Guid LessonId, int Version) : IRequest<Result>, IAuditedCommand
{
    public string AuditAction => $"lesson.rolled_back_to_v{Version}";

    public string? AuditTarget => LessonId.ToString();
}

internal sealed class CreateLessonValidator : AbstractValidator<CreateLessonCommand>
{
    public CreateLessonValidator()
    {
        RuleFor(c => c.UnitId).NotEmpty();
        RuleFor(c => c.Order).GreaterThanOrEqualTo(0);
        RuleFor(c => c.Title).NotEmpty().MaximumLength(200);
        RuleFor(c => c.Kind).IsInEnum();
        RuleFor(c => c.Content.ValueKind).Equal(JsonValueKind.Object).WithMessage("Content must be a JSON object.");
    }
}

internal sealed class UpdateLessonDraftValidator : AbstractValidator<UpdateLessonDraftCommand>
{
    public UpdateLessonDraftValidator()
    {
        RuleFor(c => c.Title).NotEmpty().MaximumLength(200);
        RuleFor(c => c.Content.ValueKind).Equal(JsonValueKind.Object).WithMessage("Content must be a JSON object.");
    }
}

internal sealed class LessonAuthoringHandlers(
    ILearningDbContext db,
    ICurrentUser user,
    IIntegrationEventPublisher publisher,
    IClock clock) :
    IRequestHandler<CreateLessonCommand, Result<Guid>>,
    IRequestHandler<UpdateLessonDraftCommand, Result>,
    IRequestHandler<SubmitLessonForReviewCommand, Result>,
    IRequestHandler<RequestLessonChangesCommand, Result>,
    IRequestHandler<PublishLessonCommand, Result>,
    IRequestHandler<RollbackLessonCommand, Result>
{
    public async Task<Result<Guid>> Handle(CreateLessonCommand request, CancellationToken cancellationToken)
    {
        if (!await db.Units.AnyAsync(u => u.Id == request.UnitId, cancellationToken))
        {
            return Error.NotFound("unit.not_found", "Unit not found.");
        }

        var lesson = Lesson.Create(request.UnitId, request.Order, request.Title, request.Content.GetRawText(), clock.UtcNow, request.Kind);
        db.Lessons.Add(lesson);
        await db.SaveChangesAsync(cancellationToken);
        return lesson.Id;
    }

    public Task<Result> Handle(UpdateLessonDraftCommand request, CancellationToken cancellationToken) =>
        Mutate(request.LessonId, l => l.UpdateDraft(request.Title, request.Content.GetRawText(), clock.UtcNow), cancellationToken);

    public Task<Result> Handle(SubmitLessonForReviewCommand request, CancellationToken cancellationToken) =>
        Mutate(request.LessonId, l => l.SubmitForReview(clock.UtcNow), cancellationToken);

    public Task<Result> Handle(RequestLessonChangesCommand request, CancellationToken cancellationToken) =>
        Mutate(request.LessonId, l => l.RequestChanges(clock.UtcNow), cancellationToken);

    public Task<Result> Handle(PublishLessonCommand request, CancellationToken cancellationToken) =>
        Mutate(request.LessonId, l => l.Publish(user.UserId, clock.UtcNow), cancellationToken);

    public Task<Result> Handle(RollbackLessonCommand request, CancellationToken cancellationToken) =>
        Mutate(request.LessonId, l => l.Rollback(request.Version, user.UserId, clock.UtcNow), cancellationToken);

    private async Task<Result> Mutate(Guid lessonId, Func<Lesson, Result> action, CancellationToken cancellationToken)
    {
        var lesson = await db.Lessons.Include(l => l.Versions).SingleOrDefaultAsync(l => l.Id == lessonId, cancellationToken);
        if (lesson is null)
        {
            return LessonErrors.NotFound;
        }

        var result = action(lesson);
        if (!result.IsSuccess)
        {
            return result;
        }

        foreach (var published in lesson.DomainEvents.OfType<LessonPublishedDomainEvent>())
        {
            await SyncVocabularyAsync(lesson, cancellationToken);
            await publisher.PublishAsync(
                new LessonPublished(published.LessonId, published.UnitId, published.Version, published.PublishedAt),
                cancellationToken);
        }

        lesson.ClearDomainEvents();
        await db.SaveChangesAsync(cancellationToken);
        return result;
    }

    /// <summary>Keeps the vocabulary read model in step with the live lesson (FR-30, FR-32).</summary>
    private async Task SyncVocabularyAsync(Lesson lesson, CancellationToken cancellationToken)
    {
        var entries = LessonContent.Parse(lesson.Live!.Content).Vocabulary;
        var ids = entries.Select(e => e.Id).ToList();
        var existing = await db.Vocabulary.Where(v => ids.Contains(v.Id)).ToDictionaryAsync(v => v.Id, cancellationToken);
        foreach (var entry in entries)
        {
            if (existing.TryGetValue(entry.Id, out var item))
            {
                item.Update(entry, lesson.Id, clock.UtcNow);
            }
            else
            {
                db.Vocabulary.Add(VocabularyItem.From(entry, lesson.Id, clock.UtcNow));
            }
        }
    }
}
