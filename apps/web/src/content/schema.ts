import { z } from 'zod';

const localized = z.object({ en: z.string().min(1), ar: z.string().min(1) });
const lessonId = z.string().regex(/^[a-z]{2}-l\d+-u\d+-l\d+$/);
const itemId = z.string().regex(/^[a-z]{2}-[a-z]+-[a-z]+$/);

export const learningItemSchema = z.object({
  id: itemId,
  kind: z.enum(['letter', 'word', 'matra', 'haraka', 'number']),
  glyph: z.string().min(1),
  name: localized,
  translit: z.string().min(1),
  joinsNext: z.boolean(),
  audio: z.string().min(1),
  example: z.object({ word: z.string().min(1), plain: z.string().min(1), meaning: z.string().min(1), emoji: z.string().min(1) }),
});
export type LearningItem = z.infer<typeof learningItemSchema>;

export const itemsFileSchema = z.object({ courseId: z.string(), items: z.array(learningItemSchema).min(1) });

export const masteryConfigSchema = z.object({
  minScore: z.number().min(0).max(1),
  requireEachNewItem: z.boolean(),
  minTraceAccuracy: z.number().min(0).max(1),
});

export const lessonSchema = z.object({
  id: lessonId,
  title: localized,
  newItems: z.array(itemId).min(1),
  reviewItems: z.array(itemId),
  mastery: masteryConfigSchema.partial().optional(),
});
export type LessonDef = z.infer<typeof lessonSchema>;

export const unitSchema = z.object({
  id: z.string().regex(/^[a-z]{2}-l\d+-u\d+$/),
  title: localized,
  sticker: z.string().min(1),
  lessons: z.array(lessonSchema).min(1),
  checkpoint: z.object({ id: z.string().regex(/^[a-z]{2}-l\d+-u\d+-cp$/), size: z.number().int().min(3) }),
});
export type UnitDef = z.infer<typeof unitSchema>;

export const courseSchema = z.object({
  id: z.string(),
  languageCode: z.string().length(2),
  direction: z.enum(['rtl', 'ltr']),
  mascot: z.object({ emoji: z.string(), name: z.string() }),
  title: localized,
  defaultMastery: masteryConfigSchema,
  levels: z
    .array(
      z.object({
        id: z.string(),
        title: localized,
        trophy: z.string(),
        units: z.array(unitSchema).min(1),
        levelTest: z.object({ id: z.string(), size: z.number().int().min(3) }),
      }),
    )
    .min(1),
});
export type CourseDef = z.infer<typeof courseSchema>;

// ---- Activity configs (one schema per renderer, BRD §6 / §11.4) ----
const phase = z.enum(['learn', 'play', 'check']);
const base = { id: z.string(), phase, itemId: itemId };

export const learnCardSchema = z.object({ ...base, type: z.literal('learn_card') });
export const listenTapSchema = z.object({
  ...base,
  type: z.literal('listen_tap'),
  options: z.array(itemId).min(2).max(4),
  hints: z.boolean(),
});
export const traceSchema = z.object({ ...base, type: z.literal('trace'), minAccuracy: z.number().min(0).max(1) });
export const matchPairsSchema = z.object({ ...base, type: z.literal('match_pairs'), pairs: z.array(itemId).min(2).max(4) });
export const dragDropSchema = z.object({ ...base, type: z.literal('drag_drop'), options: z.array(itemId).min(2).max(4) });
export const popBalloonSchema = z.object({
  ...base,
  type: z.literal('pop_balloon'),
  options: z.array(itemId).min(2).max(4),
  goal: z.number().int().min(1).max(6),
});
export const findLetterSchema = z.object({ ...base, type: z.literal('find_letter'), word: z.string().min(1) });
// A8 Story Card (Learn phase): a short scene of the unit's items so far, each tappable to hear its word.
// `itemId` is the first featured item, so the shared speech/caption helpers still have a single item to
// describe; `items` carries the full scene (2-4 items, itemId included).
export const storyCardSchema = z.object({ ...base, type: z.literal('story_card'), items: z.array(itemId).min(2).max(4) });

export const activitySchema = z.discriminatedUnion('type', [
  learnCardSchema,
  listenTapSchema,
  traceSchema,
  matchPairsSchema,
  dragDropSchema,
  popBalloonSchema,
  findLetterSchema,
  storyCardSchema,
]);
export type Activity = z.infer<typeof activitySchema>;
export type ActivityType = Activity['type'];
export type ActivityOf<T extends ActivityType> = Extract<Activity, { type: T }>;
