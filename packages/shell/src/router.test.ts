import { describe, expect, it } from 'vitest';
import { buildAppPath, parseLocation } from './router.ts';

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
