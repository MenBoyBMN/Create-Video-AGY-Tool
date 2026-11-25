import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  Camera25DRig,
  ParallaxLayer,
  SAFE_ZONES,
  getAdaptivePalette,
  hexToRgba,
  springProgress,
  type CustomSceneProps,
} from '../motion';

export const DialoguePodcastScene: React.FC<CustomSceneProps> = ({
  beat,
  beatTiming,
  beatIndex,
  aspect,
  accentColor,
  bgColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const safe = SAFE_ZONES[aspect];
  const isVertical = aspect === '9:16';
  const pal = getAdaptivePalette(bgColor, accentColor);
  const globalFrame = beatTiming.startFrame + frame;

  const speakers = useMemo(() => {
    const seen: string[] = [];
    for (const turn of beat.dialogue || []) {
      const s = (turn.speaker || '').trim();
      if (s && !seen.includes(s)) seen.push(s);
    }
    if (seen.length === 0) {
      for (const w of beatTiming.words || []) {
        if (w.speaker && !seen.includes(w.speaker)) seen.push(w.speaker);
      }
    }
    if (seen.length === 0) return ['Host A', 'Host B'];
    if (seen.length === 1) return [seen[0], 'Guest'];
    return seen.slice(0, 2);
  }, [beat.dialogue, beatTiming.words]);

  const activeWord = useMemo(() => {
    const words = beatTiming.words || [];
    for (let i = 0; i < words.length; i++) {
      if (globalFrame >= words[i].startFrame && globalFrame < words[i].endFrame) {
        return words[i];
      }
    }
    return undefined;
  }, [beatTiming.words, globalFrame]);

  const activeSpeaker = activeWord?.speaker || speakers[0];
  const titleIn = springProgress(frame, fps, 'SMOOTH_UI', 2);

  return (
    <Camera25DRig
      move={beat.cameraMove ?? 'slow_push_in'}
      durationFrames={beatTiming.durationFrames}
      bgColor={bgColor}
    >
      <ParallaxLayer depth="background" disableRackFocus>
        <div
          style={{
            position: 'absolute',
            inset: -100,
            background: pal.isLight
              ? `radial-gradient(circle at 50% 25%, ${hexToRgba(accentColor, 0.16)} 0%, transparent 55%), ${bgColor}`
              : `radial-gradient(circle at 25% 40%, ${hexToRgba(accentColor, 0.22)} 0%, transparent 45%), radial-gradient(circle at 75% 60%, rgba(139,92,246,0.18) 0%, transparent 45%), ${bgColor}`,
          }}
        />
      </ParallaxLayer>

      <ParallaxLayer depth="subject" disableRackFocus>
        <div
          style={{
            position: 'absolute',
            top: safe.top,
            bottom: safe.bottom + (isVertical ? 120 : 85),
            left: safe.left,
            right: safe.right,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: isVertical ? 26 : 32,
            fontFamily: "'Inter', 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif",
            color: pal.textPrimary,
          }}
        >
          {/* Topic header */}
          <div style={{ textAlign: 'center', transform: `translateY(${(1 - titleIn) * 20}px)`, opacity: titleIn }}>
            <div
              style={{
                display: 'inline-block',
                padding: '6px 16px',
                borderRadius: 999,
                background: hexToRgba(accentColor, 0.16),
                border: `1px solid ${hexToRgba(accentColor, 0.45)}`,
                color: accentColor,
                fontSize: isVertical ? 19 : 16,
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              {beat.badge ?? `PODCAST · EP 0${beatIndex + 1}`}
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: isVertical ? 54 : 62,
                fontWeight: 900,
                lineHeight: 1.1,
                letterSpacing: '-0.025em',
                color: pal.textPrimary,
              }}
            >
              {beat.title}
            </h1>
          </div>

          {/* 2-Speaker Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isVertical ? '1fr' : '1fr 1fr',
              gap: isVertical ? 20 : 32,
            }}
          >
            {speakers.map((name, idx) => {
              const isSpeaking = activeSpeaker === name;
              const speakerColor = idx === 0 ? accentColor : '#8b5cf6';
              const cardPop = springProgress(frame, fps, 'SNAPPY', 6 + idx * 6);
              const bars = [0, 1, 2, 3, 4, 5, 6];

              return (
                <div
                  key={name}
                  style={{
                    borderRadius: 26,
                    padding: isVertical ? '24px 26px' : '30px 32px',
                    background: pal.surface,
                    border: `2px solid ${isSpeaking ? speakerColor : pal.surfaceBorder}`,
                    boxShadow: isSpeaking
                      ? `0 22px 60px ${hexToRgba(speakerColor, 0.28)}`
                      : pal.shadow,
                    transform: `scale(${((isSpeaking ? 1.02 : 0.98) * (0.92 + cardPop * 0.08)).toFixed(4)})`,
                    opacity: (isSpeaking ? 1 : 0.72) * cardPop,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 18,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div
                        style={{
                          width: isVertical ? 58 : 66,
                          height: isVertical ? 58 : 66,
                          borderRadius: '50%',
                          background: `linear-gradient(135deg, ${speakerColor}, ${hexToRgba(speakerColor, 0.45)})`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 28,
                          fontWeight: 900,
                          color: '#ffffff',
                          boxShadow: isSpeaking ? `0 0 24px ${hexToRgba(speakerColor, 0.6)}` : 'none',
                        }}
                      >
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: isVertical ? 28 : 30, fontWeight: 800, color: pal.textPrimary }}>
                          {name}
                        </div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: isSpeaking ? speakerColor : pal.textMuted,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                          }}
                        >
                          {isSpeaking ? '● Đang nói' : 'Lắng nghe'}
                        </div>
                      </div>
                    </div>

                    {/* Live reactive audio bars */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 38 }}>
                      {bars.map((b) => {
                        const amp = isSpeaking
                          ? 0.35 + 0.65 * Math.abs(Math.sin(frame * 0.26 + b * 0.9 + idx))
                          : 0.16;
                        return (
                          <div
                            key={b}
                            style={{
                              width: 5,
                              height: Math.round(amp * 36),
                              borderRadius: 99,
                              background: isSpeaking ? speakerColor : pal.surfaceBorder,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Latest line preview for this speaker */}
                  {beat.dialogue && (
                    <div
                      style={{
                        fontSize: isVertical ? 22 : 21,
                        lineHeight: 1.45,
                        color: pal.textSecondary,
                        fontWeight: 500,
                        borderLeft: `3px solid ${hexToRgba(speakerColor, 0.6)}`,
                        paddingLeft: 14,
                      }}
                    >
                      “
                      {beat.dialogue.find((d) => d.speaker === name)?.text || beat.subtitle || beat.narration}
                      ”
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </ParallaxLayer>
    </Camera25DRig>
  );
};
