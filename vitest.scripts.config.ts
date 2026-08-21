import { defineConfig } from 'vitest/config';

/**
 * Covers `scripts/**` only — every package under `apps/*` and
 * `packages/*` runs its own tests via its own `vitest.config`
 * (`pnpm -r run test`, see justfile). `scripts/` isn't a workspace
 * package, so it needs this one root-level config instead.
 */
export default defineConfig({
  test: {
    include: ['scripts/**/*.test.ts'],
  },
});
