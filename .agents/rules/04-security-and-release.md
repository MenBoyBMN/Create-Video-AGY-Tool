# Bảo mật, Khóa tệp nhạy cảm & Quy chuẩn phát hành GitHub

- **Tuyệt đối không đưa lên Git**:
  - File cấu hình chứa khóa bí mật: `.env`, `.env.*` (chỉ giữ `.env.example`), `**/app-path.json`.
  - Dữ liệu cá nhân & file nhị phân nặng: `release/`, `dist/`, `dist-electron/`, `node_modules/`, `**/__pycache__/`, `*.pyc`, `exports/*` (trừ `.gitkeep`), `engine/audio/voices/*.wav`, `engine/audio/sfx_library/*.wav`, các thư mục `projects/*` cá nhân (chỉ giữ bộ khung nhẹ của dự án mẫu `2026-11-23_agy-studio-showcase`).
  - Đường dẫn máy cá nhân cứng dạng `C:/Users/...` hoặc ổ đĩa nội bộ cá nhân. Luôn dùng `~/.agents/...`, `os.homedir()` hoặc đường dẫn tương đối theo `APP_ROOT`.
- **Windows UTF-8 BOM-safe JSON**: Mọi trình đọc JSON phía Node (`readJsonFile`) và Python (`encoding="utf-8-sig"`) phải chịu được UTF-8 BOM khi người dùng chỉnh file bằng Notepad/PowerShell.
- **Chống Path Traversal**:
  - Mọi `projectId` / `projectSlug` nhận từ IPC, CLI hoặc URL `agy-media://` đều phải được kiểm tra bằng `assertSafeProjectId` / `resolveProjectDir` / `isWithinDir`.
  - `shell:openExportFile` chỉ được phép mở file nằm trong thư mục `exports/`.
- **Kiểm tra bắt buộc trước khi push / phát hành**:
  - Chạy `npm run check:release` + `npm run typecheck` + `npm test`.
  - Nếu có thay đổi app Desktop, chạy `npm run build:portable` (script `finalize-portable.mjs` tự giữ lại `.env`, `projects/`, `exports/`, `voices/` của người dùng).
