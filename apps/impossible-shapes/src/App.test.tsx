import React from 'react';
import { cleanup, render } from '@testing-library/react';
import type { MountContext } from '@exp/contract';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App.js';

afterEach(cleanup);

function fakeCtx(overrides: Partial<MountContext> = {}): MountContext {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    basePath: '/impossible-shapes',
    assetBase: '/impossible-shapes/experiments/impossible-shapes/fake-hash',
    asset: (file) => `/impossible-shapes/experiments/impossible-shapes/fake-hash/${file}`,
    route: '',
    navigate: () => {},
    onRouteChange: () => () => {},
    onThemeChange: () => () => {},
    theme: 'light',
    ...overrides,
  };
}

describe('App', () => {
  it('mounts and unmounts without throwing', () => {
    const { unmount } = render(<App ctx={fakeCtx()} />);
    expect(() => unmount()).not.toThrow();
  });
});
