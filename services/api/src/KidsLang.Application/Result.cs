namespace KidsLang.Application;

public enum ErrorKind { NotFound, Conflict, Unauthorized, Forbidden, Invalid }

public sealed record Error(ErrorKind Kind, string Message);

public sealed class Result<T>
{
    public T? Value { get; }
    public Error? Error { get; }
    public bool IsSuccess => Error is null;
    private Result(T? value, Error? error) { Value = value; Error = error; }
    public static Result<T> Ok(T value) => new(value, null);
    public static Result<T> Fail(ErrorKind kind, string message) => new(default, new Error(kind, message));
    public static implicit operator Result<T>(Error error) => new(default, error);
}
