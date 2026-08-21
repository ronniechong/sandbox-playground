import { svg } from '../dom.ts';

/**
 * The shell's four-square mark, built as live DOM so it can pick up
 * `currentColor`/theme custom properties. A separate fixed-color copy
 * lives in public/favicon.svg — favicons don't reliably resolve CSS
 * custom properties across browsers, so that one bakes in literal hex.
 */
export function buildBrandMark(): SVGElement {
  const squares: Array<[x: string, y: string, fill: string, opacity?: string]> = [
    ['6', '6', 'var(--shell-color-accent)'],
    ['12.8', '6', 'currentColor', '.32'],
    ['6', '12.8', 'currentColor', '.32'],
    ['12.8', '12.8', 'currentColor', '.14'],
  ];

  return svg(
    'svg',
    { class: 'shell-brand-mark', viewBox: '0 0 24 24', 'aria-hidden': 'true' },
    svg('rect', {
      x: '1.5',
      y: '1.5',
      width: '21',
      height: '21',
      rx: '5.5',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.6',
      opacity: '.28',
    }),
    ...squares.map(([x, y, fill, opacity]) =>
      svg('rect', { x, y, width: '5.2', height: '5.2', rx: '1.3', fill, opacity }),
    ),
  );
}
