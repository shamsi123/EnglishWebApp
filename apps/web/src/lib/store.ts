import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { findNode, masteryFor, nodeItems } from '@/content/course';
import { review } from '@/engine/leitner';
import { evaluateMastery, type ItemResult, type MasteryResult } from '@/engine/mastery';
import { enqueue, newId } from '@/offline/syncQueue';
import type { UiLang } from '@/i18n';
import { emptyChildData, localDate, touchStreak, type ChildData, type LessonSession } from './progress';

export interface Parent {
  email: string;
  passwordHash: string;
  consentGivenAt: string;
  createdAt: string;
}

export interface Child {
  id: string;
  nickname: string;
  ageBand: '4-6' | '7-10';
  avatar: { animal: string; color: string; item: string };
  pinHash: string | null;
  courses: string[];
  createdAt: string;
}

export interface ChildSettings {
  sound: boolean;
  music: boolean;
  dailyLimitMinutes: number;
  quietHours: { start: string; end: string } | null;
  uiLang: UiLang;
  highContrast: boolean;
}

export const defaultSettings = (): ChildSettings => ({
  sound: true,
  music: true,
  dailyLimitMinutes: 20,
  quietHours: null,
  uiLang: 'en',
  highContrast: false,
});

interface State {
  parent: Parent | null;
  parentSignedIn: boolean;
  children: Child[];
  activeChildId: string | null;
  data: Record<string, ChildData>;
  settings: Record<string, ChildSettings>;

  registerParent(email: string, passwordHash: string): void;
  signIn(email: string, passwordHash: string): boolean;
  signOut(): void;
  addChild(child: Omit<Child, 'id' | 'createdAt'>): string;
  updateChild(id: string, patch: Partial<Omit<Child, 'id'>>): void;
  deleteChild(id: string): void;
  selectChild(id: string | null): void;
  updateSettings(childId: string, patch: Partial<ChildSettings>): void;

  setSession(session: LessonSession | null): void;
  recordAnswer(activityId: string, itemId: string, correct: boolean): void;
  completeCheck(nodeId: string, results: ItemResult[], traceAccuracy: number | null): MasteryResult;
  addMinute(): void;
  waterGarden(): void;
  overrideUnlock(childId: string, nodeId: string): void;
  assignExtraReview(childId: string, itemIds: string[]): void;
}

export async function hashSecret(secret: string): Promise<string> {
  const bytes = new TextEncoder().encode(`kidslang:${secret}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const patchChild = (state: State, fn: (d: ChildData) => ChildData): Partial<State> => {
  const id = state.activeChildId;
  if (!id) return {};
  return { data: { ...state.data, [id]: fn(state.data[id] ?? emptyChildData()) } };
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      parent: null,
      parentSignedIn: false,
      children: [],
      activeChildId: null,
      data: {},
      settings: {},

      registerParent: (email, passwordHash) =>
        set({
          parent: { email: email.trim().toLowerCase(), passwordHash, consentGivenAt: new Date().toISOString(), createdAt: new Date().toISOString() },
          parentSignedIn: true,
        }),
      signIn: (email, passwordHash) => {
        const p = get().parent;
        const ok = !!p && p.email === email.trim().toLowerCase() && p.passwordHash === passwordHash;
        if (ok) set({ parentSignedIn: true });
        return ok;
      },
      signOut: () => set({ parentSignedIn: false, activeChildId: null }),

      addChild: (child) => {
        const id = newId();
        set((s) => ({
          children: [...s.children, { ...child, id, createdAt: new Date().toISOString() }],
          data: { ...s.data, [id]: emptyChildData() },
          settings: { ...s.settings, [id]: defaultSettings() },
        }));
        return id;
      },
      updateChild: (id, patch) => set((s) => ({ children: s.children.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      // FR-05: deleting a profile removes all of its data (progress, attempts, rewards, logs).
      deleteChild: (id) =>
        set((s) => {
          const data = { ...s.data };
          const settings = { ...s.settings };
          delete data[id];
          delete settings[id];
          return { children: s.children.filter((c) => c.id !== id), data, settings, activeChildId: s.activeChildId === id ? null : s.activeChildId };
        }),
      selectChild: (id) => set({ activeChildId: id }),
      updateSettings: (childId, patch) =>
        set((s) => ({ settings: { ...s.settings, [childId]: { ...(s.settings[childId] ?? defaultSettings()), ...patch } } })),

      setSession: (session) =>
        set((s) =>
          patchChild(s, (d) => {
            const lessons = { ...d.lessons };
            if (session && !lessons[session.nodeId]) lessons[session.nodeId] = { status: 'in_progress', bestScore: 0, stars: 0, attempts: 0 };
            return { ...d, session, lessons };
          }),
        ),

      recordAnswer: (activityId, itemId, correct) =>
        set((s) =>
          patchChild(s, (d) => {
            const now = new Date();
            const lessonId = d.session?.nodeId ?? 'review';
            return {
              ...d,
              items: { ...d.items, [itemId]: review(d.items[itemId], correct, now) },
              streak: touchStreak(d.streak, now),
              queue: enqueue(d.queue, {
                id: newId(), childId: s.activeChildId!, activityId, lessonId, itemId, isCorrect: correct, createdAtUtc: now.toISOString(),
              }),
            };
          }),
        ),

      completeCheck: (nodeId, results, traceAccuracy) => {
        const node = findNode(nodeId);
        if (!node) throw new Error(`Unknown node ${nodeId}`);
        const { newItems } = nodeItems(node);
        const result = evaluateMastery({ newItems, config: masteryFor(node), results, traceAccuracy });
        set((s) =>
          patchChild(s, (d) => {
            const prev = d.lessons[nodeId] ?? { status: 'in_progress' as const, bestScore: 0, stars: 0, attempts: 0 };
            const wasMastered = prev.status === 'mastered';
            const mastered = wasMastered || result.mastered;
            let stickers = d.stickers;
            let trophies = d.trophies;
            if (result.mastered && node.kind === 'checkpoint' && !stickers.includes(node.unit.id)) stickers = [...stickers, node.unit.id];
            if (result.mastered && node.kind === 'level_test' && !trophies.includes(node.levelId)) trophies = [...trophies, node.levelId];
            return {
              ...d,
              stickers,
              trophies,
              lessons: {
                ...d.lessons,
                [nodeId]: {
                  ...prev,
                  status: mastered ? 'mastered' : 'in_progress',
                  bestScore: Math.max(prev.bestScore, result.score),
                  stars: Math.max(prev.stars, result.stars),
                  attempts: prev.attempts + 1,
                  masteredAt: prev.masteredAt ?? (result.mastered ? new Date().toISOString() : undefined),
                },
              },
            };
          }),
        );
        return result;
      },

      addMinute: () =>
        set((s) =>
          patchChild(s, (d) => {
            const today = localDate(new Date());
            return { ...d, minutesByDay: { ...d.minutesByDay, [today]: (d.minutesByDay[today] ?? 0) + 1 } };
          }),
        ),
      waterGarden: () =>
        set((s) =>
          patchChild(s, (d) => {
            const today = localDate(new Date());
            return d.gardenWaterings.includes(today) ? d : { ...d, gardenWaterings: [...d.gardenWaterings, today], extraReview: [] };
          }),
        ),
      overrideUnlock: (childId, nodeId) =>
        set((s) => {
          const d = s.data[childId] ?? emptyChildData();
          const prev = d.lessons[nodeId];
          return {
            data: {
              ...s.data,
              [childId]: { ...d, lessons: { ...d.lessons, [nodeId]: { status: prev?.status ?? 'in_progress', bestScore: prev?.bestScore ?? 0, stars: prev?.stars ?? 0, attempts: prev?.attempts ?? 0, unlockedByParent: true } } },
            },
          };
        }),
      assignExtraReview: (childId, itemIds) =>
        set((s) => {
          const d = s.data[childId] ?? emptyChildData();
          return { data: { ...s.data, [childId]: { ...d, extraReview: [...new Set([...d.extraReview, ...itemIds])] } } };
        }),
    }),
    {
      name: 'kidslang',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ parent: s.parent, parentSignedIn: s.parentSignedIn, children: s.children, activeChildId: s.activeChildId, data: s.data, settings: s.settings }),
    },
  ),
);

export function useActiveChild() {
  const child = useStore((s) => s.children.find((c) => c.id === s.activeChildId) ?? null);
  const data = useStore((s) => (s.activeChildId ? s.data[s.activeChildId] : undefined)) ?? EMPTY;
  const settings = useStore((s) => (s.activeChildId ? s.settings[s.activeChildId] : undefined)) ?? DEFAULTS;
  return { child, data, settings };
}

const EMPTY = emptyChildData();
const DEFAULTS = defaultSettings();
