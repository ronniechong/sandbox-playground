/**
 * Tracks injected <script>/<link> nodes by URL so vendor/common are never
 * injected twice — they persist for the lifetime of the page and are
 * shared across every experiment switch. Experiment CSS/JS are handled
 * separately (see loader.ts): CSS is removed on unmount so its tracker
 * entry is cleared naturally, and the experiment <script> is deliberately
 * never deduped by this tracker at all, since it must re-execute on
 * every mount.
 */
export class NodeTracker {
  private nodes = new Map<string, HTMLScriptElement | HTMLLinkElement>();
  private pending = new Map<string, Promise<void>>();

  has(url: string): boolean {
    const node = this.nodes.get(url);
    return !!node && node.isConnected;
  }

  async injectScriptOnce(url: string): Promise<void> {
    if (this.has(url)) return;
    const existing = this.pending.get(url);
    if (existing) return existing;

    const promise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
      this.nodes.set(url, script);
      document.head.appendChild(script);
    }).finally(() => {
      this.pending.delete(url);
    });

    this.pending.set(url, promise);
    return promise;
  }

  clear(): void {
    this.nodes.clear();
    this.pending.clear();
  }
}
