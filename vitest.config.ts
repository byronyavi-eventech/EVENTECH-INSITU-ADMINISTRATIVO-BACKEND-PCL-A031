import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use Node environment (not browser/jsdom — this is a backend project).
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    // Show individual test names even when they pass.
    reporter: 'verbose',
    // Global test helpers (describe, it, expect, vi) — no need to import per-file.
    globals: true,
    // Collect coverage with v8 — run with: pnpm test:coverage
    coverage: {
      provider: 'v8',
      include: ['src/controllers/**', 'src/services/**'],
      exclude: ['src/**/*.d.ts'],
    },
  },
});
