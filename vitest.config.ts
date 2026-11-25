import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@agy/motion': path.resolve(__dirname, 'engine/motion/index.ts'),
      '@agy/presets': path.resolve(__dirname, 'engine/presets/index.ts'),
      '@agy/runtime': path.resolve(__dirname, 'engine/runtime/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
