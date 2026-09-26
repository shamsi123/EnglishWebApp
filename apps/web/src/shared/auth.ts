import { AuthSession, type RefreshTokenStorage } from "@englishpath/core";
import { create } from "zustand";

const KEY = "englishpath.refreshToken";

/**
 * Web storage for the rotating refresh token. The Capacitor build (Phase 3) swaps this for the
 * device's secure storage; access tokens are only ever held in memory (NFR-06).
 */
const storage: RefreshTokenStorage = {
  get() {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      if (token) localStorage.setItem(KEY, token);
      else localStorage.removeItem(KEY);
    } catch {
      // Storage unavailable (private mode): the session lasts until the tab closes.
    }
  },
};

export const auth = new AuthSession({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
  clientId: "englishpath-web",
  storage,
});

type AuthStatus = "restoring" | "signedIn" | "signedOut";

export const useAuthStore = create<{ status: AuthStatus }>(() => ({ status: "restoring" }));

auth.subscribe((signedIn) => useAuthStore.setState({ status: signedIn ? "signedIn" : "signedOut" }));

/** Restores the session from the stored refresh token. Offline with a stored token counts as signed in. */
export async function restoreSession(): Promise<void> {
  try {
    const restored = await auth.restore();
    useAuthStore.setState({ status: restored ? "signedIn" : "signedOut" });
  } catch {
    useAuthStore.setState({ status: storage.get() ? "signedIn" : "signedOut" });
  }
}
