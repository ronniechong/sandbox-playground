import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { experiment } from '@exp/build-preset';

export default defineConfig({
  ...experiment({
    slug: '__SLUG__',
    entry: 'src/mount.ts',
    plugins: [tailwindcss()],
  }),
  test: {
    environment: 'jsdom',
  },
});
