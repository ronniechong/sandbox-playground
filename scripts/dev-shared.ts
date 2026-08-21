import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = join(import.meta.dirname, '..');

function hasBuiltOutput(dir: string, prefix: string): boolean {
  return (
    existsSync(dir) && readdirSync(dir).some((f) => f.startsWith(`${prefix}-`) && f.endsWith('.js'))
  );
}

/**
 * Vendor/common are shared, page-lifetime singletons built once (see
 * AGENTS.md "additive-only shared packages") — dev mode reuses whatever
 * is already on disk rather than rebuilding on every `pnpm dev`, same as
 * `just build-shared` for a real deploy. Regenerates `dist/manifest.json`
 * every run regardless, since it's cheap and keeps it honest about
 * whatever is actually on disk right now.
 */
export function ensureSharedBuilt(): void {
  const vendorDist = join(ROOT, 'packages', 'vendor', 'dist');
  const commonDist = join(ROOT, 'packages', 'common', 'dist');

  if (!hasBuiltOutput(vendorDist, 'vendor')) {
    console.log('Building @exp/vendor (first run only)...');
    execSync('pnpm --filter @exp/vendor run build', { cwd: ROOT, stdio: 'inherit' });
  }
  if (!hasBuiltOutput(commonDist, 'common')) {
    console.log('Building @exp/common (first run only)...');
    execSync('pnpm --filter @exp/common run build', { cwd: ROOT, stdio: 'inherit' });
  }
  execSync('pnpm exec tsx scripts/vendor-hash.ts', { cwd: ROOT, stdio: 'inherit' });
}

export function appSlugs(): string[] {
  const appsDir = join(ROOT, 'apps');
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir).filter((name) => existsSync(join(appsDir, name, 'package.json')));
}

function hasBuildOutput(slug: string): boolean {
  const distDir = join(ROOT, 'apps', slug, 'dist');
  return existsSync(distDir) && readdirSync(distDir).some((name) => name !== '.build');
}

/**
 * Builds any app with no dist/ output yet. Deliberately never rebuilds
 * an app that already has output — "frozen artifacts" (AGENTS.md #1)
 * applies just as much to local dev as to deploys; a rebuild is always
 * an explicit act (`pnpm --filter @exp/<slug> run build`), never
 * something `pnpm dev` does silently on your behalf.
 */
export function buildMissingApps(slugs: string[]): void {
  for (const slug of slugs) {
    if (hasBuildOutput(slug)) continue;
    console.log(`Building apps/${slug} (no build output yet)...`);
    execSync(`pnpm --filter @exp/${slug} run build`, { cwd: ROOT, stdio: 'inherit' });
  }
}
