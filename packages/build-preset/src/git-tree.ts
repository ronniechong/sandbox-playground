import { execFileSync } from 'node:child_process';

/**
 * Tree SHA for a path at HEAD (`git rev-parse HEAD:<path>`), used to detect
 * whether an app or a shared package has changed since a recorded build.
 * Returns undefined rather than throwing for anything that isn't a clean
 * "yes, this exists at HEAD" answer (not a git repo, path not yet
 * committed, detached/shallow clone missing history) — staleness detection
 * degrades to "unknown" rather than failing a build over it.
 */
export interface GitTreeShaOptions {
  cwd?: string;
  /** Defaults to HEAD. `pnpm status --ref <sha>` passes a PR head commit here so "current" means that PR's tree, not main's. */
  rev?: string;
}

export function gitTreeSha(path: string, options: GitTreeShaOptions = {}): string | undefined {
  const { cwd = process.cwd(), rev = 'HEAD' } = options;
  try {
    return execFileSync('git', ['rev-parse', `${rev}:${path}`], {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}
