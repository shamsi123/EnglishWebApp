import type { Exercise } from "./schema.js";

/**
 * Local answer checking for the offline-first learning loop (BRD §8.3 decision 3).
 * The server re-validates submitted attempts with the same rules before awarding XP.
 */

export type Answer =
  | { type: "multipleChoice" | "listenSelect" | "imageWord"; selectedIndex: number }
  | { type: "fillBlank" | "dictation"; text: string }
  | { type: "matchPairs"; pairs: ReadonlyArray<readonly [string, string]> }
  | { type: "reorderWords"; words: readonly string[] };

export interface CheckResult {
  correct: boolean;
  /** Human-readable correct answer shown in feedback (FR-23). */
  correctAnswer: string;
  explanation: string;
}

/** Case-, whitespace- and trailing-punctuation-insensitive comparison. Apostrophe variants are unified. */
export function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/[.!?,;:]+$/g, "");
}

export function checkAnswer(exercise: Exercise, answer: Answer): CheckResult {
  const result = (correct: boolean, correctAnswer: string): CheckResult => ({
    correct,
    correctAnswer,
    explanation: exercise.explanation,
  });

  if (answer.type !== exercise.type) {
    throw new Error(`Answer type '${answer.type}' does not match exercise type '${exercise.type}'`);
  }

  switch (exercise.type) {
    case "multipleChoice":
    case "listenSelect": {
      const { selectedIndex } = answer as { selectedIndex: number };
      return result(selectedIndex === exercise.correctIndex, exercise.options[exercise.correctIndex] ?? "");
    }
    case "imageWord": {
      const { selectedIndex } = answer as { selectedIndex: number };
      return result(selectedIndex === exercise.correctIndex, exercise.choices[exercise.correctIndex]?.word ?? "");
    }
    case "fillBlank":
    case "dictation": {
      const given = normalizeText((answer as { text: string }).text);
      return result(
        exercise.acceptedAnswers.some((a) => normalizeText(a) === given),
        exercise.acceptedAnswers[0] ?? "",
      );
    }
    case "matchPairs": {
      const given = (answer as { pairs: ReadonlyArray<readonly [string, string]> }).pairs;
      const expected = new Map(exercise.pairs.map(([l, r]) => [l, r]));
      const correct =
        given.length === expected.size && given.every(([l, r]) => expected.get(l) === r);
      return result(correct, exercise.pairs.map(([l, r]) => `${l} – ${r}`).join(", "));
    }
    case "reorderWords": {
      const given = (answer as { words: readonly string[] }).words.map(normalizeText).join(" ");
      const expected = exercise.words.map(normalizeText).join(" ");
      return result(given === expected, exercise.words.join(" "));
    }
  }
}
