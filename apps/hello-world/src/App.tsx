import React, { useEffect, useState } from 'react';
import type { MountContext } from '@exp/contract';

export function App({ ctx, mountCount }: { ctx: MountContext; mountCount: number }) {
  const [route, setRoute] = useState(ctx.route);
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    return ctx.onRouteChange(setRoute);
  }, [ctx]);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize, { signal: ctx.signal });
  }, [ctx.signal]);

  return (
    <div>
      <img src={ctx.asset('logo.svg')} alt="" width={24} height={24} />
      <h1>Goodbye, Hello World</h1>
      <p>
        <span className="status-dot" /> window width: {width}px
      </p>
      <nav>
        <button onClick={() => ctx.navigate('')}>Home</button>
        <button onClick={() => ctx.navigate('about')}>About</button>
      </nav>
      <p>route: {route || '(home)'}</p>
      <p>mount count (this script instance): {mountCount}</p>
    </div>
  );
}
