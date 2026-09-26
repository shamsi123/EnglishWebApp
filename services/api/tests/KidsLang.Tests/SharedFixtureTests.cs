using System.Text.Json;
using KidsLang.Domain;

namespace KidsLang.Tests;

/// <summary>Runs the same fixtures as apps/web/src/engine so both implementations stay in sync.</summary>
public class SharedFixtureTests
{
    private static JsonElement Load(string name)
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var path = Path.Combine(dir.FullName, "content", "fixtures", name);
            if (File.Exists(path)) return JsonDocument.Parse(File.ReadAllText(path)).RootElement.Clone();
        }
        throw new FileNotFoundException(name);
    }

    public static IEnumerable<object[]> MasteryCases() =>
        Load("mastery-cases.json").GetProperty("cases").EnumerateArray().Select(c => new object[] { c.GetProperty("name").GetString()!, c.GetRawText() });

    public static IEnumerable<object[]> LeitnerCases() =>
        Load("leitner-cases.json").GetProperty("cases").EnumerateArray().Select(c => new object[] { c.GetProperty("name").GetString()!, c.GetRawText() });

    [Theory]
    [MemberData(nameof(MasteryCases))]
    public void Mastery_matches_fixture(string name, string json)
    {
        var c = JsonDocument.Parse(json).RootElement;
        var cfg = c.GetProperty("config");
        var result = Mastery.Evaluate(
            c.GetProperty("newItems").EnumerateArray().Select(e => e.GetString()!).ToList(),
            new MasteryConfig(cfg.GetProperty("minScore").GetDouble(), cfg.GetProperty("requireEachNewItem").GetBoolean(), cfg.GetProperty("minTraceAccuracy").GetDouble()),
            c.GetProperty("results").EnumerateArray().Select(r => new ItemResult(r.GetProperty("itemId").GetString()!, r.GetProperty("correct").GetBoolean())).ToList(),
            c.GetProperty("traceAccuracy").ValueKind == JsonValueKind.Null ? null : c.GetProperty("traceAccuracy").GetDouble());

        var expected = c.GetProperty("expected");
        Assert.True(expected.GetProperty("mastered").GetBoolean() == result.Mastered, name);
        Assert.Equal(expected.GetProperty("score").GetDouble(), result.Score, 4);
        Assert.Equal(expected.GetProperty("stars").GetInt32(), result.Stars);
        Assert.Equal(expected.GetProperty("missedItems").EnumerateArray().Select(e => e.GetString()!), result.MissedItems);
    }

    [Fact]
    public void Leitner_intervals_match_fixture() =>
        Assert.Equal(Load("leitner-cases.json").GetProperty("intervalsDays").EnumerateArray().Select(e => e.GetInt32()), Leitner.IntervalsDays);

    [Theory]
    [MemberData(nameof(LeitnerCases))]
    public void Leitner_matches_fixture(string name, string json)
    {
        var c = JsonDocument.Parse(json).RootElement;
        var now = c.GetProperty("now").GetDateTime().ToUniversalTime();
        var isNew = c.GetProperty("box").ValueKind == JsonValueKind.Null;
        var entry = new ItemMastery { LearningItemId = name };
        if (!isNew)
        {
            entry.LeitnerBox = c.GetProperty("box").GetInt32();
            entry.NextReviewAtUtc = c.TryGetProperty("previousNextReviewAt", out var prev) ? prev.GetDateTime().ToUniversalTime() : now;
            entry.LastReviewedAtUtc = c.TryGetProperty("lastReviewedAt", out var last) && last.ValueKind != JsonValueKind.Null ? last.GetDateTime().ToUniversalTime() : null;
        }

        Leitner.Review(entry, c.GetProperty("correct").GetBoolean(), now, isNew);

        var expected = c.GetProperty("expected");
        Assert.Equal(expected.GetProperty("box").GetInt32(), entry.LeitnerBox);
        Assert.Equal(expected.GetProperty("nextReviewAt").GetDateTime().ToUniversalTime(), entry.NextReviewAtUtc);
    }

    [Fact]
    public void Progression_opens_nodes_in_order_and_honours_parent_override()
    {
        var ids = new[] { "l1", "l2", "cp", "l3" };
        var progress = new Dictionary<string, LessonProgress>
        {
            ["l1"] = new() { LessonId = "l1", Status = LessonStatus.Mastered },
            ["l3"] = new() { LessonId = "l3", UnlockedByParent = true },
        };
        var s = Progression.Statuses(ids, progress);
        Assert.Equal(NodeStatus.Mastered, s["l1"]);
        Assert.Equal(NodeStatus.Available, s["l2"]);
        Assert.Equal(NodeStatus.Locked, s["cp"]);
        Assert.Equal(NodeStatus.InProgress, s["l3"]);
    }
}
