import type React from 'react';
import type { CustomSceneProps, PresetId } from '../motion';
import { SaasMotionScene } from './SaasMotionScene';
import { ExplainerEditorialScene } from './ExplainerEditorialScene';
import { ShortsKineticScene } from './ShortsKineticScene';
import { CinematicBrollScene } from './CinematicBrollScene';
import { WhiteboardSketchScene } from './WhiteboardSketchScene';
import { Tech3DDataScene } from './Tech3DDataScene';
import { DialoguePodcastScene } from './DialoguePodcastScene';

export interface PresetDescriptor {
  id: PresetId;
  name: string;
  description: string;
  recommendedAspects: Array<'16:9' | '9:16'>;
  defaultCameraMove: string;
}

export const PRESET_REGISTRY: Record<PresetId, React.FC<CustomSceneProps>> = {
  'saas-motion': SaasMotionScene,
  'explainer-editorial': ExplainerEditorialScene,
  'shorts-kinetic': ShortsKineticScene,
  'cinematic-broll': CinematicBrollScene,
  'whiteboard-sketch': WhiteboardSketchScene,
  'tech-3d-data': Tech3DDataScene,
  'dialogue-podcast': DialoguePodcastScene,
};

export const PRESET_LIST: PresetDescriptor[] = [
  {
    id: 'saas-motion',
    name: 'SaaS Motion',
    description:
      'Adaptive glassmorphic showcase with 2.5D grid depth, KPI metric cards, step windows and spring UI motion.',
    recommendedAspects: ['16:9', '9:16'],
    defaultCameraMove: 'slow_push_in',
  },
  {
    id: 'explainer-editorial',
    name: 'Explainer Editorial',
    description:
      'High-contrast editorial typography, chapter watermarks, split media/points layout and 12fps film grain.',
    recommendedAspects: ['16:9', '9:16'],
    defaultCameraMove: 'orbit_tilt',
  },
  {
    id: 'shorts-kinetic',
    name: 'Shorts Kinetic',
    description:
      'High-retention vertical/horizontal kinetic text with impact shake, bold hero numbers and accent flashes.',
    recommendedAspects: ['9:16', '16:9'],
    defaultCameraMove: 'impact_shake',
  },
  {
    id: 'cinematic-broll',
    name: 'Cinematic B-Roll',
    description:
      'Full-bleed video B-roll or AI art with Ken Burns motion, light leaks, cinema letterbox and lower-thirds.',
    recommendedAspects: ['16:9', '9:16'],
    defaultCameraMove: 'slow_push_in',
  },
  {
    id: 'whiteboard-sketch',
    name: 'Whiteboard Sketch',
    description:
      'Hand-drawn Rough.js sketch boxes & arrows on textured paper with highlighter sweeps and taped polaroids.',
    recommendedAspects: ['16:9', '9:16'],
    defaultCameraMove: 'static',
  },
  {
    id: 'tech-3d-data',
    name: 'Tech 3D & Data',
    description:
      'Three.js 3D geometric rig paired with animated bar charts, syntax-highlighted code windows and 3D device mockups.',
    recommendedAspects: ['16:9', '9:16'],
    defaultCameraMove: 'orbit_tilt',
  },
  {
    id: 'dialogue-podcast',
    name: 'Dialogue Podcast',
    description:
      'Two-speaker split stage with reactive voice wave bars synchronized to multi-speaker word timings.',
    recommendedAspects: ['16:9', '9:16'],
    defaultCameraMove: 'slow_push_in',
  },
];

export function getPresetComponent(preset?: PresetId): React.FC<CustomSceneProps> {
  if (preset && PRESET_REGISTRY[preset]) {
    return PRESET_REGISTRY[preset];
  }
  return SaasMotionScene;
}
