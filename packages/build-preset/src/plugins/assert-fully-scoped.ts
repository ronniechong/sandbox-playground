import postcss from 'postcss';
import { isInsidePassthroughAtRule } from './scoping-plugin.ts';

/**
 * The real protection against a scoping regression isn't careful plugin
 * ordering — it's this: after scoping runs, verify every rule actually
 * carries the prefix, and fail the build loudly if not.
 */
export function assertFullyScoped(css: string, slug: string): void {
  const prefix = `[data-exp="${slug}"]`;
  const root = postcss.parse(css);
  const violations: string[] = [];

  root.walkRules((rule) => {
    if (isInsidePassthroughAtRule(rule)) return;
    for (const selector of rule.selectors) {
      const trimmed = selector.trim();
      if (trimmed === ':root') continue;
      if (!trimmed.includes(prefix)) violations.push(trimmed);
    }
  });

  if (violations.length > 0) {
    throw new Error(
      `CSS scoping invariant violated for experiment "${slug}": ` +
        `unprefixed selector(s) found: ${violations.join(', ')}`,
    );
  }
}
