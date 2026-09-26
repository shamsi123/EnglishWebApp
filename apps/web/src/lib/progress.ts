import { journeyNodes, type JourneyNode } from '@/content/course';
import type { ItemMastery } from '@/engine/leitner';
import type { ItemResult, MasteryResult } from '@/engine/mastery';
import type { ActivityAttempt } from '@/offline/syncQueue';

export type NodeStatus = 'locked' | 'available' | 'in_progress' | 'mastered';

export interface LessonProgress {
  status: 'in_progress' | 'mastered';
  bestScore: number;
  stars: number;
  attempts: number;
  masteredAt?: string;
  /** Parent override unlock (FR-35). */
  unlockedByParent?: boolean;
}

export type LessonStage = 'learn' | 'play' | 'check' | 'help' | 'reward';

/** An in-flight lesson, persisted so an interrupted lesson resumes where it stopped (FR-18). */
export interface LessonSession {
  nodeId: string;
  stage: LessonStage;
  index: number;
  seed: number;
  quizResults: ItemResult[];
  traceAccuracy: number | null;
  result?: MasteryResult;
  helpItems?: string[];
  retries: number;
  newSticker?: string;
  newTrophy?: string;
}

export interface Streak {
  current: number;
  longest: number;
  lastActiveDate: string | null;
  freezes: number;
}

export interface ChildData {
  lessons: Record<string, LessonProgress>;
  items: Record<string, ItemMastery>;
  stickers: string[];
  trophies: string[];
  streak: Streak;
  minutesByDay: Record<string, number>;
  gardenWaterings: string[];
  session: LessonSession | null;
  queue: ActivityAttempt[];
  extraReview: string[];
}

export const emptyChildData = (): ChildData => ({
  lessons: {},
  items: {},
  stickers: [],
  trophies: [],
  streak: { current: 0, longest: 0, lastActiveDate: null, freezes: 1 },
  minutesByDay: {},
  gardenWaterings: [],
  session: null,
  queue: [],
  extraReview: [],
});

/** Journey states (FR-10, FR-12, FR-14): a node opens only after the previous one is mastered. */
export function nodeStatuses(courseId: string, data: ChildData): Record<string, NodeStatus> {
  const out: Record<string, NodeStatus> = {};
  let prevMastered = true;
  for (const node of journeyNodes(courseId)) {
    const p = data.lessons[node.id];
    let status: NodeStatus;
    if (p?.status === 'mastered') status = 'mastered';
    else if (prevMastered || p?.unlockedByParent) status = p?.status === 'in_progress' || data.session?.nodeId === node.id ? 'in_progress' : 'available';
    else status = 'locked';
    out[node.id] = status;
    prevMastered = status === 'mastered';
  }
  return out;
}

export function currentNode(courseId: string, data: ChildData): JourneyNode | undefined {
  const states = nodeStatuses(courseId, data);
  return journeyNodes(courseId).find((n) => states[n.id] === 'in_progress' || states[n.id] === 'available');
}

export function totalStars(data: ChildData): number {
  return Object.values(data.lessons).reduce((s, l) => s + l.stars, 0);
}

export const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Daily streak in the child's local time zone (FR-21), with a friendly streak freeze. */
export function touchStreak(streak: Streak, now: Date): Streak {
  const today = localDate(now);
  if (streak.lastActiveDate === today) return streak;
  const gap = streak.lastActiveDate ? daysBetween(streak.lastActiveDate, today) : Infinity;
  let { current, freezes } = streak;
  if (gap === 1) current += 1;
  else if (gap === 2 && freezes > 0) {
    freezes -= 1;
    current += 1;
  } else current = 1;
  if (current > 0 && current % 7 === 0) freezes = Math.min(freezes + 1, 2);
  return { current, longest: Math.max(streak.longest, current), lastActiveDate: today, freezes };
}

export interface AvatarItem {
  id: string;
  emoji: string;
  stars: number;
}

/** Avatar items unlock by total stars (FR-22). */
export const AVATAR_ITEMS: AvatarItem[] = [
  { id: 'none', emoji: '', stars: 0 },
  { id: 'cap', emoji: '🧢', stars: 3 },
  { id: 'bow', emoji: '🎀', stars: 6 },
  { id: 'tophat', emoji: '🎩', stars: 10 },
  { id: 'crown', emoji: '👑', stars: 20 },
  { id: 'grad', emoji: '🎓', stars: 40 },
];

export const AVATAR_COLORS = [
  { id: 'grape', value: '#c4b5fd', stars: 0 },
  { id: 'sun', value: '#fde68a', stars: 0 },
  { id: 'leaf', value: '#bbf7d0', stars: 0 },
  { id: 'sky', value: '#bae6fd', stars: 5 },
  { id: 'coral', value: '#fecdd3', stars: 12 },
  { id: 'gold', value: '#fcd34d', stars: 25 },
];

export const AVATAR_ANIMALS = ['🦁', '🐼', '🦊', '🐰', '🐸', '🐯', '🐨', '🐵'];
export const PIN_PICTURES = ['🍎', '🚗', '🌟', '🐶', '🌈', '⚽'];
