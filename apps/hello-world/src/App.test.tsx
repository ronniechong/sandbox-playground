import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { MountContext } from '@exp/contract';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

afterEach(cleanup);

function fakeCtx(overrides: Partial<MountContext> = {}): MountContext {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    basePath: '/hello-world',
    assetBase: '/hello-world/experiments/hello-world/fake-hash',
    asset: (file) => `/hello-world/experiments/hello-world/fake-hash/${file}`,
    route: '',
    navigate: () => {},
    onRouteChange: () => () => {},
    theme: 'light',
    ...overrides,
  };
}

describe('App', () => {
  it('mounts and unmounts without throwing', () => {
    const { unmount } = render(<App ctx={fakeCtx()} mountCount={1} />);
    expect(() => unmount()).not.toThrow();
  });

  it('resolves the logo asset through ctx.asset()', () => {
    render(<App ctx={fakeCtx()} mountCount={1} />);
    const img = screen.getByAltText('') as HTMLImageElement;
    expect(img.src).toContain('/hello-world/experiments/hello-world/fake-hash/logo.svg');
  });

  it('calls ctx.navigate() when a nav button is clicked', () => {
    const navigate = vi.fn();
    render(<App ctx={fakeCtx({ navigate })} mountCount={1} />);
    screen.getByText('About').click();
    expect(navigate).toHaveBeenCalledWith('about');
  });

  it('updates the displayed route when onRouteChange fires', () => {
    let fireRouteChange: ((route: string) => void) | undefined;
    const onRouteChange = (cb: (route: string) => void) => {
      fireRouteChange = cb;
      return () => {};
    };
    render(<App ctx={fakeCtx({ onRouteChange })} mountCount={1} />);
    expect(screen.getByText('route: (home)')).toBeTruthy();
    act(() => fireRouteChange?.('about'));
    expect(screen.getByText('route: about')).toBeTruthy();
  });

  it('displays the module-scope mount count passed in from mount.ts', () => {
    render(<App ctx={fakeCtx()} mountCount={3} />);
    expect(screen.getByText(/mount count.*3/)).toBeTruthy();
  });
});
