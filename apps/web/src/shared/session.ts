import { create } from "zustand";

interface SessionState {
  /** Short-lived access token (NFR-06); held in memory only, never localStorage. */
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  setAccessToken: (accessToken) => set({ accessToken }),
}));
