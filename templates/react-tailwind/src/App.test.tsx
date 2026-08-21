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
    basePath: '/__SLUG__',
    assetBase: '/__SLUG__/experiments/__SLUG__/fake-hash',
    asset: (file) => `/__SLUG__/experiments/__SLUG__/fake-hash/${file}`,
    route: '',
    navigate: () => {},
    onRouteChange: () => () => {},
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
