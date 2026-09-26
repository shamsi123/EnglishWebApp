/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    // NFR-05: app shell precached; lesson bundles and media cached at runtime.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "EnglishPath",
        short_name: "EnglishPath",
        description: "Learn English in 5–10 minute lessons.",
        theme_color: "#16a34a",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/v1/learning/lessons/"),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "lessons", expiration: { maxEntries: 60 } },
          },
          {
            urlPattern: ({ request }) => request.destination === "audio" || request.destination === "image",
            handler: "CacheFirst",
            options: { cacheName: "media", expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    // Local gateway (backend/src/Gateway) listens on 5000.
    proxy: { "/api": "http://localhost:5000" },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test-setup.ts"],
  },
});
