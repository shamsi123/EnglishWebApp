using EnglishPath.BuildingBlocks.Application;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Learning.Application.Abstractions;
using EnglishPath.Learning.Domain.Lessons;
using EnglishPath.Learning.Domain.Units;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Learning.Application.Learner;

// DTOs match CourseMapDto in packages/core/src/api/client.ts.
public sealed record CourseMapDto(string CourseId, PlacementSummaryDto? Placement, IReadOnlyList<LevelDto> Levels);

public sealed record PlacementSummaryDto(string StartLevel, bool Skipped);

public sealed record LevelDto(string Level, string Title, IReadOnlyList<UnitDto> Units);

public sealed record UnitDto(Guid Id, string Title, string State, IReadOnlyList<LessonSummaryDto> Lessons);

public sealed record LessonSummaryDto(Guid Id, string Title, string Kind, string State);

public static class LessonStates
{
    public const string Locked = "locked";
    public const string Unlocked = "unlocked";
    public const string Completed = "completed";
}

/// <summary>Checkpoint pass mark (FR-12). Mirrors CHECKPOINT_PASS_MARK in packages/core.</summary>
public static class Checkpoints
{
    public const double PassMark = 0.7;

    public static bool Passes(int correct, int total) => total > 0 && (double)correct / total >= PassMark;
}

/// <summary>
/// FR-20 course map with unlock rules:
/// <list type="bullet">
/// <item>Units below the learner's placement level (FR-10) are open for revision.</item>
/// <item>The first unit at the placement level is open; each later unit opens when the previous
/// unit's checkpoint is passed with ≥ 70% (FR-12), or, if it has none, when all its lessons are done.</item>
/// <item>Within an open unit, lessons open in order; the checkpoint opens once every lesson is done.</item>
/// </list>
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
            .Select(l => new { l.Id, l.UnitId, l.Order, l.Title, l.Kind })
            .ToListAsync(cancellationToken);
        var results = await db.Completions.AsNoTracking()
            .Where(c => c.UserId == user.UserId)
            .Select(c => new { c.LessonId, c.CorrectFirstTry, c.TotalExercises })
            .ToListAsync(cancellationToken);
        var placement = await db.Placements.AsNoTracking().SingleOrDefaultAsync(p => p.Id == user.UserId, cancellationToken);

        var completedLessons = results.Select(r => r.LessonId).ToHashSet();
        var passedCheckpoints = results.Where(r => Checkpoints.Passes(r.CorrectFirstTry, r.TotalExercises)).Select(r => r.LessonId).ToHashSet();

        var orderedUnits = units
            .Where(u => lessons.Any(l => l.UnitId == u.Id))
            .OrderBy(u => u.Level).ThenBy(u => u.Order)
            .ToList();
        var startLevel = placement?.StartLevel ?? orderedUnits.FirstOrDefault()?.Level ?? CefrLevel.PreA1;

        var unitDtos = new List<(CourseUnit Unit, UnitDto Dto)>();
        var previousUnitPassed = true;
        var startUnitSeen = false;
        foreach (var unit in orderedUnits)
        {
            var unitLessons = lessons.Where(l => l.UnitId == unit.Id).OrderBy(l => l.Kind).ThenBy(l => l.Order).ToList();
            var belowStart = unit.Level < startLevel;
            var firstAtStart = unit.Level >= startLevel && !startUnitSeen;
            startUnitSeen |= unit.Level >= startLevel;
            var unitOpen = belowStart || firstAtStart || previousUnitPassed;

            var regularDone = unitLessons.Where(l => l.Kind == LessonKind.Lesson).All(l => completedLessons.Contains(l.Id));
            var previousDone = true;
            var summaries = new List<LessonSummaryDto>();
            foreach (var lesson in unitLessons)
            {
                var isCheckpoint = lesson.Kind == LessonKind.Checkpoint;
                var done = isCheckpoint ? passedCheckpoints.Contains(lesson.Id) : completedLessons.Contains(lesson.Id);
                var open = unitOpen && (belowStart || (isCheckpoint ? regularDone : previousDone));
                summaries.Add(new LessonSummaryDto(
                    lesson.Id,
                    lesson.Title,
                    isCheckpoint ? "checkpoint" : "lesson",
                    done ? LessonStates.Completed : open ? LessonStates.Unlocked : LessonStates.Locked));
                if (!isCheckpoint)
                {
                    previousDone = done;
                }
            }

            var checkpoint = unitLessons.FirstOrDefault(l => l.Kind == LessonKind.Checkpoint);
            previousUnitPassed = checkpoint is not null ? passedCheckpoints.Contains(checkpoint.Id) : regularDone;

            var state = summaries.All(l => l.State == LessonStates.Completed) ? LessonStates.Completed
                : unitOpen ? LessonStates.Unlocked
                : LessonStates.Locked;
            unitDtos.Add((unit, new UnitDto(unit.Id, unit.Title, state, summaries)));
        }

        var levels = unitDtos
            .GroupBy(u => u.Unit.Level)
            .OrderBy(g => g.Key)
            .Select(g => new LevelDto(g.Key.ToString(), LevelTitles[g.Key], g.Select(u => u.Dto).ToList()))
            .ToList();

        return new CourseMapDto(
            CourseId,
            placement is null ? null : new PlacementSummaryDto(placement.StartLevel.ToString(), placement.Skipped),
            levels);
    }
}
