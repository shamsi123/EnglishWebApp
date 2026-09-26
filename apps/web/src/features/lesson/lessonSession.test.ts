import { describe, expect, it } from "vitest";
import type { Answer } from "@englishpath/core";
import { demoLesson } from "../../fixtures/demoLesson";
import {
  currentExercise,
  initSession,
  isMistakeReview,
  progress,
  reduceSession,
  summary,
  type LessonSession,
  type SessionAction,
} from "./lessonSession";

const step = (s: LessonSession, a: SessionAction) => reduceSession(demoLesson, s, a);
const run = (actions: SessionAction[]) => actions.reduce(step, initSession(demoLesson));

/** Correct answers for every demo exercise, by index. */
const correctAnswers: Answer[] = [
  { type: "multipleChoice", selectedIndex: 0 },
  { type: "listenSelect", selectedIndex: 1 },
  { type: "fillBlank", text: "am" },
  { type: "matchPairs", pairs: [["Good morning", "08:00"], ["Good afternoon", "15:00"], ["Good evening", "19:00"]] },
  { type: "reorderWords", words: ["See", "you", "tomorrow"] },
  { type: "dictation", text: "goodbye" },
  { type: "multipleChoice", selectedIndex: 2 },
  { type: "fillBlank", text: "morning" },
];
const wrongFirst: Answer = { type: "multipleChoice", selectedIndex: 1 };

describe("lesson session", () => {
  it("starts on the intro, then shows the first exercise", () => {
    expect(initSession(demoLesson).phase).toBe("intro");
    const s = run([{ type: "start" }]);
    expect(s.phase).toBe("exercise");
    expect(currentExercise(demoLesson, s)?.id).toBe("ex1");
  });

  it("keeps the answered exercise on screen during feedback", () => {
    const s = run([{ type: "start" }, { type: "submit", answer: correctAnswers[0]! }]);
    expect(s.phase).toBe("feedback");
    expect(s.lastResult?.correct).toBe(true);
    expect(currentExercise(demoLesson, s)?.id).toBe("ex1");
    expect(currentExercise(demoLesson, step(s, { type: "continue" }))?.id).toBe("ex2");
  });

  it("completes a perfect lesson with the bonus XP", () => {
    let s = run([{ type: "start" }]);
    for (const answer of correctAnswers) s = step(step(s, { type: "submit", answer }), { type: "continue" });
    expect(s.phase).toBe("summary");
    expect(progress(demoLesson, s)).toBe(1);
    expect(summary(demoLesson, s)).toEqual({ xp: 8 + 10 + 5, accuracy: 100 });
  });

  it("repeats a wrong answer once at the end and scores first tries only (FR-24)", () => {
    let s = run([{ type: "start" }, { type: "submit", answer: wrongFirst }]);
    expect(s.lastResult?.correct).toBe(false);
    expect(s.lastResult?.correctAnswer).toBe("Hello!");
    s = step(s, { type: "continue" });
    for (const answer of correctAnswers.slice(1)) s = step(step(s, { type: "submit", answer }), { type: "continue" });

    expect(s.phase).toBe("exercise");
    expect(currentExercise(demoLesson, s)?.id).toBe("ex1");
    expect(isMistakeReview(s)).toBe(true);

    // Wrong again: not re-queued a second time.
    s = step(step(s, { type: "submit", answer: wrongFirst }), { type: "continue" });
    expect(s.phase).toBe("summary");
    expect(summary(demoLesson, s)).toEqual({ xp: 7 + 10, accuracy: 88 });
  });

  it("ignores actions that don't apply to the current phase", () => {
    const intro = initSession(demoLesson);
    expect(step(intro, { type: "submit", answer: correctAnswers[0]! })).toBe(intro);
    expect(step(intro, { type: "continue" })).toBe(intro);
  });
});
