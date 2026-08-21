import { describe, expect, it } from 'vitest';
import { collectTags, filterEntries } from './filter.ts';
import type { Registry } from './types.ts';

const registry: Registry = [
  {
    slug: 'hello-world',
    title: 'Hello World',
    description: 'A basic starter',
    isEnabled: true,
    lastUpdated: '2026-08-21T00:00:00.000Z',
    vendorUrl: '/vendor.js',
    commonUrl: '/common.js',
    entry: { js: '/hello-world/index.js' },
    contractVersion: 1,
    version: '0.1.0',
    tags: ['starter', 'react'],
    status: 'live',
  },
  {
    slug: 'old-thing',
    title: 'Old Thing',
    description: 'No longer maintained',
    isEnabled: true,
    lastUpdated: '2026-01-01T00:00:00.000Z',
    vendorUrl: '/vendor.js',
    commonUrl: '/common.js',
    entry: { js: '/old-thing/index.js' },
    contractVersion: 1,
    version: '0.1.0',
    tags: ['archive'],
    status: 'archived',
  },
  {
    slug: 'wip-thing',
    title: 'Work In Progress',
    isEnabled: true,
    lastUpdated: '2026-08-01T00:00:00.000Z',
    vendorUrl: '/vendor.js',
    commonUrl: '/common.js',
    entry: { js: '/wip-thing/index.js' },
    contractVersion: 1,
    version: '0.1.0',
    tags: ['react', 'experimental'],
    status: 'wip',
  },
];

describe('filterEntries', () => {
  it('hides archived entries by default', () => {
    const result = filterEntries(registry, { query: '', tags: [], showArchived: false });
    expect(result.map((e) => e.slug)).toEqual(['hello-world', 'wip-thing']);
  });

  it('shows archived entries when opted in', () => {
    const result = filterEntries(registry, { query: '', tags: [], showArchived: true });
    expect(result.map((e) => e.slug)).toContain('old-thing');
  });

  it('filters by search query against title/description/tags', () => {
    expect(
      filterEntries(registry, { query: 'starter', tags: [], showArchived: false }).map(
        (e) => e.slug,
      ),
    ).toEqual(['hello-world']);
    expect(
      filterEntries(registry, { query: 'experimental', tags: [], showArchived: false }).map(
        (e) => e.slug,
      ),
    ).toEqual(['wip-thing']);
  });

  it('is case-insensitive', () => {
    expect(
      filterEntries(registry, { query: 'HELLO', tags: [], showArchived: false }).map((e) => e.slug),
    ).toEqual(['hello-world']);
  });

  it('filters by tag with AND semantics', () => {
    expect(
      filterEntries(registry, { query: '', tags: ['react'], showArchived: false }).map(
        (e) => e.slug,
      ),
    ).toEqual(['hello-world', 'wip-thing']);
    expect(
      filterEntries(registry, {
        query: '',
        tags: ['react', 'starter'],
        showArchived: false,
      }).map((e) => e.slug),
    ).toEqual(['hello-world']);
  });
});

describe('collectTags', () => {
  it('returns the sorted union of all tags', () => {
    expect(collectTags(registry)).toEqual(['archive', 'experimental', 'react', 'starter']);
  });
});
