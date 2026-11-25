import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { ASPECT_DIMS, FPS, type CompositionInputProps } from '../motion';
import { CompositionRoot } from './CompositionRoot';

const defaultProps: CompositionInputProps = {
  projectId: 'preview',
  assetBaseUrl: '',
  storyboard: {
    title: 'AGY Video Studio',
    aspect: '16:9',
    fps: FPS,
    theme: {
      accentColor: '#38bdf8',
      bgColor: '#080b12',
    },
    beats: [
      {
        id: 'beat-1',
        title: 'AGY Video Studio',
        subtitle: '60fps Motion Graphics Engine',
        narration: 'AGY Video Studio',
        preset: 'saas-motion',
      },
    ],
  },
  timings: {
    fps: FPS,
    totalFrames: 180,
    totalDurationSec: 3,
    waveformPeaks: [],
    beats: [
      {
        id: 'beat-1',
        startFrame: 0,
        endFrame: 180,
        durationFrames: 180,
        words: [],
      },
    ],
  },
  compiledScenes: {},
  showSafeZones: false,
  enableAudio: true,
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="AgyVideoStudio"
      component={CompositionRoot as unknown as React.FC<Record<string, unknown>>}
      durationInFrames={180}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={defaultProps as unknown as Record<string, unknown>}
      calculateMetadata={({ props }) => {
        const p = props as unknown as CompositionInputProps;
        const aspect = p?.storyboard?.aspect || '16:9';
        const dims = ASPECT_DIMS[aspect] || ASPECT_DIMS['16:9'];
        const fps = p?.timings?.fps || p?.storyboard?.fps || FPS;
        const durationInFrames = Math.max(
          1,
          p?.timings?.totalFrames ||
            (p?.storyboard?.beats?.length || 1) * 180
        );
        return {
          width: dims.width,
          height: dims.height,
          fps,
          durationInFrames,
        };
      }}
    />
  );
};

registerRoot(RemotionRoot);
