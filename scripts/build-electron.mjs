import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function buildElectron() {
  const shared = {
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    external: ['electron', 'esbuild'],
    sourcemap: false,
  };

  await Promise.all([
    esbuild.build({
      ...shared,
      entryPoints: [path.join(root, 'app', 'electron', 'main.ts')],
      outfile: path.join(root, 'dist-electron', 'main.cjs'),
    }),
    esbuild.build({
      ...shared,
      entryPoints: [path.join(root, 'app', 'electron', 'preload.ts')],
      outfile: path.join(root, 'dist-electron', 'preload.cjs'),
    }),
  ]);

  console.log('[build-electron] Built dist-electron/main.cjs & preload.cjs');
}

buildElectron().catch((err) => {
  console.error(err);
  process.exit(1);
});
