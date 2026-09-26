using System.Text.Json.Nodes;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Learning.Application.Abstractions;
using EnglishPath.Learning.Domain.Lessons;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Learning.Application.Learner;

/// <summary>
/// Returns the live version of a lesson as the JSON bundle the client renders and caches
/// offline (FR-21, NFR-05). Shape matches <c>Lesson</c> in packages/core.
/// </summary>
public sealed record GetLessonQuery(Guid LessonId) : IRequest<Result<JsonObject>>;

internal sealed class GetLessonHandler(ILearningDbContext db) : IRequestHandler<GetLessonQuery, Result<JsonObject>>
{
    public async Task<Result<JsonObject>> Handle(GetLessonQuery request, CancellationToken cancellationToken)
    {
        var live = await db.Lessons.AsNoTracking()
            .Where(l => l.Id == request.LessonId && l.PublishedVersion != null)
            .SelectMany(l => l.Versions.Where(v => v.Version == l.PublishedVersion), (l, v) => new { l.UnitId, Version = v })
            .SingleOrDefaultAsync(cancellationToken);

        if (live is null)
        {
            return LessonErrors.NotFound;
        }

        var bundle = JsonNode.Parse(live.Version.Content)!.AsObject();
        bundle["id"] = request.LessonId.ToString();
        bundle["unitId"] = live.UnitId.ToString();
        bundle["version"] = live.Version.Version;
        bundle["title"] = live.Version.Title;
        return bundle;
    }
}
