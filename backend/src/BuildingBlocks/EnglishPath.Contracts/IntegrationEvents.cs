namespace EnglishPath.Contracts;

// Integration events published over RabbitMQ (BRD §8.2). These are the only types shared
// between services; treat them as a public contract and evolve them additively.

/// <summary>Published by Learning when a learner finishes a lesson (server-validated).</summary>
public sealed record LessonCompleted(
    Guid CompletionId,
    Guid UserId,
    Guid LessonId,
    int LessonVersion,
    int CorrectFirstTry,
    int TotalExercises,
    IReadOnlyList<string> SkillsPracticed,
    IReadOnlyList<string> VocabularyIds,
    DateTimeOffset CompletedAt,
    DateOnly LearnerLocalDay);

/// <summary>Published by Learning when a lesson version goes live (FR-82).</summary>
public sealed record LessonPublished(Guid LessonId, Guid UnitId, int Version, DateTimeOffset PublishedAt);

/// <summary>Published by Progress when a streak is lost.</summary>
public sealed record StreakBroken(Guid UserId, int PreviousStreak, DateOnly LearnerLocalDay);
