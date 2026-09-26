import { get, set } from "idb-keyval";
import { ApiError, type CompleteLessonRequest } from "@englishpath/core";
import { api } from "../../shared/api";

/**
 * Offline queue for finished lessons (NFR-05). Completions are stored in IndexedDB first, then
 * synced; each carries a client-generated id, so retrying after a lost response is safe.
 */

const KEY = "englishpath.pendingCompletions";

export interface PendingCompletion {
  lessonId: string;
  request: CompleteLessonRequest;
}

let flushing: Promise<number> | null = null;

async function read(): Promise<PendingCompletion[]> {
  try {
    return (await get<PendingCompletion[]>(KEY)) ?? [];
  } catch {
    return [];
  }
}

export async function enqueueCompletion(item: PendingCompletion): Promise<void> {
  const queue = await read();
  if (!queue.some((q) => q.request.completionId === item.request.completionId)) {
    await set(KEY, [...queue, item]);
  }
}

export async function pendingCount(): Promise<number> {
  return (await read()).length;
}

/** A 4xx other than auth/timeout/throttling means the server will never accept it. */
function isPermanent(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500 && ![401, 408, 429].includes(error.status);
}

/**
 * Sends queued completions in order. Stops at the first retryable failure so order is kept.
 * Resolves to the number synced. Concurrent calls share one run.
 */
export function flushCompletions(): Promise<number> {
  flushing ??= (async () => {
    let synced = 0;
    for (;;) {
      const [next] = await read();
      if (!next) return synced;
      try {
        await api.completeLesson(next.lessonId, next.request);
        synced += 1;
      } catch (error) {
        if (!isPermanent(error)) return synced;
        console.warn("Dropping completion the server rejected", next.request.completionId, error);
      }
      const rest = (await read()).filter((q) => q.request.completionId !== next.request.completionId);
      await set(KEY, rest);
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
