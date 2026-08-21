import type { OutputAsset, OutputBundle, OutputChunk } from 'rollup';
import { describe, expect, it } from 'vitest';
import { scopeCss } from './scope-css.ts';

function fakeAsset(fileName: string, source: string): OutputAsset {
  return {
    type: 'asset',
    fileName,
    source,
    name: undefined,
    names: [fileName],
    originalFileName: null,
    originalFileNames: [],
    needsCodeReference: false,
  } as unknown as OutputAsset;
}

describe('scopeCss', () => {
  it('rewrites CSS assets in the bundle in place and leaves non-CSS assets untouched', () => {
    const plugin = scopeCss('app-1');
    const bundle: OutputBundle = {
      'index.css': fakeAsset('index.css', '.card{color:red}'),
      'logo.png': fakeAsset('logo.png', 'binary-ish-content'),
      'index.js': { type: 'chunk', fileName: 'index.js' } as OutputChunk,
    };

    // @ts-expect-error -- generateBundle's `this` (PluginContext) isn't
    // needed by this plugin; calling the handler directly is sufficient.
    plugin.generateBundle.call({}, {}, bundle, false);

    expect((bundle['index.css'] as OutputAsset).source).toContain('[data-exp="app-1"] .card');
    expect((bundle['logo.png'] as OutputAsset).source).toBe('binary-ish-content');
  });
});
