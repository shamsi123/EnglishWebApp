using EnglishPath.Learning.Domain.Completions;
using EnglishPath.Learning.Domain.Lessons;
using EnglishPath.Learning.Domain.Media;
using EnglishPath.Learning.Domain.Placement;
using EnglishPath.Learning.Domain.Units;
using EnglishPath.Learning.Domain.Vocabulary;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Learning.Application.Abstractions;

public interface ILearningDbContext
{
    DbSet<CourseUnit> Units { get; }

    DbSet<Lesson> Lessons { get; }

    DbSet<LessonCompletion> Completions { get; }

    DbSet<PlacementItem> PlacementItems { get; }

    DbSet<PlacementSession> PlacementSessions { get; }

    DbSet<LearnerPlacement> Placements { get; }

    DbSet<VocabularyItem> Vocabulary { get; }

    DbSet<MediaAsset> Media { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
