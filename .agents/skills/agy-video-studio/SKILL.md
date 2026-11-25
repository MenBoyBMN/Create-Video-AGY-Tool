---
name: agy-video-studio
description: "Đạo diễn sản xuất video AI v2 gắn với ứng dụng AGY Video Studio (.exe 60fps RTX GPU): phỏng vấn khai thác ý định bằng ask_question (16 phong cách + 7 preset + 6 kiểu phụ đề + Multi-Speaker Podcast), giọng người thật Hybrid TTS (Gemini TTS cảm xúc / VieNeu-TTS offline 3 miền / Edge-TTS), Faster-Whisper CUDA khớp từng từ, Stock B-Roll + AI Art, CustomScene mở khóa Three.js/Rough.js/Recharts/Lucide và Visual QA."
category: media
risk: safe
source: custom
source_type: custom
date_added: "2026-11-25"
tags: [video, agy-video-studio, remotion, electron, gemini-tts, vieneu-tts, faster-whisper, threejs, roughjs, visual-qa, vietnamese]
tools: [antigravity, gemini, claude, cursor]
---

# AGY Video Studio v2 — Đạo Diễn Sản Xuất Video AI (60fps + GPU + Hybrid Audio)

Kỹ năng đạo diễn video AI v2 gắn trực tiếp với ứng dụng **Desktop Portable `AGY-Video-Studio.exe` (60fps, GPU ANGLE + NVIDIA NVENC)** thuộc dự án **AGY Make Video Tool**, kết hợp kho **16 phong cách thị giác chuẩn Creator 2025–2026**, **7 Preset nền tảng**, **6 kiểu phụ đề**, **8 chuyển cảnh**, **Hybrid TTS giống người thật (Gemini TTS cảm xúc & Multi-Speaker / VieNeu-TTS offline / Edge-TTS)**, **`faster-whisper` CUDA** khớp phụ đề chuẩn từng từ, **Stock Media Fetcher miễn phí (`cli media`)** và `CustomScene.tsx` mở khóa `Three.js`, `Rough.js`, `Recharts`, `Lucide Icons`.

---

## Bước 0: Khảo Sát Môi Trường App (Chạy Im Lặng Trước Khi Hỏi)

1. Đọc `app-path.json` nằm cùng thư mục với `SKILL.md` này (`~/.agents/skills/agy-video-studio/app-path.json`) để lấy `appRoot` và `cli`.
2. Chạy nhanh `node "<appRoot>/cli/agy-studio.mjs" info` để nắm trạng thái `toolchain` (bao gồm `gpu.nvencAvailable`, `gpu.cudaWhisperDevices`, `providers.geminiConfigured`, `providers.pexelsConfigured`), `presets` (7 preset), `voices`, `captionStyles`, `transitions`, `sfx` (21 SFX), `bgm` (6 BGM).
3. **Ngoại lệ chỉnh sâu từ App `.exe`:** Nếu người dùng dán trực tiếp prompt từ nút *"✨ Nhờ AGY chỉnh sâu cảnh này bằng Code"* kèm sẵn `projectId` và `SceneName`, đọc ngay `projects/<projectId>/storyboard.json` + `projects/<projectId>/scenes/<SceneName>.tsx`, hỏi nhanh nếu còn điểm mơ hồ bằng `ask_question`, nâng cấp code (App tự Hot-Reload), rồi chạy `cli qa` kiểm duyệt ảnh.

---

## CỔNG 1A: Phỏng Vấn Khai Thác Ý Định Bằng Bảng Chọn Dưới Thanh Chat (HARD STOP)

> **LUẬT CỨNG BẮT BUỘC — CẤM HỎI BẰNG VĂN BẢN THUẦN:**
> - **TUYỆT ĐỐI KHÔNG** liệt kê danh sách câu hỏi bằng chữ thường trong khung chat.
> - **LUÔN LUÔN gọi tool `ask_question`** để Antigravity bật bảng chọn trắc nghiệm tương tác ngay sát thanh chat.
> - **MỌI lựa chọn Thể loại / Phong cách** hiển thị trong `ask_question` **BẮT BUỘC phải có mô tả tiếng Việt ngắn gọn, sinh động ngay trong nhãn lựa chọn** — tuyệt đối không ghi mã khô khan.
> - Đặt phương án phù hợp nhất lên đầu với tiền tố `(Recommended)`.

### Vòng Hỏi 1 (Nội dung, Thể loại, Khung hình & Giọng đọc người thật)
Gọi `ask_question` với 4 câu (bỏ qua câu nào người dùng đã nói rõ ngay từ đầu):
1. **Nguồn kịch bản / Nội dung** *(BẮT BUỘC luôn có tùy chọn AI tự viết lên đầu)*:
   - `(Recommended) Để AI tự tạo kịch bản hoàn chỉnh — AI viết xong sẽ xuất cho tôi xem/chỉnh sửa và CHỈ làm khi tôi đã xác nhận kịch bản`
   - `Tôi đã có kịch bản / dàn ý sẵn — giữ tinh thần gốc nhưng tối ưu lại nhịp giữ chân`
   - `Tôi đã có kịch bản sẵn — giữ NGUYÊN VĂN từng chữ lời thoại, chỉ dựng hình & âm thanh`
   - `Kịch bản / tài liệu đã có sẵn trong máy — tôi sẽ nhập đường dẫn file ở ô 'Other'`
2. **Nhóm thể loại video muốn làm:**
   - `Quảng cáo & Thương mại — Ra mắt sản phẩm 3D, SaaS, thời trang, bán hàng hút mắt`
   - `Phim Bình luận & Video Essay — Phân tích xã hội, kinh tế, công nghệ, Podcast 2 người hỏi đáp (Vox / MagnatesMedia / Ali Abdaal)`
   - `Kể chuyện, Tiểu sử & Giải trí — Lịch sử, thần thoại, phá án True Crime, truyện ngắn hoạt hình/Manga`
   - `Tư liệu Văn hóa Đại chúng & Hoài niệm Tuổi thơ — Ký ức 8x–9x, băng VHS, Internet 2000s, báo giấy & phố xá Việt xưa`
   - `Khoa học & Giáo dục — Vẽ tay Whiteboard, biểu đồ số liệu, giải thích kiến thức dễ hiểu`
3. **Khung hình & Thời lượng mục tiêu:**
   - `(Recommended) 9:16 Dọc (TikTok / Shorts / Reels) — Ngắn 25–45 giây, nhịp nhanh giữ chân`
   - `16:9 Ngang (YouTube / Web) — Trung bình 45–90 giây, chất điện ảnh tài liệu`
   - `16:9 Ngang (YouTube Dài) — 2–5 phút, chia chương đổi nhịp`
   - `16:9 Ngang (Quảng cáo / Intro) — Siêu gọn 15–25 giây`
4. **Giọng đọc (Hybrid TTS v2 trong App):**
   - `(Recommended) Gemini TTS Diễn cảm / Đối thoại 2 người — Tự nhiên như diễn viên lồng tiếng, hỗ trợ tiếng Việt (dùng GEMINI_API_KEY Free Tier nếu đã cài, tự fallback nếu hết quota)`
   - `VieNeu-TTS Offline Tiếng Việt 3 miền / Clone giọng — Chạy 100% trên máy không giới hạn (nếu đã cài VieNeu-TTS)`
   - `Giọng Nam VN trầm ấm miễn phí (vi-VN-NamMinhNeural — Edge-TTS không cần key)`
   - `Giọng Nữ VN sắc sảo miễn phí (vi-VN-HoaiMyNeural — Edge-TTS không cần key)`

### Vòng Hỏi 2 (Chốt Phong cách cụ thể trong 16 Phong cách + Hình ảnh/B-Roll + Điểm bàn giao)
Dựa trên **Nhóm thể loại** vừa chọn, đọc [references/style-catalog.md](references/style-catalog.md) và gọi `ask_question` để người dùng chọn:
1. **Phong cách hình ảnh cụ thể** *(3–4 phong cách hợp nhất từ 16 phong cách kèm mô tả tiếng Việt chi tiết)*.
2. **Nguồn hình ảnh & Đồ họa sống động:**
   - `(Recommended) Pha trộn Ảnh AI (image-generator) + Stock B-Roll miễn phí (cli media) + Đồ họa 3D/Vẽ tay/Biểu đồ 60fps`
   - `Thuần đồ họa chữ động, vẽ tay Whiteboard (Rough.js), Code & Biểu đồ số liệu sắc nét`
   - `Tranh minh họa nghệ thuật AI (image-generator) + hiệu ứng phim nhựa / VHS / cắt dán Zine`
   - `Video đối thoại Podcast 2 nhân vật / Tranh luận góc nhìn (Multi-Speaker)`
3. **Điểm bàn giao trong App AGY-Video-Studio.exe:**
   - `(Recommended) Tạo dự án nháp trong App AGY-Video-Studio.exe (dừng sau Visual QA để mở App xem trước 60fps & tinh chỉnh Timeline)`
   - `Xuất thẳng file MP4 hoàn chỉnh qua GPU RTX (chạy trọn gói tới exports/)`

---

## CỔNG 1B: Xuất Kịch Bản & Kế Hoạch Chi Tiết — Chờ Xác Nhận Trước Khi Làm (HARD STOP)

> **TUYỆT ĐỐI KHÔNG chạy lệnh `init`, sinh TTS, tạo ảnh hay viết code trước khi người dùng đọc, chỉnh sửa (nếu cần) và bấm xác nhận kịch bản + kế hoạch!**

Trình bày đủ 4 mục (Creative Brief kèm preset/captionStyle/transition/bgmTrack trong 6 BGM, Toàn văn kịch bản lời thoại + ghi chú `voiceStyle` hoặc lượt `dialogue`, Storyboard từng Beat, Kế hoạch QA & Render GPU), sau đó **BẮT BUỘC gọi `ask_question`** chờ xác nhận.

---

## Quy Trình Sản Xuất Khép Kín v2 (Sau Khi Được Xác Nhận)

### Bước 2: Khởi Tạo Dự Án, Ảnh AI & Stock B-Roll Miễn Phí
1. **Khởi tạo dự án:**
   ```bash
   node "<appRoot>/cli/agy-studio.mjs" init --id <YYYY-MM-DD_slug> --title "<Tiêu đề>" --aspect <16:9|9:16> --preset <basePreset> --voice <voice>
   ```
   *(7 Preset sẵn có: `saas-motion`, `explainer-editorial`, `shorts-kinetic`, `cinematic-broll`, `whiteboard-sketch`, `tech-3d-data`, `dialogue-podcast`).*
2. **Thu thập hình ảnh & video B-roll sống động vào `projects/<id>/assets/`:**
   - **Ảnh minh họa nghệ thuật:** Dùng `image-generator` lưu vào `projects/<id>/assets/`.
   - **Video B-roll & ảnh tư liệu miễn phí:** Gọi lệnh CLI mới (hỗ trợ Pexels, Pixabay, và **Wikimedia Commons không cần key**!):
     ```bash
     node "<appRoot>/cli/agy-studio.mjs" media --project <id> --query "<từ khóa tiếng Anh>" --type <video|image> --source auto --orientation <landscape|portrait>
     ```
3. **Viết `projects/<id>/storyboard.json`:**
   - Đặt `theme.bgColor`, `theme.accentColor`, `captionStyle` (`editorial-light` cho nền sáng, `hormozi-pop` cho Shorts, `glass-dark` / `minimal-cinematic` / `karaoke-glow` / `typewriter-mono`), `defaultTransition` (`whip-pan`, `slide-left`, `slide-up`, `wipe`, `flash`, `glitch`, `fade`).
   - Có thể gắn `voiceStyle` cho từng beat (khi dùng Gemini TTS) hoặc mảng `dialogue` cho cảnh đối thoại 2 người, `chartData` cho biểu đồ, `codeSnippet` cho cửa sổ code, và `asset: "assets/clip.mp4"` (tất cả 7 preset đều hỗ trợ chạy video `.mp4` B-roll!).

### Bước 3: Audio-First v2 (Hybrid TTS + Faster-Whisper CUDA + `-14 LUFS`)
Đọc chi tiết tại [references/audio-sound-design.md](references/audio-sound-design.md).
```bash
node "<appRoot>/cli/agy-studio.mjs" audio --project <id>
```
- Tự động chọn TTS theo `voice` (Gemini TTS / VieNeu-TTS / OpenAI / ElevenLabs / Edge-TTS fallback), căn phụ đề chuẩn từng từ bằng **`faster-whisper` trên GPU CUDA** (tự fallback RMS 10ms nếu cần), trộn 21 SFX + 6 BGM & Master `-14 LUFS`.

### Bước 4: Dựng Hình 60fps Đa Phong Cách (7 Presets + `CustomScene.tsx` Mở Khóa)
Đọc chi tiết tại [references/motion-cinematography.md](references/motion-cinematography.md) và [references/style-catalog.md](references/style-catalog.md).
- Với các phong cách đặc trưng (*Báo giấy Việt xưa, 90s Zine Scrapbook, Retro VHS 90s, True Crime Hồ sơ Mật, Manga Halftone, Win95/Y2K, Kurzgesagt Pastel*), kết hợp preset phù hợp với **`projects/<id>/scenes/<SceneName>.tsx`**.
- **Các module được phép import trong `CustomScene.tsx` v2:**
  - `react`, `remotion`
  - `@agy/motion` (`SPRINGS`, `EASINGS`, `Camera25DRig`, `ParallaxLayer`, `SAFE_ZONES`, `getAdaptivePalette`, `MediaLayer`, `AnimatedCounter`, `HighlighterText`, `TypewriterBlock`, `CodeWindow`, `DeviceMockup3D`, `RoughBox`, `RoughArrow`, `AnimatedBarChart`, `CrtVhsOverlay`, `PaperTextureOverlay`, `LightLeakOverlay`)
  - `lucide-react`, `@remotion/paths`, `@remotion/shapes`, `@remotion/noise`, `@remotion/motion-blur`, `@remotion/transitions`, `@remotion/three`, `three`, `roughjs`, `recharts`.

### Bước 5: Vòng Lặp Visual QA Tự Kiểm Duyệt (Bắt Buộc)
1. Chụp keyframe PNG bằng GPU ANGLE:
   ```bash
   node "<appRoot>/cli/agy-studio.mjs" qa --project <id>
   ```
2. Mở **toàn bộ ảnh PNG** trong `projects/<id>/qa/` bằng `read_file` và soi: không lỗi compile/runtime, đúng bảng màu & tương phản sáng/tối, không tràn Safe Zone, phụ đề chuẩn tiếng Việt & khớp nhịp.

### Bước 6: Bàn Giao Thành Phẩm (GPU ANGLE + NVIDIA NVENC)
- **Xuất MP4 qua GPU RTX:** `node "<appRoot>/cli/agy-studio.mjs" export --project <id> --progress` → trả về `.mp4` 60fps trong `<appRoot>/exports/`.
- **Bản nháp trong App `.exe`:** Giữ `status: "draft"` trong `project.json` để người dùng mở `AGY-Video-Studio.exe` xem trước & tinh chỉnh.
