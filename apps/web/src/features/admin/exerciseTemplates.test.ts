import { describe, expect, it } from "vitest";
import { Exercise, Lesson } from "@englishpath/core";
import { EMPTY_LESSON_CONTENT, EXERCISE_TEMPLATES } from "./exerciseTemplates";

describe("exercise templates", () => {
  it.each(Object.entries(EXERCISE_TEMPLATES))("%s matches the shared exercise schema", (_key, template) => {
    expect(Exercise.safeParse(template.make()).success).toBe(true);
  });

  it("produces distinct ids across calls", () => {
    const ids = Object.values(EXERCISE_TEMPLATES).flatMap((t) => [t.make().id, t.make().id]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("assembled with one of every type forms a valid lesson", () => {
    const exercises = Object.values(EXERCISE_TEMPLATES).map((t) => t.make());
    // Needs 8+ exercises (FR-21) and a listening item; templates alone (7 types, one listenSelect) fall short, so pad with another listen.
    const content = { ...EMPTY_LESSON_CONTENT, objective: "I can test.", exercises: [...exercises, EXERCISE_TEMPLATES.listenSelect!.make()] };
    const result = Lesson.safeParse({ id: "l1", unitId: "u1", version: 1, title: "Test", ...content });
    expect(result.success).toBe(true);
  });
});
