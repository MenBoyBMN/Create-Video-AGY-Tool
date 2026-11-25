import React from 'react';
import * as JsxRuntime from 'react/jsx-runtime';
import * as ReactDom from 'react-dom';
import * as Remotion from 'remotion';
import * as LucideIcons from 'lucide-react';
import * as RemotionPaths from '@remotion/paths';
import * as RemotionShapes from '@remotion/shapes';
import * as RemotionNoise from '@remotion/noise';
import * as RemotionMotionBlur from '@remotion/motion-blur';
import * as RemotionTransitions from '@remotion/transitions';
import * as RemotionThree from '@remotion/three';
import * as Three from 'three';
import rough from 'roughjs';
import * as Recharts from 'recharts';
import * as AgyMotion from '../motion';
import type { CompiledSceneEntry, CustomSceneProps } from '../motion';

export interface EvaluatedCustomScene {
  ok: boolean;
  Component?: React.FC<CustomSceneProps>;
  errorMessage?: string;
  errorDetail?: string;
}

const MAX_CACHE_ENTRIES = 64;
const evaluatedCache = new Map<string, EvaluatedCustomScene>();

function cacheSceneResult(key: string, value: EvaluatedCustomScene): void {
  if (evaluatedCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = evaluatedCache.keys().next().value;
    if (oldestKey !== undefined) {
      evaluatedCache.delete(oldestKey);
    }
  }
  evaluatedCache.set(key, value);
}

function agyRequire(specifier: string): unknown {
  switch (specifier) {
    case 'react':
      return React;
    case 'react/jsx-runtime':
      return JsxRuntime;
    case 'react-dom':
      return ReactDom;
    case 'remotion':
      return Remotion;
    case '@agy/motion':
      return AgyMotion;
    case 'lucide-react':
      return LucideIcons;
    case '@remotion/paths':
      return RemotionPaths;
    case '@remotion/shapes':
      return RemotionShapes;
    case '@remotion/noise':
      return RemotionNoise;
    case '@remotion/motion-blur':
      return RemotionMotionBlur;
    case '@remotion/transitions':
      return RemotionTransitions;
    case '@remotion/three':
      return RemotionThree;
    case 'three':
      return Three;
    case 'roughjs':
      return rough;
    case 'recharts':
      return Recharts;
    default:
      if (specifier.includes('engine/motion')) {
        return AgyMotion;
      }
      throw new Error(
        `Unsupported import "${specifier}" in CustomScene. Allowed modules: react, remotion, @agy/motion, lucide-react, @remotion/paths, @remotion/shapes, @remotion/noise, @remotion/motion-blur, @remotion/transitions, @remotion/three, three, roughjs, recharts.`
      );
  }
}

export function evaluateCompiledCustomScene(entry: CompiledSceneEntry): EvaluatedCustomScene {
  if (!entry.ok || !entry.code) {
    const loc =
      entry.error?.line != null
        ? `Line ${entry.error.line}${entry.error.column != null ? `:${entry.error.column}` : ''}`
        : '';
    const detailParts = [loc, entry.error?.lineText].filter(Boolean);
    return {
      ok: false,
      errorMessage: entry.error?.message || 'Failed to compile custom scene.',
      errorDetail: detailParts.join('\n'),
    };
  }

  const cacheKey = `${entry.sceneName}:${entry.hash ?? entry.code.length}`;
  const cached = evaluatedCache.get(cacheKey);
  if (cached) return cached;

  try {
    const moduleObj: { exports: Record<string, unknown> } = { exports: {} };
    const fn = new Function('require', 'exports', 'module', entry.code);
    fn(agyRequire, moduleObj.exports, moduleObj);

    const exported = moduleObj.exports;
    const candidate =
      (typeof exported === 'function' ? exported : undefined) ||
      exported.default ||
      exported[entry.sceneName] ||
      Object.values(exported).find((v) => typeof v === 'function');

    if (typeof candidate !== 'function') {
      const res: EvaluatedCustomScene = {
        ok: false,
        errorMessage: `Custom scene "${entry.sceneName}" must export a React component as default (or named "${entry.sceneName}").`,
      };
      cacheSceneResult(cacheKey, res);
      return res;
    }

    const res: EvaluatedCustomScene = {
      ok: true,
      Component: candidate as React.FC<CustomSceneProps>,
    };
    cacheSceneResult(cacheKey, res);
    return res;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const res: EvaluatedCustomScene = {
      ok: false,
      errorMessage: error.message,
      errorDetail: error.stack,
    };
    cacheSceneResult(cacheKey, res);
    return res;
  }
}
