using EnglishPath.BuildingBlocks.Domain;
using Microsoft.AspNetCore.Http;

namespace EnglishPath.BuildingBlocks.Web;

public static class ResultHttpExtensions
{
    public static IResult ToHttpResult<T>(this Result<T> result) =>
        result.IsSuccess ? TypedResults.Ok(result.Value) : result.Error!.ToProblem();

    public static IResult ToHttpResult(this Result result) =>
        result.IsSuccess ? TypedResults.NoContent() : result.Error!.ToProblem();

    public static IResult ToProblem(this Error error)
    {
        var status = error.Type switch
        {
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            ErrorType.Forbidden => StatusCodes.Status403Forbidden,
            _ => StatusCodes.Status400BadRequest,
        };
        return TypedResults.Problem(
            title: error.Message,
            statusCode: status,
            type: $"https://englishpath.app/errors/{error.Code}",
            extensions: new Dictionary<string, object?> { ["code"] = error.Code });
    }
}
