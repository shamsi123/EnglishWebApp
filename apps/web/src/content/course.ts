import courseJson from '@content/arabic/level-1/course.json';
import itemsJson from '@content/arabic/level-1/items.json';
import { courseSchema, itemsFileSchema, type CourseDef, type LearningItem, type LessonDef, type UnitDef } from './schema';
import { DEFAULT_MASTERY, type MasteryConfig } from '@/engine/mastery';

export const arabicCourse: CourseDef = courseSchema.parse(courseJson);
export const arabicItems: LearningItem[] = itemsFileSchema.parse(itemsJson).items;

export const courses: Record<string, CourseDef> = { ar: arabicCourse };
const itemsByCourse: Record<string, LearningItem[]> = { ar: arabicItems };
const itemIndex = new Map(arabicItems.map((i) => [i.id, i]));

export function getItem(id: string): LearningItem {
  const item = itemIndex.get(id);
  if (!item) throw new Error(`Unknown learning item ${id}`);
  return item;
}

export function courseItems(courseId: string): LearningItem[] {
  return itemsByCourse[courseId] ?? [];
}

/** A node on the journey path: a lesson, a unit checkpoint, or the level test. */
export type JourneyNode =
  | { kind: 'lesson'; id: string; courseId: string; unit: UnitDef; lesson: LessonDef; order: number }
  | { kind: 'checkpoint'; id: string; courseId: string; unit: UnitDef; size: number; order: number }
  | { kind: 'level_test'; id: string; courseId: string; levelId: string; size: number; order: number };

export function journeyNodes(courseId: string): JourneyNode[] {
  const course = courses[courseId];
  if (!course) return [];
  const nodes: JourneyNode[] = [];
  let order = 0;
  for (const level of course.levels) {
    for (const unit of level.units) {
      for (const lesson of unit.lessons) nodes.push({ kind: 'lesson', id: lesson.id, courseId, unit, lesson, order: order++ });
      nodes.push({ kind: 'checkpoint', id: unit.checkpoint.id, courseId, unit, size: unit.checkpoint.size, order: order++ });
    }
    nodes.push({ kind: 'level_test', id: level.levelTest.id, courseId, levelId: level.id, size: level.levelTest.size, order: order++ });
  }
  return nodes;
}

export function findNode(nodeId: string): JourneyNode | undefined {
  for (const courseId of Object.keys(courses)) {
    const node = journeyNodes(courseId).find((n) => n.id === nodeId);
    if (node) return node;
  }
  return undefined;
}

export function nodeItems(node: JourneyNode): { newItems: string[]; reviewItems: string[] } {
  if (node.kind === 'lesson') return { newItems: node.lesson.newItems, reviewItems: node.lesson.reviewItems };
  if (node.kind === 'checkpoint') return { newItems: node.unit.lessons.flatMap((l) => l.newItems), reviewItems: [] };
  const course = courses[node.courseId]!;
  const level = course.levels.find((l) => l.id === node.levelId)!;
  return { newItems: level.units.flatMap((u) => u.lessons.flatMap((l) => l.newItems)), reviewItems: [] };
}

export function masteryFor(node: JourneyNode): MasteryConfig {
  const course = courses[node.courseId];
  const base = course?.defaultMastery ?? DEFAULT_MASTERY;
  if (node.kind !== 'lesson') return { ...base, requireEachNewItem: false };
  return { ...base, ...node.lesson.mastery };
}

export function nodeTitle(node: JourneyNode, lang: 'en' | 'ar'): string {
  if (node.kind === 'lesson') return node.lesson.title[lang];
  if (node.kind === 'checkpoint') return node.unit.title[lang];
  return courses[node.courseId]!.levels.find((l) => l.id === node.levelId)!.title[lang];
}
