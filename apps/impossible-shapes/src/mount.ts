import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Experiment, MountContext } from '@exp/contract';
import { App } from './App.js';
import './index.css';

let root: Root | null = null;

function mount(el: HTMLElement, ctx: MountContext) {
  root = createRoot(el);
  root.render(createElement(App, { ctx }));
}

function unmount() {
  root?.unmount();
  root = null;
}

window.__exp = window.__exp ?? {};
window.__exp['impossible-shapes'] = { mount, unmount } satisfies Experiment;
