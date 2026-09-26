/**
 * SM-2 spaced repetition (FR-31). Shared by the client (offline review) and mirrored
 * on the server in the Progress service, which remains the source of truth.
 */

export interface ReviewCardState {
  /** Consecutive successful reviews. */
  repetitions: number;
  /** Current interval in days. */
  intervalDays: number;
  /** Ease factor, never below 1.3. */
  easeFactor: number;
  /** ISO date-time the card is next due. */
  dueAt: string;
}

/** Learner self-grade: 0 = blackout … 5 = perfect recall. Grades < 3 count as a lapse. */
export type ReviewGrade = 0 | 1 | 2 | 3 | 4 | 5;

export const MIN_EASE = 1.3;
export const INITIAL_EASE = 2.5;
const DAY_MS = 24 * 60 * 60 * 1000;

export function newCard(now: Date): ReviewCardState {
  return { repetitions: 0, intervalDays: 0, easeFactor: INITIAL_EASE, dueAt: now.toISOString() };
}

export function review(card: ReviewCardState, grade: ReviewGrade, now: Date): ReviewCardState {
  let { repetitions, intervalDays, easeFactor } = card;

  if (grade < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    intervalDays = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(intervalDays * easeFactor);
  }

  easeFactor = Math.max(MIN_EASE, easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));

  return {
    repetitions,
    intervalDays,
    easeFactor: Math.round(easeFactor * 1000) / 1000,
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
  };
}

export function isDue(card: ReviewCardState, now: Date): boolean {
  return new Date(card.dueAt).getTime() <= now.getTime();
}

/** Daily due count shown on the Review tab (FR-31). */
export function dueCount(cards: readonly ReviewCardState[], now: Date): number {
  return cards.filter((c) => isDue(c, now)).length;
}
