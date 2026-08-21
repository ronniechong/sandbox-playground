import type { AtRule, Plugin, Rule } from 'postcss';

const PASSTHROUGH_AT_RULES = new Set(['keyframes', '-webkit-keyframes', 'font-face']);

function isInsidePassthroughAtRule(rule: Rule): boolean {
  const parent = rule.parent;
  return (
    parent !== undefined &&
    parent.type === 'atrule' &&
    PASSTHROUGH_AT_RULES.has((parent as AtRule).name)
  );
}

function prefixSelector(selector: string, prefix: string): string[] {
  const trimmed = selector.trim();

  // :root custom-property blocks stay global by design (see AGENTS.md /
  // the CSS reset docs) — app-level custom properties belong on the
  // container, not :root.
  if (trimmed === ':root') {
    return [trimmed];
  }

  // Rewritten TO the prefix, not nested under it — `[data-exp="x"] html`
  // would never match anything real.
  if (trimmed === 'html' || trimmed === 'body') {
    return [prefix];
  }

  // The universal selector must match both the container itself (so
  // `box-sizing: border-box` applies to the app's own root element,
  // not just its descendants) and everything inside it.
  if (trimmed === '*') {
    return [prefix, `${prefix} *`];
  }

  return [`${prefix} ${trimmed}`];
}

/**
 * Prefixes every selector in an experiment's CSS with `[data-exp="<slug>"]`
 * so styles never leak across experiments sharing one page. See the three
 * documented exceptions above (universal selector, html/body, :root).
 */
export function scopingPlugin(slug: string): Plugin {
  const prefix = `[data-exp="${slug}"]`;
  return {
    postcssPlugin: 'exp-scope',
    Rule(rule) {
      if (isInsidePassthroughAtRule(rule)) return;
      rule.selectors = rule.selectors.flatMap((selector) => prefixSelector(selector, prefix));
    },
  };
}
