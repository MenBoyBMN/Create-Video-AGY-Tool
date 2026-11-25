# Quy chuẩn Motion 60fps & CustomScene

- **Frame rate chuẩn**: Luôn giữ `60fps`. Thời lượng từng beat đi theo `timings.json` được tạo từ bước Audio-First.
- **Cấm chuyển động tuyến tính thô (Linear Easing)**: Mọi animation vào/ra hoặc camera phải dùng `SPRINGS` / `EASINGS` từ `@agy/motion` hoặc `interpolate` với `easing: Easing.bezier(...)` và `extrapolateLeft/Right: 'clamp'`.
- **Safe Zones bắt buộc**:
  - `16:9` (`1920x1080`): giữ nội dung quan trọng & chữ cách mép an toàn theo `SAFE_ZONES['16:9']`, không đè vùng phụ đề dưới.
  - `9:16` (`1080x1920`): tuân thủ `SAFE_ZONES['9:16']` để tránh bị UI TikTok/Reels/Shorts che mất chữ hoặc nút CTA.
- **CustomScene (`projects/<slug>/scenes/*.tsx`)**:
  - Chỉ import các module được whitelist trong `compileCustomScene.mjs`: `react`, `remotion`, `@agy/motion`, `lucide-react`, `@remotion/paths`, `@remotion/shapes`, `@remotion/noise`, `@remotion/motion-blur`, `@remotion/transitions`, `@remotion/three`, `three`, `roughjs`, `recharts`.
  - Mọi custom scene đều được bọc `SceneErrorBoundary` — nếu có lỗi runtime phải đọc stack trace và sửa ngay rồi chạy lại `qa`.
- **Tương phản & Tiếng Việt**: Kiểm tra màu chữ trên nền (`getAdaptivePalette`) và đảm bảo font hiển thị đầy đủ dấu tiếng Việt.
