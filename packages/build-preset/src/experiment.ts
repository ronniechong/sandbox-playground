import { join } from 'node:path';
import type { UserConfig } from 'vite';
import { hashOutputDir } from './hash-output-dir.ts';
import { scopingPlugin } from './scoping-plugin.ts';

export interface ExperimentOptions {
  slug: string;
  entry: string;
}

const TEMP_DIR_NAME = '.build';

/**
 * Vite config for a single experiment: an IIFE that registers itself on
 * `window.__exp[slug]`, externalized against the vendor bundle's React
 * globals, built into a content-hashed output directory.
 *
 * Uses `build.lib` rather than raw `rollupOptions.input`: Vite only emits
 * CSS as a real separate file (`lib.cssFileName`) for library builds —
 * for a plain non-lib build targeting `iife`/`umd`, Vite always injects
 * CSS via a JS-created `<style>` tag instead (it only extracts to a real
 * file for `es`/`cjs` output), which would violate "CSS emitted as a
 * separate file, never inlined." Fixed filenames (not `[hash]` tokens)
 * are fine here, unlike vendor/common in M02 — this milestone hashes the
 * whole output *directory* after the build, not individual filenames.
 */
export function experiment({ slug, entry }: ExperimentOptions): UserConfig {
  const safeName = `__exp_${slug.replace(/[^a-zA-Z0-9_$]/g, '_')}`;

  return {
    base: './',
    css: {
      postcss: {
        plugins: [scopingPlugin(slug)],
      },
    },
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
    plugins: [hashOutputDir(TEMP_DIR_NAME, 'dist')],
  };
}
