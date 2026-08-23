# Authoring an experiment

## Scaffold

```sh
pnpm new <slug> [--with <name,name>] [--with-msw] [--no-tailwind]
```

`--with` copies a component from `packages/ui/src/<name>.tsx` into the new
app (see [CONTRIBUTING.md](./CONTRIBUTING.md) for why this is a copy, not
an import). `--with-msw` wires up a mock service worker. `--no-tailwind`
strips the default Tailwind setup.

## Metadata (`experiment` block in `package.json`)

The scaffolder leaves `description` and `tags` blank and `status` set to
`wip` — nothing fills these in automatically, so an experiment ships with
silent metadata unless someone asks. An AI agent scaffolding a new
experiment should:

- **At kickoff:** ask the person for a one-line `description` (and `tags`,
  if they already know how they'd categorize it).
- **Before publishing** (opening the PR that merges it into `main`): ask
  them to confirm or set `tags` if not already set, and confirm whether
  `status` should move off `wip` (e.g. to `live`) now that it's ready.

## Code hygiene inside an experiment

The scaffolder gives you a flat `src/` with `App.tsx`, `App.test.tsx`,
`mount.ts`, `index.css`. That's fine for a trivial experiment, but past a
handful of files, keep it organized rather than letting everything pile
up flat:

- **Structure by kind as it grows** — `components/`, `hooks/`, `utils/` (or
  whatever grouping fits the experiment) once there's more than one of a
  kind. A single-file experiment doesn't need folders it doesn't have
  contents for yet; don't scaffold empty structure preemptively.
- **Co-locate a component's CSS with the component**, not all in one
  root `index.css`, once there's more than one component. `Foo.tsx` +
  `Foo.css` (imported from `Foo.tsx`) beats a growing shared stylesheet —
  the build-time class-prefixing (see "CSS scoping caveats" below) works
  the same regardless of how many CSS files feed into the bundle.
- **Give meaningful units a test.** Not full coverage for its own sake,
  but anything with real logic — a projection/transform function, a
  reducer, a parser — should have a `.test.ts` next to it. Canvas/visual
  rendering itself is exempt (jsdom can't render it meaningfully; verify
  those manually via `just dev <slug>`), but the pure logic feeding that
  rendering usually isn't.

## The contract

Every experiment exports one object from its entry file, registered on
`window.__exp[slug]`:

```ts
interface Experiment {
  mount(el: HTMLElement, ctx: MountContext): void | Promise<void>;
  unmount?(): void | Promise<void>;
}
```

`ctx` is the app's entire connection to the shell — see
`packages/contract/src/index.ts` for the full, documented shape
(`ctx.signal`, `ctx.asset()`, `ctx.navigate()`, `ctx.onThemeChange()`,
etc). The shell never imports experiment code and never assumes a
framework; this function boundary is the only thing it knows about.

## Cleanup rules

- **Everything you attach, detach in `unmount()` or on `ctx.signal`
  abort.** Event listeners, `fetch` calls, `requestAnimationFrame` loops,
  audio/video nodes, timers, subscriptions from `ctx.onRouteChange()` /
  `ctx.onThemeChange()`. The shell mounts/unmounts experiments in place
  without a page reload — anything left running after unmount leaks into
  whatever the visitor navigates to next.
- **Never hold a reference to `el` past unmount.** The shell may remove it
  from the DOM immediately after calling `unmount()`.
- **`ctx.theme` is a snapshot, not live.** Read it once at mount time; if
  your UI needs to react to a live theme change, subscribe via
  `ctx.onThemeChange()` — don't poll or assume the initial value stays
  correct.

## CSS scoping caveats

Every class selector in your compiled CSS gets prefixed with
`[data-exp="<slug>"]` automatically, as a build step run on the final
bundled CSS (not a transform-time PostCSS plugin — see
`packages/build-preset/src/plugins/scope-css.ts` for why). Two
consequences worth knowing before you hit them:

- **The build fails loudly, not silently, if scoping can't apply** — an
  `assertFullyScoped` check walks every rule in the output and throws if
  any selector lacks the prefix. If you see this error, something in your
  CSS produced a top-level rule the scoper couldn't attribute (rare;
  usually a global reset accidentally included from outside `packages/reset`).
- **`:root` is passed through unprefixed** — CSS custom properties defined
  there are intentionally global-ish within your own bundle, since
  `:root` can't be meaningfully scoped to an element.
- **Extending the build pipeline is additive-only.** Use `experiment()`'s
  `plugins:` / `postcss:` options to add things (e.g. `@tailwindcss/vite`
  goes through `plugins:`, never `postcss:` — see the decisions table in
  the private planning doc if you're touching this). You cannot remove or
  reorder the preset's own scoping/hashing plugins through these options;
  they always run last.

## Shadow DOM (opt-in)

The default CSS isolation (above) is build-time class prefixing, chosen
because Shadow DOM breaks portal-based components (Radix, MUI, anything
that appends to `document.body`). If your experiment specifically needs
real DOM/style isolation and doesn't use portals, attach your own shadow
root inside `mount()`:

```ts
export function mount(el: HTMLElement, ctx: MountContext) {
  const root = el.attachShadow({ mode: 'open' });
  // render into `root` instead of `el`; your compiled CSS still applies
  // (it's injected as a <style> tag by the app's own runtime, not by the
  // shell), but is now also naturally isolated by the shadow boundary.
}
```

There's no scaffolder flag for this yet — it's a per-experiment manual
opt-in, not a preset mode.

## Vendor rules

React and ReactDOM are externalized from every experiment's bundle and
served once, shared, as `vendor.js` (see `packages/vendor`). Practical
implications:

- **Don't bundle your own React.** `experiment()` already marks
  `react`/`react-dom`/`react-dom/client` external with the right
  `globals` mapping — importing them normally in your app code is fine and
  expected; they just don't end up in your output bundle.
- **Vendor upgrades are manual, not automatic.** Bumping React in
  `packages/vendor` doesn't touch any already-deployed experiment's
  behavior (frozen artifacts) — see `pnpm status`'s vendor-staleness column
  if you want to know whether a deployed app predates the current vendor
  bundle.
- **No other runtime dependency is shared this way.** `packages/common`
  exists for anything else genuinely worth sharing at runtime, but the
  default is: don't add to it. Most shared code should be copied via
  `packages/ui`, not added to a shared runtime bundle — see
  [CONTRIBUTING.md](./CONTRIBUTING.md).

## Checking staleness

`pnpm status` reports whether a deployed experiment's source, vendor
bundle, toolchain (`contract`/`reset`/`build-preset`), or contract version
has moved since that experiment's last build. It never rebuilds anything
and never fails — see the tool's own `--json` output or the PR comment it
posts for details. `pnpm rebuild:stale` rebuilds any experiment `pnpm
status` marks source-stale, locally, on demand.
