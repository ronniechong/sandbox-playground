# Rollback

The deploy workflow keeps a full, append-only history of every deployed site
tree as commits on the `site-state` branch — a CI-internal branch, never
served by Pages and never a target for human pushes. Rolling back means
picking an older `site-state` commit and re-publishing exactly that tree,
with no rebuild.

`site-state` is an orphan branch with no shared history with `main` — GitHub's
"N ahead / M behind" comparison against `main` is not meaningful here and can
be ignored. The real record of what a `site-state` commit corresponds to is
its own commit message (subject: the driving `main` commit; body: what
changed) and `manifest.json`'s `deployedSha` field, not its position in a
shared commit graph.

Branch protection on `site-state` only blocks deletion — it does not require
a pull request and does not block force-pushes, since both CI's normal
commit-and-push and the rollback procedure below depend on pushing directly.

## Procedure

1. Find the commit to roll back to.

   ```sh
   git fetch origin site-state
   git log origin/site-state --oneline
   ```

2. Trigger the deploy workflow manually (`workflow_dispatch`) against that
   commit. There is no dedicated rollback input — the safe path is:

   - `git checkout` (or `git worktree add`) that older `site-state` commit
     locally into a `site/` directory.
   - Confirm it looks right: `cat site/registry.json`, spot-check a couple
     of app URLs.
   - Push it back onto the tip of `site-state`:

     ```sh
     git push origin <old-commit-sha>:site-state --force-with-lease
     ```

     This makes the chosen commit the new tip. The next scheduled or manual
     workflow run will treat it as "no changes" (nothing rebuilds) and
     redeploy the exact tree that was already live at that commit.

   - Alternatively, run only the artifact/deploy steps directly: check out
     `site-state` at the target commit, hand it straight to
     `actions/upload-pages-artifact` and `actions/deploy-pages`, skipping
     the verify/build/merge steps entirely. This is the fastest path when
     the regression is in the deploy pipeline itself rather than in an
     app's build output.

3. Verify the live site matches the rolled-back commit's tree (check the
   registry, check the specific app that regressed).

## Why this works

Every `site-state` commit is already a complete, self-contained site —
`upload-pages-artifact` doesn't care how the tree got there, only that it's
there. Because hashed app/vendor/common/shell paths are append-only and
never overwritten, an old commit's referenced hashes are guaranteed to
still resolve; nothing referenced by that commit can have been deleted by a
later one.
