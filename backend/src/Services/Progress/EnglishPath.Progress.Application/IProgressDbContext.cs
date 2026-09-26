using EnglishPath.Progress.Domain.Learners;
using EnglishPath.Progress.Domain.Reviews;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Progress.Application;

public interface IProgressDbContext
{
    DbSet<LearnerProgress> Learners { get; }

    DbSet<ReviewCard> ReviewCards { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
