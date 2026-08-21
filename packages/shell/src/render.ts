export type ShellState =
  | { kind: 'not-found'; slug: string }
  | { kind: 'error'; slug: string; message: string }
  | { kind: 'mounted'; slug: string };

/**
 * Mechanism only, per M05/M06 split — no visual design here. Slug and
 * error text are always set via textContent, never interpolated into
 * HTML: both are attacker-controllable via the URL and this code ships
 * to production unchanged (see M05 risk #5).
 */
export function renderNotFound(root: HTMLElement, slug: string): void {
  root.textContent = '';
  const container = document.createElement('div');
  container.setAttribute('data-shell-state', 'not-found');
  const heading = document.createElement('p');
  heading.textContent = 'Not found: ';
  const slugEl = document.createElement('code');
  slugEl.textContent = slug;
  heading.appendChild(slugEl);
  container.appendChild(heading);
  root.appendChild(container);
}

export function renderError(root: HTMLElement, slug: string, message: string): void {
  root.textContent = '';
  const container = document.createElement('div');
  container.setAttribute('data-shell-state', 'error');
  const heading = document.createElement('p');
  heading.textContent = 'Something went wrong loading: ';
  const slugEl = document.createElement('code');
  slugEl.textContent = slug;
  heading.appendChild(slugEl);
  container.appendChild(heading);

  const detail = document.createElement('p');
  detail.textContent = message;
  container.appendChild(detail);

  const reload = document.createElement('a');
  reload.href = window.location.href;
  reload.textContent = 'Reload';
  container.appendChild(reload);

  root.appendChild(container);
}
