import { CONTRACT_VERSION, type Experiment, type MountContext } from '@exp/contract';
import type { RegistryEntry } from './types.ts';
import { buildAppPath, parseLocation } from './router.ts';
import { fetchRegistry, findEntry, RegistryFetchError } from './registry.ts';
import {
  injectExperimentCss,
  injectExperimentScript,
  loadVendorAndCommon,
  needsFullPageNavigation,
} from './loader.ts';
import { renderError, renderNotFound } from './render.ts';

export interface ShellOptions {
  root: HTMLElement;
  basePath: string;
  registryUrl: string;
  /** Theme is a fixed/stubbed value until theming lands in a later milestone. */
  theme: 'light' | 'dark';
}

interface MountedApp {
  slug: string;
  route: string;
  controller: AbortController;
  container: HTMLElement;
  experiment: Experiment;
  cssLink: HTMLLinkElement | null;
  routeListeners: Set<(route: string) => void>;
}

/**
 * Reads a contractVersion the registry claims to target and resolves it
 * to the runtime's mount(el, ctx) shape. Only v1 exists today, but the
 * switch/extension point exists now so a future breaking change to
 * @exp/contract has somewhere to add a case (see AGENTS.md
 * "additive-only shared packages" — this is that extension point).
 */
export function assertSupportedContractVersion(
  contractVersion: RegistryEntry['contractVersion'],
): void {
  switch (contractVersion) {
    case CONTRACT_VERSION:
      return;
    default:
      throw new Error(`Unsupported contractVersion: ${String(contractVersion)}`);
  }
}

export class Shell {
  private options: ShellOptions;
  private mounted: MountedApp | null = null;
  private navigationToken = 0;

  constructor(options: ShellOptions) {
    this.options = options;
  }

  start(): void {
    window.addEventListener('popstate', () => this.handleLocationChange());
    this.handleLocationChange();
  }

  navigate(slug: string, subpath: string, opts?: { replace?: boolean }): void {
    const path = buildAppPath(this.options.basePath, slug, subpath);
    if (opts?.replace) {
      window.history.replaceState(null, '', path);
    } else {
      window.history.pushState(null, '', path);
    }
    this.handleLocationChange();
  }

  private async handleLocationChange(): Promise<void> {
    const token = ++this.navigationToken;
    const parsed = parseLocation(
      window.location.pathname,
      window.location.search,
      this.options.basePath,
    );

    if (!parsed) {
      await this.unmountCurrent();
      if (token !== this.navigationToken) return;
      renderNotFound(this.options.root, '(no app)');
      return;
    }

    const { slug, route } = parsed;

    if (this.mounted && this.mounted.slug === slug) {
      this.mounted.route = route;
      for (const cb of this.mounted.routeListeners) cb(route);
      return;
    }

    await this.unmountCurrent();
    if (token !== this.navigationToken) return;

    let registry;
    try {
      registry = await fetchRegistry(this.options.registryUrl);
    } catch (err) {
      if (token !== this.navigationToken) return;
      const message = err instanceof RegistryFetchError ? err.message : 'Unknown registry error';
      renderError(this.options.root, slug, message);
      return;
    }
    if (token !== this.navigationToken) return;

    const entry = findEntry(registry, slug);
    if (!entry || !entry.isEnabled) {
      renderNotFound(this.options.root, slug);
      return;
    }

    if (needsFullPageNavigation(entry)) {
      window.location.reload();
      return;
    }

    try {
      assertSupportedContractVersion(entry.contractVersion);

      await loadVendorAndCommon(entry);
      if (token !== this.navigationToken) return;

      const assetBase = entry.entry.js.replace(/\/[^/]*$/, '');
      let cssLink: HTMLLinkElement | null = null;
      if (entry.entry.css) {
        cssLink = await injectExperimentCss(entry.entry.css);
        if (token !== this.navigationToken) {
          cssLink.remove();
          return;
        }
      }

      await injectExperimentScript(entry.entry.js);
      if (token !== this.navigationToken) {
        cssLink?.remove();
        return;
      }

      const experiment = (window.__exp as typeof window.__exp | undefined)?.[slug];
      if (!experiment) {
        throw new Error(`Script loaded but did not register window.__exp["${slug}"]`);
      }

      const controller = new AbortController();
      const container = document.createElement('div');
      container.setAttribute('data-exp', slug);

      const routeListeners = new Set<(route: string) => void>();
      const mountedApp: MountedApp = {
        slug,
        route,
        controller,
        container,
        experiment,
        cssLink,
        routeListeners,
      };

      const ctx: MountContext = {
        signal: controller.signal,
        basePath: this.options.basePath,
        assetBase,
        asset: (file: string) => `${assetBase}/${file}`,
        get route() {
          return mountedApp.route;
        },
        navigate: (subpath: string, navOpts?: { replace?: boolean }) =>
          this.navigate(slug, subpath, navOpts),
        onRouteChange: (cb: (route: string) => void) => {
          routeListeners.add(cb);
          const unsubscribe = () => routeListeners.delete(cb);
          controller.signal.addEventListener('abort', unsubscribe);
          return unsubscribe;
        },
        theme: this.options.theme,
      };

      await experiment.mount(container, ctx);

      if (token !== this.navigationToken) {
        // A newer navigation started while this one was mounting — tear
        // this instance down immediately rather than leaving it mounted
        // into a container nothing will ever attach to the visible DOM.
        controller.abort();
        await experiment.unmount?.();
        cssLink?.remove();
        return;
      }

      this.options.root.textContent = '';
      this.options.root.appendChild(container);
      this.mounted = mountedApp;
    } catch (err) {
      if (token !== this.navigationToken) return;
      renderError(this.options.root, slug, err instanceof Error ? err.message : String(err));
    }
  }

  private async unmountCurrent(): Promise<void> {
    const current = this.mounted;
    if (!current) return;
    this.mounted = null;
    current.controller.abort();
    await current.experiment.unmount?.();
    current.cssLink?.remove();
    current.container.textContent = '';
    current.container.remove();
  }
}
