import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  Camera25DRig,
  MediaLayer,
  ParallaxLayer,
  SAFE_ZONES,
  editorialProgress,
  getAdaptivePalette,
  hexToRgba,
  springProgress,
  type CustomSceneProps,
} from '../motion';

export const ExplainerEditorialScene: React.FC<CustomSceneProps> = ({
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
  const pal = getAdaptivePalette(bgColor, accentColor);

  const ruleGrow = editorialProgress(frame, 2, 26);
  const titleIn = springProgress(frame, fps, 'SMOOTH_UI', 5);
  const bodyIn = springProgress(frame, fps, 'SMOOTH_UI', 13);
  const assetUrl = resolveAssetUrl(beat.asset);

  return (
    <Camera25DRig
      move={beat.cameraMove ?? 'orbit_tilt'}
      durationFrames={beatTiming.durationFrames}
      bgColor={bgColor}
      grainOpacity={0.05}
    >
      {/* Background 0.28x: Editorial atmospheric gradient + vertical column guides */}
      <ParallaxLayer depth="background">
        <div
          style={{
            position: 'absolute',
            inset: -120,
            background: pal.isLight
              ? `radial-gradient(circle at 75% 18%, ${hexToRgba(accentColor, 0.14)} 0%, transparent 50%), ${bgColor}`
              : `radial-gradient(circle at 75% 18%, ${hexToRgba(accentColor, 0.22)} 0%, transparent 50%), linear-gradient(180deg, #0d111a 0%, ${bgColor} 100%)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0 140px',
            opacity: pal.isLight ? 0.1 : 0.14,
          }}
        >
          {[0, 1, 2, 3].map((col) => (
            <div
              key={col}
              style={{ width: 1, height: '100%', background: pal.isLight ? '#334155' : '#94a3b8' }}
            />
          ))}
        </div>
      </ParallaxLayer>

      {/* Midground 0.65x: Oversized editorial watermark chapter index */}
      <ParallaxLayer depth="midground">
        <div
          style={{
            position: 'absolute',
            top: isVertical ? 180 : 50,
            right: isVertical ? 40 : 100,
            fontSize: isVertical ? 260 : 340,
            fontWeight: 900,
            lineHeight: 1,
            color: hexToRgba(accentColor, pal.isLight ? 0.12 : 0.08),
            fontFamily: "'Inter', Georgia, serif",
            userSelect: 'none',
          }}
        >
          0{beatIndex + 1}
        </div>
      </ParallaxLayer>

      {/* Subject 1.0x: Editorial Frame */}
      <ParallaxLayer depth="subject" disableRackFocus>
        <div
          style={{
            position: 'absolute',
            top: safe.top,
            bottom: safe.bottom + (isVertical ? 110 : 75),
            left: safe.left,
            right: safe.right,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: isVertical ? 28 : 30,
            fontFamily: "'Inter', 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif",
            color: pal.textPrimary,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <span
              style={{
                fontSize: isVertical ? 22 : 18,
                fontWeight: 800,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: accentColor,
              }}
            >
              {beat.badge ?? `CHAPTER 0${beatIndex + 1} — 0${totalBeats}`}
            </span>
            <div
              style={{
                height: 2,
                flex: 1,
                background: `linear-gradient(90deg, ${accentColor}, transparent)`,
                transformOrigin: 'left center',
                transform: `scaleX(${ruleGrow})`,
              }}
            />
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: isVertical ? 66 : 78,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: '-0.025em',
              maxWidth: isVertical ? '100%' : '82%',
              color: pal.textPrimary,
              transform: `translateY(${(1 - titleIn) * 32}px)`,
              opacity: titleIn,
            }}
          >
            {beat.title}
          </h1>

          {beat.subtitle && (
            <p
              style={{
                margin: 0,
                fontSize: isVertical ? 30 : 29,
                lineHeight: 1.45,
                color: pal.textSecondary,
                maxWidth: isVertical ? '100%' : '72%',
                borderLeft: `4px solid ${accentColor}`,
                paddingLeft: 22,
                transform: `translateY(${(1 - bodyIn) * 24}px)`,
                opacity: bodyIn,
              }}
            >
              {beat.subtitle}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: isVertical ? 'column' : 'row',
              gap: 24,
              marginTop: 8,
            }}
          >
            {assetUrl && (
              <div
                style={{
                  flex: isVertical ? '0 0 auto' : '0 0 42%',
                  borderRadius: 20,
                  overflow: 'hidden',
                  border: `1px solid ${hexToRgba(accentColor, 0.35)}`,
                  maxHeight: isVertical ? 360 : 320,
                  boxShadow: pal.shadow,
                }}
              >
                <MediaLayer src={assetUrl} mediaType={beat.mediaType} kenBurns="in" />
              </div>
            )}

            {beat.steps && beat.steps.length > 0 && (
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: isVertical ? '1fr' : '1fr 1fr', gap: 16 }}>
                {beat.steps.slice(0, 4).map((step, i) => {
                  const sIn = springProgress(frame, fps, 'SNAPPY', 18 + i * 6);
                  return (
                    <div
                      key={`${step}-${i}`}
                      style={{
                        background: pal.surface,
                        border: `1px solid ${pal.surfaceBorder}`,
                        borderRadius: 16,
                        padding: '18px 22px',
                        boxShadow: pal.shadow,
                        transform: `translateY(${(1 - sIn) * 22}px)`,
                        opacity: sIn,
                      }}
                    >
                      <div style={{ color: accentColor, fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
                        POINT 0{i + 1}
                      </div>
                      <div style={{ fontSize: isVertical ? 24 : 21, color: pal.textPrimary, fontWeight: 600 }}>
                        {step}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {(!beat.steps || beat.steps.length === 0) && beat.metrics && beat.metrics.length > 0 && (
              <div style={{ flex: 1, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                {beat.metrics.slice(0, 3).map((m, i) => {
                  const mIn = springProgress(frame, fps, 'SNAPPY', 18 + i * 7);
                  return (
                    <div
                      key={`${m.label}-${i}`}
                      style={{
                        flex: '1 1 200px',
                        background: pal.surface,
                        borderTop: `3px solid ${accentColor}`,
                        border: `1px solid ${pal.surfaceBorder}`,
                        borderRadius: 14,
                        padding: '20px 24px',
                        boxShadow: pal.shadow,
                        transform: `translateY(${(1 - mIn) * 24}px)`,
                        opacity: mIn,
                      }}
                    >
                      <div style={{ fontSize: 44, fontWeight: 900, color: pal.textPrimary }}>{m.value}</div>
                      <div style={{ fontSize: 19, color: pal.textMuted, marginTop: 4 }}>{m.label}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </ParallaxLayer>

      <ParallaxLayer depth="foreground" style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: -80,
            right: -60,
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${hexToRgba(accentColor, 0.16)} 0%, transparent 70%)`,
          }}
        />
      </ParallaxLayer>
    </Camera25DRig>
  );
};
