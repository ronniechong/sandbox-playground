import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Experiment, MountContext } from '@exp/contract';
import { App } from './App.js';
import './index.css';

let root: Root | null = null;

// Module-scope state. If the shell reused a cached <script> reference
// instead of re-injecting it on every mount, this would keep
// incrementing across separate mount/unmount cycles within the same
// page session — a real symptom of stale module state, since a fresh
// script execution always starts this back at 0.
let mountCount = 0;

function mount(el: HTMLElement, ctx: MountContext) {
  mountCount += 1;
  root = createRoot(el);
  root.render(createElement(App, { ctx, mountCount }));
}

function unmount() {
  root?.unmount();
  root = null;
}

window.__exp = window.__exp ?? {};
window.__exp['hello-world'] = { mount, unmount } satisfies Experiment;
