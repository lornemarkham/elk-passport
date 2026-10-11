import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * The critic's own config: `src/**` tests stay as they are, and a normal
 * `npx vitest run` never picks the critic up (it needs evidence to run).
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["scripts/critic/**/*.{critic,test}.{ts,tsx}"],
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../src"),
      "server-only": path.resolve(__dirname, "../../test/server-only.stub.ts"),
    },
  },
});
