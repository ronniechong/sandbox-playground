const STORAGE_KEY = 'shell:theme';

export type Theme = 'light' | 'dark';

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/** Falls back to `fallback` when nothing is stored or storage is unavailable. */
export function loadStoredTheme(storage: Storage, fallback: Theme): Theme {
  try {
    const stored = storage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

export function storeTheme(storage: Storage, theme: Theme): void {
  try {
    storage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can throw (private browsing, quota) — the in-memory theme
    // still applies for the rest of the session, only persistence is lost.
  }
}
