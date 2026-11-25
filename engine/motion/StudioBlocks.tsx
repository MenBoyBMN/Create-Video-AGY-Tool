import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { evolvePath } from '@remotion/paths';
import rough from 'roughjs';
import {
  EASINGS,
  hexToRgba,
  isLightColor,
  springProgress,
} from './motionTokens';
import type { ChartDatum, CodeSnippetSpec } from './types';

export function isVideoAsset(src?: string): boolean {
  if (!src) return false;
  const clean = src.split('?')[0].split('#')[0].toLowerCase();
  return /\.(mp4|webm|mov|m4v)$/.test(clean);
}

export interface MediaLayerProps {
  src?: string;
  mediaType?: 'auto' | 'image' | 'video';
  kenBurns?: 'in' | 'out' | 'pan' | 'none';
  style?: React.CSSProperties;
  muted?: boolean;
  loop?: boolean;
}

export const MediaLayer: React.FC<MediaLayerProps> = ({
  src,
  mediaType = 'auto',
  kenBurns = 'in',
  style,
  muted = true,
  loop: _loop = true,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  if (!src) return null;

  const isVideo = mediaType === 'video' || (mediaType === 'auto' && isVideoAsset(src));
  if (isVideo) {
    return (
      <OffthreadVideo
        src={src}
        muted={muted}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          ...style,
        }}
      />
    );
  }

  const prog = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASINGS.SMOOTH_DECEL,
  });

  let transform = 'scale(1)';
  if (kenBurns === 'in') {
    transform = `scale(${(1 + prog * 0.1).toFixed(4)})`;
  } else if (kenBurns === 'out') {
    transform = `scale(${(1.12 - prog * 0.1).toFixed(4)})`;
  } else if (kenBurns === 'pan') {
    const tx = interpolate(prog, [0, 1], [-18, 18]);
    transform = `scale(1.08) translate3d(${tx.toFixed(1)}px, 0, 0)`;
  }

  return (
    <Img
      src={src}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
        transform,
        ...style,
      }}
    />
  );
};

export interface AnimatedCounterProps {
  value: string;
  startFrame?: number;
  durationFrames?: number;
  style?: React.CSSProperties;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  startFrame = 4,
  durationFrames = 32,
  style,
}) => {
  const frame = useCurrentFrame();
  const match = /^([^0-9.-]*)(-?\d+(?:[.,]\d+)?)(.*)$/.exec(String(value).trim());
  if (!match) {
    return <span style={style}>{value}</span>;
  }
  const [, prefix, rawNum, suffix] = match;
  const hasComma = rawNum.includes(',');
  const cleanNumStr = rawNum.replace(/,/g, '');
  const target = parseFloat(cleanNumStr);
  if (Number.isNaN(target)) {
    return <span style={style}>{value}</span>;
  }
  const decimals = cleanNumStr.includes('.') ? cleanNumStr.split('.')[1].length : 0;

  const p = interpolate(frame, [startFrame, startFrame + Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASINGS.EDITORIAL,
  });
  const current = target * p;
  let formatted = decimals > 0 ? current.toFixed(decimals) : String(Math.round(current));
  if (hasComma && decimals === 0) {
    formatted = Number(formatted).toLocaleString('en-US');
  }
  return (
    <span style={style}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

export interface HighlighterTextProps {
  children: React.ReactNode;
  color?: string;
  startFrame?: number;
  durationFrames?: number;
  style?: React.CSSProperties;
}

export const HighlighterText: React.FC<HighlighterTextProps> = ({
  children,
  color = '#fde047',
  startFrame = 6,
  durationFrames = 20,
  style,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [startFrame, startFrame + Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASINGS.EDITORIAL,
  });

  return (
    <span style={{ position: 'relative', display: 'inline-block', padding: '0 6px', ...style }}>
      <span
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: '6%',
          height: '44%',
          borderRadius: 4,
          background: color,
          transformOrigin: 'left center',
          transform: `scaleX(${p.toFixed(4)}) rotate(-0.6deg)`,
          zIndex: 0,
          opacity: 0.85,
        }}
      />
      <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>
    </span>
  );
};

export interface TypewriterBlockProps {
  text: string;
  startFrame?: number;
  charsPerFrame?: number;
  showCursor?: boolean;
  style?: React.CSSProperties;
}

export const TypewriterBlock: React.FC<TypewriterBlockProps> = ({
  text,
  startFrame = 4,
  charsPerFrame = 0.85,
  showCursor = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const count = Math.min(text.length, Math.floor(elapsed * charsPerFrame));
  const cursorVisible = showCursor && Math.floor(frame / 18) % 2 === 0;
  return (
    <span style={style}>
      {text.slice(0, count)}
      {showCursor && (
        <span style={{ opacity: cursorVisible ? 1 : 0, fontWeight: 400 }}>|</span>
      )}
    </span>
  );
};

export interface CodeWindowProps {
  snippet: CodeSnippetSpec;
  accentColor?: string;
  startFrame?: number;
}

function tokenizeCodeLine(line: string, accentColor: string): React.ReactNode {
  if (/^\s*(\/\/|#)/.test(line)) {
    return <span style={{ color: '#64748b', fontStyle: 'italic' }}>{line}</span>;
  }
  const kwRe = /\b(const|let|var|function|return|async|await|import|from|export|default|if|else|for|while|def|class|try|except|true|false|null|None)\b/g;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = kwRe.exec(line)) !== null) {
    if (m.index > lastIdx) {
      parts.push(line.slice(lastIdx, m.index));
    }
    parts.push(
      <span key={`${m.index}-${m[0]}`} style={{ color: accentColor, fontWeight: 700 }}>
        {m[0]}
      </span>
    );
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < line.length) {
    parts.push(line.slice(lastIdx));
  }
  return parts.length > 0 ? parts : line;
}

export const CodeWindow: React.FC<CodeWindowProps> = ({
  snippet,
  accentColor = '#38bdf8',
  startFrame = 8,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = springProgress(frame, fps, 'SMOOTH_UI', startFrame);
  const lines = (snippet.code || '').split('\n');
  const hlSet = new Set(snippet.highlightLines || []);

  return (
    <div
      style={{
        background: '#0b0f19',
        border: `1px solid ${hexToRgba(accentColor, 0.35)}`,
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55)',
        transform: `translateY(${(1 - pop) * 28}px) scale(${0.96 + pop * 0.04})`,
        opacity: pop,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#f43f5e' }} />
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#f59e0b' }} />
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#10b981' }} />
          <span
            style={{
              marginLeft: 10,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 15,
              color: '#94a3b8',
            }}
          >
            {snippet.title || 'snippet.ts'}
          </span>
        </div>
        {snippet.language && (
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              padding: '3px 10px',
              borderRadius: 999,
              background: hexToRgba(accentColor, 0.16),
              color: accentColor,
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            {snippet.language}
          </span>
        )}
      </div>

      <div style={{ padding: '16px 20px', fontFamily: "'JetBrains Mono', Consolas, monospace", fontSize: 18, lineHeight: 1.55 }}>
        {lines.map((line, i) => {
          const lineNo = i + 1;
          const isHl = hlSet.has(lineNo);
          const lineIn = interpolate(frame, [startFrame + i * 3, startFrame + i * 3 + 10], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={lineNo}
              style={{
                display: 'flex',
                gap: 16,
                padding: '2px 8px',
                borderRadius: 6,
                background: isHl ? hexToRgba(accentColor, 0.15) : 'transparent',
                borderLeft: isHl ? `3px solid ${accentColor}` : '3px solid transparent',
                opacity: lineIn,
                transform: `translateX(${(1 - lineIn) * 14}px)`,
              }}
            >
              <span style={{ color: '#475569', width: 26, textAlign: 'right', userSelect: 'none' }}>
                {lineNo}
              </span>
              <span style={{ color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                {tokenizeCodeLine(line, accentColor)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export interface DeviceMockup3DProps {
  variant?: 'phone' | 'browser';
  src?: string;
  accentColor?: string;
  title?: string;
  children?: React.ReactNode;
}

export const DeviceMockup3D: React.FC<DeviceMockup3DProps> = ({
  variant = 'browser',
  src,
  accentColor = '#38bdf8',
  title = 'AGY Studio Preview',
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = springProgress(frame, fps, 'SMOOTH_UI', 6);
  const floatY = Math.sin(frame / 28) * 6;
  const tiltY = variant === 'phone' ? -10 : -7;
  const tiltX = variant === 'phone' ? 4 : 3;

  return (
    <div style={{ perspective: 1200, width: '100%', display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          width: variant === 'phone' ? 310 : '100%',
          maxWidth: variant === 'phone' ? 310 : 620,
          borderRadius: variant === 'phone' ? 36 : 20,
          padding: variant === 'phone' ? 10 : 0,
          background: '#0f172a',
          border: `2px solid ${hexToRgba(accentColor, 0.45)}`,
          boxShadow: `0 30px 70px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)`,
          overflow: 'hidden',
          transform: `translateY(${((1 - pop) * 32 + floatY).toFixed(1)}px) rotateY(${tiltY}deg) rotateX(${tiltX}deg) scale(${0.92 + pop * 0.08})`,
          opacity: pop,
        }}
      >
        {variant === 'browser' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '10px 16px',
              background: '#161e31',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f43f5e' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
            <span style={{ marginLeft: 8, fontSize: 13, color: '#94a3b8', fontFamily: 'monospace' }}>
              {title}
            </span>
          </div>
        )}
        <div
          style={{
            borderRadius: variant === 'phone' ? 28 : 0,
            overflow: 'hidden',
            aspectRatio: variant === 'phone' ? '9 / 16' : '16 / 10',
            background: '#080b12',
          }}
        >
          {src ? <MediaLayer src={src} kenBurns="in" /> : children}
        </div>
      </div>
    </div>
  );
};

export interface RoughBoxProps {
  width: number;
  height: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  roughness?: number;
  seed?: number;
  startFrame?: number;
  drawFrames?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export const RoughBox: React.FC<RoughBoxProps> = ({
  width,
  height,
  stroke = '#1e293b',
  fill,
  strokeWidth = 3,
  roughness = 1.6,
  seed = 42,
  startFrame = 4,
  drawFrames = 24,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [startFrame, startFrame + Math.max(1, drawFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASINGS.EDITORIAL,
  });

  const paths = useMemo(() => {
    const gen = rough.generator({ options: { seed } });
    const drawable = gen.rectangle(6, 6, Math.max(20, width - 12), Math.max(20, height - 12), {
      stroke,
      strokeWidth,
      roughness,
      fill: fill || undefined,
      fillStyle: fill ? 'hachure' : undefined,
      hachureGap: 10,
      seed,
    });
    return gen.toPaths(drawable);
  }, [width, height, stroke, fill, strokeWidth, roughness, seed]);

  return (
    <div style={{ position: 'relative', width, height, ...style }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
      >
        {paths.map((p, idx) => {
          const evo = evolvePath(progress, p.d);
          return (
            <path
              key={idx}
              d={p.d}
              stroke={p.stroke}
              strokeWidth={p.strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={evo.strokeDasharray}
              strokeDashoffset={evo.strokeDashoffset}
            />
          );
        })}
      </svg>
      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
        {children}
      </div>
    </div>
  );
};

export interface RoughArrowProps {
  length?: number;
  stroke?: string;
  strokeWidth?: number;
  seed?: number;
  startFrame?: number;
  drawFrames?: number;
  direction?: 'right' | 'down';
}

export const RoughArrow: React.FC<RoughArrowProps> = ({
  length = 120,
  stroke = '#ea580c',
  strokeWidth = 3,
  seed = 19,
  startFrame = 10,
  drawFrames = 18,
  direction = 'right',
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [startFrame, startFrame + Math.max(1, drawFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASINGS.EDITORIAL,
  });

  const isDown = direction === 'down';
  const w = isDown ? 44 : length;
  const h = isDown ? length : 44;

  const paths = useMemo(() => {
    const gen = rough.generator({ options: { seed } });
    const shaft = isDown
      ? gen.line(22, 4, 22, length - 8, { stroke, strokeWidth, roughness: 1.4, seed })
      : gen.line(4, 22, length - 8, 22, { stroke, strokeWidth, roughness: 1.4, seed });
    const head = isDown
      ? gen.linearPath(
          [
            [11, length - 20],
            [22, length - 6],
            [33, length - 20],
          ],
          { stroke, strokeWidth, roughness: 1.2, seed: seed + 1 }
        )
      : gen.linearPath(
          [
            [length - 20, 11],
            [length - 6, 22],
            [length - 20, 33],
          ],
          { stroke, strokeWidth, roughness: 1.2, seed: seed + 1 }
        );
    return [...gen.toPaths(shaft), ...gen.toPaths(head)];
  }, [length, stroke, strokeWidth, seed, isDown]);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible', flexShrink: 0 }}>
      {paths.map((p, idx) => {
        const evo = evolvePath(progress, p.d);
        return (
          <path
            key={idx}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={evo.strokeDasharray}
            strokeDashoffset={evo.strokeDashoffset}
          />
        );
      })}
    </svg>
  );
};

export interface AnimatedBarChartProps {
  data: ChartDatum[];
  accentColor?: string;
  bgColor?: string;
  title?: string;
  startFrame?: number;
}

export const AnimatedBarChart: React.FC<AnimatedBarChartProps> = ({
  data,
  accentColor = '#38bdf8',
  bgColor = '#080b12',
  title,
  startFrame = 8,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const light = isLightColor(bgColor);
  const maxVal = Math.max(1, ...data.map((d) => Math.abs(d.value)));

  return (
    <div
      style={{
        background: light ? 'rgba(255,255,255,0.88)' : 'rgba(15, 23, 42, 0.82)',
        border: `1px solid ${light ? 'rgba(15,23,42,0.14)' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 22,
        padding: '24px 28px',
        boxShadow: light ? '0 16px 40px rgba(15,23,42,0.1)' : '0 22px 54px rgba(0,0,0,0.45)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        width: '100%',
      }}
    >
      {title && (
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: light ? '#0f172a' : '#f8fafc',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {data.slice(0, 6).map((item, idx) => {
          const prog = springProgress(frame, fps, 'SMOOTH_UI', startFrame + idx * 5);
          const pct = Math.max(4, Math.min(100, (Math.abs(item.value) / maxVal) * 100)) * prog;
          const barColor = item.color || accentColor;
          return (
            <div key={`${item.label}-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}>
                <span style={{ color: light ? '#334155' : '#e2e8f0' }}>{item.label}</span>
                <span style={{ color: barColor, fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(item.value * prog * 10) / 10}
                </span>
              </div>
              <div
                style={{
                  height: 16,
                  borderRadius: 999,
                  background: light ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${pct.toFixed(2)}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${hexToRgba(barColor, 0.78)}, ${barColor})`,
                    boxShadow: `0 0 18px ${hexToRgba(barColor, 0.35)}`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const CrtVhsOverlay: React.FC<{ opacity?: number }> = ({ opacity = 0.22 }) => {
  const frame = useCurrentFrame();
  const jitter = Math.floor(frame / 5) % 2 === 0 ? 0 : 1;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.45) 0px, rgba(0,0,0,0.45) 2px, transparent 2px, transparent 5px)',
          transform: `translateY(${jitter}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 110px rgba(0,0,0,0.75)',
        }}
      />
    </AbsoluteFill>
  );
};

export const PaperTextureOverlay: React.FC<{ opacity?: number }> = ({ opacity = 0.14 }) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      opacity,
      backgroundImage:
        'radial-gradient(rgba(120, 95, 60, 0.22) 1px, transparent 1px), linear-gradient(0deg, rgba(120, 95, 60, 0.05) 1px, transparent 1px)',
      backgroundSize: '24px 24px, 100% 34px',
    }}
  />
);

export const LightLeakOverlay: React.FC<{ color?: string; opacity?: number }> = ({
  color = '#f59e0b',
  opacity = 0.26,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const sweep = interpolate(frame, [0, Math.max(1, durationInFrames)], [-20, 115], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        opacity,
        mixBlendMode: 'screen',
        background: `radial-gradient(circle at ${sweep.toFixed(1)}% 24%, ${hexToRgba(color, 0.72)} 0%, ${hexToRgba('#f97316', 0.22)} 28%, transparent 62%)`,
      }}
    />
  );
};
