# sandbox-playground

A monorepo for small, self-contained front-end web experiments. One loader
shell, many independent experiment bundles, a single shared vendor bundle.
Deployed to GitHub Pages; only changed experiments are rebuilt.

See [AGENTS.md](./AGENTS.md) for the project's non-negotiable principles and
settled technical decisions.

## GitHub Pages setup (manual, one-off)

This repo's Pages source is set to **GitHub Actions** (Settings → Pages →
Build and deployment → Source). This cannot be scripted via the API in a way
that survives recreating the repo, so if this repo is ever deleted and
recreated, that setting needs to be reapplied by hand before the deploy
workflow will publish anything.
