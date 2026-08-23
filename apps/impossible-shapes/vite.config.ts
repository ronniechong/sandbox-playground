import { defineConfig } from 'vitest/config';
import { experiment } from '@exp/build-preset';

export default defineConfig({
  ...experiment({
    slug: 'impossible-shapes',
    entry: 'src/mount.ts',
  }),
  test: {
    environment: 'jsdom',
  },
});
