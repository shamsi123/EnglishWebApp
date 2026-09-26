import { ApiClient } from "@englishpath/core";
import { useSessionStore } from "./session";

export const api = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
  getAccessToken: () => useSessionStore.getState().accessToken,
});
