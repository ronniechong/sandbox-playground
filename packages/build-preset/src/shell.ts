import type { UserConfig } from 'vite';

export interface ShellOptions {
  entry: string;
}

/**
 * Vite config for the shell's own build: an IIFE, no externals (the shell
 * is vanilla TypeScript — see AGENTS.md, packages/shell may not import
 * React), no CSS scoping (the shell's CSS is intentionally global page
 * chrome, not an isolated experiment).
 */
export function shell({ entry }: ShellOptions): UserConfig {
  return {
    base: './',
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: entry,
        output: {
          format: 'iife',
          name: '__shell',
          entryFileNames: 'shell-[hash].js',
          assetFileNames: 'shell-[hash][extname]',
        },
      },
    },
  };
}
