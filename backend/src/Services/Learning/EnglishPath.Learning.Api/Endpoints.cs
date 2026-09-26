using System.Text.Json;
using EnglishPath.BuildingBlocks.Web;
using EnglishPath.Learning.Application.Authoring;
using EnglishPath.Learning.Application.Learner;
using MediatR;

namespace EnglishPath.Learning.Api;

public static class Policies
{
    /// <summary>Any content-team role: can read drafts and history.</summary>
    public const string ContentStaff = "content-staff";
    public const string Author = "content-author";
    public const string Reviewer = "content-reviewer";
}

public sealed record CompleteLessonRequest(Guid CompletionId, int LessonVersion, DateOnly LearnerLocalDay, IReadOnlyList<AttemptInput> Attempts);

public sealed record LessonDraftRequest(Guid UnitId, int Order, string Title, JsonElement Content);

public sealed record UpdateLessonDraftRequest(string Title, JsonElement Content);

public sealed record RollbackRequest(int Version);

public static class Endpoints
{
    public static void MapLearnerEndpoints(this IEndpointRouteBuilder app)
    {
        var learner = app.MapGroup("/api/v1/learning").RequireAuthorization().WithTags("Learner");

        learner.MapGet("/course-map", async (ISender sender, CancellationToken ct) =>
            (await sender.Send(new GetCourseMapQuery(), ct)).ToHttpResult());

        learner.MapGet("/lessons/{lessonId:guid}", async (Guid lessonId, ISender sender, CancellationToken ct) =>
            (await sender.Send(new GetLessonQuery(lessonId), ct)).ToHttpResult());

        learner.MapPost("/lessons/{lessonId:guid}/completions", async (Guid lessonId, CompleteLessonRequest body, ISender sender, CancellationToken ct) =>
            (await sender.Send(
                new CompleteLessonCommand(lessonId, body.CompletionId, body.LessonVersion, body.LearnerLocalDay, body.Attempts),
                ct)).ToHttpResult());
    }

    public static void MapAuthoringEndpoints(this IEndpointRouteBuilder app)
    {
        // FR-91: every CMS endpoint needs a content role; writes additionally need Author or Reviewer.
        var admin = app.MapGroup("/api/v1/learning/admin").RequireAuthorization(Policies.ContentStaff).WithTags("Authoring");

        admin.MapPost("/units", async (CreateUnitCommand command, ISender sender, CancellationToken ct) =>
            (await sender.Send(command, ct)).ToHttpResult())
            .RequireAuthorization(Policies.Author);

        admin.MapPost("/lessons", async (LessonDraftRequest body, ISender sender, CancellationToken ct) =>
            (await sender.Send(new CreateLessonCommand(body.UnitId, body.Order, body.Title, body.Content), ct)).ToHttpResult())
            .RequireAuthorization(Policies.Author);

        admin.MapGet("/lessons/{lessonId:guid}", async (Guid lessonId, ISender sender, CancellationToken ct) =>
            (await sender.Send(new GetLessonForAuthoringQuery(lessonId), ct)).ToHttpResult());

        admin.MapPut("/lessons/{lessonId:guid}", async (Guid lessonId, UpdateLessonDraftRequest body, ISender sender, CancellationToken ct) =>
            (await sender.Send(new UpdateLessonDraftCommand(lessonId, body.Title, body.Content), ct)).ToHttpResult())
            .RequireAuthorization(Policies.Author);

        admin.MapPost("/lessons/{lessonId:guid}/submit", async (Guid lessonId, ISender sender, CancellationToken ct) =>
            (await sender.Send(new SubmitLessonForReviewCommand(lessonId), ct)).ToHttpResult())
            .RequireAuthorization(Policies.Author);

        var review = admin.MapGroup("/lessons/{lessonId:guid}").RequireAuthorization(Policies.Reviewer).WithTags("Review");

        review.MapPost("/request-changes", async (Guid lessonId, ISender sender, CancellationToken ct) =>
            (await sender.Send(new RequestLessonChangesCommand(lessonId), ct)).ToHttpResult());

        review.MapPost("/publish", async (Guid lessonId, ISender sender, CancellationToken ct) =>
            (await sender.Send(new PublishLessonCommand(lessonId), ct)).ToHttpResult());

        review.MapPost("/rollback", async (Guid lessonId, RollbackRequest body, ISender sender, CancellationToken ct) =>
            (await sender.Send(new RollbackLessonCommand(lessonId, body.Version), ct)).ToHttpResult());
    }
}
