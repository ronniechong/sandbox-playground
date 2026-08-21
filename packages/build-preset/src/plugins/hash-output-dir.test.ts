import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
import { hashOutputDir } from './hash-output-dir.ts';

let dir: string | undefined;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function findHashDir(distDir: string): string {
  const match = readdirSync(distDir).find((d) => d !== '.build');
  if (!match) throw new Error(`No hashed output directory found in ${distDir}`);
  return match;
}

describe('hashOutputDir', () => {
  it('writes provenance() output as build.json in the final hashed directory, excluded from the hash itself', async () => {
    dir = mkdtempSync(join(tmpdir(), 'hash-output-dir-'));
    const entry = join(dir, 'main.ts');
    writeFileSync(entry, "console.log('provenance test');\n");

    await build({
      root: dir,
      logLevel: 'silent',
      build: { outDir: join('dist', '.build'), lib: { entry, formats: ['iife'], name: 'x' } },
      plugins: [hashOutputDir('.build', 'dist', () => ({ contractVersion: 1 }))],
    });

    const distDir = join(dir, 'dist');
    const hashDir = findHashDir(distDir);
    const buildJsonPath = join(distDir, hashDir, 'build.json');
    expect(existsSync(buildJsonPath)).toBe(true);
    expect(JSON.parse(readFileSync(buildJsonPath, 'utf8'))).toEqual({ contractVersion: 1 });
  });

  it('does not write build.json when no provenance() is given', async () => {
    dir = mkdtempSync(join(tmpdir(), 'hash-output-dir-'));
    const entry = join(dir, 'main.ts');
    writeFileSync(entry, "console.log('no provenance');\n");

    await build({
      root: dir,
      logLevel: 'silent',
      build: { outDir: join('dist', '.build'), lib: { entry, formats: ['iife'], name: 'x' } },
      plugins: [hashOutputDir('.build', 'dist')],
    });

    const distDir = join(dir, 'dist');
    const hashDir = findHashDir(distDir);
    expect(existsSync(join(distDir, hashDir, 'build.json'))).toBe(false);
  });
});
