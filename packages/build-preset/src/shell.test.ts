import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
import { shell } from './shell.js';

let dir: string | undefined;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe('shell()', () => {
  it('builds a trivial entry to a valid IIFE with no externals', async () => {
    dir = mkdtempSync(join(tmpdir(), 'shell-smoke-'));
    const entry = join(dir, 'main.ts');
    writeFileSync(entry, "console.log('shell smoke test');\n");

    await build({
      root: dir,
      logLevel: 'silent',
      ...shell({ entry }),
    });

    const outDir = join(dir, 'dist');
    const files = existsSync(outDir)
      ? readFileSync(join(outDir, findShellFile(outDir)), 'utf8')
      : '';
    expect(files).toContain('(function()');
    expect(files).toContain('shell smoke test');
  });
});

function findShellFile(outDir: string): string {
  const match = readdirSync(outDir).find((f) => f.startsWith('shell-') && f.endsWith('.js'));
  if (!match) throw new Error(`No shell-*.js found in ${outDir}`);
  return match;
}
