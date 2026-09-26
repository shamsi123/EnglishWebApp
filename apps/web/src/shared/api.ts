import { ApiClient } from "@englishpath/core";
import { auth } from "./auth";

export const api = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
  getAccessToken: () => auth.getAccessToken(),
  onUnauthorized: () => auth.refresh(),
});
