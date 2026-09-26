using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Learning.Domain.Content;

namespace EnglishPath.Learning.Domain.Lessons;

/// <summary>State of the editable draft in the authoring workflow (FR-82).</summary>
public enum DraftStatus
{
    /// <summary>Being edited by an author.</summary>
    Draft = 0,

    /// <summary>Submitted and waiting for a reviewer.</summary>
    InReview = 1,

    /// <summary>The draft is identical to the live version.</summary>
    Published = 2,
}

/// <summary>A regular lesson, or the end-of-unit checkpoint quiz that unlocks the next unit (FR-12).</summary>
public enum LessonKind
{
    Lesson = 0,
    Checkpoint = 1,
}

public sealed record LessonPublishedDomainEvent(Guid LessonId, Guid UnitId, int Version, DateTimeOffset PublishedAt) : IDomainEvent;

/// <summary>
/// A lesson with a single editable draft and an immutable history of published versions.
/// Learners always get the latest published version; older versions are kept so offline
/// clients can still sync completions and so authors can roll back (FR-82).
/// </summary>
public sealed class Lesson : AggregateRoot<Guid>
{
    private readonly List<LessonVersion> _versions = [];

    private Lesson()
    {
    }

    public Guid UnitId { get; private set; }

    public int Order { get; private set; }

    public LessonKind Kind { get; private set; }

    public string Title { get; private set; } = string.Empty;

    public string DraftContent { get; private set; } = string.Empty;

    public DraftStatus Status { get; private set; }

    public int? PublishedVersion { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public IReadOnlyList<LessonVersion> Versions => _versions;

    public LessonVersion? Live => PublishedVersion is { } v ? _versions.Single(x => x.Version == v) : null;

    public static Lesson Create(Guid unitId, int order, string title, string draftContent, DateTimeOffset now, LessonKind kind = LessonKind.Lesson)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        ArgumentOutOfRangeException.ThrowIfNegative(order);
        return new Lesson
        {
            Id = Guid.NewGuid(),
            UnitId = unitId,
            Order = order,
            Kind = kind,
            Title = title.Trim(),
            DraftContent = draftContent,
            Status = DraftStatus.Draft,
            UpdatedAt = now,
        };
    }

    public Result UpdateDraft(string title, string content, DateTimeOffset now)
    {
        if (Status == DraftStatus.InReview)
        {
            return LessonErrors.InReview;
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        Title = title.Trim();
        DraftContent = content;
        Status = DraftStatus.Draft;
        UpdatedAt = now;
        return Result.Success();
    }

    public Result SubmitForReview(DateTimeOffset now)
    {
        if (Status != DraftStatus.Draft)
        {
            return LessonErrors.InvalidTransition(Status, DraftStatus.InReview);
        }

        var problems = LessonContentValidator.Validate(DraftContent);
        if (problems.Count > 0)
        {
            return new Error("lesson.invalid_content", string.Join(" ", problems));
        }

        Status = DraftStatus.InReview;
        UpdatedAt = now;
        return Result.Success();
    }

    public Result RequestChanges(DateTimeOffset now)
    {
        if (Status != DraftStatus.InReview)
        {
            return LessonErrors.InvalidTransition(Status, DraftStatus.Draft);
        }

        Status = DraftStatus.Draft;
        UpdatedAt = now;
        return Result.Success();
    }

    /// <summary>Reviewer approves the draft; it becomes a new immutable version.</summary>
    public Result Publish(Guid reviewerId, DateTimeOffset now)
    {
        if (Status != DraftStatus.InReview)
        {
            return LessonErrors.InvalidTransition(Status, DraftStatus.Published);
        }

        AddVersion(DraftContent, reviewerId, now, rolledBackFrom: null);
        Status = DraftStatus.Published;
        return Result.Success();
    }

    /// <summary>Re-publishes an earlier version's content as a new version, keeping history append-only.</summary>
    public Result Rollback(int version, Guid reviewerId, DateTimeOffset now)
    {
        var target = _versions.SingleOrDefault(v => v.Version == version);
        if (target is null)
        {
            return Error.NotFound("lesson.version_not_found", $"Version {version} does not exist.");
        }

        if (version == PublishedVersion)
        {
            return Error.Conflict("lesson.already_live", $"Version {version} is already live.");
        }

        AddVersion(target.Content, reviewerId, now, rolledBackFrom: version);
        DraftContent = target.Content;
        Status = DraftStatus.Published;
        return Result.Success();
    }

    private void AddVersion(string content, Guid reviewerId, DateTimeOffset now, int? rolledBackFrom)
    {
        var next = (_versions.Count == 0 ? 0 : _versions.Max(v => v.Version)) + 1;
        _versions.Add(new LessonVersion(Id, next, Title, content, now, reviewerId, rolledBackFrom));
        PublishedVersion = next;
        UpdatedAt = now;
        Raise(new LessonPublishedDomainEvent(Id, UnitId, next, now));
    }
}

public sealed class LessonVersion
{
    internal LessonVersion(Guid lessonId, int version, string title, string content, DateTimeOffset publishedAt, Guid publishedBy, int? rolledBackFrom)
    {
        LessonId = lessonId;
        Version = version;
        Title = title;
        Content = content;
        PublishedAt = publishedAt;
        PublishedBy = publishedBy;
        RolledBackFrom = rolledBackFrom;
    }

    private LessonVersion()
    {
    }

    public Guid LessonId { get; private set; }

    public int Version { get; private set; }

    public string Title { get; private set; } = string.Empty;

    /// <summary>Lesson content JSON (see <see cref="LessonContent"/>).</summary>
    public string Content { get; private set; } = string.Empty;

    public DateTimeOffset PublishedAt { get; private set; }

    public Guid PublishedBy { get; private set; }

    public int? RolledBackFrom { get; private set; }
}

public static class LessonErrors
{
    public static readonly Error NotFound = Error.NotFound("lesson.not_found", "Lesson not found.");

    public static readonly Error InReview = Error.Conflict("lesson.in_review", "The lesson is in review; request changes before editing.");

    public static Error InvalidTransition(DraftStatus from, DraftStatus to) =>
        Error.Conflict("lesson.invalid_transition", $"Cannot move a lesson from {from} to {to}.");
}
