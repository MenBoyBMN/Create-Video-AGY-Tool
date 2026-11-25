import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { EASINGS, hexToRgba } from './motionTokens';
import type { TransitionType } from './types';

export interface BeatTransitionProps {
  type?: TransitionType;
  durationFrames: number;
  transitionFrames?: number;
  accentColor?: string;
  isFirst?: boolean;
  isLast?: boolean;
  children: React.ReactNode;
}

/**
 * Audio-Locked Beat Transition wrapper.
 * Runs entirely within the beat's Sequence frame window so audio & word timings never drift.
 */
export const BeatTransition: React.FC<BeatTransitionProps> = ({
  type = 'fade',
  durationFrames,
  transitionFrames = 14,
  accentColor = '#38bdf8',
  isFirst = false,
  isLast = false,
  children,
}) => {
  const frame = useCurrentFrame();
  const safeDur = Math.max(12, durationFrames);
  const tIn = Math.min(transitionFrames, Math.floor(safeDur * 0.25));
  const tOut = Math.min(10, Math.floor(safeDur * 0.18));

  const enter = isFirst || type === 'none'
    ? 1
    : interpolate(frame, [0, Math.max(1, tIn)], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: EASINGS.SMOOTH_DECEL,
      });

  const exitOpacity = isLast || type === 'none'
    ? 1
    : interpolate(frame, [safeDur - tOut, safeDur], [1, 0.88], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  let transform: string | undefined;
  let filter: string | undefined;
  let clipPath: string | undefined;
  let opacity = exitOpacity;
  let flashOpacity = 0;
  let glitchOffset = 0;

  switch (type) {
    case 'none':
      opacity = 1;
      break;
    case 'fade':
      opacity = (isFirst ? 1 : enter) * exitOpacity;
      break;
    case 'slide-left':
      if (!isFirst) {
        const dx = (1 - enter) * 180;
        transform = `translate3d(${dx.toFixed(1)}px, 0, 0)`;
        opacity = Math.min(1, enter * 1.45) * exitOpacity;
      }
      break;
    case 'slide-up':
      if (!isFirst) {
        const dy = (1 - enter) * 140;
        transform = `translate3d(0, ${dy.toFixed(1)}px, 0)`;
        opacity = Math.min(1, enter * 1.45) * exitOpacity;
      }
      break;
    case 'wipe':
      if (!isFirst) {
        const rightInset = ((1 - enter) * 100).toFixed(2);
        clipPath = `inset(0 ${rightInset}% 0 0)`;
      }
      break;
    case 'whip-pan':
      if (!isFirst) {
        const dx = (1 - enter) * 320;
        const blurPx = Math.sin(enter * Math.PI) * 10;
        transform = `translate3d(${dx.toFixed(1)}px, 0, 0) scale(${(1.03 - enter * 0.03).toFixed(4)})`;
        if (blurPx > 0.4) filter = `blur(${blurPx.toFixed(1)}px)`;
        opacity = Math.min(1, enter * 1.6) * exitOpacity;
      }
      break;
    case 'flash':
      flashOpacity = isFirst
        ? 0
        : interpolate(frame, [0, 4, 14], [0.75, 0.85, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
      break;
    case 'glitch':
      if (!isFirst && frame < 12) {
        const decay = 1 - frame / 12;
        glitchOffset = Math.sin(frame * 3.7) * 14 * decay;
        transform = `translate3d(${glitchOffset.toFixed(1)}px, ${(Math.cos(frame * 5.1) * 4 * decay).toFixed(1)}px, 0)`;
      }
      break;
  }

  return (
    <AbsoluteFill
      style={{
        transform,
        filter,
        clipPath,
        opacity,
      }}
    >
      {children}

      {flashOpacity > 0.01 && (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            background: `radial-gradient(circle at center, rgba(255,255,255,${flashOpacity.toFixed(3)}) 0%, ${hexToRgba(accentColor, flashOpacity * 0.65)} 70%, transparent 100%)`,
            mixBlendMode: 'screen',
          }}
        />
      )}

      {type === 'glitch' && !isFirst && frame < 12 && (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            boxShadow: `inset ${(glitchOffset * 0.8).toFixed(1)}px 0 0 rgba(255, 0, 85, 0.35), inset ${(-glitchOffset * 0.8).toFixed(1)}px 0 0 rgba(0, 229, 255, 0.35)`,
            background:
              frame % 3 === 0
                ? 'repeating-linear-gradient(0deg, transparent 0px, transparent 18px, rgba(255,255,255,0.08) 18px, rgba(255,255,255,0.08) 22px)'
                : undefined,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
