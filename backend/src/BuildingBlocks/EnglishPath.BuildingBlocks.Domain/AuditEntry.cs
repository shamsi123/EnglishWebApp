namespace EnglishPath.BuildingBlocks.Domain;

/// <summary>An administrative action, kept for accountability (FR-92). Append-only.</summary>
public sealed class AuditEntry
{
    private AuditEntry()
    {
    }

    public long Id { get; private set; }

    public DateTimeOffset At { get; private set; }

    public Guid ActorId { get; private set; }

    /// <summary>What happened, e.g. <c>lesson.published</c>.</summary>
    public string Action { get; private set; } = string.Empty;

    /// <summary>The affected record, e.g. a lesson id.</summary>
    public string? Target { get; private set; }

    public static AuditEntry Create(DateTimeOffset at, Guid actorId, string action, string? target) =>
        new() { At = at, ActorId = actorId, Action = action, Target = target };
}
