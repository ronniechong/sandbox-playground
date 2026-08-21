import type { Plugin } from 'vite';

const RELATIVE_URL = /url\((\s*['"]?)(\.\.?\/[^'"()]+)(['"]?\s*)\)/g;

/**
 * Vite's `build.lib` mode unconditionally inlines every referenced asset
 * as a data URI, regardless of `assetsInlineLimit` — that check happens
 * before the limit is even consulted. The only per-reference escape
 * hatch is a `?no-inline` query suffix, which would otherwise mean every
 * app author has to remember special CSS syntax just to get the "assets
 * are never inlined" guarantee this preset is supposed to provide by
 * default. This rewrites relative CSS url() references to carry that
 * suffix automatically, before Vite's own asset plugin resolves them.
 */
export function noInlineCssAssets(): Plugin {
  return {
    name: 'exp:no-inline-css-assets',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.css')) return null;
      let changed = false;
      const rewritten = code.replace(RELATIVE_URL, (match, pre, url, post) => {
        if (url.includes('?')) return match;
        changed = true;
        return `url(${pre}${url}?no-inline${post})`;
      });
      return changed ? { code: rewritten, map: null } : null;
    },
  };
}
