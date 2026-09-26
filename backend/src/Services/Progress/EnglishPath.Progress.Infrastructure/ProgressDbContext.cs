using EnglishPath.Progress.Application;
using EnglishPath.Progress.Domain.Learners;
using EnglishPath.Progress.Domain.Reviews;
using MassTransit;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.Progress.Infrastructure;

public sealed class ProgressDbContext(DbContextOptions<ProgressDbContext> options) : DbContext(options), IProgressDbContext
{
    public const string Schema = "progress";

    public DbSet<LearnerProgress> Learners => Set<LearnerProgress>();

    public DbSet<ReviewCard> ReviewCards => Set<ReviewCard>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.Entity<LearnerProgress>(b =>
        {
            b.ToTable("Learners");
            b.Property(l => l.Id).ValueGeneratedNever();
            b.Ignore(l => l.DomainEvents);
            b.ComplexProperty(l => l.Streak);
            b.HasMany(l => l.Days).WithOne().HasForeignKey("LearnerId").OnDelete(DeleteBehavior.Cascade);
            b.Navigation(l => l.Days).UsePropertyAccessMode(PropertyAccessMode.Field);
            b.HasMany(l => l.SkillPractice).WithOne().HasForeignKey("LearnerId").OnDelete(DeleteBehavior.Cascade);
            b.Navigation(l => l.SkillPractice).UsePropertyAccessMode(PropertyAccessMode.Field).HasField("_skills");
            // Concurrent LessonCompleted messages for one learner must not lose XP.
            b.Property<byte[]>("RowVersion").IsRowVersion();
        });

        modelBuilder.Entity<DailyActivity>(b =>
        {
            b.ToTable("DailyActivity");
            b.HasKey("LearnerId", nameof(DailyActivity.Day));
        });

        modelBuilder.Entity<SkillPractice>(b =>
        {
            b.ToTable("SkillPractice");
            b.Property(s => s.Skill).HasMaxLength(16);
            b.HasKey("LearnerId", nameof(SkillPractice.Skill));
        });

        modelBuilder.Entity<ReviewCard>(b =>
        {
            b.ToTable("ReviewCards");
            b.Property(c => c.VocabularyId).HasMaxLength(64);
            b.HasIndex(c => new { c.UserId, c.VocabularyId }).IsUnique();
            b.HasIndex(c => new { c.UserId, c.DueAt });
        });

        modelBuilder.AddInboxStateEntity();
        modelBuilder.AddOutboxMessageEntity();
        modelBuilder.AddOutboxStateEntity();
    }
}
