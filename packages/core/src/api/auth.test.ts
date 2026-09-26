import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "./client.js";
import { AuthSession, OAuthError, type RefreshTokenStorage } from "./auth.js";

function memoryStorage(initial: string | null = null): RefreshTokenStorage & { value: string | null } {
  return {
    value: initial,
    get() {
      return this.value;
    },
    set(token) {
      this.value = token;
    },
  };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

function tokenServer() {
  let n = 0;
  return vi.fn(async (_url: string, init?: RequestInit) => {
    const form = new URLSearchParams(String(init?.body));
    if (form.get("grant_type") === "password" && form.get("password") !== "right") {
      return json(400, { error: "invalid_grant", error_description: "The email or password is incorrect." });
    }
    if (form.get("grant_type") === "refresh_token" && form.get("refresh_token") === "revoked") {
      return json(400, { error: "invalid_grant", error_description: "expired" });
    }
    n += 1;
    return json(200, { access_token: `at${n}`, refresh_token: `rt${n}`, expires_in: 900 });
  });
}

describe("AuthSession", () => {
  it("signs in with a password, stores the refresh token and notifies listeners", async () => {
    const fetch = tokenServer();
    const storage = memoryStorage();
    const session = new AuthSession({ baseUrl: "https://api.test", clientId: "web", storage, fetch });
    const listener = vi.fn();
    session.subscribe(listener);

    await session.signInWithPassword("a@b.c", "right");

    expect(session.isSignedIn).toBe(true);
    expect(await session.getAccessToken()).toBe("at1");
    expect(storage.value).toBe("rt1");
    expect(listener).toHaveBeenCalledWith(true);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.test/connect/token");
    const form = new URLSearchParams(String(init?.body));
    expect(form.get("client_id")).toBe("web");
    expect(form.get("scope")).toContain("offline_access");
  });

  it("surfaces OAuth errors with their reason code", async () => {
    const fetch = vi.fn(async () =>
      json(400, { error: "invalid_grant", error_description: "Tell us your date of birth.", error_uri: "https://englishpath.app/errors/registration_required" }),
    );
    const session = new AuthSession({ baseUrl: "", clientId: "web", storage: memoryStorage(), fetch });

    const error = await session.signInWithProvider("google", "id-token").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OAuthError);
    expect((error as OAuthError).code).toBe("registration_required");
    expect((error as OAuthError).message).toBe("Tell us your date of birth.");
  });

  it("refreshes an expiring token once for concurrent callers and rotates the refresh token", async () => {
    let now = 0;
    const fetch = tokenServer();
    const storage = memoryStorage();
    const session = new AuthSession({ baseUrl: "", clientId: "web", storage, fetch, now: () => now });
    await session.signInWithPassword("a@b.c", "right");

    now = 890_000; // within the refresh margin of the 15-minute expiry
    const tokens = await Promise.all([session.getAccessToken(), session.getAccessToken(), session.getAccessToken()]);

    expect(tokens).toEqual(["at2", "at2", "at2"]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(storage.value).toBe("rt2");
  });

  it("restores from a stored refresh token and signs out when it is rejected", async () => {
    const fetch = tokenServer();
    const good = new AuthSession({ baseUrl: "", clientId: "web", storage: memoryStorage("rt0"), fetch });
    expect(await good.restore()).toBe(true);

    const storage = memoryStorage("revoked");
    const bad = new AuthSession({ baseUrl: "", clientId: "web", storage, fetch });
    expect(await bad.restore()).toBe(false);
    expect(storage.value).toBeNull();
  });

  it("keeps the refresh token when the network fails", async () => {
    const storage = memoryStorage("rt0");
    const session = new AuthSession({ baseUrl: "", clientId: "web", storage, fetch: vi.fn(async () => Promise.reject(new TypeError("offline"))) });
    await expect(session.restore()).rejects.toThrow("offline");
    expect(storage.value).toBe("rt0");
  });

  it("revokes the refresh token on sign-out", async () => {
    const fetch = tokenServer();
    const storage = memoryStorage();
    const session = new AuthSession({ baseUrl: "", clientId: "web", storage, fetch });
    await session.signInWithPassword("a@b.c", "right");

    await session.signOut();

    expect(session.isSignedIn).toBe(false);
    expect(storage.value).toBeNull();
    const [url, init] = fetch.mock.calls.at(-1)!;
    expect(url).toBe("/connect/revoke");
    expect(new URLSearchParams(String(init?.body)).get("token")).toBe("rt1");
  });
});

describe("ApiClient with AuthSession", () => {
  it("retries once with a refreshed token after a 401", async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string>).Authorization;
      return auth === "Bearer fresh" ? json(200, { ok: true }) : new Response(null, { status: 401 });
    });
    const client = new ApiClient({ baseUrl: "", getAccessToken: () => "stale", onUnauthorized: async () => "fresh", fetch });

    await expect(client.request("GET", "/x")).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
