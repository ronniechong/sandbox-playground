import { svg } from '../dom.ts';

function strokeIcon(paths: string[]): SVGElement {
  return svg(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.8',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    },
    ...paths.map((d) => svg('path', { d })),
  );
}

export function buildHamburgerIcon(): SVGElement {
  return strokeIcon(['M3.5 7h17M3.5 12h17M3.5 17h17']);
}

export function buildSunIcon(): SVGElement {
  const icon = strokeIcon([
    'M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6L17 17M7 7L5.4 5.4',
  ]);
  icon.insertBefore(svg('circle', { cx: '12', cy: '12', r: '4.2' }), icon.firstChild);
  return icon;
}

export function buildMoonIcon(): SVGElement {
  return strokeIcon(['M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z']);
}

export function buildChromeToggleIcon(): SVGElement {
  return strokeIcon([
    'M9.5 3.5h-4a2 2 0 0 0-2 2v4M14.5 3.5h4a2 2 0 0 1 2 2v4M20.5 14.5v4a2 2 0 0 1-2 2h-4M3.5 14.5v4a2 2 0 0 0 2 2h4',
  ]);
}

export function buildChevronUpIcon(): SVGElement {
  return strokeIcon(['M6 14.5l6-6 6 6']);
}

export function buildHomeIcon(): SVGElement {
  return strokeIcon(['M3.5 11.5 12 4l8.5 7.5M6 9.8V20h12V9.8']);
}
