import { afterEach, describe, expect, it } from 'vitest';
import { NodeTracker } from './node-tracker.ts';

function resolveInjectedScript() {
  const script = document.head.querySelector('script:last-of-type');
  script?.dispatchEvent(new Event('load'));
}

afterEach(() => {
  document.head.querySelectorAll('script').forEach((s) => s.remove());
});

describe('NodeTracker', () => {
  it('injects a script exactly once for a given URL', async () => {
    const tracker = new NodeTracker();
    const promise = tracker.injectScriptOnce('https://example.test/vendor-abc.js');
    resolveInjectedScript();
    await promise;

    expect(
      document.head.querySelectorAll('script[src="https://example.test/vendor-abc.js"]').length,
    ).toBe(1);
  });

  it('does not inject the same URL twice, even across separate calls', async () => {
    const tracker = new NodeTracker();
    const first = tracker.injectScriptOnce('https://example.test/common-xyz.js');
    resolveInjectedScript();
    await first;

    await tracker.injectScriptOnce('https://example.test/common-xyz.js');

    expect(
      document.head.querySelectorAll('script[src="https://example.test/common-xyz.js"]').length,
    ).toBe(1);
  });

  it('re-injects a URL once its tracked node has been removed from the DOM', async () => {
    const tracker = new NodeTracker();
    const first = tracker.injectScriptOnce('https://example.test/common-xyz.js');
    resolveInjectedScript();
    await first;

    document.head.querySelector('script')?.remove();

    const second = tracker.injectScriptOnce('https://example.test/common-xyz.js');
    resolveInjectedScript();
    await second;

    expect(
      document.head.querySelectorAll('script[src="https://example.test/common-xyz.js"]').length,
    ).toBe(1);
  });

  it('rejects when the script fails to load', async () => {
    const tracker = new NodeTracker();
    const promise = tracker.injectScriptOnce('https://example.test/broken.js');
    document.head.querySelector('script:last-of-type')?.dispatchEvent(new Event('error'));
    await expect(promise).rejects.toThrow(/Failed to load/);
  });
});
