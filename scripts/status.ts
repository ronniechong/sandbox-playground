import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitTreeSha } from '@exp/build-preset';
import { CONTRACT_VERSION } from '@exp/contract';
import type { Registry } from '@exp/shell';
import { extractHash } from './build-registry.ts';

type Severity = 'error' | 'warning' | 'info';
type Kind = 'source' | 'vendor' | 'toolchain' | 'contract' | 'version';

export interface StalenessFinding {
  kind: Kind;
  severity: Severity;
  detail: string;
}

export interface AppStatus {
  slug: string;
  version: string;
  builtAt: string;
  findings: StalenessFinding[];
}

interface BuildProvenance {
  contractVersion?: number;
  sourceTree?: string;
  toolchainTrees?: Record<string, string | undefined>;
}

interface BundleManifest {
  current: string;
}

const TOOLCHAIN_PACKAGES = ['contract', 'reset', 'build-preset'] as const;

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function readProvenance(siteDir: string, slug: string, entryJs: string): BuildProvenance | null {
  const hash = extractHash(entryJs);
  if (!hash) return null;
  return readJson<BuildProvenance>(join(siteDir, 'apps', slug, 'dist', hash, 'build.json'));
}

export interface CheckOptions {
  siteDir: string;
  repoRoot: string;
  /** Git ref "current" values are read against. Defaults to HEAD (main); a PR-triggered run passes the PR head commit so staleness reflects that PR's tree, not main's. Per ADDENDUM-004 §1: never the dirty working tree. */
  ref: string;
}

/**
 * Five staleness kinds per ADDENDUM-004 §1. Each recorded ("left") value
 * comes from the deployed artifact's own frozen `build.json`/registry
 * entry — never recomputed — compared against a "right" value read fresh
 * at `options.ref`. A side that can't be resolved (missing build.json,
 * unresolvable git tree — e.g. a shallow clone) is reported as its own
 * info-level finding rather than silently treated as "not stale".
 */
export function checkApp(entry: Registry[number], options: CheckOptions): AppStatus {
  const { siteDir, repoRoot, ref } = options;
  const findings: StalenessFinding[] = [];
  const provenance = readProvenance(siteDir, entry.slug, entry.entry.js);

  let sourceStale = false;
  if (!provenance || provenance.sourceTree === undefined) {
    findings.push({ kind: 'source', severity: 'info', detail: 'no recorded source tree' });
  } else {
    const current = gitTreeSha(`apps/${entry.slug}`, { cwd: repoRoot, rev: ref });
    if (current === undefined) {
      findings.push({
        kind: 'source',
        severity: 'info',
        detail: 'current source tree unresolvable',
      });
    } else if (current !== provenance.sourceTree) {
      sourceStale = true;
      findings.push({
        kind: 'source',
        severity: 'error',
        detail: 'source changed since last build',
      });
    }
  }

  const vendorManifest = readJson<BundleManifest>(join(siteDir, 'vendor', 'manifest.json'));
  const commonManifest = readJson<BundleManifest>(join(siteDir, 'common', 'manifest.json'));
  const vendorDrift: string[] = [];
  if (vendorManifest && entry.vendor !== vendorManifest.current) {
    vendorDrift.push(`vendor ${entry.vendor} -> ${vendorManifest.current}`);
  }
  if (commonManifest && entry.common !== commonManifest.current) {
    vendorDrift.push(`common ${entry.common} -> ${commonManifest.current}`);
  }
  if (vendorDrift.length > 0) {
    findings.push({ kind: 'vendor', severity: 'info', detail: vendorDrift.join(', ') });
  }

  if (provenance?.toolchainTrees) {
    const drifted: string[] = [];
    for (const pkg of TOOLCHAIN_PACKAGES) {
      const recorded = provenance.toolchainTrees[pkg];
      const current = gitTreeSha(`packages/${pkg}`, { cwd: repoRoot, rev: ref });
      if (recorded !== undefined && current !== undefined && recorded !== current) {
        drifted.push(pkg);
      }
    }
    if (drifted.length > 0) {
      findings.push({ kind: 'toolchain', severity: 'info', detail: drifted.join(', ') });
    }
  }

  if (
    provenance &&
    typeof provenance.contractVersion === 'number' &&
    provenance.contractVersion < CONTRACT_VERSION
  ) {
    findings.push({
      kind: 'contract',
      severity: 'info',
      detail: `contract v${provenance.contractVersion} -> v${CONTRACT_VERSION}`,
    });
  }

  // Derived, not independent: version can only be drifted if source is
  // stale, since the version field only ever moves on a rebuild.
  if (sourceStale) {
    findings.push({
      kind: 'version',
      severity: 'warning',
      detail: `deployed version ${entry.version} predates the unbuilt source change`,
    });
  }

  return { slug: entry.slug, version: entry.version, builtAt: entry.lastUpdated, findings };
}

export function checkAll(registry: Registry, options: CheckOptions): AppStatus[] {
  return registry.map((entry) => checkApp(entry, options));
}

const SEVERITY_LABEL: Record<Severity, string> = { error: 'ERROR', warning: 'WARN', info: 'info' };

export function renderStatusTable(statuses: AppStatus[]): string {
  if (statuses.length === 0) return '_No apps in the deployed registry yet._\n';

  const header = '| slug | version | built | staleness |\n|---|---|---|---|\n';
  const rows = statuses
    .map((s) => {
      const cell =
        s.findings.length === 0
          ? '_up to date_'
          : s.findings
              .map((f) => `**${SEVERITY_LABEL[f.severity]}** ${f.kind}: ${f.detail}`)
              .join('<br>');
      return `| ${s.slug} | ${s.version} | ${s.builtAt} | ${cell} |`;
    })
    .join('\n');
  return header + rows + '\n';
}

interface CliArgs {
  registry: string;
  siteDir: string;
  repoRoot: string;
  ref: string;
  json: boolean;
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
    ref: flag('ref', 'HEAD'),
    json: argv.includes('--json'),
  };
}

function main(): void {
  const args = parseCliArgs(process.argv.slice(2));
  const registry = readJson<Registry>(args.registry) ?? [];
  const statuses = checkAll(registry, {
    siteDir: args.siteDir,
    repoRoot: args.repoRoot,
    ref: args.ref,
  });

  if (args.json) {
    console.log(JSON.stringify(statuses, null, 2));
  } else {
    console.log(`## App status (against ${args.ref})\n`);
    console.log(renderStatusTable(statuses));
    console.log(
      "`pnpm status` always reports against committed state, never a dirty working tree, so its answer matches what CI would say. Vendor/toolchain/contract findings are informational; only 'source' is actionable.",
    );
  }

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath && !args.json) {
    appendFileSync(
      summaryPath,
      `## App status (against ${args.ref})\n\n${renderStatusTable(statuses)}\n`,
    );
  }
}

// Reporting tool — never gates CI, so this always exits 0 regardless of
// what it finds. A non-zero exit would invite gating on it, which
// contradicts frozen artifacts.
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
