import { describe, expect, it } from "vitest";
import { checkAnswer, normalizeText } from "./scoring.js";
import { Exercise, Lesson } from "./schema.js";

const audio = { assetId: "a1", url: "https://cdn.example.com/a1.m4a", text: "Good morning" };

const mc = Exercise.parse({
  id: "e1",
  type: "multipleChoice",
  prompt: "Pick the greeting",
  explanation: "We say 'Good morning' before noon.",
  skills: ["vocabulary"],
  options: ["Good morning", "Good night"],
  correctIndex: 0,
});

const listen = {
  id: "e2",
  type: "listenSelect",
  prompt: "What do you hear?",
  explanation: "The speaker says 'Good morning'.",
  skills: ["listening"],
  audio,
  options: ["Good morning", "Good evening"],
  correctIndex: 0,
};

describe("Exercise schema", () => {
  it("rejects an out-of-range correctIndex", () => {
    expect(Exercise.safeParse({ ...listen, correctIndex: 5 }).success).toBe(false);
  });

  it("requires a blank placeholder in fill-blank sentences", () => {
    const result = Exercise.safeParse({
      id: "e3",
      type: "fillBlank",
      prompt: "Complete",
      explanation: "x",
      skills: ["grammar"],
      sentence: "I am a student.",
      acceptedAnswers: ["am"],
    });
    expect(result.success).toBe(false);
  });
});

describe("Lesson schema", () => {
  const lesson = (exercises: unknown[]) => ({
    id: "l1",
    unitId: "u1",
    version: 1,
    title: "Greetings",
    objective: "I can greet people",
    intro: { concept: "Greetings", example: "Good morning!" },
    vocabulary: [],
    exercises,
  });

  it("accepts 8–15 exercises with a listening item", () => {
    const exercises = [listen, ...Array.from({ length: 7 }, (_, i) => ({ ...mc, id: `m${i}` }))];
    expect(Lesson.safeParse(lesson(exercises)).success).toBe(true);
  });

  it("rejects lessons without a listening item", () => {
    const exercises = Array.from({ length: 8 }, (_, i) => ({ ...mc, id: `m${i}` }));
    expect(Lesson.safeParse(lesson(exercises)).success).toBe(false);
  });

  it("rejects lessons with too few exercises", () => {
    expect(Lesson.safeParse(lesson([listen])).success).toBe(false);
  });
});

describe("checkAnswer", () => {
  it("scores multiple choice", () => {
    expect(checkAnswer(mc, { type: "multipleChoice", selectedIndex: 0 }).correct).toBe(true);
    const wrong = checkAnswer(mc, { type: "multipleChoice", selectedIndex: 1 });
    expect(wrong.correct).toBe(false);
    expect(wrong.correctAnswer).toBe("Good morning");
    expect(wrong.explanation).toContain("before noon");
  });

  it("normalises typed answers", () => {
    expect(normalizeText("  I’M   Fine. ")).toBe("i'm fine");
    const dictation = Exercise.parse({
      id: "d1",
      type: "dictation",
      prompt: "Type what you hear",
      explanation: "x",
      skills: ["listening"],
      audio,
      acceptedAnswers: ["Good morning"],
    });
    expect(checkAnswer(dictation, { type: "dictation", text: "good  morning!" }).correct).toBe(true);
  });

  it("scores match pairs regardless of order", () => {
    const ex = Exercise.parse({
      id: "p1",
      type: "matchPairs",
      prompt: "Match",
      explanation: "x",
      skills: ["vocabulary"],
      pairs: [["cat", "gato"], ["dog", "perro"]],
    });
    expect(checkAnswer(ex, { type: "matchPairs", pairs: [["dog", "perro"], ["cat", "gato"]] }).correct).toBe(true);
    expect(checkAnswer(ex, { type: "matchPairs", pairs: [["dog", "gato"], ["cat", "perro"]] }).correct).toBe(false);
  });

  it("scores reorder words", () => {
    const ex = Exercise.parse({
      id: "r1",
      type: "reorderWords",
      prompt: "Order the words",
      explanation: "x",
      skills: ["grammar"],
      words: ["I", "am", "happy"],
    });
    expect(checkAnswer(ex, { type: "reorderWords", words: ["I", "am", "happy"] }).correct).toBe(true);
    expect(checkAnswer(ex, { type: "reorderWords", words: ["am", "I", "happy"] }).correct).toBe(false);
  });

  it("throws when the answer type does not match", () => {
    expect(() => checkAnswer(mc, { type: "dictation", text: "x" })).toThrow();
  });
});
