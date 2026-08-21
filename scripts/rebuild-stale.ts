import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import type { Registry } from '@exp/shell';
import { checkAll } from './status.ts';

interface CliArgs {
  registry: string;
  siteDir: string;
  repoRoot: string;
  dryRun: boolean;
}

function parseCliArgs(argv: string[]): CliArgs {
  const flag = (name: string, fallback: string): string => {
    const i = argv.indexOf(`--${name}`);
    return i !== -1 && argv[i + 1] ? argv[i + 1]! : fallback;
  };
  return {
    registry: flag('registry', join('site', 'registry.json')),
    siteDir: flag('site-dir', 'site'),
    repoRoot: flag('repo-root', '.'),
    dryRun: argv.includes('--dry-run'),
  };
}

/** Rebuilds every app whose `pnpm status` shows error-level ("source") staleness. Local convenience wrapper — CI never calls this; rebuilds are always an explicit human act per the frozen-artifacts principle. */
function main(): void {
  const args = parseCliArgs(process.argv.slice(2));
  const registry = JSON.parse(readFileSync(args.registry, 'utf8')) as Registry;
  const statuses = checkAll(registry, {
    siteDir: args.siteDir,
    repoRoot: args.repoRoot,
    ref: 'HEAD',
  });
  const staleSlugs = statuses
    .filter((s) => s.findings.some((f) => f.kind === 'source' && f.severity === 'error'))
    .map((s) => s.slug);

  if (staleSlugs.length === 0) {
    console.log('No source-stale apps.');
    return;
  }

  console.log(`Source-stale: ${staleSlugs.join(', ')}`);
  if (args.dryRun) return;

  for (const slug of staleSlugs) {
    console.log(`Rebuilding ${slug}...`);
    execFileSync('pnpm', ['--filter', `@exp/${slug}`, 'run', 'build'], { stdio: 'inherit' });
  }
}

main();
