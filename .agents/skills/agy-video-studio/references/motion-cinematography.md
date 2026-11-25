# Tài liệu Tham khảo 3: Motion Engine v2, 7 Presets, 6 Phụ Đề & CustomScene Mở Khóa

## 1. 7 Preset Nền Tảng (Hỗ Trợ Cả Nền Sáng/Tối & Video B-Roll `.mp4`)
Tất cả 7 preset đều dùng `getAdaptivePalette(bgColor, accentColor)` để tự chỉnh độ tương phản chữ và dùng `MediaLayer` (chạy được cả ảnh lẫn video B-roll `.mp4`/`.webm`):

1. `saas-motion`: Kính mờ UI, thẻ KPI, danh sách bước & lưới 2.5D.
2. `explainer-editorial`: Báo chí / Video Essay, số chương mờ, cột trích dẫn & ảnh/bước.
3. `shorts-kinetic`: Chữ lớn va đập `HEAVY_IMPACT`, số liệu hero & flash giữ mắt 3s đầu.
4. `cinematic-broll`: Video B-roll hoặc ảnh AI toàn màn hình + Ken Burns + vệt sáng `LightLeakOverlay` + thanh điện ảnh & lower-third.
5. `whiteboard-sketch`: Nền giấy vở + nét vẽ tay **`RoughBox` & `RoughArrow`** (Rough.js + `@remotion/paths`) + quẹt bút dạ quang `HighlighterText` + ảnh Polaroid dán băng dính.
6. `tech-3d-data`: Sân khấu **Three.js 3D (`@remotion/three`)** + `CodeWindow` (có syntax coloring & highlight dòng) + `AnimatedBarChart` (khi beat có `chartData`) + `DeviceMockup3D`.
7. `dialogue-podcast`: Sân khấu 2 nhân vật đối thoại với cột sóng âm nhảy theo `WordTiming.speaker`.

## 2. 6 Kiểu Phụ Đề (`storyboard.captionStyle`)
- `glass-dark`: Hộp kính mờ tối (mặc định).
- `editorial-light`: Hộp giấy kem viền mảnh chữ đen + gạch bút nhớ (bắt buộc cho các phong cách nền sáng như *Apple Swiss*, *Báo giấy kem*, *Việt xưa*, *Kurzgesagt*).
- `hormozi-pop`: Chữ IN HOA lớn, viền đen dày, từ đang phát âm phóng bật màu vàng/accent (tối ưu Shorts/TikTok).
- `karaoke-glow`: Chữ phát sáng từng từ mượt không khung hộp.
- `minimal-cinematic`: Thanh phụ đề phim điện ảnh tinh gọn.
- `typewriter-mono`: Phông máy đánh chữ kỹ thuật (hiển thị kèm thẻ tên `speaker` nếu là hội thoại).

## 3. 8 Chuyển Cảnh Khóa Nhịp Âm Thanh (`beat.transition` / `storyboard.defaultTransition`)
Các chuyển cảnh diễn ra trong 14 frame đầu mỗi beat thông qua `<BeatTransition>` nên **không bao giờ làm lệch 1 frame âm thanh**:
`fade` | `slide-left` | `slide-up` | `wipe` | `whip-pan` *(blur định hướng)* | `flash` | `glitch` | `none`.

## 4. Kho Building Blocks Trong `@agy/motion` & Thư Viện Mở Khóa Cho `CustomScene.tsx`
Mỗi file `projects/<id>/scenes/<SceneName>.tsx` hiện có thể `import` trực tiếp:
- **Từ `@agy/motion`:** `Camera25DRig`, `ParallaxLayer`, `SAFE_ZONES`, `SPRINGS`, `EASINGS`, `springProgress`, `editorialProgress`, `hexToRgba`, `getAdaptivePalette`, `MediaLayer`, `AnimatedCounter`, `HighlighterText`, `TypewriterBlock`, `CodeWindow`, `DeviceMockup3D`, `RoughBox`, `RoughArrow`, `AnimatedBarChart`, `CrtVhsOverlay`, `PaperTextureOverlay`, `LightLeakOverlay`.
- **Thư viện ngoài được phép import:** `lucide-react` (biểu tượng vector sắc nét), `roughjs`, `recharts`, `@remotion/paths`, `@remotion/shapes`, `@remotion/noise`, `@remotion/motion-blur`, `@remotion/transitions`, `@remotion/three`, `three`.

## 5. Safe Zones & GPU RTX Rendering
- **16:9 (`1920x1080`):** Lề an toàn `top: 68, bottom: 120, left: 96, right: 96`.
- **9:16 (`1080x1920`):** Lề an toàn `top: 220, bottom: 420, left: 64, right: 170` (tránh UI TikTok/Shorts).
- **Render GPU:** CLI tự bật `gl=angle` + `hardwareAcceleration=if-possible` (NVENC) với `concurrency=3` để chạy mượt mà trên RTX 3050 4GB VRAM.
