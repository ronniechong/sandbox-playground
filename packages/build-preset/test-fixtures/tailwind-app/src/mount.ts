import './index.css';

window.__exp = window.__exp ?? {};
window.__exp['tailwind-app'] = {
  mount(el: HTMLElement) {
    el.className = 'flex items-center gap-2 p-4 text-red-500';
    el.textContent = 'tailwind fixture';
  },
};

declare global {
  interface Window {
    __exp: Record<string, { mount(el: HTMLElement): void }>;
  }
}
