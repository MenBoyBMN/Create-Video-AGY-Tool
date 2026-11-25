import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  Camera25DRig,
  ParallaxLayer,
  SAFE_ZONES,
  editorialProgress,
  hexToRgba,
  springProgress,
  type CustomSceneProps,
} from '@agy/motion';

const BARS = [
  { label: 'Kịch bản & Hook', before: 35, after: 94, color: '#38bdf8' },
  { label: 'Đồng bộ Audio RMS', before: 28, after: 98, color: '#8b5cf6' },
  { label: 'Hoạt ảnh 60FPS', before: 42, after: 100, color: '#10b981' },
];

export default function Beat2VelocityChartScene({
  beat,
  beatTiming,
  aspect,
  accentColor,
  bgColor,
}: CustomSceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const safe = SAFE_ZONES[aspect];
  const isVertical = aspect === '9:16';

  const headerIn = springProgress(frame, fps, 'SMOOTH_UI', 4);
  const cardIn = springProgress(frame, fps, 'HEAVY_IMPACT', 10);
  const pulse = 0.5 + 0.5 * Math.sin((frame / fps) * 4.2);

  return (
    <Camera25DRig
      move={beat.cameraMove ?? 'slow_push_in'}
      durationFrames={beatTiming.durationFrames}
      bgColor={bgColor}
    >
      {/* Background 0.28x: Atmospheric dual-tone glow */}
      <ParallaxLayer depth="background">
        <div
          style={{
            position: 'absolute',
            inset: -120,
            background: `radial-gradient(circle at 28% 30%, ${hexToRgba(accentColor, 0.32)} 0%, transparent 52%), radial-gradient(circle at 78% 72%, rgba(56, 189, 248, 0.22) 0%, transparent 48%), linear-gradient(155deg, ${bgColor} 0%, #05070e 100%)`,
          }}
        />
      </ParallaxLayer>

      {/* Midground 0.65x: Floating wireframe orbit rings */}
      <ParallaxLayer depth="midground">
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '48%',
            width: 820,
            height: 820,
            marginLeft: -410,
            marginTop: -410,
            borderRadius: '50%',
            border: `1px solid ${hexToRgba(accentColor, 0.18)}`,
            transform: `rotate(${frame * 0.12}deg)`,
          }}
        />
      </ParallaxLayer>

      {/* Subject 1.0x: Bespoke 60fps Velocity & Studio Loudness Dashboard */}
      <ParallaxLayer depth="subject" disableRackFocus>
        <div
          style={{
            position: 'absolute',
            top: safe.top,
            bottom: safe.bottom + (isVertical ? 115 : 85),
            left: safe.left,
            right: safe.right,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 30,
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
            color: '#f8fafc',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 24,
              transform: `translateY(${(1 - headerIn) * 28}px)`,
              opacity: headerIn,
            }}
          >
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 16px',
                  borderRadius: 999,
                  background: hexToRgba(accentColor, 0.2),
                  border: `1px solid ${hexToRgba(accentColor, 0.5)}`,
                  color: '#ddd6fe',
                  fontSize: 17,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  marginBottom: 14,
                }}
              >
                ✦ CUSTOM SCENE CODE · 60FPS
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: isVertical ? 60 : 68,
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.06,
                }}
              >
                {beat.title}
              </h1>
            </div>

            {!isVertical && (
              <div
                style={{
                  padding: '14px 24px',
                  borderRadius: 18,
                  background: 'rgba(16, 185, 129, 0.14)',
                  border: '1px solid rgba(16, 185, 129, 0.45)',
                  textAlign: 'right',
                }}
              >
                <div style={{ fontSize: 14, color: '#6ee7b7', fontWeight: 700, letterSpacing: '0.1em' }}>
                  BROADCAST MASTER
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#ffffff', fontFamily: 'monospace' }}>
                  -14.0 LUFS
                </div>
              </div>
            )}
          </div>

          {/* Animated Spring Bar Chart Panel */}
          <div
            style={{
              background: 'rgba(12, 16, 28, 0.84)',
              border: `1px solid ${hexToRgba(accentColor, 0.35)}`,
              borderRadius: 28,
              padding: isVertical ? 28 : 38,
              boxShadow: `0 32px 90px rgba(0, 0, 0, 0.6), 0 0 60px ${hexToRgba(accentColor, 0.14)}`,
              transform: `scale(${0.93 + cardIn * 0.07}) translateY(${(1 - cardIn) * 32}px)`,
              opacity: cardIn,
              display: 'flex',
              flexDirection: 'column',
              gap: 26,
            }}
          >
            {BARS.map((bar, idx) => {
              const grow = editorialProgress(frame, 14 + idx * 10, 34);
              const val = Math.round(interpolate(grow, [0, 1], [bar.before, bar.after]));
              return (
                <div key={bar.label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 25, fontWeight: 700, color: '#e2e8f0' }}>{bar.label}</span>
                    <span
                      style={{
                        fontSize: 30,
                        fontWeight: 900,
                        fontFamily: 'monospace',
                        color: bar.color,
                      }}
                    >
                      {val}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 22,
                      borderRadius: 999,
                      background: 'rgba(255, 255, 255, 0.07)',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: `${val}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: `linear-gradient(90deg, ${hexToRgba(bar.color, 0.55)}, ${bar.color})`,
                        boxShadow: `0 0 24px ${hexToRgba(bar.color, 0.65)}`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ParallaxLayer>

      {/* Foreground 1.22x: Living studio glow accent */}
      <ParallaxLayer depth="foreground" style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            right: -50,
            bottom: 90,
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${hexToRgba(accentColor, 0.25 + pulse * 0.12)} 0%, transparent 70%)`,
          }}
        />
      </ParallaxLayer>
    </Camera25DRig>
  );
}
