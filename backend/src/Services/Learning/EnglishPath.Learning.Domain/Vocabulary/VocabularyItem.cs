using System.Text.Json;
using EnglishPath.Learning.Domain.Content;

namespace EnglishPath.Learning.Domain.Vocabulary;

/// <summary>
/// Read model of every word taught by a published lesson, keyed by the author's vocabulary id,
/// so review cards can show the word card (FR-32). Rebuilt from lesson content on publish.
/// </summary>
public sealed class VocabularyItem
{
    private VocabularyItem()
    {
    }

    public string Id { get; private set; } = string.Empty;

    public string Word { get; private set; } = string.Empty;

    /// <summary>The <see cref="VocabularyEntry"/> as JSON.</summary>
    public string Entry { get; private set; } = string.Empty;

    public Guid LessonId { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public static VocabularyItem From(VocabularyEntry entry, Guid lessonId, DateTimeOffset now) => new()
    {
        Id = entry.Id,
        Word = entry.Word,
        Entry = JsonSerializer.Serialize(entry, LessonContent.JsonOptions),
        LessonId = lessonId,
        UpdatedAt = now,
    };

    public void Update(VocabularyEntry entry, Guid lessonId, DateTimeOffset now)
    {
        Word = entry.Word;
        Entry = JsonSerializer.Serialize(entry, LessonContent.JsonOptions);
        LessonId = lessonId;
        UpdatedAt = now;
    }
}
