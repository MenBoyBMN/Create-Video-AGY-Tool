import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

function resolveEsbuild(appRoot) {
  const candidates = [
    path.join(appRoot, 'package.json'),
    path.join(appRoot, 'resources', 'app', 'package.json'),
    path.resolve(process.cwd(), 'package.json'),
  ];
  for (const pkgPath of candidates) {
    if (fs.existsSync(pkgPath)) {
      try {
        const req = createRequire(pkgPath);
        return req('esbuild');
      } catch {
        // try next candidate
      }
    }
  }
  const fallbackReq = createRequire(import.meta.url);
  return fallbackReq('esbuild');
}

/**
 * Compile a single CustomScene .tsx file into CJS runnable in both Electron <Player> and Remotion Renderer.
 * Rewrites relative engine/motion imports to the virtual external "@agy/motion".
 */
export async function compileCustomSceneFile(filePath, options = {}) {
  const appRoot = options.appRoot || process.cwd();
  const sceneName = path.basename(filePath, path.extname(filePath));

  if (!fs.existsSync(filePath)) {
    return {
      sceneName,
      filePath,
      ok: false,
      error: {
        message: `Custom scene file not found: ${filePath}`,
        file: filePath,
      },
    };
  }

  const source = fs.readFileSync(filePath, 'utf-8');
  const hash = crypto.createHash('sha1').update(source).digest('hex').slice(0, 12);

  try {
    const esbuild = resolveEsbuild(appRoot);

    const EXTERNAL_MODULES = /^(react|react\/jsx-runtime|react-dom|remotion|@agy\/motion|lucide-react|@remotion\/paths|@remotion\/shapes|@remotion\/noise|@remotion\/motion-blur|@remotion\/transitions|@remotion\/three|three|roughjs|recharts)$/;

    const motionRedirectPlugin = {
      name: 'agy-motion-redirect',
      setup(build) {
        build.onResolve(
          { filter: EXTERNAL_MODULES },
          (args) => ({
            path: args.path,
            external: true,
          })
        );
        build.onResolve({ filter: /engine\/motion(\/index(\.ts)?)?$/ }, () => ({
          path: '@agy/motion',
          external: true,
        }));
      },
    };

    const result = await esbuild.build({
      entryPoints: [filePath],
      bundle: true,
      write: false,
      format: 'cjs',
      platform: 'browser',
      target: ['es2020'],
      jsx: 'automatic',
      plugins: [motionRedirectPlugin],
      logLevel: 'silent',
    });

    const output = result.outputFiles?.[0]?.text ?? '';
    return {
      sceneName,
      filePath,
      ok: true,
      code: output,
      hash,
    };
  } catch (err) {
    const firstErr = Array.isArray(err?.errors) && err.errors.length > 0 ? err.errors[0] : null;
    return {
      sceneName,
      filePath,
      ok: false,
      hash,
      error: {
        message: firstErr?.text || err?.message || String(err),
        file: firstErr?.location?.file || filePath,
        line: firstErr?.location?.line,
        column: firstErr?.location?.column,
        lineText: firstErr?.location?.lineText,
      },
    };
  }
}

/**
 * Compile all *.tsx files inside projects/<slug>/scenes/
 */
export async function compileProjectCustomScenes(projectDir, options = {}) {
  const scenesDir = path.join(projectDir, 'scenes');
  const map = {};
  if (!fs.existsSync(scenesDir)) {
    return map;
  }
  const files = fs
    .readdirSync(scenesDir)
    .filter((f) => f.endsWith('.tsx') || f.endsWith('.jsx') || f.endsWith('.ts'));

  for (const file of files) {
    const fullPath = path.join(scenesDir, file);
    const compiled = await compileCustomSceneFile(fullPath, options);
    map[compiled.sceneName] = compiled;
  }
  return map;
}
