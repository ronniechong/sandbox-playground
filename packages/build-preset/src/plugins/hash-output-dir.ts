import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

/**
 * Vite/Rollup has no built-in way to hash an entire output *directory*
 * (only individual filenames via `[hash]`, and that's derived per-chunk
 * before sibling files are known). Building to a fixed temp directory
 * and renaming it after the fact, once every emitted file's final
 * content is on disk, is the only way to get one hash covering the
 * whole build.
 *
 * `provenance`, when given, is written as `build.json` into the final
 * hashed directory after the rename — deliberately excluded from the
 * hash itself, since it records facts *about* this build (e.g. which
 * contract version it was built against) rather than build output. The
 * registry builder reads it back as frozen, build-time truth instead of
 * ever recomputing it from whatever is current at registry-build time.
 */
export function hashOutputDir(
  tempDirName: string,
  distDir: string,
  provenance?: () => Record<string, unknown>,
): Plugin {
  let root = '';

  return {
    name: 'hash-output-dir',
    apply: 'build',
    configResolved(config: ResolvedConfig) {
      // Never assume process.cwd() matches the project being built —
      // that only coincidentally holds when a CLI build first `cd`s
      // into the package directory. A programmatic `build({ root })`
      // call from elsewhere (tooling, tests) would otherwise silently
      // look for the temp dir in the wrong place.
      root = config.root;
    },
    closeBundle() {
      const resolvedDist = isAbsolute(distDir) ? distDir : join(root, distDir);
      const tempDir = join(resolvedDist, tempDirName);
      // closeBundle fires during Vite's cleanup even after an earlier
      // build error, since Rollup still closes the bundle on the way
      // out. Without this check, a genuine upstream failure (a bad
      // output.name, a resolution error, ...) gets masked by a confusing
      // ENOENT here instead of surfacing its real error message.
      if (!existsSync(tempDir)) return;
      const files = readdirSync(tempDir).sort();
      const hash = createHash('sha256');
      for (const file of files) {
        hash.update(file);
        hash.update(readFileSync(join(tempDir, file)));
      }
      const shortHash = hash.digest('hex').slice(0, 8);
      const finalDir = join(resolvedDist, shortHash);

      // Append-only: never overwrite an existing hash directory — its
      // content is already correct if the hash matches, and if it
      // somehow doesn't, silently overwriting would hide the mismatch.
      if (existsSync(finalDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      } else {
        renameSync(tempDir, finalDir);
        if (provenance) {
          writeFileSync(join(finalDir, 'build.json'), JSON.stringify(provenance(), null, 2) + '\n');
        }
      }
      console.log(`Built to ${finalDir}`);
    },
  };
}
