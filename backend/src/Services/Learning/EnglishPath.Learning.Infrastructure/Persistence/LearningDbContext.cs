using EnglishPath.Learning.Application.Abstractions;
using EnglishPath.Learning.Domain.Completions;
using EnglishPath.Learning.Domain.Lessons;
using EnglishPath.Learning.Domain.Units;
using MassTransit;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Learning.Infrastructure.Persistence;

public sealed class LearningDbContext(DbContextOptions<LearningDbContext> options) : DbContext(options), ILearningDbContext
{
    public const string Schema = "learning";

    public DbSet<CourseUnit> Units => Set<CourseUnit>();

    public DbSet<Lesson> Lessons => Set<Lesson>();

    public DbSet<LessonCompletion> Completions => Set<LessonCompletion>();

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

        // MassTransit transactional outbox/inbox tables.
        modelBuilder.AddInboxStateEntity();
        modelBuilder.AddOutboxMessageEntity();
        modelBuilder.AddOutboxStateEntity();
    }
}
