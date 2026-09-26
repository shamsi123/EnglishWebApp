using EnglishPath.BuildingBlocks.Domain;

namespace EnglishPath.Learning.Domain.Units;

/// <summary>CEFR band (BRD §6). Phase 1 publishes Pre-A1 to A2.</summary>
public enum CefrLevel
{
    PreA1 = 0,
    A1 = 1,
    A2 = 2,
    B1 = 3,
    B2 = 4,
}

/// <summary>A themed group of lessons within a level, e.g. "At work".</summary>
public sealed class CourseUnit : AggregateRoot<Guid>
{
    private CourseUnit()
    {
    }

    public CefrLevel Level { get; private set; }

    public int Order { get; private set; }

    public string Title { get; private set; } = string.Empty;

    public static CourseUnit Create(CefrLevel level, int order, string title)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        ArgumentOutOfRangeException.ThrowIfNegative(order);
        return new CourseUnit { Id = Guid.NewGuid(), Level = level, Order = order, Title = title.Trim() };
    }
}
