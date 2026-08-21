import { describe, expect, it } from 'vitest';
import { assertFullyScoped } from './assert-fully-scoped.ts';

describe('assertFullyScoped', () => {
  it('passes when every rule carries the prefix', () => {
    expect(() => assertFullyScoped('[data-exp="app-1"] .card{color:red}', 'app-1')).not.toThrow();
  });

  it('passes for the permitted unprefixed cases', () => {
    const css = `
      @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
      @font-face{font-family:'Test';src:url('t.woff2')}
      :root{--gap:8px}
    `;
    expect(() => assertFullyScoped(css, 'app-1')).not.toThrow();
  });

  it('fails loudly — the actual invariant, not just correct-by-convention plugin ordering — on an unprefixed rule', () => {
    expect(() => assertFullyScoped('.card{color:red}', 'app-1')).toThrow(/unprefixed/i);
  });

  it('names the offending selector in the error', () => {
    expect(() => assertFullyScoped('.leaked{color:red}', 'app-1')).toThrow(/\.leaked/);
  });
});
