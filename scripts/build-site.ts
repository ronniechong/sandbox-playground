import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Registry } from '@exp/shell';
import { buildRegistry, loadPrevRegistry } from './build-registry.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

interface SiteManifest {
  vendor: string;
  common: string;
  shell: { js: string; css: string | null };
  /** The `main` commit this site tree was built from — the diff base for the next run's change detection, not just informational. */
  deployedSha: string;
}

function readManifest(siteDir: string): SiteManifest | null {
  const path = join(siteDir, 'manifest.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as SiteManifest;
}

function writeManifest(siteDir: string, manifest: SiteManifest): void {
  writeFileSync(join(siteDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}

interface BundleManifest {
  current: string;
  builtAt: string;
  history: string[];
}

function readBundleManifest(siteDir: string, name: 'vendor' | 'common'): BundleManifest | null {
  const path = join(siteDir, name, 'manifest.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as BundleManifest;
}

/**
 * `current` per ADDENDUM-004 §1 — read by `pnpm status` as the "right" side
 * of vendor staleness (recorded per-app value lives in the registry's own
 * `vendor`/`common` fields, frozen at that app's last build). `history`
 * never drops an entry, matching the append-only rule for the rest of the
 * deploy tree.
 */
function writeBundleManifest(siteDir: string, name: 'vendor' | 'common', file: string): void {
  const prev = readBundleManifest(siteDir, name);
  const history = prev?.history ?? [];
  if (!history.includes(file)) history.push(file);
  mkdirSync(join(siteDir, name), { recursive: true });
  writeFileSync(
    join(siteDir, name, 'manifest.json'),
    JSON.stringify({ current: file, builtAt: new Date().toISOString(), history }, null, 2) + '\n',
  );
}

/** Copies every file in `srcDir` into `destDir`, never overwriting a name already there — dist filenames are content-hashed, so an existing name is already correct. */
function copyDirAppendOnly(srcDir: string, destDir: string): void {
  mkdirSync(destDir, { recursive: true });
  for (const file of readdirSync(srcDir)) {
    const dest = join(destDir, file);
    if (existsSync(dest)) continue;
    cpSync(join(srcDir, file), dest, { recursive: true });
  }
}

function latestHashedFile(dir: string, prefix: string, ext: string): string | undefined {
  if (!existsSync(dir)) return undefined;
  return readdirSync(dir).find((f) => f.startsWith(`${prefix}-`) && f.endsWith(ext));
}

function renderIndexHtml(basePath: string, shellJs: string, shellCss: string | null): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>🛝 Sandbox Playground</title>
    <link rel="icon" type="image/svg+xml" href="${basePath}/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
    ${shellCss ? `<link rel="stylesheet" href="${basePath}${shellCss}" />` : ''}
  </head>
  <body>
    <div id="app"></div>
    <script>
      window.__sandboxPlaygroundConfig = {
        basePath: '${basePath}',
        registryUrl: '${basePath}/registry.json',
        theme: 'light',
      };
    </script>
    <script src="${basePath}${shellJs}"></script>
  </body>
</html>
`;
}

export interface BuildSiteOptions {
  siteDir: string;
  basePath: string;
  changedApps: string[];
  rebuiltShared: boolean;
  rebuiltShell: boolean;
  mainSha: string;
}

/** Pulls the content-hash path segment out of a built asset URL, e.g. ".../dist/6ff0b51c/index.js" -> "6ff0b51c". */
function hashSegment(url: string): string {
  const parts = url.split('/');
  return parts[parts.length - 2] ?? url;
}

/**
 * Assembles the deployable site tree from this run's build output plus
 * whatever is already in `siteDir` (a checkout of the `site-state` branch).
 * Every write here is append-only for hashed paths — `manifest.json`,
 * `registry.json`, `index.html`, and `404.html` are the only mutable files,
 * since they only ever point at the latest hashed artifacts rather than
 * containing build output themselves. Returns a human-readable summary of
 * what changed this run (used as the site-state commit body).
 */
export async function buildSite(options: BuildSiteOptions): Promise<string[]> {
  const { siteDir, basePath, changedApps, rebuiltShared, rebuiltShell, mainSha } = options;
  mkdirSync(siteDir, { recursive: true });
  const summary: string[] = [];

  const prevManifest = readManifest(siteDir);
  if (!rebuiltShared && !prevManifest) {
    throw new Error(
      `${siteDir}/manifest.json is missing and vendor/common weren't rebuilt this run — ` +
        'the site-state branch must be bootstrapped with an initial vendor/common build first.',
    );
  }
  if (!rebuiltShell && !prevManifest) {
    throw new Error(
      `${siteDir}/manifest.json is missing and shell wasn't rebuilt this run — ` +
        'the site-state branch must be bootstrapped with an initial shell build first.',
    );
  }

  let vendorFile = prevManifest?.vendor;
  let commonFile = prevManifest?.common;
  if (rebuiltShared) {
    copyDirAppendOnly(
      join(ROOT, 'packages', 'vendor', 'dist'),
      join(siteDir, 'packages', 'vendor', 'dist'),
    );
    copyDirAppendOnly(
      join(ROOT, 'packages', 'common', 'dist'),
      join(siteDir, 'packages', 'common', 'dist'),
    );
    vendorFile = latestHashedFile(join(ROOT, 'packages', 'vendor', 'dist'), 'vendor', '.js');
    commonFile = latestHashedFile(join(ROOT, 'packages', 'common', 'dist'), 'common', '.js');
    if (!vendorFile || !commonFile) {
      throw new Error('vendor/common were marked rebuilt but no vendor-*.js/common-*.js found.');
    }
    writeBundleManifest(siteDir, 'vendor', vendorFile);
    writeBundleManifest(siteDir, 'common', commonFile);
    summary.push(
      prevManifest
        ? `shared: ${prevManifest.vendor} -> ${vendorFile}, ${prevManifest.common} -> ${commonFile}`
        : `shared: ${vendorFile}, ${commonFile} (initial)`,
    );
  }
  if (!vendorFile || !commonFile) {
    throw new Error('No vendor/common build available (neither rebuilt nor in prior manifest).');
  }

  let shellJs = prevManifest?.shell.js;
  let shellCss = prevManifest?.shell.css ?? null;
  if (rebuiltShell) {
    copyDirAppendOnly(
      join(ROOT, 'packages', 'shell', 'dist'),
      join(siteDir, 'packages', 'shell', 'dist'),
    );
    const js = latestHashedFile(join(ROOT, 'packages', 'shell', 'dist'), 'shell', '.js');
    if (!js) throw new Error('Shell was marked rebuilt but no shell-*.js found.');
    shellJs = `/packages/shell/dist/${js}`;
    const css = latestHashedFile(join(ROOT, 'packages', 'shell', 'dist'), 'shell', '.css');
    shellCss = css ? `/packages/shell/dist/${css}` : null;
    summary.push(
      prevManifest?.shell.js
        ? `shell: ${prevManifest.shell.js} -> ${shellJs}`
        : `shell: ${shellJs} (initial)`,
    );
  }
  if (!shellJs) {
    throw new Error('No shell build available (neither rebuilt nor in prior manifest).');
  }

  writeManifest(siteDir, {
    vendor: vendorFile,
    common: commonFile,
    shell: { js: shellJs, css: shellCss },
    deployedSha: mainSha,
  });

  for (const slug of changedApps) {
    const appDist = join(ROOT, 'apps', slug, 'dist');
    if (!existsSync(appDist)) continue;
    const destDist = join(siteDir, 'apps', slug, 'dist');
    for (const name of readdirSync(appDist)) {
      if (name === '.build') continue;
      const src = join(appDist, name);
      if (!statSync(src).isDirectory()) continue;
      const dest = join(destDist, name);
      if (existsSync(dest)) continue;
      mkdirSync(destDist, { recursive: true });
      cpSync(src, dest, { recursive: true });
    }
  }

  const registryPath = join(siteDir, 'registry.json');
  const prevRegistry = await loadPrevRegistry(registryPath);
  const changedEntries: Registry = await buildRegistry({
    appsDir: join(ROOT, 'apps'),
    prevRegistrySource: registryPath,
    vendorUrl: `${basePath}/packages/vendor/dist/${vendorFile}`,
    commonUrl: `${basePath}/packages/common/dist/${commonFile}`,
    urlPrefix: `${basePath}/apps`,
    slugs: changedApps,
  });

  const prevBySlug = new Map(prevRegistry.map((e) => [e.slug, e]));
  const merged = new Map(prevBySlug);
  for (const entry of changedEntries) {
    const prevEntry = prevBySlug.get(entry.slug);
    summary.push(
      prevEntry
        ? `app ${entry.slug}: ${hashSegment(prevEntry.entry.js)} -> ${hashSegment(entry.entry.js)} (v${entry.version})`
        : `app ${entry.slug}: ${hashSegment(entry.entry.js)} (new, v${entry.version})`,
    );
    merged.set(entry.slug, entry);
  }
  const registry = [...merged.values()];
  writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');

  writeFileSync(join(siteDir, 'index.html'), renderIndexHtml(basePath, shellJs, shellCss));
  copyFileSync(join(ROOT, 'public', '404.html'), join(siteDir, '404.html'));
  if (existsSync(join(ROOT, 'public', 'favicon.svg'))) {
    copyFileSync(join(ROOT, 'public', 'favicon.svg'), join(siteDir, 'favicon.svg'));
  }

  console.log(
    `Assembled ${siteDir}: ${registry.length} registry entr${registry.length === 1 ? 'y' : 'ies'}, ${changedApps.length} app(s) touched this run.`,
  );
  for (const line of summary) console.log(`  ${line}`);
  return summary;
}

interface CliArgs {
  siteDir: string;
  basePath: string;
  changedApps: string[];
  rebuiltShared: boolean;
  rebuiltShell: boolean;
  mainSha: string;
  summaryFile: string;
}

function parseCliArgs(argv: string[]): CliArgs {
  const flag = (name: string, fallback: string): string => {
    const i = argv.indexOf(`--${name}`);
    return i !== -1 && argv[i + 1] ? argv[i + 1]! : fallback;
  };
  const flagBool = (name: string): boolean => argv.includes(`--${name}`);
  const appsArg = flag('changed-apps', '');
  return {
    siteDir: flag('site', join(ROOT, 'site')),
    basePath: flag('base-path', '/sandbox-playground'),
    changedApps: appsArg
      ? appsArg
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    rebuiltShared: flagBool('rebuilt-shared'),
    rebuiltShell: flagBool('rebuilt-shell'),
    mainSha: flag('main-sha', ''),
    summaryFile: flag('summary-file', ''),
  };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const { summaryFile, ...args } = parseCliArgs(process.argv.slice(2));
  buildSite(args)
    .then((summary) => {
      if (summaryFile)
        writeFileSync(summaryFile, summary.join('\n') + (summary.length ? '\n' : ''));
    })
    .catch((err: unknown) => {
      console.error(err);
      process.exitCode = 1;
    });
}
