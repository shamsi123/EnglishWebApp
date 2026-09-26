import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@englishpath/core";

const store = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: async (key: string) => store.get(key),
  set: async (key: string, value: unknown) => void store.set(key, value),
}));

const completeLesson = vi.fn();
vi.mock("../../shared/api", () => ({ api: { completeLesson: (...args: unknown[]) => completeLesson(...args) } }));

const { enqueueCompletion, flushCompletions, pendingCount } = await import("./completionQueue");

const item = (id: string) => ({
  lessonId: "l1",
  request: { completionId: id, lessonVersion: 1, learnerLocalDay: "2026-09-26", attempts: [] },
});

describe("completion queue", () => {
  beforeEach(() => {
    store.clear();
    completeLesson.mockReset();
  });

  it("syncs queued completions in order and empties the queue", async () => {
    completeLesson.mockResolvedValue({});
    await enqueueCompletion(item("a"));
    await enqueueCompletion(item("b"));
    await enqueueCompletion(item("a")); // duplicate ignored

    expect(await flushCompletions()).toBe(2);
    expect(completeLesson.mock.calls.map((c) => (c[1] as { completionId: string }).completionId)).toEqual(["a", "b"]);
    expect(await pendingCount()).toBe(0);
  });

  it("keeps everything when offline and retries later", async () => {
    completeLesson.mockRejectedValue(new TypeError("Failed to fetch"));
    await enqueueCompletion(item("a"));
    await enqueueCompletion(item("b"));

    expect(await flushCompletions()).toBe(0);
    expect(await pendingCount()).toBe(2);

    completeLesson.mockResolvedValue({});
    expect(await flushCompletions()).toBe(2);
  });

  it("drops completions the server permanently rejects but keeps auth and server failures", async () => {
    completeLesson
      .mockRejectedValueOnce(new ApiError(400, { title: "invalid" }))
      .mockRejectedValueOnce(new ApiError(503, undefined));
    await enqueueCompletion(item("bad"));
    await enqueueCompletion(item("later"));

    expect(await flushCompletions()).toBe(0);
    expect(await pendingCount()).toBe(1);

    completeLesson.mockRejectedValueOnce(new ApiError(401, undefined));
    await flushCompletions();
    expect(await pendingCount()).toBe(1);
  });
});
