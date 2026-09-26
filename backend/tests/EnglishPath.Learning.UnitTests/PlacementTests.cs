using System.Text.Json.Nodes;
using EnglishPath.Learning.Domain.Placement;
using EnglishPath.Learning.Domain.Units;

namespace EnglishPath.Learning.UnitTests;

public class PlacementSessionTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 26, 8, 0, 0, TimeSpan.Zero);

    private static PlacementSession NewSession(CefrLevel min = CefrLevel.PreA1, CefrLevel max = CefrLevel.A2) =>
        PlacementSession.Start(Guid.NewGuid(), min, max, Now);

    /// <summary>Answers one block at the current level with the given number correct.</summary>
    private static void AnswerBlock(PlacementSession session, int correct)
    {
        for (var i = 0; i < PlacementSession.ItemsPerBlock; i++)
        {
            var item = Guid.NewGuid();
            session.Present(item);
            Assert.True(session.RecordAnswer(item, i < correct, Now.AddMinutes(1)).IsSuccess);
        }
    }

    [Fact]
    public void Starts_at_A1()
    {
        var session = NewSession();
        Assert.Equal(CefrLevel.A1, session.CurrentLevel);
        Assert.Equal(20, session.MaxQuestions);
    }

    [Fact]
    public void Passing_every_level_places_at_the_top_level()
    {
        var session = NewSession();
        AnswerBlock(session, 4);
        Assert.Equal(CefrLevel.A2, session.CurrentLevel);
        AnswerBlock(session, 3);

        Assert.Equal(PlacementStatus.Completed, session.Status);
        Assert.Equal(CefrLevel.A2, session.HighestPassed);
        Assert.Equal(CefrLevel.A2, session.StartLevel);
        var evt = Assert.Single(session.DomainEvents.OfType<PlacementCompletedDomainEvent>());
        Assert.Equal(CefrLevel.A2, evt.StartLevel);
    }

    [Fact]
    public void Passing_A1_and_failing_A2_starts_at_A2()
    {
        var session = NewSession();
        AnswerBlock(session, 4);
        AnswerBlock(session, 2);

        Assert.Equal(PlacementStatus.Completed, session.Status);
        Assert.Equal(CefrLevel.A1, session.HighestPassed);
        Assert.Equal(CefrLevel.A2, session.StartLevel);
    }

    [Fact]
    public void Failing_A1_then_passing_PreA1_starts_at_A1()
    {
        var session = NewSession();
        AnswerBlock(session, 1);
        Assert.Equal(CefrLevel.PreA1, session.CurrentLevel);
        AnswerBlock(session, 4);

        Assert.Equal(CefrLevel.PreA1, session.HighestPassed);
        Assert.Equal(CefrLevel.A1, session.StartLevel);
    }

    [Fact]
    public void Failing_everything_starts_at_the_beginning()
    {
        var session = NewSession();
        AnswerBlock(session, 0);
        AnswerBlock(session, 2);

        Assert.Equal(PlacementStatus.Completed, session.Status);
        Assert.Null(session.HighestPassed);
        Assert.Equal(CefrLevel.PreA1, session.StartLevel);
    }

    [Fact]
    public void Stays_in_a_block_until_it_is_complete()
    {
        var session = NewSession();
        var item = Guid.NewGuid();
        session.Present(item);
        session.RecordAnswer(item, true, Now);
        Assert.Equal(CefrLevel.A1, session.CurrentLevel);
        Assert.Equal(PlacementStatus.InProgress, session.Status);
        Assert.Contains(item, session.AskedItemIds);
    }

    [Fact]
    public void Rejects_answers_to_other_items_after_expiry_and_after_completion()
    {
        var session = NewSession();
        session.Present(Guid.NewGuid());
        Assert.Equal("placement.unexpected_item", session.RecordAnswer(Guid.NewGuid(), true, Now).Error!.Code);

        var expired = NewSession();
        var item = Guid.NewGuid();
        expired.Present(item);
        Assert.Equal("placement.expired", expired.RecordAnswer(item, true, Now.AddMinutes(31)).Error!.Code);

        var done = NewSession(CefrLevel.PreA1, CefrLevel.PreA1);
        AnswerBlock(done, 4);
        Assert.Equal(PlacementStatus.Completed, done.Status);
        Assert.Equal("placement.finished", done.RecordAnswer(Guid.NewGuid(), true, Now).Error!.Code);
    }

    [Fact]
    public void Finish_uses_what_was_answered_when_the_item_bank_runs_out()
    {
        var session = NewSession();
        AnswerBlock(session, 4);
        session.Finish(Now);
        Assert.Equal(CefrLevel.A2, session.StartLevel);
    }

    [Fact]
    public void Skip_starts_from_the_lowest_level()
    {
        var placement = LearnerPlacement.Create(Guid.NewGuid());
        placement.Skip(CefrLevel.PreA1, Now);
        Assert.True(placement.Skipped);
        Assert.Equal(CefrLevel.PreA1, placement.StartLevel);
    }
}

public class PlacementItemTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.UnixEpoch;

    private static JsonObject Item(string type, string skill = "grammar") => new()
    {
        ["id"] = "p1",
        ["type"] = type,
        ["prompt"] = "Choose",
        ["explanation"] = "x",
        ["skills"] = SampleContent.Strings(skill),
        ["options"] = SampleContent.Strings("is", "are"),
        ["correctIndex"] = 0,
        ["sentence"] = "She ___ here.",
        ["acceptedAnswers"] = SampleContent.Strings("is"),
        ["words"] = SampleContent.Strings("a", "b"),
    };

    [Fact]
    public void Accepts_server_scorable_types()
    {
        var result = PlacementItem.Create(CefrLevel.A1, Item("multipleChoice").ToJsonString(), Now);
        Assert.True(result.IsSuccess);
        Assert.Equal("grammar", result.Value.Skill);
        Assert.True(PlacementItem.Create(CefrLevel.A1, Item("fillBlank").ToJsonString(), Now).IsSuccess);
    }

    [Fact]
    public void Rejects_types_whose_answer_is_visible_to_the_client() =>
        Assert.Contains("must be one of", PlacementItem.Create(CefrLevel.A1, Item("reorderWords").ToJsonString(), Now).Error!.Message);

    [Fact]
    public void Requires_a_placement_skill() =>
        Assert.Contains("Tag the item", PlacementItem.Create(CefrLevel.A1, Item("multipleChoice", "speaking").ToJsonString(), Now).Error!.Message);
}

public class AudioSignatureTests
{
    [Theory]
    [InlineData(new byte[] { 0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4D, 0x34, 0x41, 0x20 }, "audio/mp4")]
    [InlineData(new byte[] { 0x4F, 0x67, 0x67, 0x53, 0, 2 }, "audio/ogg")]
    [InlineData(new byte[] { 0x1A, 0x45, 0xDF, 0xA3, 1 }, "audio/webm")]
    [InlineData(new byte[] { 0xFF, 0xFB, 0x90, 0x44 }, "audio/mpeg")]
    [InlineData(new byte[] { 0x49, 0x44, 0x33, 4 }, "audio/mpeg")]
    public void Detects_supported_formats(byte[] header, string contentType) =>
        Assert.Equal(contentType, EnglishPath.Learning.Domain.Media.AudioSignature.Detect(header)?.ContentType);

    [Fact]
    public void Rejects_other_bytes() =>
        Assert.Null(EnglishPath.Learning.Domain.Media.AudioSignature.Detect("%PDF-1.7"u8));
}
