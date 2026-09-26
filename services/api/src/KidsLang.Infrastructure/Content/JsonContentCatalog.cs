using System.Text.Json;
using KidsLang.Application.Abstractions;
using KidsLang.Domain;

namespace KidsLang.Infrastructure.Content;

/// <summary>Reads published content from /content JSON (the source of truth for the MVP).</summary>
public sealed class JsonContentCatalog : IContentCatalog
{
    private readonly Dictionary<string, List<JourneyNodeInfo>> _nodes = new();
    private readonly Dictionary<string, JourneyNodeInfo> _byId = new();
    private readonly HashSet<string> _items = new();
    public IReadOnlyList<CourseInfo> Courses { get; }

    public JsonContentCatalog(string contentRoot)
    {
        var courses = new List<CourseInfo>();
        foreach (var coursePath in Directory.EnumerateFiles(contentRoot, "course.json", SearchOption.AllDirectories))
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(coursePath));
            var c = doc.RootElement;
            var courseId = c.GetProperty("id").GetString()!;
            courses.Add(new CourseInfo(courseId, c.GetProperty("languageCode").GetString()!, c.GetProperty("direction").GetString()!,
                c.GetProperty("title").GetProperty("en").GetString()!, c.GetProperty("title").GetProperty(courseId).GetString()!,
                c.GetProperty("mascot").GetProperty("emoji").GetString()!));

            var dm = c.GetProperty("defaultMastery");
            var baseMastery = new MasteryConfig(dm.GetProperty("minScore").GetDouble(), dm.GetProperty("requireEachNewItem").GetBoolean(), dm.GetProperty("minTraceAccuracy").GetDouble());
            var list = new List<JourneyNodeInfo>();
            foreach (var level in c.GetProperty("levels").EnumerateArray())
            {
                var levelId = level.GetProperty("id").GetString()!;
                var levelItems = new List<string>();
                foreach (var unit in level.GetProperty("units").EnumerateArray())
                {
                    var unitId = unit.GetProperty("id").GetString()!;
                    var unitItems = new List<string>();
                    foreach (var lesson in unit.GetProperty("lessons").EnumerateArray())
                    {
                        var newItems = Strings(lesson.GetProperty("newItems"));
                        unitItems.AddRange(newItems);
                        var mastery = baseMastery;
                        if (lesson.TryGetProperty("mastery", out var m))
                        {
                            mastery = mastery with
                            {
                                MinScore = m.TryGetProperty("minScore", out var s) ? s.GetDouble() : mastery.MinScore,
                                RequireEachNewItem = m.TryGetProperty("requireEachNewItem", out var r) ? r.GetBoolean() : mastery.RequireEachNewItem,
                                MinTraceAccuracy = m.TryGetProperty("minTraceAccuracy", out var t) ? t.GetDouble() : mastery.MinTraceAccuracy,
                            };
                        }
                        list.Add(new JourneyNodeInfo(lesson.GetProperty("id").GetString()!, courseId, NodeKind.Lesson, unitId,
                            lesson.GetProperty("title").GetProperty("en").GetString()!, newItems, Strings(lesson.GetProperty("reviewItems")), mastery, null, levelId));
                    }
                    levelItems.AddRange(unitItems);
                    var cp = unit.GetProperty("checkpoint");
                    list.Add(new JourneyNodeInfo(cp.GetProperty("id").GetString()!, courseId, NodeKind.Checkpoint, unitId,
                        unit.GetProperty("title").GetProperty("en").GetString()!, unitItems, [], baseMastery with { RequireEachNewItem = false },
                        unit.GetProperty("sticker").GetString(), levelId));
                }
                var test = level.GetProperty("levelTest");
                list.Add(new JourneyNodeInfo(test.GetProperty("id").GetString()!, courseId, NodeKind.LevelTest, null,
                    level.GetProperty("title").GetProperty("en").GetString()!, levelItems, [], baseMastery with { RequireEachNewItem = false }, null, levelId));
            }
            _nodes[courseId] = list;
            foreach (var n in list) _byId[n.Id] = n;

            var itemsPath = Path.Combine(Path.GetDirectoryName(coursePath)!, "items.json");
            if (File.Exists(itemsPath))
            {
                using var items = JsonDocument.Parse(File.ReadAllText(itemsPath));
                foreach (var i in items.RootElement.GetProperty("items").EnumerateArray()) _items.Add(i.GetProperty("id").GetString()!);
            }
        }
        Courses = courses;
    }

    public IReadOnlyList<JourneyNodeInfo> Nodes(string courseId) => _nodes.GetValueOrDefault(courseId) ?? [];
    public JourneyNodeInfo? FindNode(string nodeId) => _byId.GetValueOrDefault(nodeId);
    public bool ItemExists(string itemId) => _items.Contains(itemId);

    private static List<string> Strings(JsonElement arr) => arr.EnumerateArray().Select(e => e.GetString()!).ToList();

    /// <summary>Walks up from <paramref name="start"/> to find the repository's /content folder.</summary>
    public static string LocateContentRoot(string start)
    {
        for (var dir = new DirectoryInfo(start); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "content");
            if (Directory.Exists(Path.Combine(candidate, "arabic"))) return candidate;
        }
        throw new DirectoryNotFoundException("Could not find the /content folder; set Content:Root.");
    }
}
