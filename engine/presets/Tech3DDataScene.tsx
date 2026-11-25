import React from 'react';
import { ThreeCanvas } from '@remotion/three';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  AnimatedBarChart,
  AnimatedCounter,
  Camera25DRig,
  CodeWindow,
  DeviceMockup3D,
  ParallaxLayer,
  SAFE_ZONES,
  getAdaptivePalette,
  hexToRgba,
  springProgress,
  type CustomSceneProps,
} from '../motion';

class WebGLSafeBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

const FloatingGeoRig: React.FC<{ accentColor: string; frame: number }> = ({ accentColor, frame }) => {
  const rotY = frame * 0.012;
  const rotX = Math.sin(frame * 0.015) * 0.35;
  return (
    <>
      <ambientLight intensity={0.65} />
      <pointLight position={[6, 5, 6]} intensity={2.2} color={accentColor} />
      <group position={[2.6, 0.2, -1.2]} rotation={[rotX, rotY, 0.2]}>
        <mesh>
          <icosahedronGeometry args={[1.65, 1]} />
          <meshStandardMaterial color={accentColor} wireframe transparent opacity={0.35} />
        </mesh>
        <mesh rotation={[rotY * 0.5, -rotX, 0.4]}>
          <torusGeometry args={[2.25, 0.04, 16, 64]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.45} />
        </mesh>
      </group>
    </>
  );
};

export const Tech3DDataScene: React.FC<CustomSceneProps> = ({
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
  const { fps, width, height } = useVideoConfig();
  const safe = SAFE_ZONES[aspect];
  const isVertical = aspect === '9:16';
  const pal = getAdaptivePalette(bgColor, accentColor);

  const heroIn = springProgress(frame, fps, 'SMOOTH_UI', 3);
  const assetUrl = resolveAssetUrl(beat.asset);

  const defaultChart = beat.chartData && beat.chartData.length > 0
    ? beat.chartData
    : !beat.codeSnippet && !assetUrl && beat.metrics && beat.metrics.length > 0
      ? beat.metrics.map((m) => ({
          label: m.label,
          value: parseFloat(String(m.value).replace(/[^0-9.-]/g, '')) || 50,
          color: accentColor,
        }))
      : undefined;

  return (
    <Camera25DRig
      move={beat.cameraMove ?? 'orbit_tilt'}
      durationFrames={beatTiming.durationFrames}
      bgColor={bgColor}
    >
      {/* Background 0.28x: Atmospheric gradient + live Three.js 3D geometric rig */}
      <ParallaxLayer depth="background" disableRackFocus>
        <div
          style={{
            position: 'absolute',
            inset: -100,
            background: pal.isLight
              ? `radial-gradient(circle at 75% 30%, ${hexToRgba(accentColor, 0.16)} 0%, transparent 52%), ${bgColor}`
              : `radial-gradient(circle at 75% 32%, ${hexToRgba(accentColor, 0.25)} 0%, transparent 50%), linear-gradient(155deg, ${bgColor} 0%, #05070c 100%)`,
          }}
        />
        <WebGLSafeBoundary>
          <ThreeCanvas
            width={width}
            height={height}
            camera={{ position: [0, 0, 5.5], fov: 45 }}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.85 }}
          >
            <FloatingGeoRig accentColor={accentColor} frame={frame} />
          </ThreeCanvas>
        </WebGLSafeBoundary>
      </ParallaxLayer>

      {/* Subject 1.0x: Data / Code / 3D Device Showcase */}
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
            gap: isVertical ? 28 : 48,
            fontFamily: "'Inter', 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif",
            color: pal.textPrimary,
          }}
        >
          <div
            style={{
              flex: isVertical ? '0 0 auto' : '1 1 48%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            <div
              style={{
                alignSelf: 'flex-start',
                padding: '7px 16px',
                borderRadius: 999,
                background: hexToRgba(accentColor, 0.16),
                border: `1px solid ${hexToRgba(accentColor, 0.45)}`,
                color: accentColor,
                fontSize: isVertical ? 20 : 16,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {beat.badge ?? `TECH 3D · 0${beatIndex + 1}/0${totalBeats}`}
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: isVertical ? 62 : 70,
                fontWeight: 900,
                lineHeight: 1.06,
                letterSpacing: '-0.03em',
                color: pal.textPrimary,
                transform: `translateY(${(1 - heroIn) * 28}px)`,
                opacity: heroIn,
              }}
            >
              {beat.title}
            </h1>

            {beat.subtitle && (
              <p
                style={{
                  margin: 0,
                  fontSize: isVertical ? 28 : 25,
                  lineHeight: 1.42,
                  color: pal.textSecondary,
                }}
              >
                {beat.subtitle}
              </p>
            )}

            {beat.metrics && beat.metrics.length > 0 && (
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
                {beat.metrics.slice(0, 3).map((m, i) => (
                  <div
                    key={`${m.label}-${i}`}
                    style={{
                      flex: '1 1 150px',
                      padding: '16px 20px',
                      borderRadius: 16,
                      background: pal.surface,
                      border: `1px solid ${hexToRgba(accentColor, 0.35)}`,
                      boxShadow: pal.shadow,
                    }}
                  >
                    <div style={{ fontSize: 38, fontWeight: 900, color: accentColor }}>
                      <AnimatedCounter value={m.value} startFrame={6 + i * 4} />
                    </div>
                    <div style={{ fontSize: 16, color: pal.textSecondary, marginTop: 2 }}>{m.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right / Bottom Visual Stage: CodeWindow -> Chart -> 3D Device Mockup */}
          <div style={{ flex: isVertical ? '1 1 auto' : '0 0 48%', width: '100%' }}>
            {beat.codeSnippet ? (
              <CodeWindow snippet={beat.codeSnippet} accentColor={accentColor} />
            ) : defaultChart ? (
              <AnimatedBarChart
                data={defaultChart}
                accentColor={accentColor}
                bgColor={bgColor}
                title={beat.badge || beat.title}
              />
            ) : assetUrl ? (
              <DeviceMockup3D
                variant={isVertical ? 'phone' : 'browser'}
                src={assetUrl}
                accentColor={accentColor}
                title={`agy://3d/${beat.id}`}
              />
            ) : (
              <DeviceMockup3D
                variant="browser"
                accentColor={accentColor}
                title={`agy://telemetry/${beat.id}`}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 14,
                    padding: 28,
                    background: 'linear-gradient(135deg, #0b1120 0%, #111827 100%)',
                  }}
                >
                  {(beat.steps || ['3D Scene Ready', 'Audio-Locked Sync', '60FPS GPU Pipeline']).map((st, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 18px',
                        borderRadius: 12,
                        background: hexToRgba(accentColor, 0.14),
                        border: `1px solid ${hexToRgba(accentColor, 0.35)}`,
                        color: '#f8fafc',
                        fontSize: 20,
                        fontWeight: 700,
                      }}
                    >
                      {idx + 1}. {st}
                    </div>
                  ))}
                </div>
              </DeviceMockup3D>
            )}
          </div>
        </div>
      </ParallaxLayer>
    </Camera25DRig>
  );
};
