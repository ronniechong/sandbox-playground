# AGENTS.md — sandbox-playground

> Instructions for AI coding agents working in this repository.

## Project overview
**sandbox-playground** — a monorepo for small, self-contained front-end web experiments. One loader shell, many independent experiment bundles, a single shared vendor bundle. Deployed to GitHub Pages; only changed experiments are rebuilt, and once an experiment is deployed, its bundle is never rebuilt automatically.

## Non-negotiable principles
1. **Frozen artifacts.** Once an experiment is built and deployed, its bundle is never rebuilt automatically. Shared code changing does not trigger rebuilds of existing experiments. Rebuilds are always an explicit, manual act.
2. **Append-only deploy tree.** Nothing in the deployed output is ever deleted or overwritten. New builds get new hash-named paths.
3. **The contract is the boundary.** The shell knows only `mount(el, ctx)` / `unmount()`. It never imports experiment code and never assumes an experiment's framework.
4. **Additive-only shared packages.** Shared packages never remove or narrow a public API. Breaking changes ship as a new named export, not a modified one.
5. **Copy over couple.** Shared UI components are copied into an experiment at scaffold time. There is no runtime UI dependency between experiments.
6. **Friction is the enemy.** Creating a new experiment should take about ten seconds and one command.

## Repository layout
_(populated as the workspace is built out — see individual milestones)_

## Commands
_(populated once the workspace tooling exists)_

## Settled technical decisions (do not re-litigate silently — flag first)
| Decision | Choice |
|---|---|
| Package manager | pnpm workspaces |
| Bundler | Vite only, across the shell, apps, vendor, and common |
| Bundle format | IIFE with globals — no ES modules, no import maps |
| Boundary | `mount(el, ctx)` function, not custom elements |
| CSS isolation | Build-time PostCSS scoping; Shadow DOM is a per-app opt-in |
| Hosting | GitHub Pages, deployed via GitHub Actions |

## Rules for any AI agent working here
1. Before implementing any non-trivial task, raise at least one risk, gap, or alternative; if genuinely fine as proposed, say so in one sentence.
2. Never silently override a settled decision above — flag it and wait for a response instead of re-litigating unprompted.
3. Comments and commit messages in this repo never conversationally attribute a decision to a person by name, and never reference any private planning repo or its files.
4. Code comments explain non-obvious **why** only — a hidden constraint, a subtle invariant, a workaround for a specific bug. Default to no comment. Never write a running decision log in comments: no timestamps, no "changed from X to Y because...", no per-change justification trail.
