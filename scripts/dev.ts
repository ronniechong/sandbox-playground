import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRegistry } from './build-registry.ts';
import { appSlugs, buildMissingApps, ensureSharedBuilt, ROOT } from './dev-shared.ts';
import { startStaticServer } from './static-server.ts';
import { runDevApp } from './dev-app.ts';

const PORT = 4300;

function ensureShellBuilt(): void {
  const shellDist = join(ROOT, 'packages', 'shell', 'dist');
  const hasBuild =
    existsSync(shellDist) && readdirSync(shellDist).some((f) => f.startsWith('shell-'));
  if (hasBuild) return;
  console.log('Building @exp/shell (first run only)...');
  execSync('pnpm --filter @exp/shell run build', { cwd: ROOT, stdio: 'inherit' });
}

function findShellAssets(): { js: string; css: string | null } {
  const shellDist = join(ROOT, 'packages', 'shell', 'dist');
  const files = readdirSync(shellDist);
  const js = files.find((f) => f.startsWith('shell-') && f.endsWith('.js'));
  if (!js) throw new Error(`No shell-*.js found in ${shellDist}`);
  const css = files.find((f) => f.startsWith('shell-') && f.endsWith('.css')) ?? null;
  return { js: `/packages/shell/dist/${js}`, css: css ? `/packages/shell/dist/${css}` : null };
}

function renderHomeHtml(shellJs: string, shellCss: string | null): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>sandbox-playground (dev)</title>
    ${shellCss ? `<link rel="stylesheet" href="${shellCss}" />` : ''}
  </head>
  <body>
    <div id="app"></div>
    <script>
      window.__sandboxPlaygroundConfig = {
        basePath: '',
        registryUrl: '/registry.json',
        theme: 'light',
      };
    </script>
    <script src="${shellJs}"></script>
  </body>
</html>
`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const appIndex = args.indexOf('--app');
  if (appIndex !== -1) {
    const slug = args[appIndex + 1];
    if (!slug) {
      console.error('Usage: pnpm dev --app <slug>');
      process.exitCode = 1;
      return;
    }
    await runDevApp(slug);
    return;
  }

  ensureSharedBuilt();
  ensureShellBuilt();
  buildMissingApps(appSlugs());

  const manifest = JSON.parse(readFileSync(join(ROOT, 'dist', 'manifest.json'), 'utf8')) as {
    vendor: string;
    common: string;
  };

  // site/ is this project's local build-output convention (gitignored,
  // same directory a real deploy would populate) — writing here rather
  // than holding the registry in memory lets it double as the
  // prevRegistrySource for the next run's merge, and makes the generated
  // output inspectable on disk like every other build artifact.
  const siteDir = join(ROOT, 'site');
  const registryPath = join(siteDir, 'registry.json');

  const registry = await buildRegistry({
    appsDir: join(ROOT, 'apps'),
    prevRegistrySource: registryPath,
    vendorUrl: `/packages/vendor/dist/${manifest.vendor}`,
    commonUrl: `/packages/common/dist/${manifest.common}`,
  });

  mkdirSync(siteDir, { recursive: true });
  writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');

  const { js: shellJs, css: shellCss } = findShellAssets();

  startStaticServer(
    ROOT,
    [
      {
        path: '/',
        contentType: 'text/html; charset=utf-8',
        body: () => renderHomeHtml(shellJs, shellCss),
      },
      {
        path: '/registry.json',
        contentType: 'application/json',
        body: () => readFileSync(registryPath, 'utf8'),
      },
    ],
    PORT,
  );

  console.log(`\nsandbox-playground dev server: http://localhost:${PORT}/`);
  console.log(
    `Registry: ${registry.length} app(s) — ${registry.map((e) => e.slug).join(', ') || '(none)'}`,
  );
  console.log(
    'New app built with no output? Run its build, then restart this server to pick it up.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
