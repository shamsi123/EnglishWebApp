using System.Text.Json;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Learning.Domain.Content;

namespace EnglishPath.Learning.Domain.Completions;

public sealed record SubmittedAttempt(string ExerciseId, JsonElement Answer, DateTimeOffset AnsweredAt, int TimeTakenMs);

public sealed record GradedLesson(int CorrectFirstTry, int TotalExercises, IReadOnlyList<string> SkillsPracticed, IReadOnlyList<string> VocabularyIds);

/// <summary>
/// Re-grades a lesson from the learner's attempts. Each exercise must have been attempted;
/// only the first attempt per exercise counts toward the score, mirroring the client
/// (mistake review repeats do not earn first-try credit).
/// </summary>
public static class CompletionGrader
{
    public static Result<GradedLesson> Grade(LessonContent content, IReadOnlyList<SubmittedAttempt> attempts)
    {
        var firstAttempts = attempts
            .OrderBy(a => a.AnsweredAt)
            .GroupBy(a => a.ExerciseId)
            .ToDictionary(g => g.Key, g => g.First());

        var unknown = firstAttempts.Keys.Except(content.Exercises.Select(e => e.Id)).FirstOrDefault();
        if (unknown is not null)
        {
            return new Error("completion.unknown_exercise", $"Exercise '{unknown}' is not part of this lesson version.");
        }

        var missing = content.Exercises.FirstOrDefault(e => !firstAttempts.ContainsKey(e.Id));
        if (missing is not null)
        {
            return new Error("completion.incomplete", $"Exercise '{missing.Id}' was not attempted.");
        }

        var correct = content.Exercises.Count(e => AnswerChecker.IsCorrect(e, firstAttempts[e.Id].Answer));
        var skills = content.Exercises.SelectMany(e => e.Skills).Distinct().Order().ToList();
        var vocabulary = content.Vocabulary.Select(v => v.Id).ToList();
        return new GradedLesson(correct, content.Exercises.Count, skills, vocabulary);
    }
}
