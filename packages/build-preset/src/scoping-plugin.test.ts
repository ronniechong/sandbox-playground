import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import { scopingPlugin } from './scoping-plugin.js';

async function run(css: string): Promise<string> {
  const result = await postcss([scopingPlugin('my-app')]).process(css, { from: undefined });
  return result.css;
}

describe('scopingPlugin', () => {
  it('emits both self and descendant forms for the universal selector', async () => {
    const out = await run('*, *::before, *::after { box-sizing: border-box; }');
    expect(out).toContain('[data-exp="my-app"]');
    expect(out).toContain('[data-exp="my-app"] *');
    // *::before / *::after are not the bare universal selector, so they
    // just get the ordinary descendant-prefix treatment.
    expect(out).toContain('[data-exp="my-app"] *::before');
    expect(out).toContain('[data-exp="my-app"] *::after');
  });

  it('rewrites html/body to the prefix instead of nesting them under it', async () => {
    const out = await run('html, body { height: 100%; }');
    expect(out).toContain('[data-exp="my-app"] {');
    expect(out).not.toContain('[data-exp="my-app"] html');
    expect(out).not.toContain('[data-exp="my-app"] body');
  });

  it('passes @keyframes, @font-face, and :root through unprefixed', async () => {
    const out = await run(`
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @font-face { font-family: 'Test'; src: url('test.woff2'); }
      :root { --gap: 8px; }
    `);
    expect(out).toContain('@keyframes spin');
    expect(out).toMatch(/from\s*{\s*transform: rotate\(0deg\);\s*}/);
    expect(out).not.toContain('[data-exp="my-app"] from');
    expect(out).toContain('@font-face');
    expect(out).toContain(':root {');
    expect(out).not.toContain('[data-exp="my-app"] :root');
  });

  it('prefixes ordinary selectors with a descendant combinator', async () => {
    const out = await run('.card { color: red; }');
    expect(out).toContain('[data-exp="my-app"] .card');
  });
});
