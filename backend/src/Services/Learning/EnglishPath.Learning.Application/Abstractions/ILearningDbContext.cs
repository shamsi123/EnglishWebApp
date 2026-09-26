using EnglishPath.Learning.Domain.Completions;
using EnglishPath.Learning.Domain.Lessons;
using EnglishPath.Learning.Domain.Units;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Learning.Application.Abstractions;

public interface ILearningDbContext
{
    DbSet<CourseUnit> Units { get; }

    DbSet<Lesson> Lessons { get; }

    DbSet<LessonCompletion> Completions { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
