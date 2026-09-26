using EnglishPath.Learning.Application.Abstractions;
using EnglishPath.Learning.Domain.Completions;
using EnglishPath.Learning.Domain.Lessons;
using EnglishPath.Learning.Domain.Media;
using EnglishPath.Learning.Domain.Placement;
using EnglishPath.Learning.Domain.Units;
using EnglishPath.Learning.Domain.Vocabulary;
using EnglishPath.BuildingBlocks.Persistence;
using MassTransit;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Learning.Infrastructure.Persistence;

public sealed class LearningDbContext(DbContextOptions<LearningDbContext> options) : DbContext(options), ILearningDbContext
{
    public const string Schema = "learning";

    public DbSet<CourseUnit> Units => Set<CourseUnit>();

    public DbSet<Lesson> Lessons => Set<Lesson>();

    public DbSet<LessonCompletion> Completions => Set<LessonCompletion>();

    public DbSet<PlacementItem> PlacementItems => Set<PlacementItem>();

    public DbSet<PlacementSession> PlacementSessions => Set<PlacementSession>();

    public DbSet<LearnerPlacement> Placements => Set<LearnerPlacement>();

    public DbSet<VocabularyItem> Vocabulary => Set<VocabularyItem>();

    public DbSet<MediaAsset> Media => Set<MediaAsset>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.Entity<CourseUnit>(b =>
        {
            b.ToTable("Units");
            b.Ignore(u => u.DomainEvents);
            b.Property(u => u.Title).HasMaxLength(200);
            b.Property(u => u.Level).HasConversion<string>().HasMaxLength(8);
            b.HasIndex(u => new { u.Level, u.Order });
        });

        modelBuilder.Entity<Lesson>(b =>
        {
            b.ToTable("Lessons");
            b.Ignore(l => l.DomainEvents);
            b.Ignore(l => l.Live);
            b.Property(l => l.Title).HasMaxLength(200);
            b.Property(l => l.Status).HasConversion<string>().HasMaxLength(16);
            b.Property(l => l.Kind).HasConversion<string>().HasMaxLength(16);
            b.Property(l => l.DraftContent);
            b.HasOne<CourseUnit>().WithMany().HasForeignKey(l => l.UnitId).OnDelete(DeleteBehavior.Restrict);
            b.HasIndex(l => new { l.UnitId, l.Order });
            b.HasMany(l => l.Versions).WithOne().HasForeignKey(v => v.LessonId).OnDelete(DeleteBehavior.Cascade);
            b.Navigation(l => l.Versions).UsePropertyAccessMode(PropertyAccessMode.Field);
            // Optimistic concurrency so two reviewers can't publish the same draft twice.
            b.Property<byte[]>("RowVersion").IsRowVersion();
        });

        modelBuilder.Entity<LessonVersion>(b =>
        {
            b.ToTable("LessonVersions");
            b.HasKey(v => new { v.LessonId, v.Version });
            b.Property(v => v.Title).HasMaxLength(200);
        });

        modelBuilder.Entity<LessonCompletion>(b =>
        {
            b.ToTable("LessonCompletions");
            b.Ignore(c => c.DomainEvents);
            b.Property(c => c.Id).ValueGeneratedNever();
            b.HasIndex(c => new { c.UserId, c.LessonId });
        });

        modelBuilder.Entity<PlacementItem>(b =>
        {
            b.ToTable("PlacementItems");
            b.Property(i => i.Level).HasConversion<string>().HasMaxLength(8);
            b.Property(i => i.Skill).HasMaxLength(16);
            b.Ignore(i => i.Exercise);
            b.HasIndex(i => new { i.Level, i.IsActive });
        });

        modelBuilder.Entity<PlacementSession>(b =>
        {
            b.ToTable("PlacementSessions");
            b.Ignore(s => s.DomainEvents);
            b.Ignore(s => s.AskedItemIds);
            b.Ignore(s => s.MaxQuestions);
            b.Property(s => s.Status).HasConversion<string>().HasMaxLength(16);
            foreach (var level in new[] { nameof(PlacementSession.MinLevel), nameof(PlacementSession.MaxLevel), nameof(PlacementSession.CurrentLevel), nameof(PlacementSession.StartLevel), nameof(PlacementSession.HighestPassed) })
            {
                b.Property(level).HasConversion<string>().HasMaxLength(8);
            }

            b.HasIndex(s => new { s.UserId, s.Status });
            b.OwnsMany(s => s.Responses, r =>
            {
                r.ToTable("PlacementResponses");
                r.WithOwner().HasForeignKey("SessionId");
                r.Property<int>("Id");
                r.HasKey("Id");
                r.Property(x => x.Level).HasConversion<string>().HasMaxLength(8);
            });
            b.Navigation(s => s.Responses).UsePropertyAccessMode(PropertyAccessMode.Field);
            b.Property<byte[]>("RowVersion").IsRowVersion();
        });

        modelBuilder.Entity<LearnerPlacement>(b =>
        {
            b.ToTable("LearnerPlacements");
            b.Property(p => p.Id).ValueGeneratedNever();
            b.Property(p => p.StartLevel).HasConversion<string>().HasMaxLength(8);
        });

        modelBuilder.Entity<VocabularyItem>(b =>
        {
            b.ToTable("Vocabulary");
            b.Property(v => v.Id).HasMaxLength(64);
            b.Property(v => v.Word).HasMaxLength(100);
        });

        modelBuilder.Entity<MediaAsset>(b =>
        {
            b.ToTable("MediaAssets");
            b.Property(m => m.Kind).HasConversion<string>().HasMaxLength(8);
            b.Property(m => m.ContentType).HasMaxLength(64);
            b.Property(m => m.Path).HasMaxLength(200);
            b.Property(m => m.Url).HasMaxLength(500);
            b.Property(m => m.OriginalFileName).HasMaxLength(200);
            b.HasIndex(m => m.Path).IsUnique();
            b.HasIndex(m => m.UploadedAt);
        });

        modelBuilder.AddAuditEntries();

        // MassTransit transactional outbox/inbox tables.
        modelBuilder.AddInboxStateEntity();
        modelBuilder.AddOutboxMessageEntity();
        modelBuilder.AddOutboxStateEntity();
    }
}
