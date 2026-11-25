import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { compileCustomSceneFile } from '../engine/runtime/compileCustomScene.mjs';
import { evaluateCompiledCustomScene } from '../engine/runtime/customSceneEval';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-custom-scene-test-'));

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Dynamic CustomScene.tsx Compiler & Sandbox Evaluator', () => {
  it('compiles a valid TSX CustomScene importing @agy/motion, lucide-react, @remotion/paths, and roughjs', async () => {
    const file = path.join(tmpDir, 'ValidHeroScene.tsx');
    fs.writeFileSync(
      file,
      `
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Sparkles } from 'lucide-react';
import { evolvePath } from '@remotion/paths';
import rough from 'roughjs';
import { Camera25DRig, ParallaxLayer, RoughBox, SPRINGS, getAdaptivePalette } from '@agy/motion';

export default function ValidHeroScene({ beat }: any) {
  const frame = useCurrentFrame();
  const pal = getAdaptivePalette('#F4EFE6', '#C81E1E');
  const gen = rough.generator({ options: { seed: 7 } });
  const evo = evolvePath(0.5, 'M 0 0 L 100 0');
  return (
    <Camera25DRig move="slow_push_in" bgColor={pal.bgColor}>
      <ParallaxLayer depth="subject">
        <AbsoluteFill>
          <Sparkles size={24} />
          <RoughBox width={200} height={80}>
            {beat.title} - {frame} - {SPRINGS.SNAPPY.stiffness} - {evo.strokeDasharray} - {typeof gen.rectangle}
          </RoughBox>
        </AbsoluteFill>
      </ParallaxLayer>
    </Camera25DRig>
  );
}
`,
      'utf-8'
    );

    const compiled = await compileCustomSceneFile(file, { appRoot: process.cwd() });
    expect(compiled.ok).toBe(true);
    expect(compiled.sceneName).toBe('ValidHeroScene');
    expect(compiled.code).toBeTruthy();

    const evaluated = evaluateCompiledCustomScene(compiled);
    expect(evaluated.ok).toBe(true);
    expect(typeof evaluated.Component).toBe('function');
  });

  it('captures syntax errors gracefully with line & column metadata without crashing', async () => {
    const file = path.join(tmpDir, 'BrokenScene.tsx');
    fs.writeFileSync(
      file,
      `
import React from 'react';
export default function BrokenScene() {
  return <div className= >Broken JSX</div>;
}
`,
      'utf-8'
    );

    const compiled = await compileCustomSceneFile(file, { appRoot: process.cwd() });
    expect(compiled.ok).toBe(false);
    expect(compiled.error?.message).toBeTruthy();
    expect(compiled.error?.line).toBeGreaterThan(0);

    const evaluated = evaluateCompiledCustomScene(compiled);
    expect(evaluated.ok).toBe(false);
    expect(evaluated.errorMessage).toBeTruthy();
  });
});
