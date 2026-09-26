using System.Text.Json;
using EnglishPath.BuildingBlocks.Application;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Learning.Application.Abstractions;
using EnglishPath.Learning.Domain.Lessons;
using EnglishPath.Learning.Domain.Placement;
using EnglishPath.Learning.Domain.Units;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Learning.Application.Authoring;

// Bulk content exchange (FR-85). The format is the same JSON the CMS edits, so content can be
// drafted offline or with AI help (FR-84, later) and loaded in one go.

public sealed record ExportLessonDto(int Order, string Title, LessonKind Kind, JsonElement Content);

public sealed record ExportUnitDto(CefrLevel Level, int Order, string Title, IReadOnlyList<ExportLessonDto> Lessons);

public sealed record ExportPlacementItemDto(CefrLevel Level, JsonElement Exercise);

public sealed record ContentPackageDto(int FormatVersion, IReadOnlyList<ExportUnitDto> Units, IReadOnlyList<ExportPlacementItemDto> PlacementItems);

/// <summary>Exports every unit and lesson draft plus active placement items.</summary>
public sealed record ExportContentQuery : IRequest<Result<ContentPackageDto>>;

/// <summary>
/// Imports a content package. Lessons arrive as drafts and still go through review (FR-82).
/// A unit with the same level and title is reused, so a package can be re-imported to add lessons.
/// </summary>
public sealed record ImportContentCommand(ContentPackageDto Package) : IRequest<Result<ImportResultDto>>, IAuditedCommand
{
    public string AuditAction => "content.imported";

    public string? AuditTarget => $"{Package.Units.Count} units";
}

public sealed record ImportResultDto(int UnitsCreated, int LessonsCreated, int PlacementItemsCreated);

internal sealed class ImportContentValidator : AbstractValidator<ImportContentCommand>
{
    public ImportContentValidator()
    {
        RuleFor(c => c.Package.FormatVersion).Equal(1).WithMessage("Unsupported package format.");
        RuleForEach(c => c.Package.Units).ChildRules(u =>
        {
            u.RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
            u.RuleFor(x => x.Level).IsInEnum();
            u.RuleForEach(x => x.Lessons).ChildRules(l =>
            {
                l.RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
                l.RuleFor(x => x.Content.ValueKind).Equal(JsonValueKind.Object).WithMessage("Lesson content must be a JSON object.");
            });
        });
    }
}

internal sealed class ImportExportHandlers(ILearningDbContext db, IClock clock) :
    IRequestHandler<ExportContentQuery, Result<ContentPackageDto>>,
    IRequestHandler<ImportContentCommand, Result<ImportResultDto>>
{
    public async Task<Result<ContentPackageDto>> Handle(ExportContentQuery request, CancellationToken cancellationToken)
    {
        var units = await db.Units.AsNoTracking().OrderBy(u => u.Level).ThenBy(u => u.Order).ToListAsync(cancellationToken);
        var lessons = await db.Lessons.AsNoTracking().ToListAsync(cancellationToken);
        var items = await db.PlacementItems.AsNoTracking().Where(i => i.IsActive).OrderBy(i => i.Level).ToListAsync(cancellationToken);

        return new ContentPackageDto(
            1,
            units.Select(u => new ExportUnitDto(
                    u.Level,
                    u.Order,
                    u.Title,
                    lessons.Where(l => l.UnitId == u.Id).OrderBy(l => l.Kind).ThenBy(l => l.Order)
                        .Select(l => new ExportLessonDto(l.Order, l.Title, l.Kind, Parse(l.DraftContent)))
                        .ToList()))
                .ToList(),
            items.Select(i => new ExportPlacementItemDto(i.Level, Parse(i.Content))).ToList());
    }

    public async Task<Result<ImportResultDto>> Handle(ImportContentCommand request, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var existingUnits = await db.Units.ToListAsync(cancellationToken);
        int unitsCreated = 0, lessonsCreated = 0, itemsCreated = 0;

        foreach (var u in request.Package.Units)
        {
            var unit = existingUnits.FirstOrDefault(x => x.Level == u.Level && string.Equals(x.Title, u.Title.Trim(), StringComparison.OrdinalIgnoreCase));
            if (unit is null)
            {
                unit = CourseUnit.Create(u.Level, u.Order, u.Title);
                db.Units.Add(unit);
                existingUnits.Add(unit);
                unitsCreated++;
            }

            foreach (var l in u.Lessons)
            {
                db.Lessons.Add(Lesson.Create(unit.Id, l.Order, l.Title, l.Content.GetRawText(), now, l.Kind));
                lessonsCreated++;
            }
        }

        foreach (var (item, index) in request.Package.PlacementItems.Select((x, i) => (x, i)))
        {
            var created = PlacementItem.Create(item.Level, item.Exercise.GetRawText(), now);
            if (!created.IsSuccess)
            {
                // Nothing has been saved yet, so a bad item rejects the whole package.
                return new Error("import.placement_item", $"Placement item {index + 1}: {created.Error!.Message}");
            }

            db.PlacementItems.Add(created.Value);
            itemsCreated++;
        }

        await db.SaveChangesAsync(cancellationToken);
        return new ImportResultDto(unitsCreated, lessonsCreated, itemsCreated);
    }

    private static JsonElement Parse(string json)
    {
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }
}
