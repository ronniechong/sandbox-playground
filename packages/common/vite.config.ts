import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: 'src/entry.ts',
      output: {
        format: 'iife',
        name: '__commonEntry',
        entryFileNames: 'common-[hash].js',
      },
    },
  },
});
