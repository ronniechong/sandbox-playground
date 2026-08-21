import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Manifest {
  vendor: string;
  common: string;
}

function latestFile(dir: string, prefix: string): string {
  const matches = readdirSync(dir).filter((f) => f.startsWith(`${prefix}-`) && f.endsWith('.js'));
  if (matches.length === 0) {
    throw new Error(`No built ${prefix}-*.js found in ${dir}. Run the build first.`);
  }
  // Content-hashed filenames don't sort meaningfully; if more than one
  // exists (a stale artifact from a previous run), that's a signal to
  // clean the dist dir, not something to silently pick between.
  if (matches.length > 1) {
    throw new Error(
      `Expected exactly one ${prefix}-*.js in ${dir}, found ${matches.length}: ${matches.join(', ')}`,
    );
  }
  return matches[0]!;
}

const vendorDist = join(import.meta.dirname, '..', 'packages', 'vendor', 'dist');
const commonDist = join(import.meta.dirname, '..', 'packages', 'common', 'dist');

const manifest: Manifest = {
  vendor: latestFile(vendorDist, 'vendor'),
  common: latestFile(commonDist, 'common'),
};

const outDir = join(import.meta.dirname, '..', 'dist');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'manifest.json');
writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote ${outPath}`);
console.log(manifest);
