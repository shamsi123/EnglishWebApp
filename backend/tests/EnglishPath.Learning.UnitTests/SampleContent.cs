using System.Text.Json.Nodes;

namespace EnglishPath.Learning.UnitTests;

internal static class SampleContent
{
    private static readonly JsonObject Audio = new() { ["assetId"] = "a1", ["url"] = "https://cdn.example.com/a1.m4a", ["text"] = "Good morning" };

    /// <summary>A valid Pre-A1 lesson: 8 exercises covering all 7 types, including listening.</summary>
    public static JsonObject Valid() => new()
    {
        ["objective"] = "I can say hello and goodbye.",
        ["intro"] = new JsonObject { ["concept"] = "Greetings", ["example"] = "Hello! I am Sara." },
        ["vocabulary"] = new JsonArray(
            new JsonObject { ["id"] = "v-hello", ["word"] = "hello", ["example"] = "Hello, Tom!" },
            new JsonObject { ["id"] = "v-goodbye", ["word"] = "goodbye", ["example"] = "Goodbye!" }),
        ["exercises"] = new JsonArray(
            Exercise("e1", "multipleChoice", "vocabulary", new() { ["options"] = Strings("Hello!", "Goodbye!"), ["correctIndex"] = 0 }),
            // Discriminator deliberately not first, as zod/JS clients may serialise it.
            new JsonObject
            {
                ["id"] = "e2", ["prompt"] = "What do you hear?", ["explanation"] = "x", ["skills"] = Strings("listening"),
                ["audio"] = Audio.DeepClone(), ["options"] = Strings("Good evening", "Good morning"), ["correctIndex"] = 1,
                ["type"] = "listenSelect",
            },
            Exercise("e3", "fillBlank", "grammar", new() { ["sentence"] = "I ___ Sara.", ["acceptedAnswers"] = Strings("am", "'m") }),
            Exercise("e4", "dictation", "listening", new() { ["audio"] = Audio.DeepClone(), ["acceptedAnswers"] = Strings("Good morning") }),
            Exercise("e5", "matchPairs", "vocabulary", new() { ["pairs"] = new JsonArray(Strings("cat", "gato"), Strings("dog", "perro")) }),
            Exercise("e6", "reorderWords", "grammar", new() { ["words"] = Strings("See", "you", "tomorrow") }),
            Exercise("e7", "imageWord", "vocabulary", new()
            {
                ["choices"] = new JsonArray(
                    new JsonObject { ["word"] = "apple", ["image"] = new JsonObject { ["assetId"] = "i1", ["url"] = "https://cdn.example.com/i1.webp", ["text"] = "An apple" } },
                    new JsonObject { ["word"] = "pear", ["image"] = new JsonObject { ["assetId"] = "i2", ["url"] = "https://cdn.example.com/i2.webp", ["text"] = "A pear" } }),
                ["correctIndex"] = 0,
            }),
            Exercise("e8", "multipleChoice", "vocabulary", new() { ["options"] = Strings("Good morning!", "Goodbye!"), ["correctIndex"] = 1 })),
    };

    public static JsonArray Strings(params string[] values) => new(values.Select(v => (JsonNode)JsonValue.Create(v)!).ToArray());

    private static JsonObject Exercise(string id, string type, string skill, JsonObject extra)
    {
        var o = new JsonObject { ["id"] = id, ["type"] = type, ["prompt"] = "Prompt", ["explanation"] = "Because.", ["skills"] = Strings(skill) };
        foreach (var (key, value) in extra)
        {
            o[key] = value?.DeepClone();
        }

        return o;
    }
}
