using System.Text.Json;
using EnglishPath.BuildingBlocks.Web;
using EnglishPath.Learning.Application.Authoring;
using EnglishPath.Learning.Application.Learner;
using EnglishPath.Learning.Application.Media;
using EnglishPath.Learning.Application.Placement;
using EnglishPath.Learning.Domain.Lessons;
using EnglishPath.Learning.Domain.Media;
using EnglishPath.Learning.Domain.Units;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace EnglishPath.Learning.Api;

public static class Policies
{
    /// <summary>Any content-team role: can read drafts and history.</summary>
    public const string ContentStaff = "content-staff";
    public const string Author = "content-author";
    public const string Reviewer = "content-reviewer";
}

public sealed record CompleteLessonRequest(Guid CompletionId, int LessonVersion, DateOnly LearnerLocalDay, IReadOnlyList<AttemptInput> Attempts);

public sealed record LessonDraftRequest(Guid UnitId, int Order, string Title, JsonElement Content, LessonKind Kind = LessonKind.Lesson);

public sealed record PlacementAnswerRequest(Guid ItemId, JsonElement Answer);

public sealed record PlacementItemRequest(CefrLevel Level, JsonElement Exercise);

public sealed record UpdateLessonDraftRequest(string Title, JsonElement Content);

public sealed record RollbackRequest(int Version);

public static class MediaLimits
{
    public const int MaxBytes = 10 * 1024 * 1024;
}

public static class Endpoints
{
    public static void MapLearnerEndpoints(this IEndpointRouteBuilder app)
    {
        var learner = app.MapGroup("/api/v1/learning").RequireAuthorization().WithTags("Learner");

        learner.MapGet("/course-map", async (ISender sender, CancellationToken ct) =>
            (await sender.Send(new GetCourseMapQuery(), ct)).ToHttpResult());

        learner.MapGet("/lessons/{lessonId:guid}", async (Guid lessonId, ISender sender, CancellationToken ct) =>
            (await sender.Send(new GetLessonQuery(lessonId), ct)).ToHttpResult());

        // Comma-separated ids, e.g. ?ids=v-hello,v-goodbye (FR-32).
        learner.MapGet("/vocabulary", async (string ids, ISender sender, CancellationToken ct) =>
            (await sender.Send(new GetVocabularyQuery(ids.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)), ct)).ToHttpResult());

        // Placement test (FR-10, FR-11).
        learner.MapPost("/placement", async (ISender sender, CancellationToken ct) =>
            (await sender.Send(new StartPlacementCommand(), ct)).ToHttpResult());

        learner.MapPost("/placement/{sessionId:guid}/answers", async (Guid sessionId, PlacementAnswerRequest body, ISender sender, CancellationToken ct) =>
            (await sender.Send(new AnswerPlacementCommand(sessionId, body.ItemId, body.Answer), ct)).ToHttpResult());

        learner.MapPost("/placement/skip", async (ISender sender, CancellationToken ct) =>
            (await sender.Send(new SkipPlacementCommand(), ct)).ToHttpResult());

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
            (await sender.Send(new CreateLessonCommand(body.UnitId, body.Order, body.Title, body.Content, body.Kind), ct)).ToHttpResult())
            .RequireAuthorization(Policies.Author);

        admin.MapGet("/lessons/{lessonId:guid}", async (Guid lessonId, ISender sender, CancellationToken ct) =>
            (await sender.Send(new GetLessonForAuthoringQuery(lessonId), ct)).ToHttpResult());

        admin.MapPut("/lessons/{lessonId:guid}", async (Guid lessonId, UpdateLessonDraftRequest body, ISender sender, CancellationToken ct) =>
            (await sender.Send(new UpdateLessonDraftCommand(lessonId, body.Title, body.Content), ct)).ToHttpResult())
            .RequireAuthorization(Policies.Author);

        admin.MapPost("/lessons/{lessonId:guid}/submit", async (Guid lessonId, ISender sender, CancellationToken ct) =>
            (await sender.Send(new SubmitLessonForReviewCommand(lessonId), ct)).ToHttpResult())
            .RequireAuthorization(Policies.Author);

        admin.MapGet("/outline", async (ISender sender, CancellationToken ct) =>
            (await sender.Send(new GetCourseOutlineQuery(), ct)).ToHttpResult());

        admin.MapGet("/audit", async (string? target, int? limit, ISender sender, CancellationToken ct) =>
            (await sender.Send(new GetAuditLogQuery(target, limit ?? 50), ct)).ToHttpResult());

        admin.MapGet("/export", async (ISender sender, CancellationToken ct) =>
            (await sender.Send(new ExportContentQuery(), ct)).ToHttpResult());

        admin.MapPost("/import", async (ContentPackageDto package, ISender sender, CancellationToken ct) =>
            (await sender.Send(new ImportContentCommand(package), ct)).ToHttpResult())
            .RequireAuthorization(Policies.Author);

        // FR-81: multipart upload of one image or audio file (max 10 MB). Token-authenticated, so no antiforgery.
        admin.MapPost("/media", async (IFormFile file, ISender sender, CancellationToken ct) =>
            {
                if (file.Length > MediaLimits.MaxBytes)
                {
                    return Results.Problem(title: "Files must be 10 MB or smaller.", statusCode: StatusCodes.Status413PayloadTooLarge);
                }

                using var buffer = new MemoryStream((int)file.Length);
                await file.CopyToAsync(buffer, ct);
                return (await sender.Send(new UploadMediaCommand(Path.GetFileName(file.FileName), buffer.ToArray()), ct)).ToHttpResult();
            })
            .RequireAuthorization(Policies.Author)
            .DisableAntiforgery()
            .WithMetadata(new RequestSizeLimitAttribute(MediaLimits.MaxBytes + 64 * 1024));

        admin.MapGet("/media", async (MediaKind? kind, ISender sender, CancellationToken ct) =>
            (await sender.Send(new ListMediaQuery(kind), ct)).ToHttpResult());

        admin.MapGet("/placement-items", async (CefrLevel? level, ISender sender, CancellationToken ct) =>
            (await sender.Send(new ListPlacementItemsQuery(level), ct)).ToHttpResult());

        admin.MapPost("/placement-items", async (PlacementItemRequest body, ISender sender, CancellationToken ct) =>
            (await sender.Send(new CreatePlacementItemCommand(body.Level, body.Exercise), ct)).ToHttpResult())
            .RequireAuthorization(Policies.Author);

        admin.MapDelete("/placement-items/{itemId:guid}", async (Guid itemId, ISender sender, CancellationToken ct) =>
            (await sender.Send(new RetirePlacementItemCommand(itemId), ct)).ToHttpResult())
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
