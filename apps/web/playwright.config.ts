import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', serviceWorkers: 'allow', contextOptions: { reducedMotion: 'reduce' } },
  projects: [
    { name: 'iPhone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'Pixel', use: { ...devices['Pixel 7'] } },
  ],
  webServer: { command: 'npm run build && npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true, timeout: 180_000 },
});
