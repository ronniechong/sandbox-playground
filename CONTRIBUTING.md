# Contributing

See [AGENTS.md](./AGENTS.md) for the project's non-negotiable principles,
repository layout, and settled technical decisions. This file covers one
rule in more depth: shared packages are additive-only.

## Shared packages are additive-only

`packages/contract`, `packages/build-preset`, and `packages/reset` are
consumed by every experiment, including ones that are already built and
deployed. Because rebuilds are always explicit (frozen artifacts), a
deployed experiment's bundle never picks up a shared-package change on its
own — but the _next_ experiment built against `main`, or an existing one
that later gets rebuilt, does.

That means a shared package can only ever grow:

- **Never remove or narrow a public export.** If `MountContext` needs a
  field renamed or dropped, add the new one and deprecate the old one in
  place — don't delete it. An old build's frozen `build.json` records
  which `contractVersion` it was built against; nothing re-validates an
  already-deployed bundle against today's contract shape.
- **Breaking changes ship as a new named export**, not a modified
  existing one (e.g. a hypothetical `mountV2` alongside `mount`, never a
  `mount` whose signature silently changed). Callers opt in explicitly.
- **This applies to behavior, not just types.** A CSS reset rule that
  changes visually, or a build-preset default that changes output shape,
  is a breaking change in the same sense as a removed TypeScript export —
  it silently changes what an app _not_ rebuilt today would look like the
  next time it _is_ rebuilt.
- **`packages/vendor` and `packages/common` are the deliberate exception.**
  They're deployed artifacts (a built, hashed bundle), not a library other
  code imports source from — see the vendor-pinning rules in
  [docs/AUTHORING.md](./docs/AUTHORING.md).

## Copy over couple

`packages/ui` components are copied into a new experiment by the
scaffolder (`pnpm new <slug> --with <name>`), not imported at runtime.
This is deliberate, not an oversight: it means changing a `packages/ui`
component can never silently change how an already-scaffolded experiment
looks or behaves. If you're tempted to make `packages/ui` a real runtime
dependency instead, that reintroduces exactly the coupling frozen
artifacts and additive-only packages both exist to avoid — raise it as a
discussion, don't just do it.

## Rules for any AI agent working here

See [AGENTS.md](./AGENTS.md#rules-for-any-ai-agent-working-here).
