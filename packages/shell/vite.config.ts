import { defineConfig } from 'vitest/config';
import { shell } from '@exp/build-preset';

export default defineConfig({
  ...shell({ entry: 'src/index.ts' }),
  test: {
    environment: 'jsdom',
  },
});
