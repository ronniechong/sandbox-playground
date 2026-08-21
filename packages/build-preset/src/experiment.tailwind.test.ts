import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';

const FIXTURE_DIR = join(import.meta.dirname, '..', 'test-fixtures', 'tailwind-app');

afterEach(() => {
  rmSync(join(FIXTURE_DIR, 'dist'), { recursive: true, force: true });
});

describe('experiment() with a real Tailwind build', () => {
  it("scopes Tailwind's generated utility classes, not just hand-written CSS", async () => {
    await build({ root: FIXTURE_DIR, logLevel: 'silent' });

    const distDir = join(FIXTURE_DIR, 'dist');
    const hashDir = readdirSync(distDir).find((d) => d !== '.build');
    if (!hashDir) throw new Error('No hashed output directory found');

    const css = readFileSync(join(distDir, hashDir, 'index.css'), 'utf8');

    // Tailwind-generated utility (from the fixture's mount.ts className)
    // must come out prefixed — a plugin registered before Tailwind
    // expands its utilities would never see them, and they'd ship
    // unscoped even though the build looks correct.
    expect(css).toMatch(/\[data-exp="tailwind-app"\]\s*\.text-red-500\{/);
    // Every rule in the whole stylesheet carries the prefix, not just
    // this one utility — a partial scoping bug would still leave gaps.
    const unprefixedRules = css.match(/(?:^|})([^{}@:][^{}]*)\{/g) ?? [];
    const leaked = unprefixedRules.filter((rule) => !rule.includes('[data-exp="tailwind-app"]'));
    expect(leaked).toEqual([]);
  });
});
