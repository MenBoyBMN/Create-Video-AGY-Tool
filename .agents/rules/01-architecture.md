# Kiến trúc 4 lớp — AGY Video Studio

Dự án gồm 4 lớp tách biệt, giao tiếp qua hợp đồng dữ liệu thống nhất trong `projects/<slug>/`:

1. **Desktop UI (`app/`)**:
   - `app/electron/main.ts` & `preload.ts`: Cửa sổ Electron, giao thức `agy-media://` (HTTP Range streaming), file watcher Hot-Reload (`projects/<slug>/`), đồng bộ đường dẫn skill (`~/.agents/skills/agy-video-studio/app-path.json`).
   - `app/src/`: React + Tailwind + `@remotion/player` (`ProjectHub.tsx`, `StudioEditor.tsx`, `Timeline.tsx`, `Inspector.tsx`, `SettingsModal.tsx`, `VideoPreviewModal.tsx`).
2. **CLI Bridge (`cli/agy-studio.mjs`)**:
   - Giao diện 6 lệnh chuẩn dùng chung cho cả AI, Electron và terminal: `info`, `init`, `media`, `audio`, `qa`, `export`.
   - Mọi tiến trình chạy nền phát JSON progress lines qua `stderr` (`--progress`) và trả kết quả JSON cuối cùng qua `stdout`.
3. **Engine (`engine/`)**:
   - `engine/motion/`: Design tokens (`FPS = 60`, `SPRINGS`, `EASINGS`, `SAFE_ZONES`, `ASPECT_DIMS`), thành phần chuyển động (`Camera25DRig`, `ParallaxLayer`, `MediaLayer`, `RoughBox`, `DeviceMockup3D`, `CodeWindow`, `AnimatedBarChart`, overlay...).
   - `engine/presets/`: 7 preset 60fps (`saas-motion`, `explainer-editorial`, `shorts-kinetic`, `cinematic-broll`, `whiteboard-sketch`, `tech-3d-data`, `dialogue-podcast`).
   - `engine/runtime/`: Trình biên dịch `compileCustomScene.mjs` (`esbuild`), `CompositionRoot.tsx`, `customSceneEval.ts`.
   - `engine/audio/` & `engine/media/` & `engine/qa/`: Pipeline Python cho TTS, Faster-Whisper alignment, FFmpeg `-14 LUFS`, stock fetcher và kiểm duyệt ảnh QA.
4. **Scripts (`scripts/`)**:
   - Build renderer/Electron (`build-electron.mjs`), đóng gói portable bảo toàn dữ liệu (`finalize-portable.mjs`), cài skill (`install-skill.mjs`), kiểm tra bảo mật release (`security-check.mjs`), cài VieNeu-TTS (`setup-vieneu-tts.py`).

## Quy tắc thay đổi code
- Giữ **Single Source of Truth**: Không trùng lặp logic giữa Electron IPC và CLI — mọi thao tác pipeline nặng (`audio`, `qa`, `export`, `init`, `info`) đi qua `cli/agy-studio.mjs`.
- Khi thêm preset hoặc dependency cho `CustomScene.tsx`, phải cập nhật đồng bộ cả `engine/runtime/compileCustomScene.mjs` (`EXTERNAL_MODULES`), `engine/runtime/customSceneEval.ts` và `cli/agy-studio.mjs` (`PRESETS_INFO`).
