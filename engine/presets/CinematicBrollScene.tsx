import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  AnimatedCounter,
  Camera25DRig,
  LightLeakOverlay,
  MediaLayer,
  ParallaxLayer,
  SAFE_ZONES,
  hexToRgba,
  springProgress,
  type CustomSceneProps,
} from '../motion';

export const CinematicBrollScene: React.FC<CustomSceneProps> = ({
  beat,
  beatTiming,
  beatIndex,
  totalBeats,
  aspect,
  accentColor,
  bgColor,
  resolveAssetUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const safe = SAFE_ZONES[aspect];
  const isVertical = aspect === '9:16';

  const titleIn = springProgress(frame, fps, 'SMOOTH_UI', 4);
  const subIn = springProgress(frame, fps, 'SMOOTH_UI', 10);
  const barIn = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
  const assetUrl = resolveAssetUrl(beat.asset);
  const kenBurns = beatIndex % 2 === 0 ? 'in' : 'pan';

  return (
    <Camera25DRig
      move={beat.cameraMove ?? 'slow_push_in'}
      durationFrames={beatTiming.durationFrames}
      bgColor={bgColor}
      grainOpacity={0.05}
    >
      {/* Background 0.28x: Full-bleed video B-roll or AI art with Ken Burns */}
      <ParallaxLayer depth="background" disableRackFocus>
        {assetUrl ? (
          <AbsoluteFill>
            <MediaLayer src={assetUrl} mediaType={beat.mediaType} kenBurns={kenBurns} />
            <AbsoluteFill
              style={{
                background: isVertical
                  ? 'linear-gradient(180deg, rgba(6,8,14,0.45) 0%, rgba(6,8,14,0.22) 38%, rgba(6,8,14,0.86) 85%, rgba(6,8,14,0.96) 100%)'
                  : 'linear-gradient(90deg, rgba(6,8,14,0.88) 0%, rgba(6,8,14,0.52) 52%, rgba(6,8,14,0.25) 100%), linear-gradient(180deg, rgba(6,8,14,0.25) 0%, rgba(6,8,14,0.78) 100%)',
              }}
            />
          </AbsoluteFill>
        ) : (
          <AbsoluteFill
            style={{
              background: `radial-gradient(circle at 72% 30%, ${hexToRgba(accentColor, 0.34)} 0%, transparent 54%), linear-gradient(155deg, ${bgColor} 0%, #05070c 100%)`,
            }}
          />
        )}
      </ParallaxLayer>

      {/* Midground 0.65x: Warm cinematic lens light leak */}
      <ParallaxLayer depth="midground" disableRackFocus>
        <LightLeakOverlay color={accentColor} opacity={0.22} />
      </ParallaxLayer>

      {/* Subject 1.0x: Lower-third / Hero Documentary Overlay */}
      <ParallaxLayer depth="subject" disableRackFocus>
        <div
          style={{
            position: 'absolute',
            top: safe.top,
            bottom: safe.bottom + (isVertical ? 115 : 80),
            left: safe.left,
            right: safe.right,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            gap: isVertical ? 18 : 20,
            fontFamily: "'Inter', 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif",
            color: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                background: accentColor,
                color: '#080b12',
                fontSize: isVertical ? 20 : 16,
                fontWeight: 900,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {beat.badge ?? `REEL 0${beatIndex + 1} / 0${totalBeats}`}
            </span>
            <div
              style={{
                height: 2,
                width: isVertical ? 120 : 200,
                background: `linear-gradient(90deg, ${accentColor}, transparent)`,
                transformOrigin: 'left center',
                transform: `scaleX(${barIn})`,
              }}
            />
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: isVertical ? 66 : 76,
              fontWeight: 900,
              lineHeight: 1.06,
              letterSpacing: '-0.03em',
              maxWidth: isVertical ? '100%' : '76%',
              textShadow: '0 8px 34px rgba(0,0,0,0.72)',
              transform: `translateY(${(1 - titleIn) * 30}px)`,
              opacity: titleIn,
            }}
          >
            {beat.title}
          </h1>

          {beat.subtitle && (
            <p
              style={{
                margin: 0,
                fontSize: isVertical ? 29 : 27,
                lineHeight: 1.42,
                color: '#e2e8f0',
                maxWidth: isVertical ? '100%' : '66%',
                borderLeft: `4px solid ${accentColor}`,
                paddingLeft: 18,
                textShadow: '0 4px 18px rgba(0,0,0,0.8)',
                transform: `translateY(${(1 - subIn) * 20}px)`,
                opacity: subIn,
              }}
            >
              {beat.subtitle}
            </p>
          )}

          {beat.metrics && beat.metrics.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 6 }}>
              {beat.metrics.slice(0, 3).map((m, i) => {
                const mPop = springProgress(frame, fps, 'SNAPPY', 14 + i * 5);
                return (
                  <div
                    key={`${m.label}-${i}`}
                    style={{
                      padding: '12px 20px',
                      borderRadius: 14,
                      background: 'rgba(8, 11, 18, 0.74)',
                      border: `1px solid ${hexToRgba(accentColor, 0.45)}`,
                      backdropFilter: 'blur(10px)',
                      transform: `translateY(${(1 - mPop) * 18}px)`,
                      opacity: mPop,
                    }}
                  >
                    <div style={{ fontSize: 32, fontWeight: 900, color: accentColor }}>
                      <AnimatedCounter value={m.value} startFrame={14 + i * 5} />
                    </div>
                    <div style={{ fontSize: 16, color: '#cbd5e1', fontWeight: 600 }}>{m.label}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ParallaxLayer>

      {/* Foreground 1.22x: Subtle cinema letterbox frame on 16:9 */}
      {!isVertical && (
        <ParallaxLayer depth="foreground" disableRackFocus style={{ pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 34, background: '#05070c' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 34, background: '#05070c' }} />
        </ParallaxLayer>
      )}
    </Camera25DRig>
  );
};
