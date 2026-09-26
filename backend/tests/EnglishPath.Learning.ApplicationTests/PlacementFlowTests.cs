using System.Text.Json;
using System.Text.Json.Nodes;
using EnglishPath.Contracts;
using EnglishPath.Learning.Application.Placement;
using EnglishPath.Learning.Domain.Placement;
using EnglishPath.Learning.Domain.Units;
using EnglishPath.Learning.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Learning.ApplicationTests;

public class PlacementFlowTests
{
    private readonly Guid _learner = Guid.NewGuid();
    private readonly FakeClock _clock = new();
    private readonly RecordingPublisher _publisher = new();

    private PlacementHandlers Handlers(LearningDbContext db) => new(db, new FakeUser(_learner), _publisher, _clock);

    private static void SeedItems(LearningDbContext db, params CefrLevel[] levels)
    {
        var skills = PlacementItem.Skills;
        foreach (var level in levels)
        {
            for (var i = 0; i < 5; i++)
            {
                var content = new JsonObject
                {
                    ["id"] = $"{level}-{i}",
                    ["type"] = "multipleChoice",
                    ["prompt"] = "Pick",
                    ["explanation"] = "secret explanation",
                    ["skills"] = new JsonArray(skills[i % skills.Count]),
                    ["options"] = new JsonArray("right", "wrong"),
                    ["correctIndex"] = 0,
                };
                db.PlacementItems.Add(PlacementItem.Create(level, content.ToJsonString(), DateTimeOffset.UnixEpoch).Value);
            }
        }

        // Course content up to A2 caps the result.
        db.AddPublishedLesson(db.AddUnit(CefrLevel.A2, 0), 0);
        db.SaveChanges();
    }

    private static JsonElement Answer(int index) => JsonDocument.Parse($$"""{"type":"multipleChoice","selectedIndex":{{index}}}""").RootElement;

    [Fact]
    public async Task Questions_hide_the_answer_key_and_mix_skills()
    {
        await using var db = TestDb.Create();
        SeedItems(db, CefrLevel.PreA1, CefrLevel.A1, CefrLevel.A2);

        var step = (await Handlers(db).Handle(new StartPlacementCommand(), default)).Value;

        var question = step.Question!.Exercise;
        Assert.False(question.ContainsKey("correctIndex"));
        Assert.False(question.ContainsKey("explanation"));
        Assert.Equal(20, step.MaxQuestions);

        var skills = new List<string>();
        for (var i = 0; i < 4; i++)
        {
            skills.Add((await db.PlacementItems.FindAsync(step.Question!.ItemId))!.Skill);
            step = (await Handlers(db).Handle(new AnswerPlacementCommand(step.SessionId, step.Question.ItemId, Answer(0)), default)).Value;
        }

        Assert.Equal(4, skills.Distinct().Count());
    }

    [Fact]
    public async Task Answering_everything_right_places_at_the_top_content_level()
    {
        await using var db = TestDb.Create();
        SeedItems(db, CefrLevel.PreA1, CefrLevel.A1, CefrLevel.A2);

        var step = (await Handlers(db).Handle(new StartPlacementCommand(), default)).Value;
        while (step.Result is null)
        {
            step = (await Handlers(db).Handle(new AnswerPlacementCommand(step.SessionId, step.Question!.ItemId, Answer(0)), default)).Value;
        }

        Assert.Equal("A2", step.Result.StartLevel);
        Assert.Equal(8, step.Answered);
        Assert.Equal(CefrLevel.A2, (await db.Placements.SingleAsync(p => p.Id == _learner)).StartLevel);
        var evt = Assert.IsType<PlacementCompleted>(Assert.Single(_publisher.Published));
        Assert.Equal("A2", evt.StartLevel);
        Assert.False(evt.Skipped);
    }

    [Fact]
    public async Task Answering_everything_wrong_starts_at_the_beginning()
    {
        await using var db = TestDb.Create();
        SeedItems(db, CefrLevel.PreA1, CefrLevel.A1, CefrLevel.A2);

        var step = (await Handlers(db).Handle(new StartPlacementCommand(), default)).Value;
        while (step.Result is null)
        {
            step = (await Handlers(db).Handle(new AnswerPlacementCommand(step.SessionId, step.Question!.ItemId, Answer(1)), default)).Value;
        }

        Assert.Equal("PreA1", step.Result.StartLevel);
        Assert.Null(step.Result.HighestPassedLevel);
    }

    [Fact]
    public async Task Restarting_resumes_the_same_question()
    {
        await using var db = TestDb.Create();
        SeedItems(db, CefrLevel.A1);

        var first = (await Handlers(db).Handle(new StartPlacementCommand(), default)).Value;
        var again = (await Handlers(db).Handle(new StartPlacementCommand(), default)).Value;

        Assert.Equal(first.SessionId, again.SessionId);
        Assert.Equal(first.Question!.ItemId, again.Question!.ItemId);
    }

    [Fact]
    public async Task Rejects_answers_for_a_question_that_was_not_asked()
    {
        await using var db = TestDb.Create();
        SeedItems(db, CefrLevel.A1);
        var step = (await Handlers(db).Handle(new StartPlacementCommand(), default)).Value;
        var other = await db.PlacementItems.FirstAsync(i => i.Id != step.Question!.ItemId);

        var result = await Handlers(db).Handle(new AnswerPlacementCommand(step.SessionId, other.Id, Answer(0)), default);

        Assert.Equal("placement.unexpected_item", result.Error!.Code);
    }

    [Fact]
    public async Task Finishes_early_when_the_item_bank_runs_out()
    {
        await using var db = TestDb.Create();
        SeedItems(db, CefrLevel.A1); // 5 A1 items, nothing else

        var step = (await Handlers(db).Handle(new StartPlacementCommand(), default)).Value;
        while (step.Result is null)
        {
            step = (await Handlers(db).Handle(new AnswerPlacementCommand(step.SessionId, step.Question!.ItemId, Answer(0)), default)).Value;
        }

        Assert.Equal("A2", step.Result.StartLevel);
    }

    [Fact]
    public async Task Is_unavailable_without_items_and_skip_starts_at_pre_A1()
    {
        await using var db = TestDb.Create();
        Assert.Equal("placement.unavailable", (await Handlers(db).Handle(new StartPlacementCommand(), default)).Error!.Code);

        Assert.True((await Handlers(db).Handle(new SkipPlacementCommand(), default)).IsSuccess);
        var placement = await db.Placements.SingleAsync(p => p.Id == _learner);
        Assert.True(placement.Skipped);
        Assert.Equal(CefrLevel.PreA1, placement.StartLevel);
    }
}
