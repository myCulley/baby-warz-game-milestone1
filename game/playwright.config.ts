import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5173", headless: true },
  webServer: [
    {
      command: "pnpm --filter @baby-warz/server dev",
      url: "http://127.0.0.1:2567/health",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @baby-warz/client dev",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
