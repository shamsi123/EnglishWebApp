using KidsLang.Application.Abstractions;
using KidsLang.Application.Contracts;
using KidsLang.Domain;
using Microsoft.EntityFrameworkCore;

namespace KidsLang.Application.UseCases;

public sealed class ChildService(IKidsLangDb db)
{
    public const int MaxChildren = 4;

    public async Task<IReadOnlyList<ChildDto>> ListAsync(Guid parentId, CancellationToken ct) =>
        (await db.ChildProfiles.Where(c => c.ParentId == parentId).OrderBy(c => c.CreatedAtUtc).ToListAsync(ct)).Select(ToDto).ToList();

    public async Task<Result<ChildDto>> CreateAsync(Guid parentId, CreateChildRequest req, CancellationToken ct)
    {
        // Idempotent replay: the offline-created profile already exists — hand back the same row, no duplicate,
        // no count against the 4-child limit.
        if (req.Id is { } id)
        {
            var existing = await db.ChildProfiles.FirstOrDefaultAsync(c => c.Id == id, ct);
            if (existing is not null)
                return existing.ParentId == parentId
                    ? Result<ChildDto>.Ok(ToDto(existing))
                    : Result<ChildDto>.Fail(ErrorKind.Conflict, "This profile id belongs to a different account.");
        }

        if (await db.ChildProfiles.CountAsync(c => c.ParentId == parentId, ct) >= MaxChildren)
            return Result<ChildDto>.Fail(ErrorKind.Conflict, $"A parent can have up to {MaxChildren} child profiles.");
        var child = new ChildProfile
        {
            Id = req.Id ?? Guid.NewGuid(),
            ParentId = parentId,
            Nickname = req.Nickname.Trim(),
            AgeBand = req.AgeBand,
            Avatar = new AvatarConfig { Animal = req.Avatar.Animal, Color = req.Avatar.Color, Item = req.Avatar.Item },
            PicturePinHash = req.PicturePinHash,
        };
        db.ChildProfiles.Add(child);
        await db.SaveChangesAsync(ct);
        return Result<ChildDto>.Ok(ToDto(child));
    }

    public async Task<Result<ChildDto>> UpdateAsync(Guid parentId, Guid childId, UpdateChildRequest req, CancellationToken ct)
    {
        var child = await db.ChildProfiles.FirstOrDefaultAsync(c => c.Id == childId && c.ParentId == parentId, ct);
        if (child is null) return Result<ChildDto>.Fail(ErrorKind.NotFound, "Child not found.");
        if (req.Nickname is not null) child.Nickname = req.Nickname.Trim();
        if (req.AgeBand is not null) child.AgeBand = req.AgeBand;
        if (req.Avatar is not null) child.Avatar = new AvatarConfig { Animal = req.Avatar.Animal, Color = req.Avatar.Color, Item = req.Avatar.Item };
        if (req.DailyLimitMinutes is not null) child.DailyLimitMinutes = req.DailyLimitMinutes.Value;
        await db.SaveChangesAsync(ct);
        return Result<ChildDto>.Ok(ToDto(child));
    }

    /// <summary>FR-05: removes the profile and every row that belongs to it.</summary>
    public async Task<bool> DeleteAsync(Guid parentId, Guid childId, CancellationToken ct)
    {
        var child = await db.ChildProfiles.FirstOrDefaultAsync(c => c.Id == childId && c.ParentId == parentId, ct);
        if (child is null) return false;
        db.ActivityAttempts.RemoveRange(db.ActivityAttempts.Where(x => x.ChildId == childId));
        db.QuizAttempts.RemoveRange(db.QuizAttempts.Where(x => x.ChildId == childId));
        db.LessonProgress.RemoveRange(db.LessonProgress.Where(x => x.ChildId == childId));
        db.ItemMastery.RemoveRange(db.ItemMastery.Where(x => x.ChildId == childId));
        db.Rewards.RemoveRange(db.Rewards.Where(x => x.ChildId == childId));
        db.ChildProfiles.Remove(child);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public Task<bool> OwnsAsync(Guid parentId, Guid childId, CancellationToken ct) =>
        db.ChildProfiles.AnyAsync(c => c.Id == childId && c.ParentId == parentId, ct);

    private static ChildDto ToDto(ChildProfile c) =>
        new(c.Id, c.Nickname, c.AgeBand, new AvatarDto(c.Avatar.Animal, c.Avatar.Color, c.Avatar.Item), c.PicturePinHash is not null, c.DailyLimitMinutes);
}
