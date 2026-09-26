using System.Text.Json;
using System.Text.Json.Nodes;
using EnglishPath.Learning.Domain.Completions;
using EnglishPath.Learning.Domain.Content;

namespace EnglishPath.Learning.UnitTests;

public class ContentTests
{
    private static readonly LessonContent Content = LessonContent.Parse(SampleContent.Valid().ToJsonString());

    private static JsonElement Json(string json) => JsonDocument.Parse(json).RootElement;

    private static Exercise Ex(string id) => Content.Exercises.Single(e => e.Id == id);

    [Fact]
    public void Parses_all_seven_exercise_types_regardless_of_property_order()
    {
        Assert.Equal(
            ["multipleChoice", "listenSelect", "fillBlank", "dictation", "matchPairs", "reorderWords", "imageWord", "multipleChoice"],
            Content.Exercises.Select(e => e.Type));
    }

    [Fact]
    public void Serialises_with_type_discriminator_round_trip()
    {
        var json = JsonSerializer.Serialize(Content, LessonContent.JsonOptions);
        var again = LessonContent.Parse(json);
        Assert.Equal(Content.Exercises.Select(e => e.Type), again.Exercises.Select(e => e.Type));
        Assert.Contains("\"type\":\"listenSelect\"", json);
    }

    [Fact]
    public void Valid_content_has_no_problems() => Assert.Empty(LessonContentValidator.Validate(SampleContent.Valid().ToJsonString()));

    [Theory]
    [InlineData("listening")]
    [InlineData("correctIndex")]
    [InlineData("placeholder")]
    [InlineData("duplicate")]
    [InlineData("vocabulary")]
    public void Validator_reports_design_rule_violations(string rule)
    {
        var content = SampleContent.Valid();
        var exercises = content["exercises"]!.AsArray();
        string expected;
        switch (rule)
        {
            case "listening":
                exercises[1]!["skills"] = SampleContent.Strings("vocabulary");
                exercises[3]!["skills"] = SampleContent.Strings("writing");
                expected = "listening exercise";
                break;
            case "correctIndex":
                exercises[0]!["correctIndex"] = 5;
                expected = "correctIndex is out of range";
                break;
            case "placeholder":
                exercises[2]!["sentence"] = "I am Sara.";
                expected = "___ placeholder";
                break;
            case "duplicate":
                exercises[7]!["id"] = "e1";
                expected = "used more than once";
                break;
            default:
                content["vocabulary"] = new JsonArray(Enumerable.Range(0, 11)
                    .Select(i => (JsonNode)new JsonObject { ["id"] = $"v{i}", ["word"] = "w", ["example"] = "x" }).ToArray());
                expected = "at most 10 new words";
                break;
        }

        var problems = LessonContentValidator.Validate(content.ToJsonString());
        Assert.Contains(problems, p => p.Contains(expected, StringComparison.Ordinal));
    }

    [Fact]
    public void Validator_reports_malformed_json() =>
        Assert.Contains("not valid lesson JSON", Assert.Single(LessonContentValidator.Validate("{\"exercises\":[{\"type\":\"nope\"}]}")));

    [Theory]
    [InlineData("e1", """{"type":"multipleChoice","selectedIndex":0}""", true)]
    [InlineData("e1", """{"type":"multipleChoice","selectedIndex":1}""", false)]
    [InlineData("e2", """{"type":"listenSelect","selectedIndex":1}""", true)]
    [InlineData("e3", """{"type":"fillBlank","text":"  AM. "}""", true)]
    [InlineData("e3", """{"type":"fillBlank","text":"’m"}""", true)]
    [InlineData("e3", """{"type":"fillBlank","text":"is"}""", false)]
    [InlineData("e4", """{"type":"dictation","text":"good   morning!"}""", true)]
    [InlineData("e5", """{"type":"matchPairs","pairs":[["dog","perro"],["cat","gato"]]}""", true)]
    [InlineData("e5", """{"type":"matchPairs","pairs":[["dog","gato"],["cat","perro"]]}""", false)]
    [InlineData("e5", """{"type":"matchPairs","pairs":[["cat","gato"]]}""", false)]
    [InlineData("e6", """{"type":"reorderWords","words":["see","you","tomorrow"]}""", true)]
    [InlineData("e6", """{"type":"reorderWords","words":["you","see","tomorrow"]}""", false)]
    [InlineData("e7", """{"type":"imageWord","selectedIndex":0}""", true)]
    [InlineData("e1", """{"type":"multipleChoice"}""", false)]
    [InlineData("e3", """{"type":"fillBlank","text":5}""", false)]
    public void AnswerChecker_matches_client_scoring(string exerciseId, string answer, bool expected) =>
        Assert.Equal(expected, AnswerChecker.IsCorrect(Ex(exerciseId), Json(answer)));

    [Fact]
    public void Grader_counts_first_attempts_only()
    {
        var t0 = new DateTimeOffset(2026, 9, 26, 8, 0, 0, TimeSpan.Zero);
        var attempts = Content.Exercises
            .Select((e, i) => new SubmittedAttempt(e.Id, CorrectAnswer(e), t0.AddSeconds(i + 10), 1000))
            .ToList();
        // Wrong first try on e1, corrected later during mistake review.
        attempts.Add(new SubmittedAttempt("e1", Json("""{"type":"multipleChoice","selectedIndex":1}"""), t0, 900));

        var graded = CompletionGrader.Grade(Content, attempts);

        Assert.True(graded.IsSuccess);
        Assert.Equal(7, graded.Value.CorrectFirstTry);
        Assert.Equal(8, graded.Value.TotalExercises);
        Assert.Equal(["grammar", "listening", "vocabulary"], graded.Value.SkillsPracticed);
        Assert.Equal(["v-hello", "v-goodbye"], graded.Value.VocabularyIds);
    }

    [Fact]
    public void Grader_rejects_incomplete_and_unknown_attempts()
    {
        var t0 = DateTimeOffset.UnixEpoch;
        var one = new SubmittedAttempt("e1", Json("""{"type":"multipleChoice","selectedIndex":0}"""), t0, 1);
        Assert.Equal("completion.incomplete", CompletionGrader.Grade(Content, [one]).Error!.Code);

        var unknown = new SubmittedAttempt("zzz", Json("{}"), t0, 1);
        Assert.Equal("completion.unknown_exercise", CompletionGrader.Grade(Content, [one, unknown]).Error!.Code);
    }

    private static JsonElement CorrectAnswer(Exercise e) => e switch
    {
        MultipleChoiceExercise m => Json($$"""{"type":"multipleChoice","selectedIndex":{{m.CorrectIndex}}}"""),
        ListenSelectExercise l => Json($$"""{"type":"listenSelect","selectedIndex":{{l.CorrectIndex}}}"""),
        ImageWordExercise i => Json($$"""{"type":"imageWord","selectedIndex":{{i.CorrectIndex}}}"""),
        FillBlankExercise f => Json(JsonSerializer.Serialize(new { type = "fillBlank", text = f.AcceptedAnswers[0] })),
        DictationExercise d => Json(JsonSerializer.Serialize(new { type = "dictation", text = d.AcceptedAnswers[0] })),
        MatchPairsExercise m => Json(JsonSerializer.Serialize(new { type = "matchPairs", pairs = m.Pairs })),
        ReorderWordsExercise r => Json(JsonSerializer.Serialize(new { type = "reorderWords", words = r.Words })),
        _ => throw new NotSupportedException(),
    };
}
