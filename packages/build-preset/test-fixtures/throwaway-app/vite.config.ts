import { defineConfig } from 'vite';
import { experiment } from '@exp/build-preset';

export default defineConfig(
  experiment({
    slug: 'throwaway-app',
    entry: 'src/mount.ts',
  }),
);
