export interface RegistryEntry {
  slug: string;
  title: string;
  description?: string;
  isEnabled: boolean;
  /** ISO 8601. */
  lastUpdated: string;
  vendorUrl: string;
  commonUrl: string;
  entry: { js: string; css?: string };
  contractVersion: 1;
  /**
   * Semver, auto-patch-bumped by the registry builder whenever a rebuild
   * is detected — an artifact field like `entry`/`contractVersion`, never
   * hand-maintained here in the registry itself.
   */
  version: string;
  tags: string[];
  /**
   * Display-filter concept for the home grid, distinct from `isEnabled`
   * (which stays the loader-level 404 gate). Mirrors the `experiment.status`
   * convention already used in each app's own package.json.
   */
  status: 'live' | 'wip' | 'archived';
}

export type Registry = RegistryEntry[];
