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

export type SortKey = 'title' | 'date';
export type SortDirection = 'asc' | 'desc';

export interface SortOptions {
  key: SortKey;
  direction: SortDirection;
}

export function sortEntries(entries: RegistryEntry[], options: SortOptions): RegistryEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const cmp =
      options.key === 'title'
        ? a.title.localeCompare(b.title)
        : Date.parse(a.lastUpdated) - Date.parse(b.lastUpdated);
    return options.direction === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

export function collectTags(registry: Registry): string[] {
  const tags = new Set<string>();
  for (const entry of registry) {
    for (const tag of entry.tags) tags.add(tag);
  }
  return [...tags].sort();
}
