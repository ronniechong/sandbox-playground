import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Registry } from '@exp/shell';

/**
 * Non-blocking status table: how long ago each deployed app's registry
 * entry was last updated. Reads only the already-merged `site-state`
 * checkout — never the workspace's own build output, since an app not
 * rebuilt this run has no local dist to read from.
 */
export function renderStalenessTable(registry: Registry, now: Date = new Date()): string {
  if (registry.length === 0) {
    return '_No apps in the deployed registry yet._\n';
  }

  const rows = registry
    .map((entry) => {
      const lastUpdated = new Date(entry.lastUpdated);
      const days = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
      return { entry, days };
    })
    .sort((a, b) => b.days - a.days);

  const header = '| slug | status | version | last updated | age (days) |\n|---|---|---|---|---|\n';
  const body = rows
    .map(
      ({ entry, days }) =>
        `| ${entry.slug} | ${entry.status} | ${entry.version} | ${entry.lastUpdated} | ${days} |`,
    )
    .join('\n');
  return header + body + '\n';
}

interface CliArgs {
  registry: string;
}

function parseCliArgs(argv: string[]): CliArgs {
  const flag = (name: string, fallback: string): string => {
    const i = argv.indexOf(`--${name}`);
    return i !== -1 && argv[i + 1] ? argv[i + 1]! : fallback;
  };
  return { registry: flag('registry', join('site', 'registry.json')) };
}

function main(): void {
  const args = parseCliArgs(process.argv.slice(2));
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;

  let table: string;
  if (!existsSync(args.registry)) {
    table = `_No deployed registry found at ${args.registry}._\n`;
  } else {
    const registry = JSON.parse(readFileSync(args.registry, 'utf8')) as Registry;
    table = renderStalenessTable(registry);
  }

  const output = `## App staleness\n\n${table}`;
  console.log(output);
  if (summaryPath) {
    appendFileSync(summaryPath, output + '\n');
  }
}

try {
  main();
} catch (err) {
  // Never fails the run — staleness reporting is informational only.
  console.error(err);
}
