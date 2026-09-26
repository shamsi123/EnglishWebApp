using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Learning.Domain.Units;

namespace EnglishPath.Learning.Domain.Placement;

public enum PlacementStatus
{
    InProgress = 0,
    Completed = 1,
}

public sealed class PlacementResponse
{
    internal PlacementResponse(Guid itemId, CefrLevel level, int block, bool correct, DateTimeOffset answeredAt)
    {
        ItemId = itemId;
        Level = level;
        Block = block;
        Correct = correct;
        AnsweredAt = answeredAt;
    }

    private PlacementResponse()
    {
    }

    public Guid ItemId { get; private set; }

    public CefrLevel Level { get; private set; }

    public int Block { get; private set; }

    public bool Correct { get; private set; }

    public DateTimeOffset AnsweredAt { get; private set; }
}

public sealed record PlacementCompletedDomainEvent(Guid UserId, CefrLevel StartLevel, CefrLevel? HighestPassed) : IDomainEvent;

/// <summary>
/// Adaptive placement test (FR-10), a block staircase: learners answer blocks of
/// <see cref="ItemsPerBlock"/> questions at one level. Passing a block (≥ <see cref="PassMark"/>)
/// moves up a level; failing moves down unless the level below was already passed. The learner
/// starts the course at the level after the highest one they passed.
/// At most <see cref="MaxBlocks"/> blocks (20 questions) keeps it within 15 minutes.
/// </summary>
public sealed class PlacementSession : AggregateRoot<Guid>
{
    public const int ItemsPerBlock = 4;
    public const int PassMark = 3;
    public const int MaxBlocks = 5;
    public static readonly TimeSpan Timeout = TimeSpan.FromMinutes(30);

    private readonly List<PlacementResponse> _responses = [];

    private PlacementSession()
    {
    }

    public Guid UserId { get; private set; }

    public PlacementStatus Status { get; private set; }

    public CefrLevel MinLevel { get; private set; }

    public CefrLevel MaxLevel { get; private set; }

    public CefrLevel CurrentLevel { get; private set; }

    public int Block { get; private set; }

    /// <summary>The question currently shown; answers to anything else are rejected.</summary>
    public Guid? PendingItemId { get; private set; }

    public CefrLevel? StartLevel { get; private set; }

    public CefrLevel? HighestPassed { get; private set; }

    public DateTimeOffset StartedAt { get; private set; }

    public DateTimeOffset? CompletedAt { get; private set; }

    public IReadOnlyList<PlacementResponse> Responses => _responses;

    public int MaxQuestions => MaxBlocks * ItemsPerBlock;

    /// <param name="minLevel">Lowest level with placement items.</param>
    /// <param name="maxLevel">Highest level with course content; results are capped here.</param>
    public static PlacementSession Start(Guid userId, CefrLevel minLevel, CefrLevel maxLevel, DateTimeOffset now)
    {
        if (maxLevel < minLevel)
        {
            throw new ArgumentOutOfRangeException(nameof(maxLevel));
        }

        // Start in the middle of the beginner range, where most of our learners are.
        var start = (CefrLevel)Math.Clamp((int)CefrLevel.A1, (int)minLevel, (int)maxLevel);
        return new PlacementSession
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Status = PlacementStatus.InProgress,
            MinLevel = minLevel,
            MaxLevel = maxLevel,
            CurrentLevel = start,
            StartedAt = now,
        };
    }

    public bool IsExpired(DateTimeOffset now) => Status == PlacementStatus.InProgress && now - StartedAt > Timeout;

    /// <summary>Item ids already used in this session, so no question repeats.</summary>
    public IReadOnlySet<Guid> AskedItemIds =>
        _responses.Select(r => r.ItemId).Concat(PendingItemId is { } p ? [p] : []).ToHashSet();

    public void Present(Guid itemId)
    {
        if (Status != PlacementStatus.InProgress)
        {
            throw new InvalidOperationException("The placement test is finished.");
        }

        PendingItemId = itemId;
    }

    public Result RecordAnswer(Guid itemId, bool correct, DateTimeOffset now)
    {
        if (Status != PlacementStatus.InProgress)
        {
            return Error.Conflict("placement.finished", "This placement test is already finished.");
        }

        if (IsExpired(now))
        {
            return Error.Conflict("placement.expired", "This placement test has expired. Please start again.");
        }

        if (PendingItemId != itemId)
        {
            return Error.Conflict("placement.unexpected_item", "That question is not the current one.");
        }

        _responses.Add(new PlacementResponse(itemId, CurrentLevel, Block, correct, now));
        PendingItemId = null;

        var block = _responses.Where(r => r.Block == Block).ToList();
        if (block.Count < ItemsPerBlock)
        {
            return Result.Success();
        }

        var passed = block.Count(r => r.Correct) >= PassMark;
        var next = passed ? Up() : Down();
        if (next is null || Block + 1 >= MaxBlocks)
        {
            Complete(now);
        }
        else
        {
            CurrentLevel = next.Value;
            Block++;
        }

        return Result.Success();
    }

    /// <summary>Ends early, e.g. when the item bank has no unused question at the current level.</summary>
    public void Finish(DateTimeOffset now)
    {
        if (Status == PlacementStatus.InProgress)
        {
            PendingItemId = null;
            Complete(now);
        }
    }

    private CefrLevel? Up() =>
        CurrentLevel < MaxLevel && !Failed(CurrentLevel + 1) ? CurrentLevel + 1 : null;

    private CefrLevel? Down() =>
        CurrentLevel > MinLevel && !Passed(CurrentLevel - 1) && !Failed(CurrentLevel - 1) ? CurrentLevel - 1 : null;

    private IEnumerable<IGrouping<int, PlacementResponse>> CompletedBlocks =>
        _responses.GroupBy(r => r.Block).Where(g => g.Count() == ItemsPerBlock);

    private bool Passed(CefrLevel level) =>
        CompletedBlocks.Any(g => g.First().Level == level && g.Count(r => r.Correct) >= PassMark);

    private bool Failed(CefrLevel level) =>
        CompletedBlocks.Any(g => g.First().Level == level && g.Count(r => r.Correct) < PassMark);

    private void Complete(DateTimeOffset now)
    {
        HighestPassed = Enum.GetValues<CefrLevel>().Where(Passed).Cast<CefrLevel?>().Max();
        StartLevel = HighestPassed is { } highest ? (CefrLevel)Math.Min((int)highest + 1, (int)MaxLevel) : MinLevel;
        Status = PlacementStatus.Completed;
        CompletedAt = now;
        Raise(new PlacementCompletedDomainEvent(UserId, StartLevel.Value, HighestPassed));
    }
}

/// <summary>Where a learner starts the course (FR-10, FR-11). Id is the user id.</summary>
public sealed class LearnerPlacement : Entity<Guid>
{
    private LearnerPlacement()
    {
    }

    public CefrLevel StartLevel { get; private set; }

    public bool Skipped { get; private set; }

    public DateTimeOffset PlacedAt { get; private set; }

    public static LearnerPlacement Create(Guid userId) => new() { Id = userId };

    public void Place(CefrLevel startLevel, DateTimeOffset now)
    {
        StartLevel = startLevel;
        Skipped = false;
        PlacedAt = now;
    }

    /// <summary>FR-11: skip the test and start from the very beginning.</summary>
    public void Skip(CefrLevel lowestLevel, DateTimeOffset now)
    {
        StartLevel = lowestLevel;
        Skipped = true;
        PlacedAt = now;
    }
}
