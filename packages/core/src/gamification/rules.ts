/**
 * XP, daily goal and streak rules (FR-50). Streaks are computed on the learner's local
 * calendar day, passed in as `YYYY-MM-DD` so the rules are timezone-agnostic.
 */

export const XP_PER_CORRECT_ANSWER = 1;
export const XP_LESSON_COMPLETION = 10;
export const XP_PERFECT_LESSON_BONUS = 5;

/** Daily minute targets offered in onboarding (FR-02) mapped to daily XP goals. */
export const DAILY_GOAL_XP: Record<5 | 10 | 15 | 20, number> = { 5: 10, 10: 20, 15: 30, 20: 40 };

export function lessonXp(correctAnswers: number, totalExercises: number): number {
  if (totalExercises <= 0 || correctAnswers < 0 || correctAnswers > totalExercises) {
    throw new RangeError("Invalid lesson result");
  }
  const perfect = correctAnswers === totalExercises ? XP_PERFECT_LESSON_BONUS : 0;
  return correctAnswers * XP_PER_CORRECT_ANSWER + XP_LESSON_COMPLETION + perfect;
}

export interface StreakState {
  current: number;
  longest: number;
  /** Local day (YYYY-MM-DD) of the last day the daily goal was met. */
  lastActiveDay: string | null;
  freezesAvailable: number;
}

export type StreakOutcome = "unchanged" | "extended" | "frozen" | "reset";

export interface StreakUpdate {
  state: StreakState;
  outcome: StreakOutcome;
}

function daysBetween(fromDay: string, toDay: string): number {
  const from = Date.parse(`${fromDay}T00:00:00Z`);
  const to = Date.parse(`${toDay}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) throw new RangeError("Days must be YYYY-MM-DD");
  return Math.round((to - from) / 86_400_000);
}

/**
 * Records that the learner met their daily goal on `today`. A single missed day is
 * covered by a streak freeze if one is available; otherwise the streak restarts at 1.
 */
export function recordActivity(state: StreakState, today: string): StreakUpdate {
  if (state.lastActiveDay === null) {
    return { state: { ...state, current: 1, longest: Math.max(state.longest, 1), lastActiveDay: today }, outcome: "extended" };
  }

  const gap = daysBetween(state.lastActiveDay, today);
  if (gap <= 0) return { state, outcome: "unchanged" };

  const missedDays = gap - 1;
  if (missedDays === 0 || missedDays <= state.freezesAvailable) {
    const current = state.current + 1;
    return {
      state: {
        current,
        longest: Math.max(state.longest, current),
        lastActiveDay: today,
        freezesAvailable: state.freezesAvailable - missedDays,
      },
      outcome: missedDays === 0 ? "extended" : "frozen",
    };
  }

  return { state: { ...state, current: 1, lastActiveDay: today }, outcome: "reset" };
}

/** FR-12: checkpoint quizzes unlock the next unit at 70%. */
export const CHECKPOINT_PASS_MARK = 0.7;

export function passesCheckpoint(correct: number, total: number): boolean {
  return total > 0 && correct / total >= CHECKPOINT_PASS_MARK;
}
