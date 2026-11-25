import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { SAFE_ZONES, hexToRgba, springProgress } from './motionTokens';
import type { AspectRatio, CaptionStyleId, WordTiming } from './types';

export interface KineticCaptionsProps {
  words: WordTiming[];
  aspect: AspectRatio;
  accentColor?: string;
  keywords?: string[];
  captionStyle?: CaptionStyleId;
  /** Pass global frame explicitly if mounted inside a Sequence, otherwise uses useCurrentFrame() */
  currentGlobalFrame?: number;
}

interface CaptionChunk {
  words: Array<WordTiming & { globalIdx: number }>;
  startFrame: number;
  endFrame: number;
}

const FONT_STACK = "'Inter', 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif";
const MONO_STACK = "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace";

export const KineticCaptions: React.FC<KineticCaptionsProps> = ({
  words,
  aspect,
  accentColor = '#38bdf8',
  keywords = [],
  captionStyle = 'glass-dark',
  currentGlobalFrame,
}) => {
  const localFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frame = currentGlobalFrame ?? localFrame;

  const safe = SAFE_ZONES[aspect];
  const maxWordsPerChunk = aspect === '9:16' ? 4 : 7;

  const keywordSet = useMemo(
    () => new Set(keywords.map((k) => k.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))),
    [keywords]
  );

  const chunks = useMemo<CaptionChunk[]>(() => {
    if (!words || words.length === 0) return [];
    const result: CaptionChunk[] = [];
    for (let i = 0; i < words.length; i += maxWordsPerChunk) {
      const slice = words.slice(i, i + maxWordsPerChunk).map((w, offset) => ({
        ...w,
        globalIdx: i + offset,
      }));
      if (slice.length > 0) {
        result.push({
          words: slice,
          startFrame: slice[0].startFrame,
          endFrame: slice[slice.length - 1].endFrame,
        });
      }
    }
    return result;
  }, [words, maxWordsPerChunk]);

  const activeWordGlobalIdx = useMemo(() => {
    let matched = -1;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (frame >= w.startFrame && frame < w.endFrame) {
        matched = i;
      }
    }
    return matched;
  }, [words, frame]);

  const activeChunk = useMemo(() => {
    if (activeWordGlobalIdx >= 0) {
      return chunks.find((c) => c.words.some((w) => w.globalIdx === activeWordGlobalIdx));
    }
    return chunks.find((c) => frame >= c.startFrame && frame <= c.endFrame + 8);
  }, [chunks, activeWordGlobalIdx, frame]);

  if (!activeChunk) return null;

  const chunkPop = springProgress(frame - activeChunk.startFrame, fps, 'SNAPPY');
  const isVertical = aspect === '9:16';
  const activeSpeaker =
    activeWordGlobalIdx >= 0
      ? words[activeWordGlobalIdx]?.speaker
      : activeChunk.words.find((w) => w.speaker)?.speaker;

  const isEditorialLight = captionStyle === 'editorial-light';
  const isHormozi = captionStyle === 'hormozi-pop';
  const isKaraoke = captionStyle === 'karaoke-glow';
  const isMinimal = captionStyle === 'minimal-cinematic';
  const isMono = captionStyle === 'typewriter-mono';

  const containerStyle: React.CSSProperties = (() => {
    if (isEditorialLight) {
      return {
        background: 'rgba(250, 247, 240, 0.94)',
        border: '2px solid rgba(20, 20, 20, 0.16)',
        boxShadow: '0 14px 36px rgba(15, 23, 42, 0.16)',
        borderRadius: 16,
        padding: isVertical ? '14px 22px' : '12px 26px',
      };
    }
    if (isHormozi || isKaraoke) {
      return {
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        borderRadius: 0,
        padding: isVertical ? '8px 12px' : '6px 16px',
      };
    }
    if (isMinimal) {
      return {
        background: 'rgba(6, 8, 13, 0.62)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        padding: isVertical ? '10px 18px' : '9px 22px',
      };
    }
    if (isMono) {
      return {
        background: 'rgba(17, 24, 39, 0.92)',
        border: `1.5px solid ${hexToRgba(accentColor, 0.55)}`,
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
        borderRadius: 10,
        padding: isVertical ? '12px 20px' : '10px 24px',
      };
    }
    return {
      background: 'rgba(8, 11, 18, 0.72)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 14px 40px rgba(0, 0, 0, 0.45)',
      borderRadius: 20,
      padding: isVertical ? '14px 22px' : '12px 26px',
    };
  })();

  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: isVertical ? safe.bottom + 24 : safe.bottom - 18,
        paddingLeft: safe.left,
        paddingRight: safe.right,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          maxWidth: isVertical ? '92%' : '80%',
          transform: `translateY(${(1 - chunkPop) * 14}px) scale(${0.96 + chunkPop * 0.04})`,
          opacity: Math.min(1, chunkPop * 1.4),
        }}
      >
        {activeSpeaker && (
          <div
            style={{
              padding: '4px 14px',
              borderRadius: 999,
              background: isEditorialLight ? '#18181b' : hexToRgba(accentColor, 0.92),
              color: isEditorialLight ? '#fafafa' : '#080b12',
              fontFamily: isMono ? MONO_STACK : FONT_STACK,
              fontSize: isVertical ? 19 : 16,
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              boxShadow: '0 6px 18px rgba(0,0,0,0.3)',
            }}
          >
            {activeSpeaker}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: isVertical ? '10px 12px' : '8px 14px',
            ...containerStyle,
          }}
        >
          {activeChunk.words.map((w) => {
            const isActive = w.globalIdx === activeWordGlobalIdx;
            const cleanWord = w.word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
            const isKeyword = Boolean(w.isKeyword) || (cleanWord.length > 0 && keywordSet.has(cleanWord));
            const wordPop = isActive ? springProgress(frame - w.startFrame, fps, 'SNAPPY') : 0;

            if (isHormozi) {
              const activeColor = isKeyword ? '#facc15' : accentColor;
              return (
                <span
                  key={`${w.globalIdx}-${w.word}`}
                  style={{
                    display: 'inline-block',
                    fontFamily: FONT_STACK,
                    fontSize: isVertical ? 52 : 42,
                    fontWeight: 900,
                    lineHeight: 1.12,
                    textTransform: 'uppercase',
                    letterSpacing: '-0.02em',
                    padding: '2px 6px',
                    color: isActive ? activeColor : isKeyword ? '#fde047' : '#ffffff',
                    WebkitTextStroke: isVertical ? '2.5px #090b10' : '2px #090b10',
                    textShadow: isActive
                      ? `0 6px 24px ${hexToRgba(activeColor, 0.6)}, 0 4px 0 #090b10`
                      : '0 4px 0 #090b10, 0 8px 18px rgba(0,0,0,0.75)',
                    transform: isActive
                      ? `scale(${1.06 + wordPop * 0.12}) translateY(${-wordPop * 4}px)`
                      : 'scale(1)',
                  }}
                >
                  {w.word}
                </span>
              );
            }

            if (isKaraoke) {
              const spoken = frame >= w.startFrame;
              return (
                <span
                  key={`${w.globalIdx}-${w.word}`}
                  style={{
                    display: 'inline-block',
                    fontFamily: FONT_STACK,
                    fontSize: isVertical ? 46 : 36,
                    fontWeight: isActive || isKeyword ? 900 : 700,
                    lineHeight: 1.2,
                    padding: '2px 5px',
                    color: isActive
                      ? '#ffffff'
                      : spoken
                        ? accentColor
                        : 'rgba(226, 232, 240, 0.55)',
                    textShadow: isActive
                      ? `0 0 22px ${hexToRgba(accentColor, 0.9)}, 0 3px 12px rgba(0,0,0,0.9)`
                      : '0 3px 10px rgba(0,0,0,0.85)',
                    transform: isActive ? `scale(${1 + wordPop * 0.1})` : 'scale(1)',
                  }}
                >
                  {w.word}
                </span>
              );
            }

            if (isMinimal) {
              return (
                <span
                  key={`${w.globalIdx}-${w.word}`}
                  style={{
                    display: 'inline-block',
                    fontFamily: FONT_STACK,
                    fontSize: isVertical ? 36 : 29,
                    fontWeight: isActive ? 700 : 500,
                    lineHeight: 1.25,
                    color: isActive ? '#ffffff' : isKeyword ? accentColor : 'rgba(226, 232, 240, 0.8)',
                    textShadow: '0 2px 8px rgba(0,0,0,0.7)',
                  }}
                >
                  {w.word}
                </span>
              );
            }

            if (isEditorialLight) {
              const highlightBg = isKeyword ? '#fde047' : hexToRgba(accentColor, 0.22);
              return (
                <span
                  key={`${w.globalIdx}-${w.word}`}
                  style={{
                    display: 'inline-block',
                    fontFamily: FONT_STACK,
                    fontSize: isVertical ? 42 : 33,
                    fontWeight: isActive || isKeyword ? 800 : 600,
                    lineHeight: 1.2,
                    padding: isActive ? '4px 12px' : '4px 4px',
                    borderRadius: 8,
                    backgroundColor: isActive ? highlightBg : 'transparent',
                    borderBottom: isKeyword && !isActive ? `3px solid ${accentColor}` : 'none',
                    color: '#141414',
                    transform: isActive ? `scale(${1 + wordPop * 0.05})` : 'scale(1)',
                  }}
                >
                  {w.word}
                </span>
              );
            }

            const activeBg = isKeyword ? accentColor : 'rgba(255, 255, 255, 0.95)';
            const activeText = '#080b12';
            return (
              <span
                key={`${w.globalIdx}-${w.word}`}
                style={{
                  display: 'inline-block',
                  fontFamily: isMono ? MONO_STACK : FONT_STACK,
                  fontSize: isVertical ? (isMono ? 38 : 44) : isMono ? 30 : 34,
                  fontWeight: isActive || isKeyword ? 800 : 600,
                  lineHeight: 1.2,
                  letterSpacing: isMono ? '0em' : '-0.015em',
                  padding: isActive ? '4px 14px' : '4px 4px',
                  borderRadius: isMono ? 6 : 12,
                  backgroundColor: isActive ? activeBg : 'transparent',
                  color: isActive
                    ? activeText
                    : isKeyword
                      ? accentColor
                      : 'rgba(241, 245, 249, 0.92)',
                  boxShadow: isActive
                    ? `0 6px 22px ${hexToRgba(accentColor, isKeyword ? 0.55 : 0.28)}`
                    : 'none',
                  transform: isActive
                    ? `scale(${1 + wordPop * 0.07}) translateY(${-wordPop * 2}px)`
                    : 'scale(1)',
                  textShadow: isActive ? 'none' : '0 2px 10px rgba(0,0,0,0.65)',
                }}
              >
                {w.word}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
