# Hướng dẫn sử dụng AGY Video Studio v2

Tài liệu chi tiết dành cho người dùng cuối từ lúc cài đặt trên máy mới cho tới khi xuất bản video MP4 60fps.

---

## 1. Yêu cầu hệ thống & Cài đặt 1 chạm

### Yêu cầu trước khi cài (Windows)
- **Node.js 20+**: `winget install OpenJS.NodeJS.LTS`
- **Python 3.10+**: `winget install Python.Python.3.12`
- **FFmpeg** *(nên dùng bản có `ffprobe`)*: `winget install Gyan.FFmpeg`
- *(Tùy chọn)* **GPU NVIDIA RTX**: Tự động kích hoạt tăng tốc `faster-whisper` CUDA và mã hóa video phần cứng `h264_nvenc`.

### Cài đặt tự động
Chạy đúp file **`setup.bat`** hoặc mở PowerShell tại thư mục dự án:

```powershell
# Cài chuẩn (Node + Python + Skill /agy-video-studio)
.\setup.ps1

# Cài kèm VieNeu-TTS offline & build luôn file chạy Portable .exe
.\setup.ps1 -InstallVieNeu -BuildPortable
```

---

## 2. Cấu hình Cài đặt & API Key (Tùy chọn)

Mặc định ứng dụng **chạy miễn phí 100% không cần API key** nhờ giọng tiếng Việt **Edge-TTS**, ảnh tư liệu **Wikimedia Commons**, **21 hiệu ứng SFX** và **6 nhạc nền BGM** có sẵn.

Để nâng cấp giọng đọc diễn cảm và tải video B-roll HD miễn phí, mở **App → Cài đặt** (hoặc sửa file `.env` cục bộ — file này bị `.gitignore` khóa, không bao giờ đẩy lên Git):

| Khóa cấu hình | Cách lấy | Công dụng |
|---|---|---|
| `GEMINI_API_KEY` | Miễn phí tại [Google AI Studio](https://aistudio.google.com/apikey) | Giọng **Gemini TTS** (`gemini-3.8-flash-tts`) diễn cảm (`<laugh>`, `<whisper>`, `<sigh>`) & đối thoại **Multi-Speaker Podcast** |
| `PIXABAY_API_KEY` | Miễn phí tại [Pixabay API Docs](https://pixabay.com/api/docs/) (đăng nhập là thấy sẵn `key`) | Tải **video B-roll `.mp4` HD** và ảnh miễn phí qua `cli media` |
| `PEXELS_API_KEY` | *(Hiện Pexels đang tạm ngưng cấp key mới — cứ để trống)* | Tự động bỏ qua nếu để trống |
| `VIENEU_TTS_URL` | *(Để trống nếu dùng Python SDK cục bộ)* | Chỉ điền nếu bạn tự chạy HTTP server VieNeu-TTS riêng (VD: `http://127.0.0.1:8008`) |
| `ELEVENLABS_API_KEY` / `OPENAI_API_KEY` | *(Trả phí, tùy chọn)* | Giọng đọc ElevenLabs / OpenAI TTS |

### Cài giọng Việt Offline 100% & Clone giọng cá nhân (VieNeu-TTS)
1. Cài **eSpeak NG** (bắt buộc trên Windows): `winget install eSpeak-NG.eSpeak-NG`
2. Cài SDK VieNeu: `python scripts/setup-vieneu-tts.py --install`
3. Dùng sẵn giọng vùng miền: chọn `vieneu:south-female` hoặc `vieneu:north-male`.
4. **Clone giọng của chính bạn**:
   - Thu âm 1 đoạn giọng sạch nhiễu dài **5–10 giây** vào `engine/audio/voices/narrator.wav`
   - Tạo file `engine/audio/voices/narrator.txt` ghi chính xác câu bạn đã đọc trong file `.wav`
   - Chọn giọng đọc `vieneu:clone:narrator`.

---

## 3. Hai cách làm việc chính

### Cách A: Giao cho AI làm trọn gói bằng `/agy-video-studio`
1. Mở **Project Hub** hoặc chạy `npm run install:skill` để đồng bộ skill `/agy-video-studio`.
2. Trong AI Assistant (Antigravity / Claude / Gemini / Cursor hỗ trợ `.agents/skills`), gõ `/agy-video-studio` kèm chủ đề video.
3. Trả lời 2 vòng bảng chọn nhanh (nguồn kịch bản, thể loại, 16:9 hay 9:16, giọng đọc, phong cách hình ảnh).
4. Duyệt **Kịch bản & Storyboard** AI xuất ra trước khi AI chạy sản xuất.
5. AI tự động: `init` → tải `media` / vẽ ảnh → chạy `audio` (-14 LUFS + khớp từng từ) → viết `scenes/*.tsx` → chạy `qa` tự soi từng khung hình PNG → xuất MP4 hoặc để bản nháp cho bạn chỉnh thêm.

### Cách B: Dựng & Tinh chỉnh trực quan trên Desktop App
1. Chạy `npm run dev` (hoặc mở `release/AGY-Video-Studio/AGY-Video-Studio.exe` nếu đã build portable).
2. Ở **Project Hub**:
   - Kiểm tra huy hiệu xanh *"Đã đồng bộ đường dẫn với AGY Skill"*.
   - Bấm **Dự án mới** (chọn `16:9` hoặc `9:16`, preset khởi đầu, giọng đọc) hoặc mở dự án mẫu `2026-11-23_agy-studio-showcase`.
3. Trong **Bàn dựng (Studio Editor)**:
   - **Phím tắt**: `Space` (Phát/Tạm dừng), `←` / `→` (Nhích từng khung hình `1/60s`).
   - **Timeline**: Xem sóng âm thật (`waveformPeaks`), bấm vào từng cảnh (`beat`) để nhảy Playhead, xem track phụ đề và **kéo thả vị trí âm thanh SFX** trực tiếp trên thanh thời gian.
   - **Inspector** (cột phải — 3 tab *Nội dung*, *Hình ảnh*, *Âm thanh*): sửa tiêu đề, lời thoại, preset, màu chủ đạo, góc máy (`Camera25DRig`), kiểu chuyển cảnh, kiểu phụ đề, nhập ảnh/video B-roll vào `assets/`.
   - **Nhờ AI nâng cấp 1 cảnh bằng code**: Bấm nút copy prompt trong Inspector để gửi đúng ngữ cảnh `beat` cho AI viết/sửa `scenes/<SceneName>.tsx` — khi AI lưu file, **App tự Hot-Reload khung hình ngay lập tức**.
   - **3 nút xuất bản**:
     1. **Tạo Audio**: Sinh TTS + khớp phụ đề + Master `-14 LUFS`.
     2. **Chụp QA**: Chụp ảnh keyframe PNG kiểm lỗi vào `qa/` và cập nhật `thumbnail.png`.
     3. **Xuất MP4**: Render video 60fps (`H.264 yuv420p` + `AAC 192k`) vào thư mục `exports/`.

---

## 4. Xử lý sự cố thường gặp

- **Không thấy giọng Gemini / Báo hết quota**: Kiểm tra lại `GEMINI_API_KEY` trong *Cài đặt*; nếu hết hạn mức miễn phí, pipeline tự động fallback sang Edge-TTS để không bị gián đoạn render.
- **Lỗi thiếu `ffmpeg` hoặc `python`**: Mở *Cài đặt → Công cụ hệ thống cục bộ* để xem trạng thái hoặc trỏ đúng đường dẫn `ffmpeg.exe` / `python.exe`.
- **Render chậm trên máy không có GPU rời**: Vào *Cài đặt* đổi *Chromium WebGL* sang `swiftshader`, tắt *NVENC* (`disable`) và đặt số luồng render về `2`.
- **Chỉnh tay JSON trên Windows bị lỗi parse**: Đã hỗ trợ đọc UTF-8 có hoặc không có BOM trên toàn bộ CLI, Electron và Python pipeline.
