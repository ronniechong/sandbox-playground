import './index.css';

window.__exp = window.__exp ?? {};
window.__exp['throwaway-app'] = {
  mount(el: HTMLElement) {
    el.style.width = '10px';
    el.style.border = '5px solid red';
    el.textContent = 'throwaway fixture';
  },
};

declare global {
  interface Window {
    __exp: Record<string, { mount(el: HTMLElement): void }>;
  }
}
