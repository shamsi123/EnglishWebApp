using EnglishPath.BuildingBlocks.Web;
using EnglishPath.Progress.Application;
using MediatR;

namespace EnglishPath.Progress.Api;

public sealed record ReviewRequest(int Grade);

public sealed record DailyGoalRequest(int Minutes);

public static class Endpoints
{
    public static void MapProgressEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/progress").RequireAuthorization().WithTags("Progress");

        group.MapGet("/dashboard", async (DateOnly today, ISender sender, CancellationToken ct) =>
            (await sender.Send(new GetDashboardQuery(today), ct)).ToHttpResult());

        group.MapPut("/daily-goal", async (DailyGoalRequest body, ISender sender, CancellationToken ct) =>
            (await sender.Send(new SetDailyGoalCommand(body.Minutes), ct)).ToHttpResult());

        group.MapGet("/reviews/due", async (int? limit, ISender sender, CancellationToken ct) =>
            (await sender.Send(new GetDueReviewsQuery(limit ?? 20), ct)).ToHttpResult());

        group.MapPost("/reviews/{vocabularyId}", async (string vocabularyId, ReviewRequest body, ISender sender, CancellationToken ct) =>
            (await sender.Send(new ReviewWordCommand(vocabularyId, body.Grade), ct)).ToHttpResult());
    }
}
