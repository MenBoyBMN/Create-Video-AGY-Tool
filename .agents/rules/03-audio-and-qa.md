# Quy chuẩn Audio-First (-14 LUFS) & Visual QA

- **Audio-First bắt buộc**: Luôn chạy `node cli/agy-studio.mjs audio --project <slug>` sau khi thay đổi lời thoại (`narration` / `dialogue`) hoặc `voice` / `bgm` trong `storyboard.json` để cập nhật `audio/master_audio.wav` và `timings.json`.
- **Hybrid TTS 4 tầng**:
  1. `gemini:<voice>` (Gemini Native TTS — hỗ trợ `voiceStyle` & `dialogue` đa nhân vật, tự fallback nếu hết quota).
  2. `vieneu:<voice>` hoặc `vieneu:clone:<name>` (VieNeu-TTS offline tiếng Việt 3 miền & voice cloning, dùng `VIENEU_TTS_URL` hoặc SDK cục bộ).
  3. `openai:<voice>` / `elevenlabs:<voiceId>` (nếu cấu hình key trong `.env`).
  4. `edge-tts` (`vi-VN-HoaiMyNeural`, `vi-VN-NamMinhNeural`, ...) làm dự phòng miễn phí tự động.
- **Word-level Alignment**: Ưu tiên `faster-whisper` (tự nhận CUDA trên GPU NVIDIA, fallback CPU int8) để ánh xạ timestamp về đúng token tiếng Việt gốc; fallback sang acoustic RMS 10ms nếu cần.
- **Mastering**: Mọi audio xuất xưởng đi qua EQ ấm giọng, compression, sidechain ducking BGM và chuẩn hóa 2-pass đạt chuẩn **-14 LUFS**.
- **Visual QA trước khi Export**:
  - Luôn chạy `node cli/agy-studio.mjs qa --project <slug>` sau khi chỉnh `storyboard.json` hoặc `scenes/*.tsx`.
  - Phải mở kiểm tra các ảnh PNG trong `projects/<slug>/qa/` để phát hiện lỗi blank frame, tràn Safe Zone, lỗi tương phản hoặc lỗi compile trước khi chạy `export`.
