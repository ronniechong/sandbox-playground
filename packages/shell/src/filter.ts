import type { Registry, RegistryEntry } from './types.ts';

export interface FilterOptions {
  query: string;
  tags: string[];
  showArchived: boolean;
}

/**
 * Pure filter used by the home grid and the drawer's search: text match
 * against title/description, AND-match against selected tags, and
 * `status: "archived"` hidden unless explicitly opted into.
 */
export function filterEntries(registry: Registry, options: FilterOptions): RegistryEntry[] {
  const query = options.query.trim().toLowerCase();
  return registry.filter((entry) => {
    if (entry.status === 'archived' && !options.showArchived) return false;

    if (options.tags.length > 0 && !options.tags.every((tag) => entry.tags.includes(tag))) {
      return false;
    }

    if (query.length === 0) return true;
    const haystack =
      `${entry.title} ${entry.description ?? ''} ${entry.tags.join(' ')}`.toLowerCase();
    return haystack.includes(query);
  });
}

export function collectTags(registry: Registry): string[] {
  const tags = new Set<string>();
  for (const entry of registry) {
    for (const tag of entry.tags) tags.add(tag);
  }
  return [...tags].sort();
}
