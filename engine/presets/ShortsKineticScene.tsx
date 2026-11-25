import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  Camera25DRig,
  MediaLayer,
  ParallaxLayer,
  SAFE_ZONES,
  getAdaptivePalette,
  hexToRgba,
  springProgress,
  type CustomSceneProps,
} from '../motion';

export const ShortsKineticScene: React.FC<CustomSceneProps> = ({
  beat,
  beatTiming,
  aspect,
  accentColor,
  bgColor,
  resolveAssetUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const safe = SAFE_ZONES[aspect];
  const isVertical = aspect === '9:16';
  const pal = getAdaptivePalette(bgColor, accentColor);

  const slam = springProgress(frame, fps, 'HEAVY_IMPACT', 2);
  const subPop = springProgress(frame, fps, 'ELASTIC', 10);
  const flash = interpolate(frame, [0, 14], [0.42, 0], { extrapolateRight: 'clamp' });
  const assetUrl = resolveAssetUrl(beat.asset);
  const heroMetric = beat.metrics?.[0];

  return (
    <Camera25DRig
      move={beat.cameraMove ?? 'impact_shake'}
      durationFrames={beatTiming.durationFrames}
      bgColor={bgColor}
    >
      {/* Background 0.28x */}
      <ParallaxLayer depth="background">
        <div
          style={{
            position: 'absolute',
            inset: -140,
            background: `radial-gradient(circle at 50% 38%, ${hexToRgba(accentColor, pal.isLight ? 0.2 : 0.36)} 0%, ${bgColor} 64%)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: -100,
            backgroundImage: `repeating-linear-gradient(-32deg, ${hexToRgba(accentColor, 0.06)} 0px, ${hexToRgba(accentColor, 0.06)} 2px, transparent 2px, transparent 42px)`,
          }}
        />
      </ParallaxLayer>

      {/* Midground 0.65x */}
      <ParallaxLayer depth="midground">
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '44%',
            width: isVertical ? 680 : 780,
            height: isVertical ? 680 : 780,
            marginLeft: isVertical ? -340 : -390,
            marginTop: isVertical ? -340 : -390,
            borderRadius: '50%',
            border: `2px solid ${hexToRgba(accentColor, 0.28)}`,
            transform: `scale(${0.86 + slam * 0.16})`,
          }}
        />
      </ParallaxLayer>

      {/* Subject 1.0x */}
      <ParallaxLayer depth="subject" disableRackFocus>
        <div
          style={{
            position: 'absolute',
            top: safe.top,
            bottom: safe.bottom + (isVertical ? 120 : 80),
            left: safe.left,
            right: safe.right,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 24,
            fontFamily: "'Inter', 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif",
            color: pal.textPrimary,
          }}
        >
          {beat.badge && (
            <div
              style={{
                padding: '10px 24px',
                borderRadius: 999,
                background: accentColor,
                color: pal.badgeTextOnAccent,
                fontSize: isVertical ? 24 : 20,
                fontWeight: 900,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                transform: `scale(${0.7 + slam * 0.3})`,
                boxShadow: `0 12px 36px ${hexToRgba(accentColor, 0.45)}`,
              }}
            >
              {beat.badge}
            </div>
          )}

          {heroMetric && (
            <div
              style={{
                fontSize: isVertical ? 148 : 132,
                fontWeight: 900,
                lineHeight: 0.95,
                letterSpacing: '-0.04em',
                color: accentColor,
                textShadow: pal.isLight ? 'none' : `0 10px 50px ${hexToRgba(accentColor, 0.55)}`,
                transform: `scale(${0.65 + slam * 0.35})`,
              }}
            >
              {heroMetric.value}
            </div>
          )}

          <h1
            style={{
              margin: 0,
              fontSize: isVertical ? 76 : 86,
              fontWeight: 900,
              lineHeight: 1.04,
              letterSpacing: '-0.03em',
              maxWidth: isVertical ? '96%' : '82%',
              color: pal.textPrimary,
              textShadow: pal.isLight ? 'none' : '0 8px 34px rgba(0, 0, 0, 0.6)',
              transform: `scale(${0.84 + slam * 0.16}) translateY(${(1 - slam) * 34}px)`,
              opacity: slam,
            }}
          >
            {beat.title}
          </h1>

          {beat.subtitle && (
            <div
              style={{
                fontSize: isVertical ? 32 : 30,
                fontWeight: 600,
                color: pal.textSecondary,
                maxWidth: isVertical ? '92%' : '70%',
                lineHeight: 1.35,
                transform: `translateY(${(1 - subPop) * 20}px)`,
                opacity: subPop,
              }}
            >
              {beat.subtitle}
            </div>
          )}

          {assetUrl && (
            <div
              style={{
                width: isVertical ? '82%' : 520,
                height: isVertical ? 360 : 270,
                borderRadius: 24,
                overflow: 'hidden',
                border: `2px solid ${hexToRgba(accentColor, 0.5)}`,
                boxShadow: pal.shadow,
                transform: `scale(${0.9 + subPop * 0.1})`,
                opacity: subPop,
              }}
            >
              <MediaLayer src={assetUrl} mediaType={beat.mediaType} kenBurns="in" />
            </div>
          )}
        </div>
      </ParallaxLayer>

      {/* Foreground 1.22x */}
      <ParallaxLayer depth="foreground" style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: accentColor,
            opacity: flash,
            mixBlendMode: pal.isLight ? 'normal' : 'screen',
          }}
        />
      </ParallaxLayer>
    </Camera25DRig>
  );
};
