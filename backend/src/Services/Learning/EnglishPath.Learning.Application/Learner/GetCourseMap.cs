using EnglishPath.BuildingBlocks.Application;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Learning.Application.Abstractions;
using EnglishPath.Learning.Domain.Units;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Learning.Application.Learner;

// DTOs match CourseMapDto in packages/core/src/api/client.ts.
public sealed record CourseMapDto(string CourseId, IReadOnlyList<LevelDto> Levels);

public sealed record LevelDto(string Level, string Title, IReadOnlyList<UnitDto> Units);

public sealed record UnitDto(Guid Id, string Title, string State, IReadOnlyList<LessonSummaryDto> Lessons);

public sealed record LessonSummaryDto(Guid Id, string Title, string State);

public static class LessonStates
{
    public const string Locked = "locked";
    public const string Unlocked = "unlocked";
    public const string Completed = "completed";
}

/// <summary>
/// FR-20 course map. Lessons unlock in order: the first published lesson and any lesson whose
/// predecessor is completed. Placement results (FR-10) and unit checkpoints (FR-12) will
/// adjust the starting point and unit gates.
/// </summary>
public sealed record GetCourseMapQuery : IRequest<Result<CourseMapDto>>;

internal sealed class GetCourseMapHandler(ILearningDbContext db, ICurrentUser user)
    : IRequestHandler<GetCourseMapQuery, Result<CourseMapDto>>
{
    public const string CourseId = "general-english";

    private static readonly Dictionary<CefrLevel, string> LevelTitles = new()
    {
        [CefrLevel.PreA1] = "Pre-A1 Starter",
        [CefrLevel.A1] = "A1 Beginner",
        [CefrLevel.A2] = "A2 Elementary",
        [CefrLevel.B1] = "B1 Intermediate",
        [CefrLevel.B2] = "B2 Upper-intermediate",
    };

    public async Task<Result<CourseMapDto>> Handle(GetCourseMapQuery request, CancellationToken cancellationToken)
    {
        var units = await db.Units.AsNoTracking().ToListAsync(cancellationToken);
        var lessons = await db.Lessons.AsNoTracking()
            .Where(l => l.PublishedVersion != null)
            .Select(l => new { l.Id, l.UnitId, l.Order, l.Title })
            .ToListAsync(cancellationToken);
        var completed = (await db.Completions.AsNoTracking()
            .Where(c => c.UserId == user.UserId)
            .Select(c => c.LessonId)
            .Distinct()
            .ToListAsync(cancellationToken)).ToHashSet();

        var unitOrder = units.ToDictionary(u => u.Id, u => (u.Level, u.Order));
        var orderedLessons = lessons
            .Where(l => unitOrder.ContainsKey(l.UnitId))
            .OrderBy(l => unitOrder[l.UnitId].Level)
            .ThenBy(l => unitOrder[l.UnitId].Order)
            .ThenBy(l => l.Order)
            .ToList();

        var states = new Dictionary<Guid, string>();
        var previousCompleted = true;
        foreach (var lesson in orderedLessons)
        {
            var isCompleted = completed.Contains(lesson.Id);
            states[lesson.Id] = isCompleted ? LessonStates.Completed : previousCompleted ? LessonStates.Unlocked : LessonStates.Locked;
            previousCompleted = isCompleted;
        }

        var levels = units
            .GroupBy(u => u.Level)
            .OrderBy(g => g.Key)
            .Select(g => new LevelDto(
                g.Key.ToString(),
                LevelTitles[g.Key],
                g.OrderBy(u => u.Order)
                    .Select(u =>
                    {
                        var unitLessons = orderedLessons
                            .Where(l => l.UnitId == u.Id)
                            .Select(l => new LessonSummaryDto(l.Id, l.Title, states[l.Id]))
                            .ToList();
                        return new UnitDto(u.Id, u.Title, UnitState(unitLessons), unitLessons);
                    })
                    .Where(u => u.Lessons.Count > 0)
                    .ToList()))
            .Where(l => l.Units.Count > 0)
            .ToList();

        return new CourseMapDto(CourseId, levels);
    }

    private static string UnitState(IReadOnlyList<LessonSummaryDto> lessons) =>
        lessons.All(l => l.State == LessonStates.Completed) ? LessonStates.Completed
        : lessons.Any(l => l.State != LessonStates.Locked) ? LessonStates.Unlocked
        : LessonStates.Locked;
}
