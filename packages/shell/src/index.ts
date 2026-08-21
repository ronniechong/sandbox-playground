import './ui/shell.css';
import { Shell, type ShellOptions } from './lifecycle.ts';

export { Shell, type ShellOptions } from './lifecycle.ts';
export type { Registry, RegistryEntry } from './registry/types.ts';
export { parseLocation, buildAppPath } from './routing/router.ts';

declare global {
  interface Window {
    __sandboxPlaygroundConfig?: Omit<ShellOptions, 'root'>;
  }
}

const BOUNCE_KEY = 'shell:bounce-path';

/**
 * Completes the 404.html bounce-through (see public/404.html): restores
 * the originally-requested path into history before the router reads
 * window.location, so a direct/deep-linked GitHub Pages hit resolves to
 * the same place a client-side navigation would have.
 */
function restoreBouncedPath(): void {
  const bounced = sessionStorage.getItem(BOUNCE_KEY);
  if (!bounced) return;
  sessionStorage.removeItem(BOUNCE_KEY);
  window.history.replaceState(null, '', bounced);
}

function boot(): void {
  const root = document.getElementById('app');
  if (!root) throw new Error('Shell requires a #app root element');
  const config = window.__sandboxPlaygroundConfig;
  if (!config)
    throw new Error('Shell requires window.__sandboxPlaygroundConfig to be set before load');
  restoreBouncedPath();
  new Shell({ root, ...config }).start();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
