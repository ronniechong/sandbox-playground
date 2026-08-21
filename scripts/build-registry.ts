import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Registry, RegistryEntry } from '@exp/shell';

export interface AppMetadata {
  slug: string;
  title: string;
  description?: string;
  tags: string[];
  status: 'live' | 'wip' | 'archived';
  isEnabled: boolean;
  lastUpdated: string;
  /** Manual override from package.json's experiment field, if the author set one. */
  versionOverride?: string;
}

export interface AppBuild {
  hash: string;
  js: string;
  css?: string;
  contractVersion: 1;
}

export interface SharedManifest {
  vendorUrl: string;
  commonUrl: string;
}

/**
 * Pulls the content hash out of an already-recorded entry.js URL, e.g.
 * "/apps/hello-world/dist/c52be47c/index.js" -> "c52be47c". Returns null
 * for anything that doesn't match hashOutputDir's own naming convention
 * (packages/build-preset/src/plugins/hash-output-dir.ts) — treated as "no prior
 * build to compare against", not an error.
 */
export function extractHash(entryJsPath: string): string | null {
  const match = /\/([0-9a-f]+)\/index\.js$/.exec(entryJsPath);
  return match ? match[1]! : null;
}

/** Parses a "major.minor.patch" string. Returns null for anything else (pre-release/build metadata isn't used in this project). */
function parseSemver(v: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i]! - pb[i]!;
  }
  return 0;
}

function bumpPatch(v: string): string {
  const parsed = parseSemver(v);
  if (!parsed) return v;
  const [major, minor, patch] = parsed;
  return `${major}.${minor}.${patch + 1}`;
}

/**
 * `version` is an artifact field auto-patch-bumped on rebuild, never
 * hand-maintained here — see the versioning flow in
 * milestones/07-registry-builder-dev.md's risk item 8. A manual
 * `versionOverride` from package.json wins whenever it's ahead of the
 * computed value and becomes the new baseline for future auto-bumps;
 * archived apps never auto-bump even if rebuilt (logged, not failed).
 */
export function resolveVersion(
  metadata: AppMetadata,
  rebuilt: boolean,
  prevEntry: RegistryEntry | undefined,
): string {
  let computed: string;
  if (!prevEntry || !prevEntry.version) {
    computed = '0.1.0';
  } else if (!rebuilt) {
    computed = prevEntry.version;
  } else if (metadata.status === 'archived') {
    console.warn(
      `${metadata.slug}: rebuilt while archived — version not auto-bumped. Flip status if this rebuild is intentional.`,
    );
    computed = prevEntry.version;
  } else {
    computed = bumpPatch(prevEntry.version);
  }

  const override = metadata.versionOverride;
  if (override && parseSemver(override) && compareSemver(override, computed) > 0) {
    return override;
  }
  return computed;
}

/**
 * Metadata fields are always regenerated fresh; artifact fields
 * (entry.js/css, contractVersion) are carried over from the previous
 * registry entry unless this app was rebuilt since. A rebuild is
 * detected by comparing the latest on-disk hash directory against the
 * hash implied by the previous entry's own entry.js path — never by
 * recomputing contractVersion, which must come from the build's own
 * frozen build.json (see hashOutputDir's `provenance` option).
 */
export function mergeEntry(
  metadata: AppMetadata,
  build: AppBuild | null,
  prevEntry: RegistryEntry | undefined,
  shared: SharedManifest,
): RegistryEntry | null {
  // No build output on disk at all: omit entirely, even if a previous
  // registry entry exists (its already-deployed artifacts are untouched
  // on disk; this script only affects registry.json).
  if (!build) return null;

  const prevHash = prevEntry ? extractHash(prevEntry.entry.js) : null;
  const rebuilt = prevHash !== build.hash;

  const artifact =
    rebuilt || !prevEntry
      ? { js: build.js, css: build.css, contractVersion: build.contractVersion }
      : {
          js: prevEntry.entry.js,
          css: prevEntry.entry.css,
          contractVersion: prevEntry.contractVersion,
        };

  return {
    slug: metadata.slug,
    title: metadata.title,
    description: metadata.description,
    isEnabled: metadata.isEnabled,
    lastUpdated: metadata.lastUpdated,
    vendorUrl: shared.vendorUrl,
    commonUrl: shared.commonUrl,
    entry: { js: artifact.js, css: artifact.css },
    contractVersion: artifact.contractVersion,
    version: resolveVersion(metadata, rebuilt, prevEntry),
    tags: metadata.tags,
    status: metadata.status,
  };
}

interface ExperimentField {
  title?: unknown;
  description?: unknown;
  tags?: unknown;
  status?: unknown;
  isEnabled?: unknown;
  version?: unknown;
}

/** Reads the `experiment` field from an app's package.json. Returns null for anything that isn't a valid experiment app (no package.json, no experiment field). */
export function readAppMetadata(appDir: string, slug: string): AppMetadata | null {
  const pkgPath = join(appDir, 'package.json');
  if (!existsSync(pkgPath)) return null;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { experiment?: ExperimentField };
  const experiment = pkg.experiment;
  if (!experiment || typeof experiment.title !== 'string') return null;

  return {
    slug,
    title: experiment.title,
    description: typeof experiment.description === 'string' ? experiment.description : undefined,
    tags: Array.isArray(experiment.tags)
      ? experiment.tags.filter((t) => typeof t === 'string')
      : [],
    status:
      experiment.status === 'live' || experiment.status === 'archived' ? experiment.status : 'wip',
    // Must be set explicitly per app; absent means disabled, not enabled —
    // an app is only loadable once its author opts it in.
    isEnabled: experiment.isEnabled === true,
    lastUpdated: statSync(pkgPath).mtime.toISOString(),
    versionOverride: typeof experiment.version === 'string' ? experiment.version : undefined,
  };
}

/** Finds an app's latest build output (newest hashed dist/ subdirectory) and reads its build.json provenance. Null when the app has never been built. */
export function findLatestBuild(appDir: string, slug: string, urlPrefix: string): AppBuild | null {
  const distDir = join(appDir, 'dist');
  if (!existsSync(distDir)) return null;

  const candidates = readdirSync(distDir)
    .filter((name) => name !== '.build' && existsSync(join(distDir, name, 'index.js')))
    .map((name) => ({ name, mtime: statSync(join(distDir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  const latest = candidates[0];
  if (!latest) return null;

  const hashDir = join(distDir, latest.name);
  const buildJsonPath = join(hashDir, 'build.json');
  if (!existsSync(buildJsonPath)) {
    throw new Error(
      `${slug}: dist/${latest.name} has no build.json. Rebuild with the current build-preset (pnpm --filter @exp/${slug} run build).`,
    );
  }
  const provenance = JSON.parse(readFileSync(buildJsonPath, 'utf8')) as { contractVersion: 1 };

  const base = `${urlPrefix}/${slug}/dist/${latest.name}`;
  return {
    hash: latest.name,
    js: `${base}/index.js`,
    css: existsSync(join(hashDir, 'index.css')) ? `${base}/index.css` : undefined,
    contractVersion: provenance.contractVersion,
  };
}

export async function loadPrevRegistry(source: string): Promise<Registry> {
  if (!source) return [];
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Failed to fetch previous registry from ${source}: ${res.status}`);
    return (await res.json()) as Registry;
  }
  if (!existsSync(source)) return [];
  const parsed: unknown = JSON.parse(readFileSync(source, 'utf8'));
  // Tolerates public/registry.json's own placeholder shape
  // ({ generatedAt: null, experiments: [] }) as "no previous registry"
  // rather than a schema error — it predates this script and isn't a
  // real prior build to carry artifact fields forward from.
  return Array.isArray(parsed) ? (parsed as Registry) : [];
}

export interface BuildRegistryOptions {
  appsDir: string;
  prevRegistrySource: string;
  vendorUrl: string;
  commonUrl: string;
  /** Path prefix apps are served under, e.g. "/apps" (no trailing slash). */
  urlPrefix?: string;
  /**
   * Restricts which app directories are scanned. Used by CI to build only
   * the apps rebuilt this run, without touching registry entries for apps
   * whose dist/ isn't present in a fresh checkout — those are merged back
   * in separately by the caller from the previously deployed registry.
   * Omit to scan every app directory (the local/dev-server behavior).
   */
  slugs?: string[];
}

export async function buildRegistry(options: BuildRegistryOptions): Promise<Registry> {
  const urlPrefix = options.urlPrefix ?? '/apps';
  const prevRegistry = await loadPrevRegistry(options.prevRegistrySource);
  const shared: SharedManifest = { vendorUrl: options.vendorUrl, commonUrl: options.commonUrl };

  const allSlugs = existsSync(options.appsDir)
    ? readdirSync(options.appsDir).filter((name) =>
        statSync(join(options.appsDir, name)).isDirectory(),
      )
    : [];
  const slugs = options.slugs ? allSlugs.filter((s) => options.slugs!.includes(s)) : allSlugs;

  const registry: Registry = [];
  for (const slug of slugs) {
    const appDir = join(options.appsDir, slug);
    const metadata = readAppMetadata(appDir, slug);
    if (!metadata) continue;
    const build = findLatestBuild(appDir, slug, urlPrefix);
    const prevEntry = prevRegistry.find((e) => e.slug === slug);
    const entry = mergeEntry(metadata, build, prevEntry, shared);
    if (entry) registry.push(entry);
  }
  return registry;
}

interface CliArgs {
  appsDir: string;
  prevRegistry: string;
  manifest: string;
  out: string;
  urlPrefix: string;
}

function parseCliArgs(argv: string[]): CliArgs {
  const flag = (name: string, fallback: string): string => {
    const i = argv.indexOf(`--${name}`);
    return i !== -1 && argv[i + 1] ? argv[i + 1]! : fallback;
  };
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
  return {
    appsDir: flag('apps-dir', join(ROOT, 'apps')),
    prevRegistry: flag('prev-registry', join(ROOT, 'site', 'registry.json')),
    manifest: flag('manifest', join(ROOT, 'dist', 'manifest.json')),
    out: flag('out', join(ROOT, 'site', 'registry.json')),
    urlPrefix: flag('url-prefix', '/apps'),
  };
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const manifest = JSON.parse(readFileSync(args.manifest, 'utf8')) as {
    vendor: string;
    common: string;
  };

  const registry = await buildRegistry({
    appsDir: args.appsDir,
    prevRegistrySource: args.prevRegistry,
    vendorUrl: `/packages/vendor/dist/${manifest.vendor}`,
    commonUrl: `/packages/common/dist/${manifest.common}`,
    urlPrefix: args.urlPrefix,
  });

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, JSON.stringify(registry, null, 2) + '\n');
  console.log(`Wrote ${args.out} (${registry.length} entries)`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
