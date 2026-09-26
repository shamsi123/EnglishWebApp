namespace KidsLang.Domain;

/// <summary>Leitner spaced review (BRD §5.6). Mirrors apps/web/src/engine/leitner.ts — keep in sync.</summary>
public static class Leitner
{
    public static readonly int[] IntervalsDays = [1, 2, 4, 7, 14];
    public const int MaxBox = 5;

    public static int NextBox(int? box, bool correct) => correct ? Math.Min((box ?? 1) + 1, MaxBox) : 1;

    public static DateTime NextReviewDate(int box, DateTime nowUtc) =>
        nowUtc.AddDays(IntervalsDays[Math.Clamp(box, 1, MaxBox) - 1]);

    /// <summary>
    /// Applies one review. <paramref name="isNew"/> marks an item seen for the first time.
    /// An item moves up at most once per UTC day; a miss always resets it to box 1.
    /// </summary>
    public static void Review(ItemMastery entry, bool correct, DateTime nowUtc, bool isNew = false)
    {
        if (correct) entry.CorrectCount++;
        else entry.WrongCount++;

        var sameDay = entry.LastReviewedAtUtc?.Date == nowUtc.Date;
        entry.LastReviewedAtUtc = nowUtc;
        if (correct && !isNew && sameDay) return;

        entry.LeitnerBox = NextBox(isNew ? null : entry.LeitnerBox, correct);
        entry.NextReviewAtUtc = NextReviewDate(entry.LeitnerBox, nowUtc);
    }

    public static bool IsWeak(ItemMastery m) => m.WrongCount >= 2 && m.WrongCount >= m.CorrectCount;
}
