import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { RegistryEntry } from '@exp/shell';
import {
  type AppBuild,
  type AppMetadata,
  buildRegistry,
  extractHash,
  mergeEntry,
  resolveVersion,
} from './build-registry.ts';

const shared = {
  vendorUrl: '/packages/vendor/dist/vendor-AAAA.js',
  commonUrl: '/packages/common/dist/common-BBBB.js',
};

function metadata(overrides: Partial<AppMetadata> = {}): AppMetadata {
  return {
    slug: 'app-1',
    title: 'App One',
    description: 'a test app',
    tags: ['test'],
    status: 'live',
    isEnabled: true,
    lastUpdated: '2026-08-21T00:00:00.000Z',
    ...overrides,
  };
}

function build(overrides: Partial<AppBuild> = {}): AppBuild {
  return {
    hash: 'aaaa1111',
    js: '/apps/app-1/dist/aaaa1111/index.js',
    css: '/apps/app-1/dist/aaaa1111/index.css',
    contractVersion: 1,
    ...overrides,
  };
}

function prevEntry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
  return {
    slug: 'app-1',
    title: 'Old Title',
    description: 'old description',
    isEnabled: true,
    lastUpdated: '2026-01-01T00:00:00.000Z',
    vendorUrl: '/packages/vendor/dist/vendor-OLD.js',
    commonUrl: '/packages/common/dist/common-OLD.js',
    entry: { js: '/apps/app-1/dist/aaaa1111/index.js', css: '/apps/app-1/dist/aaaa1111/index.css' },
    contractVersion: 1,
    version: '0.1.0',
    tags: ['old'],
    status: 'wip',
    ...overrides,
  };
}

describe('extractHash', () => {
  it('pulls the hash segment out of an entry.js path', () => {
    expect(extractHash('/apps/app-1/dist/aaaa1111/index.js')).toBe('aaaa1111');
  });

  it('returns null for a path that does not match the hashOutputDir convention', () => {
    expect(extractHash('/packages/shell/dev/fake-app/index.js')).toBeNull();
  });
});

describe('mergeEntry', () => {
  it('a metadata-only change (unchanged hash) updates the entry without touching artifact fields', () => {
    const entry = mergeEntry(
      metadata({ title: 'New Title', tags: ['new'] }),
      build(),
      prevEntry(),
      shared,
    );
    expect(entry?.title).toBe('New Title');
    expect(entry?.tags).toEqual(['new']);
    // Artifact fields carried over from prevEntry, not from the new build.
    expect(entry?.entry).toEqual(prevEntry().entry);
    expect(entry?.contractVersion).toBe(1);
  });

  it('a rebuilt slug (changed hash) replaces artifact fields including contractVersion', () => {
    const entry = mergeEntry(
      metadata(),
      build({ hash: 'bbbb2222', js: '/apps/app-1/dist/bbbb2222/index.js', css: undefined }),
      prevEntry(),
      shared,
    );
    expect(entry?.entry).toEqual({ js: '/apps/app-1/dist/bbbb2222/index.js', css: undefined });
  });

  it('a new app with no build output is omitted entirely', () => {
    const entry = mergeEntry(metadata(), null, undefined, shared);
    expect(entry).toBeNull();
  });

  it('carries contractVersion forward from the previous entry when unchanged, never regenerating it', () => {
    const entry = mergeEntry(
      metadata(),
      build({ contractVersion: 1 }),
      prevEntry({ contractVersion: 1 }),
      shared,
    );
    expect(entry?.contractVersion).toBe(1);
  });

  it('regenerates vendorUrl/commonUrl fresh even when artifact fields are carried over', () => {
    const entry = mergeEntry(metadata(), build(), prevEntry(), shared);
    expect(entry?.vendorUrl).toBe(shared.vendorUrl);
    expect(entry?.commonUrl).toBe(shared.commonUrl);
  });

  it('treats a first-ever build (no prevEntry) as rebuilt', () => {
    const entry = mergeEntry(metadata(), build(), undefined, shared);
    expect(entry?.entry.js).toBe(build().js);
  });
});

describe('resolveVersion', () => {
  it('seeds 0.1.0 on a first-ever build', () => {
    expect(resolveVersion(metadata(), true, undefined)).toBe('0.1.0');
  });

  it('carries the version forward unchanged when the app was not rebuilt', () => {
    expect(resolveVersion(metadata(), false, prevEntry({ version: '1.4.2' }))).toBe('1.4.2');
  });

  it('auto-bumps the patch segment on rebuild for a wip/live app', () => {
    expect(resolveVersion(metadata({ status: 'wip' }), true, prevEntry({ version: '0.1.0' }))).toBe(
      '0.1.1',
    );
    expect(
      resolveVersion(metadata({ status: 'live' }), true, prevEntry({ version: '2.3.9' })),
    ).toBe('2.3.10');
  });

  it('does not auto-bump an archived app even if rebuilt', () => {
    expect(
      resolveVersion(metadata({ status: 'archived' }), true, prevEntry({ version: '1.0.0' })),
    ).toBe('1.0.0');
  });

  it('a manual override ahead of the computed value wins and becomes the new baseline', () => {
    expect(
      resolveVersion(metadata({ versionOverride: '2.0.0' }), true, prevEntry({ version: '0.1.4' })),
    ).toBe('2.0.0');
  });

  it('seeds 0.1.0 when a previous entry exists but predates the version field', () => {
    const legacyEntry = prevEntry();
    // @ts-expect-error simulating a pre-versioning registry.json on disk
    delete legacyEntry.version;
    expect(resolveVersion(metadata(), false, legacyEntry)).toBe('0.1.0');
  });

  it('a manual override behind the computed value does not win', () => {
    expect(
      resolveVersion(metadata({ versionOverride: '0.1.0' }), true, prevEntry({ version: '0.5.0' })),
    ).toBe('0.5.1');
  });
});

describe('buildRegistry (fs integration)', () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  function makeApp(
    appsDir: string,
    slug: string,
    experiment: Record<string, unknown>,
    hash?: string,
  ): void {
    const appDir = join(appsDir, slug);
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      join(appDir, 'package.json'),
      JSON.stringify({ name: `@exp/${slug}`, experiment }),
    );
    if (hash) {
      const hashDir = join(appDir, 'dist', hash);
      mkdirSync(hashDir, { recursive: true });
      writeFileSync(join(hashDir, 'index.js'), 'console.log(1);');
      writeFileSync(join(hashDir, 'build.json'), JSON.stringify({ contractVersion: 1 }));
    }
  }

  it('a deleted app (directory no longer under apps/) disappears from the registry', async () => {
    dir = mkdtempSync(join(tmpdir(), 'build-registry-'));
    const appsDir = join(dir, 'apps');
    makeApp(appsDir, 'still-here', { title: 'Still Here', tags: [], status: 'live' }, 'cccc3333');

    const prevRegistryPath = join(dir, 'prev-registry.json');
    writeFileSync(
      prevRegistryPath,
      JSON.stringify([
        prevEntry({ slug: 'still-here' }),
        prevEntry({ slug: 'gone', title: 'Gone App' }),
      ]),
    );

    const registry = await buildRegistry({
      appsDir,
      prevRegistrySource: prevRegistryPath,
      vendorUrl: shared.vendorUrl,
      commonUrl: shared.commonUrl,
    });

    expect(registry.map((e) => e.slug)).toEqual(['still-here']);
  });

  it('a new app with no build output on disk is omitted entirely', async () => {
    dir = mkdtempSync(join(tmpdir(), 'build-registry-'));
    const appsDir = join(dir, 'apps');
    makeApp(appsDir, 'unbuilt', { title: 'Unbuilt', tags: [], status: 'wip' });

    const registry = await buildRegistry({
      appsDir,
      prevRegistrySource: join(dir, 'does-not-exist.json'),
      vendorUrl: shared.vendorUrl,
      commonUrl: shared.commonUrl,
    });

    expect(registry).toEqual([]);
  });

  it('detects a rebuild by comparing the latest on-disk hash dir to the previous entry.js hash', async () => {
    dir = mkdtempSync(join(tmpdir(), 'build-registry-'));
    const appsDir = join(dir, 'apps');
    makeApp(appsDir, 'rebuilt-app', { title: 'Rebuilt App', tags: [], status: 'live' }, 'dddd4444');

    const prevRegistryPath = join(dir, 'prev-registry.json');
    writeFileSync(
      prevRegistryPath,
      JSON.stringify([
        prevEntry({
          slug: 'rebuilt-app',
          entry: { js: '/apps/rebuilt-app/dist/aaaa1111/index.js' },
        }),
      ]),
    );

    const registry = await buildRegistry({
      appsDir,
      prevRegistrySource: prevRegistryPath,
      vendorUrl: shared.vendorUrl,
      commonUrl: shared.commonUrl,
    });

    expect(registry[0]?.entry.js).toBe('/apps/rebuilt-app/dist/dddd4444/index.js');
  });

  it('an app without an explicit isEnabled field is treated as disabled', async () => {
    dir = mkdtempSync(join(tmpdir(), 'build-registry-'));
    const appsDir = join(dir, 'apps');
    makeApp(appsDir, 'no-flag', { title: 'No Flag', tags: [], status: 'live' }, 'eeee5555');
    makeApp(
      appsDir,
      'opted-in',
      { title: 'Opted In', tags: [], status: 'live', isEnabled: true },
      'ffff6666',
    );

    const registry = await buildRegistry({
      appsDir,
      prevRegistrySource: join(dir, 'does-not-exist.json'),
      vendorUrl: shared.vendorUrl,
      commonUrl: shared.commonUrl,
    });

    expect(registry.find((e) => e.slug === 'no-flag')?.isEnabled).toBe(false);
    expect(registry.find((e) => e.slug === 'opted-in')?.isEnabled).toBe(true);
  });
});
