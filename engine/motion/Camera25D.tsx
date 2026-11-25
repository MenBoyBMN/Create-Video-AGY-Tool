import React, { createContext, useContext, useMemo } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { DEPTH_FACTORS, DepthLayerName, EASINGS, springProgress } from './motionTokens';
import type { CameraMoveType } from './types';

interface CameraState {
  tx: number;
  ty: number;
  scaleDelta: number;
  rotateZ: number;
  tiltX: number;
  tiltY: number;
  focusDepth: number;
  rackFocusStrength: number;
}

const defaultCameraState: CameraState = {
  tx: 0,
  ty: 0,
  scaleDelta: 0,
  rotateZ: 0,
  tiltX: 0,
  tiltY: 0,
  focusDepth: 1.0,
  rackFocusStrength: 0,
};

const Camera25DContext = createContext<CameraState>(defaultCameraState);

export interface Camera25DRigProps {
  move?: CameraMoveType;
  durationFrames?: number;
  enableDrift?: boolean;
  enableGrain?: boolean;
  grainOpacity?: number;
  focusDepth?: number;
  rackFocusStrength?: number;
  bgColor?: string;
  children: React.ReactNode;
}

export const Camera25DRig: React.FC<Camera25DRigProps> = ({
  move = 'slow_push_in',
  durationFrames,
  enableDrift = true,
  enableGrain = true,
  grainOpacity = 0.045,
  focusDepth = 1.0,
  rackFocusStrength = 4.5,
  bgColor = '#080b12',
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const total = Math.max(1, durationFrames ?? durationInFrames);
  const t = Math.min(1, Math.max(0, frame / total));
  const sec = frame / fps;

  const state = useMemo<CameraState>(() => {
    let tx = 0;
    let ty = 0;
    let scaleDelta = 0;
    let rotateZ = 0;
    let tiltX = 0;
    let tiltY = 0;
    let dynamicFocus = focusDepth;

    switch (move) {
      case 'slow_push_in': {
        const p = interpolate(t, [0, 1], [0, 1], { easing: EASINGS.SMOOTH_DECEL });
        scaleDelta = p * 0.085;
        ty = -p * 10;
        break;
      }
      case 'slow_pull_out': {
        const p = interpolate(t, [0, 1], [0, 1], { easing: EASINGS.SMOOTH_DECEL });
        scaleDelta = (1 - p) * 0.095;
        ty = (1 - p) * 10;
        break;
      }
      case 'pan_left': {
        const p = interpolate(t, [0, 1], [0, 1], { easing: EASINGS.CINEMATIC_IN_OUT });
        tx = interpolate(p, [0, 1], [46, -46]);
        scaleDelta = 0.04;
        break;
      }
      case 'pan_right': {
        const p = interpolate(t, [0, 1], [0, 1], { easing: EASINGS.CINEMATIC_IN_OUT });
        tx = interpolate(p, [0, 1], [-46, 46]);
        scaleDelta = 0.04;
        break;
      }
      case 'impact_shake': {
        const punch = springProgress(frame, fps, 'HEAVY_IMPACT', 0);
        const decay = Math.exp(-frame * 0.14);
        tx = Math.sin(frame * 2.4) * 20 * decay;
        ty = Math.cos(frame * 3.1) * 14 * decay;
        rotateZ = Math.sin(frame * 1.9) * 1.1 * decay;
        scaleDelta = interpolate(punch, [0, 1], [0.11, 0.02]);
        break;
      }
      case 'orbit_tilt': {
        const p = interpolate(t, [0, 1], [0, 1], { easing: EASINGS.EDITORIAL });
        tx = Math.sin(p * Math.PI) * 14;
        ty = Math.cos(p * Math.PI) * 8 - 8;
        tiltY = interpolate(p, [0, 1], [-2.2, 2.2]);
        tiltX = interpolate(p, [0, 1], [1.4, -1.0]);
        scaleDelta = 0.024;
        dynamicFocus = interpolate(p, [0, 0.25, 1], [0.8, 1.0, 1.0]);
        break;
      }
      case 'static':
      default:
        break;
    }

    // Subtle organic breathing drift so frames feel alive
    if (enableDrift) {
      tx += Math.sin(sec * 0.9) * 5.5 + Math.cos(sec * 0.43) * 2.5;
      ty += Math.cos(sec * 0.72) * 4.5 + Math.sin(sec * 0.35) * 2.0;
      rotateZ += Math.sin(sec * 0.55) * 0.22;
    }

    // Brief opening rack-focus settle into subject plane
    const settle = interpolate(frame, [0, 22], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: EASINGS.EDITORIAL,
    });
    dynamicFocus = interpolate(settle, [0, 1], [dynamicFocus - 0.18, dynamicFocus]);

    return {
      tx,
      ty,
      scaleDelta,
      rotateZ,
      tiltX,
      tiltY,
      focusDepth: dynamicFocus,
      rackFocusStrength,
    };
  }, [move, t, sec, frame, fps, enableDrift, focusDepth, rackFocusStrength]);

  // 12fps editorial grain seed (60fps / 5 = 12fps)
  const grainSeed = Math.floor(frame / 5) % 97;

  return (
    <Camera25DContext.Provider value={state}>
      <AbsoluteFill
        style={{
          backgroundColor: bgColor,
          overflow: 'hidden',
          perspective: 1400,
        }}
      >
        {children}

        {enableGrain && (
          <AbsoluteFill
            style={{
              pointerEvents: 'none',
              opacity: grainOpacity,
              mixBlendMode: 'overlay',
            }}
          >
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <filter id={`agy-grain-${grainSeed}`}>
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.78"
                  numOctaves="2"
                  seed={grainSeed}
                  stitchTiles="stitch"
                />
                <feColorMatrix type="saturate" values="0" />
              </filter>
              <rect width="100%" height="100%" filter={`url(#agy-grain-${grainSeed})`} />
            </svg>
          </AbsoluteFill>
        )}
      </AbsoluteFill>
    </Camera25DContext.Provider>
  );
};

export interface ParallaxLayerProps {
  depth?: DepthLayerName | number;
  disableRackFocus?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export const ParallaxLayer: React.FC<ParallaxLayerProps> = ({
  depth = 'subject',
  disableRackFocus = false,
  style,
  children,
}) => {
  const cam = useContext(Camera25DContext);
  const z = typeof depth === 'number' ? depth : DEPTH_FACTORS[depth];

  const tx = cam.tx * z;
  const ty = cam.ty * z;
  const scale = 1 + cam.scaleDelta * z;
  const rotateZ = cam.rotateZ * Math.min(1.1, z);
  const tiltX = cam.tiltX * z;
  const tiltY = cam.tiltY * z;

  const focusDiff = Math.abs(z - cam.focusDepth);
  const blurPx = disableRackFocus
    ? 0
    : Math.max(0, (focusDiff - 0.12) * cam.rackFocusStrength);

  return (
    <AbsoluteFill
      style={{
        transform: `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0px) scale(${scale.toFixed(4)}) rotateZ(${rotateZ.toFixed(3)}deg) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`,
        filter: blurPx > 0.15 ? `blur(${blurPx.toFixed(2)}px)` : undefined,
        willChange: 'transform',
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
