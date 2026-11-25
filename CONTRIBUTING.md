# Đóng góp & Phát triển (Contributing)

Cảm ơn bạn đã quan tâm đóng góp cho **AGY Video Studio**!

## Kiến trúc tổng quan

- `app/`: Ứng dụng Desktop (Electron Main/Preload + React/Tailwind + `@remotion/player`).
- `cli/agy-studio.mjs`: Cầu nối CLI 6 lệnh (`info`, `init`, `media`, `audio`, `qa`, `export`).
- `engine/`:
  - `motion/`: Design tokens, `Camera25DRig`, `MediaLayer`, `RoughBox`, `DeviceMockup3D`, `CodeWindow`, `AnimatedBarChart`, overlay.
  - `presets/`: 7 preset dựng sẵn 60fps.
  - `runtime/`: `compileCustomScene.mjs` (`esbuild`), `CompositionRoot.tsx`, `customSceneEval.ts`.
  - `audio/`, `media/`, `qa/`: Các pipeline Python.
- `.agents/`: Kho `skills/`, `rules/` và `workflows/` chuẩn hóa quy trình làm việc cho cả con người và AI coding agent.

## Quy tắc trước khi tạo Pull Request / Push

Đọc nhanh các quy tắc trong `.agents/rules/` và chạy đủ 3 lệnh kiểm tra bắt buộc:

```bash
npm run typecheck
npm test
npm run check:release
```

### Lưu ý bảo mật & vệ sinh repo
1. Tuyệt đối **không** commit `.env`, API key, `app-path.json`, `__pycache__/`, `*.pyc`, `release/`, file giọng clone hoặc video/audio nặng trong `exports/` và `projects/`.
2. Không hardcode đường dẫn máy cá nhân (ổ đĩa/thư mục user cục bộ). Dùng `os.homedir()`, `APP_ROOT`, hoặc `~/.agents/...`.
3. Mọi thao tác đọc/ghi đường dẫn dự án từ IPC hoặc CLI phải đi qua helper kiểm tra traversal (`assertSafeProjectId`, `resolveProjectDir`, `resolveSafeProjectDir`, `isWithinDir`).
