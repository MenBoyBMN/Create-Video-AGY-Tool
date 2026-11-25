import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Sequence, useCurrentFrame } from 'remotion';
import {
  BeatTransition,
  KineticCaptions,
  SafeZoneOverlay,
  SceneErrorBoundary,
  SceneErrorCard,
  resolveEffectiveBeatTimings,
  type BeatSpec,
  type BeatTiming,
  type CompositionInputProps,
} from '../motion';
import { getPresetComponent } from '../presets';
import { evaluateCompiledCustomScene } from './customSceneEval';

function joinAssetUrl(baseUrl: string, relPath?: string): string | undefined {
  if (!relPath) return undefined;
  if (/^(https?:|data:|agy-media:)/i.test(relPath)) return relPath;
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanRel = relPath.replace(/^\/+/, '');
  return `${cleanBase}/${cleanRel}`;
}

export const CompositionRoot: React.FC<CompositionInputProps> = ({
  projectId,
  storyboard,
  timings,
  assetBaseUrl,
  compiledScenes = {},
  showSafeZones = false,
  enableAudio = true,
  onSceneErrorCopy,
}) => {
  const globalFrame = useCurrentFrame();

  const resolveAssetUrl = useMemo(
    () => (relPath?: string) => joinAssetUrl(assetBaseUrl, relPath),
    [assetBaseUrl]
  );

  const beatMap = useMemo(() => {
    const map = new Map<string, BeatSpec>();
    for (const beat of storyboard.beats) {
      map.set(beat.id, beat);
    }
    return map;
  }, [storyboard.beats]);

  const effectiveTimings: BeatTiming[] = useMemo(
    () => resolveEffectiveBeatTimings(storyboard, timings).beats.map((entry) => entry.timing),
    [timings, storyboard]
  );

  const allWords = useMemo(
    () => effectiveTimings.flatMap((bt) => bt.words || []),
    [effectiveTimings]
  );

  const activeBeat = useMemo(() => {
    const match = effectiveTimings.find(
      (bt) => globalFrame >= bt.startFrame && globalFrame < bt.endFrame
    );
    return match ? beatMap.get(match.id) : storyboard.beats[0];
  }, [effectiveTimings, globalFrame, beatMap, storyboard.beats]);

  const activeAccent = activeBeat?.accentColor || storyboard.theme?.accentColor || '#38bdf8';
  const masterAudioUrl = timings?.masterAudio ? resolveAssetUrl(timings.masterAudio) : undefined;

  return (
    <AbsoluteFill style={{ backgroundColor: storyboard.theme?.bgColor || '#080b12' }}>
      {enableAudio && masterAudioUrl && <Audio src={masterAudioUrl} />}

      {effectiveTimings.map((bt, idx) => {
        const beat = beatMap.get(bt.id) || storyboard.beats[idx];
        if (!beat) return null;

        const accentColor = beat.accentColor || storyboard.theme?.accentColor || '#38bdf8';
        const bgColor = beat.bgColor || storyboard.theme?.bgColor || '#080b12';
        const sceneProps = {
          beat,
          beatTiming: bt,
          beatIndex: idx,
          totalBeats: effectiveTimings.length,
          storyboard,
          aspect: storyboard.aspect,
          accentColor,
          bgColor,
          resolveAssetUrl,
        };

        let content: React.ReactNode;
        if (beat.customScene) {
          const entry = compiledScenes[beat.customScene];
          if (!entry) {
            content = (
              <SceneErrorCard
                projectId={projectId}
                beatId={beat.id}
                sceneName={beat.customScene}
                stage="compile"
                message={`Không tìm thấy file scenes/${beat.customScene}.tsx`}
                detail="Hãy tạo file CustomScene.tsx hoặc nhờ AGY viết cảnh này."
                onCopyError={
                  onSceneErrorCopy
                    ? () =>
                        onSceneErrorCopy({
                          projectId,
                          beatId: beat.id,
                          sceneName: beat.customScene!,
                          errorMessage: `Missing custom scene file scenes/${beat.customScene}.tsx`,
                        })
                    : undefined
                }
              />
            );
          } else {
            const evaluated = evaluateCompiledCustomScene(entry);
            if (!evaluated.ok || !evaluated.Component) {
              content = (
                <SceneErrorCard
                  projectId={projectId}
                  beatId={beat.id}
                  sceneName={beat.customScene}
                  stage="compile"
                  message={evaluated.errorMessage || 'Lỗi biên dịch CustomScene'}
                  detail={evaluated.errorDetail}
                  onCopyError={
                    onSceneErrorCopy
                      ? () =>
                          onSceneErrorCopy({
                            projectId,
                            beatId: beat.id,
                            sceneName: beat.customScene!,
                            errorMessage: evaluated.errorMessage || 'Compile error',
                            stack: evaluated.errorDetail,
                          })
                      : undefined
                  }
                />
              );
            } else {
              const CustomComp = evaluated.Component;
              content = (
                <SceneErrorBoundary
                  projectId={projectId}
                  beatId={beat.id}
                  sceneName={beat.customScene}
                  resetKey={`${beat.customScene}-${entry.hash ?? ''}`}
                  onCopyError={onSceneErrorCopy}
                >
                  <CustomComp {...sceneProps} />
                </SceneErrorBoundary>
              );
            }
          }
        } else {
          const PresetComp = getPresetComponent(beat.preset);
          content = <PresetComp {...sceneProps} />;
        }

        const durFrames = Math.max(1, bt.durationFrames);
        const transitionType = beat.transition ?? storyboard.defaultTransition ?? 'fade';

        return (
          <Sequence
            key={`${beat.id}-${idx}`}
            from={bt.startFrame}
            durationInFrames={durFrames}
            name={`${beat.id}: ${beat.title}`}
          >
            <BeatTransition
              type={transitionType}
              durationFrames={durFrames}
              accentColor={accentColor}
              isFirst={idx === 0}
              isLast={idx === effectiveTimings.length - 1}
            >
              {content}
            </BeatTransition>
          </Sequence>
        );
      })}

      {storyboard.showCaptions !== false && allWords.length > 0 && (
        <KineticCaptions
          words={allWords}
          aspect={storyboard.aspect}
          accentColor={activeAccent}
          keywords={activeBeat?.keywords || []}
          captionStyle={storyboard.captionStyle}
          currentGlobalFrame={globalFrame}
        />
      )}

      {showSafeZones && <SafeZoneOverlay aspect={storyboard.aspect} />}
    </AbsoluteFill>
  );
};
