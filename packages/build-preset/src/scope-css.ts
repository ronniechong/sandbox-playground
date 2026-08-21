import postcss from 'postcss';
import type { Plugin } from 'vite';
import { assertFullyScoped } from './assert-fully-scoped.ts';
import { scopingPlugin } from './scoping-plugin.ts';

/**
 * Scoping runs as a Vite plugin on the bundled output, not as a PostCSS
 * plugin during transform. Two reasons:
 *
 * 1. An app's own `postcss`/`plugins` config, or an auto-discovered
 *    `postcss.config.js`, could otherwise silently replace or shadow a
 *    transform-time scoping plugin, producing a working build with no
 *    scoping at all.
 * 2. Ordering: a generator like Tailwind expands `@import "tailwindcss"`
 *    into utilities at build time. A plugin registered at transform time
 *    can run before that expansion and never see the generated classes.
 *    Running on the final emitted CSS guarantees scoping sees everything.
 */
export function scopeCss(slug: string): Plugin {
  return {
    name: 'exp:scope-css',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.css')) continue;
        const source = typeof file.source === 'string' ? file.source : file.source.toString();
        const { css } = postcss([scopingPlugin(slug)]).process(source, { from: undefined });
        assertFullyScoped(css, slug);
        file.source = css;
      }
    },
  };
}
