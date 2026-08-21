# Reviving a frozen experiment

> Not yet validated against a real aged artifact. There are too few
> deployed experiments (only `hello-world`, none more than a few days old)
> to test this recipe against the case it exists for — a shared package or
> toolchain that has genuinely drifted since an app's last build. Validate
> it once such an app exists; see the maintenance note in
> [AUTHORING.md](./AUTHORING.md).

An experiment's dist output is frozen at deploy time — nothing rebuilds it
automatically. Meanwhile `main`, the toolchain, and shared packages keep
moving. Reviving an old experiment (fixing a bug, adding a feature) means
building it again against the state the workspace was in when it was last
built, not against today's `main`.

## Recipe

1. Find the commit the experiment was last built from. `pnpm status` names
   it as the recorded source tree, or read it directly:

   ```sh
   cat apps/<slug>/dist/<hash>/build.json
   ```

   The `<hash>` directory is whichever the deployed registry currently
   points at (`registry.json`'s `entry.js` for that slug), not necessarily
   the newest one on disk locally.

2. Add an isolated worktree at that commit — this leaves your normal
   checkout untouched:

   ```sh
   git worktree add /tmp/revive-<slug> <commit-sha>
   cd /tmp/revive-<slug>
   ```

3. Install exactly what that commit's lockfile specifies:

   ```sh
   pnpm install --frozen-lockfile
   ```

   If this fails, the toolchain has moved far enough that the recorded
   lockfile can't be satisfied anymore (a registry removed an old package
   version, Node's own version requirement changed, etc.) — that's a
   genuine revival blocker, not a bug in this recipe.

4. Build just that app:

   ```sh
   pnpm --filter <slug> run build
   ```

5. Make your change inside the worktree, rebuild, verify locally
   (`pnpm --filter <slug> run test`, `pnpm --filter <slug> run typecheck`),
   then bring the change back to `main` as a normal PR — cherry-pick or
   diff the file(s) you touched, don't merge the worktree branch wholesale,
   since `main` has moved since the commit you built from.

6. Clean up the worktree once done:

   ```sh
   cd -
   git worktree remove /tmp/revive-<slug>
   ```

## Why not just build on current `main`?

Building on `main` instead of the recorded commit silently mixes in every
shared-package/toolchain change since the experiment was last built —
exactly what the frozen-artifacts principle exists to prevent. The recipe's
whole point is producing a build that differs from the last deployed one
**only** by your intended change.
