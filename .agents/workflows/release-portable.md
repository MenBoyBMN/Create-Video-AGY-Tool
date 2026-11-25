---
description: Kiểm tra bảo mật, dọn rác, chạy test và đóng gói bản Portable trước khi push GitHub
---

1. Chạy bộ kiểm tra rò rỉ bí mật, file nhị phân nặng và đường dẫn cá nhân:
   ```powershell
   npm run check:release
   ```
2. Kiểm tra TypeScript (Renderer + Electron) và toàn bộ Unit Tests:
   ```powershell
   npm run typecheck
   npm test
   ```
3. Build bản Windows Portable tại `release/AGY-Video-Studio/` (giữ nguyên `.env`, `projects/`, `exports/`, `voices/` hiện có):
   ```powershell
   npm run build:portable
   ```
4. Đồng bộ Skill `/agy-video-studio` mới nhất sang `~/.agents/skills/agy-video-studio/`:
   ```powershell
   npm run install:skill
   ```
5. Kiểm tra `git status` để chắc chắn không có `.env`, `release/`, `node_modules/`, `__pycache__/` hoặc file cá nhân lọt vào commit trước khi `git push`.
