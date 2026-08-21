import { el } from '../dom.ts';

export type ShellState =
  | { kind: 'not-found'; slug: string }
  | { kind: 'error'; slug: string; message: string }
  | { kind: 'mounted'; slug: string };

/**
 * Slug and error text are always rendered as element children, never
 * interpolated into HTML: both are attacker-controllable via the URL and
 * this code ships to production unchanged (see M05 risk #5). `el`'s
 * string children become Text nodes, never innerHTML.
 */
function homeLink(basePath: string): HTMLAnchorElement {
  return el('a', { className: 'shell-state-link', href: basePath || '/' }, 'Back to home');
}

export function renderNotFound(root: HTMLElement, slug: string, basePath = ''): void {
  root.textContent = '';
  root.appendChild(
    el(
      'div',
      { className: 'shell-state', 'data-shell-state': 'not-found' },
      el(
        'div',
        { className: 'shell-state-card' },
        el('h2', { className: 'shell-state-title' }, 'Not found'),
        el(
          'p',
          { className: 'shell-state-message' },
          'No experiment matches ',
          el('code', { className: 'shell-state-slug' }, slug),
          '.',
        ),
        homeLink(basePath),
      ),
    ),
  );
}

export function renderError(root: HTMLElement, slug: string, message: string, basePath = ''): void {
  root.textContent = '';
  root.appendChild(
    el(
      'div',
      { className: 'shell-state', 'data-shell-state': 'error' },
      el(
        'div',
        { className: 'shell-state-card' },
        el('h2', { className: 'shell-state-title' }, 'Something went wrong'),
        el(
          'p',
          { className: 'shell-state-message' },
          'Loading ',
          el('code', { className: 'shell-state-slug' }, slug),
          ` failed: ${message}`,
        ),
        el('a', { className: 'shell-state-link', href: window.location.href }, 'Reload'),
        homeLink(basePath),
      ),
    ),
  );
}
