using EnglishPath.BuildingBlocks.Domain;
using EnglishPath.Learning.Application.Abstractions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Learning.Application.Learner;

/// <summary>Right to erasure (NFR-08): removes a deleted user's lesson history and placement results.</summary>
public sealed record EraseLearnerDataCommand(Guid UserId) : IRequest<Result>;

internal sealed class EraseLearnerDataHandler(ILearningDbContext db) : IRequestHandler<EraseLearnerDataCommand, Result>
{
    public async Task<Result> Handle(EraseLearnerDataCommand request, CancellationToken cancellationToken)
    {
        db.Completions.RemoveRange(await db.Completions.Where(c => c.UserId == request.UserId).ToListAsync(cancellationToken));
        db.PlacementSessions.RemoveRange(await db.PlacementSessions.Where(s => s.UserId == request.UserId).ToListAsync(cancellationToken));
        db.Placements.RemoveRange(await db.Placements.Where(p => p.Id == request.UserId).ToListAsync(cancellationToken));
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
