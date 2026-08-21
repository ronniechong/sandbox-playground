import { join } from 'node:path';
import type { AcceptedPlugin } from 'postcss';
import { mergeConfig, type Plugin, type PluginOption, type UserConfig } from 'vite';
import { hashOutputDir } from './hash-output-dir.ts';
import { scopeCss } from './scope-css.ts';

export interface ExperimentOptions {
  slug: string;
  entry: string;

  /** Additional Vite plugins, e.g. `@tailwindcss/vite`. Appended after the
   * preset's own plugins — cannot displace `scopeCss` or `hashOutputDir`. */
  plugins?: PluginOption[];

  /** Authoring-time PostCSS plugins (nesting, etc). Scoping is not
   * configured through this list and cannot be removed via it — it runs
   * as a separate bundle-output Vite plugin instead (see `scopeCss`). */
  postcss?: AcceptedPlugin[];

  /** Escape hatch for genuinely unusual apps. Merged in via Vite's
   * `mergeConfig`, with preset-owned keys reapplied on top afterward. */
  vite?: UserConfig;
}

const TEMP_DIR_NAME = '.build';

/**
 * Vite config for a single experiment: an IIFE that registers itself on
 * `window.__exp[slug]`, externalized against the vendor bundle's React
 * globals, built into a content-hashed output directory, with CSS scoping
 * enforced as an invariant rather than a removable config entry.
 *
 * Uses `build.lib` rather than raw `rollupOptions.input`: Vite only emits
 * CSS as a real separate file (`lib.cssFileName`) for library builds —
 * for a plain non-lib build targeting `iife`/`umd`, Vite always injects
 * CSS via a JS-created `<style>` tag instead. Fixed filenames (not
 * `[hash]` tokens) are fine here — the whole output *directory* gets
 * hashed after the build, not individual filenames.
 *
 * Merge order: app's `vite` override merges first, then this function's
 * own config merges on top and always wins on the keys it owns
 * (`build.lib`, `rollupOptions.external`/`output`, `assetsInlineLimit`,
 * `base`) — an app cannot use `vite:` to weaken those. Plugin arrays
 * concatenate rather than replace, so `scopeCss` and `hashOutputDir` are
 * always present regardless of what an app adds.
 */
export function experiment({
  slug,
  entry,
  plugins = [],
  postcss = [],
  vite: viteOverride = {},
}: ExperimentOptions): UserConfig {
  const safeName = `__exp_${slug.replace(/[^a-zA-Z0-9_$]/g, '_')}`;

  const withAppConfig = mergeConfig(viteOverride, {
    css: {
      postcss: {
        // App-supplied authoring-time plugins only. Providing this object
        // at all (even empty) also disables Vite's postcss.config.js
        // auto-discovery, which matters since scoping must not be
        // overridable by a stray config file an app didn't mean as an
        // override.
        plugins: postcss,
      },
    },
  } satisfies UserConfig);

  const presetOwned: UserConfig = {
    base: './',
    build: {
      outDir: join('dist', TEMP_DIR_NAME),
      emptyOutDir: true,
      assetsInlineLimit: 0,
      lib: {
        entry,
        formats: ['iife'],
        // The entry has no exports (it only assigns to
        // window.__exp[slug] as a side effect), so this name is never
        // actually referenced — it just has to be syntactically legal,
        // which a slug containing a hyphen (e.g. "throwaway-app") is not.
        name: safeName,
        fileName: () => 'index.js',
        cssFileName: 'index',
      },
      rollupOptions: {
        external: ['react', 'react-dom', 'react-dom/client'],
        output: {
          assetFileNames: '[name][extname]',
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
            'react-dom/client': 'ReactDOM',
          },
        },
        // Rollup errors on a naming collision between two emitted assets
        // sharing the flat output directory — this is the enforcement
        // point for "build fails loudly on a flat-name asset collision".
        onwarn(warning, warn) {
          if (warning.code === 'FILE_NAME_CONFLICT') {
            throw new Error(warning.message);
          }
          warn(warning);
        },
      },
    },
    // hashOutputDir/scopeCss listed last so they always concatenate onto
    // (never get displaced by) whatever the app passed via `plugins`.
    plugins: [...plugins, hashOutputDir(TEMP_DIR_NAME, 'dist'), scopeCss(slug)] as Plugin[],
  };

  return mergeConfig(withAppConfig, presetOwned);
}
