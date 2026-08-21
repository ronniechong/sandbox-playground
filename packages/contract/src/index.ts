export interface MountContext {
  /** Aborted on unmount. Use for listeners, fetch, RAF loops, audio nodes. */
  signal: AbortSignal;

  /** Site base path, no trailing slash. e.g. "/sandbox-playground" */
  basePath: string;

  /**
   * This build's own immutable directory, no trailing slash. e.g.
   * "/sandbox-playground/experiments/app-1/a3f9c1"
   * Use for any asset referenced from JS. Never hardcode a path.
   */
  assetBase: string;

  /** Convenience: ctx.asset('logo.jpeg') -> `${assetBase}/logo.jpeg` */
  asset(file: string): string;

  /** Sub-path after the slug, e.g. "settings/audio". Never leading-slashed. */
  route: string;

  /** Push the app's own state to the URL. Does not remount. */
  navigate(subpath: string, opts?: { replace?: boolean }): void;

  /**
   * Fires when the sub-path changes for THIS app (back button, direct
   * navigation). Does not fire on slug change — that is an unmount.
   * Returns an unsubscribe fn; also auto-removed on `signal` abort.
   */
  onRouteChange(cb: (route: string) => void): () => void;

  theme: 'light' | 'dark';
}

export interface Experiment {
  mount(el: HTMLElement, ctx: MountContext): void | Promise<void>;
  unmount?(): void | Promise<void>;
}

export const CONTRACT_VERSION = 1;

declare global {
  interface Window {
    __exp: Record<string, Experiment>;
  }
}
