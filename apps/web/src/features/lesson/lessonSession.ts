import { checkAnswer, lessonXp, type Answer, type CheckResult, type Lesson } from "@englishpath/core";

/**
 * Lesson player state machine (FR-21, FR-23, FR-24): intro → exercises → mistake
 * review (wrong answers repeated at the end) → summary. Kept pure so it is easy to test
 * and to persist for resume (FR-27).
 */

export type Phase = "intro" | "exercise" | "feedback" | "summary";

export interface LessonSession {
  phase: Phase;
  /** Index of the exercise on screen (answering or showing feedback). */
  current: number | null;
  /** Exercise indices still to come; wrong answers are re-queued once. */
  queue: number[];
  /** Number of answers submitted so far; also a stable key per exercise screen. */
  turn: number;
  /** Exercises answered correctly on the first try. */
  firstTryCorrect: number;
  /** Exercise indices re-queued for mistake review. */
  requeued: number[];
  lastResult: CheckResult | null;
}

export type SessionAction =
  | { type: "start" }
  | { type: "submit"; answer: Answer }
  | { type: "continue" };

export function initSession(lesson: Lesson): LessonSession {
  return {
    phase: "intro",
    current: null,
    queue: lesson.exercises.map((_, i) => i),
    turn: 0,
    firstTryCorrect: 0,
    requeued: [],
    lastResult: null,
  };
}

function advance(state: LessonSession): LessonSession {
  const [next, ...rest] = state.queue;
  return next === undefined
    ? { ...state, phase: "summary", current: null, lastResult: null }
    : { ...state, phase: "exercise", current: next, queue: rest, lastResult: null };
}

export function reduceSession(lesson: Lesson, state: LessonSession, action: SessionAction): LessonSession {
  switch (action.type) {
    case "start":
      return state.phase === "intro" ? advance(state) : state;

    case "submit": {
      const index = state.current;
      const exercise = index === null ? undefined : lesson.exercises[index];
      if (state.phase !== "exercise" || index === null || !exercise) return state;

      const result = checkAnswer(exercise, action.answer);
      const isRetry = state.requeued.includes(index);
      const requeue = !result.correct && !isRetry;

      return {
        ...state,
        phase: "feedback",
        lastResult: result,
        turn: state.turn + 1,
        firstTryCorrect: state.firstTryCorrect + (result.correct && !isRetry ? 1 : 0),
        requeued: requeue ? [...state.requeued, index] : state.requeued,
        queue: requeue ? [...state.queue, index] : state.queue,
      };
    }

    case "continue":
      return state.phase === "feedback" ? advance(state) : state;
  }
}

export function currentExercise(lesson: Lesson, state: LessonSession) {
  return state.current === null ? undefined : lesson.exercises[state.current];
}

/** An exercise is only on screen again in the exercise phase if it was re-queued. */
export function isMistakeReview(state: LessonSession): boolean {
  return state.phase === "exercise" && state.current !== null && state.requeued.includes(state.current);
}

export function progress(lesson: Lesson, state: LessonSession): number {
  const total = lesson.exercises.length + state.requeued.length;
  return total === 0 ? 1 : Math.min(1, state.turn / total);
}

export function summary(lesson: Lesson, state: LessonSession) {
  const total = lesson.exercises.length;
  return {
    xp: lessonXp(state.firstTryCorrect, total),
    accuracy: Math.round((state.firstTryCorrect / total) * 100),
  };
}
