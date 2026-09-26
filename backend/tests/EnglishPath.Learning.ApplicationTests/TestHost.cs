using System.Text.Json.Nodes;
using EnglishPath.BuildingBlocks.Application;
using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Learning.Domain.Completions;
using EnglishPath.Learning.Domain.Lessons;
using EnglishPath.Learning.Domain.Units;
using EnglishPath.Learning.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Learning.ApplicationTests;

internal sealed class FakeUser(Guid id) : ICurrentUser
{
    public Guid UserId { get; } = id;

    public bool IsInRole(string role) => false;
}

internal sealed class FakeClock : IClock
{
    public DateTimeOffset UtcNow { get; set; } = new(2026, 9, 26, 8, 0, 0, TimeSpan.Zero);
}

internal sealed class RecordingPublisher : IIntegrationEventPublisher
{
    public List<object> Published { get; } = [];

    public Task PublishAsync<T>(T message, CancellationToken cancellationToken)
        where T : class
    {
        Published.Add(message);
        return Task.CompletedTask;
    }
}

internal static class TestDb
{
    public static LearningDbContext Create() =>
        new(new DbContextOptionsBuilder<LearningDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    public static CourseUnit AddUnit(this LearningDbContext db, CefrLevel level, int order)
    {
        var unit = CourseUnit.Create(level, order, $"{level} unit {order}");
        db.Units.Add(unit);
        return unit;
    }

    /// <summary>A published lesson with <paramref name="exercises"/> multiple-choice items (answer index 0).</summary>
    public static Lesson AddPublishedLesson(this LearningDbContext db, CourseUnit unit, int order, LessonKind kind = LessonKind.Lesson, int exercises = 10)
    {
        var lesson = Lesson.Create(unit.Id, order, $"{unit.Title} lesson {order}", Content(exercises).ToJsonString(), DateTimeOffset.UnixEpoch, kind);
        lesson.SubmitForReview(DateTimeOffset.UnixEpoch);
        lesson.Publish(Guid.NewGuid(), DateTimeOffset.UnixEpoch);
        db.Lessons.Add(lesson);
        return lesson;
    }

    public static void Complete(this LearningDbContext db, Guid userId, Lesson lesson, int correct, int total = 10) =>
        db.Completions.Add(LessonCompletion.Record(Guid.NewGuid(), userId, lesson.Id, 1, correct, total, new DateOnly(2026, 9, 26), DateTimeOffset.UnixEpoch));

    public static JsonObject Content(int exercises) => new()
    {
        ["objective"] = "I can test.",
        ["intro"] = new JsonObject { ["concept"] = "c", ["example"] = "e" },
        ["vocabulary"] = new JsonArray(new JsonObject { ["id"] = "v-test", ["word"] = "test", ["example"] = "A test.", ["ipa"] = "/test/" }),
        ["exercises"] = new JsonArray(Enumerable.Range(1, exercises).Select(i => (JsonNode)new JsonObject
        {
            ["id"] = $"e{i}",
            ["type"] = "multipleChoice",
            ["prompt"] = "p",
            ["explanation"] = "x",
            ["skills"] = new JsonArray(i == 1 ? "listening" : "vocabulary"),
            ["options"] = new JsonArray("right", "wrong"),
            ["correctIndex"] = 0,
        }).ToArray()),
    };
}
