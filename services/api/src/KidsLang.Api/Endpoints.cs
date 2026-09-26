using System.Security.Claims;
using FluentValidation;
using KidsLang.Application;
using KidsLang.Application.Abstractions;
using KidsLang.Application.Contracts;
using KidsLang.Application.UseCases;

namespace KidsLang.Api;

/// <summary>REST v1 (BRD §13). Endpoints stay thin: validation here, logic in Application/Domain.</summary>
public static class Endpoints
{
    public static void MapKidsLangApi(this WebApplication app)
    {
        app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
        var v1 = app.MapGroup("/api/v1");

        var auth = v1.MapGroup("/auth").RequireRateLimiting("auth");
        auth.MapPost("/register", (RegisterRequest req, AuthService svc, CancellationToken ct) => svc.RegisterAsync(req, ct).ToHttp()).Validate<RegisterRequest>();
        auth.MapPost("/login", (LoginRequest req, AuthService svc, CancellationToken ct) => svc.LoginAsync(req, ct).ToHttp()).Validate<LoginRequest>();
        auth.MapPost("/refresh", (RefreshRequest req, AuthService svc, CancellationToken ct) => svc.RefreshAsync(req, ct).ToHttp()).Validate<RefreshRequest>();

        v1.MapGet("/courses", (IContentCatalog content) => content.Courses);

        var api = v1.MapGroup("").RequireAuthorization();
        api.MapGet("/children", async (ClaimsPrincipal user, ChildService svc, CancellationToken ct) => Results.Ok(await svc.ListAsync(user.ParentId(), ct)));
        api.MapPost("/children", (CreateChildRequest req, ClaimsPrincipal user, ChildService svc, CancellationToken ct) =>
            svc.CreateAsync(user.ParentId(), req, ct).ToHttp(201)).Validate<CreateChildRequest>();
        api.MapPatch("/children/{id:guid}", (Guid id, UpdateChildRequest req, ClaimsPrincipal user, ChildService svc, CancellationToken ct) =>
            svc.UpdateAsync(user.ParentId(), id, req, ct).ToHttp()).Validate<UpdateChildRequest>();
        api.MapDelete("/children/{id:guid}", async (Guid id, ClaimsPrincipal user, ChildService svc, CancellationToken ct) =>
            await svc.DeleteAsync(user.ParentId(), id, ct) ? Results.NoContent() : Results.NotFound());

        api.MapGet("/courses/{courseId}/journey", (string courseId, Guid childId, ClaimsPrincipal user, LearningService svc, CancellationToken ct) =>
            svc.JourneyAsync(user.ParentId(), courseId, childId, ct).ToHttp());
        api.MapPost("/attempts/batch", (AttemptBatchRequest req, ClaimsPrincipal user, LearningService svc, CancellationToken ct) =>
            svc.SubmitAttemptsAsync(user.ParentId(), req, ct).ToHttp()).Validate<AttemptBatchRequest>();
        api.MapPost("/quizzes/{lessonId}/submit", (string lessonId, QuizSubmitRequest req, ClaimsPrincipal user, LearningService svc, CancellationToken ct) =>
            svc.SubmitQuizAsync(user.ParentId(), lessonId, req, ct).ToHttp()).Validate<QuizSubmitRequest>();
        api.MapGet("/review/today", (Guid childId, ClaimsPrincipal user, LearningService svc, CancellationToken ct) =>
            svc.ReviewTodayAsync(user.ParentId(), childId, ct).ToHttp());
        api.MapGet("/parent/children/{id:guid}/report", (Guid id, string? courseId, ClaimsPrincipal user, LearningService svc, CancellationToken ct) =>
            svc.ReportAsync(user.ParentId(), id, courseId ?? "ar", ct).ToHttp());
        api.MapPost("/parent/children/{id:guid}/unlock/{lessonId}", (Guid id, string lessonId, ClaimsPrincipal user, LearningService svc, CancellationToken ct) =>
            svc.UnlockAsync(user.ParentId(), id, lessonId, ct).ToHttp());
    }

    private static Guid ParentId(this ClaimsPrincipal user) =>
        Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub")!);

    private static RouteHandlerBuilder Validate<T>(this RouteHandlerBuilder builder) => builder.AddEndpointFilter(async (ctx, next) =>
    {
        var validator = ctx.HttpContext.RequestServices.GetRequiredService<IValidator<T>>();
        var arg = ctx.Arguments.OfType<T>().FirstOrDefault();
        if (arg is null) return Results.BadRequest();
        var result = await validator.ValidateAsync(arg);
        return result.IsValid ? await next(ctx) : Results.ValidationProblem(result.ToDictionary());
    });

    private static async Task<IResult> ToHttp<T>(this Task<Result<T>> task, int successStatus = 200)
    {
        var result = await task;
        if (result.IsSuccess) return successStatus == 201 ? Results.Json(result.Value, statusCode: 201) : Results.Ok(result.Value);
        return result.Error!.Kind switch
        {
            ErrorKind.NotFound => Results.Problem(result.Error.Message, statusCode: 404),
            ErrorKind.Conflict => Results.Problem(result.Error.Message, statusCode: 409),
            ErrorKind.Unauthorized => Results.Problem(result.Error.Message, statusCode: 401),
            ErrorKind.Forbidden => Results.Problem(result.Error.Message, statusCode: 403),
            _ => Results.Problem(result.Error.Message, statusCode: 400),
        };
    }
}
