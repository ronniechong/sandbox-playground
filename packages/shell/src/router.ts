export interface ParsedLocation {
  slug: string;
  /** Sub-path after the slug plus query string, never leading-slashed. */
  route: string;
}

/**
 * Parses "<basePath>/apps/<slug>/<rest>" (+ optional "?search"). Hash
 * fragments are deliberately ignored — this project routes by path, so
 * in-page hash use is left entirely to the experiment (see M05 risk #3).
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
  const route = subpath + (search ? search : '');
  return { slug, route };
}

export function buildAppPath(basePath: string, slug: string, subpath: string): string {
  const normalizedBase = basePath.replace(/\/$/, '');
  const cleanSubpath = subpath.replace(/^\/+/, '');
  return `${normalizedBase}/apps/${slug}${cleanSubpath ? `/${cleanSubpath}` : ''}`;
}
