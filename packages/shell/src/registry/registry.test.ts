import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRegistry, findEntry, isValidRegistry, RegistryFetchError } from './registry.ts';
import type { Registry, RegistryEntry } from './types.ts';

const validEntry: RegistryEntry = {
  slug: 'hello-world',
  title: 'Hello World',
  isEnabled: true,
  lastUpdated: '2026-08-21T00:00:00.000Z',
  vendorUrl: '/vendor/vendor-abc123.js',
  vendor: 'vendor-v1.js',
  common: 'common-v1.js',
  commonUrl: '/common/common-def456.js',
  entry: {
    js: '/experiments/hello-world/abc/index.js',
    css: '/experiments/hello-world/abc/index.css',
  },
  contractVersion: 1,
  version: '0.1.0',
  tags: ['demo'],
  status: 'live',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isValidRegistry', () => {
  it('accepts a well-formed registry', () => {
    expect(isValidRegistry([validEntry])).toBe(true);
  });

  it('accepts an empty registry', () => {
    expect(isValidRegistry([])).toBe(true);
  });

  it('rejects a non-array', () => {
    expect(isValidRegistry({ entries: [] })).toBe(false);
  });

  it('rejects an entry missing a required field', () => {
    const { title: _title, ...rest } = validEntry;
    expect(isValidRegistry([rest])).toBe(false);
  });

  it('rejects an entry with the wrong contractVersion', () => {
    expect(isValidRegistry([{ ...validEntry, contractVersion: 2 }])).toBe(false);
  });
});

describe('findEntry', () => {
  it('finds an entry by slug', () => {
    const registry: Registry = [validEntry];
    expect(findEntry(registry, 'hello-world')).toBe(validEntry);
  });

  it('returns undefined for an unknown slug', () => {
    expect(findEntry([validEntry], 'nope')).toBeUndefined();
  });
});

describe('fetchRegistry', () => {
  it('throws RegistryFetchError on a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    );
    await expect(fetchRegistry('/registry.json')).rejects.toThrow(RegistryFetchError);
  });

  it('throws RegistryFetchError on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('not found', { status: 404 }))),
    );
    await expect(fetchRegistry('/registry.json')).rejects.toThrow(RegistryFetchError);
  });

  it('throws RegistryFetchError on invalid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('not json', { status: 200 }))),
    );
    await expect(fetchRegistry('/registry.json')).rejects.toThrow(RegistryFetchError);
  });

  it('throws RegistryFetchError when the JSON does not match the schema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ oops: true }), { status: 200 }))),
    );
    await expect(fetchRegistry('/registry.json')).rejects.toThrow(RegistryFetchError);
  });

  it('passes cache: no-cache so registry.json is never served stale', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify([validEntry]))));
    vi.stubGlobal('fetch', fetchMock);
    await fetchRegistry('/registry.json');
    expect(fetchMock).toHaveBeenCalledWith(
      '/registry.json',
      expect.objectContaining({ cache: 'no-cache' }),
    );
  });

  it('resolves with the parsed registry on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify([validEntry])))),
    );
    await expect(fetchRegistry('/registry.json')).resolves.toEqual([validEntry]);
  });
});
