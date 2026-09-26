using EnglishPath.Learning.Application.Learner;
using EnglishPath.Learning.Domain.Lessons;
using EnglishPath.Learning.Domain.Placement;
using EnglishPath.Learning.Domain.Units;

namespace EnglishPath.Learning.ApplicationTests;

public class CourseMapTests
{
    private readonly Guid _learner = Guid.NewGuid();

    private async Task<Dictionary<Guid, string>> StatesAsync(Infrastructure.Persistence.LearningDbContext db)
    {
        await db.SaveChangesAsync();
        var map = (await new GetCourseMapHandler(db, new FakeUser(_learner)).Handle(new GetCourseMapQuery(), default)).Value;
        return map.Levels.SelectMany(l => l.Units).SelectMany(u => u.Lessons).ToDictionary(l => l.Id, l => l.State);
    }

    [Fact]
    public async Task Lessons_then_checkpoint_then_next_unit_unlock_in_order()
    {
        await using var db = TestDb.Create();
        var u1 = db.AddUnit(CefrLevel.PreA1, 0);
        var u2 = db.AddUnit(CefrLevel.PreA1, 1);
        var l1 = db.AddPublishedLesson(u1, 0);
        var l2 = db.AddPublishedLesson(u1, 1);
        var checkpoint = db.AddPublishedLesson(u1, 9, LessonKind.Checkpoint);
        var l3 = db.AddPublishedLesson(u2, 0);

        var s = await StatesAsync(db);
        Assert.Equal(["unlocked", "locked", "locked", "locked"], new[] { s[l1.Id], s[l2.Id], s[checkpoint.Id], s[l3.Id] });

        db.Complete(_learner, l1, 5);
        db.Complete(_learner, l2, 10);
        s = await StatesAsync(db);
        Assert.Equal(["completed", "completed", "unlocked", "locked"], new[] { s[l1.Id], s[l2.Id], s[checkpoint.Id], s[l3.Id] });

        // 60% fails the checkpoint (FR-12): it stays open and the next unit stays locked.
        db.Complete(_learner, checkpoint, 6);
        s = await StatesAsync(db);
        Assert.Equal("unlocked", s[checkpoint.Id]);
        Assert.Equal("locked", s[l3.Id]);

        db.Complete(_learner, checkpoint, 7);
        s = await StatesAsync(db);
        Assert.Equal("completed", s[checkpoint.Id]);
        Assert.Equal("unlocked", s[l3.Id]);
    }

    [Fact]
    public async Task Unit_without_checkpoint_unlocks_the_next_when_all_lessons_are_done()
    {
        await using var db = TestDb.Create();
        var u1 = db.AddUnit(CefrLevel.PreA1, 0);
        var u2 = db.AddUnit(CefrLevel.A1, 0);
        var l1 = db.AddPublishedLesson(u1, 0);
        var l2 = db.AddPublishedLesson(u2, 0);
        db.Complete(_learner, l1, 1);

        Assert.Equal("unlocked", (await StatesAsync(db))[l2.Id]);
    }

    [Fact]
    public async Task Placement_opens_lower_levels_and_the_first_unit_at_the_placed_level()
    {
        await using var db = TestDb.Create();
        var pre = db.AddUnit(CefrLevel.PreA1, 0);
        var a1First = db.AddUnit(CefrLevel.A1, 0);
        var a1Second = db.AddUnit(CefrLevel.A1, 1);
        var preLessons = new[] { db.AddPublishedLesson(pre, 0), db.AddPublishedLesson(pre, 1), db.AddPublishedLesson(pre, 9, LessonKind.Checkpoint) };
        var a1Lessons = new[] { db.AddPublishedLesson(a1First, 0), db.AddPublishedLesson(a1First, 1) };
        var later = db.AddPublishedLesson(a1Second, 0);
        var placement = LearnerPlacement.Create(_learner);
        placement.Place(CefrLevel.A1, DateTimeOffset.UnixEpoch);
        db.Placements.Add(placement);

        var s = await StatesAsync(db);

        Assert.All(preLessons, l => Assert.Equal("unlocked", s[l.Id]));
        Assert.Equal("unlocked", s[a1Lessons[0].Id]);
        Assert.Equal("locked", s[a1Lessons[1].Id]);
        Assert.Equal("locked", s[later.Id]);
    }

    [Fact]
    public async Task Other_learners_progress_is_ignored()
    {
        await using var db = TestDb.Create();
        var u = db.AddUnit(CefrLevel.PreA1, 0);
        var l1 = db.AddPublishedLesson(u, 0);
        var l2 = db.AddPublishedLesson(u, 1);
        db.Complete(Guid.NewGuid(), l1, 10);

        var s = await StatesAsync(db);
        Assert.Equal("unlocked", s[l1.Id]);
        Assert.Equal("locked", s[l2.Id]);
    }
}
