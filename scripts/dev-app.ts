import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';
import { ROOT } from './dev-shared.ts';

const PORT = 4301;

/**
 * A minimal stand-in for the shell's real MountContext (packages/shell's
 * own lifecycle.ts), adapted from the fakeCtx stub already used by every
 * app's own App.test.tsx / templates/react-tailwind's template — same
 * shape, reused rather than redefined, just wired to real browser APIs
 * (AbortController, history) instead of test doubles.
 */
function hostScript(slug: string): string {
  return `
    import '/src/mount.ts';

    const controller = new AbortController();
    const routeListeners = new Set();
    const basePath = '/apps/${slug}';

    function currentRoute() {
      const prefix = basePath + '/';
      return window.location.pathname.startsWith(prefix)
        ? window.location.pathname.slice(prefix.length)
        : '';
    }

    const ctx = {
      signal: controller.signal,
      basePath,
      assetBase: '',
      asset: (file) => \`/\${file}\`,
      get route() {
        return currentRoute();
      },
      navigate: (subpath, opts) => {
        const target = \`\${basePath}/\${subpath}\`;
        opts?.replace ? window.history.replaceState(null, '', target) : window.history.pushState(null, '', target);
        for (const cb of routeListeners) cb(currentRoute());
      },
      onRouteChange: (cb) => {
        routeListeners.add(cb);
        const unsubscribe = () => routeListeners.delete(cb);
        controller.signal.addEventListener('abort', unsubscribe);
        return unsubscribe;
      },
      theme: 'light',
      onThemeChange: () => () => {},
    };

    const exp = window.__exp && window.__exp['${slug}'];
    if (!exp) {
      throw new Error('src/mount.ts did not register window.__exp["${slug}"] — see @exp/contract');
    }
    exp.mount(document.getElementById('app'), ctx);
  `;
}

function hostHtml(slug: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>dev: ${slug}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module">${hostScript(slug)}</script>
  </body>
</html>
`;
}

/**
 * Standalone dev mode for one app, with real Vite HMR — deliberately not
 * the app's own vite.config.ts (packages/build-preset's `experiment()`
 * preset targets a production IIFE lib build, unsuitable for dev serving
 * with HMR). This runs a fresh dev-only Vite server against the same
 * source instead.
 */
export async function runDevApp(slug: string): Promise<void> {
  const appDir = join(ROOT, 'apps', slug);
  if (!existsSync(appDir)) {
    throw new Error(`No such app: apps/${slug}`);
  }

  const pkg = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8')) as {
    devDependencies?: Record<string, string>;
  };
  const usesTailwind = Boolean(pkg.devDependencies?.['@tailwindcss/vite']);
  const tailwindPlugins = usesTailwind ? [(await import('@tailwindcss/vite')).default()] : [];

  const server = await createServer({
    root: appDir,
    configFile: false,
    plugins: [react(), ...tailwindPlugins],
    server: { port: PORT },
    appType: 'custom',
  });

  server.middlewares.use(async (req, res, next) => {
    if (req.url !== '/' && req.url !== '/index.html') {
      next();
      return;
    }
    const html = await server.transformIndexHtml(req.url, hostHtml(slug));
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(html);
  });

  await server.listen();
  console.log(`\napps/${slug} standalone dev server: http://localhost:${PORT}/`);
  console.log(
    'Real Vite HMR — this bypasses the shell/loader entirely (mount.ts is imported directly).',
  );
}
