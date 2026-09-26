using EnglishPath.BuildingBlocks.Domain;
using FluentValidation;
using MediatR;

namespace EnglishPath.BuildingBlocks.Application;

/// <summary>Runs FluentValidation validators before a handler and short-circuits with a validation error.</summary>
public sealed class ValidationBehavior<TRequest, TResponse>(IEnumerable<IValidator<TRequest>> validators)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
    where TResponse : Result
{
    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        if (!validators.Any())
        {
            return await next();
        }

        var context = new ValidationContext<TRequest>(request);
        var results = await Task.WhenAll(validators.Select(v => v.ValidateAsync(context, cancellationToken)));
        var failure = results.SelectMany(r => r.Errors).FirstOrDefault();
        if (failure is null)
        {
            return await next();
        }

        var error = new Error($"validation.{failure.PropertyName}", failure.ErrorMessage);
        return (TResponse)CreateFailure(typeof(TResponse), error);
    }

    private static object CreateFailure(Type resultType, Error error)
    {
        if (resultType == typeof(Result))
        {
            return Result.Failure(error);
        }

        // Result<T> has an implicit conversion from Error.
        var op = resultType.GetMethod("op_Implicit", [typeof(Error)])
            ?? throw new InvalidOperationException($"{resultType} cannot be created from an Error");
        return op.Invoke(null, [error])!;
    }
}
