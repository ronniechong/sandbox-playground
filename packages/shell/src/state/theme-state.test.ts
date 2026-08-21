import { describe, expect, it } from 'vitest';
import { loadStoredTheme, storeTheme } from './theme-state.ts';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  } as Storage;
}

describe('loadStoredTheme', () => {
  it('falls back when nothing is stored', () => {
    expect(loadStoredTheme(memoryStorage(), 'light')).toBe('light');
  });

  it('reads a previously stored theme', () => {
    const storage = memoryStorage();
    storeTheme(storage, 'dark');
    expect(loadStoredTheme(storage, 'light')).toBe('dark');
  });

  it('falls back on garbage values', () => {
    const storage = memoryStorage();
    storage.setItem('shell:theme', 'blue');
    expect(loadStoredTheme(storage, 'light')).toBe('light');
  });

  it('falls back when storage throws', () => {
    const storage = {
      getItem: () => {
        throw new Error('nope');
      },
    } as unknown as Storage;
    expect(loadStoredTheme(storage, 'dark')).toBe('dark');
  });
});
