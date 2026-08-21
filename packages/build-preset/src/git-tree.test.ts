import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { gitTreeSha } from './git-tree.ts';

let dir: string | undefined;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd }).toString().trim();
}

/** A minimal real git repo standing in for the monorepo's `apps/<slug>` structure, so tree-SHA comparisons are exercised against real git plumbing rather than a mock. */
function makeFixtureRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), 'git-tree-fixture-'));
  git(repo, 'init', '-q');
  git(repo, 'config', 'user.email', 'test@example.com');
  git(repo, 'config', 'user.name', 'Test');
  mkdirSync(join(repo, 'apps', 'foo'), { recursive: true });
  writeFileSync(join(repo, 'apps', 'foo', 'index.ts'), 'export const x = 1;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'initial');
  return repo;
}

describe('gitTreeSha', () => {
  it('returns the same tree sha as `git rev-parse HEAD:<path>` for a real commit', () => {
    dir = makeFixtureRepo();
    const expected = git(dir, 'rev-parse', 'HEAD:apps/foo');
    expect(gitTreeSha('apps/foo', { cwd: dir })).toBe(expected);
  });

  it("changes when the path's content changes and a new commit is made", () => {
    dir = makeFixtureRepo();
    const before = gitTreeSha('apps/foo', { cwd: dir });

    writeFileSync(join(dir, 'apps', 'foo', 'index.ts'), 'export const x = 2;\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'change foo');
    const after = gitTreeSha('apps/foo', { cwd: dir });

    expect(after).not.toBe(before);
  });

  it('is unaffected by a dirty working tree — reads committed state only', () => {
    dir = makeFixtureRepo();
    const committed = gitTreeSha('apps/foo', { cwd: dir });

    writeFileSync(join(dir, 'apps', 'foo', 'index.ts'), 'export const x = 999; // uncommitted\n');
    expect(gitTreeSha('apps/foo', { cwd: dir })).toBe(committed);
  });

  it('reads an older commit when given an explicit rev, ignoring the current HEAD', () => {
    dir = makeFixtureRepo();
    const firstCommit = git(dir, 'rev-parse', 'HEAD');
    const firstTree = gitTreeSha('apps/foo', { cwd: dir });

    writeFileSync(join(dir, 'apps', 'foo', 'index.ts'), 'export const x = 2;\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'change foo');

    expect(gitTreeSha('apps/foo', { cwd: dir, rev: firstCommit })).toBe(firstTree);
  });

  it('returns undefined for a path that does not exist at the given rev', () => {
    dir = makeFixtureRepo();
    expect(gitTreeSha('apps/does-not-exist', { cwd: dir })).toBeUndefined();
  });

  it('returns undefined outside a git repository', () => {
    dir = mkdtempSync(join(tmpdir(), 'not-a-repo-'));
    expect(gitTreeSha('apps/foo', { cwd: dir })).toBeUndefined();
  });
});
