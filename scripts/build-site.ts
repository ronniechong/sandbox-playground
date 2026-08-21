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

/**
 * Assembles the deployable site tree from this run's build output plus
 * whatever is already in `siteDir` (a checkout of the `site-state` branch).
 * Every write here is append-only for hashed paths — `manifest.json`,
 * `registry.json`, `index.html`, and `404.html` are the only mutable files,
 * since they only ever point at the latest hashed artifacts rather than
 * containing build output themselves.
 */
export async function buildSite(options: BuildSiteOptions): Promise<void> {
  const { siteDir, basePath, changedApps, rebuiltShared, rebuiltShell, mainSha } = options;
  mkdirSync(siteDir, { recursive: true });

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

  const merged = new Map(prevRegistry.map((e) => [e.slug, e]));
  for (const entry of changedEntries) merged.set(entry.slug, entry);
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
}

interface CliArgs {
  siteDir: string;
  basePath: string;
  changedApps: string[];
  rebuiltShared: boolean;
  rebuiltShell: boolean;
  mainSha: string;
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
  };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const args = parseCliArgs(process.argv.slice(2));
  buildSite(args).catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
