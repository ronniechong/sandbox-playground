import { describe, expect, it } from 'vitest';
import { noInlineCssAssets } from './no-inline-css-assets.ts';

function transform(css: string): string | null {
  const plugin = noInlineCssAssets();
  // @ts-expect-error -- transform's `this` isn't needed by this plugin.
  const result = plugin.transform.call({}, css, 'src/index.css');
  return result ? result.code : null;
}

describe('noInlineCssAssets', () => {
  it('appends ?no-inline to a relative url() reference', () => {
    expect(transform(".dot{background-image:url('./dot.svg')}")).toBe(
      ".dot{background-image:url('./dot.svg?no-inline')}",
    );
  });

  it('leaves a reference that already has a query untouched', () => {
    const css = ".dot{background-image:url('./dot.svg?inline')}";
    expect(transform(css)).toBeNull();
  });

  it('ignores non-CSS files', () => {
    const plugin = noInlineCssAssets();
    // @ts-expect-error -- see above
    expect(plugin.transform.call({}, "url('./x.svg')", 'src/mount.ts')).toBeNull();
  });

  it('returns null (no-op) when there is nothing to rewrite', () => {
    expect(transform('.card{color:red}')).toBeNull();
  });
});
