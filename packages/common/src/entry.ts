import type { ReactNode } from 'react';
import type { Root } from 'react-dom/client';

declare global {
  interface Window {
    ReactDOM: { createRoot: (container: Element | DocumentFragment) => Root };
    __common: typeof CommonExports;
  }
}

/**
 * Mounts a React node using the vendor-provided React/ReactDOM globals
 * (never a bundled copy — a second React instance can't coexist with the
 * one already externalized in vendor.js).
 */
function mountReact(el: HTMLElement, node: ReactNode): Root {
  const root = window.ReactDOM.createRoot(el);
  root.render(node);
  return root;
}

/**
 * Registers a cleanup callback that runs once, on abort. Guards against
 * AbortSignal firing the listener more than once across repeated use.
 */
function cleanup(signal: AbortSignal, onAbort: () => void): void {
  signal.addEventListener('abort', onAbort, { once: true });
}

const CommonExports = {
  mountReact,
  cleanup,
};

window.__common = CommonExports;
