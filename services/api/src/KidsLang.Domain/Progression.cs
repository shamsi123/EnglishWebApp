namespace KidsLang.Domain;

public enum NodeStatus { Locked, Available, InProgress, Mastered }

/// <summary>Unlock rules (FR-12, FR-14): a node opens only after the previous one is mastered or a parent overrides it.</summary>
public static class Progression
{
    public static IReadOnlyDictionary<string, NodeStatus> Statuses(
        IReadOnlyList<string> orderedNodeIds,
        IReadOnlyDictionary<string, LessonProgress> progress)
    {
        var result = new Dictionary<string, NodeStatus>();
        var prevMastered = true;
        foreach (var id in orderedNodeIds)
        {
            progress.TryGetValue(id, out var p);
            NodeStatus status;
            if (p?.Status == LessonStatus.Mastered) status = NodeStatus.Mastered;
            else if (prevMastered || p?.UnlockedByParent == true)
                status = p?.Status == LessonStatus.InProgress ? NodeStatus.InProgress : NodeStatus.Available;
            else status = NodeStatus.Locked;
            result[id] = status;
            prevMastered = status == NodeStatus.Mastered;
        }
        return result;
    }
}
