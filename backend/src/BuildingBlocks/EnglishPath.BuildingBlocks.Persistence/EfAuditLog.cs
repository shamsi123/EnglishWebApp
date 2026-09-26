using EnglishPath.BuildingBlocks.Application;
using EnglishPath.BuildingBlocks.Domain;
using Microsoft.EntityFrameworkCore;

namespace EnglishPath.BuildingBlocks.Persistence;

/// <summary>Stores audit entries in the service's own database (table <c>AuditEntries</c>).</summary>
public sealed class EfAuditLog<TDbContext>(TDbContext db, ICurrentUser user, IClock clock) : IAuditLog
    where TDbContext : DbContext
{
    public async Task RecordAsync(string action, string? target, CancellationToken cancellationToken)
    {
        db.Set<AuditEntry>().Add(AuditEntry.Create(clock.UtcNow, user.UserId, action, target));
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AuditEntry>> RecentAsync(int limit, string? target, CancellationToken cancellationToken) =>
        await db.Set<AuditEntry>().AsNoTracking()
            .Where(e => target == null || e.Target == target)
            .OrderByDescending(e => e.Id)
            .Take(limit)
            .ToListAsync(cancellationToken);
}

public static class AuditModelBuilderExtensions
{
    public static ModelBuilder AddAuditEntries(this ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AuditEntry>(b =>
        {
            b.ToTable("AuditEntries");
            b.Property(e => e.Action).HasMaxLength(64);
            b.Property(e => e.Target).HasMaxLength(128);
            b.HasIndex(e => e.Target);
            b.HasIndex(e => e.At);
        });
        return modelBuilder;
    }
}
