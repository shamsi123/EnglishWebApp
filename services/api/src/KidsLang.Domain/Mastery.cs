namespace KidsLang.Domain;

/// <summary>Mastery gate (BRD §5.5). Mirrors apps/web/src/engine/mastery.ts — keep in sync.</summary>
public sealed record MasteryConfig(double MinScore = 0.8, bool RequireEachNewItem = true, double MinTraceAccuracy = 0.7);

public sealed record ItemResult(string ItemId, bool Correct);

public sealed record MasteryResult(bool Mastered, double Score, int Stars, IReadOnlyList<string> MissedItems);

public static class Mastery
{
    public static int StarsForScore(double score)
    {
        var s = Math.Round(score, 4);
        if (s >= 1) return 3;
        if (s >= 0.9) return 2;
        if (s >= 0.8) return 1;
        return 0;
    }

    public static MasteryResult Evaluate(
        IReadOnlyCollection<string> newItems,
        MasteryConfig config,
        IReadOnlyCollection<ItemResult> results,
        double? traceAccuracy)
    {
        var correct = results.Count(r => r.Correct);
        var score = results.Count == 0 ? 0 : Math.Round((double)correct / results.Count, 4);

        var missed = new SortedSet<string>(StringComparer.Ordinal);
        foreach (var r in results.Where(r => !r.Correct)) missed.Add(r.ItemId);

        var eachNewOk = true;
        if (config.RequireEachNewItem)
        {
            foreach (var id in newItems.Where(id => !results.Any(r => r.ItemId == id && r.Correct)))
            {
                eachNewOk = false;
                missed.Add(id);
            }
        }

        var traceOk = traceAccuracy is null || traceAccuracy >= config.MinTraceAccuracy;
        if (!traceOk || results.Count == 0)
            foreach (var id in newItems) missed.Add(id);

        var mastered = results.Count > 0 && score >= config.MinScore && eachNewOk && traceOk;
        return new MasteryResult(mastered, score, mastered ? StarsForScore(score) : 0, missed.ToList());
    }
}
