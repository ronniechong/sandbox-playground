import type { Registry, RegistryEntry } from './types.ts';

export class RegistryFetchError extends Error {}

function isRegistryEntry(value: unknown): value is RegistryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.slug === 'string' &&
    typeof entry.title === 'string' &&
    typeof entry.isEnabled === 'boolean' &&
    typeof entry.lastUpdated === 'string' &&
    typeof entry.vendorUrl === 'string' &&
    typeof entry.commonUrl === 'string' &&
    typeof entry.entry === 'object' &&
    entry.entry !== null &&
    typeof (entry.entry as Record<string, unknown>).js === 'string' &&
    entry.contractVersion === 1 &&
    typeof entry.version === 'string' &&
    Array.isArray(entry.tags) &&
    entry.tags.every((t) => typeof t === 'string') &&
    (entry.status === 'live' || entry.status === 'wip' || entry.status === 'archived')
  );
}

export function isValidRegistry(value: unknown): value is Registry {
  return Array.isArray(value) && value.every(isRegistryEntry);
}

export async function fetchRegistry(url: string, signal?: AbortSignal): Promise<Registry> {
  let response: Response;
  try {
    response = await fetch(url, { cache: 'no-cache', signal });
  } catch (err) {
    throw new RegistryFetchError(`Failed to fetch registry: ${(err as Error).message}`);
  }
  if (!response.ok) {
    throw new RegistryFetchError(`Registry fetch returned ${response.status}`);
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch (err) {
    throw new RegistryFetchError(`Registry response is not valid JSON: ${(err as Error).message}`);
  }
  if (!isValidRegistry(data)) {
    throw new RegistryFetchError('Registry response does not match the expected schema');
  }
  return data;
}

export function findEntry(registry: Registry, slug: string): RegistryEntry | undefined {
  return registry.find((e) => e.slug === slug);
}
