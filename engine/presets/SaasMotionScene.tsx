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

export const SaasMotionScene: React.FC<CustomSceneProps> = ({
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

  const heroIn = springProgress(frame, fps, 'SMOOTH_UI', 4);
  const badgeIn = springProgress(frame, fps, 'SNAPPY', 0);
  const subIn = springProgress(frame, fps, 'SMOOTH_UI', 10);
  const panelIn = springProgress(frame, fps, 'SMOOTH_UI', 14);
  const assetUrl = resolveAssetUrl(beat.asset);
  const pal = getAdaptivePalette(bgColor, accentColor);

  return (
    <Camera25DRig
      move={beat.cameraMove ?? 'slow_push_in'}
      durationFrames={beatTiming.durationFrames}
      bgColor={bgColor}
    >
      {/* Background depth 0.28x: Ambient architectural grid & glow orbs */}
      <ParallaxLayer depth="background">
        <div
          style={{
            position: 'absolute',
            inset: -120,
            background: pal.isLight
              ? `radial-gradient(circle at 22% 24%, ${hexToRgba(accentColor, 0.14)} 0%, transparent 48%), linear-gradient(160deg, ${bgColor} 0%, #eef2f6 100%)`
              : `radial-gradient(circle at 22% 24%, ${hexToRgba(accentColor, 0.28)} 0%, transparent 48%), radial-gradient(circle at 80% 78%, rgba(139, 92, 246, 0.22) 0%, transparent 52%), linear-gradient(160deg, ${bgColor} 0%, #05070c 100%)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: -80,
            backgroundImage: `linear-gradient(${hexToRgba(pal.isLight ? '#0f172a' : '#94a3b8', 0.08)} 1px, transparent 1px), linear-gradient(90deg, ${hexToRgba(pal.isLight ? '#0f172a' : '#94a3b8', 0.08)} 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 80%)',
          }}
        />
      </ParallaxLayer>

      {/* Midground depth 0.65x: Floating accent light rings */}
      <ParallaxLayer depth="midground">
        <div
          style={{
            position: 'absolute',
            top: isVertical ? 260 : 120,
            right: isVertical ? -90 : 110,
            width: isVertical ? 420 : 520,
            height: isVertical ? 420 : 520,
            borderRadius: '50%',
            border: `1.5px solid ${hexToRgba(accentColor, 0.22)}`,
            boxShadow: `0 0 120px ${hexToRgba(accentColor, 0.14)} inset`,
          }}
        />
      </ParallaxLayer>

      {/* Subject depth 1.0x: Main SaaS Showcase Layout */}
      <ParallaxLayer depth="subject" disableRackFocus>
        <div
          style={{
            position: 'absolute',
            top: safe.top,
            bottom: safe.bottom + (isVertical ? 110 : 75),
            left: safe.left,
            right: safe.right,
            display: 'flex',
            flexDirection: isVertical ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: isVertical ? 36 : 56,
            fontFamily: "'Inter', 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif",
            color: pal.textPrimary,
          }}
        >
          {/* Left / Top Editorial Block */}
          <div
            style={{
              flex: isVertical ? '0 0 auto' : '1 1 54%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: isVertical ? 18 : 22,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                alignSelf: 'flex-start',
                padding: '8px 18px',
                borderRadius: 999,
                background: hexToRgba(accentColor, 0.14),
                border: `1px solid ${hexToRgba(accentColor, 0.42)}`,
                color: accentColor,
                fontSize: isVertical ? 22 : 18,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                transform: `translateY(${(1 - badgeIn) * 18}px)`,
                opacity: badgeIn,
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: accentColor,
                  boxShadow: `0 0 14px ${accentColor}`,
                }}
              />
              {beat.badge ?? `SCENE 0${beatIndex + 1} / 0${totalBeats}`}
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: isVertical ? 68 : 74,
                fontWeight: 900,
                lineHeight: 1.06,
                letterSpacing: '-0.03em',
                color: pal.textPrimary,
                transform: `translateY(${(1 - heroIn) * 34}px)`,
                opacity: heroIn,
              }}
            >
              {beat.title}
            </h1>

            {beat.subtitle && (
              <p
                style={{
                  margin: 0,
                  fontSize: isVertical ? 30 : 28,
                  lineHeight: 1.4,
                  color: pal.textSecondary,
                  fontWeight: 500,
                  maxWidth: isVertical ? '100%' : 760,
                  transform: `translateY(${(1 - subIn) * 24}px)`,
                  opacity: subIn,
                }}
              >
                {beat.subtitle}
              </p>
            )}

            {/* Metrics row if provided */}
            {beat.metrics && beat.metrics.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(beat.metrics.length, 3)}, minmax(0, 1fr))`,
                  gap: 16,
                  marginTop: 10,
                }}
              >
                {beat.metrics.slice(0, 3).map((m, idx) => {
                  const mPop = springProgress(frame, fps, 'SNAPPY', 18 + idx * 6);
                  return (
                    <div
                      key={`${m.label}-${idx}`}
                      style={{
                        background: pal.surface,
                        border: `1px solid ${hexToRgba(accentColor, 0.32)}`,
                        borderRadius: 18,
                        padding: isVertical ? '18px 18px' : '20px 24px',
                        boxShadow: pal.shadow,
                        transform: `translateY(${(1 - mPop) * 26}px) scale(${0.95 + mPop * 0.05})`,
                        opacity: mPop,
                      }}
                    >
                      <div
                        style={{
                          fontSize: isVertical ? 40 : 44,
                          fontWeight: 900,
                          color: accentColor,
                          letterSpacing: '-0.03em',
                        }}
                      >
                        {m.value}
                      </div>
                      <div style={{ fontSize: isVertical ? 20 : 18, color: pal.textSecondary, marginTop: 4 }}>
                        {m.label}
                      </div>
                      {m.delta && (
                        <div style={{ fontSize: 16, color: '#34d399', fontWeight: 700, marginTop: 6 }}>
                          {m.delta}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right / Bottom Glass UI Card (Steps or Asset or Showcase Mockup) */}
          {(assetUrl || (beat.steps && beat.steps.length > 0)) && (
            <div
              style={{
                flex: isVertical ? '1 1 auto' : '0 0 43%',
                width: '100%',
                background: pal.surface,
                border: `1px solid ${pal.surfaceBorder}`,
                borderRadius: 28,
                padding: isVertical ? 24 : 30,
                boxShadow: `${pal.shadow}, 0 0 0 1px ${hexToRgba(accentColor, 0.18)}`,
                transform: `translateY(${(1 - panelIn) * 40}px) scale(${0.94 + panelIn * 0.06})`,
                opacity: panelIn,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Window chrome header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#f43f5e' }} />
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b' }} />
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981' }} />
                <span
                  style={{
                    marginLeft: 10,
                    fontSize: 16,
                    color: '#94a3b8',
                    fontFamily: 'monospace',
                  }}
                >
                  agy-studio://workspace/{beat.id}
                </span>
              </div>

              {assetUrl && (
                <div
                  style={{
                    borderRadius: 18,
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.1)',
                    maxHeight: isVertical ? 420 : 380,
                  }}
                >
                  <MediaLayer src={assetUrl} mediaType={beat.mediaType} kenBurns="in" />
                </div>
              )}

              {beat.steps && beat.steps.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {beat.steps.slice(0, 4).map((step, idx) => {
                    const sPop = springProgress(frame, fps, 'SNAPPY', 22 + idx * 7);
                    return (
                      <div
                        key={`${step}-${idx}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 16,
                          padding: '14px 18px',
                          borderRadius: 14,
                          background: pal.surfaceAlt,
                          border: `1px solid ${hexToRgba(accentColor, 0.2)}`,
                          transform: `translateX(${(1 - sPop) * 32}px)`,
                          opacity: sPop,
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: hexToRgba(accentColor, 0.2),
                            color: accentColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 19,
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {idx + 1}
                        </div>
                        <div style={{ fontSize: isVertical ? 24 : 21, color: pal.textPrimary, fontWeight: 600 }}>
                          {step}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </ParallaxLayer>

      {/* Foreground depth 1.22x: Subtle floating bokeh flare */}
      <ParallaxLayer depth="foreground" style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: -60,
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${hexToRgba(accentColor, 0.24)} 0%, transparent 70%)`,
            opacity: interpolate(frame, [0, 20], [0, 0.7], { extrapolateRight: 'clamp' }),
          }}
        />
      </ParallaxLayer>
    </Camera25DRig>
  );
};
