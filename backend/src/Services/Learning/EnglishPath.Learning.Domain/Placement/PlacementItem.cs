using System.Text.Json;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Learning.Domain.Content;
using EnglishPath.Learning.Domain.Units;

namespace EnglishPath.Learning.Domain.Placement;

/// <summary>
/// A calibrated question in the placement item bank (FR-10). Only question types whose answer key
/// can be withheld from the client are allowed, because placement is scored on the server.
/// </summary>
public sealed class PlacementItem : Entity<Guid>
{
    public static readonly IReadOnlySet<string> AllowedTypes = new HashSet<string>
    {
        ExerciseTypes.MultipleChoice,
        ExerciseTypes.ListenSelect,
        ExerciseTypes.ImageWord,
        ExerciseTypes.FillBlank,
    };

    /// <summary>Skills the placement test must cover (FR-10).</summary>
    public static readonly IReadOnlyList<string> Skills = ["grammar", "vocabulary", "reading", "listening"];

    private PlacementItem()
    {
    }

    public CefrLevel Level { get; private set; }

    /// <summary>The primary skill tested, used to rotate skills within a block.</summary>
    public string Skill { get; private set; } = string.Empty;

    /// <summary>Exercise JSON in the lesson content format.</summary>
    public string Content { get; private set; } = string.Empty;

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public Exercise Exercise => JsonSerializer.Deserialize<Exercise>(Content, LessonContent.JsonOptions)!;

    public static Result<PlacementItem> Create(CefrLevel level, string content, DateTimeOffset now)
    {
        Exercise exercise;
        try
        {
            exercise = JsonSerializer.Deserialize<Exercise>(content, LessonContent.JsonOptions)
                ?? throw new JsonException("Exercise is empty.");
        }
        catch (JsonException ex)
        {
            return new Error("placement.invalid_item", $"Not a valid exercise: {ex.Message}");
        }

        if (!AllowedTypes.Contains(exercise.Type))
        {
            return new Error("placement.invalid_item", $"Placement items must be one of: {string.Join(", ", AllowedTypes)}.");
        }

        var problems = LessonContentValidator.ValidateExercise(exercise).ToList();
        if (problems.Count > 0)
        {
            return new Error("placement.invalid_item", string.Join(" ", problems));
        }

        var skill = exercise.Skills.FirstOrDefault(Skills.Contains);
        if (skill is null)
        {
            return new Error("placement.invalid_item", $"Tag the item with one of: {string.Join(", ", Skills)}.");
        }

        return new PlacementItem
        {
            Id = Guid.NewGuid(),
            Level = level,
            Skill = skill,
            Content = content,
            IsActive = true,
            CreatedAt = now,
        };
    }

    public void Retire() => IsActive = false;
}
