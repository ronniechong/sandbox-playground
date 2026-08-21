import type { RegistryEntry } from './types.ts';
import { NodeTracker } from './node-tracker.ts';

/** Module-scope: vendor/common are page-lifetime singletons, not per-mount. */
const sharedTracker = new NodeTracker();
let loadedVendorUrl: string | null = null;
let loadedCommonUrl: string | null = null;

export function currentSharedUrls(): { vendorUrl: string | null; commonUrl: string | null } {
  return { vendorUrl: loadedVendorUrl, commonUrl: loadedCommonUrl };
}

/** Test-only: real navigation never needs to reset page-lifetime state. */
export function resetLoaderStateForTests(): void {
  sharedTracker.clear();
  loadedVendorUrl = null;
  loadedCommonUrl = null;
}

/**
 * True when a full page navigation is required instead of an in-page
 * transition: vendor/common are page-lifetime globals (see
 * AGENTS.md "Vendor pinning"), so a second URL can never be swapped in
 * live without risking a version mismatch for whatever is already
 * mounted.
 */
export function needsFullPageNavigation(entry: RegistryEntry): boolean {
  if (loadedVendorUrl !== null && loadedVendorUrl !== entry.vendorUrl) return true;
  if (loadedCommonUrl !== null && loadedCommonUrl !== entry.commonUrl) return true;
  return false;
}

export async function loadVendorAndCommon(entry: RegistryEntry): Promise<void> {
  await sharedTracker.injectScriptOnce(entry.vendorUrl);
  loadedVendorUrl = entry.vendorUrl;

  await sharedTracker.injectScriptOnce(entry.commonUrl);
  loadedCommonUrl = entry.commonUrl;
}

export function injectExperimentCss(url: string): Promise<HTMLLinkElement> {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.onload = () => resolve(link);
    link.onerror = () => reject(new Error(`Failed to load stylesheet: ${url}`));
    document.head.appendChild(link);
  });
}

/**
 * Deliberately not deduped by URL — the contract requires a fresh script
 * execution on every mount (see AGENTS.md re: re-reading window.__exp
 * fresh), so the same URL is injected again even if an earlier instance
 * of the same tag is still sitting in <head> from a previous mount.
 */
export function injectExperimentScript(url: string): Promise<HTMLScriptElement> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve(script);
    script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    document.head.appendChild(script);
  });
}
