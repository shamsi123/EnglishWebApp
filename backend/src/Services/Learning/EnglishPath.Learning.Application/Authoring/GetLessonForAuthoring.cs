using System.Text.Json;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Learning.Application.Abstractions;
using EnglishPath.Learning.Domain.Content;
using EnglishPath.Learning.Domain.Lessons;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Learning.Application.Authoring;

public sealed record LessonVersionDto(int Version, DateTimeOffset PublishedAt, Guid PublishedBy, int? RolledBackFrom);

public sealed record AuthoringLessonDto(
    Guid Id,
    Guid UnitId,
    int Order,
    string Title,
    LessonKind Kind,
    string Status,
    int? PublishedVersion,
    JsonElement Draft,
    IReadOnlyList<string> DraftProblems,
    IReadOnlyList<LessonVersionDto> Versions);

/// <summary>CMS editor view: the draft, its rule violations for live feedback (FR-80), and version history.</summary>
public sealed record GetLessonForAuthoringQuery(Guid LessonId) : IRequest<Result<AuthoringLessonDto>>;

internal sealed class GetLessonForAuthoringHandler(ILearningDbContext db)
    : IRequestHandler<GetLessonForAuthoringQuery, Result<AuthoringLessonDto>>
{
    public async Task<Result<AuthoringLessonDto>> Handle(GetLessonForAuthoringQuery request, CancellationToken cancellationToken)
    {
        var lesson = await db.Lessons.AsNoTracking().Include(l => l.Versions)
            .SingleOrDefaultAsync(l => l.Id == request.LessonId, cancellationToken);
        if (lesson is null)
        {
            return LessonErrors.NotFound;
        }

        using var draft = JsonDocument.Parse(lesson.DraftContent);
        return new AuthoringLessonDto(
            lesson.Id,
            lesson.UnitId,
            lesson.Order,
            lesson.Title,
            lesson.Kind,
            lesson.Status.ToString(),
            lesson.PublishedVersion,
            draft.RootElement.Clone(),
            LessonContentValidator.Validate(lesson.DraftContent),
            lesson.Versions
                .OrderByDescending(v => v.Version)
                .Select(v => new LessonVersionDto(v.Version, v.PublishedAt, v.PublishedBy, v.RolledBackFrom))
                .ToList());
    }
}
