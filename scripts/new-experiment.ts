import { execSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_DIR = join(ROOT, 'templates', 'react-tailwind');
const APPS_DIR = join(ROOT, 'apps');
const UI_DIR = join(ROOT, 'packages', 'ui', 'src');

const RESERVED_SLUGS = new Set(['apps', 'index', '404']);
const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;

interface Options {
  slug: string;
  with: string[];
  withMsw: boolean;
  noTailwind: boolean;
}

function parseArgs(argv: string[]): Options {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const slug = positional[0];
  if (!slug) {
    console.error('Usage: pnpm new <slug> [--with <name,name>] [--with-msw] [--no-tailwind]');
    process.exit(1);
  }

  const withIndex = argv.indexOf('--with');
  const withList = withIndex !== -1 && argv[withIndex + 1] ? argv[withIndex + 1]!.split(',') : [];

  return {
    slug,
    with: withList,
    withMsw: argv.includes('--with-msw'),
    noTailwind: argv.includes('--no-tailwind'),
  };
}

function validateSlug(slug: string): void {
  if (!SLUG_PATTERN.test(slug)) {
    console.error(
      `Invalid slug "${slug}": must match ${SLUG_PATTERN} (lowercase, starts with a letter).`,
    );
    process.exit(1);
  }
  if (RESERVED_SLUGS.has(slug)) {
    console.error(`"${slug}" is a reserved slug and can't be used for an experiment.`);
    process.exit(1);
  }
  if (existsSync(join(APPS_DIR, slug))) {
    console.error(`apps/${slug} already exists.`);
    process.exit(1);
  }
}

function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ');
}

function copyTemplate(destDir: string, replacements: Record<string, string>): void {
  mkdirSync(destDir, { recursive: true });

  function walk(srcDir: string, relPath: string) {
    for (const entry of readdirSync(srcDir)) {
      const srcPath = join(srcDir, entry);
      const destPath = join(destDir, relPath, entry);
      if (statSync(srcPath).isDirectory()) {
        mkdirSync(destPath, { recursive: true });
        walk(srcPath, join(relPath, entry));
        continue;
      }
      const isText = /\.(ts|tsx|json|css|md)$/.test(entry);
      if (isText) {
        let content = readFileSync(srcPath, 'utf8');
        for (const [token, value] of Object.entries(replacements)) {
          content = content.replaceAll(token, value);
        }
        mkdirSync(dirname(destPath), { recursive: true });
        writeFileSync(destPath, content);
      } else {
        mkdirSync(dirname(destPath), { recursive: true });
        copyFileSync(srcPath, destPath);
      }
    }
  }

  walk(TEMPLATE_DIR, '');
}

function applyWithComponents(destDir: string, names: string[]): void {
  if (names.length === 0) return;
  const uiDestDir = join(destDir, 'src', 'ui');
  mkdirSync(uiDestDir, { recursive: true });
  for (const name of names) {
    const srcFile = join(UI_DIR, `${name}.tsx`);
    if (!existsSync(srcFile)) {
      console.error(`--with "${name}": no such component at packages/ui/src/${name}.tsx`);
      process.exit(1);
    }
    copyFileSync(srcFile, join(uiDestDir, `${name}.tsx`));
  }
}

function applyNoTailwind(destDir: string): void {
  const pkgPath = join(destDir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  delete pkg.devDependencies['@tailwindcss/vite'];
  delete pkg.devDependencies['tailwindcss'];
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  writeFileSync(join(destDir, 'src', 'index.css'), "@import '@exp/reset';\n");

  const viteConfigPath = join(destDir, 'vite.config.ts');
  let viteConfig = readFileSync(viteConfigPath, 'utf8');
  viteConfig = viteConfig
    .replace("import tailwindcss from '@tailwindcss/vite';\n", '')
    .replace('plugins: [tailwindcss()],\n', '')
    .replace(',\n    plugins: [],', '');
  writeFileSync(viteConfigPath, viteConfig);
}

function applyMsw(destDir: string, slug: string): void {
  const mocksDir = join(destDir, 'src', 'mocks');
  mkdirSync(mocksDir, { recursive: true });
  writeFileSync(
    join(mocksDir, 'handlers.ts'),
    "import { http, HttpResponse } from 'msw';\n\nexport const handlers = [\n  // http.get('/api/example', () => HttpResponse.json({ ok: true })),\n];\n",
  );
  writeFileSync(
    join(mocksDir, 'browser.ts'),
    "import { setupWorker } from 'msw/browser';\nimport { handlers } from './handlers.js';\n\nexport const worker = setupWorker(...handlers);\n",
  );

  const pkgPath = join(destDir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.devDependencies.msw = 'catalog:';
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  const mountPath = join(destDir, 'src', 'mount.ts');
  let mount = readFileSync(mountPath, 'utf8');
  mount = mount.replace(
    "import './index.css';",
    "import './index.css';\nimport { worker } from './mocks/browser.js';",
  );
  mount = mount.replace(
    'function mount(el: HTMLElement, ctx: MountContext) {\n  root = createRoot(el);\n  root.render(createElement(App, { ctx }));\n}',
    `function mount(el: HTMLElement, ctx: MountContext) {\n  void worker.start({ serviceWorker: { url: \`\${ctx.basePath}/mockServiceWorker.js\` } });\n  root = createRoot(el);\n  root.render(createElement(App, { ctx }));\n}`,
  );
  mount = mount.replace(
    'function unmount() {\n  root?.unmount();\n  root = null;\n}',
    'function unmount() {\n  worker.stop();\n  root?.unmount();\n  root = null;\n}',
  );
  writeFileSync(mountPath, mount);

  void slug;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  validateSlug(options.slug);

  const destDir = join(APPS_DIR, options.slug);
  copyTemplate(destDir, {
    __SLUG__: options.slug,
    __TITLE__: titleFromSlug(options.slug),
  });

  applyWithComponents(destDir, options.with);
  if (options.noTailwind) applyNoTailwind(destDir);
  if (options.withMsw) applyMsw(destDir, options.slug);

  execSync(`pnpm exec prettier --write "${destDir}"`, { cwd: ROOT, stdio: 'ignore' });

  console.log(`Created apps/${options.slug}. Installing dependencies...`);
  execSync('pnpm install', { cwd: ROOT, stdio: 'inherit' });

  if (options.withMsw) {
    // Run after install so the msw package (and its bundled CLI) is
    // actually resolvable from this app's directory.
    execSync('npx msw init public --no-save', { cwd: destDir, stdio: 'inherit' });
  }

  console.log(`\nDone. Try: pnpm --filter @exp/${options.slug} build`);
}

main();
