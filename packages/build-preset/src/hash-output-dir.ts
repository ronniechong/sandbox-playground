import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Vite/Rollup has no built-in way to hash an entire output *directory*
 * (only individual filenames via `[hash]`, and that's derived per-chunk
 * before sibling files are known). Building to a fixed temp directory
 * and renaming it after the fact, once every emitted file's final
 * content is on disk, is the only way to get one hash covering the
 * whole build.
 */
export function hashOutputDir(tempDirName: string, distDir: string): Plugin {
  return {
    name: 'hash-output-dir',
    apply: 'build',
    closeBundle() {
      const tempDir = join(distDir, tempDirName);
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
      const finalDir = join(distDir, shortHash);

      // Append-only: never overwrite an existing hash directory — its
      // content is already correct if the hash matches, and if it
      // somehow doesn't, silently overwriting would hide the mismatch.
      if (existsSync(finalDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      } else {
        renameSync(tempDir, finalDir);
      }
      console.log(`Built to ${finalDir}`);
    },
  };
}
