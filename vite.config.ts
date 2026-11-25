import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: path.resolve(__dirname, 'app'),
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@agy/motion': path.resolve(__dirname, 'engine/motion/index.ts'),
      '@agy/presets': path.resolve(__dirname, 'engine/presets/index.ts'),
      '@agy/runtime': path.resolve(__dirname, 'engine/runtime/index.ts'),
      '@app': path.resolve(__dirname, 'app/src'),
    },
  },
  server: {
    port: 5179,
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname)],
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
  },
});
