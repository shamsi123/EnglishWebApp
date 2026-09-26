import { z } from "zod";

/**
 * Structured lesson content (BRD §6, §8.3 decision 2). Content is authored as typed
 * JSON and rendered natively by web and mobile clients, so these schemas are the
 * contract shared by the CMS, the Learning service and the lesson player.
 */

export const CefrLevel = z.enum(["PreA1", "A1", "A2", "B1", "B2"]);
export type CefrLevel = z.infer<typeof CefrLevel>;

/** Levels available in Phase 1 (MVP): Pre-A1 to A2. */
export const MVP_LEVELS: readonly CefrLevel[] = ["PreA1", "A1", "A2"];

export const Skill = z.enum(["reading", "listening", "speaking", "writing", "grammar", "vocabulary"]);
export type Skill = z.infer<typeof Skill>;

export const ContentStatus = z.enum(["Draft", "InReview", "Published", "Archived"]);
export type ContentStatus = z.infer<typeof ContentStatus>;

const MediaRef = z.object({
  assetId: z.string().min(1),
  url: z.string().url(),
  /** Transcript or caption for audio, alt text for images (NFR-09). */
  text: z.string().min(1),
});
export type MediaRef = z.infer<typeof MediaRef>;

const exerciseBase = {
  id: z.string().min(1),
  prompt: z.string().min(1),
  explanation: z.string().min(1),
  skills: z.array(Skill).min(1),
  audio: MediaRef.optional(),
  image: MediaRef.optional(),
};

/** The 7 MVP exercise types (FR-22). */
export const MultipleChoiceExercise = z.object({
  ...exerciseBase,
  type: z.literal("multipleChoice"),
  options: z.array(z.string().min(1)).min(2).max(6),
  correctIndex: z.number().int().nonnegative(),
});

export const FillBlankExercise = z.object({
  ...exerciseBase,
  type: z.literal("fillBlank"),
  /** Sentence with a single `___` placeholder. */
  sentence: z.string().includes("___"),
  acceptedAnswers: z.array(z.string().min(1)).min(1),
});

export const MatchPairsExercise = z.object({
  ...exerciseBase,
  type: z.literal("matchPairs"),
  pairs: z.array(z.tuple([z.string().min(1), z.string().min(1)])).min(2).max(6),
});

export const ReorderWordsExercise = z.object({
  ...exerciseBase,
  type: z.literal("reorderWords"),
  /** Words in the correct order; the client shuffles them. */
  words: z.array(z.string().min(1)).min(2),
});

export const ListenSelectExercise = z.object({
  ...exerciseBase,
  type: z.literal("listenSelect"),
  audio: MediaRef,
  options: z.array(z.string().min(1)).min(2).max(6),
  correctIndex: z.number().int().nonnegative(),
});

export const DictationExercise = z.object({
  ...exerciseBase,
  type: z.literal("dictation"),
  audio: MediaRef,
  acceptedAnswers: z.array(z.string().min(1)).min(1),
});

export const ImageWordExercise = z.object({
  ...exerciseBase,
  type: z.literal("imageWord"),
  choices: z.array(z.object({ word: z.string().min(1), image: MediaRef })).min(2).max(4),
  correctIndex: z.number().int().nonnegative(),
});

export const Exercise = z
  .discriminatedUnion("type", [
    MultipleChoiceExercise,
    FillBlankExercise,
    MatchPairsExercise,
    ReorderWordsExercise,
    ListenSelectExercise,
    DictationExercise,
    ImageWordExercise,
  ])
  .superRefine((ex, ctx) => {
    const count =
      ex.type === "multipleChoice" || ex.type === "listenSelect"
        ? ex.options.length
        : ex.type === "imageWord"
          ? ex.choices.length
          : undefined;
    if (count !== undefined && "correctIndex" in ex && ex.correctIndex >= count) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["correctIndex"], message: "correctIndex is out of range" });
    }
  });
export type Exercise = z.infer<typeof Exercise>;
export type ExerciseType = Exercise["type"];

export const VocabularyEntry = z.object({
  id: z.string().min(1),
  word: z.string().min(1),
  ipa: z.string().optional(),
  example: z.string().min(1),
  translation: z.string().optional(),
  audioUk: MediaRef.optional(),
  audioUs: MediaRef.optional(),
  image: MediaRef.optional(),
});
export type VocabularyEntry = z.infer<typeof VocabularyEntry>;

/** A lesson bundle as downloaded by the client (FR-21, NFR-05). */
export const Lesson = z
  .object({
    id: z.string().min(1),
    unitId: z.string().min(1),
    version: z.number().int().positive(),
    title: z.string().min(1),
    objective: z.string().min(1),
    grammarPoint: z.string().optional(),
    intro: z.object({ concept: z.string().min(1), example: z.string().min(1) }),
    /** Lesson design rule: ≤ 10 new words per lesson. */
    vocabulary: z.array(VocabularyEntry).max(10),
    /** FR-21: 8–15 exercises per lesson. */
    exercises: z.array(Exercise).min(8).max(15),
  })
  .superRefine((lesson, ctx) => {
    // Lesson design rule: each lesson includes at least one listening item.
    if (!lesson.exercises.some((e) => e.skills.includes("listening"))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["exercises"], message: "Lesson needs at least one listening exercise" });
    }
  });
export type Lesson = z.infer<typeof Lesson>;
