export interface RegistryEntry {
  slug: string;
  title: string;
  description?: string;
  isEnabled: boolean;
  /** ISO 8601. */
  lastUpdated: string;
  vendorUrl: string;
  commonUrl: string;
  /**
   * The vendor/common bundle filenames (e.g. "vendor-8f21c4.js") this entry
   * was built against, frozen at build time — distinct from `vendorUrl`,
   * which always points at the *shared* bundle's current URL structure.
   * Read by `pnpm status` as the recorded side of vendor staleness; see
   * ADDENDUM-004 §1.
   */
  vendor: string;
  common: string;
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
