---
description: Quy trình sản xuất 1 video hoàn chỉnh 60fps bằng AGY Video Studio
---

1. Kích hoạt skill `/agy-video-studio` (hoặc mở `AGY-Video-Studio.exe` để tự đồng bộ `app-path.json`).
2. Kiểm tra môi trường và công cụ cục bộ:
   ```powershell
   node cli/agy-studio.mjs info
   ```
3. Khởi tạo dự án mới (hoặc dùng nút **Dự án mới** trong App):
   ```powershell
   node cli/agy-studio.mjs init --id <YYYY-MM-DD_slug> --title "<Tiêu đề>" --aspect <16:9|9:16> --preset <preset> --voice <voice>
   ```
4. Thu thập B-roll / ảnh minh họa vào `projects/<slug>/assets/` (tự chọn Pixabay hoặc Wikimedia nếu không có key):
   ```powershell
   node cli/agy-studio.mjs media --project <slug> --query "<english keywords>" --type <video|image> --source auto
   ```
5. Hoàn thiện `projects/<slug>/storyboard.json` và các cảnh `projects/<slug>/scenes/*.tsx` (nếu cần đồ họa tùy biến Three.js / Rough.js / Recharts).
6. Chạy Audio-First pipeline để sinh giọng đọc, khớp phụ đề từng từ và master `-14 LUFS`:
   ```powershell
   node cli/agy-studio.mjs audio --project <slug> --progress
   ```
7. Chạy Visual QA và mở xem các file PNG trong `projects/<slug>/qa/`:
   ```powershell
   node cli/agy-studio.mjs qa --project <slug> --progress
   ```
8. Xuất video MP4 60fps ra `exports/`:
   ```powershell
   node cli/agy-studio.mjs export --project <slug> --progress
   ```
