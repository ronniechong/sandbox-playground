import { afterEach, describe, expect, it } from 'vitest';
import { needsFullPageNavigation, resetLoaderStateForTests } from './loader.ts';
import type { RegistryEntry } from './types.ts';

function entry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
  return {
    slug: 'app',
    title: 'App',
    isEnabled: true,
    lastUpdated: '2026-08-21T00:00:00.000Z',
    vendorUrl: '/vendor/vendor-v1.js',
    commonUrl: '/common/common-c1.js',
    entry: { js: '/x/index.js' },
    contractVersion: 1,
    ...overrides,
  };
}

afterEach(() => {
  resetLoaderStateForTests();
});

describe('needsFullPageNavigation', () => {
  it('is false before anything has loaded', () => {
    expect(needsFullPageNavigation(entry())).toBe(false);
  });

  // Loaded-url state is set by loadVendorAndCommon (loader.ts), which
  // requires real DOM script injection to exercise end-to-end — covered
  // by the real-Chrome manual verification for this milestone. This
  // covers the pure comparison logic in isolation.
  it('has no opinion once nothing is tracked as loaded, regardless of entry urls', () => {
    expect(needsFullPageNavigation(entry({ vendorUrl: '/vendor/vendor-different.js' }))).toBe(
      false,
    );
    expect(needsFullPageNavigation(entry({ commonUrl: '/common/common-different.js' }))).toBe(
      false,
    );
  });
});
