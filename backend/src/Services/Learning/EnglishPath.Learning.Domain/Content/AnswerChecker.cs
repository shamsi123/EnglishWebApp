using System.Text.Json;
using System.Text.RegularExpressions;

namespace EnglishPath.Learning.Domain.Content;

/// <summary>
/// Server-side re-validation of learner answers (BRD §8.3 decision 3). Must stay in
/// parity with <c>checkAnswer</c> in packages/core/src/content/scoring.ts.
/// </summary>
public static partial class AnswerChecker
{
    /// <summary>Returns whether <paramref name="answer"/> is correct; malformed answers are incorrect.</summary>
    public static bool IsCorrect(Exercise exercise, JsonElement answer)
    {
        try
        {
            return exercise switch
            {
                MultipleChoiceExercise e => Index(answer) == e.CorrectIndex,
                ListenSelectExercise e => Index(answer) == e.CorrectIndex,
                ImageWordExercise e => Index(answer) == e.CorrectIndex,
                FillBlankExercise e => Accepts(e.AcceptedAnswers, answer.GetProperty("text").GetString()),
                DictationExercise e => Accepts(e.AcceptedAnswers, answer.GetProperty("text").GetString()),
                MatchPairsExercise e => MatchesPairs(e, answer.GetProperty("pairs")),
                ReorderWordsExercise e => string.Join(' ', Words(answer.GetProperty("words")).Select(Normalize))
                    == string.Join(' ', e.Words.Select(Normalize)),
                _ => false,
            };
        }
        catch (Exception ex) when (ex is KeyNotFoundException or InvalidOperationException or FormatException)
        {
            return false;
        }
    }

    /// <summary>Case-, whitespace- and trailing-punctuation-insensitive; unifies apostrophes.</summary>
    public static string Normalize(string? value)
    {
        var s = (value ?? string.Empty).Trim().ToLowerInvariant().Replace('‘', '\'').Replace('’', '\'');
        s = Whitespace().Replace(s, " ");
        return TrailingPunctuation().Replace(s, string.Empty);
    }

    private static int Index(JsonElement answer) => answer.GetProperty("selectedIndex").GetInt32();

    private static bool Accepts(IEnumerable<string> accepted, string? given)
    {
        var normalized = Normalize(given);
        return accepted.Any(a => Normalize(a) == normalized);
    }

    private static IEnumerable<string?> Words(JsonElement array) => array.EnumerateArray().Select(w => w.GetString());

    private static bool MatchesPairs(MatchPairsExercise exercise, JsonElement given)
    {
        var expected = exercise.Pairs.ToDictionary(p => p[0], p => p[1]);
        var pairs = given.EnumerateArray().Select(p => (p[0].GetString(), p[1].GetString())).ToList();
        return pairs.Count == expected.Count
            && pairs.All(p => p.Item1 is not null && expected.TryGetValue(p.Item1, out var right) && right == p.Item2);
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    [GeneratedRegex(@"[.!?,;:]+$")]
    private static partial Regex TrailingPunctuation();
}
