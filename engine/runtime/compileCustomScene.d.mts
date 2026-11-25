import type { CompiledSceneEntry } from '../motion/types';

export function compileCustomSceneFile(
  filePath: string,
  options?: { appRoot?: string }
): Promise<CompiledSceneEntry>;

export function compileProjectCustomScenes(
  projectDir: string,
  options?: { appRoot?: string }
): Promise<Record<string, CompiledSceneEntry>>;
