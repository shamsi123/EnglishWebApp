using EnglishPath.Learning.Domain.Lessons;

namespace EnglishPath.Learning.UnitTests;

public class LessonWorkflowTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 26, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid Reviewer = Guid.NewGuid();

    private static Lesson NewLesson(string? content = null) =>
        Lesson.Create(Guid.NewGuid(), 0, "Hello!", content ?? SampleContent.Valid().ToJsonString(), Now);

    [Fact]
    public void Draft_goes_through_review_to_published_version_1()
    {
        var lesson = NewLesson();

        Assert.True(lesson.SubmitForReview(Now).IsSuccess);
        Assert.Equal(DraftStatus.InReview, lesson.Status);
        Assert.True(lesson.Publish(Reviewer, Now).IsSuccess);

        Assert.Equal(DraftStatus.Published, lesson.Status);
        Assert.Equal(1, lesson.PublishedVersion);
        Assert.Equal(Reviewer, lesson.Live!.PublishedBy);
        var evt = Assert.Single(lesson.DomainEvents.OfType<LessonPublishedDomainEvent>());
        Assert.Equal(1, evt.Version);
    }

    [Fact]
    public void Cannot_publish_without_review()
    {
        var result = NewLesson().Publish(Reviewer, Now);
        Assert.Equal("lesson.invalid_transition", result.Error!.Code);
    }

    [Fact]
    public void Cannot_submit_content_that_breaks_design_rules()
    {
        var content = SampleContent.Valid();
        content["exercises"]!.AsArray().RemoveAt(0);

        var result = NewLesson(content.ToJsonString()).SubmitForReview(Now);

        Assert.Equal("lesson.invalid_content", result.Error!.Code);
        Assert.Contains("8–15 exercises", result.Error.Message);
    }

    [Fact]
    public void Cannot_edit_while_in_review_but_can_after_changes_requested()
    {
        var lesson = NewLesson();
        lesson.SubmitForReview(Now);

        Assert.Equal("lesson.in_review", lesson.UpdateDraft("New", "{}", Now).Error!.Code);
        Assert.True(lesson.RequestChanges(Now).IsSuccess);
        Assert.True(lesson.UpdateDraft("New", SampleContent.Valid().ToJsonString(), Now).IsSuccess);
        Assert.Equal(DraftStatus.Draft, lesson.Status);
    }

    [Fact]
    public void Editing_a_published_lesson_keeps_the_live_version_until_republished()
    {
        var lesson = NewLesson();
        lesson.SubmitForReview(Now);
        lesson.Publish(Reviewer, Now);

        lesson.UpdateDraft("Hello again!", SampleContent.Valid().ToJsonString(), Now);

        Assert.Equal(DraftStatus.Draft, lesson.Status);
        Assert.Equal(1, lesson.PublishedVersion);
        Assert.Equal("Hello!", lesson.Live!.Title);
    }

    [Fact]
    public void Rollback_republishes_old_content_as_a_new_version()
    {
        var v1Content = SampleContent.Valid().ToJsonString();
        var lesson = NewLesson(v1Content);
        lesson.SubmitForReview(Now);
        lesson.Publish(Reviewer, Now);

        var v2 = SampleContent.Valid();
        v2["objective"] = "Changed";
        lesson.UpdateDraft("Hello!", v2.ToJsonString(), Now);
        lesson.SubmitForReview(Now);
        lesson.Publish(Reviewer, Now);

        Assert.True(lesson.Rollback(1, Reviewer, Now).IsSuccess);

        Assert.Equal(3, lesson.PublishedVersion);
        Assert.Equal(v1Content, lesson.Live!.Content);
        Assert.Equal(1, lesson.Live.RolledBackFrom);
        Assert.Equal(3, lesson.Versions.Count);
    }

    [Fact]
    public void Rollback_rejects_unknown_and_live_versions()
    {
        var lesson = NewLesson();
        lesson.SubmitForReview(Now);
        lesson.Publish(Reviewer, Now);

        Assert.Equal("lesson.version_not_found", lesson.Rollback(9, Reviewer, Now).Error!.Code);
        Assert.Equal("lesson.already_live", lesson.Rollback(1, Reviewer, Now).Error!.Code);
    }
}
