import { describe, expect, it } from 'vitest';
import { isChromeHidden, withChromeHidden } from './chrome-state.ts';

describe('isChromeHidden', () => {
  it('is true for chrome=0', () => {
    expect(isChromeHidden('?chrome=0')).toBe(true);
  });

  it('is false when chrome is absent or any other value', () => {
    expect(isChromeHidden('')).toBe(false);
    expect(isChromeHidden('?tab=2')).toBe(false);
    expect(isChromeHidden('?chrome=1')).toBe(false);
  });
});

describe('withChromeHidden', () => {
  it('adds chrome=0 when hiding', () => {
    expect(withChromeHidden('', true)).toBe('?chrome=0');
  });

  it('preserves other params when hiding', () => {
    expect(withChromeHidden('?tab=2', true)).toBe('?tab=2&chrome=0');
  });

  it('removes chrome when showing', () => {
    expect(withChromeHidden('?chrome=0&tab=2', false)).toBe('?tab=2');
  });

  it('returns "" when nothing remains', () => {
    expect(withChromeHidden('?chrome=0', false)).toBe('');
  });
});
