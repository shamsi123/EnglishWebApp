/**
 * Offline attempt queue (FR-42). Attempts get a client-generated GUID so the server's batch
 * endpoint can be idempotent: re-sending an attempt never creates a duplicate.
 */
export interface ActivityAttempt {
  id: string;
  childId: string;
  activityId: string;
  lessonId: string;
  itemId: string;
  isCorrect: boolean;
  createdAtUtc: string;
}

export function enqueue(queue: ActivityAttempt[], attempt: ActivityAttempt): ActivityAttempt[] {
  return queue.some((a) => a.id === attempt.id) ? queue : [...queue, attempt];
}

export type SendBatch = (batch: ActivityAttempt[]) => Promise<{ acceptedIds: string[] }>;

/** Sends queued attempts in batches; returns the queue with every accepted attempt removed. */
export async function flush(queue: ActivityAttempt[], send: SendBatch, batchSize = 50): Promise<ActivityAttempt[]> {
  let remaining = queue;
  for (let i = 0; i < queue.length; i += batchSize) {
    const batch = queue.slice(i, i + batchSize);
    try {
      const { acceptedIds } = await send(batch);
      const accepted = new Set(acceptedIds);
      remaining = remaining.filter((a) => !accepted.has(a.id));
    } catch {
      break; // still offline — keep the rest for the next sync
    }
  }
  return remaining;
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}
