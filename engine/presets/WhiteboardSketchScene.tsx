import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  Camera25DRig,
  HighlighterText,
  MediaLayer,
  PaperTextureOverlay,
  ParallaxLayer,
  RoughArrow,
  RoughBox,
  SAFE_ZONES,
  getAdaptivePalette,
  hexToRgba,
  isLightColor,
  springProgress,
  type CustomSceneProps,
} from '../motion';

export const WhiteboardSketchScene: React.FC<CustomSceneProps> = ({
  beat,
  beatTiming,
  beatIndex,
  aspect,
  accentColor,
  bgColor,
  resolveAssetUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const safe = SAFE_ZONES[aspect];
  const isVertical = aspect === '9:16';

  // Default to warm paper if caller left default dark #080b12, else honor explicit theme bgColor
  const effectiveBg = bgColor === '#080b12' ? '#FBF8F1' : bgColor;
  const pal = getAdaptivePalette(effectiveBg, accentColor);
  const inkColor = pal.isLight ? '#1e293b' : '#f8fafc';
  const assetUrl = resolveAssetUrl(beat.asset);

  const titleIn = springProgress(frame, fps, 'SMOOTH_UI', 2);
  const subIn = springProgress(frame, fps, 'SMOOTH_UI', 9);
  const cardWidth = isVertical ? 820 : 660;

  return (
    <Camera25DRig
      move={beat.cameraMove ?? 'static'}
      durationFrames={beatTiming.durationFrames}
      bgColor={effectiveBg}
      grainOpacity={0.035}
    >
      <ParallaxLayer depth="background" disableRackFocus>
        <PaperTextureOverlay opacity={pal.isLight ? 0.2 : 0.08} />
        <div
          style={{
            position: 'absolute',
            inset: -80,
            background: `radial-gradient(circle at 82% 20%, ${hexToRgba(accentColor, 0.14)} 0%, transparent 48%)`,
          }}
        />
      </ParallaxLayer>

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
            gap: isVertical ? 28 : 44,
            fontFamily: "'Inter', 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif",
            color: inkColor,
          }}
        >
          {/* Left / Top Sketch Column */}
          <div
            style={{
              flex: isVertical ? '0 0 auto' : '1 1 56%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: `2px solid ${inkColor}`,
                  background: isLightColor('#fde047') ? '#fde047' : accentColor,
                  color: '#141414',
                  fontSize: isVertical ? 20 : 17,
                  fontWeight: 900,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  transform: 'rotate(-1.2deg)',
                }}
              >
                {beat.badge ?? `NOTE #0${beatIndex + 1}`}
              </span>
              <RoughArrow
                length={isVertical ? 90 : 120}
                stroke={accentColor}
                seed={10 + beatIndex}
                startFrame={6}
              />
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: isVertical ? 60 : 68,
                fontWeight: 900,
                lineHeight: 1.1,
                letterSpacing: '-0.025em',
                color: inkColor,
                transform: `translateY(${(1 - titleIn) * 26}px)`,
                opacity: titleIn,
              }}
            >
              <HighlighterText color={hexToRgba(accentColor, 0.32)} startFrame={8}>
                {beat.title}
              </HighlighterText>
            </h1>

            {beat.subtitle && (
              <p
                style={{
                  margin: 0,
                  fontSize: isVertical ? 28 : 26,
                  lineHeight: 1.45,
                  color: pal.textSecondary,
                  fontWeight: 500,
                  transform: `translateY(${(1 - subIn) * 18}px)`,
                  opacity: subIn,
                }}
              >
                {beat.subtitle}
              </p>
            )}

            {beat.steps && beat.steps.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 6 }}>
                {beat.steps.slice(0, 4).map((step, i) => {
                  const sPop = springProgress(frame, fps, 'SNAPPY', 12 + i * 7);
                  return (
                    <div
                      key={`${step}-${i}`}
                      style={{
                        transform: `translateX(${(1 - sPop) * 24}px)`,
                        opacity: sPop,
                      }}
                    >
                      <RoughBox
                        width={Math.min(cardWidth, isVertical ? 820 : 680)}
                        height={isVertical ? 76 : 68}
                        stroke={i === 0 ? accentColor : inkColor}
                        fill={i === 0 ? hexToRgba(accentColor, 0.14) : undefined}
                        strokeWidth={2.5}
                        seed={30 + i * 7}
                        startFrame={10 + i * 6}
                        drawFrames={18}
                      >
                        <div
                          style={{
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            padding: '0 20px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 22,
                              fontWeight: 900,
                              color: accentColor,
                            }}
                          >
                            0{i + 1}.
                          </span>
                          <span style={{ fontSize: isVertical ? 24 : 21, fontWeight: 700, color: inkColor }}>
                            {step}
                          </span>
                        </div>
                      </RoughBox>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right / Bottom Taped Sketchbook Polaroid or Metrics */}
          {(assetUrl || (beat.metrics && beat.metrics.length > 0)) && (
            <div
              style={{
                flex: isVertical ? '1 1 auto' : '0 0 40%',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 18,
              }}
            >
              {assetUrl && (
                <div
                  style={{
                    position: 'relative',
                    width: isVertical ? '84%' : '100%',
                    maxHeight: isVertical ? 410 : 400,
                    padding: 16,
                    paddingBottom: 28,
                    background: '#ffffff',
                    border: `2px solid ${inkColor}`,
                    boxShadow: '8px 10px 0px rgba(20, 20, 20, 0.16)',
                    transform: `rotate(${beatIndex % 2 === 0 ? -1.8 : 1.8}deg)`,
                  }}
                >
                  {/* Masking tape strip */}
                  <div
                    style={{
                      position: 'absolute',
                      top: -14,
                      left: '50%',
                      marginLeft: -55,
                      width: 110,
                      height: 26,
                      background: 'rgba(253, 224, 71, 0.78)',
                      transform: 'rotate(-2deg)',
                    }}
                  />
                  <div style={{ width: '100%', height: isVertical ? 320 : 310, overflow: 'hidden' }}>
                    <MediaLayer src={assetUrl} mediaType={beat.mediaType} kenBurns="in" />
                  </div>
                </div>
              )}

              {beat.metrics && beat.metrics.length > 0 && (
                <div style={{ display: 'flex', gap: 14, width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {beat.metrics.slice(0, 2).map((m, idx) => (
                    <RoughBox
                      key={`${m.label}-${idx}`}
                      width={235}
                      height={112}
                      stroke={accentColor}
                      fill={hexToRgba(accentColor, 0.12)}
                      seed={70 + idx}
                      startFrame={16 + idx * 6}
                    >
                      <div
                        style={{
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          padding: '0 20px',
                        }}
                      >
                        <div style={{ fontSize: 38, fontWeight: 900, color: accentColor }}>{m.value}</div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: inkColor }}>{m.label}</div>
                      </div>
                    </RoughBox>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </ParallaxLayer>
    </Camera25DRig>
  );
};
