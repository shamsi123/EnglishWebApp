using EnglishPath.BuildingBlocks.Domain;
using MediatR;

namespace EnglishPath.BuildingBlocks.Application;

/// <summary>Marks a command as an administrative action recorded in the audit log (FR-92).</summary>
public interface IAuditedCommand
{
    /// <summary>Stable action name, e.g. <c>lesson.published</c>.</summary>
    string AuditAction { get; }

    /// <summary>The affected record, or null to use the id the command returns (for creates).</summary>
    string? AuditTarget { get; }
}

public interface IAuditLog
{
    Task RecordAsync(string action, string? target, CancellationToken cancellationToken);

    Task<IReadOnlyList<AuditEntry>> RecentAsync(int limit, string? target, CancellationToken cancellationToken);
}

/// <summary>Records successful <see cref="IAuditedCommand"/>s; failed commands changed nothing, so they aren't logged.</summary>
public sealed class AuditBehavior<TRequest, TResponse>(IAuditLog auditLog) : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
    where TResponse : Result
{
    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        var response = await next();
        if (request is IAuditedCommand audited && response.IsSuccess)
        {
            var target = audited.AuditTarget ?? (response is Result<Guid> created ? created.Value.ToString() : null);
            await auditLog.RecordAsync(audited.AuditAction, target, cancellationToken);
        }

        return response;
    }
}
