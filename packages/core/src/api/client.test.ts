import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "./client.js";

function fakeFetch(status: number, body?: unknown) {
  return vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }));
}

describe("ApiClient", () => {
  it("calls versioned endpoints with a bearer token", async () => {
    const fetch = fakeFetch(200, { completionId: "c1", correctFirstTry: 7, totalExercises: 8 });
    const client = new ApiClient({ baseUrl: "https://api.test", getAccessToken: () => "tok", fetch });

    const result = await client.completeLesson("l 1", {
      completionId: "c1",
      lessonVersion: 1,
      learnerLocalDay: "2026-09-26",
      attempts: [{ exerciseId: "e1", answer: { type: "multipleChoice", selectedIndex: 0 }, answeredAt: "2026-09-26T08:00:00Z", timeTakenMs: 900 }],
    });

    expect(result.correctFirstTry).toBe(7);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/learning/lessons/l%201/completions");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("returns undefined for 204 responses", async () => {
    const client = new ApiClient({ baseUrl: "", fetch: fakeFetch(204) });
    await expect(client.setDailyGoal(10)).resolves.toBeUndefined();
  });

  it("throws ApiError with problem details", async () => {
    const client = new ApiClient({ baseUrl: "", fetch: fakeFetch(404, { title: "Lesson not found.", status: 404 }) });
    const error = await client.getLesson("x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).message).toBe("Lesson not found.");
  });
});
