using System.Text.Json;

namespace EnglishPath.Learning.Domain.Content;

/// <summary>Lesson design rules enforced before a lesson can go to review (BRD §6, FR-21).</summary>
public static class LessonContentValidator
{
    public const int MinExercises = 8;
    public const int MaxExercises = 15;
    public const int MaxNewWords = 10;

    public static IReadOnlyList<string> Validate(string json)
    {
        LessonContent content;
        try
        {
            content = LessonContent.Parse(json);
        }
        catch (JsonException ex)
        {
            return [$"Content is not valid lesson JSON: {ex.Message}"];
        }

        var problems = new List<string>();
        if (string.IsNullOrWhiteSpace(content.Objective))
        {
            problems.Add("A can-do objective is required.");
        }

        if (content.Exercises.Count is < MinExercises or > MaxExercises)
        {
            problems.Add($"A lesson needs {MinExercises}–{MaxExercises} exercises (has {content.Exercises.Count}).");
        }

        if (content.Vocabulary.Count > MaxNewWords)
        {
            problems.Add($"A lesson may introduce at most {MaxNewWords} new words.");
        }

        if (!content.Exercises.Any(e => e.Skills.Contains("listening")))
        {
            problems.Add("A lesson needs at least one listening exercise.");
        }

        foreach (var duplicate in content.Exercises.GroupBy(e => e.Id).Where(g => g.Count() > 1))
        {
            problems.Add($"Exercise id '{duplicate.Key}' is used more than once.");
        }

        foreach (var exercise in content.Exercises)
        {
            problems.AddRange(ValidateExercise(exercise).Select(p => $"Exercise '{exercise.Id}': {p}"));
        }

        return problems;
    }

    public static IEnumerable<string> ValidateExercise(Exercise exercise)
    {
        if (exercise.Skills.Count == 0)
        {
            yield return "at least one skill tag is required.";
        }

        switch (exercise)
        {
            case MultipleChoiceExercise e when !InRange(e.CorrectIndex, e.Options.Count):
            case ListenSelectExercise l when !InRange(l.CorrectIndex, l.Options.Count):
            case ImageWordExercise i when !InRange(i.CorrectIndex, i.Choices.Count):
                yield return "correctIndex is out of range.";
                break;
            case ListenSelectExercise or DictationExercise when exercise.Audio is null:
                yield return "audio is required.";
                break;
            case FillBlankExercise f when !f.Sentence.Contains("___", StringComparison.Ordinal):
                yield return "the sentence needs a ___ placeholder.";
                break;
            case FillBlankExercise { AcceptedAnswers.Count: 0 } or DictationExercise { AcceptedAnswers.Count: 0 }:
                yield return "at least one accepted answer is required.";
                break;
            case MatchPairsExercise m when m.Pairs.Count < 2 || m.Pairs.Any(p => p.Count != 2):
                yield return "at least two [left, right] pairs are required.";
                break;
            case ReorderWordsExercise { Words.Count: < 2 }:
                yield return "at least two words are required.";
                break;
        }

        if (exercise.Audio is { Text: var transcript } && string.IsNullOrWhiteSpace(transcript))
        {
            yield return "audio needs a transcript (NFR-09).";
        }
    }

    private static bool InRange(int index, int count) => count >= 2 && index >= 0 && index < count;
}
