# sandbox-playground

A monorepo for small, self-contained front-end web experiments. One loader
shell, many independent experiment bundles, a single shared vendor bundle.
Deployed to GitHub Pages; only changed experiments are rebuilt.

See [AGENTS.md](./AGENTS.md) for the project's non-negotiable principles and
settled technical decisions.

## Local setup

Requires, on top of Node (see `.nvmrc`) and pnpm (see `packageManager`):

- [`just`](https://github.com/casey/just) — command runner (`brew install just`)
- [`gitleaks`](https://github.com/gitleaks/gitleaks) — pre-commit secret scanning (`brew install gitleaks`)

Run `just --list` for available commands, or `pnpm install` first to also
wire up git hooks.

## Experiment versioning

Each experiment's `version` (in the deployed registry, not `package.json`)
is managed automatically by `scripts/build-registry.ts` — there's no manual
release step for the common case:

- **Patch bumps are automatic.** Every time an experiment is rebuilt (its
  output hash changes), its patch version increments on its own
  (`0.1.0` → `0.1.1`) the next time the registry is built.
- **Unchanged builds keep their version.** If an experiment wasn't
  rebuilt, its version carries forward untouched.
- **Minor/major bumps are manual.** Set `"version"` explicitly under the
  `experiment` field in that app's `package.json` (e.g. `"version": "2.0.0"`)
  ahead of a rebuild. Once it takes effect, it becomes the new baseline —
  auto-patch-bumping resumes from there on the next rebuild.
- **`archived` experiments never auto-bump**, even if their code is
  rebuilt — a build script warning is the signal something's off (an
  archived experiment isn't expected to be actively developed), not an
  automatic new release.
- **First-ever build starts at `0.1.0`.**

## GitHub Pages setup (manual, one-off)

This repo's Pages source is set to **GitHub Actions** (Settings → Pages →
Build and deployment → Source). This cannot be scripted via the API in a way
that survives recreating the repo, so if this repo is ever deleted and
recreated, that setting needs to be reapplied by hand before the deploy
workflow will publish anything.
