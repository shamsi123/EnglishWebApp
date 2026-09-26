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

/// <summary>Published by Identity when an account is created.</summary>
public sealed record UserRegistered(Guid UserId, DateTimeOffset RegisteredAt, bool IsMinor);

/// <summary>
/// Published by Identity when an account is deleted. Every service must erase the user's
/// personal data on receipt (NFR-08, right to erasure).
/// </summary>
public sealed record UserDeleted(Guid UserId, DateTimeOffset DeletedAt);

/// <summary>Published by Identity when the learner finishes or changes onboarding (FR-02).</summary>
public sealed record OnboardingCompleted(Guid UserId, string Goal, int DailyMinutes, string NativeLanguage);

/// <summary>Published by Learning when a learner finishes (or skips) the placement test (FR-10, FR-11).</summary>
public sealed record PlacementCompleted(Guid UserId, string StartLevel, string? HighestPassedLevel, bool Skipped, DateTimeOffset CompletedAt);
