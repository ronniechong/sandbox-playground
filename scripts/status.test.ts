import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { RegistryEntry } from '@exp/shell';
import { checkApp, renderStatusTable } from './status.ts';

let repo: string | undefined;
let siteDir: string | undefined;

afterEach(() => {
  if (repo) rmSync(repo, { recursive: true, force: true });
  if (siteDir) rmSync(siteDir, { recursive: true, force: true });
  repo = undefined;
  siteDir = undefined;
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd }).toString().trim();
}

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'status-fixture-repo-'));
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'Test');
  for (const pkg of ['contract', 'reset', 'build-preset']) {
    mkdirSync(join(dir, 'packages', pkg), { recursive: true });
    writeFileSync(join(dir, 'packages', pkg, 'x.ts'), `// ${pkg}\n`);
  }
  mkdirSync(join(dir, 'apps', 'foo'), { recursive: true });
  writeFileSync(join(dir, 'apps', 'foo', 'index.ts'), 'export const x = 1;\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'initial');
  return dir;
}

/** Writes a `build.json` at the recorded provenance the registry entry's `entry.js` implies (mirrors what `hashOutputDir` + `git-tree.ts` write for a real build), plus the vendor/common manifests `pnpm status` reads. */
function makeSite(
  root: string,
  opts: {
    sourceTree?: string;
    toolchainTrees?: Record<string, string | undefined>;
    contractVersion?: number;
    vendorCurrent?: string;
    commonCurrent?: string;
  },
): string {
  const dir = mkdtempSync(join(tmpdir(), 'status-fixture-site-'));
  const buildDir = join(dir, 'apps', 'foo', 'dist', 'aaaa1111');
  mkdirSync(buildDir, { recursive: true });
  writeFileSync(
    join(buildDir, 'build.json'),
    JSON.stringify({
      contractVersion: opts.contractVersion ?? 1,
      sourceTree: opts.sourceTree,
      toolchainTrees: opts.toolchainTrees,
    }),
  );
  mkdirSync(join(dir, 'vendor'), { recursive: true });
  writeFileSync(
    join(dir, 'vendor', 'manifest.json'),
    JSON.stringify({ current: opts.vendorCurrent ?? 'vendor-AAAA.js' }),
  );
  mkdirSync(join(dir, 'common'), { recursive: true });
  writeFileSync(
    join(dir, 'common', 'manifest.json'),
    JSON.stringify({ current: opts.commonCurrent ?? 'common-AAAA.js' }),
  );
  return dir;
}

function entry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
  return {
    slug: 'foo',
    title: 'Foo',
    isEnabled: true,
    lastUpdated: '2026-08-21T00:00:00.000Z',
    vendorUrl: '/packages/vendor/dist/vendor-AAAA.js',
    commonUrl: '/packages/common/dist/common-AAAA.js',
    vendor: 'vendor-AAAA.js',
    common: 'common-AAAA.js',
    entry: { js: '/apps/foo/dist/aaaa1111/index.js' },
    contractVersion: 1,
    version: '0.1.0',
    tags: [],
    status: 'live',
    ...overrides,
  };
}

describe('checkApp: source staleness', () => {
  it('reports no finding when the recorded source tree matches HEAD', () => {
    repo = makeRepo();
    const sourceTree = git(repo, 'rev-parse', 'HEAD:apps/foo');
    siteDir = makeSite(repo, { sourceTree });

    const status = checkApp(entry(), { siteDir, repoRoot: repo, ref: 'HEAD' });
    expect(status.findings.find((f) => f.kind === 'source')).toBeUndefined();
  });

  it('flags error-level source staleness and a warning-level version drift when apps/foo changes after the recorded build', () => {
    repo = makeRepo();
    const recordedTree = git(repo, 'rev-parse', 'HEAD:apps/foo');
    siteDir = makeSite(repo, { sourceTree: recordedTree });

    writeFileSync(join(repo, 'apps', 'foo', 'index.ts'), 'export const x = 2;\n');
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'change foo');

    const status = checkApp(entry(), { siteDir, repoRoot: repo, ref: 'HEAD' });
    expect(status.findings).toContainEqual(
      expect.objectContaining({ kind: 'source', severity: 'error' }),
    );
    expect(status.findings).toContainEqual(
      expect.objectContaining({ kind: 'version', severity: 'warning' }),
    );
  });

  it('reports an info-level finding, not silent "up to date", when no build.json exists', () => {
    repo = makeRepo();
    siteDir = mkdtempSync(join(tmpdir(), 'status-fixture-empty-site-'));

    const status = checkApp(entry(), { siteDir, repoRoot: repo, ref: 'HEAD' });
    expect(status.findings).toContainEqual(
      expect.objectContaining({ kind: 'source', severity: 'info' }),
    );
  });
});

describe('checkApp: toolchain staleness', () => {
  it('names the drifted package(s) rather than reporting "toolchain" alone', () => {
    repo = makeRepo();
    const sourceTree = git(repo, 'rev-parse', 'HEAD:apps/foo');
    const contractTree = git(repo, 'rev-parse', 'HEAD:packages/contract');
    const resetTree = git(repo, 'rev-parse', 'HEAD:packages/reset');
    const buildPresetTree = git(repo, 'rev-parse', 'HEAD:packages/build-preset');
    siteDir = makeSite(repo, {
      sourceTree,
      toolchainTrees: { contract: contractTree, reset: resetTree, 'build-preset': buildPresetTree },
    });

    writeFileSync(join(repo, 'packages', 'contract', 'x.ts'), '// changed\n');
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'change contract');

    const status = checkApp(entry(), { siteDir, repoRoot: repo, ref: 'HEAD' });
    const toolchain = status.findings.find((f) => f.kind === 'toolchain');
    expect(toolchain?.detail).toBe('contract');
  });
});

describe('checkApp: vendor staleness', () => {
  it("flags when the registry entry's vendor/common no longer match the deploy tree's manifest", () => {
    repo = makeRepo();
    const sourceTree = git(repo, 'rev-parse', 'HEAD:apps/foo');
    siteDir = makeSite(repo, { sourceTree, vendorCurrent: 'vendor-NEW.js' });

    const status = checkApp(entry(), { siteDir, repoRoot: repo, ref: 'HEAD' });
    const vendor = status.findings.find((f) => f.kind === 'vendor');
    expect(vendor?.detail).toContain('vendor-AAAA.js -> vendor-NEW.js');
  });
});

describe('checkApp: contract staleness', () => {
  it('flags when the recorded contract version is behind the current one', () => {
    repo = makeRepo();
    const sourceTree = git(repo, 'rev-parse', 'HEAD:apps/foo');
    siteDir = makeSite(repo, { sourceTree, contractVersion: 0 as unknown as number });

    const status = checkApp(entry(), { siteDir, repoRoot: repo, ref: 'HEAD' });
    expect(status.findings.find((f) => f.kind === 'contract')).toBeDefined();
  });
});

describe('renderStatusTable', () => {
  it('renders a clean row, distinct from a silent omission, for an app with no findings', () => {
    const table = renderStatusTable([
      { slug: 'foo', version: '0.1.0', builtAt: 'x', findings: [] },
    ]);
    expect(table).toContain('foo');
    expect(table).toContain('up to date');
  });
});
