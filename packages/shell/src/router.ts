export interface ParsedLocation {
  slug: string;
  /** Sub-path after the slug plus query string, never leading-slashed. */
  route: string;
}

/**
 * Query keys the shell owns (chrome visibility, and any future
 * shell-level UI state). These are never part of an app's `ctx.route`
 * and must never trigger `onRouteChange` — see M06 risk #3.
 */
export const SHELL_QUERY_KEYS = ['chrome'] as const;

/** Strips shell-owned keys, returning "" or "?key=val&...". */
export function stripShellQueryKeys(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of SHELL_QUERY_KEYS) params.delete(key);
  const remaining = params.toString();
  return remaining ? `?${remaining}` : '';
}

/** Extracts only shell-owned keys, returning "" or "?key=val&...". */
export function extractShellQueryKeys(search: string): string {
  const source = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const key of SHELL_QUERY_KEYS) {
    const value = source.get(key);
    if (value !== null) kept.set(key, value);
  }
  const result = kept.toString();
  return result ? `?${result}` : '';
}

/**
 * Parses "<basePath>/apps/<slug>/<rest>" (+ optional "?search"). Hash
 * fragments are deliberately ignored — this project routes by path, so
 * in-page hash use is left entirely to the experiment (see M05 risk #3).
 * Shell-owned query keys (e.g. `chrome`) are stripped before the search
 * string reaches `route` — a chrome toggle must never look like an app
 * route change (see M06 risk #3).
 * Returns null for anything that isn't an /apps/ path, which the caller
 * treats as the shell's own in-app 404, not a routing error.
 */
export function parseLocation(
  pathname: string,
  search: string,
  basePath: string,
): ParsedLocation | null {
  const normalizedBase = basePath.replace(/\/$/, '');
  const prefix = `${normalizedBase}/apps/`;
  if (!pathname.startsWith(prefix)) return null;

  const rest = pathname.slice(prefix.length);
  const segments = rest.split('/').filter((s) => s.length > 0);
  const slug = segments[0];
  if (!slug) return null;

  const subpath = segments.slice(1).join('/');
  const appSearch = stripShellQueryKeys(search);
  const route = subpath + appSearch;
  return { slug, route };
}

export function buildAppPath(basePath: string, slug: string, subpath: string): string {
  const normalizedBase = basePath.replace(/\/$/, '');
  const cleanSubpath = subpath.replace(/^\/+/, '');
  return `${normalizedBase}/apps/${slug}${cleanSubpath ? `/${cleanSubpath}` : ''}`;
}
