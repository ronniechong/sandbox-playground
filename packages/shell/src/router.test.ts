import { describe, expect, it } from 'vitest';
import {
  buildAppPath,
  extractShellQueryKeys,
  parseLocation,
  stripShellQueryKeys,
} from './router.ts';

describe('parseLocation', () => {
  it('parses a bare slug with no sub-path', () => {
    expect(
      parseLocation('/sandbox-playground/apps/hello-world', '', '/sandbox-playground'),
    ).toEqual({ slug: 'hello-world', route: '' });
  });

  it('parses a slug with a nested sub-path', () => {
    expect(
      parseLocation(
        '/sandbox-playground/apps/hello-world/settings/audio',
        '',
        '/sandbox-playground',
      ),
    ).toEqual({ slug: 'hello-world', route: 'settings/audio' });
  });

  it('treats a query-string-only change as part of the route', () => {
    expect(
      parseLocation('/sandbox-playground/apps/hello-world', '?tab=2', '/sandbox-playground'),
    ).toEqual({ slug: 'hello-world', route: '?tab=2' });
  });

  it('excludes the shell-owned "chrome" key from the route', () => {
    expect(
      parseLocation('/sandbox-playground/apps/hello-world', '?chrome=0', '/sandbox-playground'),
    ).toEqual({ slug: 'hello-world', route: '' });
  });

  it('keeps app-level query keys alongside excluding "chrome"', () => {
    expect(
      parseLocation(
        '/sandbox-playground/apps/hello-world',
        '?tab=2&chrome=0',
        '/sandbox-playground',
      ),
    ).toEqual({ slug: 'hello-world', route: '?tab=2' });
  });

  it('returns null for a path outside /apps/', () => {
    expect(parseLocation('/sandbox-playground/about', '', '/sandbox-playground')).toBeNull();
  });

  it('returns null for /apps/ with no slug', () => {
    expect(parseLocation('/sandbox-playground/apps/', '', '/sandbox-playground')).toBeNull();
    expect(parseLocation('/sandbox-playground/apps', '', '/sandbox-playground')).toBeNull();
  });

  it('works with an empty basePath', () => {
    expect(parseLocation('/apps/hello-world/x', '', '')).toEqual({
      slug: 'hello-world',
      route: 'x',
    });
  });
});

describe('buildAppPath', () => {
  it('builds a bare slug path', () => {
    expect(buildAppPath('/sandbox-playground', 'hello-world', '')).toBe(
      '/sandbox-playground/apps/hello-world',
    );
  });

  it('builds a nested sub-path, stripping a leading slash', () => {
    expect(buildAppPath('/sandbox-playground', 'hello-world', '/settings/audio')).toBe(
      '/sandbox-playground/apps/hello-world/settings/audio',
    );
  });

  it('round-trips through parseLocation', () => {
    const path = buildAppPath('/sandbox-playground', 'hello-world', 'settings/audio');
    expect(parseLocation(path, '', '/sandbox-playground')).toEqual({
      slug: 'hello-world',
      route: 'settings/audio',
    });
  });
});

describe('stripShellQueryKeys', () => {
  it('removes "chrome" but keeps other keys', () => {
    expect(stripShellQueryKeys('?chrome=0&tab=2')).toBe('?tab=2');
  });

  it('returns "" when nothing remains', () => {
    expect(stripShellQueryKeys('?chrome=0')).toBe('');
    expect(stripShellQueryKeys('')).toBe('');
  });
});

describe('extractShellQueryKeys', () => {
  it('keeps only shell-owned keys', () => {
    expect(extractShellQueryKeys('?chrome=0&tab=2')).toBe('?chrome=0');
  });

  it('returns "" when no shell-owned keys are present', () => {
    expect(extractShellQueryKeys('?tab=2')).toBe('');
    expect(extractShellQueryKeys('')).toBe('');
  });
});
