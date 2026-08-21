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
}

export type Registry = RegistryEntry[];
