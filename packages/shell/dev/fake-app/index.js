// Throwaway second app for this milestone's manual switching/leak-check
// test only — not a real experiment, superseded once M07's registry
// builder produces real entries. Deliberately registers its own
// listener/timer to prove the shell's unmount sequence tears it down.
(function () {
  let intervalId = null;
  let el = null;

  function mount(container, ctx) {
    el = document.createElement('div');
    el.setAttribute('data-fake-app', 'true');
    const heading = document.createElement('h1');
    heading.textContent = 'Fake App';
    const route = document.createElement('p');
    route.textContent = `route: ${ctx.route || '(home)'}`;
    const counter = document.createElement('p');
    let ticks = 0;
    counter.textContent = `ticks: ${ticks}`;

    intervalId = window.setInterval(() => {
      ticks += 1;
      counter.textContent = `ticks: ${ticks}`;
    }, 250);

    window.addEventListener('scroll', () => {}, { signal: ctx.signal });
    ctx.onRouteChange((r) => {
      route.textContent = `route: ${r || '(home)'}`;
    });

    el.appendChild(heading);
    el.appendChild(route);
    el.appendChild(counter);
    container.appendChild(el);
  }

  function unmount() {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
    el = null;
  }

  window.__exp = window.__exp ?? {};
  window.__exp['fake-app'] = { mount, unmount };
})();
