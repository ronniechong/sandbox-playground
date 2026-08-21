import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { experiment } from '@exp/build-preset';

export default defineConfig({
  ...experiment({
    slug: 'hello-world',
    entry: 'src/mount.ts',
    plugins: [tailwindcss()],
  }),
  test: {
    environment: 'jsdom',
  },
});
