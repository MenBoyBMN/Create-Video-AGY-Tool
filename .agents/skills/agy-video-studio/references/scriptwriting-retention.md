# Tài liệu Tham khảo 1: Kịch bản Giữ chân & Chống AI Slop

## 1. Tâm lý học Giữ chân (Retention Psychology)
- **Kẻ giết retention số 1 là "Hiểu sớm" (Premature Understanding):** Ngay khi khán giả cảm thấy *"Mình đoán được phần sau rồi"*, họ lập tức lướt qua.
- **Nguyên tắc Ba Lời Hứa (MrBeast Three Promises):** Giây đầu tiên phải khớp ngay với kỳ vọng về *Cảm xúc* (kịch tính/tò mò/hài), *Chủ đề* và *Cấu trúc*. Không được lạc tông.

## 2. 5 Công thức Hook (0–3 giây đầu)
1. **Curiosity Gap:** Mở khoảng trống thông tin não bắt buộc phải đóng (*"Mình đã phân tích 200 cú sập thị trường — chỉ có đúng 1 dấu hiệu không bao giờ nói dối."*).
2. **Bold Contrarian:** Phản trực giác đám đông (*"Càng nhiều người hét lên 'bong bóng', bong bóng đó càng khó nổ."*).
3. **Specific Proof / Number:** Số liệu cụ thể gây choáng (*"Từ 0 đến 1,4 triệu tim chỉ trong 4 phút — đây là cái bẫy tâm lý đứng sau nó."*).
4. **Pain-Point Callout:** Gọi thẳng nỗi đau người xem (*"Tại sao video của bạn luôn đứng yên ở 300 lượt xem?"*).
5. **In Media Res + Visual Anchor:** Bắt đầu ngay giữa khoảnh khắc căng thẳng nhất, khớp hình – tiếng trong 0.5 giây đầu.

## 3. Khung Kể Chuyện
- **ABT (And – But – Therefore):**
  - *AND:* Thiết lập thực tế quen thuộc.
  - *BUT:* Tung nghịch lý / rào cản / cú sốc phá vỡ trạng thái cũ.
  - *THEREFORE:* Mở ra hệ quả hoặc nút thắt cần giải đáp.
- **Veritasium (Misconception Trap):** Đặt câu hỏi dễ đoán sai → chứng minh trực giác sai → lật mở cơ chế thật.
- **Kurzgesagt (Humanization of Scale):** Biến khái niệm vĩ mô (kinh tế, khoa học, lịch sử) thành một câu chuyện có nhân vật cụ thể và ẩn dụ trực quan đời thường.
- **Write Backwards:** Luôn viết **Retention Anchor** (câu kết / cú lật đắt nhất) trước, sau đó mới viết ngược lên phần dẫn và Hook.

## 4. Nhịp độ & Pattern Interrupts (Mỗi 3–5 giây)
- **Tốc độ đọc chuẩn:** `140–160 từ/phút` (~2.3–2.6 từ/giây). Video 50s chỉ viết **110–125 từ** để chừa khoảng thở cho SFX và hình ảnh.
- **Luân phiên 3 loại ngắt nhịp:**
  - *Visual:* Đổi góc/scale camera, đẩy vật thể tiền cảnh vào, đổi bảng màu, highlight động.
  - *Audio:* Cắt nhạc đột ngột (`0.3–0.6s`), tiếng whoosh/paper crinkle/pop, đổi sắc thái giọng.
  - *Narrative:* Câu hỏi ngược ngắn (*"Nghe vô lý đúng không?"*), câu cụt 2–4 từ đập nhịp (*"Họ đã sai. Sai hoàn toàn."*).

## 5. Bộ lọc Diệt "AI Slop" (Cấm tuyệt đối)
- **Tiếng Việt cấm dùng:**
  - *"Trong thế giới hiện đại ngày nay..."*, *"Trong bối cảnh..."*
  - *"Không chỉ dừng lại ở đó..."*, *"Bên cạnh đó..."*
  - *"Đóng vai trò vô cùng quan trọng..."*, *"Là minh chứng rõ nét cho..."*
  - *"Hãy cùng chúng tôi khám phá..."*, *"Tóm lại, có thể thấy rằng..."*
- **Tiếng Anh cấm dùng:**
  - `delve`, `tapestry`, `beacon`, `testament`, `in today's fast-paced world`, `at its core`, `not only X, but also Y`, `furthermore`, `in conclusion`, `picture this`.
- **Bài test hơi thở (Breath Test):** Đọc thành tiếng; nếu hết hơi trước dấu chấm/phẩy → chặt thành 2 câu ngắn. Dùng động từ mạnh và danh từ nhìn thấy được thay cho khái niệm trừu tượng.

## 6. Chuẩn Beat-Sheet JSON Schema
```json
{
  "meta": {
    "id": "demo-slug",
    "title": "Tiêu đề video",
    "fps": 60,
    "aspect": "16:9",
    "style": "explainer-editorial",
    "targetLufs": -14
  },
  "beats": [
    {
      "id": "beat_01",
      "role": "HOOK",
      "narration": "Lời thoại ngắn gọn, giàu hình ảnh.",
      "keywords": ["từ khóa nhấn"],
      "visualMetaphor": "Mô tả ẩn dụ hình ảnh xuất hiện trên màn hình",
      "camera": { "move": "slow_push_in", "focusDepth": 0.7 },
      "patternInterrupt": "Điểm ngắt nhịp thị giác/âm thanh",
      "sfx": [
        { "cue": "start", "file": "sfx_inflate.wav", "layer": "detail", "volume": 0.5 }
      ],
      "bgmEnergy": "suspense",
      "silenceBeforeNextMs": 0
    }
  ]
}
```
