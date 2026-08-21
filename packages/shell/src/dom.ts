type NodeChild = Node | string | null | undefined | false;
type ElAttrs = Record<string, string | boolean | ((event: Event) => void) | undefined>;

/**
 * Minimal DOM-builder shorthand over createElement/setAttribute/
 * addEventListener — not a template language or virtual DOM. The shell
 * can't depend on a framework (see AGENTS.md: vanilla TypeScript, no
 * React), so this only removes the boilerplate of building that DOM by
 * hand; every call still produces a single real, immediately-attachable
 * element.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: ElAttrs,
  ...children: NodeChild[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  applyAttrs(node, attrs);
  appendChildren(node, children);
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg(tag: string, attrs?: ElAttrs, ...children: NodeChild[]): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  applyAttrs(node, attrs);
  appendChildren(node, children);
  return node;
}

function applyAttrs(node: Element, attrs?: ElAttrs): void {
  if (!attrs) return;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'className') {
      node.setAttribute('class', String(value));
    } else {
      node.setAttribute(key, value === true ? '' : String(value));
    }
  }
}

function appendChildren(node: Element, children: NodeChild[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child as Node | string);
  }
}
