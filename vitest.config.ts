import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    // Database tests build a fresh database from every migration; under a parallel full run that passes 5s.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: [
      "src/**/*.test.{ts,tsx}",
      "scripts/**/*.test.ts",
      "supabase/tests/**/*.test.ts",
    ],
  },
});
