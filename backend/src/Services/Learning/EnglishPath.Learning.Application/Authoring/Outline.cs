using EnglishPath.BuildingBlocks.Application;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Learning.Application.Abstractions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Learning.Application.Authoring;

public sealed record OutlineLessonDto(Guid Id, int Order, string Title, string Kind, string Status, int? PublishedVersion, DateTimeOffset UpdatedAt);

public sealed record OutlineUnitDto(Guid Id, string Level, int Order, string Title, IReadOnlyList<OutlineLessonDto> Lessons);

/// <summary>CMS course tree: every unit and lesson, including unpublished drafts (FR-80).</summary>
public sealed record GetCourseOutlineQuery : IRequest<Result<IReadOnlyList<OutlineUnitDto>>>;

public sealed record AuditEntryDto(DateTimeOffset At, Guid ActorId, string Action, string? Target);

/// <summary>Recent admin actions, optionally for one record (FR-92).</summary>
public sealed record GetAuditLogQuery(string? Target, int Limit = 50) : IRequest<Result<IReadOnlyList<AuditEntryDto>>>;

internal sealed class OutlineHandlers(ILearningDbContext db, IAuditLog auditLog) :
    IRequestHandler<GetCourseOutlineQuery, Result<IReadOnlyList<OutlineUnitDto>>>,
    IRequestHandler<GetAuditLogQuery, Result<IReadOnlyList<AuditEntryDto>>>
{
    public async Task<Result<IReadOnlyList<OutlineUnitDto>>> Handle(GetCourseOutlineQuery request, CancellationToken cancellationToken)
    {
        var units = await db.Units.AsNoTracking().OrderBy(u => u.Level).ThenBy(u => u.Order).ToListAsync(cancellationToken);
        var lessons = await db.Lessons.AsNoTracking()
            .Select(l => new { l.Id, l.UnitId, l.Order, l.Title, l.Kind, l.Status, l.PublishedVersion, l.UpdatedAt })
            .ToListAsync(cancellationToken);
        return units.Select(u => new OutlineUnitDto(
                u.Id,
                u.Level.ToString(),
                u.Order,
                u.Title,
                lessons.Where(l => l.UnitId == u.Id)
                    .OrderBy(l => l.Kind).ThenBy(l => l.Order)
                    .Select(l => new OutlineLessonDto(l.Id, l.Order, l.Title, l.Kind.ToString(), l.Status.ToString(), l.PublishedVersion, l.UpdatedAt))
                    .ToList()))
            .ToList();
    }

    public async Task<Result<IReadOnlyList<AuditEntryDto>>> Handle(GetAuditLogQuery request, CancellationToken cancellationToken)
    {
        var entries = await auditLog.RecentAsync(Math.Clamp(request.Limit, 1, 200), request.Target, cancellationToken);
        return entries.Select(e => new AuditEntryDto(e.At, e.ActorId, e.Action, e.Target)).ToList();
    }
}
