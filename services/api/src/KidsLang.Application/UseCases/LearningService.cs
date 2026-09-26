using KidsLang.Application.Abstractions;
using KidsLang.Application.Contracts;
using KidsLang.Domain;
using Microsoft.EntityFrameworkCore;

namespace KidsLang.Application.UseCases;

/// <summary>The server is the source of truth for unlocks: mastery is recomputed here from submitted results.</summary>
public sealed class LearningService(IKidsLangDb db, IContentCatalog content, ChildService children, IClock clock)
{
    public async Task<Result<AttemptBatchResponse>> SubmitAttemptsAsync(Guid parentId, AttemptBatchRequest req, CancellationToken ct)
    {
        var childIds = req.Attempts.Select(a => a.ChildId).Distinct().ToList();
        foreach (var id in childIds)
            if (!await children.OwnsAsync(parentId, id, ct)) return Result<AttemptBatchResponse>.Fail(ErrorKind.Forbidden, "Unknown child.");

        var ids = req.Attempts.Select(a => a.Id).ToList();
        var existing = (await db.ActivityAttempts.Where(a => ids.Contains(a.Id)).Select(a => a.Id).ToListAsync(ct)).ToHashSet();
        foreach (var a in req.Attempts.DistinctBy(a => a.Id).Where(a => !existing.Contains(a.Id)))
        {
            db.ActivityAttempts.Add(new ActivityAttempt
            {
                Id = a.Id, ChildId = a.ChildId, ActivityId = a.ActivityId, LessonId = a.LessonId, ItemId = a.ItemId,
                IsCorrect = a.IsCorrect, Score = a.Score, CreatedAtUtc = DateTime.SpecifyKind(a.CreatedAtUtc, DateTimeKind.Utc),
            });
        }
        await db.SaveChangesAsync(ct);
        // Idempotent: attempts already stored are acknowledged again so the client can drop them.
        return Result<AttemptBatchResponse>.Ok(new AttemptBatchResponse(ids.Distinct().ToList()));
    }

    public async Task<Result<QuizSubmitResponse>> SubmitQuizAsync(Guid parentId, string nodeId, QuizSubmitRequest req, CancellationToken ct)
    {
        if (!await children.OwnsAsync(parentId, req.ChildId, ct)) return Result<QuizSubmitResponse>.Fail(ErrorKind.NotFound, "Child not found.");
        var node = content.FindNode(nodeId);
        if (node is null) return Result<QuizSubmitResponse>.Fail(ErrorKind.NotFound, "Lesson not found.");

        var statuses = await StatusesAsync(req.ChildId, node.CourseId, ct);
        if (statuses[node.Id] == NodeStatus.Locked) return Result<QuizSubmitResponse>.Fail(ErrorKind.Forbidden, "This lesson is still locked.");

        var results = req.Results.Select(r => new ItemResult(r.ItemId, r.Correct)).ToList();
        var mastery = Mastery.Evaluate(node.NewItems, node.Mastery, results, req.TraceAccuracy);
        var now = clock.UtcNow;

        db.QuizAttempts.Add(new QuizAttempt { ChildId = req.ChildId, LessonId = node.Id, Score = mastery.Score, Passed = mastery.Mastered, ItemResults = results, CreatedAtUtc = now });

        var progress = await db.LessonProgress.FirstOrDefaultAsync(p => p.ChildId == req.ChildId && p.LessonId == node.Id, ct);
        if (progress is null)
        {
            progress = new LessonProgress { ChildId = req.ChildId, LessonId = node.Id };
            db.LessonProgress.Add(progress);
        }
        progress.Attempts++;
        progress.BestScore = Math.Max(progress.BestScore, mastery.Score);
        progress.Stars = Math.Max(progress.Stars, mastery.Stars);
        var newRewards = new List<string>();
        if (mastery.Mastered && progress.Status != LessonStatus.Mastered)
        {
            progress.Status = LessonStatus.Mastered;
            progress.MasteredAtUtc = now;
            if (node.Kind == NodeKind.Checkpoint && node.UnitId is not null) newRewards.Add(Award(req.ChildId, "sticker", node.UnitId));
            if (node.Kind == NodeKind.LevelTest && node.LevelId is not null) newRewards.Add(Award(req.ChildId, "trophy", node.LevelId));
        }

        // Leitner: one step per item per quiz — up only if every answer for that item was correct.
        var itemIds = results.Select(r => r.ItemId).Distinct().ToList();
        var entries = await db.ItemMastery.Where(m => m.ChildId == req.ChildId && itemIds.Contains(m.LearningItemId)).ToDictionaryAsync(m => m.LearningItemId, ct);
        foreach (var itemId in itemIds)
        {
            var isNew = !entries.TryGetValue(itemId, out var entry);
            if (entry is null)
            {
                entry = new ItemMastery { ChildId = req.ChildId, LearningItemId = itemId };
                db.ItemMastery.Add(entry);
            }
            Leitner.Review(entry, results.Where(r => r.ItemId == itemId).All(r => r.Correct), now, isNew);
        }

        await db.SaveChangesAsync(ct);
        var nodes = content.Nodes(node.CourseId);
        var next = mastery.Mastered ? nodes.SkipWhile(n => n.Id != node.Id).Skip(1).FirstOrDefault()?.Id : null;
        return Result<QuizSubmitResponse>.Ok(new QuizSubmitResponse(mastery.Mastered, mastery.Score, mastery.Stars, mastery.MissedItems, next, newRewards));
    }

    public async Task<Result<JourneyResponse>> JourneyAsync(Guid parentId, string courseId, Guid childId, CancellationToken ct)
    {
        if (!await children.OwnsAsync(parentId, childId, ct)) return Result<JourneyResponse>.Fail(ErrorKind.NotFound, "Child not found.");
        var nodes = content.Nodes(courseId);
        if (nodes.Count == 0) return Result<JourneyResponse>.Fail(ErrorKind.NotFound, "Course not found.");
        var progress = await db.LessonProgress.Where(p => p.ChildId == childId).ToDictionaryAsync(p => p.LessonId, ct);
        var statuses = Progression.Statuses(nodes.Select(n => n.Id).ToList(), progress);
        return Result<JourneyResponse>.Ok(new JourneyResponse(courseId, nodes.Select(n =>
            new JourneyNodeDto(n.Id, n.Kind.ToString(), n.TitleEn, statuses[n.Id].ToString(), progress.GetValueOrDefault(n.Id)?.Stars ?? 0)).ToList()));
    }

    public async Task<Result<IReadOnlyList<ReviewItemDto>>> ReviewTodayAsync(Guid parentId, Guid childId, CancellationToken ct)
    {
        if (!await children.OwnsAsync(parentId, childId, ct)) return Result<IReadOnlyList<ReviewItemDto>>.Fail(ErrorKind.NotFound, "Child not found.");
        var now = clock.UtcNow;
        var due = await db.ItemMastery.Where(m => m.ChildId == childId && m.NextReviewAtUtc <= now).ToListAsync(ct);
        return Result<IReadOnlyList<ReviewItemDto>>.Ok(due.OrderBy(m => m.LeitnerBox).ThenBy(m => m.NextReviewAtUtc)
            .Select(m => new ReviewItemDto(m.LearningItemId, m.LeitnerBox, m.NextReviewAtUtc)).ToList());
    }

    public async Task<Result<ChildReportResponse>> ReportAsync(Guid parentId, Guid childId, string courseId, CancellationToken ct)
    {
        if (!await children.OwnsAsync(parentId, childId, ct)) return Result<ChildReportResponse>.Fail(ErrorKind.NotFound, "Child not found.");
        var nodes = content.Nodes(courseId);
        var progress = await db.LessonProgress.Where(p => p.ChildId == childId).ToDictionaryAsync(p => p.LessonId, ct);
        var statuses = Progression.Statuses(nodes.Select(n => n.Id).ToList(), progress);
        var items = await db.ItemMastery.Where(m => m.ChildId == childId).ToListAsync(ct);
        var stickers = await db.Rewards.Where(r => r.ChildId == childId && r.Type == "sticker").Select(r => r.RefId).ToListAsync(ct);
        var lessons = nodes.Where(n => n.Kind == NodeKind.Lesson).ToList();
        return Result<ChildReportResponse>.Ok(new ChildReportResponse(
            lessons.Count(n => statuses[n.Id] == NodeStatus.Mastered),
            lessons.Count,
            progress.Values.Sum(p => p.Stars),
            nodes.FirstOrDefault(n => statuses[n.Id] is NodeStatus.Available or NodeStatus.InProgress)?.Id,
            items.Where(Leitner.IsWeak).Select(m => m.LearningItemId).ToList(),
            stickers));
    }

    /// <summary>FR-35: parent override unlock (behind the parent gate in the client).</summary>
    public async Task<Result<bool>> UnlockAsync(Guid parentId, Guid childId, string nodeId, CancellationToken ct)
    {
        if (!await children.OwnsAsync(parentId, childId, ct)) return Result<bool>.Fail(ErrorKind.NotFound, "Child not found.");
        if (content.FindNode(nodeId) is null) return Result<bool>.Fail(ErrorKind.NotFound, "Lesson not found.");
        var progress = await db.LessonProgress.FirstOrDefaultAsync(p => p.ChildId == childId && p.LessonId == nodeId, ct);
        if (progress is null) db.LessonProgress.Add(new LessonProgress { ChildId = childId, LessonId = nodeId, UnlockedByParent = true });
        else progress.UnlockedByParent = true;
        await db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }

    private async Task<IReadOnlyDictionary<string, NodeStatus>> StatusesAsync(Guid childId, string courseId, CancellationToken ct)
    {
        var progress = await db.LessonProgress.Where(p => p.ChildId == childId).ToDictionaryAsync(p => p.LessonId, ct);
        return Progression.Statuses(content.Nodes(courseId).Select(n => n.Id).ToList(), progress);
    }

    private string Award(Guid childId, string type, string refId)
    {
        db.Rewards.Add(new Reward { ChildId = childId, Type = type, RefId = refId, AwardedAtUtc = clock.UtcNow });
        return $"{type}:{refId}";
    }
}
