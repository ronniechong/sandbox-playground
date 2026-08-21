import { CONTRACT_VERSION, type Experiment, type MountContext } from '@exp/contract';
import type { RegistryEntry } from './types.ts';
import { buildAppPath, extractShellQueryKeys, parseLocation } from './router.ts';
import { fetchRegistry, findEntry, RegistryFetchError } from './registry.ts';
import {
  injectExperimentCss,
  injectExperimentScript,
  loadVendorAndCommon,
  needsFullPageNavigation,
} from './loader.ts';
import { renderError, renderNotFound } from './render.ts';
import { ChromeUI } from './chrome-ui.ts';
import { isChromeHidden, withChromeHidden } from './chrome-state.ts';
import { loadStoredTheme, storeTheme, type Theme } from './theme-state.ts';

export interface ShellOptions {
  root: HTMLElement;
  basePath: string;
  registryUrl: string;
  /** Used only as a fallback before any stored preference exists. */
  theme: Theme;
}

interface MountedApp {
  slug: string;
  route: string;
  controller: AbortController;
  container: HTMLElement;
  experiment: Experiment;
  cssLink: HTMLLinkElement | null;
  routeListeners: Set<(route: string) => void>;
  themeListeners: Set<(theme: Theme) => void>;
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

function isHomePath(pathname: string, basePath: string): boolean {
  const normalizedBase = basePath.replace(/\/$/, '');
  return pathname === normalizedBase || pathname === `${normalizedBase}/`;
}

export class Shell {
  private options: ShellOptions;
  private mounted: MountedApp | null = null;
  private navigationToken = 0;
  private chrome: ChromeUI;
  private theme: Theme;

  constructor(options: ShellOptions) {
    this.options = options;
    this.theme = loadStoredTheme(window.localStorage, options.theme);
    this.chrome = new ChromeUI(options.root, options.basePath, {
      onHomeClick: () => this.navigateHome(),
      onToggleChrome: () => this.toggleChrome(),
      onToggleTheme: () => this.toggleTheme(),
      onSelect: (slug: string) => this.navigate(slug, ''),
    });
    this.chrome.setTheme(this.theme);
  }

  start(): void {
    window.addEventListener('popstate', () => this.handleLocationChange());
    this.chrome.setChromeHidden(isChromeHidden(window.location.search));
    this.handleLocationChange();
  }

  navigateHome(): void {
    window.history.pushState(null, '', this.options.basePath || '/');
    this.handleLocationChange();
  }

  navigate(slug: string, subpath: string, opts?: { replace?: boolean }): void {
    const path = buildAppPath(this.options.basePath, slug, subpath);
    const shellQuery = extractShellQueryKeys(window.location.search);
    const target = path + shellQuery;
    if (opts?.replace) {
      window.history.replaceState(null, '', target);
    } else {
      window.history.pushState(null, '', target);
    }
    this.handleLocationChange();
  }

  private toggleChrome(): void {
    const hidden = !isChromeHidden(window.location.search);
    const newSearch = withChromeHidden(window.location.search, hidden);
    window.history.replaceState(
      null,
      '',
      window.location.pathname + newSearch + window.location.hash,
    );
    this.chrome.setChromeHidden(hidden);
  }

  private toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    storeTheme(window.localStorage, this.theme);
    this.chrome.setTheme(this.theme);
    if (this.mounted) {
      for (const cb of this.mounted.themeListeners) cb(this.theme);
    }
  }

  private async handleLocationChange(): Promise<void> {
    const token = ++this.navigationToken;

    if (isHomePath(window.location.pathname, this.options.basePath)) {
      await this.unmountCurrent();
      if (token !== this.navigationToken) return;
      await this.renderHome(token);
      return;
    }

    const parsed = parseLocation(
      window.location.pathname,
      window.location.search,
      this.options.basePath,
    );

    if (!parsed) {
      await this.unmountCurrent();
      if (token !== this.navigationToken) return;
      this.chrome.setExperimentTitle(null);
      renderNotFound(this.chrome.appContainer, '(no app)');
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
    this.chrome.showLoading();

    let registry;
    try {
      registry = await fetchRegistry(this.options.registryUrl);
    } catch (err) {
      if (token !== this.navigationToken) return;
      const message = err instanceof RegistryFetchError ? err.message : 'Unknown registry error';
      renderError(this.chrome.appContainer, slug, message);
      return;
    }
    if (token !== this.navigationToken) return;
    this.chrome.setRegistry(registry);

    const entry = findEntry(registry, slug);
    if (!entry || !entry.isEnabled) {
      this.chrome.setExperimentTitle(null);
      renderNotFound(this.chrome.appContainer, slug);
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
      const themeListeners = new Set<(theme: Theme) => void>();
      const mountedApp: MountedApp = {
        slug,
        route,
        controller,
        container,
        experiment,
        cssLink,
        routeListeners,
        themeListeners,
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
        onThemeChange: (cb: (theme: Theme) => void) => {
          themeListeners.add(cb);
          const unsubscribe = () => themeListeners.delete(cb);
          controller.signal.addEventListener('abort', unsubscribe);
          return unsubscribe;
        },
        theme: this.theme,
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

      this.chrome.appContainer.textContent = '';
      this.chrome.appContainer.appendChild(container);
      this.chrome.setExperimentTitle(entry.title);
      this.mounted = mountedApp;
    } catch (err) {
      if (token !== this.navigationToken) return;
      this.chrome.setExperimentTitle(null);
      renderError(this.chrome.appContainer, slug, err instanceof Error ? err.message : String(err));
    }
  }

  private async renderHome(token: number): Promise<void> {
    this.chrome.showLoading();
    let registry;
    try {
      registry = await fetchRegistry(this.options.registryUrl);
    } catch (err) {
      if (token !== this.navigationToken) return;
      const message = err instanceof RegistryFetchError ? err.message : 'Unknown registry error';
      renderError(this.chrome.appContainer, '(home)', message);
      return;
    }
    if (token !== this.navigationToken) return;
    this.chrome.renderHome(registry);
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
