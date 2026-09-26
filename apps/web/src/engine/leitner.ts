/** Leitner spaced review (BRD §5.6). Mirrored in services/api/src/KidsLang.Domain/Leitner.cs — keep in sync. */
export const LEITNER_INTERVALS_DAYS = [1, 2, 4, 7, 14] as const;
export const MAX_BOX = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ItemMastery {
  box: number;
  correctCount: number;
  wrongCount: number;
  nextReviewAt: string;
}

export function nextBox(box: number | null, correct: boolean): number {
  if (!correct) return 1;
  return Math.min((box ?? 1) + 1, MAX_BOX);
}

export function nextReviewDate(box: number, now: Date): Date {
  const days = LEITNER_INTERVALS_DAYS[Math.max(1, Math.min(box, MAX_BOX)) - 1] ?? 1;
  return new Date(now.getTime() + days * DAY_MS);
}

export function review(entry: ItemMastery | undefined, correct: boolean, now: Date): ItemMastery {
  const box = nextBox(entry?.box ?? null, correct);
  return {
    box,
    correctCount: (entry?.correctCount ?? 0) + (correct ? 1 : 0),
    wrongCount: (entry?.wrongCount ?? 0) + (correct ? 0 : 1),
    nextReviewAt: nextReviewDate(box, now).toISOString(),
  };
}

export function dueItems(items: Record<string, ItemMastery>, now: Date): string[] {
  return Object.entries(items)
    .filter(([, m]) => new Date(m.nextReviewAt).getTime() <= now.getTime())
    .sort(([, a], [, b]) => a.box - b.box || a.nextReviewAt.localeCompare(b.nextReviewAt))
    .map(([id]) => id);
}

/** Weak items: wrong at least twice and wrong at least as often as right. Shown on the parent dashboard. */
export function isWeak(m: ItemMastery): boolean {
  return m.wrongCount >= 2 && m.wrongCount >= m.correctCount;
}
