import { defineConfig } from "@playwright/test";

/**
 * The Vancouver launch acceptance run (2026-10-24). Starts no server: run it
 * against a production build started with the group-adventures stack's env
 * and an Atlas stand-in serving production's own corpus — see README.md.
 */
const PORT = Number(process.env.E2E_PORT ?? 3120);

export default defineConfig({
  testDir: ".",
  testMatch: /visitor\.spec\.ts$/,
  reporter: "list",
  workers: 1,
  outputDir: process.env.E2E_OUTPUT ?? "/tmp/vancouver-playwright",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
