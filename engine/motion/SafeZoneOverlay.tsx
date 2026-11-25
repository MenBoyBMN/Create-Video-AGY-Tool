import React from 'react';
import { AbsoluteFill } from 'remotion';
import { SAFE_ZONES } from './motionTokens';
import type { AspectRatio } from './types';

export interface SafeZoneOverlayProps {
  aspect: AspectRatio;
}

export const SafeZoneOverlay: React.FC<SafeZoneOverlayProps> = ({ aspect }) => {
  const safe = SAFE_ZONES[aspect];
  const isVertical = aspect === '9:16';

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 999 }}>
      {/* Top unsafe strip */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: safe.top,
          background: 'rgba(244, 63, 94, 0.16)',
          borderBottom: '2px dashed rgba(244, 63, 94, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fda4af',
          fontSize: isVertical ? 26 : 18,
          fontWeight: 700,
          letterSpacing: '0.08em',
          fontFamily: 'monospace',
        }}
      >
        {isVertical ? 'TOP UI SAFE MARGIN (SEARCH / TABS)' : 'TOP TITLE-SAFE MARGIN'}
      </div>

      {/* Bottom unsafe strip */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: safe.bottom,
          background: 'rgba(244, 63, 94, 0.16)',
          borderTop: '2px dashed rgba(244, 63, 94, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fda4af',
          fontSize: isVertical ? 26 : 18,
          fontWeight: 700,
          letterSpacing: '0.08em',
          fontFamily: 'monospace',
        }}
      >
        {isVertical ? 'TIKTOK / SHORTS / REELS BOTTOM OVERLAY' : 'YOUTUBE PLAYER CONTROLS ZONE'}
      </div>

      {/* Left unsafe strip */}
      <div
        style={{
          position: 'absolute',
          top: safe.top,
          bottom: safe.bottom,
          left: 0,
          width: safe.left,
          background: 'rgba(244, 63, 94, 0.12)',
          borderRight: '2px dashed rgba(244, 63, 94, 0.65)',
        }}
      />

      {/* Right unsafe strip (action buttons on 9:16) */}
      <div
        style={{
          position: 'absolute',
          top: safe.top,
          bottom: safe.bottom,
          right: 0,
          width: safe.right,
          background: 'rgba(244, 63, 94, 0.16)',
          borderLeft: '2px dashed rgba(244, 63, 94, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isVertical && (
          <span
            style={{
              writingMode: 'vertical-rl',
              color: '#fda4af',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '0.1em',
              fontFamily: 'monospace',
            }}
          >
            LIKE / COMMENT / SHARE RAIL
          </span>
        )}
      </div>

      {/* Center crosshair */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 36,
          height: 2,
          marginLeft: -18,
          background: 'rgba(56, 189, 248, 0.55)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 2,
          height: 36,
          marginTop: -18,
          background: 'rgba(56, 189, 248, 0.55)',
        }}
      />
    </AbsoluteFill>
  );
};
