# AGY Video Studio v2

**Studio làm video Motion Graphics 60fps (Electron + React + Remotion) kết hợp Audio-First `-14 LUFS`, Hybrid TTS đa tầng, Visual QA tự động và hệ thống Skill/Rule AI `.agents/` chuẩn Production.**

[![CI](https://github.com/MenBoyBMN/Create-Video-AGY-Tool/actions/workflows/ci.yml/badge.svg)](https://github.com/MenBoyBMN/Create-Video-AGY-Tool/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Tính năng cốt lõi

- **Desktop Studio trực quan (`app/`)**: Xem trước 60fps thời gian thực (`@remotion/player`), Timeline kéo thả SFX + hiển thị sóng âm thật, Inspector chỉnh từng cảnh, và **Hot-Reload 2 chiều** khi AI sửa `storyboard.json` hoặc code `scenes/*.tsx`.
- **7 Preset 60fps + CustomScene mở khóa toàn phần**:
  - Presets: `saas-motion`, `explainer-editorial`, `shorts-kinetic`, `cinematic-broll`, `whiteboard-sketch` (`Rough.js`), `tech-3d-data` (`Three.js` + `Recharts` + code mockup), `dialogue-podcast`.
  - `CustomScene.tsx`: Tự biên dịch bằng `esbuild` với `Three.js`, `Rough.js`, `Recharts`, `Lucide Icons` và thư viện `@agy/motion`.
- **Audio-First v2 chuẩn phát sóng (-14 LUFS)**:
  - **Hybrid TTS 4 tầng**: **Gemini TTS** (diễn cảm & Multi-Speaker 2 nhân vật) → **VieNeu-TTS** (offline tiếng Việt 3 miền & Zero-shot Voice Cloning) → **OpenAI / ElevenLabs** → **Edge-TTS** (miễn phí, tự động dự phòng).
  - **Word Alignment chuẩn từng từ**: `faster-whisper` (CUDA GPU / CPU int8) ánh xạ đúng dấu tiếng Việt, fallback RMS 10ms.
  - **Kho SFX & BGM tích hợp**: 21 hiệu ứng âm thanh 4 lớp + 6 nhạc nền loopable với sidechain ducking & mastering 2-pass `-14 LUFS`.
- **Stock Media Fetcher (`cli media`)**: Tự động tải video/ảnh B-roll miễn phí từ **Pixabay**, **Wikimedia Commons** (không cần key) hoặc **Pexels**.
- **Visual QA & GPU Render**: Chụp keyframe PNG kiểm lỗi tương phản/kích thước/blank frame trước khi render MP4 60fps (`H.264 yuv420p` + `AAC 192k`) qua GPU ANGLE + NVIDIA NVENC.
- **Tích hợp sẵn `.agents/`**: Đầy đủ `skills/agy-video-studio`, `rules/` và `workflows/` để AI cộng tác an toàn theo đúng kiến trúc dự án.

---

## Cài đặt nhanh 1 chạm (Dành cho người tải từ GitHub)

### Yêu cầu hệ thống
- **Windows 10/11** (hoặc macOS/Linux khi chạy chế độ dev/CLI)
- **Node.js 20+** (`winget install OpenJS.NodeJS.LTS`)
- **Python 3.10+** (`winget install Python.Python.3.12`)
- **FFmpeg** (`winget install Gyan.FFmpeg`)

### Chạy cài đặt tự động
Clone repo về máy rồi chạy đúp **`setup.bat`** (hoặc chạy PowerShell):

```powershell
git clone https://github.com/MenBoyBMN/Create-Video-AGY-Tool.git
cd Create-Video-AGY-Tool
.\setup.ps1
```

Các tùy chọn thêm khi cài:
```powershell
# Cài thêm VieNeu-TTS (giọng Việt offline 100% + clone giọng) và build sẵn file chạy .exe Portable
.\setup.ps1 -InstallVieNeu -BuildPortable
```

Sau khi cài xong:
- **Mở bàn dựng Desktop (Dev)**: `npm run dev`
- **Build bản Portable (`.exe`)**: `npm run build:portable` → xuất ra `release/AGY-Video-Studio/AGY-Video-Studio.exe` *(tự động giữ nguyên `.env`, `projects/`, `exports/`, `voices/` khi build lại)*.
- **Dùng với AI Assistant**: Gọi **`/agy-video-studio`** kèm ý tưởng video của bạn.

---

## Cấu hình API Key tùy chọn (`.env`)

App chạy được ngay **miễn phí 100% không cần key** (Edge-TTS + Wikimedia Commons + 21 SFX + 6 BGM). Nếu muốn giọng diễn cảm & video B-roll HD, nhập key trong mục **Cài đặt** của App (hoặc sửa file `.env` cục bộ):

| Biến | Nguồn lấy | Ghi chú |
|---|---|---|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) | Khuyên dùng — mở khóa Gemini TTS diễn cảm & Multi-Speaker |
| `PIXABAY_API_KEY` | [Pixabay API Docs](https://pixabay.com/api/docs/) | Khuyên dùng — tải miễn phí video B-roll `.mp4` HD & ảnh |
| `PEXELS_API_KEY` | Pexels API | *(Pexels hiện tạm ngưng cấp key mới — cứ để trống, hệ thống tự sang Pixabay/Wikimedia)* |
| `VIENEU_TTS_URL` | Server VieNeu-TTS cục bộ | Để trống nếu dùng Python SDK cục bộ (`setup-vieneu-tts.py --install`) |
| `ELEVENLABS_API_KEY` / `OPENAI_API_KEY` | Nhà cung cấp trả phí | Tùy chọn |

---

## Tài liệu & Quy trình

- **Hướng dẫn sử dụng chi tiết**: [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- **Hướng dẫn đóng góp**: [CONTRIBUTING.md](CONTRIBUTING.md)
- **Skill / Rules / Workflows cho AI**: thư mục [`.agents/`](.agents/)
  - Skill đạo diễn video: [`.agents/skills/agy-video-studio/SKILL.md`](.agents/skills/agy-video-studio/SKILL.md)
  - Bộ quy tắc dự án: [`.agents/rules/`](.agents/rules/)
  - Quy trình mẫu: [`.agents/workflows/`](.agents/workflows/)

---

## Lệnh CLI & Kiểm tra trước khi phát hành

```bash
# CLI sản xuất video (6 lệnh chuẩn)
node cli/agy-studio.mjs info
node cli/agy-studio.mjs init --id 2026-11-25_demo --title "Demo" --aspect 16:9 --preset saas-motion
node cli/agy-studio.mjs media --project 2026-11-25_demo --query "modern studio" --type video
node cli/agy-studio.mjs audio --project 2026-11-25_demo --progress
node cli/agy-studio.mjs qa --project 2026-11-25_demo --progress
node cli/agy-studio.mjs export --project 2026-11-25_demo --progress

# Kiểm tra chất lượng & bảo mật trước khi push GitHub
npm run typecheck
npm test
npm run check:release
```

---

## Giấy phép

Phát hành theo giấy phép [MIT License](LICENSE).
