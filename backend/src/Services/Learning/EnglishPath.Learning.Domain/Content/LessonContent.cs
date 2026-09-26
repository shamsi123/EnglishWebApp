using System.Text.Json;
using System.Text.Json.Serialization;

namespace EnglishPath.Learning.Domain.Content;

// Server-side mirror of the lesson content schema in packages/core/src/content/schema.ts
// (BRD §8.3 decision 2). Stored as JSON; parsed here for validation and answer re-checking.

public sealed record MediaRef(string AssetId, string Url, string Text);

public sealed record LessonIntro(string Concept, string Example);

public sealed record VocabularyEntry(
    string Id,
    string Word,
    string Example,
    string? Ipa = null,
    string? Translation = null,
    MediaRef? AudioUk = null,
    MediaRef? AudioUs = null,
    MediaRef? Image = null);

public sealed record LessonContent(
    string Objective,
    LessonIntro Intro,
    IReadOnlyList<VocabularyEntry> Vocabulary,
    IReadOnlyList<Exercise> Exercises,
    string? GrammarPoint = null)
{
    public static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new ExerciseJsonConverter() },
    };

    public static LessonContent Parse(string json) =>
        JsonSerializer.Deserialize<LessonContent>(json, JsonOptions)
        ?? throw new JsonException("Lesson content is empty.");
}

public abstract record Exercise
{
    public required string Id { get; init; }

    public required string Prompt { get; init; }

    public required string Explanation { get; init; }

    public required IReadOnlyList<string> Skills { get; init; }

    public MediaRef? Audio { get; init; }

    public MediaRef? Image { get; init; }

    [JsonIgnore]
    public abstract string Type { get; }
}

public sealed record MultipleChoiceExercise : Exercise
{
    public required IReadOnlyList<string> Options { get; init; }

    public required int CorrectIndex { get; init; }

    public override string Type => ExerciseTypes.MultipleChoice;
}

public sealed record ListenSelectExercise : Exercise
{
    public required IReadOnlyList<string> Options { get; init; }

    public required int CorrectIndex { get; init; }

    public override string Type => ExerciseTypes.ListenSelect;
}

public sealed record ImageChoice(string Word, MediaRef Image);

public sealed record ImageWordExercise : Exercise
{
    public required IReadOnlyList<ImageChoice> Choices { get; init; }

    public required int CorrectIndex { get; init; }

    public override string Type => ExerciseTypes.ImageWord;
}

public sealed record FillBlankExercise : Exercise
{
    public required string Sentence { get; init; }

    public required IReadOnlyList<string> AcceptedAnswers { get; init; }

    public override string Type => ExerciseTypes.FillBlank;
}

public sealed record DictationExercise : Exercise
{
    public required IReadOnlyList<string> AcceptedAnswers { get; init; }

    public override string Type => ExerciseTypes.Dictation;
}

public sealed record MatchPairsExercise : Exercise
{
    /// <summary>Each pair is a two-element array <c>[left, right]</c>.</summary>
    public required IReadOnlyList<IReadOnlyList<string>> Pairs { get; init; }

    public override string Type => ExerciseTypes.MatchPairs;
}

public sealed record ReorderWordsExercise : Exercise
{
    public required IReadOnlyList<string> Words { get; init; }

    public override string Type => ExerciseTypes.ReorderWords;
}

/// <summary>The 7 MVP exercise types (FR-22).</summary>
public static class ExerciseTypes
{
    public const string MultipleChoice = "multipleChoice";
    public const string ListenSelect = "listenSelect";
    public const string ImageWord = "imageWord";
    public const string FillBlank = "fillBlank";
    public const string Dictation = "dictation";
    public const string MatchPairs = "matchPairs";
    public const string ReorderWords = "reorderWords";
}

/// <summary>
/// Dispatches on the <c>type</c> property wherever it appears in the object; the built-in
/// polymorphism support in .NET 8 requires the discriminator to be the first property.
/// </summary>
public sealed class ExerciseJsonConverter : JsonConverter<Exercise>
{
    public override Exercise Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        using var doc = JsonDocument.ParseValue(ref reader);
        if (!doc.RootElement.TryGetProperty("type", out var typeProp) || typeProp.ValueKind != JsonValueKind.String)
        {
            throw new JsonException("Exercise is missing a 'type'.");
        }

        var target = typeProp.GetString() switch
        {
            ExerciseTypes.MultipleChoice => typeof(MultipleChoiceExercise),
            ExerciseTypes.ListenSelect => typeof(ListenSelectExercise),
            ExerciseTypes.ImageWord => typeof(ImageWordExercise),
            ExerciseTypes.FillBlank => typeof(FillBlankExercise),
            ExerciseTypes.Dictation => typeof(DictationExercise),
            ExerciseTypes.MatchPairs => typeof(MatchPairsExercise),
            ExerciseTypes.ReorderWords => typeof(ReorderWordsExercise),
            var other => throw new JsonException($"Unknown exercise type '{other}'."),
        };

        return (Exercise)(doc.RootElement.Deserialize(target, WithoutThisConverter(options))
            ?? throw new JsonException("Exercise is empty."));
    }

    public override void Write(Utf8JsonWriter writer, Exercise value, JsonSerializerOptions options)
    {
        var element = JsonSerializer.SerializeToElement(value, value.GetType(), WithoutThisConverter(options));
        writer.WriteStartObject();
        writer.WriteString("type", value.Type);
        foreach (var property in element.EnumerateObject())
        {
            property.WriteTo(writer);
        }

        writer.WriteEndObject();
    }

    private static readonly System.Runtime.CompilerServices.ConditionalWeakTable<JsonSerializerOptions, JsonSerializerOptions> Cache = new();

    private static JsonSerializerOptions WithoutThisConverter(JsonSerializerOptions options) =>
        Cache.GetValue(options, o =>
        {
            var copy = new JsonSerializerOptions(o);
            for (var i = copy.Converters.Count - 1; i >= 0; i--)
            {
                if (copy.Converters[i] is ExerciseJsonConverter)
                {
                    copy.Converters.RemoveAt(i);
                }
            }

            return copy;
        });
}
