const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * Wraps Tab/Shift+Tab focus within `container`. Returned `handleKeydown`
 * is meant to be attached to a keydown listener scoped to the container
 * only — never `capture: true` (see AGENTS.md/M06: experiments must be
 * able to handle their own keys without the shell stealing them first).
 */
export function createFocusTrap(container: HTMLElement) {
  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const focusable = focusableElements(container);
    if (focusable.length === 0) return;

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = container.ownerDocument.activeElement;

    if (event.shiftKey) {
      if (active === first || !container.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !container.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  return { handleKeydown };
}
