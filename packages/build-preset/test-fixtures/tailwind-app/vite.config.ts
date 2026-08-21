import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { experiment } from '@exp/build-preset';

export default defineConfig(
  experiment({
    slug: 'tailwind-app',
    entry: 'src/mount.ts',
    plugins: [tailwindcss()],
  }),
);
