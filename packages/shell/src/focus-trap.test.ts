import { describe, expect, it } from 'vitest';
import { createFocusTrap, focusableElements } from './focus-trap.ts';

function buildContainer(): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = `
    <button id="first">First</button>
    <button id="middle">Middle</button>
    <button id="last">Last</button>
  `;
  document.body.appendChild(container);
  return container;
}

describe('focusableElements', () => {
  it('finds all focusable buttons in order', () => {
    const container = buildContainer();
    expect(focusableElements(container).map((el) => el.id)).toEqual(['first', 'middle', 'last']);
  });
});

describe('createFocusTrap', () => {
  it('wraps forward Tab from the last element to the first', () => {
    const container = buildContainer();
    const { handleKeydown } = createFocusTrap(container);
    const last = container.querySelector<HTMLElement>('#last')!;
    last.focus();

    let prevented = false;
    handleKeydown({
      key: 'Tab',
      shiftKey: false,
      preventDefault: () => (prevented = true),
    } as unknown as KeyboardEvent);

    expect(prevented).toBe(true);
    expect(document.activeElement?.id).toBe('first');
  });

  it('wraps backward Shift+Tab from the first element to the last', () => {
    const container = buildContainer();
    const { handleKeydown } = createFocusTrap(container);
    const first = container.querySelector<HTMLElement>('#first')!;
    first.focus();

    let prevented = false;
    handleKeydown({
      key: 'Tab',
      shiftKey: true,
      preventDefault: () => (prevented = true),
    } as unknown as KeyboardEvent);

    expect(prevented).toBe(true);
    expect(document.activeElement?.id).toBe('last');
  });

  it('ignores non-Tab keys', () => {
    const container = buildContainer();
    const { handleKeydown } = createFocusTrap(container);
    let prevented = false;
    handleKeydown({
      key: 'Escape',
      shiftKey: false,
      preventDefault: () => (prevented = true),
    } as unknown as KeyboardEvent);
    expect(prevented).toBe(false);
  });
});
