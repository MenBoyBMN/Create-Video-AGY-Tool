# Tài liệu Tham khảo 2: Âm thanh v2, Hybrid TTS, Faster-Whisper & Mastering FFmpeg

## 1. Hệ Thống Hybrid TTS 4 Tầng Trong `audio_pipeline.py`
`engine/audio/audio_pipeline.py` tự động định tuyến giọng đọc theo tiền tố `voice` trong `storyboard.json` và tự động fallback an toàn nếu thiếu key hoặc hết quota:

| Engine & Tiền tố `voice` | Điểm mạnh nổi bật | Điều kiện sử dụng |
| :--- | :--- | :--- |
| **Gemini Native TTS** (`gemini:Puck`, `Kore`, `Charon`, `Aoede`, `Fenrir`) | Diễn xuất giống người thật theo `voiceStyle` từng beat, hỗ trợ `<whisper>`, `<laugh>`, `<sigh>`, `<short pause>` và **Multi-Speaker `dialogue`** trong 1 lần gọi. | Cần `GEMINI_API_KEY` (Free Tier tại Google AI Studio) trong `.env`. Hết quota tự fallback sang Edge-TTS. |
| **VieNeu-TTS Offline** (`vieneu:south-female`, `vieneu:north-male`, `vieneu:clone:<tên>`) | Giọng Việt chuẩn 3 miền Bắc–Trung–Nam, **nhân bản giọng tức thì** từ file `.wav` + `.txt` trong `engine/audio/voices/`, chạy 100% offline không giới hạn. | Chạy `python scripts/setup-vieneu-tts.py --install` hoặc trỏ `VIENEU_TTS_URL` trong `.env`. |
| **Edge-TTS (Dự phòng mặc định)** (`vi-VN-NamMinhNeural`, `vi-VN-HoaiMyNeural`, `en-US-*`) | Miễn phí 100%, không cần key, tự động luân phiên giọng Nam/Nữ cho beat có `dialogue`. | Có sẵn ngay khi mở App. |
| **OpenAI / ElevenLabs** (`openai:alloy`, `elevenlabs:default`) | Giọng API thương mại cao cấp. | Cần `OPENAI_API_KEY` / `ELEVENLABS_API_KEY` trong `.env`. |

### Chỉ đạo cảm xúc & Hội thoại Multi-Speaker trong `storyboard.json`
- **Single-speaker có cảm xúc:**
  ```json
  {
    "id": "beat-1",
    "voiceStyle": "Giọng trầm ấm, chậm rãi, hơi bí ẩn như kể chuyện đêm khuya",
    "narration": "Ít ai biết rằng <short pause> bức ảnh này từng thay đổi cả lịch sử. <whisper> Nhưng sự thật lại nằm ở phía sau."
  }
  ```
- **Multi-Speaker Podcast / Phản biện (`preset: "dialogue-podcast"`):**
  ```json
  {
    "id": "beat-2",
    "preset": "dialogue-podcast",
    "dialogue": [
      { "speaker": "Minh", "voice": "gemini:Puck", "style": "tò mò", "text": "Nhưng liệu AI có thay thế hoàn toàn editor không?" },
      { "speaker": "Lan", "voice": "gemini:Kore", "style": "dứt khoát, thân thiện", "text": "Không đâu, nó chỉ biến một người thành cả một studio!" }
    ]
  }
  ```

## 2. Khớp Phụ Đề Chuẩn Từng Từ (`faster-whisper` CUDA → RMS 10ms)
- `engine/audio/whisper_aligner.py` chạy **`faster-whisper` (`small`, `float16` trên GPU CUDA RTX 3050)** để đo timestamp thực tế của từng từ, sau đó dùng Sequence Alignment ánh xạ ngược về nguyên văn tiếng Việt trong `narration` (giữ nguyên 100% dấu tiếng Việt & dấu câu, tự động bỏ thẻ `<whisper>`/`<laugh>` khỏi phụ đề hiển thị).
- Khi xong toàn bộ beat, VRAM GPU được giải phóng hoàn toàn trước bước FFmpeg & Export.

## 3. Kho 21 SFX 4 Lớp & 6 BGM Trong `sfx_generator.py`
Nếu bạn chép file `.wav`/`.mp3` thu âm thật vào `engine/audio/sfx_library/samples/<id>.wav`, pipeline sẽ tự động ưu tiên file thu thật đó!

- **Body:** `sub_impact`, `bass_drop`, `deep_boom`, `cinematic_braam`
- **Movement:** `whoosh_fast`, `whoosh_soft`, `swoosh_rise`, `whip_pan`, `tape_rewind`
- **Detail:** `pop`, `click_ui`, `chime_ping`, `type_tick`, `camera_shutter`, `paper_flip`, `chalk_write`, `glitch_zap`
- **Emotion:** `riser_tension`, `shimmer_reveal`, `success_chord`, `bell_soft`
- **BGM (6 track loopable):**
  - `bgm_ambient_tech` (SaaS / Tech 3D)
  - `bgm_editorial_pulse` (Báo chí / Video Essay)
  - `bgm_upbeat_kinetic` (Shorts / Reels / Quảng cáo)
  - `bgm_lofi_warm` (Hoài niệm 8x–9x / Sổ tay năng suất)
  - `bgm_noir_tension` (True Crime / Tài liệu tối)
  - `bgm_cinematic_piano` (Kể chuyện / Sơn dầu / Tạp chí)

## 4. Broadcast Mastering (`-14 LUFS / -1.0 dBTP`)
- Voice bus: `highpass=75Hz` → độ ấm `+1.5dB@180Hz` → độ rõ lời `+1.8dB@3.2kHz` → nén động `acompressor` → Sidechain Ducking BGM → Two-pass `loudnorm` chuẩn YouTube/TikTok.
