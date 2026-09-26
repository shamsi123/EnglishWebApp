using System.Text.Json;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Learning.Application.Abstractions;
using EnglishPath.Learning.Domain.Placement;
using EnglishPath.Learning.Domain.Units;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Learning.Application.Placement;

public sealed record PlacementItemDto(Guid Id, string Level, string Skill, bool IsActive, JsonElement Exercise);

/// <summary>Adds a question to the placement item bank (content team, FR-10).</summary>
public sealed record CreatePlacementItemCommand(CefrLevel Level, JsonElement Exercise) : IRequest<Result<Guid>>;

public sealed record ListPlacementItemsQuery(CefrLevel? Level) : IRequest<Result<IReadOnlyList<PlacementItemDto>>>;

/// <summary>Retires an item; answers already given keep referring to it.</summary>
public sealed record RetirePlacementItemCommand(Guid ItemId) : IRequest<Result>;

internal sealed class PlacementItemAdminHandlers(ILearningDbContext db, IClock clock) :
    IRequestHandler<CreatePlacementItemCommand, Result<Guid>>,
    IRequestHandler<ListPlacementItemsQuery, Result<IReadOnlyList<PlacementItemDto>>>,
    IRequestHandler<RetirePlacementItemCommand, Result>
{
    public async Task<Result<Guid>> Handle(CreatePlacementItemCommand request, CancellationToken cancellationToken)
    {
        if (request.Exercise.ValueKind != JsonValueKind.Object)
        {
            return new Error("placement.invalid_item", "Exercise must be a JSON object.");
        }

        var created = PlacementItem.Create(request.Level, request.Exercise.GetRawText(), clock.UtcNow);
        if (!created.IsSuccess)
        {
            return created.Error!;
        }

        db.PlacementItems.Add(created.Value);
        await db.SaveChangesAsync(cancellationToken);
        return created.Value.Id;
    }

    public async Task<Result<IReadOnlyList<PlacementItemDto>>> Handle(ListPlacementItemsQuery request, CancellationToken cancellationToken)
    {
        var items = await db.PlacementItems.AsNoTracking()
            .Where(i => request.Level == null || i.Level == request.Level)
            .OrderBy(i => i.Level).ThenBy(i => i.Skill).ThenBy(i => i.CreatedAt)
            .ToListAsync(cancellationToken);
        return items.Select(i =>
        {
            using var doc = JsonDocument.Parse(i.Content);
            return new PlacementItemDto(i.Id, i.Level.ToString(), i.Skill, i.IsActive, doc.RootElement.Clone());
        }).ToList();
    }

    public async Task<Result> Handle(RetirePlacementItemCommand request, CancellationToken cancellationToken)
    {
        var item = await db.PlacementItems.SingleOrDefaultAsync(i => i.Id == request.ItemId, cancellationToken);
        if (item is null)
        {
            return Error.NotFound("placement.item_not_found", "Placement item not found.");
        }

        item.Retire();
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
